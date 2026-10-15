import assert from 'node:assert/strict';
import { immutableJson } from '../contracts/contract-values.js';
import { _test as scopeTest } from '../tabs/topology-trace-validator/topology-scoped-edit-scope-adapter.js';
import { createTopologyScopedEditReadOnlyHostFixture } from './fixtures/topology-scoped-edit-read-only-host-fixture.js';

const f = await createTopologyScopedEditReadOnlyHostFixture();
const host = await f.hostFactory({ readModel: f.readModelA0, core: f.core,
  authorityProvider: f.authorityGet, effects: f.effectBoundaryFactory() });
for (const request of f.selectionRequests) {
  const evidence = host.resolveScopeEvidence(request);
  assert.equal(evidence.editableEntityIds.length + evidence.boundaryEntityIds.length
    + evidence.excludedEntityIds.length, 48);
}
for (const request of f.structuralRequests) assert.equal(host.resolveScopeEvidence(request).authorityId,
  f.readModelA0.authorityId);
assert.throws(() => host.resolveScope(f.sectionalRequest), (error) => error.code === 'TOPOLOGY_SECTIONAL_SCOPE_UNSUPPORTED');
assert.throws(() => host.resolveScope(f.overflowRequest), (error) => error.code === 'TOPOLOGY_SCOPE_BUDGET_EXCEEDED');
const forgedScene = structuredClone(host.scene()); forgedScene.entities.pop();
await assert.rejects(() => scopeTest.resolverWithCore({ readModel: f.readModelA0,
  scene: immutableJson(forgedScene, 'forged scope scene') }, f.core, f.certificationDependencies),
(error) => error.code === 'TOPOLOGY_SCENE_ANCESTRY_MISMATCH');
const mutableReadModel = structuredClone(f.readModelA0), mutableScene = structuredClone(host.scene());
const resolver = await scopeTest.resolverWithCore({ readModel: mutableReadModel, scene: mutableScene },
  f.core, f.certificationDependencies);
mutableReadModel.commandScopeBasis.editableEntityIds.length = 0;
mutableScene.entities.length = 0;
const certifiedEvidence = resolver(f.selectionRequests[0]);
assert.equal(certifiedEvidence.editableEntityIds.includes('N01'), true);
assert.equal(certifiedEvidence.editableEntityIds.length + certifiedEvidence.boundaryEntityIds.length
  + certifiedEvidence.excludedEntityIds.length, 48);
console.log('[PASS] scope resolver captures immutable recertified read model and scene');
