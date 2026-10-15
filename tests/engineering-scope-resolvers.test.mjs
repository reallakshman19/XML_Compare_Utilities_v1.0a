import assert from 'node:assert/strict';

import { createEngineeringRevisionToken } from '../core/engineering-scene/engineering-revision-contracts.js';
import { createEngineeringScene } from '../core/engineering-scene/engineering-scene-contracts.js';
import { ENGINEERING_SCOPE_REQUEST_SCHEMA } from '../core/engineering-scope/engineering-scope-contracts.js';
import { resolveEngineeringScope } from '../core/engineering-scope/engineering-scope-resolvers.js';
import { scopeScene } from '../core/engineering-scope/engineering-scope-scene.js';

function entity(id, index = 0) {
  return { id, kind: 'fixture', domainRef: { stableId: id }, metadata: { index } };
}

function sceneOf(ids, sceneId = 'scope-resolver-scene') {
  return createEngineeringScene({
    sceneId, revision: createEngineeringRevisionToken('r1'),
    coordinateSystem: { unit: 'mm', frame: 'GLOBAL', verticalAxis: 'Z', handedness: 'right' },
    entities: ids.map(entity),
  });
}

function base(kind, elementBudget) {
  return { schema: ENGINEERING_SCOPE_REQUEST_SCHEMA, kind, boundaryPolicy: 'FROZEN', elementBudget };
}

function difference(expected, actual) {
  const left = [...expected].filter((id) => !actual.includes(id));
  const right = [...actual].filter((id) => !expected.includes(id));
  return [...left, ...right].sort();
}

const editableIds = Array.from({ length: 12 }, (_, index) => `E-${String(index + 1).padStart(2, '0')}`);
const boundaryIds = ['CTX-01', 'CTX-02'];
const equivalentScene = sceneOf([...boundaryIds, ...editableIds].reverse());
const references = new Map(editableIds.map((id) => [id, id === 'E-12' ? ['CTX-01'] : []]));
references.set('CTX-01', ['CTX-02']);
references.set('CTX-02', []);
const referencesOf = (value) => references.get(value.id) ?? [];
const bounds = new Map(equivalentScene.entities.map((value) => [value.id,
  editableIds.includes(value.id)
    ? { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } }
    : { min: { x: 100, y: 100, z: 100 }, max: { x: 101, y: 101, z: 101 } }]));
const requests = [
  { ...base('STRUCTURAL', 14), structural: { identifiers: ['shared-system'] } },
  { ...base('SELECTION', 14), selection: { entityIds: [...editableIds].reverse(), closureDepth: 0 } },
  { ...base('SECTIONAL', 14), sectional: { kind: 'box', min: { x: -1, y: -1, z: -1 }, max: { x: 2, y: 2, z: 2 } } },
];
const extensions = {
  resolveStructural: () => [...editableIds].reverse(),
  referencesOf,
  boundsOf: (value) => bounds.get(value.id),
};
const equivalentScopes = requests.map((value) => resolveEngineeringScope(equivalentScene, value, extensions));
for (const scope of equivalentScopes) {
  assert.deepEqual(scope.entityIds, editableIds);
  assert.deepEqual(scope.boundaryIds, boundaryIds);
  assert.equal(scope.stats.matched, 12);
  assert.equal(scope.stats.boundary, 2);
  assert.equal(scope.stats.consumed, 14);
}
const scopedViews = equivalentScopes.map((scope) => scopeScene(equivalentScene, scope));
assert.deepEqual(scopedViews[0], scopedViews[1]);
assert.deepEqual(scopedViews[1], scopedViews[2]);

const spatialIds = ['BOX-IN', 'CROSSING', 'OUTSIDE', 'TOUCHING', 'SLAB-IN', 'RADIUS-IN'];
const spatialScene = sceneOf(spatialIds, 'sectional-exactness');
const spatialBounds = new Map([
  ['BOX-IN', { min: { x: 1, y: 1, z: 1 }, max: { x: 2, y: 2, z: 2 } }],
  ['CROSSING', { min: { x: -1, y: 4, z: 4 }, max: { x: 1, y: 6, z: 6 } }],
  ['OUTSIDE', { min: { x: 11, y: 11, z: 11 }, max: { x: 12, y: 12, z: 12 } }],
  ['TOUCHING', { min: { x: 10, y: 3, z: 3 }, max: { x: 12, y: 4, z: 4 } }],
  ['SLAB-IN', { min: { x: 20, y: 4, z: 20 }, max: { x: 21, y: 6, z: 21 } }],
  ['RADIUS-IN', { min: { x: 4, y: 4, z: 4 }, max: { x: 4.5, y: 4.5, z: 4.5 } }],
]);
const spatialExtensions = { referencesOf: () => [], boundsOf: (value) => spatialBounds.get(value.id) };
function sectional(sectional) {
  return resolveEngineeringScope(spatialScene, { ...base('SECTIONAL', 20), sectional }, spatialExtensions).entityIds;
}
const boxActual = sectional({ kind: 'box', min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } });
assert.deepEqual(difference(['BOX-IN', 'CROSSING', 'RADIUS-IN', 'TOUCHING'], boxActual), []);
const slabActual = sectional({ kind: 'slab', axis: 'Y', min: 5, max: 5 });
assert.deepEqual(difference(['CROSSING', 'SLAB-IN'], slabActual), []);
const radiusActual = sectional({ kind: 'radius', center: { x: 5, y: 5, z: 5 }, radius: 1.75 });
assert.deepEqual(difference(['RADIUS-IN'], radiusActual), []);

const largeIds = Array.from({ length: 5000 }, (_, index) => `L-${String(index).padStart(4, '0')}`);
const largeScene = sceneOf(largeIds, 'budget-scene');
const budgetExtensions = { resolveStructural: () => [...largeIds].reverse(), referencesOf: () => [] };
function budgetRequest(elementBudget) {
  return { ...base('STRUCTURAL', elementBudget), structural: { identifiers: ['all'] } };
}
assert.throws(() => resolveEngineeringScope(largeScene, budgetRequest(200), budgetExtensions), /elementBudget 200/);
const exact = resolveEngineeringScope(largeScene, budgetRequest(5000), budgetExtensions);
const spare = resolveEngineeringScope(largeScene, budgetRequest(5001), budgetExtensions);
assert.equal(exact.stats.consumed, 5000);
assert.equal(exact.stats.remaining, 0);
assert.equal(spare.stats.consumed, 5000);
assert.equal(spare.stats.remaining, 1);

const serialized = JSON.stringify(equivalentScopes[0]);
for (let run = 0; run < 100; run += 1) {
  assert.equal(JSON.stringify(resolveEngineeringScope(equivalentScene, requests[0], extensions)), serialized);
}
console.log('[PASS] resolver equivalence=12, sectional fixtures=6, budgets=200/5000/5001, determinism=100.');
