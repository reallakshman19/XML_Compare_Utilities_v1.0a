import assert from 'node:assert/strict';

import { createEngineeringRevisionToken } from '../core/engineering-scene/engineering-revision-contracts.js';
import { createEngineeringScene } from '../core/engineering-scene/engineering-scene-contracts.js';
import { ENGINEERING_SCOPE_REQUEST_SCHEMA, createEngineeringScope } from '../core/engineering-scope/engineering-scope-contracts.js';
import { resolveEngineeringScope } from '../core/engineering-scope/engineering-scope-resolvers.js';
import { scopeScene, validateScopeClosure } from '../core/engineering-scope/engineering-scope-scene.js';

function assertDeepFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child);
}

const ids = ['A', 'B', 'C', 'D'];
const scene = createEngineeringScene({
  sceneId: 'closure-scene', revision: createEngineeringRevisionToken('r1'),
  entities: ids.map((id) => ({ id, kind: 'fixture', domainRef: { stableId: id }, metadata: { ref: id } })),
});
const refs = new Map([['A', ['B']], ['B', ['C']], ['C', []], ['D', []]]);
const referencesOf = (entity) => refs.get(entity.id) ?? [];
const boundsOf = (entity) => entity.id === 'A'
  ? { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } }
  : { min: { x: 10, y: 10, z: 10 }, max: { x: 11, y: 11, z: 11 } };
const before = JSON.stringify(scene);
const sourceEntities = new Map(scene.entities.map((entity) => [entity.id, entity]));

function request(kind, boundaryPolicy) {
  const common = { schema: ENGINEERING_SCOPE_REQUEST_SCHEMA, kind, boundaryPolicy, elementBudget: 4 };
  if (kind === 'STRUCTURAL') return { ...common, structural: { identifiers: ['root-a'] } };
  if (kind === 'SELECTION') return { ...common, selection: { entityIds: ['A'], closureDepth: 0 } };
  return { ...common, sectional: { kind: 'box', min: { x: 0, y: 0, z: 0 }, max: { x: 2, y: 2, z: 2 } } };
}

const validScopes = [];
for (const kind of ['STRUCTURAL', 'SELECTION', 'SECTIONAL']) {
  for (const boundaryPolicy of ['FROZEN', 'GHOSTED', 'PROPAGATE']) {
    validScopes.push(resolveEngineeringScope(scene, request(kind, boundaryPolicy), {
      resolveStructural: () => ['A'], referencesOf, boundsOf,
    }));
  }
}
for (const scope of validScopes) {
  assert.deepEqual(scope.entityIds, ['A']);
  assert.deepEqual(scope.boundaryIds, ['B', 'C']);
  const scoped = scopeScene(scene, scope);
  const closure = validateScopeClosure(scoped, { referencesOf });
  assert.equal(closure.closed, true);
  assert.deepEqual(closure.missingIds, []);
  assert.equal(scoped.authoritative, false);
  assert.equal(scoped.authority, 'DERIVED_SCOPE_VIEW');
  assert.equal(scoped.entityRoles.A, 'EDITABLE');
  assert.equal(scoped.entityRoles.B, 'BOUNDARY');
  assert.equal(scoped.entityRoles.C, 'BOUNDARY');
  assertDeepFrozen(scoped);
  for (const entity of scoped.entities) assert.equal(entity, sourceEntities.get(entity.id));
}
assert.equal(validScopes.filter((scope) => validateScopeClosure(scopeScene(scene, scope), { referencesOf }).closed).length, validScopes.length);
assert.equal(JSON.stringify(scene), before);

const selectedDepthOne = resolveEngineeringScope(scene, {
  ...request('SELECTION', 'FROZEN'), selection: { entityIds: ['A'], closureDepth: 1 },
}, { referencesOf });
assert.deepEqual(selectedDepthOne.entityIds, ['A', 'B']);
assert.deepEqual(selectedDepthOne.boundaryIds, ['C']);
assert.equal(validateScopeClosure(scopeScene(scene, selectedDepthOne), { referencesOf }).closed, true);

const missingClosure = validateScopeClosure(scopeScene(scene, validScopes[0]), {
  referencesOf: (entity) => entity.id === 'C' ? ['MISSING'] : referencesOf(entity),
});
assert.equal(missingClosure.closed, false);
assert.deepEqual(missingClosure.missingIds, ['MISSING']);
assert.deepEqual(missingClosure.missingByEntity, [{ entityId: 'C', missingIds: ['MISSING'] }]);
assert.throws(() => resolveEngineeringScope(scene, request('SELECTION', 'FROZEN'), {
  referencesOf: (entity) => entity.id === 'B' ? ['MISSING'] : referencesOf(entity),
}), /missing scene entity/);

const invalidScope = createEngineeringScope({
  schema: 'EngineeringScope.v1', request: request('SELECTION', 'FROZEN'), kind: 'SELECTION',
  boundaryPolicy: 'FROZEN', elementBudget: 4, entityIds: ['A'], boundaryIds: ['MISSING'],
  stats: { matched: 1, boundary: 1, mounted: 2, budget: 4, consumed: 2, remaining: 2 },
});
assert.throws(() => scopeScene(scene, invalidScope), /missing scene ids/);
const mutableScene = JSON.parse(JSON.stringify(scene));
assert.throws(() => scopeScene(mutableScene, validScopes[0]), /deeply immutable/);
assert.equal(JSON.stringify(scene), before);
console.log(`[PASS] closure matrix=${validScopes.length}, immutable boundary closure and missing-reference detection verified.`);
