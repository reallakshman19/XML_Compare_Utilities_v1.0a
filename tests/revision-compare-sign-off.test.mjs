import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  REVISION_COMPARE_SIGN_OFF_DECLARATION, REVISION_COMPARE_SIGN_OFF_REPORT_SCHEMA,
  REVISION_COMPARE_SIGN_OFF_STATE_SCHEMA, REVISION_COMPARE_SIGN_OFF_TRUST_STATEMENT,
  _test, createRevisionCompareSignOffReport, createRevisionCompareSignOffState,
  normalizeRevisionCompareSignOffDeclarant, revisionCompareSignOffFileName,
  revisionCompareSignOffReadiness, serializeRevisionCompareSignOffReport,
} from '../tabs/revision-compare/revision-sign-off.js';
import {
  REVISION_WORKSPACE_STATE_SCHEMA, failWorkspaceSignOff, setWorkspaceBasis,
  setWorkspaceDecisionLedger, setWorkspacePresentation, setWorkspaceQueueSearch,
  setWorkspaceReviewSession, setWorkspaceSignOffReport, setWorkspaceTransferSelection,
  setWorkspaceViewerBackend,
} from '../tabs/revision-compare/revision-workspace-state.js';
import { setWorkspaceTransferReviewDraft } from '../tabs/revision-compare/revision-transfer-review-workspace-state.js';
import { createRevisionCompareTransferReviewState, replaceRevisionCompareTransferDraft } from '../tabs/revision-compare/revision-transfer-review-state.js';
import { createRevisionCompareTransferSelection } from '../tabs/revision-compare/revision-transfer-contracts.js';
import { canonicalRevisionCompareEvidenceValue, createRevisionCompareEvidencePackage } from '../tabs/revision-compare/revision-evidence-package.js';
import { sha256Text } from '../tabs/revision-compare/revision-hash.js';
import { reviewSummary } from '../tabs/revision-compare/revision-review-contracts.js';
import { decisionSummary } from '../tabs/revision-compare/revision-decision-contracts.js';

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
function audit() {
  return Object.freeze({
    schema: 'RevisionCompareAudit.v1', auditId: 'audit:sign-off', basisId: 'basis:sign-off',
    revADocumentId: 'doc:A', revBDocumentId: 'doc:B', engineVersion: 'rc-engine:test',
    differenceRows: Object.freeze([
      Object.freeze({ differenceId: 'difference:review', differenceCategory: 'CHANGED', matchCertainty: 'CERTAIN' }),
      Object.freeze({ differenceId: 'difference:ambiguity', differenceCategory: 'CHANGED', matchCertainty: 'AMBIGUOUS' }),
    ]),
    candidateEvidence: Object.freeze([]), visualModels: Object.freeze({}), statusByObjectId: Object.freeze({}),
    validation: Object.freeze({ status: 'READY', errors: Object.freeze([]) }),
  });
}
function reviewRecord(auditValue, reviewState = 'REVIEWED', overrides = {}) {
  const items = Object.freeze(auditValue.differenceRows.map((row) => Object.freeze({
    schema: 'ReviewItemState.v1', differenceId: row.differenceId, reviewState, note: '',
    noteHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    firstReviewedAt: '2026-07-21T10:00:00.000Z', updatedAt: '2026-07-21T10:00:00.000Z', eventIds: Object.freeze([]),
  })));
  return Object.freeze({
    schema: 'ReviewSession.v1', reviewSessionId: `review-session:${auditValue.auditId}:v1`, auditId: auditValue.auditId,
    basisId: auditValue.basisId, revADocumentId: auditValue.revADocumentId, revBDocumentId: auditValue.revBDocumentId,
    status: 'CURRENT', revision: 2, createdAt: '2026-07-21T09:00:00.000Z', updatedAt: '2026-07-21T10:00:00.000Z',
    items, events: Object.freeze([]), summary: reviewSummary(items), validation: Object.freeze({ status: 'READY', errors: Object.freeze([]) }),
    ...overrides,
  });
}
function decisionRecord(auditValue, decisionState = 'CONFIRMED_NO_MATCH', overrides = {}) {
  const decisions = Object.freeze([Object.freeze({
    schema: 'AmbiguityDecisionItem.v1', differenceId: 'difference:ambiguity', sourceRecordId: 'source:1', candidateEvidenceId: null,
    decisionState, acceptedTargetRecordId: null, acceptedTargetDifferenceId: null, rationale: 'Resolved',
    rationaleHash: 'a'.repeat(64), activeEventId: 'decision:event:1', selectedPairEvidenceId: null,
    updatedAt: '2026-07-21T10:00:00.000Z', eventIds: Object.freeze(['decision:event:1']),
  })]);
  return Object.freeze({
    schema: 'AmbiguityDecisionLedger.v1', ledgerId: `ambiguity-ledger:${auditValue.auditId}:v1`, auditId: auditValue.auditId,
    basisId: auditValue.basisId, revADocumentId: auditValue.revADocumentId, revBDocumentId: auditValue.revBDocumentId,
    status: 'CURRENT', revision: 1, createdAt: '2026-07-21T09:00:00.000Z', updatedAt: '2026-07-21T10:00:00.000Z',
    decisions, events: Object.freeze([]), selectedPairEvidence: Object.freeze([]), summary: decisionSummary(decisions),
    validation: Object.freeze({ status: 'READY', errors: Object.freeze([]) }), ...overrides,
  });
}
function state(overrides = {}) {
  const auditValue = audit(); const review = reviewRecord(auditValue); const decision = decisionRecord(auditValue);
  return Object.freeze({
    schema: REVISION_WORKSPACE_STATE_SCHEMA,
    session: Object.freeze({ schema: 'ProjectSession.v1', sessionId: 'revision-session-sign-off', documents: Object.freeze({}) }),
    slots: Object.freeze({ baseline: slot('baseline', 'REV_A', 'doc:A'), candidate: slot('candidate', 'REV_B', 'doc:B') }),
    proposal: Object.freeze({ proposalId: 'proposal:1', summary: Object.freeze({ includedBranchCountA: 1, includedBranchCountB: 1 }) }),
    basisStatus: 'CURRENT', basis: Object.freeze({ schema: 'RevisionComparisonBasis.v1', basisId: auditValue.basisId, sessionId: 'revision-session-sign-off', revADocumentId: 'doc:A', revBDocumentId: 'doc:B' }),
    compare: Object.freeze({
      schema: 'RevisionCompareLifecycle.v1', status: 'COMPLETE', audit: auditValue, viewerBackend: 'SVG', presentationMode: 'overlay',
      selectedDifferenceId: 'difference:review', queue: Object.freeze({ categories: Object.freeze(['CHANGED']), needsDecisionOnly: false, changedReasons: Object.freeze([]), search: '' }),
      runGeneration: 1, runId: null, progress: null, auditBasisId: auditValue.basisId, error: null, reviewVisible: true,
      viewerPolicy: Object.freeze({ defaultBackend: 'SVG', defaultSvgPresentation: 'overlay', retainedBackends: Object.freeze(['SVG', 'WEBGL']), recoveryBackendForSvgFailure: 'WEBGL', recoveryBackendForWebglFailure: 'SVG', failoverMode: 'EXPLICIT_USER_ACTION', persistence: 'WORKSPACE_ONLY' }),
    }),
    review: Object.freeze({ session: review, filters: Object.freeze({ search: '', reviewStates: Object.freeze([]), certainties: Object.freeze([]) }) }),
    decision: Object.freeze({ ledger: decision, preview: Object.freeze({ differenceId: null, candidateIndex: 0 }) }),
    evidencePackageImport: Object.freeze({ schema: 'RevisionEvidencePackageImportState.v1', status: 'VERIFIED' }),
    signOff: createRevisionCompareSignOffState(), transferReview: createRevisionCompareTransferReviewState(),
    search: Object.freeze({ common: '', revAOnly: '', revBOnly: '' }),
    ...overrides,
  });
}
function replace(root, key, value) { return Object.freeze({ ...root, [key]: Object.freeze({ ...root[key], ...value }) }); }
function blocked(value, pattern) {
  const result = revisionCompareSignOffReadiness(value); assert.equal(result.status, 'BLOCKED');
  assert(result.blockers.some((item) => pattern.test(item)), `${pattern} not found in ${result.blockers.join(' | ')}`);
}

assert.equal(REVISION_WORKSPACE_STATE_SCHEMA, 'RevisionCompareWorkspaceState.v12');
assert.equal(REVISION_COMPARE_SIGN_OFF_STATE_SCHEMA, 'RevisionCompareSignOffState.v1');
assert.deepEqual(revisionCompareSignOffReadiness(state()), { status: 'READY', blockers: [] });
blocked(Object.freeze({ ...state(), basisStatus: 'STALE' }), /CURRENT comparison basis/);
blocked(replace(state(), 'compare', { audit: Object.freeze({ ...audit(), validation: Object.freeze({ status: 'BLOCKED', errors: Object.freeze(['x']) }) }) }), /READY RevisionCompareAudit/);
blocked(replace(state(), 'review', { session: reviewRecord(audit(), 'REVIEWED', { status: 'STALE' }) }), /CURRENT review session/);
blocked(replace(state(), 'decision', { ledger: decisionRecord(audit(), 'CONFIRMED_NO_MATCH', { status: 'STALE' }) }), /CURRENT decision ledger/);
for (const reviewState of ['UNREVIEWED', 'NEEDS_CLARIFICATION', 'UNRESOLVED']) blocked(replace(state(), 'review', { session: reviewRecord(audit(), reviewState) }), new RegExp(reviewState === 'UNREVIEWED' ? 'unreviewed' : reviewState === 'NEEDS_CLARIFICATION' ? 'clarification' : 'Unresolved', 'i'));
for (const decisionState of ['UNDECIDED', 'DEFERRED', 'REVOKED']) blocked(replace(state(), 'decision', { ledger: decisionRecord(audit(), decisionState) }), new RegExp(decisionState === 'UNDECIDED' ? 'undecided' : decisionState === 'DEFERRED' ? 'Deferred' : 'Revoked', 'i'));
assert.equal(revisionCompareSignOffReadiness(replace(state(), 'decision', { ledger: decisionRecord(audit(), 'ACCEPTED_CANDIDATE') })).status, 'READY');
assert.equal(revisionCompareSignOffReadiness(replace(state(), 'decision', { ledger: decisionRecord(audit(), 'CONFIRMED_NO_MATCH') })).status, 'READY');
assert.equal(revisionCompareSignOffReadiness(replace(state(), 'review', { session: Object.freeze({ ...reviewRecord(audit()), summary: Object.freeze({ ...reviewRecord(audit()).summary, reviewed: 0 }) }) })).status, 'BLOCKED');
blocked(replace(state(), 'slots', { baseline: Object.freeze({ ...state().slots.baseline, status: 'LOADING' }) }), /source loading/);
blocked(replace(state(), 'compare', { status: 'COMPARING' }), /comparison run/);
blocked(replace(state(), 'evidencePackageImport', { status: 'IMPORTING' }), /import verification/);

assert.deepEqual(normalizeRevisionCompareSignOffDeclarant({ declarantName: '  A  ', declarantRole: '  Engineer ', organization: '  Org ' }), { declarantName: 'A', declarantRole: 'Engineer', organization: 'Org' });
assert.throws(() => normalizeRevisionCompareSignOffDeclarant({ declarantName: '', declarantRole: 'Role' }), /Declarant name/);
assert.throws(() => normalizeRevisionCompareSignOffDeclarant({ declarantName: 'A', declarantRole: 'R'.repeat(121) }), /120/);
assert.throws(() => normalizeRevisionCompareSignOffDeclarant({ declarantName: 'A', declarantRole: 'R', organization: 'O'.repeat(161) }), /160/);

const authority = state(); const before = structuredClone(authority); const declaredAt = '2026-07-21T11:22:33.000Z';
const report = await createRevisionCompareSignOffReport(authority, preflight, {
  declarantName: '  Lakshman  ', declarantRole: ' Reviewer ', organization: ' Example Org ',
  statement: 'caller override', trustBoundary: 'caller override',
}, declaredAt, webcrypto);
assert.equal(report.schema, REVISION_COMPARE_SIGN_OFF_REPORT_SCHEMA);
assert.equal(report.declaration.statement, REVISION_COMPARE_SIGN_OFF_DECLARATION);
assert.equal(report.trustBoundary.statement, REVISION_COMPARE_SIGN_OFF_TRUST_STATEMENT);
assert.equal(report.declaration.declarantName, 'Lakshman'); assert.equal(report.declaration.declarantRole, 'Reviewer');
assert.equal(report.declaration.organization, 'Example Org'); assert.equal(report.declaration.declaredAt, declaredAt);
assert.equal(report.reportId, `revision-sign-off:${report.contentSha256}`); assert.match(report.contentSha256, /^[a-f0-9]{64}$/);
const evidencePackage = await createRevisionCompareEvidencePackage(authority, preflight, webcrypto);
assert.equal(report.sourceEvidence.packageId, evidencePackage.packageId); assert.equal(report.sourceEvidence.packageContentSha256, evidencePackage.contentSha256);
assert.equal(report.sourceEvidence.reviewRevision, authority.review.session.revision); assert.equal(report.sourceEvidence.decisionRevision, authority.decision.ledger.revision);
for (const key of ['sessionId', 'basisId', 'auditId', 'reviewSessionId', 'decisionLedgerId', 'revADocumentId', 'revBDocumentId', 'engineVersion']) assert.equal(report.sourceEvidence[key], evidencePackage.identity[key]);
const reportJson = JSON.stringify(report);
for (const forbidden of ['payload', 'differenceRows', 'visualModels', 'selectedPairEvidence', 'rawUploadedBytes']) assert.equal(reportJson.includes(forbidden), false, `${forbidden} excluded`);
assert.deepEqual(authority, before, 'creation must not mutate authorities');
const material = _test.reportMaterial(evidencePackage, normalizeRevisionCompareSignOffDeclarant({ declarantName: 'Lakshman', declarantRole: 'Reviewer', organization: 'Example Org' }), declaredAt);
const expectedHash = await sha256Text(JSON.stringify(canonicalRevisionCompareEvidenceValue(material)), webcrypto);
assert.equal(report.contentSha256, expectedHash);
const bytes = serializeRevisionCompareSignOffReport(report); assert.equal(bytes.endsWith('\n'), true); assert.equal(bytes.endsWith('\n\n'), false);
assert.equal(serializeRevisionCompareSignOffReport(report), bytes);
assert.equal(revisionCompareSignOffFileName(authority.session.sessionId, report.reportId), `revision-session-sign-off.revision-sign-off_${report.contentSha256}.json`);

let withReport = setWorkspaceSignOffReport(authority, report); const immutableHistorical = withReport.signOff.report;
withReport = setWorkspacePresentation(withReport, 'side-by-side'); assert.equal(withReport.signOff.status, 'CREATED');
withReport = setWorkspaceViewerBackend(withReport, 'WEBGL'); assert.equal(withReport.signOff.status, 'CREATED');
withReport = setWorkspaceQueueSearch(withReport, 'filter'); assert.equal(withReport.signOff.status, 'CREATED');
const changedReview = Object.freeze({ ...withReport.review.session, revision: withReport.review.session.revision + 1 });
let stale = setWorkspaceReviewSession(withReport, changedReview); assert.equal(stale.signOff.status, 'STALE'); assert.equal(stale.signOff.report, immutableHistorical);
assert.equal(Object.isFrozen(stale.signOff.report), true);
const changedDecision = Object.freeze({ ...authority.decision.ledger, revision: authority.decision.ledger.revision + 1 });
stale = setWorkspaceDecisionLedger(setWorkspaceSignOffReport(authority, report), changedDecision); assert.equal(stale.signOff.status, 'STALE');
stale = setWorkspaceBasis(setWorkspaceSignOffReport(authority, report), Object.freeze({ ...authority.basis, basisId: 'basis:new' })); assert.equal(stale.signOff.status, 'STALE');
const selection = createRevisionCompareTransferSelection({ selectionRevision: 1, items: [{
  differenceId: 'difference:review', sourceRecordId: 'source:1', targetRecordId: 'target:1',
  fields: [{ propertyKey: 'description', revAEvidencePath: '$.description', revBEvidencePath: '$.description', targetFieldPath: '/description' }],
}] });
stale = setWorkspaceTransferSelection(setWorkspaceSignOffReport(authority, report), selection);
assert.equal(stale.signOff.status, 'STALE'); assert.equal(stale.signOff.report, report);
blocked(stale, /does not cover transfer intent/);
const pairOnlyDraft = Object.freeze({ revision: 1, pairs: Object.freeze([Object.freeze({ differenceId: 'difference:review', fieldKeys: Object.freeze([]) })]) });
const pairOnlyReview = replaceRevisionCompareTransferDraft(authority.transferReview, pairOnlyDraft);
stale = setWorkspaceTransferReviewDraft(setWorkspaceSignOffReport(authority, report), pairOnlyReview, null);
assert.equal(stale.signOff.status, 'STALE'); blocked(stale, /does not cover transfer intent/);
const failed = failWorkspaceSignOff(setWorkspaceSignOffReport(authority, report), new Error('failure')); assert.equal(failed.signOff.status, 'FAILED'); assert.equal(failed.signOff.report, report);
const later = await createRevisionCompareSignOffReport(replace(authority, 'review', { session: Object.freeze({ ...authority.review.session, revision: 3 }) }), preflight, { declarantName: 'Lakshman', declarantRole: 'Reviewer' }, '2026-07-21T12:22:33.000Z', webcrypto);
assert.notEqual(later.reportId, report.reportId); assert.deepEqual(authority.compare.audit, before.compare.audit);
assert.equal(state().evidencePackageImport.status, 'VERIFIED');
assert.doesNotMatch(bytes, /authenticated|digitally signed|externally certified|organization-approved|engineering-approved|accepted for construction|final design authority/i);
console.log('revision-compare-sign-off.test.mjs passed');
