import assert from 'node:assert/strict';
import { createScopedEditRuntime } from '../core/scoped-edit-runtime/index.js';
import {
  createScopedEditJournalProjection,
  createScopedEditRuntimeFixture,
  scopedEditEnvelope,
} from './fixtures/scoped-edit-runtime-fixture.js';

let corruptionCases = 0, replayFailureCases = 0, undoRedoProjections = 0, inputMutations = 0;

function runtimeFor(fixture) {
  return createScopedEditRuntime({
    host: fixture.host, scopeRequest: fixture.scopeRequest,
    reducerRegistry: fixture.reducerRegistry, journalProjection: fixture.journalProjection,
  });
}

function commit(fixture, sequence) {
  const runtime = runtimeFor(fixture);
  runtime.beginDrag({ entityId: 'E-01', dragRequest: fixture.dragRequest('E-01') });
  const drag = runtime.solveDrag(fixture.validRay('E-01'));
  const envelope = fixture.envelope(sequence, 'ENTITY_POSITION_SET', 'E-01', drag.point);
  runtime.prepareCommit({ commandName: 'ENTITY_POSITION_SET', targetIds: ['E-01'], envelope });
  return { runtime, result: runtime.commitPrepared(), envelope };
}

{
  const fixture = createScopedEditRuntimeFixture();
  const { result, envelope } = commit(fixture, 1);
  assert.equal(result.status, 'COMMITTED');
  assert.deepEqual(fixture.readEvidence().callOrder, [`append:${envelope.commandId}`, `replay:${envelope.commandId}`]);
}

const seed = scopedEditEnvelope(1, 'ENTITY_REMARK_SET', 'E-02', 'seed');
const seededProjection = createScopedEditJournalProjection([seed], [seed.commandId]);
for (const corruption of ['DROP_EXISTING', 'CHANGE_EXISTING', 'OMIT_APPENDED', 'MUTABLE']) {
  const fixture = createScopedEditRuntimeFixture({ corruption, journalProjection: seededProjection });
  const before = JSON.stringify({ scene: fixture.scene, request: fixture.scopeRequest, projection: fixture.journalProjection });
  const acceptedReplay = runtimeFor(createScopedEditRuntimeFixture({ journalProjection: seededProjection })).getState().replayState;
  const runtime = runtimeFor(fixture);
  runtime.beginDrag({ entityId: 'E-01', dragRequest: fixture.dragRequest('E-01') });
  const drag = runtime.solveDrag(fixture.validRay('E-01'));
  const envelope = fixture.envelope(2, 'ENTITY_POSITION_SET', 'E-01', drag.point);
  runtime.prepareCommit({ commandName: 'ENTITY_POSITION_SET', targetIds: ['E-01'], envelope });
  const result = runtime.commitPrepared();
  assert.equal(result.status, 'REJECTED');
  assert.equal(result.rejectionCode, 'APPEND_PROJECTION_INVALID');
  assert.deepEqual(result.journalProjection, seededProjection);
  assert.deepEqual(result.replayState, acceptedReplay);
  assert.deepEqual(runtime.getState().journalProjection, seededProjection);
  assert.equal(fixture.readEvidence().appendCalls, 1);
  assert.equal(fixture.readEvidence().reducerCalls, 1, 'only the accepted seed projection is replayed');
  if (before !== JSON.stringify({ scene: fixture.scene, request: fixture.scopeRequest, projection: fixture.journalProjection })) {
    inputMutations += 1;
  }
  corruptionCases += 1;
}

{
  const fixture = createScopedEditRuntimeFixture({ failCommandType: 'ENTITY_POSITION_SET' });
  const before = runtimeFor(createScopedEditRuntimeFixture()).getState();
  const { runtime, result } = commit(fixture, 1);
  assert.equal(result.status, 'REJECTED');
  assert.equal(result.rejectionCode, 'REPLAY_FAILED');
  assert.match(result.message, /Command SER-000001 \(ENTITY_POSITION_SET\) failed/);
  assert.match(result.message, /synthetic reducer fault/);
  assert.deepEqual(result.journalProjection, fixture.journalProjection);
  assert.deepEqual(result.replayState, before.replayState);
  assert.deepEqual(runtime.getState().journalProjection, fixture.journalProjection);
  assert.equal(fixture.readEvidence().appendCalls, 1);
  assert.equal(fixture.readEvidence().reducerCalls, 1);
  replayFailureCases += 1;
}

const commandTypes = ['ENTITY_POSITION_SET', 'ENTITY_ATTRIBUTE_SET', 'ENTITY_REMARK_SET'];
const envelopes = Object.freeze(Array.from({ length: 6 }, (_, index) => {
  const sequence = index + 1, type = commandTypes[index % commandTypes.length];
  return scopedEditEnvelope(sequence, type, `E-0${(index % 3) + 1}`);
}));
const envelopeSnapshot = JSON.stringify(envelopes);
for (let index = 0; index < 100; index += 1) {
  const active = envelopes.filter((_, envelopeIndex) => (envelopeIndex + index) % 3 !== 0)
    .map((envelope) => envelope.commandId).reverse();
  const projection = createScopedEditJournalProjection(envelopes, active);
  const firstFixture = createScopedEditRuntimeFixture({ journalProjection: projection });
  const secondFixture = createScopedEditRuntimeFixture({ journalProjection: projection });
  const first = runtimeFor(firstFixture).getState(), second = runtimeFor(secondFixture).getState();
  const expectedOrder = envelopes.filter((envelope) => active.includes(envelope.commandId)).map((envelope) => envelope.commandId);
  assert.deepEqual(first.replayState, second.replayState);
  assert.deepEqual(first.appliedCommandIds, expectedOrder);
  assert.deepEqual(second.appliedCommandIds, expectedOrder);
  assert.deepEqual(first.journalProjection.envelopes, envelopes);
  assert.doesNotThrow(() => JSON.stringify(first.replayState));
  undoRedoProjections += 1;
}
if (envelopeSnapshot !== JSON.stringify(envelopes)) inputMutations += 1;
assert.equal(inputMutations, 0);
assert.deepEqual({ corruptionCases, replayFailureCases, undoRedoProjections }, {
  corruptionCases: 4, replayFailureCases: 1, undoRedoProjections: 100,
});
console.log('[PASS] scoped-edit replay: append-before-replay, corruption=4, reducer-failure=1, undo/redo projections=100.');
