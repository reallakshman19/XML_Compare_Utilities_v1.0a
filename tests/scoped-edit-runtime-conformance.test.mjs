import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  SCOPED_EDIT_RUNTIME_CONFORMANCE_V1,
  isScopedEditDeeplyFrozen,
  runScopedEditRuntimeConformance,
} from '../core/scoped-edit-runtime/index.js';
import {
  SCOPED_EDIT_FIXTURE_COUNTS,
  createScopedEditRuntimeFixture,
} from './fixtures/scoped-edit-runtime-fixture.js';

function source(path) {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
}

function runReport() {
  const fixture = createScopedEditRuntimeFixture();
  return runScopedEditRuntimeConformance({
    host: fixture.host, scopeRequest: fixture.scopeRequest,
    reducerRegistry: fixture.reducerRegistry, journalProjection: fixture.journalProjection,
    fixtures: fixture,
  });
}

const first = runReport(), second = runReport();
assert.equal(first.schema, SCOPED_EDIT_RUNTIME_CONFORMANCE_V1);
assert.equal(first.passed, true);
assert.equal(first.syntheticOnly, true);
assert(Object.values(first.checks).every(Boolean));
assert.deepEqual(first, second);
assert.equal(isScopedEditDeeplyFrozen(first), true);
assert.doesNotThrow(() => JSON.stringify(first));
assert.throws(() => runScopedEditRuntimeConformance({ fixtures: {} }), /synthetic fixture/);

const corruptPrimaryFixture = createScopedEditRuntimeFixture();
const corruptPrimaryHost = Object.freeze({
  scene: corruptPrimaryFixture.host.scene,
  resolveScope: corruptPrimaryFixture.host.resolveScope,
  entityGeometry: corruptPrimaryFixture.host.entityGeometry,
  appendEditCommand(projection) { return projection; },
});
assert.throws(() => runScopedEditRuntimeConformance({
  host: corruptPrimaryHost,
  scopeRequest: corruptPrimaryFixture.scopeRequest,
  reducerRegistry: corruptPrimaryFixture.reducerRegistry,
  journalProjection: corruptPrimaryFixture.journalProjection,
  fixtures: corruptPrimaryFixture,
}), /Scoped-edit conformance failed:.*primaryTransactionCommitted/);
assert.throws(() => runScopedEditRuntimeConformance({
  host: corruptPrimaryFixture.host,
  scopeRequest: corruptPrimaryFixture.scopeRequest,
  reducerRegistry: corruptPrimaryFixture.reducerRegistry,
  fixtures: corruptPrimaryFixture,
}), /journal projection/);

const fixture = createScopedEditRuntimeFixture();
assert.deepEqual({
  entities: fixture.scene.entities.length,
  editable: fixture.editableIds.length,
  boundary: fixture.boundaryIds.length,
  excluded: fixture.excludedIds.length,
  structuralIdentifiers: fixture.structuralIdentifiers.length,
  selectionSeeds: fixture.selectionSeeds.length,
  sectionalRegions: fixture.sectionalRegions.length,
  reducerBindings: fixture.reducerRegistry.commandTypes.length,
}, SCOPED_EDIT_FIXTURE_COUNTS);

const newFiles = Object.freeze([
  '../core/scoped-edit-runtime/scoped-edit-contracts.js',
  '../core/scoped-edit-runtime/scoped-edit-host.js',
  '../core/scoped-edit-runtime/scoped-edit-runtime.js',
  '../core/scoped-edit-runtime/scoped-edit-conformance.js',
  '../core/scoped-edit-runtime/index.js',
  './fixtures/scoped-edit-runtime-fixture.js',
  './scoped-edit-runtime-contracts.test.mjs',
  './scoped-edit-runtime-lifecycle.test.mjs',
  './scoped-edit-runtime-boundary.test.mjs',
  './scoped-edit-runtime-replay.test.mjs',
  './scoped-edit-runtime-conformance.test.mjs',
]);
for (const path of newFiles) {
  const text = source(path);
  assert(text.split(/\r?\n/).length < 300, `${path} must remain below 300 lines`);
  assert.doesNotMatch(text, /export\s+default/, `${path} must use named exports only`);
}

const coreFiles = newFiles.slice(0, 5);
for (const path of coreFiles) {
  const text = source(path);
  assert.doesNotMatch(text, /from\s+['"](?!\.\.?\/)/, `${path} must not add a dependency`);
  assert.doesNotMatch(text, /(?:tabs\/|workbench3d\/|engineering-svg\/|engineering-viewer\/)/,
    `${path} must not import a consumer or presentation runtime`);
  assert.doesNotMatch(text, /\b(?:window|document|WebGL|SVGElement|HTMLElement)\b/,
    `${path} must remain headless`);
}

const runtimeSource = source('../core/scoped-edit-runtime/scoped-edit-runtime.js');
for (const fixtureCommand of ['ENTITY_POSITION_SET', 'ENTITY_ATTRIBUTE_SET', 'ENTITY_REMARK_SET']) {
  assert.doesNotMatch(runtimeSource, new RegExp(fixtureCommand), 'runtime must not special-case fixture commands');
}
assert.match(source('../core/scoped-edit-runtime/scoped-edit-runtime.js'), /from '..\/edit-3d\/index\.js'/);
assert.match(source('../core/scoped-edit-runtime/scoped-edit-runtime.js'), /from '..\/edit-journal\/index\.js'/);
assert.match(source('../core/scoped-edit-runtime/scoped-edit-runtime.js'), /from '..\/engineering-scope\/index\.js'/);

console.log(`[PASS] scoped-edit conformance: ${Object.keys(first.checks).length} checks; source-policy files=${newFiles.length}.`);
