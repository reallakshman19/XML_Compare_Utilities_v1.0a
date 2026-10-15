import assert from 'node:assert/strict';
import { createDomainReducerRegistry } from '../core/edit-journal/index.js';
import { immutableJson } from '../contracts/contract-values.js';
import {
  createScopedEditReferenceStore,
  deriveReferenceEngineeringScene,
} from '../core/scoped-edit-reference-host/index.js';
import {
  createScopedEditReferenceHostFixture,
} from './fixtures/scoped-edit-reference-host-fixture.js';

const fixture = createScopedEditReferenceHostFixture();
let checked = 0;

function corruptProjection(result) {
  return immutableJson({
    ...result,
    journalProjection: {
      ...result.journalProjection,
      initialState: { ...result.journalProjection.initialState, corruptProjection: true },
    },
  }, 'Corrupt projection');
}

function corruptReplay(result) {
  return immutableJson({
    ...result,
    replayState: {
      ...result.replayState,
      state: { ...result.replayState.state, corruptReplay: true },
    },
  }, 'Corrupt replay');
}

function corruptIdentity(result, kind) {
  const envelopes = result.journalProjection.envelopes.map((entry, index, values) => {
    if (index !== values.length - 1) return entry;
    if (kind === 'commandId') return { ...entry, commandId: 'CJ-999999' };
    if (kind === 'sequence') return { ...entry, sequence: entry.sequence + 9 };
    if (kind === 'sessionId') return { ...entry, sessionId: 'reference-session:wrong' };
    return { ...entry, documentId: 'reference-document:wrong' };
  });
  if (kind !== 'commandId') {
    return immutableJson({
      ...result,
      journalProjection: { ...result.journalProjection, envelopes },
    }, 'Corrupt identity result');
  }
  const oldId = result.commandId;
  const newId = 'CJ-999999';
  return immutableJson({
    ...result,
    commandId: newId,
    journalProjection: {
      ...result.journalProjection,
      envelopes,
      activeCommandIds: result.journalProjection.activeCommandIds.map((id) => id === oldId ? newId : id),
    },
    replayState: {
      ...result.replayState,
      appliedCommandIds: result.replayState.appliedCommandIds.map((id) => id === oldId ? newId : id),
    },
    appliedCommandIds: result.appliedCommandIds.map((id) => id === oldId ? newId : id),
  }, 'Corrupt command id result');
}

function assertFailure(failure, snapshot, reasonCode) {
  assert.equal(failure.accepted, false);
  assert.equal(failure.reasonCode, reasonCode);
  assert.equal(typeof failure.message, 'string');
  assert.equal(failure.message.length > 0, true);
  assert.equal(failure.currentSnapshotId, snapshot.snapshotId);
  assert.equal(failure.unchangedVersion, snapshot.version);
  assert.equal(failure.snapshot, null);
  assert.equal(Object.isFrozen(failure), true);
  assert.doesNotThrow(() => JSON.stringify(failure));
}
const templateStore = fixture.createStore();
const templateTx = fixture.createRuntimeCandidate(templateStore, {
  issuedAt: '2026-07-25T15:00:00.000Z',
});
const successSnapshots = new Set();
const journalOrders = new Set();
const replayOrders = new Set();
const successInput = JSON.stringify({ document: fixture.initialDocument, journal: fixture.commandJournal });
for (let index = 0; index < 1000; index += 1) {
  const store = fixture.createStore();
  const before = store.getSnapshot();
  const acceptance = store.acceptCommitResult({
    expectedSnapshotId: before.snapshotId,
    result: templateTx.result,
    acceptedAt: templateTx.issuedAt,
  });
  assert.equal(acceptance.accepted, true);
  const accepted = store.getSnapshot();
  assert.equal(accepted.version, 1);
  assert.equal(accepted.commandJournal.entries.length, 1);
  assert.deepEqual(accepted.document.entities.find((entity) => entity.entityId === templateTx.entityId).anchor,
    templateTx.dragResult.point);
  assert.deepEqual(accepted.engineeringScene.entities.find((entity) => entity.id === templateTx.entityId)
    .metadata.authoritativeGeometry.anchor, templateTx.dragResult.point);
  successSnapshots.add(accepted.snapshotId);
  journalOrders.add(accepted.commandJournal.entries.map((entry) => entry.commandId).join(','));
  replayOrders.add(accepted.replayState.appliedCommandIds.join(','));
  store.destroy();
}
assert.equal(successSnapshots.size, 1);
assert.equal(journalOrders.size, 1);
assert.equal(replayOrders.size, 1);
assert.equal(successInput, JSON.stringify({ document: fixture.initialDocument, journal: fixture.commandJournal }));
checked += 1004;

const projectionStore = fixture.createStore();
const projectionBefore = projectionStore.getSnapshot();
const projectionResult = corruptProjection(templateTx.result);
for (let index = 0; index < 500; index += 1) {
  const failure = projectionStore.acceptCommitResult({
    expectedSnapshotId: projectionBefore.snapshotId,
    result: projectionResult,
    acceptedAt: templateTx.issuedAt,
  });
  assert.equal(failure.reasonCode, 'PROJECTION_MISMATCH');
  assert.equal(projectionStore.getSnapshot(), projectionBefore);
}
checked += 500;

const replayStore = fixture.createStore();
const replayBefore = replayStore.getSnapshot();
const replayResult = corruptReplay(templateTx.result);
for (let index = 0; index < 500; index += 1) {
  const failure = replayStore.acceptCommitResult({
    expectedSnapshotId: replayBefore.snapshotId,
    result: replayResult,
    acceptedAt: templateTx.issuedAt,
  });
  assert.equal(failure.reasonCode, 'REPLAY_MISMATCH');
  assert.equal(replayStore.getSnapshot(), replayBefore);
}
checked += 500;

const identityCounts = { WRONG_COMMAND_ID: 0, WRONG_SEQUENCE: 0, WRONG_SESSION_ID: 0, WRONG_DOCUMENT_ID: 0 };
const identityKinds = ['commandId', 'sequence', 'sessionId', 'documentId'];
const identityResults = Object.fromEntries(identityKinds.map((kind) => [kind, corruptIdentity(templateTx.result, kind)]));
const identityStore = fixture.createStore();
const identityBefore = identityStore.getSnapshot();
for (let index = 0; index < 500; index += 1) {
  const kind = identityKinds[index % identityKinds.length];
  const failure = identityStore.acceptCommitResult({
    expectedSnapshotId: identityBefore.snapshotId,
    result: identityResults[kind],
    acceptedAt: templateTx.issuedAt,
  });
  identityCounts[failure.reasonCode] += 1;
  assert.equal(identityStore.getSnapshot(), identityBefore);
}
assert.deepEqual(identityCounts, {
  WRONG_COMMAND_ID: 125,
  WRONG_SEQUENCE: 125,
  WRONG_SESSION_ID: 125,
  WRONG_DOCUMENT_ID: 125,
});
checked += 501;
templateTx.runtime.destroy();
templateStore.destroy();
const duplicateStore = fixture.createStore();
const duplicateTx = fixture.createRuntimeCandidate(duplicateStore, { issuedAt: '2026-07-25T15:04:00.000Z' });
assert.equal(duplicateStore.acceptCommitResult({
  expectedSnapshotId: duplicateTx.snapshot.snapshotId,
  result: duplicateTx.result,
  acceptedAt: duplicateTx.issuedAt,
}).accepted, true);
const duplicateSnapshot = duplicateStore.getSnapshot();
const duplicateFailure = duplicateStore.acceptCommitResult({
  expectedSnapshotId: duplicateTx.snapshot.snapshotId,
  result: duplicateTx.result,
  acceptedAt: duplicateTx.issuedAt,
});
assertFailure(duplicateFailure, duplicateSnapshot, 'STALE_REFERENCE_SNAPSHOT');
assert.equal(duplicateStore.getSnapshot(), duplicateSnapshot);
checked += 3;

const rejectedStore = fixture.createStore();
const rejectedTx = fixture.createRuntimeCandidate(rejectedStore, {
  boundaryPolicy: 'FROZEN',
  targetIds: [fixture.editableIds[0], fixture.boundaryIds[0]],
  issuedAt: '2026-07-25T15:05:00.000Z',
});
const rejectedBefore = rejectedStore.getSnapshot();
const rejectedFailure = rejectedStore.acceptCommitResult({
  expectedSnapshotId: rejectedTx.snapshot.snapshotId,
  result: rejectedTx.result,
  acceptedAt: rejectedTx.issuedAt,
});
assertFailure(rejectedFailure, rejectedBefore, 'REJECTED_COMMIT_RESULT');
assert.equal(rejectedStore.getSnapshot(), rejectedBefore);
checked += 1;

const historyStore = fixture.createStore();
const first = fixture.createRuntimeCandidate(historyStore, { issuedAt: '2026-07-25T15:06:00.000Z' });
historyStore.acceptCommitResult({ expectedSnapshotId: first.snapshot.snapshotId, result: first.result, acceptedAt: first.issuedAt });
const second = fixture.createRuntimeCandidate(historyStore, { issuedAt: '2026-07-25T15:07:00.000Z', index: 1 });
const historyBefore = historyStore.getSnapshot();
const historicalId = historyBefore.commandJournal.entries[0].commandId;
const missing = immutableJson({
  ...second.result,
  commandId: historicalId,
  journalProjection: historyStore.getSnapshot().journalProjection,
  replayState: historyStore.getSnapshot().replayState,
  appliedCommandIds: historyStore.getSnapshot().replayState.appliedCommandIds,
}, 'Missing append result');
const missingFailure = historyStore.acceptCommitResult({
  expectedSnapshotId: second.snapshot.snapshotId,
  result: missing,
  acceptedAt: second.issuedAt,
});
assertFailure(missingFailure, historyBefore, 'MISSING_APPENDED_COMMAND');
assert.equal(historyStore.getSnapshot(), historyBefore);
const changedHistory = immutableJson({
  ...second.result,
  journalProjection: {
    ...second.result.journalProjection,
    envelopes: second.result.journalProjection.envelopes.map((entry, index) => index === 0
      ? { ...entry, payload: { ...entry.payload, changedHistory: true } } : entry),
  },
}, 'Changed history result');
const historyFailure = historyStore.acceptCommitResult({
  expectedSnapshotId: second.snapshot.snapshotId,
  result: changedHistory,
  acceptedAt: second.issuedAt,
});
assertFailure(historyFailure, historyBefore, 'HISTORICAL_ENVELOPE_CHANGED');
assert.equal(historyStore.getSnapshot(), historyBefore);
checked += 2;


const inactiveStore = fixture.createStore();
const inactiveTx = fixture.createRuntimeCandidate(inactiveStore, { issuedAt: '2026-07-25T15:07:30.000Z' });
const inactiveBefore = inactiveStore.getSnapshot();
const inactiveResult = immutableJson({
  ...inactiveTx.result,
  journalProjection: { ...inactiveTx.result.journalProjection, activeCommandIds: [] },
  replayState: { ...inactiveTx.result.replayState, appliedCommandIds: [] },
  appliedCommandIds: [],
}, 'Inactive command result');
const inactiveFailure = inactiveStore.acceptCommitResult({
  expectedSnapshotId: inactiveBefore.snapshotId,
  result: inactiveResult,
  acceptedAt: inactiveTx.issuedAt,
});
assertFailure(inactiveFailure, inactiveBefore, 'INACTIVE_COMMITTED_COMMAND');
assert.equal(inactiveStore.getSnapshot(), inactiveBefore);
checked += 1;

function malformedRegistry(anchor) {
  return createDomainReducerRegistry({
    REFERENCE_POSITION_SET: (state) => immutableJson({
      ...state,
      entities: anchor === 'missing' ? null : state.entities.map((entity, index) => index === 0
        ? { ...entity, anchor: ['bad', 0, 0] } : entity),
    }, 'Malformed replay state'),
  });
}

for (const [anchor, reasonCode] of [['missing', 'DOCUMENT_RECONSTRUCTION_FAILED'], ['bad', 'NON_FINITE_GEOMETRY']]) {
  const badFixture = createScopedEditReferenceHostFixture({ reducerRegistry: malformedRegistry(anchor) });
  const badStore = badFixture.createStore();
  const tx = badFixture.createRuntimeCandidate(badStore, { issuedAt: '2026-07-25T15:08:00.000Z' });
  assert.equal(tx.result.status, 'COMMITTED');
  assert.equal(badStore.acceptCommitResult({
    expectedSnapshotId: tx.snapshot.snapshotId,
    result: tx.result,
    acceptedAt: tx.issuedAt,
  }).reasonCode, reasonCode);
  checked += 2;
}

const sceneStore = createScopedEditReferenceStore({
  initialDocument: fixture.initialDocument,
  commandJournal: fixture.commandJournal,
  reducerRegistry: fixture.reducerRegistry,
  sceneAdapter: (document) => {
    if (document.revision > 0) throw new TypeError('injected scene derivation failure');
    return deriveReferenceEngineeringScene(document);
  },
});
const sceneTx = fixture.createRuntimeCandidate(sceneStore, { issuedAt: '2026-07-25T15:09:00.000Z' });
const sceneBefore = sceneStore.getSnapshot();
const sceneFailure = sceneStore.acceptCommitResult({
  expectedSnapshotId: sceneTx.snapshot.snapshotId,
  result: sceneTx.result,
  acceptedAt: sceneTx.issuedAt,
});
assertFailure(sceneFailure, sceneBefore, 'SCENE_DERIVATION_FAILED');
assert.equal(sceneStore.getSnapshot(), sceneBefore);
checked += 1;

console.log(`[PASS] scoped-edit reference acceptance: ${checked} atomic acceptance and rejection cases.`);
