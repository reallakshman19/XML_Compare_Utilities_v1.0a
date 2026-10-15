/** AmbiguityDecisionLedger.v1 creation, immutable transitions and lifecycle. */
import { deepFreeze } from './revision-contract-utils.js';
import { sha256Text } from './revision-hash.js';
import {
  activeTargetReservations, assertValidDecisionLedger, candidateEvidenceIndex, DECISION_EVENT_SCHEMA,
  DECISION_ITEM_SCHEMA, DECISION_LEDGER_SCHEMA, DECISION_RATIONALE_MAX_LENGTH, decisionSummary,
  EMPTY_RATIONALE_HASH, selectedPairFingerprint, SELECTED_PAIR_EVIDENCE_SCHEMA, targetDifferenceIndex,
} from './revision-decision-contracts.js';

function requireAudit(audit) {
  if (audit?.schema !== 'RevisionCompareAudit.v1' || audit?.validation?.status !== 'READY') throw new TypeError('A valid RevisionCompareAudit.v1 is required to create decision evidence.');
}
function ledgerIdentity(audit) {
  return { ledgerId: `ambiguity-ledger:${audit.auditId}:v1`, auditId: audit.auditId, basisId: audit.basisId, revADocumentId: audit.revADocumentId, revBDocumentId: audit.revBDocumentId };
}
function itemFor(row, createdAt) {
  return deepFreeze({
    schema: DECISION_ITEM_SCHEMA, differenceId: row.differenceId, sourceRecordId: row.sourceRecordId,
    candidateEvidenceId: row.candidateEvidenceId, decisionState: 'UNDECIDED', acceptedTargetRecordId: null,
    acceptedTargetDifferenceId: null, rationale: '', rationaleHash: EMPTY_RATIONALE_HASH, activeEventId: null,
    selectedPairEvidenceId: null, updatedAt: createdAt, eventIds: Object.freeze([]),
  });
}
export function createDecisionLedger(audit, createdAt) {
  requireAudit(audit);
  const decisions = Object.freeze(audit.differenceRows.filter((row) => row.matchCertainty === 'AMBIGUOUS')
    .sort((a, b) => a.differenceId.localeCompare(b.differenceId)).map((row) => itemFor(row, createdAt)));
  const ledger = deepFreeze({
    schema: DECISION_LEDGER_SCHEMA, ...ledgerIdentity(audit), status: 'CURRENT', revision: 0,
    createdAt, updatedAt: createdAt, decisions, events: Object.freeze([]), selectedPairEvidence: Object.freeze([]),
    summary: decisionSummary(decisions), validation: deepFreeze({ status: 'READY', errors: Object.freeze([]) }),
  });
  assertValidDecisionLedger(ledger, audit, { requireCurrent: true }); return ledger;
}
function requireEditable(ledger) { if (ledger?.status !== 'CURRENT') throw new Error('The decision ledger is stale and read-only.'); }
function findItem(ledger, differenceId) {
  const item = ledger.decisions.find((entry) => entry.differenceId === differenceId);
  if (!item) throw new RangeError(`Unknown ambiguity difference ID ${differenceId}.`); return item;
}
function requireRationale(value) {
  const rationale = String(value ?? '');
  if (!rationale.trim()) throw new RangeError('An engineering rationale is required.');
  if (rationale.length > DECISION_RATIONALE_MAX_LENGTH) throw new RangeError(`Decision rationale is limited to ${DECISION_RATIONALE_MAX_LENGTH} characters.`);
  return rationale;
}
function auditPair(audit, item, targetRecordId) {
  const evidence = candidateEvidenceIndex(audit).get(item.candidateEvidenceId);
  if (!evidence?.candidateRecordIds.includes(targetRecordId)) throw new RangeError('The selected target is not a persisted candidate for this ambiguous source.');
  const ranked = evidence.rankedEvidence.find((entry) => entry.targetRecordId === targetRecordId);
  const targetRow = targetDifferenceIndex(audit).get(targetRecordId);
  if (!ranked || !targetRow) throw new RangeError('The selected target lacks an exact unmatched-target audit reference.');
  return { evidence, ranked, targetRow };
}
function pairEvidenceValue(ledger, item, targetRecordId, pair) {
  const rank = pair.evidence.rankedEvidence.indexOf(pair.ranked) + 1;
  const core = {
    differenceId: item.differenceId, sourceRecordId: item.sourceRecordId, targetRecordId,
    targetDifferenceId: pair.targetRow.differenceId, candidateEvidenceId: item.candidateEvidenceId,
    rank, score: pair.ranked.score, reasons: pair.ranked.reasons, geometryDistance: pair.ranked.geometryDistance,
    thresholds: pair.evidence.thresholds, candidateLimit: pair.evidence.candidateLimit,
    decisionBasis: pair.evidence.scoreGapOrDecisionBasis,
  };
  return deepFreeze({
    schema: SELECTED_PAIR_EVIDENCE_SCHEMA,
    selectedPairEvidenceId: `selected-pair:${ledger.ledgerId}:${item.sourceRecordId}:${targetRecordId}`,
    ...core, evidenceHash: selectedPairFingerprint(core),
  });
}
function ensureReservationAvailable(ledger, item, targetRecordId) {
  const owner = activeTargetReservations(ledger).get(targetRecordId);
  if (owner && owner !== item.differenceId) throw new Error(`Target ${targetRecordId} is reserved by ${owner}.`);
}
function eventFor(ledger, item, input) {
  const sequence = ledger.events.length + 1;
  return deepFreeze({
    schema: DECISION_EVENT_SCHEMA, eventId: `${ledger.ledgerId}:event:${sequence}`, sequence,
    differenceId: item.differenceId, action: input.action, previousDecisionState: item.decisionState,
    nextDecisionState: input.nextState, previousTargetRecordId: item.acceptedTargetRecordId,
    nextTargetRecordId: input.targetRecordId, rationale: input.rationale, rationaleHash: input.rationaleHash, occurredAt: input.occurredAt,
    supersedesEventId: item.activeEventId, selectedPairEvidenceId: input.selectedPairEvidenceId,
  });
}
function replaceItem(items, nextItem) { return Object.freeze(items.map((item) => item.differenceId === nextItem.differenceId ? nextItem : item)); }
function appendPairEvidence(values, pair) {
  if (!pair || values.some((item) => item.selectedPairEvidenceId === pair.selectedPairEvidenceId)) return values;
  return Object.freeze([...values, pair].sort((a, b) => a.selectedPairEvidenceId.localeCompare(b.selectedPairEvidenceId)));
}
function commitTransition(ledger, audit, item, event, pair, occurredAt) {
  const decisions = replaceItem(ledger.decisions, item); const events = Object.freeze([...ledger.events, event]);
  const next = deepFreeze({
    ...ledger, revision: events.length, updatedAt: occurredAt, decisions, events,
    selectedPairEvidence: appendPairEvidence(ledger.selectedPairEvidence, pair), summary: decisionSummary(decisions),
    validation: deepFreeze({ status: 'READY', errors: Object.freeze([]) }),
  });
  assertValidDecisionLedger(next, audit, { requireCurrent: true }); return next;
}
function nextTargetEvidence(ledger, audit, item, targetRecordId) {
  if (!targetRecordId) return { targetDifferenceId: null, pair: null };
  ensureReservationAvailable(ledger, item, targetRecordId); const pair = auditPair(audit, item, targetRecordId);
  const selected = pairEvidenceValue(ledger, item, targetRecordId, pair);
  return { targetDifferenceId: pair.targetRow.differenceId, pair: selected };
}
async function transition(ledger, audit, differenceId, input, occurredAt, cryptoRef) {
  requireEditable(ledger); assertValidDecisionLedger(ledger, audit, { requireCurrent: true });
  const item = findItem(ledger, differenceId); const rationale = requireRationale(input.rationale);
  if (input.action === 'REVOKE_DECISION' && item.decisionState === 'UNDECIDED') throw new Error('An undecided item has no active decision to revoke.');
  if (input.action === 'REVOKE_DECISION' && item.decisionState === 'REVOKED') return item.rationale === rationale ? ledger : Promise.reject(new Error('The decision is already revoked.'));
  const target = nextTargetEvidence(ledger, audit, item, input.targetRecordId ?? null);
  if (item.decisionState === input.nextState && item.acceptedTargetRecordId === (input.targetRecordId ?? null) && item.rationale === rationale) return ledger;
  const rationaleHash = await sha256Text(rationale, cryptoRef);
  const event = eventFor(ledger, item, { ...input, rationale, targetRecordId: input.targetRecordId ?? null, rationaleHash, occurredAt, selectedPairEvidenceId: target.pair?.selectedPairEvidenceId ?? null });
  const nextItem = deepFreeze({
    ...item, decisionState: input.nextState, acceptedTargetRecordId: input.targetRecordId ?? null,
    acceptedTargetDifferenceId: target.targetDifferenceId, rationale, rationaleHash, activeEventId: event.eventId,
    selectedPairEvidenceId: target.pair?.selectedPairEvidenceId ?? null, updatedAt: occurredAt,
    eventIds: Object.freeze([...item.eventIds, event.eventId]),
  });
  return commitTransition(ledger, audit, nextItem, event, target.pair, occurredAt);
}
export function acceptDecisionCandidate(ledger, audit, differenceId, targetRecordId, rationale, occurredAt, cryptoRef) {
  return transition(ledger, audit, differenceId, { action: 'ACCEPT_CANDIDATE', nextState: 'ACCEPTED_CANDIDATE', targetRecordId, rationale }, occurredAt, cryptoRef);
}
export function confirmDecisionNoMatch(ledger, audit, differenceId, rationale, occurredAt, cryptoRef) {
  return transition(ledger, audit, differenceId, { action: 'CONFIRM_NO_MATCH', nextState: 'CONFIRMED_NO_MATCH', targetRecordId: null, rationale }, occurredAt, cryptoRef);
}
export function deferDecision(ledger, audit, differenceId, rationale, occurredAt, cryptoRef) {
  return transition(ledger, audit, differenceId, { action: 'DEFER_DECISION', nextState: 'DEFERRED', targetRecordId: null, rationale }, occurredAt, cryptoRef);
}
export function revokeDecision(ledger, audit, differenceId, rationale, occurredAt, cryptoRef) {
  return transition(ledger, audit, differenceId, { action: 'REVOKE_DECISION', nextState: 'REVOKED', targetRecordId: null, rationale }, occurredAt, cryptoRef);
}
export function markDecisionLedgerStale(ledger, updatedAt) { return !ledger || ledger.status === 'STALE' ? ledger : deepFreeze({ ...ledger, status: 'STALE', updatedAt }); }
export function decisionLedgerMatchesAudit(ledger, audit) {
  return Boolean(ledger && audit && ledger.auditId === audit.auditId && ledger.basisId === audit.basisId && ledger.revADocumentId === audit.revADocumentId && ledger.revBDocumentId === audit.revBDocumentId);
}
export function reattachDecisionLedger(ledger, audit, updatedAt) {
  if (!decisionLedgerMatchesAudit(ledger, audit)) throw new Error('The stale decision ledger does not match the exact audit.');
  const next = deepFreeze({ ...ledger, status: 'CURRENT', updatedAt }); assertValidDecisionLedger(next, audit, { requireCurrent: true }); return next;
}
export const _test = Object.freeze({ auditPair, eventFor, ledgerIdentity, pairEvidenceValue });
