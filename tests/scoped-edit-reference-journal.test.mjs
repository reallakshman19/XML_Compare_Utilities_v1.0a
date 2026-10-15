import assert from 'node:assert/strict';
import {
  checkpointCommandJournal,
  parseCommandJournal,
  redoCommandJournal,
  serializeCommandJournal,
  undoCommandJournal,
} from '../contracts/command-journal.js';
import {
  certifyReferenceJournalCheckpoints,
  deriveReferenceDocument,
  projectReferenceJournal,
  replayReferenceJournal,
} from '../core/scoped-edit-reference-host/index.js';
import { createScopedEditReferenceHostFixture } from './fixtures/scoped-edit-reference-host-fixture.js';

const fixture = createScopedEditReferenceHostFixture();
const store = fixture.createStore();
const snapshots = [store.getSnapshot()];

for (let index = 0; index < 3; index += 1) {
  const tx = fixture.createRuntimeCandidate(store, {
    kind: 'STRUCTURAL',
    index,
    issuedAt: `2026-07-25T17:0${index}:00.000Z`,
  });
  const acceptance = store.acceptCommitResult({
    expectedSnapshotId: tx.snapshot.snapshotId,
    result: tx.result,
    acceptedAt: tx.issuedAt,
  });
  assert.equal(acceptance.accepted, true);
  snapshots.push(store.getSnapshot());
}

const [s0, , s2, s3] = snapshots;
assert.equal(s3.commandJournal.entries.length, 3);
assert.equal(s3.commandJournal.activeCommandIds.length, 3);

let roundTrips = 0;
let undoRedoCycles = 0;
let checkpointRoundTrips = 0;
for (let index = 0; index < 100; index += 1) {
  const checkpointed = checkpointCommandJournal(
    s3.commandJournal,
    s3.replayHash,
    '2026-07-25T17:10:00.000Z',
  );
  const serialized = serializeCommandJournal(checkpointed);
  const parsed = parseCommandJournal(serialized);
  assert.deepEqual(parsed.entries, checkpointed.entries);
  assert.deepEqual(parsed.activeCommandIds, checkpointed.activeCommandIds);
  assert.deepEqual(parsed.redoCommandIds, checkpointed.redoCommandIds);
  assert.deepEqual(parsed.checkpoints, checkpointed.checkpoints);
  assert.equal(certifyReferenceJournalCheckpoints({
    initialState: s0.journalProjection.initialState,
    commandJournal: parsed,
    reducerRegistry: fixture.reducerRegistry,
  }), parsed);
  const projection = projectReferenceJournal({
    initialState: s0.journalProjection.initialState,
    commandJournal: parsed,
  });
  const replay = replayReferenceJournal({
    initialState: s0.journalProjection.initialState,
    commandJournal: parsed,
    reducerRegistry: fixture.reducerRegistry,
  });
  assert.deepEqual(projection.envelopes, s3.journalProjection.envelopes);
  assert.deepEqual(projection.activeCommandIds, s3.journalProjection.activeCommandIds);
  assert.deepEqual(replay, s3.replayState);
  roundTrips += 1;

  const undone = undoCommandJournal(parsed, '2026-07-25T17:11:00.000Z');
  assert.equal(undone.entries.length, 3);
  assert.deepEqual(undone.entries, parsed.entries);
  assert.deepEqual(undone.redoCommandIds, [parsed.activeCommandIds.at(-1)]);
  const undoReplay = replayReferenceJournal({
    initialState: s0.journalProjection.initialState,
    commandJournal: undone,
    reducerRegistry: fixture.reducerRegistry,
  });
  assert.deepEqual(deriveReferenceDocument(undoReplay.state), s2.document);
  const redone = redoCommandJournal(undone, '2026-07-25T17:12:00.000Z');
  assert.equal(redone.entries.length, 3);
  assert.deepEqual(redone.entries, parsed.entries);
  assert.deepEqual(redone.redoCommandIds, []);
  const redoReplay = replayReferenceJournal({
    initialState: s0.journalProjection.initialState,
    commandJournal: redone,
    reducerRegistry: fixture.reducerRegistry,
  });
  assert.deepEqual(deriveReferenceDocument(redoReplay.state), s3.document);
  assert.deepEqual(redoReplay, s3.replayState);
  undoRedoCycles += 1;

  const checkpoint = parsed.checkpoints.at(-1);
  assert.deepEqual(checkpoint.activeCommandIds, parsed.activeCommandIds);
  assert.equal(checkpoint.stateHash, s3.replayHash);
  assert.deepEqual(parseCommandJournal(serializeCommandJournal(parsed)).checkpoints, parsed.checkpoints);
  checkpointRoundTrips += 1;
}

const corruptedCheckpoint = checkpointCommandJournal(
  s3.commandJournal,
  'RH1-0000000000000000',
  '2026-07-25T17:13:00.000Z',
);
const parsedCorruption = parseCommandJournal(serializeCommandJournal(corruptedCheckpoint));
assert.throws(() => certifyReferenceJournalCheckpoints({
  initialState: s0.journalProjection.initialState,
  commandJournal: parsedCorruption,
  reducerRegistry: fixture.reducerRegistry,
}), /stateHash is inconsistent/);

assert.deepEqual({ roundTrips, undoRedoCycles, checkpointRoundTrips }, {
  roundTrips: 100,
  undoRedoCycles: 100,
  checkpointRoundTrips: 100,
});

console.log('[PASS] scoped-edit reference journal: 100 round-trips, 100 undo/redo cycles, 100 checkpoint round-trips, and corrupted-checkpoint rejection.');
