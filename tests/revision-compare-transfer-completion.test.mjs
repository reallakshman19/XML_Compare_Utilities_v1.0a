import assert from 'node:assert/strict';
import {
  REVISION_COMPARE_TRANSFER_COMPLETION_DECLARATION,
  REVISION_COMPARE_TRANSFER_COMPLETION_REPORT_SCHEMA,
  REVISION_COMPARE_TRANSFER_COMPLETION_TRUST_STATEMENT,
  createRevisionCompareTransferCompletionReport, normalizeRevisionCompareTransferCompletionDeclarant,
  revisionCompareTransferCompletionReadiness, serializeRevisionCompareTransferCompletionReport,
  validateRevisionCompareTransferCompletionReportIdentity,
} from '../tabs/revision-compare/revision-transfer-completion.js';
import { canonicalRevisionCompareEvidenceValue, revisionCompareEvidencePackageHashMaterial } from '../tabs/revision-compare/revision-evidence-package.js';
import { sha256Text } from '../tabs/revision-compare/revision-hash.js';
import { clone, completionFixture, cryptoRef, declaredAt, rehash } from './revision-compare-transfer-completion-fixtures.mjs';

const fixture = await completionFixture();
assert.equal(fixture.workspace.schema, 'RevisionCompareWorkspaceState.v12');
assert.deepEqual(revisionCompareTransferCompletionReadiness(fixture.workspace), { status: 'READY', blockers: [] });
function blocked(mutate, pattern) { const value = clone(fixture.workspace); mutate(value); const readiness = revisionCompareTransferCompletionReadiness(value); assert.equal(readiness.status, 'BLOCKED'); assert(readiness.blockers.some((item) => pattern.test(item)), readiness.blockers.join(' | ')); }
blocked((value) => { value.basisStatus = 'STALE'; }, /CURRENT comparison basis/);
blocked((value) => { value.review.session.status = 'STALE'; }, /CURRENT review/);
blocked((value) => { value.review.session.items[0].reviewState = 'UNREVIEWED'; }, /REVIEWED/);
blocked((value) => { value.decision.ledger.status = 'STALE'; }, /CURRENT decision/);
blocked((value) => { value.transfer.status = 'PLANNED'; }, /APPLIED/);
blocked((value) => { value.transfer.status = 'STALE'; }, /APPLIED/);
blocked((value) => { value.transfer.status = 'FAILED'; }, /APPLIED/);
blocked((value) => { value.transfer.proof.invariants.jsonReparseSucceeded = false; }, /every invariant/);
blocked((value) => { value.transfer.result.summary.skippedOperationCount = 1; }, /zero skipped/);
blocked((value) => { value.transfer.result.summary.blockedOperationCount = 1; }, /zero blocked/);
blocked((value) => { value.transfer.request = { generation: 1 }; }, /transfer-plan request/);
blocked((value) => { value.slots.candidate.status = 'LOADING'; }, /source loading/);

assert.deepEqual(normalizeRevisionCompareTransferCompletionDeclarant({ declarantName: ' A ', declarantRole: ' Engineer ', organization: ' Org ' }), { declarantName: 'A', declarantRole: 'Engineer', organization: 'Org' });
assert.throws(() => normalizeRevisionCompareTransferCompletionDeclarant({ declarantName: '', declarantRole: 'Engineer' }), /required/);
assert.throws(() => normalizeRevisionCompareTransferCompletionDeclarant({ declarantName: 'A', declarantRole: 'R'.repeat(121) }), /120/);
assert.throws(() => normalizeRevisionCompareTransferCompletionDeclarant({ declarantName: 'A', declarantRole: 'R', organization: 'O'.repeat(161) }), /160/);

const before = structuredClone(fixture.workspace);
const report = await createRevisionCompareTransferCompletionReport(fixture.workspace, fixture.evidencePackage, { ...fixture.input, statement: 'caller override' }, declaredAt, fixture.options);
assert.equal(report.schema, REVISION_COMPARE_TRANSFER_COMPLETION_REPORT_SCHEMA);
assert.equal(report.declaration.statement, REVISION_COMPARE_TRANSFER_COMPLETION_DECLARATION);
assert.equal(report.trustBoundary.statement, REVISION_COMPARE_TRANSFER_COMPLETION_TRUST_STATEMENT);
assert.equal(report.trustBoundary.identityStatus, 'SELF_DECLARED');
assert.equal(report.trustBoundary.authorityStatus, 'NOT_ESTABLISHED');
assert.equal(report.trustBoundary.authenticityStatus, 'NOT_ESTABLISHED');
assert.equal(report.declaration.declaredAt, declaredAt);
assert.equal(report.reportId, `revision-transfer-completion:${report.contentSha256}`);
assert.equal(report.transferEvidence.artifactDescriptors.length, 4);
assert.equal(report.transferEvidence.artifactDescriptors.some((item) => Object.hasOwn(item, 'text')), false);
assert.deepEqual(fixture.workspace, before, 'report creation must not mutate source authorities');
await validateRevisionCompareTransferCompletionReportIdentity(report, cryptoRef);
const material = canonicalRevisionCompareEvidenceValue(Object.fromEntries(Object.entries(report).filter(([key]) => !['reportId', 'contentSha256'].includes(key))));
assert.equal(report.contentSha256, await sha256Text(JSON.stringify(material), cryptoRef));
const text = serializeRevisionCompareTransferCompletionReport(report);
assert.equal(text.endsWith('\n'), true); assert.equal(text.endsWith('\n\n'), false); assert.equal(serializeRevisionCompareTransferCompletionReport(report), text);

async function rejectsTransfer(mutate, pattern) { const value = clone(fixture.workspace); await mutate(value); await assert.rejects(() => createRevisionCompareTransferCompletionReport(value, fixture.evidencePackage, fixture.input, declaredAt, fixture.options), pattern); }
await rejectsTransfer(async (value) => { value.transfer.result.planId = 'revision-transfer-plan:wrong'; await rehash(value.transfer.result, 'resultId', 'revision-transfer-result:'); }, /current plan identity/);
await rejectsTransfer(async (value) => { value.transfer.audit.planId = 'revision-transfer-plan:wrong'; await rehash(value.transfer.audit, 'auditId', 'revision-transfer-audit:'); }, /audit identity/);
await rejectsTransfer(async (value) => { value.transfer.proof.planId = 'revision-transfer-plan:wrong'; await rehash(value.transfer.proof, 'proofId', 'revision-transfer-proof:'); }, /proof identities/);
await rejectsTransfer(async (value) => { value.transfer.manifest.resultId = 'revision-transfer-result:wrong'; await rehash(value.transfer.manifest, 'manifestId', 'revision-transfer-manifest:'); }, /manifest identities/);
await rejectsTransfer(async (value) => { value.transfer.artifacts[0].text += ' '; }, /SHA-256 mismatch/);
await rejectsTransfer(async (value) => { value.transfer.artifacts[0].sizeBytes += 1; }, /byte-size mismatch/);
await rejectsTransfer(async (value) => { value.transfer.artifacts[0].text = '{}\n'; value.transfer.artifacts[0].contentSha256 = await sha256Text(value.transfer.artifacts[0].text, cryptoRef); value.transfer.artifacts[0].sizeBytes = 3; }, /Patched-target artifact/);
await rejectsTransfer(async (value) => { value.transfer.patchedSnapshot.sourceContentSha256 = 'f'.repeat(64); }, /patched-target identity/);
await rejectsTransfer(async (value) => { value.transfer.audit.rows[0].operationId = 'revision-transfer-operation:wrong'; await rehash(value.transfer.audit, 'auditId', 'revision-transfer-audit:'); }, /Operation IDs/);
await rejectsTransfer(async (value) => { value.transfer.proof.actualChanges[0].path = '/wrong'; await rehash(value.transfer.proof, 'proofId', 'revision-transfer-proof:'); }, /mutation coverage/);

const packageMismatch = clone(fixture.evidencePackage); packageMismatch.identity.sessionId = 'revision-session:wrong';
packageMismatch.contentSha256 = await sha256Text(JSON.stringify(revisionCompareEvidencePackageHashMaterial(packageMismatch)), cryptoRef);
packageMismatch.packageId = `revision-evidence-package:${packageMismatch.contentSha256}`;
await assert.rejects(() => createRevisionCompareTransferCompletionReport(fixture.workspace, packageMismatch, fixture.input, declaredAt, fixture.options), /workspace identities/);
assert.doesNotMatch(text, /engineering-approved|accepted for construction|organization-approved|certified|digitally signed by the application|legally non-repudiable/i);
console.log('revision-compare-transfer-completion.test.mjs passed');
