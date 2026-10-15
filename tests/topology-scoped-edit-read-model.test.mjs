import assert from 'node:assert/strict';
import { immutableJson } from '../contracts/contract-values.js';
import { semanticHash } from '../tabs/topology-trace-validator/topology-validator-values.js';
import {
  TOPOLOGY_SCOPED_EDIT_PRODUCER_PROFILE_ID,
  TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION,
  _test as readModelTest,
} from '../tabs/topology-trace-validator/topology-scoped-edit-read-model.js';
import {
  createTopologyScopedEditReadOnlyHostFixture,
  _test as fixtureTest,
} from './fixtures/topology-scoped-edit-read-only-host-fixture.js';

const f = await createTopologyScopedEditReadOnlyHostFixture(), m = f.readModelA0;
assert.equal(m.schema, 'TopologyScopedEditReadModel.v1');
assert(Object.isFrozen(m));
assert.equal(m.commandScopeBasis.editableEntityIds.length, 16);
assert.equal(m.commandScopeBasis.boundaryEntityIds.length, 12);
assert.equal(m.commandScopeBasis.excludedEntityIds.length, 20);
assert.deepEqual(m.journalProjection.redoCommandIds, ['CJ-000004']);
assert.equal(m.regenerationCertification.artifactsHash, m.artifactsHash);
assert.equal(m.producerProfile.schema, 'TopologyReadOnlyProducerProfile.v1');
assert.equal(m.producerProfile.profileId, TOPOLOGY_SCOPED_EDIT_PRODUCER_PROFILE_ID);
assert.equal(m.producerProfile.optionsHash, semanticHash(m.producerOptions));
assert.equal(m.producerOptionsHash, m.regenerationCertification.producerOptionsHash);
assert.equal(m.canonicalAncestry.producerOptionsHash, m.producerOptionsHash);
assert.doesNotThrow(() => JSON.stringify(m));
async function rejects(mutator, code) {
  const input = structuredClone(f.inputA0); mutator(input);
  await assert.rejects(() => readModelTest.createWithCore(input, f.core, f.certificationDependencies),
    (error) => error.code === code);
}
await rejects((i) => { i.authority.authorityId = 'TAUTH-forged'; },
  TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.AUTHORITY_MISMATCH);
await rejects((i) => { i.projectDocument.documentId = 'wrong'; },
  TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.DOCUMENT_MISMATCH);
await rejects((i) => { i.commandJournal.activeCommandIds = []; },
  TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.REPLAY_MISMATCH);
await rejects((i) => { i.replayState.remarks = { forged: 'yes' }; },
  TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.REPLAY_MISMATCH);
await rejects((i) => { i.editDraft = { ...i.editDraft, topologyEditDraftHash: 'wrong' }; },
  TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.DRAFT_MISMATCH);
await rejects((i) => { i.canonicalAncestry.canonicalTopologyHash = 'wrong'; },
  TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.CANONICAL_MISMATCH);
await rejects((i) => { i.canonicalTopology.sourceIdentity.sourceHash = 'b'.repeat(64); },
  TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.SOURCE_BASIS_MISMATCH);
await rejects((i) => { i.selectionSnapshot.entityIds = ['MISSING']; },
  TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.AUTHORITY_MISMATCH);
await rejects((i) => {
  i.producerOptions = { sourceName: 'topology.json', jobName: 'topology-EDIT-DRAFT',
    toleranceMm: 0.25, supportProjectionToleranceMm: 75, enrichmentConfig: {} };
}, TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.PRODUCER_PROFILE_MISMATCH);
await rejects((i) => {
  i.canonicalTopology.nodes[0].position.x += 1;
  i.canonicalTopology.canonicalTopologyHash = 'coordinated-forgery';
  i.canonicalAncestry.canonicalTopologyHash = 'coordinated-forgery';
  const built = fixtureTest.builtFor(i.editDraft);
  i.canonicalAncestry.artifactsHash = semanticHash({ editDraft: built.editDraft,
    canonicalTopology: i.canonicalTopology, editLedger: built.editLedger,
    editValidation: built.editValidation });
}, TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.REGENERATION_MISMATCH);
await rejects((i) => {
  i.canonicalTopology.nodes[1].position.z += 5;
  i.canonicalTopology.canonicalTopologyHash = 'altered-content-and-hash';
  i.canonicalAncestry.canonicalTopologyHash = 'altered-content-and-hash';
}, TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.REGENERATION_MISMATCH);
await rejects((i) => { i.canonicalTopology.nodes[2].position.y += 7; },
  TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.REGENERATION_MISMATCH);
await rejects((i) => { i.canonicalAncestry.artifactsHash = 'fnv1a32:deadbeef'; },
  TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.REGENERATION_MISMATCH);
await rejects((i) => {
  const wrong = structuredClone(f.inputA1.canonicalTopology);
  i.canonicalTopology = wrong;
  i.canonicalAncestry.canonicalTopologyHash = wrong.canonicalTopologyHash;
}, TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.REGENERATION_MISMATCH);
const roundTrip = immutableJson(structuredClone(m), 'round-trip read model');
const certifiedRoundTrip = await readModelTest.assertWithCore(roundTrip, f.core, f.certificationDependencies);
assert.deepEqual(certifiedRoundTrip, roundTrip);
assert.notStrictEqual(certifiedRoundTrip, roundTrip);
const mutable = structuredClone(m);
const certifiedMutable = await readModelTest.assertWithCore(mutable, f.core, f.certificationDependencies);
mutable.commandScopeBasis.editableEntityIds.length = 0;
mutable.commandJournal.activeCommandIds.length = 0;
mutable.authority.authorityId = 'mutated-after-certification';
assert.equal(certifiedMutable.commandScopeBasis.editableEntityIds.length, 16);
assert.notEqual(certifiedMutable.authority.authorityId, mutable.authority.authorityId);
assert(Object.isFrozen(certifiedMutable.commandJournal));
console.log('[PASS] read model uses closed producer profile and returns immutable recertified authority');
