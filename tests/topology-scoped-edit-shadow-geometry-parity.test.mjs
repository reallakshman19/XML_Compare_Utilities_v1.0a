import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { _test as shadowConformanceTest } from '../tabs/topology-trace-validator/topology-scoped-edit-shadow-conformance.js';
import { _test as shadowRuntimeTest } from '../tabs/topology-trace-validator/topology-scoped-edit-shadow-runtime.js';
import { createTopologyScopedEditShadowFixture } from './fixtures/topology-scoped-edit-shadow-fixture.js';

const f = await createTopologyScopedEditShadowFixture();
const composition = await shadowRuntimeTest.createWithCore({ readModel: f.readModel,
  scopeRequest: f.scopeRequest, authorityProvider: f.authorityGet }, f.core, { cryptoRef: webcrypto });
assert.equal(shadowConformanceTest.exactGeometry(composition, f.geometryIds, 30), 1);
for (const entityId of f.geometryIds) {
  assert.deepEqual(composition.directHost.entityGeometry(entityId),
    composition.readRuntimeGeometry(entityId));
}
console.log('[PASS] supported Topology geometry remains exact in shadow composition');
