import assert from 'node:assert/strict';
import { createRevisionCompareTransferArtifacts } from '../tabs/revision-compare/revision-transfer-artifacts.js';
import { sha256Text } from '../tabs/revision-compare/revision-hash.js';
import { createRevisionCompareTransferApplication } from '../tabs/revision-compare/revision-transfer-result.js';
import { createdAt, workspaceFixture } from './revision-compare-transfer-apply-fixtures.mjs';

const workspace = await workspaceFixture({ fileName: ' Target / Rev B (Issued).JSON ' });
const first = await createRevisionCompareTransferApplication(workspace, { createdAt });
const second = await createRevisionCompareTransferApplication(workspace, { createdAt });
assert.deepEqual(second, first);
assert.equal(first.artifacts.length, 4);
assert.deepEqual(first.artifacts.map((artifact) => artifact.filename), [
  'target_rev_b_issued_patched_target.json',
  'target_rev_b_issued_transfer_audit.json',
  'target_rev_b_issued_transfer_proof.json',
  'target_rev_b_issued_transfer_manifest.json',
]);
for (const artifact of first.artifacts) {
  assert.equal(artifact.mimeType, 'application/json');
  assert.equal(artifact.text.endsWith('\n'), true);
  assert.equal(artifact.text.endsWith('\n\n'), false);
  assert.equal(artifact.contentSha256, await sha256Text(artifact.text, globalThis.crypto));
  assert.equal(artifact.sizeBytes, new TextEncoder().encode(artifact.text).byteLength);
  assert.match(artifact.contentSha256, /^[a-f0-9]{64}$/);
}
assert.equal(first.artifacts[0].text, first.result.patchedTargetText);
assert.equal(first.manifest.schema, 'RevisionCompareTransferManifest.v1');
assert.equal(first.manifest.artifacts.length, 3);
for (let index = 0; index < first.manifest.artifacts.length; index += 1) {
  const reference = first.manifest.artifacts[index]; const artifact = first.artifacts[index];
  assert.equal(Object.hasOwn(reference, 'text'), false, 'manifest must not embed artifact payload text');
  assert.deepEqual(reference, {
    filename: artifact.filename, schema: artifact.schema, mimeType: artifact.mimeType,
    contentSha256: artifact.contentSha256, sizeBytes: artifact.sizeBytes,
  });
}
assert.equal(first.manifest.manifestArtifact.filename, first.artifacts[3].filename);
assert.equal(first.manifest.manifestArtifact.schema, first.artifacts[3].schema);
assert.equal(first.manifest.manifestArtifact.contentHashPolicy, 'CANONICAL_MANIFEST_MATERIAL');
assert.equal(first.manifest.manifestArtifact.byteHashDescriptorSchema, 'RevisionCompareTransferArtifact.v1');
assert.equal(JSON.parse(first.artifacts[1].text).auditId, first.audit.auditId);
assert.equal(JSON.parse(first.artifacts[2].text).proofId, first.proof.proofId);
assert.equal(JSON.parse(first.artifacts[3].text).manifestId, first.manifest.manifestId);
assert.equal(first.artifacts[3].text.includes(first.result.patchedTargetText), false,
  'manifest artifact must not duplicate the complete patched target payload');

const regenerated = await createRevisionCompareTransferArtifacts({
  result: first.result, audit: first.audit, proof: first.proof,
  targetFileName: workspace.slots.candidate.jsonSnapshot.fileName,
  patchedSnapshot: first.patchedSnapshot,
});
assert.deepEqual(regenerated.manifest, first.manifest);
assert.deepEqual(regenerated.artifacts, first.artifacts);

const changedTime = await createRevisionCompareTransferApplication(workspace, {
  createdAt: '2026-07-24T13:45:01.000Z',
});
assert.notEqual(changedTime.result.resultId, first.result.resultId);
assert.notEqual(changedTime.manifest.manifestId, first.manifest.manifestId);
assert.equal(changedTime.result.patchedTargetText, first.result.patchedTargetText);

console.log('revision-compare-transfer-artifacts.test.mjs passed');