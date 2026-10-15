/** Immutable RC-004 decision contracts and exact ledger validation. */
import { assertJsonSafe, deepFreeze } from './revision-contract-utils.js';

export const DECISION_LEDGER_SCHEMA = 'AmbiguityDecisionLedger.v1';
export const DECISION_ITEM_SCHEMA = 'AmbiguityDecisionItem.v1';
export const DECISION_EVENT_SCHEMA = 'AmbiguityDecisionEvent.v1';
export const SELECTED_PAIR_EVIDENCE_SCHEMA = 'SelectedPairEvidence.v1';
export const DECISION_RATIONALE_MAX_LENGTH = 750;
export const EMPTY_RATIONALE_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
export const DECISION_STATES = Object.freeze(['UNDECIDED', 'ACCEPTED_CANDIDATE', 'CONFIRMED_NO_MATCH', 'DEFERRED', 'REVOKED']);
export const DECISION_ACTIONS = Object.freeze(['ACCEPT_CANDIDATE', 'CONFIRM_NO_MATCH', 'DEFER_DECISION', 'REVOKE_DECISION', 'IMPORT_LEDGER']);
export const DECISION_LEDGER_STATUSES = Object.freeze(['CURRENT', 'STALE']);

function extraKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.keys(value).filter((key) => !allowed.includes(key)).map((key) => `${label} contains unsupported field ${key}.`);
}
function validTimestamp(value) { return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value)); }
function validHash(value) { return /^[a-f0-9]{64}$/.test(value ?? ''); }
export function selectedPairFingerprint(value) {
  const text = JSON.stringify(value); let output = '';
  for (let seed = 0; seed < 8; seed += 1) { let hash = 2166136261 ^ seed; for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); } output += (hash >>> 0).toString(16).padStart(8, '0'); }
  return output;
}
function duplicateValues(values) { const seen = new Set(); return values.filter((value) => seen.has(value) || !seen.add(value)); }
function ambiguousRows(audit) { return (audit?.differenceRows ?? []).filter((row) => row.matchCertainty === 'AMBIGUOUS').sort((a, b) => a.differenceId.localeCompare(b.differenceId)); }
export function decisionItemIndex(ledger) { return new Map((ledger?.decisions ?? []).map((item) => [item.differenceId, item])); }
export function decisionEventIndex(ledger) { return new Map((ledger?.events ?? []).map((event) => [event.eventId, event])); }
export function selectedPairEvidenceIndex(ledger) { return new Map((ledger?.selectedPairEvidence ?? []).map((item) => [item.selectedPairEvidenceId, item])); }
export function targetDifferenceIndex(audit) {
  return new Map((audit?.differenceRows ?? []).filter((row) => row.sourceRecordId === null && row.targetRecordId && row.differenceCategory === 'ADDED')
    .map((row) => [row.targetRecordId, row]));
}
export function candidateEvidenceIndex(audit) { return new Map((audit?.candidateEvidence ?? []).map((item) => [item.candidateEvidenceId, item])); }
export function activeTargetReservations(ledger) {
  const reservations = new Map();
  for (const item of ledger?.decisions ?? []) if (item.decisionState === 'ACCEPTED_CANDIDATE') reservations.set(item.acceptedTargetRecordId, item.differenceId);
  return reservations;
}
export function decisionSummary(items) {
  const counts = { UNDECIDED: 0, ACCEPTED_CANDIDATE: 0, CONFIRMED_NO_MATCH: 0, DEFERRED: 0, REVOKED: 0 };
  for (const item of items ?? []) if (Object.hasOwn(counts, item.decisionState)) counts[item.decisionState] += 1;
  return deepFreeze({
    ambiguityTotal: (items ?? []).length, undecided: counts.UNDECIDED, acceptedCandidate: counts.ACCEPTED_CANDIDATE,
    confirmedNoMatch: counts.CONFIRMED_NO_MATCH, deferred: counts.DEFERRED, revoked: counts.REVOKED,
    remainingNeedsDecision: counts.UNDECIDED + counts.DEFERRED + counts.REVOKED,
    activeTargetReservations: counts.ACCEPTED_CANDIDATE,
  });
}
function identityErrors(ledger, audit) {
  const errors = [];
  if (audit?.schema !== 'RevisionCompareAudit.v1' || audit?.validation?.status !== 'READY') errors.push('A valid RevisionCompareAudit.v1 is required.');
  if (ledger?.auditId !== audit?.auditId) errors.push('auditId does not match the current audit.');
  if (ledger?.basisId !== audit?.basisId) errors.push('basisId does not match the current audit.');
  if (ledger?.revADocumentId !== audit?.revADocumentId) errors.push('Rev A document ID does not match the current audit.');
  if (ledger?.revBDocumentId !== audit?.revBDocumentId) errors.push('Rev B document ID does not match the current audit.');
  if (ledger?.ledgerId !== `ambiguity-ledger:${audit?.auditId}:v1`) errors.push('ledgerId is not deterministic for the audit.');
  return errors;
}
function expectedItem(row, evidence) { return { sourceRecordId: row.sourceRecordId, candidateEvidenceId: evidence?.candidateEvidenceId }; }
function itemErrors(items, audit) {
  const errors = []; const rows = ambiguousRows(audit); const rowById = new Map(rows.map((row) => [row.differenceId, row]));
  const evidenceById = candidateEvidenceIndex(audit); const targetById = targetDifferenceIndex(audit); const ids = items.map((item) => item?.differenceId); const itemIds = new Set(ids);
  if (duplicateValues(ids).length) errors.push('Decision items contain duplicate difference IDs.');
  if (ids.join('|') !== [...ids].sort().join('|')) errors.push('Decision items must be ordered by differenceId.');
  for (const row of rows) if (!itemIds.has(row.differenceId)) errors.push(`Missing ambiguity item ${row.differenceId}.`);
  for (const item of items) {
    const row = rowById.get(item?.differenceId); if (!row) { errors.push(`Unknown ambiguity item ${item?.differenceId}.`); continue; }
    const evidence = evidenceById.get(row.candidateEvidenceId); const expected = expectedItem(row, evidence);
    errors.push(...extraKeys(item, ['schema', 'differenceId', 'sourceRecordId', 'candidateEvidenceId', 'decisionState', 'acceptedTargetRecordId', 'acceptedTargetDifferenceId', 'rationale', 'rationaleHash', 'activeEventId', 'selectedPairEvidenceId', 'updatedAt', 'eventIds'], item.differenceId));
    if (item.schema !== DECISION_ITEM_SCHEMA) errors.push(`${item.differenceId} has an invalid schema.`);
    if (item.sourceRecordId !== expected.sourceRecordId || item.candidateEvidenceId !== expected.candidateEvidenceId) errors.push(`${item.differenceId} identity evidence does not match the audit.`);
    if (!DECISION_STATES.includes(item.decisionState)) errors.push(`${item.differenceId} has an invalid decision state.`);
    if (typeof item.rationale !== 'string' || item.rationale.length > DECISION_RATIONALE_MAX_LENGTH) errors.push(`${item.differenceId} has an invalid rationale.`);
    if (!validHash(item.rationaleHash) || !validTimestamp(item.updatedAt)) errors.push(`${item.differenceId} has invalid rationale or timestamp evidence.`);
    if (!Array.isArray(item.eventIds) || duplicateValues(item.eventIds).length) errors.push(`${item.differenceId} has invalid event references.`);
    const accepted = item.decisionState === 'ACCEPTED_CANDIDATE';
    if (accepted) {
      if (!evidence?.candidateRecordIds.includes(item.acceptedTargetRecordId)) errors.push(`${item.differenceId} accepts a target outside persisted candidate evidence.`);
      const target = targetById.get(item.acceptedTargetRecordId);
      if (!target || target.differenceId !== item.acceptedTargetDifferenceId) errors.push(`${item.differenceId} accepted target lacks an exact audit reference.`);
      if (!item.selectedPairEvidenceId) errors.push(`${item.differenceId} lacks selected-pair evidence.`);
    } else if (item.acceptedTargetRecordId !== null || item.acceptedTargetDifferenceId !== null || item.selectedPairEvidenceId !== null) {
      errors.push(`${item.differenceId} claims target evidence outside ACCEPTED_CANDIDATE.`);
    }
    if (item.decisionState === 'UNDECIDED' && (item.rationale || item.rationaleHash !== EMPTY_RATIONALE_HASH || item.activeEventId !== null)) errors.push(`${item.differenceId} has non-initial undecided evidence.`);
    if (item.decisionState !== 'UNDECIDED' && (!item.rationale.trim() || item.activeEventId === null)) errors.push(`${item.differenceId} requires rationale and an active event.`);
  }
  const reservations = items.filter((item) => item.decisionState === 'ACCEPTED_CANDIDATE').map((item) => item.acceptedTargetRecordId);
  if (duplicateValues(reservations).length) errors.push('Duplicate active target reservation.');
  return errors;
}
function eventShapeErrors(event, sequence, ledgerId, itemIds, eventIds) {
  const errors = extraKeys(event, ['schema', 'eventId', 'sequence', 'differenceId', 'action', 'previousDecisionState', 'nextDecisionState', 'previousTargetRecordId', 'nextTargetRecordId', 'rationale', 'rationaleHash', 'occurredAt', 'supersedesEventId', 'selectedPairEvidenceId'], `Event ${sequence}`);
  if (event?.schema !== DECISION_EVENT_SCHEMA) errors.push(`Event ${sequence} has an invalid schema.`);
  if (event?.sequence !== sequence) errors.push(`Decision event sequence is broken at ${sequence}.`);
  if (event?.eventId !== `${ledgerId}:event:${sequence}`) errors.push(`Event ${sequence} has an invalid deterministic ID.`);
  if (eventIds.has(event?.eventId)) errors.push(`Duplicate decision event ID ${event?.eventId}.`); eventIds.add(event?.eventId);
  if (!itemIds.has(event?.differenceId)) errors.push(`Event ${sequence} refers to an unknown ambiguity item.`);
  if (!DECISION_ACTIONS.includes(event?.action)) errors.push(`Event ${sequence} has an invalid action.`);
  if (!DECISION_STATES.includes(event?.previousDecisionState) || !DECISION_STATES.includes(event?.nextDecisionState)) errors.push(`Event ${sequence} has invalid decision-state evidence.`);
  if (typeof event?.rationale !== 'string' || event.rationale.length > DECISION_RATIONALE_MAX_LENGTH || !validHash(event?.rationaleHash) || !validTimestamp(event?.occurredAt)) errors.push(`Event ${sequence} has invalid rationale or timestamp evidence.`);
  return errors;
}
function actionErrors(event, cursor) {
  const errors = []; const target = event.nextTargetRecordId;
  if (event.previousDecisionState !== cursor.state || event.previousTargetRecordId !== cursor.target) errors.push(`${event.eventId} breaks the decision evidence chain.`);
  if (event.action === 'ACCEPT_CANDIDATE' && (event.nextDecisionState !== 'ACCEPTED_CANDIDATE' || !target || !event.selectedPairEvidenceId)) errors.push(`${event.eventId} has invalid acceptance semantics.`);
  if (event.action === 'CONFIRM_NO_MATCH' && (event.nextDecisionState !== 'CONFIRMED_NO_MATCH' || target !== null || event.selectedPairEvidenceId !== null)) errors.push(`${event.eventId} has invalid no-match semantics.`);
  if (event.action === 'DEFER_DECISION' && (event.nextDecisionState !== 'DEFERRED' || target !== null || event.selectedPairEvidenceId !== null)) errors.push(`${event.eventId} has invalid defer semantics.`);
  if (event.action === 'REVOKE_DECISION' && (event.nextDecisionState !== 'REVOKED' || target !== null || event.selectedPairEvidenceId !== null || cursor.state === 'UNDECIDED' || event.supersedesEventId !== cursor.activeEventId)) errors.push(`${event.eventId} has invalid revoke supersession evidence.`);
  if (event.action !== 'REVOKE_DECISION' && event.action !== 'IMPORT_LEDGER' && event.supersedesEventId !== cursor.activeEventId) errors.push(`${event.eventId} has invalid supersession evidence.`);
  if (event.action === 'IMPORT_LEDGER' && (event.previousDecisionState !== event.nextDecisionState || event.previousTargetRecordId !== event.nextTargetRecordId || event.selectedPairEvidenceId !== cursor.selectedPairEvidenceId)) errors.push(`${event.eventId} alters decision evidence during import.`);
  if (event.action !== 'IMPORT_LEDGER' && event.rationaleHash === EMPTY_RATIONALE_HASH) errors.push(`${event.eventId} lacks required rationale evidence.`);
  if (event.action !== 'IMPORT_LEDGER' && event.nextDecisionState === cursor.state && target === cursor.target && event.rationaleHash === cursor.rationaleHash) errors.push(`${event.eventId} records an identical no-op decision.`);
  return errors;
}
function eventErrors(events, items, ledgerId) {
  const errors = []; const itemIds = new Set(items.map((item) => item.differenceId)); const eventIds = new Set();
  const cursors = new Map(items.map((item) => [item.differenceId, { state: 'UNDECIDED', target: null, rationale: '', rationaleHash: EMPTY_RATIONALE_HASH, activeEventId: null, selectedPairEvidenceId: null, eventIds: [] }]));
  events.forEach((event, index) => {
    errors.push(...eventShapeErrors(event, index + 1, ledgerId, itemIds, eventIds)); const cursor = cursors.get(event.differenceId); if (!cursor) return;
    errors.push(...actionErrors(event, cursor)); cursor.state = event.nextDecisionState; cursor.target = event.nextTargetRecordId;
    if (event.action !== 'IMPORT_LEDGER') { cursor.rationale = event.rationale; cursor.rationaleHash = event.rationaleHash; cursor.activeEventId = event.eventId; cursor.selectedPairEvidenceId = event.selectedPairEvidenceId; }
    cursor.eventIds.push(event.eventId);
  });
  for (const item of items) {
    const cursor = cursors.get(item.differenceId);
    if (cursor.state !== item.decisionState || cursor.target !== item.acceptedTargetRecordId || cursor.rationale !== item.rationale || cursor.rationaleHash !== item.rationaleHash || cursor.activeEventId !== item.activeEventId || cursor.selectedPairEvidenceId !== item.selectedPairEvidenceId) errors.push(`${item.differenceId} does not reconcile with its event history.`);
    if (cursor.eventIds.join('|') !== item.eventIds.join('|')) errors.push(`${item.differenceId} event references are not append-only and ordered.`);
  }
  return errors;
}
function pairEvidenceErrors(ledger, audit) {
  const errors = []; const evidenceById = candidateEvidenceIndex(audit); const targets = targetDifferenceIndex(audit); const decisions = decisionItemIndex(ledger); const ids = new Set(); const referenced = new Set();
  for (const item of ledger.decisions) if (item.selectedPairEvidenceId) referenced.add(item.selectedPairEvidenceId);
  for (const event of ledger.events) if (event.selectedPairEvidenceId) referenced.add(event.selectedPairEvidenceId);
  for (const pair of ledger.selectedPairEvidence) {
    errors.push(...extraKeys(pair, ['schema', 'selectedPairEvidenceId', 'differenceId', 'sourceRecordId', 'targetRecordId', 'targetDifferenceId', 'candidateEvidenceId', 'rank', 'score', 'reasons', 'geometryDistance', 'thresholds', 'candidateLimit', 'decisionBasis', 'evidenceHash'], pair?.selectedPairEvidenceId ?? 'Selected-pair evidence'));
    if (pair.schema !== SELECTED_PAIR_EVIDENCE_SCHEMA || ids.has(pair.selectedPairEvidenceId)) errors.push('Selected-pair evidence has an invalid schema or duplicate ID.'); ids.add(pair.selectedPairEvidenceId);
    const decision = decisions.get(pair.differenceId); const evidence = evidenceById.get(pair.candidateEvidenceId);
    const ranked = evidence?.rankedEvidence.find((entry) => entry.targetRecordId === pair.targetRecordId); const target = targets.get(pair.targetRecordId);
    if (!decision || decision.sourceRecordId !== pair.sourceRecordId || !ranked || target?.differenceId !== pair.targetDifferenceId) errors.push(`${pair.selectedPairEvidenceId} does not reconcile with persisted audit evidence.`);
    if (ranked && (pair.rank !== evidence.rankedEvidence.indexOf(ranked) + 1 || pair.score !== ranked.score || JSON.stringify(pair.reasons) !== JSON.stringify(ranked.reasons) || pair.geometryDistance !== ranked.geometryDistance)) errors.push(`${pair.selectedPairEvidenceId} alters persisted candidate evidence.`);
    const fingerprint = selectedPairFingerprint({ differenceId: pair.differenceId, sourceRecordId: pair.sourceRecordId, targetRecordId: pair.targetRecordId, targetDifferenceId: pair.targetDifferenceId, candidateEvidenceId: pair.candidateEvidenceId, rank: pair.rank, score: pair.score, reasons: pair.reasons, geometryDistance: pair.geometryDistance, thresholds: pair.thresholds, candidateLimit: pair.candidateLimit, decisionBasis: pair.decisionBasis });
    if (pair.evidenceHash !== fingerprint) errors.push(`${pair.selectedPairEvidenceId} has tampered selected-pair evidence.`);
  }
  for (const id of referenced) if (!ids.has(id)) errors.push(`Missing selected-pair evidence ${id}.`);
  for (const id of ids) if (!referenced.has(id)) errors.push(`Unreferenced selected-pair evidence ${id}.`);
  return errors;
}
export function validateDecisionLedger(ledger, audit, options = {}) {
  const errors = [];
  errors.push(...extraKeys(ledger, ['schema', 'ledgerId', 'auditId', 'basisId', 'revADocumentId', 'revBDocumentId', 'status', 'revision', 'createdAt', 'updatedAt', 'decisions', 'events', 'selectedPairEvidence', 'summary', 'validation'], 'Decision ledger'));
  errors.push(...identityErrors(ledger, audit));
  if (ledger?.schema !== DECISION_LEDGER_SCHEMA) errors.push(`schema must be ${DECISION_LEDGER_SCHEMA}.`);
  if (!DECISION_LEDGER_STATUSES.includes(ledger?.status)) errors.push('Decision ledger status is invalid.');
  if (options.requireCurrent && ledger?.status !== 'CURRENT') errors.push('A stale decision ledger cannot be imported as editable state.');
  if (!Number.isInteger(ledger?.revision) || ledger.revision < 0 || ledger.revision !== (ledger?.events?.length ?? -1)) errors.push('Decision ledger revision is invalid.');
  if (!validTimestamp(ledger?.createdAt) || !validTimestamp(ledger?.updatedAt)) errors.push('Decision ledger timestamps are invalid.');
  if (!Array.isArray(ledger?.decisions) || !Array.isArray(ledger?.events) || !Array.isArray(ledger?.selectedPairEvidence)) errors.push('Decision items, events and selected-pair evidence are required.');
  else { errors.push(...itemErrors(ledger.decisions, audit)); errors.push(...eventErrors(ledger.events, ledger.decisions, ledger.ledgerId)); errors.push(...pairEvidenceErrors(ledger, audit)); }
  errors.push(...extraKeys(ledger?.summary, ['ambiguityTotal', 'undecided', 'acceptedCandidate', 'confirmedNoMatch', 'deferred', 'revoked', 'remainingNeedsDecision', 'activeTargetReservations'], 'Decision summary'));
  errors.push(...extraKeys(ledger?.validation, ['status', 'errors'], 'Decision validation'));
  if (JSON.stringify(ledger?.summary) !== JSON.stringify(decisionSummary(ledger?.decisions ?? []))) errors.push('Decision summary does not reconcile with items.');
  if (ledger?.validation?.status !== 'READY' || !Array.isArray(ledger?.validation?.errors) || ledger.validation.errors.length) errors.push('Decision ledger validation receipt is invalid.');
  try { assertJsonSafe(ledger, DECISION_LEDGER_SCHEMA); } catch (error) { errors.push(error.message); }
  return Object.freeze(errors);
}
export function assertValidDecisionLedger(ledger, audit, options = {}) {
  const errors = validateDecisionLedger(ledger, audit, options); if (errors.length) throw new TypeError(`Invalid AmbiguityDecisionLedger.v1: ${errors.join(' ')}`); return true;
}
