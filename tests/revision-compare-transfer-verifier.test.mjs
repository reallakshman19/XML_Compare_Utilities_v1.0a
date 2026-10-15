import assert from 'node:assert/strict';
import { createRevisionCompareJsonDocumentSnapshot } from '../tabs/revision-compare/revision-json-document.js';
import { sha256Text } from '../tabs/revision-compare/revision-hash.js';
import { verifyRevisionCompareTransferApplication } from '../tabs/revision-compare/revision-transfer-verifier.js';
import { writeRevisionComparePatchedTarget } from '../tabs/revision-compare/revision-transfer-writer.js';
import { createdAt, workspaceFixture } from './revision-compare-transfer-apply-fixtures.mjs';

const workspace = await workspaceFixture();
const written = await writeRevisionComparePatchedTarget(workspace);
const first = await verifyRevisionCompareTransferApplication({ ...written, createdAt });
const second = await verifyRevisionCompareTransferApplication({ ...written, createdAt });
assert.deepEqual(second, first);
assert.equal(first.audit.rows.length, workspace.transfer.plan.operations.length);
assert(first.audit.rows.every((row) => row.status === 'APPLIED'));
assert.equal(first.proof.status, 'READY');
for (const value of Object.values(first.proof.invariants)) assert.equal(value, true);
assert.equal(first.proof.actualChanges.length, 1);
assert.equal(first.proof.actualChanges[0].path, '/branches/0/children/0/description');
assert.equal(first.proof.actualChanges[0].before.value, 'Old');
assert.equal(first.proof.actualChanges[0].after.value, 'New');
assert.equal(first.proof.serializedPlanSha256.length, 64);
assert.equal(first.proof.originalTargetSha256, workspace.slots.candidate.jsonSnapshot.sourceContentSha256);
assert.equal(first.proof.patchedTargetSha256, written.patchedTargetSha256);
assert.equal(written.patchedSnapshot.errors.length, 0);
assert.equal(written.patchedSnapshot.rootKind, workspace.slots.candidate.jsonSnapshot.rootKind);

async function tamperedSnapshot(mutator) {
  const value = structuredClone(written.patchedSnapshot.parsedValue);
  mutator(value);
  const text = `${JSON.stringify(value, null, 2)}\n`;
  const hash = await sha256Text(text, globalThis.crypto);
  return createRevisionCompareJsonDocumentSnapshot({
    side: 'REV_B', sourceDocumentId: `revision-patched:tampered:${hash}`,
    sourceContentSha256: hash, fileName: written.originalSnapshot.fileName,
    profile: written.originalSnapshot.profile, parsedValue: JSON.parse(text),
  }, globalThis.crypto);
}

const unrelated = await tamperedSnapshot((value) => { value.future.keep = false; });
await assert.rejects(() => verifyRevisionCompareTransferApplication({
  ...written, patchedSnapshot: unrelated, patchedTargetSha256: unrelated.sourceContentSha256,
  patchedTargetDocumentId: unrelated.sourceDocumentId, createdAt,
}), /Unrelated mutation/);

const reordered = await tamperedSnapshot((value) => { value.metadata.unknown.reverse(); });
await assert.rejects(() => verifyRevisionCompareTransferApplication({
  ...written, patchedSnapshot: reordered, patchedTargetSha256: reordered.sourceContentSha256,
  patchedTargetDocumentId: reordered.sourceDocumentId, createdAt,
}), /Unrelated mutation|Array membership/);

const identity = await tamperedSnapshot((value) => { value.branches[0].children[0].id = 'OTHER'; });
await assert.rejects(() => verifyRevisionCompareTransferApplication({
  ...written, patchedSnapshot: identity, patchedTargetSha256: identity.sourceContentSha256,
  patchedTargetDocumentId: identity.sourceDocumentId, createdAt,
}), /Unrelated mutation|entity identities/);

console.log('revision-compare-transfer-verifier.test.mjs passed');
