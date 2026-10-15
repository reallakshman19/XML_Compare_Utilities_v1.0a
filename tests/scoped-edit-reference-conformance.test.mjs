import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  SCOPED_EDIT_REFERENCE_HOST_CONFORMANCE_V1,
  runScopedEditReferenceHostConformance,
} from '../core/scoped-edit-reference-host/index.js';
import { createScopedEditReferenceHostFixture } from './fixtures/scoped-edit-reference-host-fixture.js';

const fixture = createScopedEditReferenceHostFixture();
const report = runScopedEditReferenceHostConformance({ fixtures: fixture });
assert.equal(report.schema, SCOPED_EDIT_REFERENCE_HOST_CONFORMANCE_V1);
assert.equal(report.passed, true);
assert.equal(report.referenceHostOnly, true);
assert.equal(Object.values(report.checks).every(Boolean), true);
assert.equal(Object.isFrozen(report), true);
assert.doesNotThrow(() => JSON.stringify(report));

assert.throws(() => runScopedEditReferenceHostConformance({
  fixtures: { ...fixture, referenceHostOnly: false, productionConsumer: true },
}), /non-production reference fixture/);

const remountVariants = new Set();
for (let index = 0; index < 100; index += 1) {
  const store = fixture.createStore();
  const snapshot = store.getSnapshot();
  const host = store.createRuntimeHost();
  assert.deepEqual(host.scene(), snapshot.engineeringScene);
  const destroyed = store.destroy();
  assert.equal(destroyed.destroyed, true);
  assert.throws(() => store.createRuntimeHost(), (error) => error.code === 'REFERENCE_STORE_DESTROYED');
  const failure = store.acceptCommitResult({
    expectedSnapshotId: snapshot.snapshotId,
    result: null,
    acceptedAt: '2026-07-25T18:00:00.000Z',
  });
  assert.equal(failure.reasonCode, 'REFERENCE_STORE_DESTROYED');
  assert.equal(failure.currentSnapshotId, snapshot.snapshotId);
  assert.equal(failure.unchangedVersion, snapshot.version);
  remountVariants.add(JSON.stringify(snapshot));
}
assert.equal(remountVariants.size, 1);

const sourceFiles = Object.freeze([
  '../core/scoped-edit-reference-host/reference-document-contracts.js',
  '../core/scoped-edit-reference-host/reference-scene-adapter.js',
  '../core/scoped-edit-reference-host/reference-journal-adapter.js',
  '../core/scoped-edit-reference-host/reference-runtime-host.js',
  '../core/scoped-edit-reference-host/reference-transaction-store.js',
  '../core/scoped-edit-reference-host/reference-conformance.js',
  '../core/scoped-edit-reference-host/index.js',
  './fixtures/scoped-edit-reference-host-fixture.js',
  './scoped-edit-reference-contracts.test.mjs',
  './scoped-edit-reference-host.test.mjs',
  './scoped-edit-reference-acceptance.test.mjs',
  './scoped-edit-reference-concurrency.test.mjs',
  './scoped-edit-reference-journal.test.mjs',
  './scoped-edit-reference-conformance.test.mjs',
]);
for (const path of sourceFiles) {
  const text = readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
  assert.equal(text.split(/\r?\n/).length < 300, true, `${path} must remain below 300 lines`);
  assert.doesNotMatch(text, /export\s+default/, `${path} must use named exports`);
}
for (const path of sourceFiles.slice(0, 7)) {
  const text = readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
  assert.doesNotMatch(text, /(?:tabs\/|workbench3d\/|engineering-svg\/|engineering-viewer\/)/);
  assert.doesNotMatch(text, /\b(?:window|localStorage|indexedDB|WebGL|SVGElement|HTMLElement)\b/);
  assert.doesNotMatch(text, /Date\.now|new Date|Math\.random|randomUUID/);
  assert.doesNotMatch(text, /topology node|\bpipe\b|\bsupport\b|revision difference|Pipeline CAD|staged JSON|canonical topology|SVG point|screen coordinate/i);
}

console.log('[PASS] scoped-edit reference conformance: full certification and 100 terminal destroy/remount cycles.');
