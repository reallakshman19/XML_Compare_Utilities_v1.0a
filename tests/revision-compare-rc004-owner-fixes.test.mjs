import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { acceptDecisionCandidate, createDecisionLedger } from '../tabs/revision-compare/revision-decision-ledger.js';
import { selectedPairFingerprint } from '../tabs/revision-compare/revision-decision-contracts.js';
import { createDecisionLedgerExport, parseDecisionLedgerJson } from '../tabs/revision-compare/revision-decision-manifest.js';

const NOW = '2026-07-18T18:00:00.000Z';
function row(differenceId, category, certainty, sourceRecordId, targetRecordId, candidateEvidenceId = null) {
  return {
    schema: 'RevisionDifferenceRow.v1', differenceId, differenceCategory: category, matchCertainty: certainty,
    sourceRecordId, targetRecordId, candidateEvidenceId, changeReasons: [], changedProperties: [],
    geometryDelta: { status: 'AVAILABLE', changed: false, maximumPointDelta: 0, reason: 'Persisted.' },
    evidenceSummary: { primary: 'Persisted evidence.' },
    visualRefs: { sourceObjectId: sourceRecordId ? `A:${sourceRecordId}` : null, targetObjectId: targetRecordId ? `B:${targetRecordId}` : null },
    context: { branchId: '/COMMON', componentType: 'SUPPORT', revAIdentity: sourceRecordId, revBIdentity: targetRecordId },
  };
}
const candidateEvidence = {
  schema: 'RevisionCandidateEvidence.v1', candidateEvidenceId: 'candidate:source-a', sourceRecordId: 'source-a',
  candidateRecordIds: ['target-1', 'target-2'], candidateCount: 2, candidateLimit: 8,
  rankedEvidence: [
    { targetRecordId: 'target-1', score: 6, reasons: ['same type'], geometryDistance: 0 },
    { targetRecordId: 'target-2', score: 5, reasons: ['same type'], geometryDistance: 1 },
  ],
  acceptedCandidateId: null, rejectionReasons: ['Winner gap not satisfied.'],
  thresholds: { inferredThreshold: 4, winnerGap: 1.5 }, scoreGapOrDecisionBasis: 'winner gap 1 below 1.5', reachedCandidateLimit: false,
};
const audit = {
  schema: 'RevisionCompareAudit.v1', auditId: 'audit:owner-rc004', basisId: 'basis:owner-rc004',
  revADocumentId: 'doc:A', revBDocumentId: 'doc:B', validation: { status: 'READY', errors: [] },
  differenceRows: [
    row('difference:source-a:none', 'REMOVED', 'AMBIGUOUS', 'source-a', null, candidateEvidence.candidateEvidenceId),
    row('difference:none:target-1', 'ADDED', 'NOT_APPLICABLE', null, 'target-1'),
    row('difference:none:target-2', 'ADDED', 'NOT_APPLICABLE', null, 'target-2'),
  ],
  candidateEvidence: [candidateEvidence], visualModels: { revA: {}, revB: {}, statusByObjectId: {} },
};
function fingerprint(pair) {
  return selectedPairFingerprint({
    differenceId: pair.differenceId, sourceRecordId: pair.sourceRecordId, targetRecordId: pair.targetRecordId,
    targetDifferenceId: pair.targetDifferenceId, candidateEvidenceId: pair.candidateEvidenceId, rank: pair.rank,
    score: pair.score, reasons: pair.reasons, geometryDistance: pair.geometryDistance, thresholds: pair.thresholds,
    candidateLimit: pair.candidateLimit, decisionBasis: pair.decisionBasis,
  });
}
async function accepted(rationale = 'Accept persisted candidate.') {
  return acceptDecisionCandidate(createDecisionLedger(audit, NOW), audit, 'difference:source-a:none', 'target-1', rationale, NOW, webcrypto);
}
async function rejectsLedger(value, pattern) {
  await assert.rejects(() => parseDecisionLedgerJson(JSON.stringify(value), audit, NOW, webcrypto), pattern);
}

const thresholdForgery = structuredClone(await accepted());
thresholdForgery.selectedPairEvidence[0].thresholds.inferredThreshold = 999;
thresholdForgery.selectedPairEvidence[0].evidenceHash = fingerprint(thresholdForgery.selectedPairEvidence[0]);
await rejectsLedger(thresholdForgery, /threshold, cap, or decision-basis/);

const pairMismatch = structuredClone(await accepted());
pairMismatch.events[0].nextTargetRecordId = 'target-2';
pairMismatch.decisions[0].acceptedTargetRecordId = 'target-2';
pairMismatch.decisions[0].acceptedTargetDifferenceId = 'difference:none:target-2';
await rejectsLedger(pairMismatch, /selected-pair evidence does not match/);

const literalKeyRationale = await accepted('The text "differenceRows" is a rationale, not an embedded payload.');
assert.equal(createDecisionLedgerExport(literalKeyRationale), literalKeyRationale);
assert.deepEqual(await parseDecisionLedgerJson(JSON.stringify(literalKeyRationale), audit, NOW, webcrypto), literalKeyRationale);

console.log('revision-compare-rc004-owner-fixes.test.mjs passed');
