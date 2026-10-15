/**
 * transfer-planner.js — CompareAudit + graphs → TransferPlan.v1 (Phase 6).
 *
 * The planner never edits target XML; it only produces reviewable rows.
 * Blocked rows stay visible with their blocked reason. Geometry fields are
 * never transferable unless config.allowGeometryTransfer is explicitly true.
 */

import {
  CONTRACT_VERSIONS, DIFF_STATUS, TRANSFER_RULES, APPROVAL_STATUS,
  GEOMETRY_PROTECTED_FIELDS, CONFIDENCE,
} from '../contracts/contracts.js';

export const DEFAULT_TRANSFER_CONFIG = Object.freeze({
  rule: TRANSFER_RULES.FILL_BLANK_ONLY,
  minConfidence: CONFIDENCE.HIGH,
  allowGeometryTransfer: false,
  transferPackets: true,
  transferProperties: true,
  excludeProperties: [],
});

export const GLOBAL_OVERRIDE_REASON = 'excluded by global override';

const CONFIDENCE_RANK = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };
const TRANSFERABLE_STATUSES = [DIFF_STATUS.MATCHED_UNCHANGED, DIFF_STATUS.PROPERTY_CHANGED, DIFF_STATUS.GEOMETRY_CHANGED];

export function buildTransferPlan(compareAudit, topoA, topoB, userConfig = {}) {
  const config = { ...DEFAULT_TRANSFER_CONFIG, ...userConfig };
  const elementsOf = (topo) => topo?.edges ?? topo?.objects ?? [];
  const idOf = (element) => element.id ?? element.objectId;
  const objA = new Map(elementsOf(topoA).map((o) => [idOf(o), o]));
  const objB = new Map(elementsOf(topoB).map((o) => [idOf(o), o]));
  const rows = [];
  let seq = 0;

  const pushRow = (diffRow, property, oldValue, newValue, kind, blockedReason) => {
    seq += 1;
    const isGeometry = GEOMETRY_PROTECTED_FIELDS.includes(String(property).toUpperCase());
    let reason = blockedReason ?? null;
    if (!reason && (config.excludeProperties ?? []).includes(String(property))) reason = GLOBAL_OVERRIDE_REASON;
    if (!reason && isGeometry && !config.allowGeometryTransfer) reason = 'geometry field protected (enable geometry transfer explicitly)';
    if (!reason && CONFIDENCE_RANK[diffRow.confidence] < CONFIDENCE_RANK[config.minConfidence]) {
      reason = `confidence ${diffRow.confidence} below required ${config.minConfidence}`;
    }
    if (!reason && config.rule === TRANSFER_RULES.FILL_BLANK_ONLY && String(oldValue ?? '').trim() !== '' && String(oldValue) !== String(newValue)) {
      reason = `target already has value "${oldValue}" (FILL_BLANK_ONLY)`;
    }
    rows.push({
      rowId: `T${seq}`,
      diffId: diffRow.diffId,
      sourceObjectId: diffRow.sourceObjectId,
      targetObjectId: diffRow.targetObjectId,
      targetRawIndex: objB.get(diffRow.targetObjectId)?.rawIndex ?? null,
      property,
      kind, // 'attribute' | 'packet'
      oldValue: oldValue ?? '',
      newValue,
      rule: config.rule,
      confidence: diffRow.confidence,
      score: diffRow.score,
      reason: diffRow.reasons?.slice(0, 3).join('; ') ?? '',
      approval: reason ? APPROVAL_STATUS.BLOCKED : APPROVAL_STATUS.PENDING,
      blockedReason: reason,
    });
  };

  for (const diffRow of compareAudit.objectDiff.rows) {
    if (!diffRow.sourceObjectId || !diffRow.targetObjectId) continue;
    if (!TRANSFERABLE_STATUSES.includes(diffRow.status)) continue; // AMBIGUOUS / SPLIT / MERGE never plan rows
    const source = objA.get(diffRow.sourceObjectId);
    const target = objB.get(diffRow.targetObjectId);
    if (!source || !target) continue;

    if (config.transferProperties && source.properties) {
      for (const [property, value] of Object.entries(source.properties)) {
        const targetValue = target.properties?.[property] ?? '';
        if (String(targetValue) === String(value)) continue; // identical — nothing to transfer
        pushRow(diffRow, property, targetValue, value, 'attribute', null);
      }
    }
    if (config.transferPackets && source.packets) {
      const targetKinds = new Set((target.packets || []).map((p) => p.kind));
      for (const packet of source.packets) {
        if (targetKinds.has(packet.kind)) continue; // packet kind already present on target
        pushRow(diffRow, `PACKET:${packet.kind}`, '', JSON.stringify(packet.attrs), 'packet', null);
      }
    }
  }

  const blocked = rows.filter((r) => r.approval === APPROVAL_STATUS.BLOCKED).length;
  return {
    contract: CONTRACT_VERSIONS.TransferPlan,
    generatedAt: new Date().toISOString(),
    config,
    rows,
    summary: {
      totalRows: rows.length,
      pendingRows: rows.length - blocked,
      blockedRows: blocked,
      approvedRows: 0,
      elementsWithRows: new Set(rows.map((r) => r.targetObjectId)).size,
    },
  };
}

/** Recompute plan summary after approval edits. */
export function refreshTransferSummary(plan) {
  plan.summary = {
    totalRows: plan.rows.length,
    pendingRows: plan.rows.filter((r) => r.approval === APPROVAL_STATUS.PENDING).length,
    blockedRows: plan.rows.filter((r) => r.approval === APPROVAL_STATUS.BLOCKED).length,
    approvedRows: plan.rows.filter((r) => r.approval === APPROVAL_STATUS.APPROVED).length,
    rejectedRows: plan.rows.filter((r) => r.approval === APPROVAL_STATUS.REJECTED).length,
    elementsWithRows: new Set(plan.rows.map((r) => r.targetObjectId)).size,
  };
  return plan;
}

/** Batch approve pending rows that meet a confidence floor (never blocked rows). */
export function batchApprove(plan, minConfidence = CONFIDENCE.HIGH) {
  for (const row of plan.rows) {
    if (row.approval !== APPROVAL_STATUS.PENDING) continue;
    if (CONFIDENCE_RANK[row.confidence] >= CONFIDENCE_RANK[minConfidence]) row.approval = APPROVAL_STATUS.APPROVED;
  }
  return refreshTransferSummary(plan);
}
