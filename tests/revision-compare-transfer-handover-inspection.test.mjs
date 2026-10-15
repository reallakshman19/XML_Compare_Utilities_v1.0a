import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sha256Text } from '../tabs/revision-compare/revision-hash.js';
import { stableStringify } from '../tabs/revision-compare/revision-contract-utils.js';
import { canonicalRevisionCompareEvidenceValue, revisionCompareEvidencePackageHashMaterial } from '../tabs/revision-compare/revision-evidence-package.js';
import { createReviewSession, setReviewItemNote } from '../tabs/revision-compare/revision-review-session.js';
import { revisionCompareTransferHandoverHashMaterial, serializeRevisionCompareTransferHandoverBundle } from '../tabs/revision-compare/revision-transfer-handover.js';
import { verifyRevisionCompareTransferHandoverText } from '../tabs/revision-compare/revision-transfer-handover-inspection.js';
import { clone, createdAt, cryptoRef, handoverInspectionFixture } from './revision-compare-transfer-handover-inspection-fixtures.mjs';

const fixture = await handoverInspectionFixture();
const text = serializeRevisionCompareTransferHandoverBundle(fixture.bundle);
function materialWithout(value, keys) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
}
async function identity(value, idKey, prefix) {
  delete value[idKey]; delete value.contentSha256;
  value.contentSha256 = await sha256Text(stableStringify(value), cryptoRef);
  value[idKey] = `${prefix}${value.contentSha256}`;
}
async function operationIdentity(operation) {
  operation.operationId = `revision-transfer-operation:${await sha256Text(
    stableStringify(materialWithout(operation, ['operationId', 'status', 'blockers'])), cryptoRef,
  )}`;
}
async function completionIdentity(report) {
  delete report.reportId; delete report.contentSha256;
  const material = canonicalRevisionCompareEvidenceValue(report);
  report.contentSha256 = await sha256Text(JSON.stringify(material), cryptoRef);
  report.reportId = `revision-transfer-completion:${report.contentSha256}`;
}
async function packageIdentity(value) {
  value.contentSha256 = await sha256Text(JSON.stringify(revisionCompareEvidencePackageHashMaterial(value)), cryptoRef);
  value.packageId = `revision-evidence-package:${value.contentSha256}`;
}
async function bundleIdentity(bundle) {
  delete bundle.bundleId; delete bundle.contentSha256;
  bundle.contentSha256 = await sha256Text(JSON.stringify(revisionCompareTransferHandoverHashMaterial(bundle)), cryptoRef);
  bundle.bundleId = `revision-transfer-handover:${bundle.contentSha256}`;
}
async function rejects(mutate, pattern) {
  const value = clone(fixture.bundle); await mutate(value); await bundleIdentity(value);
  await assert.rejects(() => verifyRevisionCompareTransferHandoverText(
    serializeRevisionCompareTransferHandoverBundle(value), { cryptoRef },
  ), pattern);
}
function reference(item) {
  return { filename: item.filename, schema: item.schema, mimeType: item.mimeType,
    contentSha256: item.contentSha256, sizeBytes: item.sizeBytes };
}
function descriptor(item) { return { descriptorSchema: item.descriptorSchema, ...reference(item) }; }
async function refreshArtifactEnvelope(bundle) {
  const artifacts = bundle.payload.transferArtifacts; const manifest = bundle.payload.transferManifest;
  manifest.artifacts = artifacts.slice(0, 3).map(reference);
  await identity(manifest, 'manifestId', 'revision-transfer-manifest:');
  artifacts[3].text = `${JSON.stringify(manifest, null, 2)}\n`;
  artifacts[3].contentSha256 = await sha256Text(artifacts[3].text, cryptoRef);
  artifacts[3].sizeBytes = new TextEncoder().encode(artifacts[3].text).byteLength;
  const report = bundle.payload.completionReport;
  report.transferEvidence.transferManifestContentSha256 = manifest.contentSha256;
  report.transferEvidence.artifactDescriptors = artifacts.map(descriptor);
  await completionIdentity(report); bundle.identity.completionReportId = report.reportId;
}

const verified = await verifyRevisionCompareTransferHandoverText(text, { cryptoRef });
assert.equal(verified.bundleId, fixture.bundle.bundleId);
assert.equal(Object.isFrozen(verified), true);
assert.equal(Object.isFrozen(verified.payload.transferArtifacts[0]), true);
const isolated = clone(fixture.bundle); const isolatedText = serializeRevisionCompareTransferHandoverBundle(isolated);
const isolatedVerified = await verifyRevisionCompareTransferHandoverText(isolatedText, { cryptoRef });
isolated.payload.transferPlan.status = 'BLOCKED'; assert.equal(isolatedVerified.payload.transferPlan.status, 'READY');

await assert.rejects(() => verifyRevisionCompareTransferHandoverText(` ${text}`, { cryptoRef }), /canonical serialization/);
await assert.rejects(() => verifyRevisionCompareTransferHandoverText(text.slice(0, -1), { cryptoRef }), /canonical serialization/);
await assert.rejects(() => verifyRevisionCompareTransferHandoverText('{bad', { cryptoRef }), /JSON is invalid/);
await assert.rejects(() => verifyRevisionCompareTransferHandoverText(`${JSON.stringify({ schema: 'Wrong.v1' })}\n`, { cryptoRef }), /HandoverBundle/);
const brokenBundleIdentity = clone(fixture.bundle); brokenBundleIdentity.bundleId = 'revision-transfer-handover:bad';
await assert.rejects(() => verifyRevisionCompareTransferHandoverText(
  serializeRevisionCompareTransferHandoverBundle(brokenBundleIdentity), { cryptoRef },
), /identity does not recompute/);
await rejects(async (value) => {
  const audit = value.payload.evidencePackage.payload.audit;
  let review = createReviewSession(audit, createdAt);
  review = await setReviewItemNote(review, audit, audit.differenceRows[0].differenceId, 'Still unreviewed', createdAt, cryptoRef);
  value.payload.evidencePackage.payload.reviewSession = review;
  await packageIdentity(value.payload.evidencePackage);
}, /fully reviewed and resolved/i);
await rejects(async (value) => {
  value.payload.transferPlan.status = 'BLOCKED';
  await identity(value.payload.transferPlan, 'planId', 'revision-transfer-plan:');
}, /plan must be READY/i);
await rejects(async (value) => {
  value.payload.transferPlan.activity.comparisonStatus = 'IDLE';
  await identity(value.payload.transferPlan, 'planId', 'revision-transfer-plan:');
}, /packaged source authorities/i);
await rejects(async (value) => {
  const operation = value.payload.transferPlan.operations[0];
  operation.evidenceReferences.reviewRevision += 1; await operationIdentity(operation);
  await identity(value.payload.transferPlan, 'planId', 'revision-transfer-plan:');
}, /operation evidence authority/i);
await rejects(async (value) => {
  const operation = value.payload.transferPlan.operations[0];
  operation.transferPolicy.ruleId = 'ALLOW_UNVERIFIED'; await operationIdentity(operation);
  await identity(value.payload.transferPlan, 'planId', 'revision-transfer-plan:');
}, /policy evidence.*governing field-policy/i);
await rejects(async (value) => {
  const plan = value.payload.transferPlan;
  plan.selection.items[0].fields[0].unsupported = true;
  await identity(plan, 'planId', 'revision-transfer-plan:');
}, /Transfer selection field.*unsupported or missing fields/i);
await rejects(async (value) => {
  const operation = value.payload.transferPlan.operations[0];
  operation.targetAddress.unsupported = true; await operationIdentity(operation);
  await identity(value.payload.transferPlan, 'planId', 'revision-transfer-plan:');
}, /Transfer operation 0 address.*unsupported or missing fields/i);
await rejects(async (value) => {
  const operation = value.payload.transferPlan.operations[0];
  delete operation.evidenceReferences.decisionEventId; await operationIdentity(operation);
  await identity(value.payload.transferPlan, 'planId', 'revision-transfer-plan:');
}, /Transfer operation 0 evidence references.*unsupported or missing fields/i);
await rejects(async (value) => {
  const operation = value.payload.transferPlan.operations[0];
  operation.targetAddress.expectedCurrentValue = 'wrong'; await operationIdentity(operation);
  await identity(value.payload.transferPlan, 'planId', 'revision-transfer-plan:');
}, /expected target value/i);
await rejects(async (value) => {
  value.payload.transferPlan.operations[0].operationId = 'revision-transfer-operation:bad';
  await identity(value.payload.transferPlan, 'planId', 'revision-transfer-plan:');
}, /operation.*identity/i);
await rejects(async (value) => {
  value.payload.transferPlan.operations.reverse();
  await identity(value.payload.transferPlan, 'planId', 'revision-transfer-plan:');
}, /result.*deterministic|operation/i);
await rejects(async (value) => {
  value.payload.transferResult.summary.appliedOperationCount -= 1;
  await identity(value.payload.transferResult, 'resultId', 'revision-transfer-result:');
}, /deterministic result/i);
await rejects(async (value) => {
  value.payload.transferAudit.rows[0].actualValue = 'wrong';
  await identity(value.payload.transferAudit, 'auditId', 'revision-transfer-audit:');
}, /audit does not reconcile/i);
await rejects(async (value) => {
  delete value.payload.transferProof.invariants.objectKeyOrderPreserved;
  await identity(value.payload.transferProof, 'proofId', 'revision-transfer-proof:');
}, /invariants.*missing/i);
await rejects(async (value) => {
  value.payload.transferProof.invariants.objectKeyOrderPreserved = false;
  await identity(value.payload.transferProof, 'proofId', 'revision-transfer-proof:');
}, /invariant.*true/i);
await rejects(async (value) => {
  value.payload.transferProof.actualChanges[0].path = '/wrong';
  await identity(value.payload.transferProof, 'proofId', 'revision-transfer-proof:');
}, /proof does not reconcile/i);
await rejects(async (value) => {
  value.payload.transferManifest.resultId = 'revision-transfer-result:other';
  await identity(value.payload.transferManifest, 'manifestId', 'revision-transfer-manifest:');
}, /creation identity|manifest/i);
await rejects(async (value) => {
  value.payload.completionReport.declaration.statement = 'Changed';
  await completionIdentity(value.payload.completionReport);
  value.identity.completionReportId = value.payload.completionReport.reportId;
}, /fixed statements|declaration/i);
await rejects(async (value) => {
  value.payload.completionReport.declaration.declarantName = ' Lakshman ';
  await completionIdentity(value.payload.completionReport);
  value.identity.completionReportId = value.payload.completionReport.reportId;
}, /declarant fields.*normalized/i);
await rejects(async (value) => {
  value.payload.transferResult.planId = 'revision-transfer-plan:other';
  await identity(value.payload.transferResult, 'resultId', 'revision-transfer-result:');
}, /deterministic result|reconcile/i);
await rejects((value) => { value.payload.transferArtifacts.pop(); }, /Exactly four/);
await rejects((value) => { value.payload.transferArtifacts[0].mimeType = 'text/plain'; }, /PATCHED_TARGET artifact descriptor/);
await rejects((value) => { value.payload.transferArtifacts[1].schema = 'RevisionCompareTransferProof.v1'; }, /TRANSFER_AUDIT artifact descriptor/);
await rejects((value) => { value.payload.transferArtifacts[2].text += ' '; }, /TRANSFER_PROOF artifact SHA-256/);
await rejects((value) => { value.payload.transferArtifacts[3].sizeBytes += 1; }, /TRANSFER_MANIFEST artifact UTF-8 size/);
await rejects((value) => { value.payload.transferArtifacts[0].text = '{}\n'; }, /PATCHED_TARGET artifact SHA-256/);
await rejects(async (value) => {
  const item = value.payload.transferArtifacts[1]; item.text = JSON.stringify(value.payload.transferAudit);
  item.contentSha256 = await sha256Text(item.text, cryptoRef);
  item.sizeBytes = new TextEncoder().encode(item.text).byteLength;
  await refreshArtifactEnvelope(value);
}, /manifest does not equal|governing retained bytes/);
await rejects(async (value) => {
  value.payload.completionReport.transferEvidence.artifactDescriptors[0].sizeBytes += 1;
  await completionIdentity(value.payload.completionReport);
  value.identity.completionReportId = value.payload.completionReport.reportId;
}, /artifact descriptors/);

const multiple = clone(fixture.bundle);
multiple.payload.transferResult.summary.blockedOperationCount = 1;
multiple.payload.transferArtifacts[0].text += ' ';
await bundleIdentity(multiple);
await assert.rejects(() => verifyRevisionCompareTransferHandoverText(
  serializeRevisionCompareTransferHandoverBundle(multiple), { cryptoRef },
), /deterministic result/);

const productionFiles = [
  'revision-transfer-handover-inspection.js',
  'revision-transfer-handover-inspection-state.js',
  'revision-transfer-handover-inspection-workspace-state.js',
  'revision-transfer-handover-inspection-view.js',
  'revision-transfer-handover-inspection-controller.js',
  'revision-transfer-workspace-bindings.js',
];
for (const name of productionFiles) {
  const source = await readFile(new URL(`../tabs/revision-compare/${name}`, import.meta.url), 'utf8');
  assert.ok(source.split(/\r?\n/).length - 1 < 300, `${name} must remain below 300 physical lines`);
  assert.doesNotMatch(source, /export\s+default/);
  assert.doesNotMatch(source, /export\s+(?:const|let|var|function|class)\s+_test\b/);
  assert.doesNotMatch(source, /import\s+(?:\{[^}]*\b_test\b[^}]*\}|\*\s+as\s+_test)\s+from/);
}
const viewSource = await readFile(new URL('../tabs/revision-compare/revision-transfer-handover-inspection-view.js', import.meta.url), 'utf8');
assert.doesNotMatch(viewSource, /innerHTML|insertAdjacentHTML/);
console.log('revision-compare-transfer-handover-inspection.test.mjs passed');