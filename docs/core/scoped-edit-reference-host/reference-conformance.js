/** Reference-host-only transaction conformance certification. */
import {
  checkpointCommandJournal,
  parseCommandJournal,
  redoCommandJournal,
  serializeCommandJournal,
  undoCommandJournal,
} from '../../contracts/command-journal.js';
import { immutableJson } from '../../contracts/contract-values.js';
import { createScopedEditRuntime } from '../scoped-edit-runtime/index.js';
import {
  assertScopedEditReferenceDocument,
  assertScopedEditReferenceSnapshot,
  deriveReferenceDocument,
  isReferenceDeeplyFrozen,
} from './reference-document-contracts.js';
import { projectReferenceJournal, replayReferenceJournal } from './reference-journal-adapter.js';
import { deriveReferenceEngineeringScene } from './reference-scene-adapter.js';

export const SCOPED_EDIT_REFERENCE_HOST_CONFORMANCE_V1 = 'ScopedEditReferenceHostConformance.v1';

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requiredFixture(value) {
  if (!value?.referenceHostOnly || value.productionConsumer === true) {
    throw new TypeError('Reference conformance requires an explicit non-production reference fixture.');
  }
  for (const name of ['createStore', 'scopeRequest', 'dragRequest', 'validRay', 'createEnvelope']) {
    if (typeof value[name] !== 'function') throw new TypeError(`Reference fixture is missing ${name}().`);
  }
  return value;
}

function commitOnce(fixture, store, kind = 'STRUCTURAL', issuedAt = '2026-07-25T12:00:00.000Z') {
  const snapshot = store.getSnapshot();
  const host = store.createRuntimeHost();
  const runtime = createScopedEditRuntime({
    host,
    scopeRequest: fixture.scopeRequest(kind),
    reducerRegistry: fixture.reducerRegistry,
    journalProjection: snapshot.journalProjection,
  });
  const entityId = fixture.scopeEntityId(kind);
  runtime.beginDrag({ entityId, dragRequest: fixture.dragRequest(entityId, snapshot.document) });
  const drag = runtime.solveDrag(fixture.validRay(entityId, snapshot.document));
  const envelope = fixture.createEnvelope(snapshot, 'REFERENCE_POSITION_SET', {
    targetId: entityId,
    position: drag.point,
  }, issuedAt);
  runtime.prepareCommit({ commandName: 'REFERENCE_POSITION_SET', targetIds: [entityId], envelope });
  return { snapshot, host, runtime, envelope, result: runtime.commitPrepared(), entityId, issuedAt };
}

function corruptedProjection(result) {
  return immutableJson({
    ...result,
    journalProjection: {
      ...result.journalProjection,
      initialState: { ...result.journalProjection.initialState, corruptProjection: true },
    },
  }, 'Corrupt reference projection result');
}

function corruptedReplay(result) {
  return immutableJson({
    ...result,
    replayState: {
      ...result.replayState,
      state: { ...result.replayState.state, corruptReplay: true },
    },
  }, 'Corrupt reference replay result');
}

function primaryEvidence(fixture) {
  const store = fixture.createStore();
  const initial = store.getSnapshot();
  const transaction = commitOnce(fixture, store);
  const beforeAcceptance = store.getSnapshot();
  const candidateAgain = transaction.host.appendEditCommand(initial.journalProjection, transaction.envelope);
  const candidateTwice = transaction.host.appendEditCommand(initial.journalProjection, transaction.envelope);
  const acceptance = store.acceptCommitResult({
    expectedSnapshotId: initial.snapshotId,
    result: transaction.result,
    acceptedAt: transaction.issuedAt,
  });
  const accepted = store.getSnapshot();
  const stale = store.acceptCommitResult({
    expectedSnapshotId: initial.snapshotId,
    result: transaction.result,
    acceptedAt: transaction.issuedAt,
  });
  const afterStale = store.getSnapshot();
  return { initial, transaction, beforeAcceptance, candidateAgain, candidateTwice,
    acceptance, accepted, stale, afterStale };
}

function corruptionEvidence(fixture, kind, corrupt, issuedAt) {
  const store = fixture.createStore();
  const transaction = commitOnce(fixture, store, kind, issuedAt);
  const before = store.getSnapshot();
  const failure = store.acceptCommitResult({
    expectedSnapshotId: transaction.snapshot.snapshotId,
    result: corrupt(transaction.result),
    acceptedAt: transaction.issuedAt,
  });
  return { transaction, before, failure, after: store.getSnapshot() };
}

function journalEvidence(fixture, initial, accepted) {
  const parsed = parseCommandJournal(serializeCommandJournal(accepted.commandJournal));
  const input = { initialState: initial.journalProjection.initialState, reducerRegistry: fixture.reducerRegistry };
  const projection = projectReferenceJournal({ initialState: input.initialState, commandJournal: parsed });
  const replay = replayReferenceJournal({ ...input, commandJournal: parsed });
  const undone = undoCommandJournal(parsed, '2026-07-25T12:03:00.000Z');
  const undoReplay = replayReferenceJournal({ ...input, commandJournal: undone });
  const redone = redoCommandJournal(undone, '2026-07-25T12:04:00.000Z');
  const redoReplay = replayReferenceJournal({ ...input, commandJournal: redone });
  const checkpointed = checkpointCommandJournal(parsed, accepted.replayHash, '2026-07-25T12:05:00.000Z');
  const checkpointParsed = parseCommandJournal(serializeCommandJournal(checkpointed));
  return { parsed, projection, replay, undoReplay, redoReplay, checkpointed, checkpointParsed };
}

function destroyEvidence(fixture, result, acceptedAt) {
  const store = fixture.createStore();
  const snapshot = store.getSnapshot();
  store.destroy();
  let hostRejected = false;
  try {
    store.createRuntimeHost();
  } catch (error) {
    hostRejected = error.code === 'REFERENCE_STORE_DESTROYED';
  }
  const acceptance = store.acceptCommitResult({ expectedSnapshotId: snapshot.snapshotId, result, acceptedAt });
  return { hostRejected, acceptance };
}

function certify(checks) {
  const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  if (failed.length) throw new Error(`Reference-host conformance failed: ${failed.join(', ')}.`);
  return checks;
}

function conformanceChecks(fixture, before, primary, projection, replay, journal, destroyed) {
  const { initial, transaction, beforeAcceptance, candidateAgain, candidateTwice,
    acceptance, accepted, stale, afterStale } = primary;
  return certify({
    referenceDocumentValid: assertScopedEditReferenceDocument(fixture.initialDocument) === fixture.initialDocument,
    snapshotInternallyConsistent: assertScopedEditReferenceSnapshot(initial) === initial,
    sceneDerivationDeterministic: sameJson(initial.engineeringScene, deriveReferenceEngineeringScene(initial.document)),
    hostAppendPure: sameJson(candidateAgain, candidateTwice) && sameJson(beforeAcceptance, initial),
    journalAppendCanonical: sameJson(candidateAgain, transaction.result.journalProjection),
    runtimeCandidateCommitted: transaction.result.status === 'COMMITTED',
    storeUnchangedBeforeAcceptance: sameJson(beforeAcceptance, initial),
    acceptanceAtomic: acceptance.accepted && accepted.version === initial.version + 1,
    staleAcceptanceRejected: !stale.accepted && stale.reasonCode === 'STALE_REFERENCE_SNAPSHOT'
      && afterStale === accepted,
    projectionCorruptionRejected: !projection.failure.accepted
      && projection.failure.reasonCode === 'PROJECTION_MISMATCH' && projection.after === projection.before,
    replayCorruptionRejected: !replay.failure.accepted
      && replay.failure.reasonCode === 'REPLAY_MISMATCH' && replay.after === replay.before,
    journalRoundTripDeterministic: sameJson(journal.projection, accepted.journalProjection)
      && sameJson(journal.replay, accepted.replayState),
    undoDeterministic: sameJson(deriveReferenceDocument(journal.undoReplay.state), initial.document),
    redoDeterministic: sameJson(journal.redoReplay, accepted.replayState),
    checkpointPreserved: sameJson(journal.checkpointParsed.checkpoints, journal.checkpointed.checkpoints)
      && sameJson(journal.checkpointed.activeCommandIds, journal.parsed.activeCommandIds),
    destroyTerminal: destroyed.hostRejected && destroyed.acceptance.reasonCode === 'REFERENCE_STORE_DESTROYED',
    inputsUnchanged: before === JSON.stringify({ document: fixture.initialDocument, journal: fixture.commandJournal }),
    outputsImmutable: [initial, transaction.result, acceptance, accepted, stale]
      .every((value) => isReferenceDeeplyFrozen(value)),
  });
}

export function runScopedEditReferenceHostConformance(input = {}) {
  const fixture = requiredFixture(input.fixtures);
  const before = JSON.stringify({ document: fixture.initialDocument, journal: fixture.commandJournal });
  const primary = primaryEvidence(fixture);
  const projection = corruptionEvidence(
    fixture, 'SELECTION', corruptedProjection, '2026-07-25T12:01:00.000Z',
  );
  const replay = corruptionEvidence(
    fixture, 'SECTIONAL', corruptedReplay, '2026-07-25T12:02:00.000Z',
  );
  const journal = journalEvidence(fixture, primary.initial, primary.accepted);
  const destroyed = destroyEvidence(fixture, primary.transaction.result, primary.transaction.issuedAt);
  const checks = conformanceChecks(fixture, before, primary, projection, replay, journal, destroyed);
  return immutableJson({
    schema: SCOPED_EDIT_REFERENCE_HOST_CONFORMANCE_V1,
    passed: true,
    referenceHostOnly: true,
    checks,
  }, 'Reference host conformance report');
}
