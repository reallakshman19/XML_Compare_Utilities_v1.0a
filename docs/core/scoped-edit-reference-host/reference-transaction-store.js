/** In-memory optimistic transaction store for the non-production reference host. */
import { appendJournalCommand, validateCommandJournal } from '../../contracts/command-journal.js';
import { immutableJson, isIsoTimestamp } from '../../contracts/contract-values.js';
import { SCOPED_EDIT_COMMIT_STATUS, validateScopedEditCommitResult } from '../scoped-edit-runtime/index.js';
import {
  SCOPED_EDIT_REFERENCE_ACCEPTANCE_V1,
  SCOPED_EDIT_REFERENCE_SNAPSHOT_V1,
  assertScopedEditReferenceDocument,
  assertScopedEditReferenceSnapshot,
  createReferenceInitialState,
  createReferenceSnapshotId,
  deriveReferenceDocument,
  hashReferenceValue,
} from './reference-document-contracts.js';
import {
  REFERENCE_POSITION_SET,
  certifyScopedEditReferenceSnapshot,
  createReferenceReducerRegistry,
  projectReferenceJournal,
  replayReferenceJournal,
} from './reference-journal-adapter.js';
import { createScopedEditReferenceRuntimeHost } from './reference-runtime-host.js';
import { deriveReferenceEngineeringScene } from './reference-scene-adapter.js';

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function codedError(code, message, Constructor = TypeError) {
  const error = new Constructor(message);
  error.code = code;
  return error;
}

function validJournal(journal, documentId) {
  const errors = validateCommandJournal(journal);
  if (errors.length) throw new TypeError(`Invalid reference journal: ${errors.join('; ')}`);
  if (journal.documentId !== documentId) throw new TypeError('Reference journal documentId does not match the document.');
  return journal;
}

function constructSnapshot({ version, document, commandJournal, projection, replayState, scene }) {
  const documentHash = hashReferenceValue(document);
  const replayHash = hashReferenceValue(replayState);
  const snapshot = immutableJson({
    schema: SCOPED_EDIT_REFERENCE_SNAPSHOT_V1,
    snapshotId: createReferenceSnapshotId({ version, documentHash, replayHash, commandJournal }),
    version,
    document,
    commandJournal,
    journalProjection: projection,
    replayState,
    engineeringScene: scene,
    documentHash,
    replayHash,
  }, 'Reference snapshot');
  return assertScopedEditReferenceSnapshot(snapshot);
}

function certifySnapshot(snapshot, configuration) {
  return certifyScopedEditReferenceSnapshot(snapshot, {
    reducerRegistry: configuration.reducerRegistry,
    documentAdapter: configuration.documentAdapter,
    sceneAdapter: configuration.sceneAdapter,
  });
}

function buildSnapshot(configuration) {
  const { version, initialState, commandJournal, reducerRegistry, documentAdapter, sceneAdapter } = configuration;
  const projection = projectReferenceJournal({ initialState, commandJournal });
  const replayState = replayReferenceJournal({ initialState, commandJournal, reducerRegistry });
  const document = documentAdapter(replayState.state);
  const scene = sceneAdapter(document);
  return certifySnapshot(
    constructSnapshot({ version, document, commandJournal, projection, replayState, scene }),
    configuration,
  );
}

function assertPrefix(current, result) {
  const envelopes = result.journalProjection.envelopes;
  if (envelopes.length !== current.commandJournal.entries.length + 1) {
    throw codedError('MISSING_APPENDED_COMMAND', 'Commit result must append exactly one command.');
  }
  current.commandJournal.entries.forEach((entry, index) => {
    if (!sameJson(entry, envelopes[index])) {
      throw codedError('HISTORICAL_ENVELOPE_CHANGED', `Commit result changed historical envelope ${entry.commandId}.`);
    }
  });
  return envelopes.at(-1);
}

function assertIdentity(current, result, envelope) {
  const journal = current.commandJournal;
  const expectedId = `CJ-${String(journal.nextSequence).padStart(6, '0')}`;
  if (result.commandId !== envelope.commandId || envelope.commandId !== expectedId) {
    throw codedError('WRONG_COMMAND_ID', `Appended commandId must be ${expectedId}.`);
  }
  if (envelope.sequence !== journal.nextSequence) throw codedError('WRONG_SEQUENCE', 'Appended sequence is not canonical.');
  if (envelope.sessionId !== journal.sessionId) throw codedError('WRONG_SESSION_ID', 'Appended sessionId is invalid.');
  if (envelope.documentId !== journal.documentId) throw codedError('WRONG_DOCUMENT_ID', 'Appended documentId is invalid.');
  if (!result.journalProjection.activeCommandIds.includes(envelope.commandId)) {
    throw codedError('INACTIVE_COMMITTED_COMMAND', 'The committed command must be active.');
  }
}

function assertCommandAuthorization(result, envelope) {
  const decision = result.boundaryDecision;
  if (decision.commandName !== envelope.commandType) {
    throw codedError('COMMAND_NAME_MISMATCH', 'Boundary commandName must match the appended command type.');
  }
  const targetId = String(envelope.payload?.targetId ?? '').trim();
  if (!targetId || !decision.targetIds.includes(targetId)) {
    throw codedError('UNAUTHORIZED_PAYLOAD_TARGET', 'Envelope payload target is outside the authorized target set.');
  }
  if (envelope.commandType !== REFERENCE_POSITION_SET) return;
  if (targetId !== result.entityId) {
    throw codedError('POSITION_ENTITY_MISMATCH', 'Position command target must match the dragged entity.');
  }
  if (!sameJson(envelope.payload?.position, result.dragResult.point)) {
    throw codedError('POSITION_RESULT_MISMATCH', 'Position command payload must match the solved drag result.');
  }
}

function validateCommittedResult(input) {
  if (input?.status === SCOPED_EDIT_COMMIT_STATUS.REJECTED) {
    throw codedError('REJECTED_COMMIT_RESULT', 'Rejected runtime results cannot be accepted.');
  }
  try {
    const result = validateScopedEditCommitResult(input);
    if (result.status !== SCOPED_EDIT_COMMIT_STATUS.COMMITTED) {
      throw codedError('REJECTED_COMMIT_RESULT', 'Only committed runtime results may be accepted.');
    }
    return result;
  } catch (error) {
    if (error.code) throw error;
    const code = /must be active/.test(error.message) ? 'INACTIVE_COMMITTED_COMMAND' : 'INVALID_COMMIT_RESULT';
    throw codedError(code, error.message);
  }
}

function journalClaim(current, result, acceptedAt) {
  return immutableJson({
    ...current.commandJournal,
    updatedAt: acceptedAt,
    entries: result.journalProjection.envelopes,
    activeCommandIds: result.journalProjection.activeCommandIds,
    redoCommandIds: [],
    nextSequence: current.commandJournal.nextSequence + 1,
  }, 'Claimed candidate journal');
}

function canonicalCandidate(current, result, envelope, acceptedAt, initialState) {
  const candidate = appendJournalCommand(current.commandJournal, envelope, acceptedAt);
  if (!sameJson(candidate, journalClaim(current, result, acceptedAt))) {
    throw codedError('PROJECTION_MISMATCH', 'Commit result does not represent the canonical candidate journal.');
  }
  const projection = projectReferenceJournal({ initialState, commandJournal: candidate });
  if (!sameJson(projection, result.journalProjection)) {
    throw codedError('PROJECTION_MISMATCH', 'Commit result projection does not match the canonical append.');
  }
  return { candidate, projection };
}

function candidateReplay(result, initialState, candidate, reducerRegistry) {
  const replay = replayReferenceJournal({ initialState, commandJournal: candidate, reducerRegistry });
  if (!sameJson(replay, result.replayState)) {
    throw codedError('REPLAY_MISMATCH', 'Commit result replay does not match reference replay.');
  }
  return replay;
}

function failureEvidence(snapshot, code, message) {
  return immutableJson({
    schema: SCOPED_EDIT_REFERENCE_ACCEPTANCE_V1,
    accepted: false,
    reasonCode: code,
    message,
    currentSnapshotId: snapshot.snapshotId,
    unchangedVersion: snapshot.version,
    snapshot: null,
  }, 'Reference acceptance failure');
}

function successEvidence(snapshot) {
  return immutableJson({
    schema: SCOPED_EDIT_REFERENCE_ACCEPTANCE_V1,
    accepted: true,
    reasonCode: null,
    message: 'Reference commit accepted atomically.',
    currentSnapshotId: snapshot.snapshotId,
    unchangedVersion: snapshot.version,
    snapshot,
  }, 'Reference acceptance success');
}

function reconstructDocument(configuration, replayState) {
  try {
    return configuration.documentAdapter(replayState.state);
  } catch (error) {
    const code = /finite/.test(error.message) ? 'NON_FINITE_GEOMETRY' : 'DOCUMENT_RECONSTRUCTION_FAILED';
    throw codedError(code, error.message);
  }
}

function reconstructScene(configuration, document) {
  try {
    return configuration.sceneAdapter(document);
  } catch (error) {
    throw codedError('SCENE_DERIVATION_FAILED', error.message);
  }
}

function computeAcceptedSnapshot(current, rawResult, acceptedAt, configuration) {
  const result = validateCommittedResult(rawResult);
  if (!isIsoTimestamp(acceptedAt)) throw codedError('INVALID_ACCEPTED_AT', 'acceptedAt must be an exact ISO timestamp.');
  const envelope = assertPrefix(current, result);
  assertIdentity(current, result, envelope);
  assertCommandAuthorization(result, envelope);
  const { candidate, projection } = canonicalCandidate(
    current, result, envelope, acceptedAt, configuration.initialState,
  );
  const replayState = candidateReplay(
    result, configuration.initialState, candidate, configuration.reducerRegistry,
  );
  const document = reconstructDocument(configuration, replayState);
  const scene = reconstructScene(configuration, document);
  return certifySnapshot(constructSnapshot({
    version: current.version + 1,
    document,
    commandJournal: candidate,
    projection,
    replayState,
    scene,
  }), configuration);
}

function acceptStoreCommit(cell, configuration, input = {}) {
  try {
    if (cell.destroyed) throw codedError('REFERENCE_STORE_DESTROYED', 'Acceptance is unavailable after destroy().');
    if (input.expectedSnapshotId !== cell.snapshot.snapshotId) {
      throw codedError('STALE_REFERENCE_SNAPSHOT', 'The expected reference snapshot is stale.');
    }
    const next = computeAcceptedSnapshot(cell.snapshot, input.result, input.acceptedAt, configuration);
    cell.snapshot = next;
    return successEvidence(next);
  } catch (error) {
    return failureEvidence(cell.snapshot, error.code ?? 'REFERENCE_ACCEPTANCE_FAILED', error.message);
  }
}

function createStoreApi(cell, configuration) {
  return Object.freeze({
    getSnapshot() {
      return cell.snapshot;
    },
    createRuntimeHost() {
      if (cell.destroyed) throw codedError('REFERENCE_STORE_DESTROYED', 'Runtime host creation is unavailable after destroy().');
      return createScopedEditReferenceRuntimeHost(cell.snapshot, {
        reducerRegistry: configuration.reducerRegistry,
        documentAdapter: configuration.documentAdapter,
        sceneAdapter: configuration.sceneAdapter,
      });
    },
    acceptCommitResult(input) {
      return acceptStoreCommit(cell, configuration, input);
    },
    destroy() {
      cell.destroyed = true;
      return immutableJson({ destroyed: true, snapshotId: cell.snapshot.snapshotId, version: cell.snapshot.version },
        'Destroyed reference store');
    },
  });
}

function storeConfiguration(input) {
  const initialDocument = assertScopedEditReferenceDocument(input.initialDocument);
  const commandJournal = validJournal(input.commandJournal, initialDocument.documentId);
  const documentAdapter = input.documentAdapter ?? deriveReferenceDocument;
  const sceneAdapter = input.sceneAdapter ?? deriveReferenceEngineeringScene;
  if (typeof documentAdapter !== 'function' || typeof sceneAdapter !== 'function') {
    throw new TypeError('Reference store adapters must be functions.');
  }
  return Object.freeze({
    commandJournal,
    initialState: createReferenceInitialState(initialDocument),
    reducerRegistry: input.reducerRegistry ?? createReferenceReducerRegistry(),
    documentAdapter,
    sceneAdapter,
  });
}

export function createScopedEditReferenceStore(input = {}) {
  const configuration = storeConfiguration(input);
  const snapshot = buildSnapshot({ ...configuration, version: 0 });
  return createStoreApi({ snapshot, destroyed: false }, configuration);
}
