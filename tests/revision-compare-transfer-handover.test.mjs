import assert from 'node:assert/strict';
import { createRevisionCompareTransferCompletionReport } from '../tabs/revision-compare/revision-transfer-completion.js';
import {
  REVISION_COMPARE_TRANSFER_HANDOVER_BUNDLE_SCHEMA, createRevisionCompareTransferHandoverBundle,
  revisionCompareTransferHandoverHashMaterial, serializeRevisionCompareTransferHandoverBundle,
  validateRevisionCompareTransferHandoverBundleIdentity,
} from '../tabs/revision-compare/revision-transfer-handover.js';
import { sha256Text } from '../tabs/revision-compare/revision-hash.js';
import { completionFixture, cryptoRef, declaredAt } from './revision-compare-transfer-completion-fixtures.mjs';

const fixture = await completionFixture();
const report = await createRevisionCompareTransferCompletionReport(fixture.workspace, fixture.evidencePackage, fixture.input, declaredAt, fixture.options);
const before = structuredClone(fixture.workspace);
const bundle = await createRevisionCompareTransferHandoverBundle({ workspace: fixture.workspace, evidencePackage: fixture.evidencePackage, report }, { cryptoRef });
assert.equal(bundle.schema, REVISION_COMPARE_TRANSFER_HANDOVER_BUNDLE_SCHEMA);
assert.equal(bundle.bundleId, `revision-transfer-handover:${bundle.contentSha256}`);
assert.equal(bundle.payload.evidencePackage.packageId, fixture.evidencePackage.packageId);
assert.equal(bundle.payload.transferPlan.planId, fixture.workspace.transfer.plan.planId);
assert.equal(bundle.payload.transferResult.resultId, fixture.workspace.transfer.result.resultId);
assert.equal(bundle.payload.transferArtifacts.length, 4);
assert.equal(bundle.payload.completionReport.reportId, report.reportId);
assert.equal(Object.isFrozen(bundle.payload.transferArtifacts[0]), true);
assert.deepEqual(fixture.workspace, before, 'handover creation must not mutate authorities');
await validateRevisionCompareTransferHandoverBundleIdentity(bundle, cryptoRef);
assert.equal(bundle.contentSha256, await sha256Text(JSON.stringify(revisionCompareTransferHandoverHashMaterial(bundle)), cryptoRef));
const text = serializeRevisionCompareTransferHandoverBundle(bundle);
assert.equal(serializeRevisionCompareTransferHandoverBundle(bundle), text);
assert.equal(text.endsWith('\n'), true); assert.equal(text.endsWith('\n\n'), false);
for (const forbidden of ['viewerRuntime', 'presentationMode', 'queue', 'search', 'Blob URL', 'CryptoKey', 'externalUrl']) assert.equal(text.includes(forbidden), false, `${forbidden} excluded`);
assert.equal(bundle.payload.transferArtifacts[0].text, fixture.workspace.transfer.result.patchedTargetText);
console.log('revision-compare-transfer-handover.test.mjs passed');
