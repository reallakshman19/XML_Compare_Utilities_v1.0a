/** Pure RC-004 reservation, visibility and resolved-review projections. */
import { deepFreeze } from './revision-contract-utils.js';
import { activeTargetReservations, assertValidDecisionLedger, decisionItemIndex, targetDifferenceIndex } from './revision-decision-contracts.js';
import { decisionLedgerMatchesAudit } from './revision-decision-ledger.js';

export function createDecisionFilters() {
  return deepFreeze({ decisionStates: ['UNDECIDED', 'ACCEPTED_CANDIDATE', 'CONFIRMED_NO_MATCH', 'DEFERRED', 'REVOKED'], unresolvedOnly: false });
}
export function resolvedRevisionReview(audit, ledger) {
  assertValidDecisionLedger(ledger, audit); const decisions = decisionItemIndex(ledger); const reservations = activeTargetReservations(ledger);
  const targetRows = targetDifferenceIndex(audit); const consumed = new Map(); const rows = [];
  for (const item of ledger.decisions) if (item.decisionState === 'ACCEPTED_CANDIDATE') consumed.set(item.acceptedTargetDifferenceId, item.differenceId);
  for (const row of audit.differenceRows) {
    const item = decisions.get(row.differenceId); const consumedBy = consumed.get(row.differenceId) ?? null;
    if (item) rows.push(deepFreeze({
      differenceId: row.differenceId, originalDifferenceCategory: row.differenceCategory, originalMatchCertainty: row.matchCertainty,
      decisionState: item.decisionState, effectiveDifferenceCategory: item.decisionState === 'CONFIRMED_NO_MATCH' ? 'REMOVED' : item.decisionState === 'ACCEPTED_CANDIDATE' ? 'MANUAL_CORRESPONDENCE' : row.differenceCategory,
      acceptedTargetRecordId: item.acceptedTargetRecordId, acceptedTargetDifferenceId: item.acceptedTargetDifferenceId,
      remainingNeedsDecision: ['UNDECIDED', 'DEFERRED', 'REVOKED'].includes(item.decisionState), consumedByDifferenceId: null,
    }));
    else rows.push(deepFreeze({
      differenceId: row.differenceId, originalDifferenceCategory: row.differenceCategory, originalMatchCertainty: row.matchCertainty,
      decisionState: consumedBy ? 'CONSUMED_BY_ACCEPTED_CANDIDATE' : 'NOT_APPLICABLE',
      effectiveDifferenceCategory: consumedBy ? 'MANUALLY_MATCHED_TARGET' : row.differenceCategory,
      acceptedTargetRecordId: null, acceptedTargetDifferenceId: null, remainingNeedsDecision: false, consumedByDifferenceId: consumedBy,
    }));
  }
  const summary = deepFreeze({
    resolvedCandidateCount: ledger.summary.acceptedCandidate, confirmedNoMatchCount: ledger.summary.confirmedNoMatch,
    deferredCount: ledger.summary.deferred, undecidedCount: ledger.summary.undecided, revokedCount: ledger.summary.revoked,
    remainingNeedsDecision: ledger.summary.remainingNeedsDecision, activeTargetReservations: reservations.size,
  });
  if (consumed.size !== ledger.summary.acceptedCandidate || targetRows.size < consumed.size) throw new Error('Resolved target consumption does not reconcile with the decision ledger.');
  return deepFreeze({ schema: 'ResolvedRevisionReview.v1', projectionId: `resolved-review:${audit.auditId}:${ledger.revision}`, auditId: audit.auditId, ledgerId: ledger.ledgerId, rows: Object.freeze(rows), summary });
}
function decisionEntry(entry, items, consumed) {
  const item = items.get(entry.row.differenceId) ?? null; const consumedBy = consumed.get(entry.row.differenceId) ?? null;
  return deepFreeze({ ...entry, decisionItem: item, derivedDecisionState: item?.decisionState ?? (consumedBy ? 'CONSUMED_BY_ACCEPTED_CANDIDATE' : 'NOT_APPLICABLE'), consumedByDifferenceId: consumedBy });
}
export function filterDecisionAwareProjection(base, audit, decision) {
  const ledger = decision?.ledger;
  if (!ledger || !decisionLedgerMatchesAudit(ledger, audit)) return { ...base, visible: [], visibleCount: 0, hiddenCount: base.all.length };
  const items = decisionItemIndex(ledger); const consumed = new Map();
  for (const item of ledger.decisions) if (item.decisionState === 'ACCEPTED_CANDIDATE') consumed.set(item.acceptedTargetDifferenceId, item.differenceId);
  const all = Object.freeze(base.all.map((entry) => decisionEntry(entry, items, consumed)));
  const baseVisibleIds = new Set(base.visible.map((entry) => entry.row.differenceId)); const states = new Set(decision.filters.decisionStates);
  const visible = Object.freeze(all.filter((entry) => {
    if (!baseVisibleIds.has(entry.row.differenceId)) return false;
    if (decision.filters.unresolvedOnly) return Boolean(entry.decisionItem && ['UNDECIDED', 'DEFERRED', 'REVOKED'].includes(entry.decisionItem.decisionState));
    return !entry.decisionItem || states.has(entry.decisionItem.decisionState);
  }));
  return deepFreeze({ all, visible, visibleCount: visible.length, hiddenCount: all.length - visible.length });
}
export function candidatePreview(audit, ledger, differenceId, candidateIndex) {
  if (!decisionLedgerMatchesAudit(ledger, audit)) return null;
  const item = decisionItemIndex(ledger).get(differenceId); if (!item) return null;
  const row = audit.differenceRows.find((entry) => entry.differenceId === differenceId);
  const evidence = audit.candidateEvidence.find((entry) => entry.candidateEvidenceId === row?.candidateEvidenceId);
  if (!evidence?.rankedEvidence.length) return deepFreeze({ differenceId, candidateIndex: -1, candidate: null, targetDifferenceId: null });
  const index = Math.max(0, Math.min(Number(candidateIndex) || 0, evidence.rankedEvidence.length - 1)); const candidate = evidence.rankedEvidence[index];
  const target = targetDifferenceIndex(audit).get(candidate.targetRecordId);
  return deepFreeze({ differenceId, candidateIndex: index, candidate, targetDifferenceId: target?.differenceId ?? null, candidateCount: evidence.rankedEvidence.length });
}
export function stepCandidatePreview(audit, ledger, preview, direction) {
  const current = candidatePreview(audit, ledger, preview?.differenceId, preview?.candidateIndex ?? 0); if (!current?.candidate) return current;
  const next = direction === 'previous' ? current.candidateIndex - 1 : current.candidateIndex + 1;
  return candidatePreview(audit, ledger, current.differenceId, Math.max(0, Math.min(next, current.candidateCount - 1)));
}
