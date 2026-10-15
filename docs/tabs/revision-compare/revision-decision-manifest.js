/** Exact AmbiguityDecisionLedger.v1 export and import without source payloads. */
import { assertJsonSafe, deepFreeze } from './revision-contract-utils.js';
import { sha256Text } from './revision-hash.js';
import {
  assertValidDecisionLedger, candidateEvidenceIndex, DECISION_LEDGER_SCHEMA, decisionSummary,
  decisionItemIndex, selectedPairEvidenceIndex, targetDifferenceIndex,
} from './revision-decision-contracts.js';
import { reattachDecisionLedger } from './revision-decision-ledger.js';

const PROHIBITED_KEYS = new Set(['differenceRows', 'visualModels', 'segments', 'markers', 'rankedEvidence']);
function prohibitedPayload(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.schema === 'inputxml-managed-stage') return 'inputxml-managed-stage';
  if (Array.isArray(value)) {
    for (const item of value) { const found = prohibitedPayload(item); if (found) return found; }
    return null;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (PROHIBITED_KEYS.has(key)) return key;
    const found = prohibitedPayload(nested); if (found) return found;
  }
  return null;
}
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function sameJson(left, right) { return canonicalJson(left) === canonicalJson(right); }
function expectedSummary(ledger) { return decisionSummary(ledger.decisions ?? []); }
function validationView(ledger) { return { ...ledger, summary: expectedSummary(ledger) }; }
function assertSummary(ledger) {
  if (!sameJson(ledger.summary, expectedSummary(ledger))) {
    throw new TypeError('Decision summary does not reconcile with items.');
  }
}
function pairAuditErrors(ledger, audit) {
  const errors = []; const items = decisionItemIndex(ledger); const pairs = selectedPairEvidenceIndex(ledger);
  const evidenceById = candidateEvidenceIndex(audit); const targets = targetDifferenceIndex(audit);
  for (const pair of ledger.selectedPairEvidence) {
    const item = items.get(pair.differenceId); const evidence = evidenceById.get(pair.candidateEvidenceId);
    const ranked = evidence?.rankedEvidence.find((entry) => entry.targetRecordId === pair.targetRecordId);
    const expectedId = `selected-pair:${ledger.ledgerId}:${pair.sourceRecordId}:${pair.targetRecordId}`;
    if (pair.selectedPairEvidenceId !== expectedId) errors.push(`${pair.selectedPairEvidenceId} has a non-deterministic selected-pair ID.`);
    if (!item || item.sourceRecordId !== pair.sourceRecordId || item.candidateEvidenceId !== pair.candidateEvidenceId || evidence?.sourceRecordId !== pair.sourceRecordId) errors.push(`${pair.selectedPairEvidenceId} is not bound to the source decision evidence.`);
    if (!ranked || targets.get(pair.targetRecordId)?.differenceId !== pair.targetDifferenceId) errors.push(`${pair.selectedPairEvidenceId} lacks exact persisted target evidence.`);
    if (evidence && (!sameJson(pair.thresholds, evidence.thresholds) || pair.candidateLimit !== evidence.candidateLimit || pair.decisionBasis !== evidence.scoreGapOrDecisionBasis)) errors.push(`${pair.selectedPairEvidenceId} alters persisted threshold, cap, or decision-basis evidence.`);
  }
  for (const item of ledger.decisions) {
    if (item.decisionState !== 'ACCEPTED_CANDIDATE') continue;
    const pair = pairs.get(item.selectedPairEvidenceId);
    if (!pair || pair.differenceId !== item.differenceId || pair.targetRecordId !== item.acceptedTargetRecordId || pair.targetDifferenceId !== item.acceptedTargetDifferenceId) errors.push(`${item.differenceId} selected-pair evidence does not match its accepted target.`);
  }
  for (const event of ledger.events) {
    if (event.action !== 'ACCEPT_CANDIDATE') continue;
    const pair = pairs.get(event.selectedPairEvidenceId);
    if (!pair || pair.differenceId !== event.differenceId || pair.targetRecordId !== event.nextTargetRecordId) errors.push(`${event.eventId} selected-pair evidence does not match its acceptance event.`);
  }
  return errors;
}
export function createDecisionLedgerExport(ledger) {
  if (!ledger) throw new Error('Decision ledger is unavailable.');
  assertJsonSafe(ledger, DECISION_LEDGER_SCHEMA); const prohibited = prohibitedPayload(ledger);
  if (prohibited) throw new Error(`Decision ledger contains prohibited payload ${prohibited}.`);
  return ledger;
}
async function rationaleHashErrors(ledger, cryptoRef) {
  const errors = [];
  for (const item of ledger.decisions) if (await sha256Text(item.rationale, cryptoRef) !== item.rationaleHash) errors.push(`${item.differenceId} has a tampered rationale hash.`);
  for (const event of ledger.events) if (await sha256Text(event.rationale, cryptoRef) !== event.rationaleHash) errors.push(`${event.eventId} has a tampered rationale hash.`);
  return errors;
}
export async function verifyDecisionEvidenceRecord(ledger, audit, cryptoRef) {
  assertValidDecisionLedger(validationView(ledger), audit);
  assertSummary(ledger);
  const errors = [...pairAuditErrors(ledger, audit), ...await rationaleHashErrors(ledger, cryptoRef)];
  if (errors.length) throw new TypeError(`Invalid AmbiguityDecisionLedger.v1: ${errors.join(' ')}`);
  const prohibited = prohibitedPayload(ledger);
  if (prohibited) throw new TypeError(`Decision ledger contains prohibited payload ${prohibited}.`);
  return ledger;
}
export function reattachVerifiedDecisionRecord(ledger, audit, importedAt) {
  return reattachDecisionLedger(validationView(ledger), audit, importedAt);
}
export async function parseDecisionLedgerJson(text, audit, importedAt, cryptoRef) {
  let value;
  try { value = JSON.parse(String(text)); }
  catch (error) { throw new SyntaxError(`Decision ledger JSON is invalid: ${error.message}`); }
  const ledger = deepFreeze(value);
  await verifyDecisionEvidenceRecord(ledger, audit, cryptoRef);
  return ledger.status === 'STALE' ? reattachVerifiedDecisionRecord(ledger, audit, importedAt) : ledger;
}
export const _test = Object.freeze({ pairAuditErrors, prohibitedPayload, rationaleHashErrors });
