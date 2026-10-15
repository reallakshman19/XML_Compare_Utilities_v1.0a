import assert from 'node:assert/strict';
import { sha256Text } from '../tabs/revision-compare/revision-hash.js';
import { createRevisionCompareTransferArchiveArtifact, revisionCompareTransferArchiveReadiness, validateRevisionCompareTransferArchiveArtifact, validateRevisionCompareTransferArchiveAuthority } from '../tabs/revision-compare/revision-transfer-archive.js';
import { clone, cryptoRef, transferArchiveFixture } from './revision-compare-transfer-archive-fixtures.mjs';
const fixture = await transferArchiveFixture();
assert.equal(fixture.workspace.schema, 'RevisionCompareWorkspaceState.v13');
assert.deepEqual(revisionCompareTransferArchiveReadiness(fixture.workspace), { status: 'READY', blockers: [] });
await validateRevisionCompareTransferArchiveAuthority(fixture.workspace, cryptoRef);
const artifact = await createRevisionCompareTransferArchiveArtifact(fixture.workspace, { cryptoRef });
assert.equal(artifact.schema, 'RevisionCompareTransferArchiveArtifact.v1');
assert.equal(artifact.classification, 'PRESENTATION_ONLY');
assert.equal(artifact.mimeType, 'text/html');
assert.equal(artifact.contentSha256, await sha256Text(artifact.text, cryptoRef));
assert.equal(artifact.sizeBytes, new TextEncoder().encode(artifact.text).byteLength);
assert.equal(artifact.filename.includes('revision-session_completion'), true);
await validateRevisionCompareTransferArchiveArtifact(artifact, cryptoRef);
for (const [mutate, pattern] of [
  [(value) => { value.transferCompletion.status = 'STALE'; }, /current CREATED/],
  [(value) => { value.transferCompletion.reportArtifact.text = '{}\n'; }, /retained SHA-256/],
  [(value) => { value.transferCompletion.bundleArtifact.sizeBytes += 1; }, /byte size/],
  [(value) => { value.transferCompletion.bundle.payload.transferArtifacts[0].text += ' '; }, /artifact SHA-256/],
]) {
  const value = clone(fixture.workspace); mutate(value);
  await assert.rejects(() => validateRevisionCompareTransferArchiveAuthority(value, cryptoRef), pattern);
}

const noncanonical = clone(fixture.workspace);
noncanonical.transferCompletion.reportArtifact.text = JSON.stringify(noncanonical.transferCompletion.report);
noncanonical.transferCompletion.reportArtifact.contentSha256 = await sha256Text(noncanonical.transferCompletion.reportArtifact.text, cryptoRef);
noncanonical.transferCompletion.reportArtifact.sizeBytes = new TextEncoder().encode(noncanonical.transferCompletion.reportArtifact.text).byteLength;
await assert.rejects(() => validateRevisionCompareTransferArchiveAuthority(noncanonical, cryptoRef), /canonical serialization/);

const broken = clone(artifact); broken.text += ' ';
await assert.rejects(() => validateRevisionCompareTransferArchiveArtifact(broken, cryptoRef), /SHA-256/);
console.log('revision-compare-transfer-archive.test.mjs passed');
