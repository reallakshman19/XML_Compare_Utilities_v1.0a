import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  REVISION_COMPARE_EVIDENCE_PACKAGE_SCHEMA,
  _test,
  createRevisionCompareEvidencePackage,
  revisionCompareEvidencePackageFileName,
  revisionCompareEvidencePackageReadiness,
  serializeRevisionCompareEvidencePackage,
} from '../tabs/revision-compare/revision-evidence-package.js';
import { createRevisionScopeManifest, createRevisionSessionManifest } from '../tabs/revision-compare/revision-manifests.js';
import { createReviewSessionExport } from '../tabs/revision-compare/revision-review-manifest.js';
import { createDecisionLedgerExport } from '../tabs/revision-compare/revision-decision-manifest.js';
import { sha256Text } from '../tabs/revision-compare/revision-hash.js';

const preflight = Object.freeze({
  status: 'READY', blockers: Object.freeze([]), warnings: Object.freeze([]), notes: Object.freeze([]),
  compatibility: Object.freeze({ unitCompatibility: Object.freeze({ status: 'READY' }) }),
});
function slot(slotId, role, documentId) {
  return Object.freeze({
    schema: 'RevisionIntakeSlot.v1', slotId, role, requestGeneration: 1, status: 'READY',
    fileName: `${documentId}.json`, fileSizeBytes: 100, contentHash: `hash:${documentId}`,
    document: Object.freeze({ documentId, sourceHash: `source:${documentId}`, scopedHash: `scope:${documentId}` }),
    branchIndexSummary: Object.freeze({ branchCount: 1 }), scopeResult: Object.freeze({ status: 'READY' }),
    warnings: Object.freeze([]), blockers: Object.freeze([]), error: null,
  });
}
function authorityState(overrides = {}) {
  const audit = Object.freeze({
    schema: 'RevisionCompareAudit.v1', auditId: 'audit:1', basisId: 'basis:1',
    revADocumentId: 'doc:A', revBDocumentId: 'doc:B', engineVersion: 'rc-engine:test',
    differenceRows: Object.freeze([
      Object.freeze({ differenceId: 'difference:B', values: Object.freeze([2, 1]) }),
      Object.freeze({ differenceId: 'difference:A', values: Object.freeze([3]) }),
    ]),
    candidateEvidence: Object.freeze([]), visualModels: Object.freeze({}), statusByObjectId: Object.freeze({}),
    validation: Object.freeze({ status: 'READY', errors: Object.freeze([]) }),
  });
  const review = Object.freeze({
    schema: 'ReviewSession.v1', reviewSessionId: 'review:audit:1', auditId: 'audit:1', basisId: 'basis:1',
    revADocumentId: 'doc:A', revBDocumentId: 'doc:B', status: 'CURRENT', revision: 0,
    items: Object.freeze([Object.freeze({ differenceId: 'difference:A', note: '', noteHash: 'empty' })]),
    events: Object.freeze([]), validation: Object.freeze({ status: 'READY', errors: Object.freeze([]) }),
  });
  const decision = Object.freeze({
    schema: 'AmbiguityDecisionLedger.v1', ledgerId: 'ledger:audit:1', auditId: 'audit:1', basisId: 'basis:1',
    revADocumentId: 'doc:A', revBDocumentId: 'doc:B', status: 'CURRENT', revision: 0,
    decisions: Object.freeze([]), events: Object.freeze([]), selectedPairEvidence: Object.freeze([]),
    validation: Object.freeze({ status: 'READY', errors: Object.freeze([]) }),
  });
  const state = {
    session: Object.freeze({ schema: 'RevisionSession.v1', sessionId: 'revision-session-test' }),
    slots: Object.freeze({ baseline: slot('baseline', 'REV_A', 'doc:A'), candidate: slot('candidate', 'REV_B', 'doc:B') }),
    proposal: Object.freeze({ proposalId: 'proposal:1', summary: Object.freeze({ includedBranchCountA: 1, includedBranchCountB: 1 }) }),
    basisStatus: 'CURRENT',
    basis: Object.freeze({ schema: 'RevisionComparisonBasis.v1', basisId: 'basis:1', sessionId: 'revision-session-test', revADocumentId: 'doc:A', revBDocumentId: 'doc:B' }),
    compare: Object.freeze({ audit, viewerBackend: 'SVG', presentationMode: 'overlay', selectedDifferenceId: 'difference:A', queue: Object.freeze({ search: 'ignored' }) }),
    review: Object.freeze({ session: review, filters: Object.freeze({ search: 'ignored' }) }),
    decision: Object.freeze({ ledger: decision, preview: Object.freeze({ candidateIndex: 7 }) }),
    rawUploadedBytes: new Uint8Array([1, 2, 3]), fileHandle: Object.freeze({ name: 'ignored' }),
    ...overrides,
  };
  return Object.freeze(state);
}
function replace(state, key, value) { return Object.freeze({ ...state, [key]: Object.freeze({ ...state[key], ...value }) }); }

const state = authorityState();
const before = structuredClone(state);
assert.deepEqual(revisionCompareEvidencePackageReadiness(state), { status: 'READY', blockers: [] });
const artifact = await createRevisionCompareEvidencePackage(state, preflight, webcrypto);
const text = serializeRevisionCompareEvidencePackage(artifact);
assert.equal(artifact.schema, REVISION_COMPARE_EVIDENCE_PACKAGE_SCHEMA);
assert.match(artifact.contentSha256, /^[0-9a-f]{64}$/);
assert.equal(artifact.packageId, `revision-evidence-package:${artifact.contentSha256}`);
assert.equal(text.endsWith('\n'), true); assert.equal(text.endsWith('\n\n'), false);
assert.equal(revisionCompareEvidencePackageFileName(state.session.sessionId), 'revision-session-test.evidence-package.json');
assert.deepEqual(artifact.payload.sessionManifest, createRevisionSessionManifest(state, preflight));
assert.deepEqual(artifact.payload.scopeBasisManifest, createRevisionScopeManifest(state, preflight));
assert.deepEqual(artifact.payload.audit, state.compare.audit);
assert.deepEqual(artifact.payload.reviewSession, createReviewSessionExport(state.review.session));
assert.deepEqual(artifact.payload.decisionLedger, createDecisionLedgerExport(state.decision.ledger));
assert.deepEqual(artifact.payload.audit.differenceRows.map((row) => row.differenceId), ['difference:B', 'difference:A']);
assert.deepEqual(state, before, 'package creation must not mutate authority input');
const expectedHash = await sha256Text(JSON.stringify(_test.hashMaterial(state, artifact.payload)), webcrypto);
assert.equal(artifact.contentSha256, expectedHash);

const repeated = await createRevisionCompareEvidencePackage(state, preflight, webcrypto);
assert.equal(serializeRevisionCompareEvidencePackage(repeated), text);
const uiOnly = authorityState({
  compare: Object.freeze({ ...state.compare, viewerBackend: 'WEBGL', presentationMode: 'side-by-side', selectedDifferenceId: 'difference:B', queue: Object.freeze({ search: 'changed' }) }),
  review: Object.freeze({ ...state.review, filters: Object.freeze({ search: 'changed' }) }),
});
assert.equal(serializeRevisionCompareEvidencePackage(await createRevisionCompareEvidencePackage(uiOnly, preflight, webcrypto)), text);
const parsed = JSON.parse(text);
for (const forbidden of ['viewerBackend', 'presentationMode', 'selectedDifferenceId', 'rawUploadedBytes', 'fileHandle', 'viewport', 'fitCounts', 'blobUrl']) {
  assert.equal(JSON.stringify(parsed).includes(`"${forbidden}"`), false, `${forbidden} must be excluded`);
}

const reviewChanged = replace(state, 'review', { session: Object.freeze({
  ...state.review.session, revision: 1,
  items: Object.freeze([Object.freeze({ differenceId: 'difference:A', note: 'real note', noteHash: 'note-hash' })]),
}) });
const reviewArtifact = await createRevisionCompareEvidencePackage(reviewChanged, preflight, webcrypto);
assert.notEqual(reviewArtifact.contentSha256, artifact.contentSha256);
assert.deepEqual(reviewArtifact.payload.audit, artifact.payload.audit);
const decisionChanged = replace(state, 'decision', { ledger: Object.freeze({
  ...state.decision.ledger, revision: 1,
  events: Object.freeze([Object.freeze({ eventId: 'decision:event:1', rationale: 'retain evidence' })]),
}) });
const decisionArtifact = await createRevisionCompareEvidencePackage(decisionChanged, preflight, webcrypto);
assert.notEqual(decisionArtifact.contentSha256, artifact.contentSha256);
assert.deepEqual(decisionArtifact.payload.audit, artifact.payload.audit);

const sessionMismatch = Object.freeze({
  ...state,
  basis: Object.freeze({ ...state.basis, sessionId: 'revision-session-other' }),
});
const sessionReadiness = revisionCompareEvidencePackageReadiness(sessionMismatch);
assert.equal(sessionReadiness.status, 'BLOCKED');
assert.deepEqual(sessionReadiness.blockers, ['The comparison basis does not belong to the current revision session.']);
await assert.rejects(
  () => createRevisionCompareEvidencePackage(sessionMismatch, preflight, webcrypto),
  /does not belong to the current revision session/,
);

const missingSlots = Object.freeze({ ...state, slots: Object.freeze({ baseline: state.slots.baseline }) });
assert.equal(revisionCompareEvidencePackageReadiness(missingSlots).status, 'BLOCKED');
await assert.rejects(() => createRevisionCompareEvidencePackage(missingSlots, preflight, webcrypto));

for (const [label, blocked] of [
  ['basis', Object.freeze({ ...state, basisStatus: 'STALE' })],
  ['audit', replace(state, 'compare', { audit: Object.freeze({ ...state.compare.audit, validation: Object.freeze({ status: 'INVALID', errors: Object.freeze(['bad']) }) }) })],
  ['review', replace(state, 'review', { session: Object.freeze({ ...state.review.session, auditId: 'audit:other' }) })],
  ['decision', replace(state, 'decision', { ledger: Object.freeze({ ...state.decision.ledger, basisId: 'basis:other' }) })],
]) {
  assert.equal(revisionCompareEvidencePackageReadiness(blocked).status, 'BLOCKED', `${label} mismatch must block`);
  await assert.rejects(() => createRevisionCompareEvidencePackage(blocked, preflight, webcrypto));
}
assert.throws(() => _test.canonicalPlain(new Map([['x', 1]])), /plain object/);
assert.throws(() => _test.canonicalPlain({ x: undefined }), /not JSON-safe/);
assert.doesNotMatch(text, /approved|signed|final|complete/i);
console.log('revision-compare-evidence-package.test.mjs passed');
