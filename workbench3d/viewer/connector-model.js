/**
 * connector-model.js — pure builder for ConnectorModel.v1 (Phase 5).
 *
 * Connectors are first-class audit-linked objects, not decorative lines:
 * every connector carries source/target object ids, type, confidence/status,
 * reason, visibility modes, and the audit row id it was derived from.
 * The builder is pure (no Three.js, no DOM) so audit-link integrity is
 * testable in Node; the viewer only renders what this module produces.
 *
 * Visibility policy (enforced by the viewer):
 *   hidden by default → shown per mode, hover, selection, conflict review,
 *   transfer preview, or registration audit.
 */

import { CONTRACT_VERSIONS, CONNECTOR_TYPES, APPROVAL_STATUS } from '../contracts/contracts.js';

function midpointIndex(visualModel, offset = [0, 0, 0]) {
  const map = new Map();
  for (const seg of visualModel?.segments ?? []) {
    map.set(seg.objectId, [
      (seg.start[0] + seg.end[0]) / 2 + offset[0],
      (seg.start[1] + seg.end[1]) / 2 + offset[1],
      (seg.start[2] + seg.end[2]) / 2 + offset[2],
    ]);
  }
  // Segment-less models (node sets) anchor connectors on object markers.
  for (const marker of visualModel?.markers ?? []) {
    if (!marker.objectId || map.has(marker.objectId)) continue;
    if (!marker.isObjectMarker) continue;
    map.set(marker.objectId, [marker.position[0] + offset[0], marker.position[1] + offset[1], marker.position[2] + offset[2]]);
  }
  return map;
}

function nodeIndex(graph, offset = [0, 0, 0]) {
  const map = new Map();
  for (const node of graph?.nodes ?? []) {
    map.set(node.nodeId, [node.coordMm[0] + offset[0], node.coordMm[1] + offset[1], node.coordMm[2] + offset[2]]);
  }
  return map;
}

/**
 * Build ConnectorModel.v1 from the compare audit (+ optional transfer plan).
 *
 * @param {object} args { compareAudit, transferPlan, sourceVisual, targetVisual,
 *                        sourceGraph, targetGraph }
 * Source endpoints are pre-shifted by the registration translation so the
 * viewer can render connectors in world space without further math.
 */
export function buildConnectorModel({ compareAudit, transferPlan = null, sourceVisual, targetVisual, sourceGraph, targetGraph }) {
  const translation = compareAudit?.registration?.translationMm ?? [0, 0, 0];
  const srcMid = midpointIndex(sourceVisual, translation);
  const tgtMid = midpointIndex(targetVisual);
  const srcNodes = nodeIndex(sourceGraph, translation);
  const tgtNodes = nodeIndex(targetGraph);

  const connectors = [];
  let seq = 0;
  const push = (type, sourceObjectId, targetObjectId, from, to, extra) => {
    if (!from || !to) return; // endpoint not renderable — skip, never guess
    seq += 1;
    connectors.push({
      connectorId: `K${seq}`,
      type,
      sourceObjectId: sourceObjectId ?? null,
      targetObjectId: targetObjectId ?? null,
      from, to,
      visibleModes: VISIBLE_MODES[type],
      selectable: true,
      hoverable: true,
      ...extra,
    });
  };

  for (const row of compareAudit?.objectDiff?.rows ?? []) {
    if (row.sourceObjectId && row.targetObjectId) {
      // Basis rows (identity or manual anchors) are their own connector class
      // so the viewer can give them a unique colour and mode.
      push(row.basis ? CONNECTOR_TYPES.BASIS_CONNECTOR : CONNECTOR_TYPES.MATCH_CONNECTOR,
        row.sourceObjectId, row.targetObjectId,
        srcMid.get(row.sourceObjectId), tgtMid.get(row.targetObjectId), {
          status: row.status,
          confidence: row.confidence,
          score: Number.isFinite(row.score) ? row.score : null,
          basis: Boolean(row.basis),
          via: row.via,
          reason: row.reasons?.[0] ?? `score ${row.score}`,
          auditRowId: row.diffId,
          auditSource: 'objectDiff',
        });
    }
    if (row.status === 'AMBIGUOUS') {
      for (const candidateId of row.candidateTargetIds ?? []) {
        push(CONNECTOR_TYPES.CONFLICT_CONNECTOR, row.sourceObjectId, candidateId,
          srcMid.get(row.sourceObjectId), tgtMid.get(candidateId), {
            status: 'AMBIGUOUS',
            confidence: 'NONE',
            reason: row.conflicts?.[0] ?? 'ambiguous candidate',
            auditRowId: row.diffId,
            auditSource: 'objectDiff',
          });
      }
    }
  }

  // Non-selected candidates (rejected/rival pairs stay visible on demand).
  for (const row of compareAudit?.matchCandidates?.rows ?? []) {
    if (row.selected) continue;
    push(CONNECTOR_TYPES.CANDIDATE_CONNECTOR, row.sourceObjectId, row.targetObjectId,
      srcMid.get(row.sourceObjectId), tgtMid.get(row.targetObjectId), {
        status: 'CANDIDATE',
        confidence: row.score,
        reason: `${row.origin} score ${row.score}`,
        auditRowId: `${row.sourceObjectId}~${row.targetObjectId}`,
        auditSource: 'matchCandidates',
      });
  }

  // Transfer connectors: one per source→target pair with aggregate approval.
  // The full per-property row list rides on the connector so overlays (arrow
  // edit popup, delta labels) never re-derive it from the plan themselves.
  const transferPairs = new Map();
  for (const row of transferPlan?.rows ?? []) {
    const key = `${row.sourceObjectId}|${row.targetObjectId}`;
    if (!transferPairs.has(key)) transferPairs.set(key, { row, approvals: [], properties: [], rows: [] });
    const pair = transferPairs.get(key);
    pair.approvals.push(row.approval);
    pair.properties.push(row.property);
    pair.rows.push({
      rowId: row.rowId, property: row.property, kind: row.kind,
      oldValue: row.oldValue, newValue: row.newValue,
      approval: row.approval, blockedReason: row.blockedReason ?? null,
    });
  }
  for (const [key, { row, approvals, properties, rows }] of transferPairs.entries()) {
    const status = approvals.includes(APPROVAL_STATUS.APPROVED) ? 'TRANSFER_READY'
      : approvals.every((a) => a === APPROVAL_STATUS.BLOCKED) ? 'TRANSFER_BLOCKED' : 'TRANSFER_PENDING';
    push(CONNECTOR_TYPES.TRANSFER_CONNECTOR, row.sourceObjectId, row.targetObjectId,
      srcMid.get(row.sourceObjectId), tgtMid.get(row.targetObjectId), {
        status,
        confidence: row.confidence,
        score: Number.isFinite(row.score) ? row.score : null,
        pairKey: key,
        properties: rows,
        reason: `${properties.length} transferable propert${properties.length === 1 ? 'y' : 'ies'}: ${properties.slice(0, 4).join(', ')}${properties.length > 4 ? '…' : ''}`,
        auditRowId: row.rowId,
        auditSource: 'transferPlan',
      });
  }

  for (const pair of compareAudit?.registration?.anchorPairs ?? []) {
    push(CONNECTOR_TYPES.REGISTRATION_ANCHOR_CONNECTOR, null, null,
      srcNodes.get(pair.sourceNode), tgtNodes.get(pair.targetNode), {
        status: 'REGISTRATION',
        confidence: pair.residualMm,
        reason: `anchor ${pair.sourceNode}↔${pair.targetNode} residual ${pair.residualMm} mm`,
        auditRowId: `${pair.sourceNode}->${pair.targetNode}`,
        auditSource: 'registration',
        sourceNode: pair.sourceNode,
        targetNode: pair.targetNode,
      });
  }

  return { contract: CONTRACT_VERSIONS.ConnectorModel, connectors };
}

/** Which viewer connector-modes each type participates in. */
const VISIBLE_MODES = Object.freeze({
  [CONNECTOR_TYPES.BASIS_CONNECTOR]: ['selection', 'matches', 'basis'],
  [CONNECTOR_TYPES.MATCH_CONNECTOR]: ['selection', 'matches'],
  [CONNECTOR_TYPES.CANDIDATE_CONNECTOR]: ['selection', 'candidates'],
  [CONNECTOR_TYPES.CONFLICT_CONNECTOR]: ['selection', 'conflicts'],
  [CONNECTOR_TYPES.TRANSFER_CONNECTOR]: ['selection', 'transfer'],
  [CONNECTOR_TYPES.REGISTRATION_ANCHOR_CONNECTOR]: ['registration'],
});

/**
 * ConnectorModel.v1 validator — every connector must resolve its audit link.
 */
export function validateConnectorModel(model, { compareAudit, transferPlan = null } = {}) {
  const errors = [];
  if (model?.contract !== CONTRACT_VERSIONS.ConnectorModel) errors.push(`contract must be ${CONTRACT_VERSIONS.ConnectorModel}`);
  const diffIds = new Set((compareAudit?.objectDiff?.rows ?? []).map((r) => r.diffId));
  const candidateIds = new Set((compareAudit?.matchCandidates?.rows ?? []).map((r) => `${r.sourceObjectId}~${r.targetObjectId}`));
  const transferIds = new Set((transferPlan?.rows ?? []).map((r) => r.rowId));
  const anchorIds = new Set((compareAudit?.registration?.anchorPairs ?? []).map((p) => `${p.sourceNode}->${p.targetNode}`));
  const seen = new Set();
  for (const c of model?.connectors ?? []) {
    if (!c.connectorId || seen.has(c.connectorId)) errors.push(`bad/duplicate connectorId ${c.connectorId}`);
    seen.add(c.connectorId);
    if (!Object.values(CONNECTOR_TYPES).includes(c.type)) errors.push(`${c.connectorId}: unknown type ${c.type}`);
    if (![c.from, c.to].every((p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite))) errors.push(`${c.connectorId}: bad endpoints`);
    if (!Array.isArray(c.visibleModes) || !c.visibleModes.length) errors.push(`${c.connectorId}: missing visibleModes`);
    if (!c.reason) errors.push(`${c.connectorId}: missing reason`);
    const pool = c.auditSource === 'objectDiff' ? diffIds
      : c.auditSource === 'matchCandidates' ? candidateIds
        : c.auditSource === 'transferPlan' ? transferIds
          : c.auditSource === 'registration' ? anchorIds : null;
    if (!pool) errors.push(`${c.connectorId}: unknown auditSource ${c.auditSource}`);
    else if (!pool.has(c.auditRowId)) errors.push(`${c.connectorId}: orphan auditRowId ${c.auditRowId} in ${c.auditSource}`);
  }
  return errors;
}
