import assert from 'node:assert/strict';
import { createSequentialEngineeringSvgIndexProjection } from '../tabs/sequential-sketcher/sequential-engineering-svg-index-projection.js';
import { blockedSequentialFixture } from './helpers/sequential-engineering-svg-fixture.js';

function assertNoMutableCollections(value, path = '$') {
  if (!value || typeof value !== 'object') return;
  assert.equal(value instanceof Map, false, `${path} must not expose Map`);
  assert.equal(value instanceof Set, false, `${path} must not expose Set`);
  assert.equal(Object.isFrozen(value), true, `${path} must be frozen`);
  Object.entries(value).forEach(([key, child]) => assertNoMutableCollections(child, `${path}.${key}`));
}

const fixture = blockedSequentialFixture();
const componentIds = fixture.evidenceModel.components.map((component) => component.componentId);
fixture.indexes.componentReferences.set('CONFLICTING-ALIAS', [
  fixture.indexes.components.get(componentIds[1]),
  fixture.indexes.components.get(componentIds[0]),
]);

const projection = createSequentialEngineeringSvgIndexProjection(fixture.indexes);
assert.equal(projection.schema, 'SequentialEngineeringSvgIndexProjection.v1');
assertNoMutableCollections(projection);
assert.doesNotThrow(() => JSON.stringify(projection));

assert.deepEqual(
  projection.branches.map((row) => row.branchId),
  [...projection.branches.map((row) => row.branchId)].sort(),
);
assert.deepEqual(
  projection.components.map((row) => row.componentId),
  [...projection.components.map((row) => row.componentId)].sort(),
);
assert.deepEqual(
  projection.ports.map((row) => row.portId),
  [...projection.ports.map((row) => row.portId)].sort(),
);

const conflict = projection.componentReferences.find((row) => row.reference === 'CONFLICTING-ALIAS');
assert.equal(conflict.conflict, true);
assert.deepEqual(conflict.componentIds, [...componentIds.slice(0, 2)].sort());
assert.equal(conflict.componentIds.length, 2, 'conflicting claims must remain explicit');

const before = JSON.stringify(projection);
fixture.indexes.components.clear();
fixture.indexes.ports.clear();
fixture.indexes.componentReferences.clear();
assert.equal(JSON.stringify(projection), before, 'projection must retain no mutable index reference');
assert.throws(() => projection.components.push({}), TypeError);
assert.throws(() => { projection.components[0].componentId = 'mutated'; }, TypeError);

assert.throws(
  () => createSequentialEngineeringSvgIndexProjection({}),
  /private Map/,
);

console.log('Sequential Engineering SVG immutable index projection: ok');
