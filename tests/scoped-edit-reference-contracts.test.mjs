import assert from 'node:assert/strict';
import { immutableJson } from '../contracts/contract-values.js';
import {
  SCOPED_EDIT_REFERENCE_ACCEPTANCE_V1,
  SCOPED_EDIT_REFERENCE_DOCUMENT_V1,
  SCOPED_EDIT_REFERENCE_REPLAY_STATE_V1,
  SCOPED_EDIT_REFERENCE_SNAPSHOT_V1,
  assertScopedEditReferenceDocument,
  assertScopedEditReferenceSnapshot,
  canonicalReferenceJson,
  certifyScopedEditReferenceSnapshot,
  createReferenceInitialState,
  createReferenceSnapshotId,
  createScopedEditReferenceDocument,
  deriveReferenceDocument,
  deriveReferenceEngineeringScene,
  hashReferenceValue,
  isReferenceDeeplyFrozen,
} from '../core/scoped-edit-reference-host/index.js';
import {
  SCOPED_EDIT_REFERENCE_FIXTURE_COUNTS,
  createScopedEditReferenceHostFixture,
} from './fixtures/scoped-edit-reference-host-fixture.js';

let checked = 0;
const fixture = createScopedEditReferenceHostFixture();

assert.deepEqual({
  document: SCOPED_EDIT_REFERENCE_DOCUMENT_V1,
  snapshot: SCOPED_EDIT_REFERENCE_SNAPSHOT_V1,
  replay: SCOPED_EDIT_REFERENCE_REPLAY_STATE_V1,
  acceptance: SCOPED_EDIT_REFERENCE_ACCEPTANCE_V1,
}, {
  document: 'ScopedEditReferenceDocument.v1',
  snapshot: 'ScopedEditReferenceSnapshot.v1',
  replay: 'ScopedEditReferenceReplayState.v1',
  acceptance: 'ScopedEditReferenceAcceptance.v1',
});
checked += 1;

assert.deepEqual({
  entities: fixture.initialDocument.entities.length,
  editable: fixture.editableIds.length,
  boundary: fixture.boundaryIds.length,
  excluded: fixture.excludedIds.length,
  structuralGroups: fixture.structuralGroups.length,
  selectionSeedSets: fixture.selectionSeedSets.length,
  sectionalRegions: fixture.sectionalRegions.length,
  reducerBindings: fixture.reducerRegistry.commandTypes.length,
}, SCOPED_EDIT_REFERENCE_FIXTURE_COUNTS);
checked += 1;

assert.equal(assertScopedEditReferenceDocument(fixture.initialDocument), fixture.initialDocument);
assert.equal(isReferenceDeeplyFrozen(fixture.initialDocument), true);
assert.doesNotThrow(() => JSON.stringify(fixture.initialDocument));
assert.deepEqual(fixture.initialDocument.entities.map((entity) => entity.entityId),
  [...fixture.initialDocument.entities.map((entity) => entity.entityId)].sort());
checked += 4;

const replayInitial = createReferenceInitialState(fixture.initialDocument);
assert.equal(replayInitial.schema, SCOPED_EDIT_REFERENCE_REPLAY_STATE_V1);
assert.equal(replayInitial.documentId, fixture.initialDocument.documentId);
assert.equal(replayInitial.entities.length, 32);
assert.equal(isReferenceDeeplyFrozen(replayInitial), true);
checked += 4;

const store = fixture.createStore();
const snapshot = store.getSnapshot();
assert.equal(assertScopedEditReferenceSnapshot(snapshot), snapshot);
assert.equal(certifyScopedEditReferenceSnapshot(snapshot, { reducerRegistry: fixture.reducerRegistry }), snapshot);
assert.equal(snapshot.version, 0);
assert.equal(snapshot.commandJournal.schema, 'CommandJournal.v1');
assert.deepEqual(snapshot.journalProjection.envelopes, snapshot.commandJournal.entries);
assert.deepEqual(snapshot.journalProjection.activeCommandIds, snapshot.commandJournal.activeCommandIds);
assert.equal(snapshot.documentHash, hashReferenceValue(snapshot.document));
assert.equal(snapshot.replayHash, hashReferenceValue(snapshot.replayState));
assert.equal(isReferenceDeeplyFrozen(snapshot), true);
const replayCorruption = immutableJson({
  ...snapshot,
  replayState: { ...snapshot.replayState, state: { ...snapshot.replayState.state, revision: 99 } },
  replayHash: hashReferenceValue({
    ...snapshot.replayState,
    state: { ...snapshot.replayState.state, revision: 99 },
  }),
}, 'Corrupt replay snapshot');
assert.throws(() => assertScopedEditReferenceSnapshot(replayCorruption), /reconstruct/);
const sceneCorruption = immutableJson({
  ...snapshot,
  engineeringScene: { ...snapshot.engineeringScene, sceneId: 'reference-scene:corrupt' },
}, 'Corrupt scene snapshot');
assert.throws(() => assertScopedEditReferenceSnapshot(sceneCorruption), /sceneId/);
checked += 11;

const forgedReplay = immutableJson({
  ...snapshot.replayState,
  state: {
    ...snapshot.replayState.state,
    revision: 1,
    entities: snapshot.replayState.state.entities.map((entity, index) => index === 0
      ? { ...entity, anchor: [999, 0, 0] } : entity),
  },
}, 'Forged replay evidence');
const forgedDocument = deriveReferenceDocument(forgedReplay.state);
const forgedScene = deriveReferenceEngineeringScene(forgedDocument);
const forgedBase = {
  ...snapshot,
  document: forgedDocument,
  replayState: forgedReplay,
  engineeringScene: forgedScene,
  documentHash: hashReferenceValue(forgedDocument),
  replayHash: hashReferenceValue(forgedReplay),
};
const forgedSnapshot = immutableJson({
  ...forgedBase,
  snapshotId: createReferenceSnapshotId(forgedBase),
}, 'Forged replay-ancestry snapshot');
assert.equal(assertScopedEditReferenceSnapshot(forgedSnapshot), forgedSnapshot);
assert.throws(() => certifyScopedEditReferenceSnapshot(forgedSnapshot, {
  reducerRegistry: fixture.reducerRegistry,
}), /replay ancestry/);
checked += 2;

const reordered = { b: 2, a: { d: 4, c: 3 } };
const canonical = { a: { c: 3, d: 4 }, b: 2 };
assert.equal(canonicalReferenceJson(reordered), canonicalReferenceJson(canonical));
assert.equal(hashReferenceValue(reordered), hashReferenceValue(canonical));
checked += 2;

const baseEntity = fixture.initialDocument.entities[0];
assert.throws(() => createScopedEditReferenceDocument({
  ...fixture.initialDocument,
  entities: [{ ...baseEntity, unsupported: true }, ...fixture.initialDocument.entities.slice(1)],
}), /unsupported fields/);
assert.throws(() => createScopedEditReferenceDocument({
  ...fixture.initialDocument,
  entities: [{ ...baseEntity, anchor: [1, 2, Number.NaN] }, ...fixture.initialDocument.entities.slice(1)],
}), /finite/);
assert.throws(() => createScopedEditReferenceDocument({
  ...fixture.initialDocument,
  entities: [{ ...baseEntity, referenceIds: ['missing'] }, ...fixture.initialDocument.entities.slice(1)],
}), /does not exist/);
assert.throws(() => createScopedEditReferenceDocument({
  ...fixture.initialDocument,
  entities: [{ ...baseEntity, structuralIds: ['b', 'b'] }, ...fixture.initialDocument.entities.slice(1)],
}), /unique/);

assert.throws(() => createScopedEditReferenceDocument({
  ...fixture.initialDocument,
  entities: [{ ...baseEntity, remark: 42 }, ...fixture.initialDocument.entities.slice(1)],
}), /null or text/);
checked += 5;

const unsorted = createScopedEditReferenceDocument({
  ...fixture.initialDocument,
  entities: [...fixture.initialDocument.entities].reverse(),
});
assert.deepEqual(unsorted, fixture.initialDocument);
checked += 1;

console.log(`[PASS] scoped-edit reference contracts: ${checked} deterministic contract cases.`);
