import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { _test as shadowRuntimeTest } from '../tabs/topology-trace-validator/topology-scoped-edit-shadow-runtime.js';
import { createTopologyScopedEditShadowFixture } from './fixtures/topology-scoped-edit-shadow-fixture.js';

const f = await createTopologyScopedEditShadowFixture();
const composition = await shadowRuntimeTest.createWithCore({ readModel: f.readModel,
  scopeRequest: f.scopeRequest, authorityProvider: f.authorityGet }, f.core, { cryptoRef: webcrypto });
for (let index = 0; index < 10; index += 1) {
  assert.deepEqual(composition.directHost.scene(), composition.context.scene);
}
const scene = composition.context.scene;
assert.equal(scene.revision.value, f.readModel.authorityId);
assert.equal(scene.metadata.producerProfileHash, f.readModel.producerProfileHash);
assert.equal(scene.metadata.producerOptionsHash, f.readModel.producerOptionsHash);
console.log('[PASS] Topology EngineeringScene evidence is exact through the shared runtime seam');
