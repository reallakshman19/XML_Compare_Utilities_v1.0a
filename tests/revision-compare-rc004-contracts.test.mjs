import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  acceptDecisionCandidate, confirmDecisionNoMatch, createDecisionLedger, decisionLedgerMatchesAudit,
  deferDecision, markDecisionLedgerStale, reattachDecisionLedger, revokeDecision,
} from '../tabs/revision-compare/revision-decision-ledger.js';
import {
  activeTargetReservations, DECISION_RATIONALE_MAX_LENGTH, decisionItemIndex,
  selectedPairEvidenceIndex, validateDecisionLedger,
} from '../tabs/revision-compare/revision-decision-contracts.js';
import {
  candidatePreview, resolvedRevisionReview, stepCandidatePreview,
} from '../tabs/revision-compare/revision-decision-projection.js';
import { createDecisionLedgerExport, parseDecisionLedgerJson } from '../tabs/revision-compare/revision-decision-manifest.js';
import { createRevisionCompareViewerAdapter } from '../tabs/revision-compare/revision-compare-viewer-adapter.js';
import { _test as decisionViewTest } from '../tabs/revision-compare/revision-decision-view.js';

const NOW = '2026-07-18T12:00:00.000Z';
const LATER = '2026-07-18T12:01:00.000Z';
const row = (differenceId, category, certainty, sourceRecordId, targetRecordId, candidateEvidenceId = null) => ({
  schema: 'RevisionDifferenceRow.v1', differenceId, differenceCategory: category, matchCertainty: certainty,
  sourceRecordId, targetRecordId, candidateEvidenceId, changeReasons: [category === 'ADDED' ? 'REV_B_ONLY' : 'REV_A_ONLY'],
  changedProperties: [], geometryDelta: { status: 'AVAILABLE', changed: false, maximumPointDelta: 0, reason: 'Persisted.' },
  evidenceSummary: { primary: certainty === 'AMBIGUOUS' ? 'Bounded candidates require a later decision.' : 'No accepted counterpart.' },
  visualRefs: { sourceObjectId: sourceRecordId ? `A:${sourceRecordId}` : null, targetObjectId: targetRecordId ? `B:${targetRecordId}` : null },
  context: { branchId: '/COMMON', componentType: 'SUPPORT', revAIdentity: sourceRecordId, revBIdentity: targetRecordId },
});
const evidence = (candidateEvidenceId, sourceRecordId, targets) => ({
  schema: 'RevisionCandidateEvidence.v1', candidateEvidenceId, sourceRecordId,
  candidateRecordIds: targets, candidateCount: targets.length, candidateLimit: 8,
  rankedEvidence: targets.map((targetRecordId, index) => ({ targetRecordId, score: 6 - index, reasons: ['same nominal size', 'same support type'], geometryDistance: index })),
  acceptedCandidateId: null, rejectionReasons: ['Uniqueness gap not satisfied.'],
  thresholds: { inferredThreshold: 4, winnerGap: 1.5 }, scoreGapOrDecisionBasis: 'winner gap 1 below 1.5', reachedCandidateLimit: false,
});
const audit = {
  schema: 'RevisionCompareAudit.v1', auditId: 'audit:rc004', basisId: 'basis:rc004', revADocumentId: 'doc:A', revBDocumentId: 'doc:B',
  validation: { status: 'READY', errors: [] }, summary: { unchanged: 0, changed: 0, added: 2, removed: 2, needsDecision: 2, exact: 0, inferred: 0 },
  differenceRows: [
    row('difference:source-a:none', 'REMOVED', 'AMBIGUOUS', 'source-a', null, 'candidate:source-a'),
    row('difference:source-b:none', 'REMOVED', 'AMBIGUOUS', 'source-b', null, 'candidate:source-b'),
    row('difference:none:target-1', 'ADDED', 'NOT_APPLICABLE', null, 'target-1'),
    row('difference:none:target-2', 'ADDED', 'NOT_APPLICABLE', null, 'target-2'),
  ],
  candidateEvidence: [evidence('candidate:source-a', 'source-a', ['target-1', 'target-2']), evidence('candidate:source-b', 'source-b', ['target-1', 'target-2'])],
  visualModels: { revA: { segments: [], markers: [] }, revB: { segments: [], markers: [] }, statusByObjectId: {} },
};

const ledgerA = createDecisionLedger(audit, NOW); const ledgerB = createDecisionLedger(structuredClone(audit), NOW);
assert.equal(ledgerA.schema, 'AmbiguityDecisionLedger.v1');
assert.equal(ledgerA.ledgerId, ledgerB.ledgerId);
assert.deepEqual(ledgerA.decisions.map((item) => item.differenceId), ['difference:source-a:none', 'difference:source-b:none']);
assert(ledgerA.decisions.every((item) => item.decisionState === 'UNDECIDED'));
assert(Object.isFrozen(ledgerA) && Object.isFrozen(ledgerA.decisions[0]) && Object.isFrozen(ledgerA.events));
assert.deepEqual(validateDecisionLedger(ledgerA, audit), []);
assert.throws(() => createDecisionLedger({ ...audit, validation: { status: 'INVALID' } }, NOW), /valid RevisionCompareAudit/);
const review = Object.freeze({ schema: 'ReviewSession.v1', items: Object.freeze([{ differenceId: 'difference:source-a:none', reviewState: 'UNREVIEWED', note: 'preserve' }]), events: Object.freeze([]) }); const reviewSnapshot = JSON.stringify(review);
await assert.rejects(() => acceptDecisionCandidate(ledgerA, audit, 'difference:source-a:none', 'unknown', 'reject', LATER, webcrypto), /persisted candidate/);
await assert.rejects(() => acceptDecisionCandidate(ledgerA, { ...audit, differenceRows: audit.differenceRows.filter((item) => item.targetRecordId !== 'target-1') }, 'difference:source-a:none', 'target-1', 'reject', LATER, webcrypto), /unmatched-target audit reference/);
await assert.rejects(() => acceptDecisionCandidate(ledgerA, audit, 'difference:source-a:none', 'target-1', '', LATER, webcrypto), /rationale is required/);
await assert.rejects(() => acceptDecisionCandidate(ledgerA, audit, 'difference:source-a:none', 'target-1', 'x'.repeat(DECISION_RATIONALE_MAX_LENGTH + 1), LATER, webcrypto), /limited/);

let ledger = await acceptDecisionCandidate(ledgerA, audit, 'difference:source-a:none', 'target-1', '<accept>& "candidate"', LATER, webcrypto);
assert.equal(ledger.revision, 1); assert.equal(ledger.events[0].sequence, 1);
assert.equal(ledger.events[0].eventId, `${ledger.ledgerId}:event:1`);
assert.equal(ledger.events[0].action, 'ACCEPT_CANDIDATE');
assert.equal(activeTargetReservations(ledger).get('target-1'), 'difference:source-a:none');
assert.equal(ledger.selectedPairEvidence.length, 1);
assert.equal(selectedPairEvidenceIndex(ledger).get(ledger.decisions[0].selectedPairEvidenceId).score, 6);
assert.equal(decisionViewTest.escapeHtml('<accept>& "candidate"'), '&lt;accept&gt;&amp; &quot;candidate&quot;');
assert.equal(JSON.stringify(review), reviewSnapshot, 'RC-003 review state must remain unchanged');

const noOp = await acceptDecisionCandidate(ledger, audit, 'difference:source-a:none', 'target-1', '<accept>& "candidate"', LATER, webcrypto);
assert.equal(noOp, ledger); assert.equal(noOp.events.length, 1);
await assert.rejects(() => acceptDecisionCandidate(ledger, audit, 'difference:source-b:none', 'target-1', 'conflicting target', LATER, webcrypto), /reserved by/);

const replaced = await acceptDecisionCandidate(ledger, audit, 'difference:source-a:none', 'target-2', 'replace target', LATER, webcrypto);
assert.equal(activeTargetReservations(replaced).has('target-1'), false);
assert.equal(activeTargetReservations(replaced).get('target-2'), 'difference:source-a:none');
assert.equal(replaced.events[1].supersedesEventId, replaced.events[0].eventId);
assert.equal(replaced.selectedPairEvidence.length, 2);

const revoked = await revokeDecision(replaced, audit, 'difference:source-a:none', 'revoke after inspection', LATER, webcrypto);
assert.equal(revoked.events[2].action, 'REVOKE_DECISION');
assert.equal(revoked.events[2].supersedesEventId, replaced.events[1].eventId);
assert.equal(activeTargetReservations(revoked).size, 0);
const released = await acceptDecisionCandidate(revoked, audit, 'difference:source-b:none', 'target-2', 'released target is valid', LATER, webcrypto);
assert.equal(activeTargetReservations(released).get('target-2'), 'difference:source-b:none');

const deferred = await deferDecision(ledgerA, audit, 'difference:source-a:none', 'defer for site verification', LATER, webcrypto);
assert.equal(deferred.decisions[0].decisionState, 'DEFERRED');
const confirmed = await confirmDecisionNoMatch(ledgerA, audit, 'difference:source-a:none', 'field evidence confirms no counterpart', LATER, webcrypto);
assert.equal(confirmed.decisions[0].decisionState, 'CONFIRMED_NO_MATCH');
assert.equal(confirmed.decisions[0].acceptedTargetRecordId, null);

const previewBefore = ledgerA.events.length; const preview = candidatePreview(audit, ledgerA, 'difference:source-a:none', 0);
assert.equal(preview.candidate.targetRecordId, 'target-1');
assert.equal(stepCandidatePreview(audit, ledgerA, preview, 'next').candidate.targetRecordId, 'target-2');
assert.equal(ledgerA.events.length, previewBefore, 'candidate preview must not append events');

const resolvedAccepted = resolvedRevisionReview(audit, released);
assert.equal(resolvedAccepted.summary.resolvedCandidateCount, 1);
assert.equal(resolvedAccepted.summary.revokedCount, 1);
assert.equal(resolvedAccepted.rows.find((item) => item.differenceId === 'difference:none:target-2').decisionState, 'CONSUMED_BY_ACCEPTED_CANDIDATE');
assert.equal(resolvedAccepted.rows.find((item) => item.differenceId === 'difference:source-b:none').originalMatchCertainty, 'AMBIGUOUS');
const resolvedNoMatch = resolvedRevisionReview(audit, confirmed);
assert.equal(resolvedNoMatch.rows.find((item) => item.differenceId === 'difference:source-a:none').effectiveDifferenceCategory, 'REMOVED');
assert.equal(resolvedNoMatch.summary.remainingNeedsDecision, 1);

const stale = markDecisionLedgerStale(released, LATER);
assert.equal(stale.status, 'STALE');
await assert.rejects(() => deferDecision(stale, audit, 'difference:source-a:none', 'blocked', LATER, webcrypto), /stale and read-only/);
assert(decisionLedgerMatchesAudit(stale, audit));
const reattached = reattachDecisionLedger(stale, audit, LATER);
assert.equal(reattached.status, 'CURRENT'); assert.equal(reattached.ledgerId, stale.ledgerId); assert.equal(reattached.events.length, stale.events.length);
assert.equal(decisionLedgerMatchesAudit(stale, { ...audit, auditId: 'different' }), false);

const exported = createDecisionLedgerExport(released); const serialized = JSON.stringify(exported);
assert.equal(JSON.parse(serialized).ledgerId, released.ledgerId);
for (const token of ['inputxml-managed-stage', 'differenceRows', 'visualModels', 'rankedEvidence', 'segments', 'markers']) assert(!serialized.includes(`"${token}"`));
const imported = await parseDecisionLedgerJson(serialized, audit, LATER, webcrypto);
assert.deepEqual(imported, released);
const importedStale = await parseDecisionLedgerJson(JSON.stringify(stale), audit, LATER, webcrypto);
assert.equal(importedStale.status, 'CURRENT'); assert.equal(importedStale.ledgerId, stale.ledgerId);

async function rejectsMutation(mutator, pattern) {
  const value = structuredClone(released); mutator(value);
  await assert.rejects(() => parseDecisionLedgerJson(JSON.stringify(value), audit, LATER, webcrypto), pattern);
}
await rejectsMutation((value) => { value.auditId = 'audit:mismatch'; }, /auditId/);
await rejectsMutation((value) => { value.basisId = 'basis:mismatch'; }, /basisId/);
await rejectsMutation((value) => { value.revADocumentId = 'doc:mismatch'; }, /Rev A document/);
await rejectsMutation((value) => { value.decisions.pop(); }, /Missing ambiguity item/);
await rejectsMutation((value) => { value.decisions.push({ ...value.decisions[0], differenceId: 'unknown' }); }, /Unknown ambiguity item/);
await rejectsMutation((value) => { value.decisions.push(structuredClone(value.decisions[0])); }, /duplicate difference IDs/i);
await rejectsMutation((value) => { const item = value.decisions.find((entry) => entry.decisionState === 'ACCEPTED_CANDIDATE'); item.acceptedTargetRecordId = 'unknown'; }, /outside persisted candidate evidence/);
await rejectsMutation((value) => { value.events.push(structuredClone(value.events[0])); value.revision += 1; }, /sequence|deterministic ID|Duplicate/);
await rejectsMutation((value) => { value.events[0].sequence = 7; }, /sequence is broken/);
await rejectsMutation((value) => { value.events[0].action = 'DEFER_DECISION'; }, /defer semantics/);
await rejectsMutation((value) => { value.events[1].supersedesEventId = null; }, /supersession/);
await rejectsMutation((value) => { value.summary.undecided += 1; }, /summary/);
await rejectsMutation((value) => { value.decisions[0].rationale = 'tampered'; }, /rationale|event history/);
await rejectsMutation((value) => { value.selectedPairEvidence[0].score += 1; }, /alters persisted candidate evidence|tampered/);
await rejectsMutation((value) => { value.unexpectedPayload = { differenceRows: [] }; }, /unsupported field|prohibited payload/);

const forged = structuredClone(ledger);
forged.events[0].action = 'CONFIRM_NO_MATCH';
assert(validateDecisionLedger(forged, audit).some((message) => /no-match semantics/.test(message)));

const viewerLog = { selections: [], fitAll: 0, fitSelected: 0, models: null };
const adapter = createRevisionCompareViewerAdapter({ viewerFactory: async () => ({
  reattach() {}, setModels(models) { viewerLog.models = structuredClone(models); }, setStatuses() {}, setMode() {}, setVerticalAxis() {},
  setSelection(id, related) { viewerLog.selections.push([id, ...related]); }, fitAll() { viewerLog.fitAll += 1; }, fitSelection() { viewerLog.fitSelected += 1; },
  getStateSnapshot: () => ({ cameraPosition: [1, 2, 3], cameraTarget: [0, 0, 0] }), dispose() {},
}) });
await adapter.render({}, audit); const modelsBefore = JSON.stringify(viewerLog.models);
adapter.selectDifference('difference:source-a:none'); adapter.previewPair('difference:source-a:none', 'difference:none:target-1');
assert.equal(viewerLog.fitAll, 0); assert.equal(viewerLog.fitSelected, 0); assert.equal(JSON.stringify(viewerLog.models), modelsBefore);
adapter.clearPreview(); adapter.dispose();

console.log('revision-compare-rc004-contracts.test.mjs passed');
