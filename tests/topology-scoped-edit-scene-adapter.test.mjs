import assert from 'node:assert/strict';
import { immutableJson } from '../contracts/contract-values.js';
import { validateEngineeringScene } from '../core/engineering-scene/engineering-contract-validation.js';
import {
  TOPOLOGY_SCOPED_EDIT_SCENE_REJECTION,
  assertTopologyScopedEditSceneAncestry,
  _test as sceneTest,
} from '../tabs/topology-trace-validator/topology-scoped-edit-scene-adapter.js';
import { createTopologyScopedEditReadOnlyHostFixture } from './fixtures/topology-scoped-edit-read-only-host-fixture.js';

const f = await createTopologyScopedEditReadOnlyHostFixture();
const scene = await sceneTest.createWithCore(f.readModelA0, f.core, f.certificationDependencies);
validateEngineeringScene(scene);
assert.equal(scene.entities.length, 48);
assert.equal(scene.coordinateSystem.unit, 'mm');
assert.equal(scene.coordinateSystem.verticalAxis, 'Y');
assert.equal(scene.coordinateSystem.frame, 'ManagedStage.XYZ.v1');
assert.equal(scene.metadata.excludedKinds.rigids.includes('no independent'), true);
assert.equal(scene.metadata.producerProfileHash, f.readModelA0.producerProfileHash);
assert.equal(scene.metadata.producerOptionsHash, f.readModelA0.producerOptionsHash);
assert.equal(new Set(scene.entities.map((entity) => entity.id)).size, 48);
assert(scene.entities.every((entity) => !entity.id.startsWith('RIGID:')));
const expected = JSON.stringify(scene);
for (let index = 0; index < 1000; index += 1) {
  assert.equal(JSON.stringify(await sceneTest.createWithCore(f.readModelA0, f.core,
    f.certificationDependencies)), expected);
}
const edge = scene.entities.find((entity) => entity.id === 'E01');
assert.equal(edge.geometry.kind, 'segment');
assert.deepEqual(edge.domainRef.references, ['BN01', 'J01', 'N01', 'N02']);
function forged(mutator) {
  const candidate = structuredClone(scene); mutator(candidate);
  assert.throws(() => assertTopologyScopedEditSceneAncestry(immutableJson(candidate, 'forged scene'),
    f.readModelA0), (error) => error.code === TOPOLOGY_SCOPED_EDIT_SCENE_REJECTION.ANCESTRY_MISMATCH);
}
forged((candidate) => { candidate.entities[0].domainRef.references = ['N02']; });
forged((candidate) => { candidate.entities.pop(); candidate.metadata.candidateEntityIds.pop(); });
forged((candidate) => { candidate.entities.find((entity) => entity.id === 'E01').domainRef.references = ['N01']; });
forged((candidate) => { candidate.metadata.producerOptionsHash = 'fnv1a32:deadbeef'; });
const mutableScene = structuredClone(scene);
const certifiedScene = assertTopologyScopedEditSceneAncestry(mutableScene, f.readModelA0);
mutableScene.entities.pop();
mutableScene.metadata.candidateEntityIds.pop();
assert.equal(certifiedScene.entities.length, 48);
assert(Object.isFrozen(certifiedScene));
const sceneA1 = await sceneTest.createWithCore(f.readModelA1, f.core, f.certificationDependencies);
const relabelled = structuredClone(sceneA1);
relabelled.sceneId = scene.sceneId;
relabelled.revision.value = f.readModelA0.authorityId;
relabelled.metadata.authorityId = f.readModelA0.authorityId;
relabelled.metadata.canonicalTopologyHash = f.readModelA0.canonicalTopologyHash;
relabelled.metadata.canonicalContentHash = f.readModelA0.canonicalContentHash;
relabelled.metadata.artifactsHash = f.readModelA0.artifactsHash;
relabelled.metadata.producerProfileHash = f.readModelA0.producerProfileHash;
relabelled.metadata.producerOptionsHash = f.readModelA0.producerOptionsHash;
assert.throws(() => assertTopologyScopedEditSceneAncestry(immutableJson(relabelled, 'relabelled scene'),
  f.readModelA0), (error) => error.code === TOPOLOGY_SCOPED_EDIT_SCENE_REJECTION.ANCESTRY_MISMATCH);
console.log('[PASS] scene ancestry returns immutable certified projection and rejects caller mutation');
