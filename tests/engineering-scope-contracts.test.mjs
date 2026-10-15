import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createEngineeringRevisionToken } from '../core/engineering-scene/engineering-revision-contracts.js';
import { createEngineeringScene } from '../core/engineering-scene/engineering-scene-contracts.js';
import {
  ENGINEERING_SCOPE_BOUNDARY_POLICY,
  ENGINEERING_SCOPE_KIND,
  ENGINEERING_SCOPE_REQUEST_SCHEMA,
  ENGINEERING_SCOPE_SCHEMA,
  createEngineeringScopeRequest,
} from '../core/engineering-scope/engineering-scope-contracts.js';
import { resolveEngineeringScope } from '../core/engineering-scope/engineering-scope-resolvers.js';

const policies = Object.values(ENGINEERING_SCOPE_BOUNDARY_POLICY);
const kinds = Object.values(ENGINEERING_SCOPE_KIND);

function request(kind, boundaryPolicy = 'FROZEN', elementBudget = 4) {
  const base = { schema: ENGINEERING_SCOPE_REQUEST_SCHEMA, kind, boundaryPolicy, elementBudget };
  if (kind === 'STRUCTURAL') return { ...base, structural: { identifiers: ['system-a'] } };
  if (kind === 'SELECTION') return { ...base, selection: { entityIds: ['E-1'], closureDepth: 0 } };
  return { ...base, sectional: { kind: 'box', min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } } };
}

for (const kind of kinds) {
  for (const boundaryPolicy of policies) {
    const value = createEngineeringScopeRequest(request(kind, boundaryPolicy));
    assert.equal(value.schema, ENGINEERING_SCOPE_REQUEST_SCHEMA);
    assert.equal(value.kind, kind);
    assert.equal(value.boundaryPolicy, boundaryPolicy);
    assert.equal(Object.isFrozen(value), true);
    assert.equal(Object.isFrozen(value.structural ?? value.selection ?? value.sectional), true);
    assert.doesNotThrow(() => JSON.stringify(value));
  }
}

assert.throws(() => createEngineeringScopeRequest({ ...request('SELECTION'), schema: undefined }), /schema/);
assert.throws(() => createEngineeringScopeRequest({ ...request('SELECTION'), kind: 'UNKNOWN' }), /Unsupported scope kind/);
assert.throws(() => createEngineeringScopeRequest({ ...request('SELECTION'), boundaryPolicy: 'UNKNOWN' }), /Unsupported boundary policy/);
for (const elementBudget of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
  assert.throws(() => createEngineeringScopeRequest({ ...request('SELECTION'), elementBudget }), /positive integer/);
}
assert.throws(() => createEngineeringScopeRequest({
  ...request('SELECTION'), selection: { entityIds: ['E-1', 'E-1'], closureDepth: 0 },
}), /unique/);
assert.throws(() => createEngineeringScopeRequest({
  ...request('STRUCTURAL'), structural: { identifiers: ['system-a', 'system-a'] },
}), /unique/);
assert.throws(() => createEngineeringScopeRequest({
  ...request('SECTIONAL'), sectional: { kind: 'box', min: { x: 0, y: 0, z: Number.NaN }, max: { x: 1, y: 1, z: 1 } },
}), /finite/);
assert.throws(() => createEngineeringScopeRequest({
  ...request('SECTIONAL'), sectional: { kind: 'slab', axis: 'X', min: 0, max: Number.POSITIVE_INFINITY },
}), /finite/);
assert.throws(() => createEngineeringScopeRequest({
  ...request('SECTIONAL'), sectional: { kind: 'radius', center: { x: 0, y: 0, z: 0 }, radius: Number.NaN },
}), /finite/);

const scene = createEngineeringScene({
  sceneId: 'contract-scene', revision: createEngineeringRevisionToken('r1'),
  entities: [{ id: 'E-1', kind: 'fixture', domainRef: { id: 'E-1' } }],
});
const referencesOf = () => [];
assert.throws(() => resolveEngineeringScope(scene, request('STRUCTURAL'), {
  resolveStructural: () => [], referencesOf,
}), /must not be empty/);
assert.throws(() => resolveEngineeringScope(scene, request('SECTIONAL'), {
  boundsOf: () => null, referencesOf,
}), /must not be empty/);
assert.throws(() => resolveEngineeringScope(scene, request('STRUCTURAL'), { referencesOf }), /resolveStructural/);
assert.throws(() => resolveEngineeringScope(scene, request('SELECTION'), {}), /referencesOf/);
assert.throws(() => resolveEngineeringScope(scene, request('SECTIONAL'), { referencesOf }), /boundsOf/);

const files = [
  'engineering-scope-contracts.js', 'engineering-scope-resolvers.js',
  'engineering-scope-scene.js', 'engineering-scope-boundary.js', 'index.js',
];
for (const name of files) {
  const source = readFileSync(fileURLToPath(new URL(`../core/engineering-scope/${name}`, import.meta.url)), 'utf8');
  assert(source.split(/\r?\n/).length < 300, `${name} must stay below 300 lines`);
  assert.doesNotMatch(source, /export\s+default/, `${name} must use named exports`);
  assert.doesNotMatch(source, /\b(canonicalTopology|fromNodeId|toNodeId|TopologyBrowserCore)\b/);
  assert.doesNotMatch(source, /from\s+['"][^.'"]/, `${name} must not add a dependency`);
}

assert.equal(ENGINEERING_SCOPE_SCHEMA, 'EngineeringScope.v1');
console.log(`[PASS] engineering scope contract matrix: ${kinds.length * policies.length} combinations.`);
