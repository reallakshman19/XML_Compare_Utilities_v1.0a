/**
 * transfer-overlay-models.js — pure view-models for the visual transfer
 * workflow (score bands, arrow pairs, delta labels, global property override).
 * No DOM, no three.js: everything here is headless-testable. Mutating helpers
 * operate on the live TransferPlan (single source of truth) and keep its
 * summary fresh via refreshTransferSummary.
 */

import { APPROVAL_STATUS } from '../contracts/contracts.js';
import { refreshTransferSummary, GLOBAL_OVERRIDE_REASON } from '../compare/transfer-planner.js';

/** Score → band name. >90 high, 70–90 mid, <70 low; null when not numeric. */
export function scoreBand(score) {
  if (!Number.isFinite(score)) return null;
  if (score > 90) return 'high';
  if (score >= 70) return 'mid';
  return 'low';
}

export const SCORE_BAND_COLORS = Object.freeze({
  basis: 0xf59e0b, // gold — identity/manual anchors
  high: 0x22c55e,  // green  >90
  mid: 0xf97316,   // orange 70–90
  low: 0xef4444,   // red    <70
});

/** Score → color int. Basis wins; null when score is not numeric. */
export function scoreBandColor(score, { basis = false } = {}) {
  if (basis) return SCORE_BAND_COLORS.basis;
  const band = scoreBand(score);
  return band ? SCORE_BAND_COLORS[band] : null;
}

const pairKeyOf = (row) => `${row.sourceObjectId}|${row.targetObjectId}`;

/** Delta-only label for one plan row: "Rating=150", packets as "+PACKET:X". */
export function deltaLabel(row) {
  if (!row) return '';
  if (row.kind === 'packet') return `+${row.property}`;
  return `${row.property}=${row.newValue}`;
}

/**
 * Group plan rows into source→target pairs for arrows/labels.
 * deltaLabels contains APPROVED rows only (the graphical preview shows what
 * will actually transfer).
 */
export function transferPairsModel(plan) {
  const pairs = new Map();
  for (const row of plan?.rows ?? []) {
    const key = pairKeyOf(row);
    if (!pairs.has(key)) {
      pairs.set(key, {
        pairKey: key,
        sourceObjectId: row.sourceObjectId,
        targetObjectId: row.targetObjectId,
        score: Number.isFinite(row.score) ? row.score : null,
        rows: [],
        approvedRows: [],
        deltaLabels: [],
      });
    }
    const pair = pairs.get(key);
    pair.rows.push(row);
    if (row.approval === APPROVAL_STATUS.APPROVED) {
      pair.approvedRows.push(row);
      pair.deltaLabels.push(deltaLabel(row));
    }
  }
  return [...pairs.values()];
}

/**
 * Every property/block across all transfers, with usage counts and whether it
 * is globally excluded — feeds the Global override checkbox list.
 */
export function globalPropertyModel(plan, excludeProperties = []) {
  const excluded = new Set(excludeProperties);
  const byProperty = new Map();
  for (const row of plan?.rows ?? []) {
    if (!byProperty.has(row.property)) {
      byProperty.set(row.property, { property: row.property, kind: row.kind, rowCount: 0, pairKeys: new Set() });
    }
    const entry = byProperty.get(row.property);
    entry.rowCount += 1;
    entry.pairKeys.add(pairKeyOf(row));
  }
  return [...byProperty.values()]
    .map((entry) => ({
      property: entry.property,
      kind: entry.kind,
      rowCount: entry.rowCount,
      pairCount: entry.pairKeys.size,
      excluded: excluded.has(entry.property),
    }))
    .sort((a, b) => a.property.localeCompare(b.property));
}

/** Drop one property from one transfer pair (arrow popup "X"). */
export function dropPairProperty(plan, { sourceObjectId, targetObjectId, property }) {
  let touched = 0;
  for (const row of plan?.rows ?? []) {
    if (row.sourceObjectId !== sourceObjectId || row.targetObjectId !== targetObjectId) continue;
    if (row.property !== property) continue;
    if (row.approval === APPROVAL_STATUS.BLOCKED) continue;
    if (row.approval !== APPROVAL_STATUS.REJECTED) {
      row.approval = APPROVAL_STATUS.REJECTED;
      touched += 1;
    }
  }
  if (touched) refreshTransferSummary(plan);
  return touched;
}

/**
 * Drop (or restore) one property across ALL transfers ("X(~)" / Global
 * override). Persists in transferConfig.excludeProperties so rebuilt plans
 * respect it; live rows toggle BLOCKED ↔ PENDING. Restoring never resurrects
 * rows that were individually REJECTED, and never unblocks rows blocked for a
 * different reason.
 */
export function dropPropertyGlobally(plan, transferConfig, property, excluded) {
  const current = new Set(transferConfig.excludeProperties ?? []);
  if (excluded) current.add(property); else current.delete(property);
  transferConfig.excludeProperties = [...current];

  let touched = 0;
  for (const row of plan?.rows ?? []) {
    if (row.property !== property) continue;
    if (excluded) {
      if (row.approval === APPROVAL_STATUS.BLOCKED) continue;
      if (row.approval === APPROVAL_STATUS.REJECTED) continue; // already dropped harder
      row.approval = APPROVAL_STATUS.BLOCKED;
      row.blockedReason = GLOBAL_OVERRIDE_REASON;
      touched += 1;
    } else if (row.approval === APPROVAL_STATUS.BLOCKED && row.blockedReason === GLOBAL_OVERRIDE_REASON) {
      row.approval = APPROVAL_STATUS.PENDING;
      row.blockedReason = null;
      touched += 1;
    }
  }
  if (plan && touched) refreshTransferSummary(plan);
  return touched;
}
