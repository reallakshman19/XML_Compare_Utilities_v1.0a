import assert from 'node:assert/strict';
import { createScopedEditReferenceHostFixture } from './fixtures/scoped-edit-reference-host-fixture.js';

const fixture = createScopedEditReferenceHostFixture();
const acceptedVariants = new Set();
const rejectionVariants = new Set();
let acceptedCount = 0;
let staleCount = 0;

const templateStore = fixture.createStore();
const templateSnapshot = templateStore.getSnapshot();
const runtimeA = fixture.createRuntimeCandidate(templateStore, {
  kind: 'STRUCTURAL', index: 0, issuedAt: '2026-07-25T16:00:00.000Z',
});
const runtimeB = fixture.createRuntimeCandidate(templateStore, {
  kind: 'SELECTION', index: 1, issuedAt: '2026-07-25T16:01:00.000Z',
});
assert.equal(runtimeA.snapshot.snapshotId, templateSnapshot.snapshotId);
assert.equal(runtimeB.snapshot.snapshotId, templateSnapshot.snapshotId);
assert.equal(runtimeA.result.status, 'COMMITTED');
assert.equal(runtimeB.result.status, 'COMMITTED');

for (let index = 0; index < 1000; index += 1) {
  const store = fixture.createStore();
  const snapshot = store.getSnapshot();
  const accepted = store.acceptCommitResult({
    expectedSnapshotId: snapshot.snapshotId,
    result: runtimeA.result,
    acceptedAt: runtimeA.issuedAt,
  });
  assert.equal(accepted.accepted, true);
  acceptedCount += 1;
  const snapshotAfterA = store.getSnapshot();
  acceptedVariants.add(snapshotAfterA.snapshotId);

  const stale = store.acceptCommitResult({
    expectedSnapshotId: snapshot.snapshotId,
    result: runtimeB.result,
    acceptedAt: runtimeB.issuedAt,
  });
  assert.equal(stale.accepted, false);
  assert.equal(stale.reasonCode, 'STALE_REFERENCE_SNAPSHOT');
  assert.equal(store.getSnapshot(), snapshotAfterA);
  staleCount += 1;
  rejectionVariants.add(JSON.stringify({
    accepted: stale.accepted,
    reasonCode: stale.reasonCode,
    message: stale.message,
    unchangedVersion: stale.unchangedVersion,
  }));
  store.destroy();
}
runtimeA.runtime.destroy();
runtimeB.runtime.destroy();
templateStore.destroy();

assert.equal(acceptedCount, 1000);
assert.equal(staleCount, 1000);
assert.equal(acceptedVariants.size, 1);
assert.equal(rejectionVariants.size, 1);

console.log('[PASS] scoped-edit reference concurrency: 1,000 accepted and 1,000 stale attempts; one deterministic variant each.');
