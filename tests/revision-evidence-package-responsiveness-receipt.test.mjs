import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createRevisionComparisonBasis } from '../tabs/revision-compare/revision-comparison-basis.js';
import {
  REVISION_COMPARE_EVIDENCE_PACKAGE_V1_SCHEMA,
  REVISION_COMPARE_EVIDENCE_PACKAGE_V2_SCHEMA,
  createRevisionCompareEvidencePackage,
  revisionCompareEvidencePackageHashMaterial,
  serializeRevisionCompareEvidencePackage,
} from '../tabs/revision-compare/revision-evidence-package.js';
import { verifyRevisionCompareEvidencePackageJson } from '../tabs/revision-compare/revision-evidence-package-import.js';
import { createRevisionResponsivenessObservationReceipt } from '../tabs/revision-compare/revision-responsiveness-observation-receipt.js';
import { revisionComparisonPreflight } from '../tabs/revision-compare/revision-preflight.js';
import { attachProjectDocument, createProjectDocument, createProjectSession } from '../tabs/revision-compare/revision-session-contracts.js';
import { createReviewSession, setReviewItemNote } from '../tabs/revision-compare/revision-review-session.js';
import { acceptDecisionCandidate, createDecisionLedger } from '../tabs/revision-compare/revision-decision-ledger.js';
import { sha256Text } from '../tabs/revision-compare/revision-hash.js';

const NOW = '2026-07-30T12:00:00.000Z';
const LATER = '2026-07-30T12:05:00.000Z';
const hash = (character) => character.repeat(64);
function documentFor(slotId, role, character) {
  return createProjectDocument({
    documentId: `document:${slotId}`, slotId, role, fileName: `${slotId}.json`, fileSizeBytes: 100,
    sourceHash: hash(character), scopedHash: hash(character === 'a' ? 'c' : 'd'), stagedSchema: 'inputxml-managed-stage/v1',
    rootShape: 'branches', unit: 'mm', verticalAxis: 'Z', coordinateFrame: 'PLANT', createdAt: NOW,
    stats: { branchCount: 1, componentCount: 1, recordCount: 1, geometryEvidenceCount: 1, scanned: 1, matched: 1, filtered: 0 },
    scope: { wildcard: '', selectedIds: ['/COMMON'] },
  });
}
function intake(slotId, role, document) {
  return Object.freeze({
    schema: 'RevisionIntakeState.v1', slotId, role, requestGeneration: 1, status: 'SCOPED',
    fileName: document.fileName, fileSizeBytes: document.fileSizeBytes, contentHash: document.sourceHash,
    document, branchTree: Object.freeze([]), branchIndex: Object.freeze([]),
    branchIndexSummary: Object.freeze({ branchCount: 1 }), scopeDraft: Object.freeze({ selectedIds: Object.freeze(['/COMMON']), exclusions: Object.freeze([]) }),
    scopeResult: Object.freeze({ status: 'READY' }), warnings: Object.freeze([]), blockers: Object.freeze([]), error: null,
  });
}
function row(differenceId, category, certainty, source, target, evidenceId = null) {
  return Object.freeze({
    schema: 'RevisionDifferenceRow.v1', differenceId, differenceCategory: category, matchCertainty: certainty,
    sourceRecordId: source, targetRecordId: target, candidateEvidenceId: evidenceId,
    changeReasons: Object.freeze([category === 'ADDED' ? 'REV_B_ONLY' : 'REV_A_ONLY']), changedProperties: Object.freeze([]),
    geometryDelta: Object.freeze({ status: 'AVAILABLE', changed: false, maximumPointDelta: 0, reason: 'Persisted.' }),
    evidenceSummary: Object.freeze({ primary: 'Persisted package evidence.' }),
    visualRefs: Object.freeze({ sourceObjectId: source ? `A:${source}` : null, targetObjectId: target ? `B:${target}` : null }),
    context: Object.freeze({ branchId: '/COMMON', componentType: 'SUPPORT', revAIdentity: source, revBIdentity: target }),
  });
}
function visualModel(side, documentId, objectId) {
  return Object.freeze({
    contract: 'VisualGeometryModel.v2', schema: 'VisualGeometryModel.v2', modelId: `model:${side}`,
    documentId, revisionId: `revision:${side}`, unit: 'MM', coordinateFrame: 'PLANT', verticalAxis: 'Z', origin: Object.freeze([0, 0, 0]),
    segments: Object.freeze([]), markers: Object.freeze([Object.freeze({ primitiveId: `marker:${objectId}`, objectId, position: Object.freeze([0, 0, 0]), kind: 'NODE' })]),
    bounds: Object.freeze({ min: Object.freeze([0, 0, 0]), max: Object.freeze([1, 1, 1]) }),
  });
}
function auditFor(basis, revA, revB) {
  const evidence = Object.freeze({
    schema: 'RevisionCandidateEvidence.v1', candidateEvidenceId: 'candidate:source-1', sourceRecordId: 'source-1',
    candidateRecordIds: Object.freeze(['target-1']), candidateCount: 1, candidateLimit: 8,
    rankedEvidence: Object.freeze([Object.freeze({ targetRecordId: 'target-1', score: 6, reasons: Object.freeze(['same support type']), geometryDistance: 0 })]),
    acceptedCandidateId: null, rejectionReasons: Object.freeze(['Uniqueness gap not satisfied.']),
    thresholds: Object.freeze({ inferredThreshold: 4, winnerGap: 1.5 }), scoreGapOrDecisionBasis: 'winner gap below threshold', reachedCandidateLimit: false,
  });
  return Object.freeze({
    schema: 'RevisionCompareAudit.v1', auditId: 'audit:package-receipt', basisId: basis.basisId,
    revADocumentId: revA.documentId, revBDocumentId: revB.documentId, engineVersion: 'revision-compare-engine/test',
    configuration: Object.freeze({ engineVersion: 'revision-compare-engine/test' }),
    summary: Object.freeze({ unchanged: 0, changed: 0, added: 1, removed: 1, needsDecision: 1, exact: 0, inferred: 0 }),
    differenceRows: Object.freeze([
      row('difference:source-1:none', 'REMOVED', 'AMBIGUOUS', 'source-1', null, evidence.candidateEvidenceId),
      row('difference:none:target-1', 'ADDED', 'NOT_APPLICABLE', null, 'target-1'),
    ]),
    candidateEvidence: Object.freeze([evidence]),
    visualModels: Object.freeze({
      revA: visualModel('A', revA.documentId, 'A:source-1'), revB: visualModel('B', revB.documentId, 'B:target-1'),
      statusByObjectId: Object.freeze({ 'A:source-1': 'AMBIGUOUS', 'B:target-1': 'NEW_IN_TARGET' }),
    }),
    visualReadiness: Object.freeze({ status: 'READY' }), warnings: Object.freeze([]),
    performanceReceipt: Object.freeze({ elapsedMs: 1 }), validation: Object.freeze({ status: 'READY', errors: Object.freeze([]) }),
  });
}
async function authority() {
  const revA = documentFor('baseline', 'REFERENCE', 'a'); const revB = documentFor('candidate', 'CANDIDATE', 'b');
  let session = createProjectSession({ sessionId: 'revision-session-package-receipt', createdAt: NOW });
  session = attachProjectDocument(session, revA, NOW); session = attachProjectDocument(session, revB, NOW);
  const baseline = intake('baseline', 'REFERENCE', revA); const candidate = intake('candidate', 'CANDIDATE', revB);
  const proposal = Object.freeze({
    schema: 'RevisionScopeProposal.v1', proposalId: 'scope-proposal:package-receipt', revADocumentId: revA.documentId, revBDocumentId: revB.documentId,
    commonBranchIds: Object.freeze(['/COMMON']), revAOnlyBranchIds: Object.freeze([]), revBOnlyBranchIds: Object.freeze([]),
    includedBranchIdsA: Object.freeze(['/COMMON']), includedBranchIdsB: Object.freeze(['/COMMON']), excludedBranches: Object.freeze([]),
    commonBranches: Object.freeze([Object.freeze({ branchId: '/COMMON' })]), revAOnlyBranches: Object.freeze([]), revBOnlyBranches: Object.freeze([]),
    summary: Object.freeze({ commonBranchCount: 1, revAOnlyBranchCount: 0, revBOnlyBranchCount: 0, includedBranchCountA: 1, includedBranchCountB: 1, excludedBranchCount: 0, retainedComponentCountA: 1, retainedComponentCountB: 1, retainedRecordCountA: 1, retainedRecordCountB: 1 }),
    warnings: Object.freeze([]), validation: Object.freeze({ status: 'READY', errors: Object.freeze([]) }),
  });
  const preflight = revisionComparisonPreflight(baseline, candidate, proposal);
  const basis = await createRevisionComparisonBasis({ sessionId: session.sessionId, revA: baseline, revB: candidate, proposal, preflight }, webcrypto);
  const audit = auditFor(basis, revA, revB);
  let reviewSession = createReviewSession(audit, NOW);
  reviewSession = await setReviewItemNote(reviewSession, audit, 'difference:source-1:none', 'Persisted review note', LATER, webcrypto);
  let decisionLedger = createDecisionLedger(audit, NOW);
  decisionLedger = await acceptDecisionCandidate(decisionLedger, audit, 'difference:source-1:none', 'target-1', 'Persisted ambiguity rationale', LATER, webcrypto);
  const state = Object.freeze({ session, slots: Object.freeze({ baseline, candidate }), proposal, basis, basisStatus: 'CURRENT', compare: Object.freeze({ audit }), review: Object.freeze({ session: reviewSession }), decision: Object.freeze({ ledger: decisionLedger }) });
  return { state, preflight, audit, revA, revB };
}
function runSummary(runId) {
  return Object.freeze({ runId, runSequence: 1, policyId: 'package-receipt-policy', bandId: 'FINE', drawableCount: 2, disposition: 'QUALIFIED', sceneMs: 10, firstReadyMs: 12, fitSelectedMs: 2, heapGrowthBytes: null });
}
async function attachmentFor(value) {
  const runKey = `${value.audit.auditId}|WEBGL`; const runId = `${runKey}|run:1`; const current = runSummary(runId);
  const responsiveness = Object.freeze({
    runKey, runId, runSequence: 1, policyId: current.policyId, bandId: current.bandId, drawableCount: current.drawableCount,
    sceneStatus: 'READY', disposition: 'QUALIFIED',
    metrics: Object.freeze({
      scene: Object.freeze({ status: 'PASS', value: 10, limit: 100 }), firstReady: Object.freeze({ status: 'PASS', value: 12, limit: 100 }),
      fitSelected: Object.freeze({ status: 'PASS', value: 2, limit: 20, count: 1 }), memory: Object.freeze({ status: 'UNAVAILABLE', value: null, limit: 1024, usedBytes: null }),
    }),
    comparison: Object.freeze({ available: false, reason: 'NO_PREVIOUS_RUN', previous: null, current, deltas: Object.freeze({ sceneMs: null, firstReadyMs: null, fitSelectedMs: null, heapGrowthBytes: null }) }),
  });
  const receipt = await createRevisionResponsivenessObservationReceipt({
    session: value.state.session, audit: value.audit, revA: value.revA, revB: value.revB,
    sceneEvidence: Object.freeze({ runKey, runId, runSequence: 1, runSampleCount: 1, elapsedMs: 15, responsiveness }),
  }, webcrypto);
  return Object.freeze({ status: 'VERIFIED_CURRENT', runId, receipt });
}
async function rehash(value) {
  value.contentSha256 = await sha256Text(JSON.stringify(revisionCompareEvidencePackageHashMaterial(value)), webcrypto);
  value.packageId = `revision-evidence-package:${value.contentSha256}`;
  return JSON.stringify(value);
}

const value = await authority();
const v1 = await createRevisionCompareEvidencePackage(value.state, value.preflight, webcrypto);
assert.equal(v1.schema, REVISION_COMPARE_EVIDENCE_PACKAGE_V1_SCHEMA);
assert.equal(Object.hasOwn(v1.payload, 'responsivenessReceipt'), false);
const attachment = await attachmentFor(value);
const v2 = await createRevisionCompareEvidencePackage(value.state, value.preflight, webcrypto, attachment);
assert.equal(v2.schema, REVISION_COMPARE_EVIDENCE_PACKAGE_V2_SCHEMA);
assert.deepEqual(v2.payload.responsivenessReceipt, attachment.receipt);
assert.equal(v2.identity.responsivenessReceiptId, attachment.receipt.receiptId);
assert.equal(v2.identity.responsivenessReceiptContentSha256, attachment.receipt.contentSha256);
assert.equal(v2.authorityStatus.responsivenessReceiptStatus, 'VERIFIED_CURRENT_AT_EXPORT');
assert.notEqual(v2.contentSha256, v1.contentSha256);
const repeated = await createRevisionCompareEvidencePackage(value.state, value.preflight, webcrypto, attachment);
assert.equal(serializeRevisionCompareEvidencePackage(repeated), serializeRevisionCompareEvidencePackage(v2));

const verified = await verifyRevisionCompareEvidencePackageJson(JSON.stringify(v2), 'attached.json', LATER, webcrypto);
assert.equal(verified.receipt.packageId, v2.packageId);
assert.equal(verified.receipt.responsivenessReceiptAttached, true);
assert.equal(verified.receipt.responsivenessReceiptId, attachment.receipt.receiptId);
assert.equal(verified.receipt.responsivenessReceiptContentSha256, attachment.receipt.contentSha256);
assert.equal(verified.receipt.responsivenessReceiptIntegrityStatus, 'VERIFIED');
assert.equal(verified.responsivenessReceiptVerification.authenticityStatus, 'NOT_ESTABLISHED');
assert.equal(verified.responsivenessReceiptVerification.receipt.observation.runId, attachment.runId);

await assert.rejects(
  () => createRevisionCompareEvidencePackage(value.state, value.preflight, webcrypto, { ...attachment, status: 'VERIFIED_HISTORICAL' }),
  /verified for the current active run/i,
);
const wrongAuthority = structuredClone(attachment); wrongAuthority.receipt.audit.auditId = 'audit:other';
await assert.rejects(() => createRevisionCompareEvidencePackage(value.state, value.preflight, webcrypto, wrongAuthority), /does not match/i);
const tampered = structuredClone(v2); tampered.payload.responsivenessReceipt.observation.metrics.scene.value += 1;
await assert.rejects(
  () => verifyRevisionCompareEvidencePackageJson(await rehash(tampered), 'tampered.json', LATER, webcrypto),
  /Content SHA-256 does not match canonical receipt content/i,
);
console.log('revision-evidence-package-responsiveness-receipt.test.mjs passed');
