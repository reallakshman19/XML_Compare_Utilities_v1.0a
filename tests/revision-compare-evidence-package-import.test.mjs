import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createRevisionComparisonBasis } from '../tabs/revision-compare/revision-comparison-basis.js';
import {
  createRevisionCompareEvidencePackage,
  revisionCompareEvidencePackageHashMaterial,
  serializeRevisionCompareEvidencePackage,
} from '../tabs/revision-compare/revision-evidence-package.js';
import {
  REVISION_EVIDENCE_PACKAGE_AUTHENTICITY_STATEMENT,
  verifyRevisionCompareEvidencePackageJson,
} from '../tabs/revision-compare/revision-evidence-package-import.js';
import {
  completeWorkspaceEvidencePackageImport,
  createRevisionWorkspaceState,
  failWorkspaceEvidencePackageImport,
  startWorkspaceEvidencePackageImport,
  startWorkspaceLoad,
} from '../tabs/revision-compare/revision-workspace-state.js';
import { revisionComparisonPreflight } from '../tabs/revision-compare/revision-preflight.js';
import { attachProjectDocument, createProjectDocument, createProjectSession } from '../tabs/revision-compare/revision-session-contracts.js';
import { createReviewSession, markReviewSessionStale, setReviewItemNote } from '../tabs/revision-compare/revision-review-session.js';
import { acceptDecisionCandidate, createDecisionLedger, markDecisionLedgerStale } from '../tabs/revision-compare/revision-decision-ledger.js';
import { sha256Text } from '../tabs/revision-compare/revision-hash.js';

const NOW = '2026-07-21T09:00:00.000Z';
const LATER = '2026-07-21T09:05:00.000Z';
const IMPORTED = '2026-07-21T10:00:00.000Z';
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
    schema: 'RevisionCompareAudit.v1', auditId: 'audit:package-import', basisId: basis.basisId,
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
async function authorityState(stale = false) {
  const revA = documentFor('baseline', 'REFERENCE', 'a'); const revB = documentFor('candidate', 'CANDIDATE', 'b');
  let session = createProjectSession({ sessionId: 'revision-session-package-import', createdAt: NOW });
  session = attachProjectDocument(session, revA, NOW); session = attachProjectDocument(session, revB, NOW);
  const baseline = intake('baseline', 'REFERENCE', revA); const candidate = intake('candidate', 'CANDIDATE', revB);
  const proposal = Object.freeze({
    schema: 'RevisionScopeProposal.v1', proposalId: 'scope-proposal:package-import', revADocumentId: revA.documentId, revBDocumentId: revB.documentId,
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
  if (stale) { reviewSession = markReviewSessionStale(reviewSession, LATER); decisionLedger = markDecisionLedgerStale(decisionLedger, LATER); }
  return Object.freeze({
    state: Object.freeze({ session, slots: Object.freeze({ baseline, candidate }), proposal, basis, basisStatus: 'CURRENT', compare: Object.freeze({ audit }), review: Object.freeze({ session: reviewSession }), decision: Object.freeze({ ledger: decisionLedger }) }),
    preflight, audit,
  });
}
async function artifactFor(stale = false) {
  const authority = await authorityState(stale);
  const artifact = await createRevisionCompareEvidencePackage(authority.state, authority.preflight, webcrypto);
  return { ...authority, artifact, text: serializeRevisionCompareEvidencePackage(artifact) };
}
async function rehash(value) {
  value.contentSha256 = await sha256Text(JSON.stringify(revisionCompareEvidencePackageHashMaterial(value)), webcrypto);
  value.packageId = `revision-evidence-package:${value.contentSha256}`; return JSON.stringify(value);
}
async function rejectsTamper(base, mutate, pattern) {
  const value = structuredClone(base); mutate(value); const text = await rehash(value);
  await assert.rejects(() => verifyRevisionCompareEvidencePackageJson(text, 'tampered.json', IMPORTED, webcrypto), pattern);
}

const current = await artifactFor(); const original = current.text;
const verified = await verifyRevisionCompareEvidencePackageJson(current.text, 'current.json', IMPORTED, webcrypto);
assert.equal(current.text, original); assert.deepEqual(verified.audit, current.audit);
assert.equal(verified.reviewSession.status, 'CURRENT'); assert.equal(verified.decisionLedger.status, 'CURRENT');
assert.equal(verified.receipt.reviewReattached, false); assert.equal(verified.receipt.decisionReattached, false);
assert.equal(verified.receipt.authenticityStatus, 'NOT_ESTABLISHED');
assert.equal(REVISION_EVIDENCE_PACKAGE_AUTHENTICITY_STATEMENT, 'Integrity and authority-chain consistency verified. Package authenticity is not established.');
assert(Object.isFrozen(verified) && Object.isFrozen(verified.audit));

const reordered = { validation: current.artifact.validation, payload: current.artifact.payload, authorityStatus: current.artifact.authorityStatus, identity: current.artifact.identity, contentSha256: current.artifact.contentSha256, packageId: current.artifact.packageId, schema: current.artifact.schema };
assert.equal((await verifyRevisionCompareEvidencePackageJson(JSON.stringify(reordered), 'reordered.json', IMPORTED, webcrypto)).receipt.packageId, current.artifact.packageId);
await assert.rejects(() => verifyRevisionCompareEvidencePackageJson('{bad', 'bad.json', IMPORTED, webcrypto), /JSON is invalid/);
await assert.rejects(() => verifyRevisionCompareEvidencePackageJson(JSON.stringify({ ...current.artifact, extra: true }), 'extra.json', IMPORTED, webcrypto), /unsupported or missing fields/);
await assert.rejects(() => verifyRevisionCompareEvidencePackageJson(JSON.stringify({ ...current.artifact, schema: 'RevisionCompareEvidencePackage.v2' }), 'v2.json', IMPORTED, webcrypto), /schema must be/);
await assert.rejects(() => verifyRevisionCompareEvidencePackageJson(JSON.stringify({ ...current.artifact, contentSha256: hash('0') }), 'hash.json', IMPORTED, webcrypto), /packageId does not match|canonical SHA-256/);
await assert.rejects(() => verifyRevisionCompareEvidencePackageJson(JSON.stringify({ ...current.artifact, packageId: 'revision-evidence-package:bad' }), 'id.json', IMPORTED, webcrypto), /packageId/);
await rejectsTamper(current.artifact, (value) => { value.payload.sessionManifest.schema = 'RevisionSessionManifest.v2'; }, /Session manifest schema/);
await rejectsTamper(current.artifact, (value) => { value.payload.sessionManifest.revisions.revA.rawUploadedBytes = [1, 2, 3]; }, /unsupported or missing fields/);
await rejectsTamper(current.artifact, (value) => { value.payload.scopeBasisManifest.basis.sessionId = 'other'; }, /Session and basis identities/);
await rejectsTamper(current.artifact, (value) => { value.payload.scopeBasisManifest.basis.revAContentHash = hash('f'); }, /source hashes/);
await rejectsTamper(current.artifact, (value) => {
  value.payload.sessionManifest.preflight.compatibility.unitCompatibility.status = 'INCOMPATIBLE';
  value.payload.scopeBasisManifest.preflight.compatibility.unitCompatibility.status = 'INCOMPATIBLE';
  value.payload.scopeBasisManifest.basis.unitCompatibility.status = 'INCOMPATIBLE';
}, /preflight evidence|deterministic basis/);
await rejectsTamper(current.artifact, (value) => { value.payload.audit.differenceRows[1].differenceId = value.payload.audit.differenceRows[0].differenceId; }, /difference IDs/);
await rejectsTamper(current.artifact, (value) => { value.payload.audit.visualModels.statusByObjectId.unknown = 'MATCHED'; }, /status map/);
await rejectsTamper(current.artifact, (value) => { value.payload.reviewSession.items[0].note = 'tampered'; }, /note hash|event history/);
await rejectsTamper(current.artifact, (value) => { value.payload.decisionLedger.decisions[0].rationale = 'tampered'; }, /rationale|event history/);
await rejectsTamper(current.artifact, (value) => { value.identity.auditId = 'audit:other'; }, /Package identity/);
await rejectsTamper(current.artifact, (value) => { value.authorityStatus.reviewStatus = 'STALE'; }, /authorityStatus/);

let fresh = createRevisionWorkspaceState('fresh-session', NOW);
assert.equal(fresh.schema, 'RevisionCompareWorkspaceState.v12');
assert.equal(fresh.transferReview.schema, 'RevisionCompareTransferReviewState.v1');
assert.equal(fresh.evidencePackageImport.schema, 'RevisionEvidencePackageImportState.v1');
fresh = startWorkspaceEvidencePackageImport(fresh, 1, 'current.json');
assert.equal(fresh.evidencePackageImport.status, 'IMPORTING');
const imported = completeWorkspaceEvidencePackageImport(fresh, 1, verified);
assert.equal(imported.evidencePackageImport.status, 'VERIFIED'); assert.equal(imported.compare.status, 'COMPLETE');
assert.equal(imported.transferReview.schema, 'RevisionCompareTransferReviewState.v1');
assert.equal(imported.compare.reviewVisible, true); assert.deepEqual(imported.compare.audit, current.audit);
assert.equal(imported.slots.baseline.branchTree.length, 0); assert.equal(imported.slots.baseline.fileName, 'baseline.json');
assert.equal(JSON.stringify(imported).includes('rawUploadedBytes'), false);
const roundTrip = await createRevisionCompareEvidencePackage(imported, revisionComparisonPreflight(imported.slots.baseline, imported.slots.candidate, imported.proposal), webcrypto);
assert.equal(serializeRevisionCompareEvidencePackage(roundTrip), current.text);

const nonFreshBefore = imported; const blocked = startWorkspaceEvidencePackageImport(nonFreshBefore, 2, 'other.json');
assert.equal(blocked.evidencePackageImport.status, 'FAILED'); assert.deepEqual(blocked.compare.audit, nonFreshBefore.compare.audit);
assert.match(blocked.evidencePackageImport.error, /Close this workspace/);
const loading = startWorkspaceLoad(createRevisionWorkspaceState('loading-session', NOW), 'baseline', 1, 'slow.json', 10, NOW);
const loadingBlocked = startWorkspaceEvidencePackageImport(loading, 1, 'current.json');
assert.equal(loadingBlocked.evidencePackageImport.status, 'FAILED'); assert.match(loadingBlocked.evidencePackageImport.error, /Close this workspace/);
let racing = createRevisionWorkspaceState('racing-session', NOW); racing = startWorkspaceEvidencePackageImport(racing, 1, 'current.json');
racing = startWorkspaceLoad(racing, 'baseline', 1, 'slow.json', 10, NOW);
const raceBlocked = completeWorkspaceEvidencePackageImport(racing, 1, verified);
assert.equal(raceBlocked.evidencePackageImport.status, 'FAILED'); assert.equal(raceBlocked.compare.audit, null);
let rapid = createRevisionWorkspaceState('rapid-session', NOW); rapid = startWorkspaceEvidencePackageImport(rapid, 1, 'old.json'); rapid = startWorkspaceEvidencePackageImport(rapid, 2, 'new.json');
assert.equal(completeWorkspaceEvidencePackageImport(rapid, 1, verified), rapid);
assert.equal(failWorkspaceEvidencePackageImport(rapid, 1, new Error('old failure')), rapid);
assert.equal(completeWorkspaceEvidencePackageImport(rapid, 2, verified).evidencePackageImport.status, 'VERIFIED');

const stale = await artifactFor(true);
const staleVerified = await verifyRevisionCompareEvidencePackageJson(stale.text, 'stale.json', IMPORTED, webcrypto);
assert.equal(staleVerified.receipt.reviewReattached, true); assert.equal(staleVerified.receipt.decisionReattached, true);
assert.equal(staleVerified.reviewSession.status, 'CURRENT'); assert.equal(staleVerified.decisionLedger.status, 'CURRENT');
assert.equal(staleVerified.reviewSession.reviewSessionId, stale.artifact.payload.reviewSession.reviewSessionId);
assert.equal(staleVerified.reviewSession.events.length, stale.artifact.payload.reviewSession.events.length);
assert.equal(staleVerified.decisionLedger.ledgerId, stale.artifact.payload.decisionLedger.ledgerId);
assert.deepEqual(staleVerified.audit, stale.audit);
console.log('revision-compare-evidence-package-import.test.mjs passed');
