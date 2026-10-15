import assert from 'node:assert/strict';
import { createTopologyScopedEditReadOnlyHostFixture } from './fixtures/topology-scoped-edit-read-only-host-fixture.js';
const f = await createTopologyScopedEditReadOnlyHostFixture();
const original = await f.hostFactory({ readModel: f.readModelA0, core: f.core,
  authorityProvider: f.authorityGet, effects: f.effectBoundaryFactory() });
const scene = JSON.stringify(original.scene());
f.authoritySet(f.readModelA1.authorityId);
assert.throws(() => original.scene(), (error) => error.code === f.expectedCodes.stale);
f.authoritySet(f.readModelA0.authorityId);
for (let index = 0; index < 100; index += 1) {
  const host = await f.hostFactory({ readModel: f.readModelA0, core: f.core,
    authorityProvider: f.authorityGet, effects: f.effectBoundaryFactory() });
  assert.equal(JSON.stringify(host.scene()), scene); host.destroy();
  assert.throws(() => host.scene(), (error) => error.code === 'TOPOLOGY_READ_ONLY_HOST_DESTROYED');
}
console.log('[PASS] stale authority, terminal destroy, and deterministic remount cycles=100');
