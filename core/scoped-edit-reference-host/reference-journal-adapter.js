/** Pure CommandJournal.v1 projection and reference reducer bindings. */
import { createCommandEnvelope } from '../../contracts/command-envelope.js';
import { validateCommandJournal } from '../../contracts/command-journal.js';
import { immutableJson, requiredContractText } from '../../contracts/contract-values.js';
import { createDomainReducerRegistry, replayEditJournal } from '../edit-journal/index.js';
import {
  SCOPED_EDIT_JOURNAL_PROJECTION_V1,
  validateScopedEditJournalProjection,
} from '../scoped-edit-runtime/index.js';
import {
  SCOPED_EDIT_REFERENCE_REPLAY_STATE_V1,
  assertScopedEditReferenceSnapshot,
  deriveReferenceDocument,
  hashReferenceValue,
} from './reference-document-contracts.js';
import { deriveReferenceEngineeringScene } from './reference-scene-adapter.js';

export const REFERENCE_POSITION_SET = 'REFERENCE_POSITION_SET';
export const REFERENCE_ATTRIBUTE_SET = 'REFERENCE_ATTRIBUTE_SET';
export const REFERENCE_REMARK_SET = 'REFERENCE_REMARK_SET';

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validJournal(journal) {
  const errors = validateCommandJournal(journal);
  if (errors.length) throw new TypeError(`Invalid reference CommandJournal: ${errors.join('; ')}`);
  return journal;
}

function replayState(value) {
  if (value?.schema !== SCOPED_EDIT_REFERENCE_REPLAY_STATE_V1 || !Array.isArray(value.entities)) {
    throw new TypeError(`Reference state must use schema ${SCOPED_EDIT_REFERENCE_REPLAY_STATE_V1}.`);
  }
  return value;
}

function entityIndex(state, targetId) {
  const index = state.entities.findIndex((entity) => entity.entityId === targetId);
  if (index < 0) throw new RangeError(`Reference entity ${targetId} does not exist.`);
  return index;
}

function replaceEntity(state, index, patch) {
  const entities = state.entities.map((entity, cursor) => cursor === index ? { ...entity, ...patch } : entity);
  return immutableJson({ ...state, revision: state.revision + 1, entities }, 'Reference reducer state');
}

function positionReducer(stateInput, envelope) {
  const state = replayState(stateInput);
  const targetId = requiredContractText(envelope.payload?.targetId, 'Position targetId');
  const position = envelope.payload?.position;
  if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite)) {
    throw new TypeError('Reference position must contain three finite values.');
  }
  return replaceEntity(state, entityIndex(state, targetId), { anchor: [...position] });
}

function attributeReducer(stateInput, envelope) {
  const state = replayState(stateInput);
  const targetId = requiredContractText(envelope.payload?.targetId, 'Attribute targetId');
  const key = requiredContractText(envelope.payload?.key, 'Attribute key');
  const index = entityIndex(state, targetId);
  const attributes = { ...state.entities[index].attributes, [key]: envelope.payload?.value };
  immutableJson(attributes, 'Reference attributes');
  return replaceEntity(state, index, { attributes });
}

function remarkReducer(stateInput, envelope) {
  const state = replayState(stateInput);
  const targetId = requiredContractText(envelope.payload?.targetId, 'Remark targetId');
  const value = envelope.payload?.value;
  if (value !== null && typeof value !== 'string') throw new TypeError('Reference remark must be null or text.');
  return replaceEntity(state, entityIndex(state, targetId), { remark: value });
}

export function createReferenceReducerRegistry() {
  return createDomainReducerRegistry({
    [REFERENCE_POSITION_SET]: positionReducer,
    [REFERENCE_ATTRIBUTE_SET]: attributeReducer,
    [REFERENCE_REMARK_SET]: remarkReducer,
  });
}

export function projectReferenceJournal({ initialState, commandJournal }) {
  const journal = validJournal(commandJournal);
  const projection = {
    schema: SCOPED_EDIT_JOURNAL_PROJECTION_V1,
    initialState: immutableJson(initialState, 'Reference journal initial state'),
    envelopes: journal.entries,
    activeCommandIds: journal.activeCommandIds,
  };
  return validateScopedEditJournalProjection(projection);
}

export function replayReferenceJournal({ initialState, commandJournal, reducerRegistry }) {
  const projection = projectReferenceJournal({ initialState, commandJournal });
  return replayEditJournal({
    initialState: projection.initialState,
    envelopes: projection.envelopes,
    activeCommandIds: projection.activeCommandIds,
    registry: reducerRegistry,
  });
}

export function certifyReferenceJournalCheckpoints({ initialState, commandJournal, reducerRegistry }) {
  const journal = validJournal(commandJournal);
  const maxSequence = Math.max(0, ...journal.entries.map((entry) => entry.sequence));
  for (const checkpoint of journal.checkpoints) {
    if (checkpoint.sequence > maxSequence) {
      throw new TypeError(`Reference checkpoint ${checkpoint.checkpointId} sequence exceeds the journal.`);
    }
    const envelopes = journal.entries.filter((entry) => entry.sequence <= checkpoint.sequence);
    const available = new Set(envelopes.map((entry) => entry.commandId));
    if (checkpoint.activeCommandIds.some((id) => !available.has(id))) {
      throw new TypeError(`Reference checkpoint ${checkpoint.checkpointId} exceeds its sequence authority.`);
    }
    const replay = replayEditJournal({
      initialState: immutableJson(initialState, 'Reference checkpoint initial state'),
      envelopes,
      activeCommandIds: checkpoint.activeCommandIds,
      registry: reducerRegistry,
    });
    if (hashReferenceValue(replay) !== checkpoint.stateHash) {
      throw new TypeError(`Reference checkpoint ${checkpoint.checkpointId} stateHash is inconsistent.`);
    }
  }
  return journal;
}

export function certifyScopedEditReferenceSnapshot(snapshotInput, options = {}) {
  const snapshot = assertScopedEditReferenceSnapshot(snapshotInput);
  const reducerRegistry = options.reducerRegistry ?? createReferenceReducerRegistry();
  const documentAdapter = options.documentAdapter ?? deriveReferenceDocument;
  const sceneAdapter = options.sceneAdapter ?? deriveReferenceEngineeringScene;
  if (typeof documentAdapter !== 'function' || typeof sceneAdapter !== 'function') {
    throw new TypeError('Reference snapshot adapters must be functions.');
  }
  const replay = replayReferenceJournal({
    initialState: snapshot.journalProjection.initialState,
    commandJournal: snapshot.commandJournal,
    reducerRegistry,
  });
  if (!sameJson(replay, snapshot.replayState)) {
    throw new TypeError('Reference snapshot replay ancestry is inconsistent with its journal.');
  }
  const document = documentAdapter(replay.state);
  if (!sameJson(document, snapshot.document)) {
    throw new TypeError('Reference snapshot document is inconsistent with certified replay.');
  }
  if (!sameJson(sceneAdapter(document), snapshot.engineeringScene)) {
    throw new TypeError('Reference snapshot scene is inconsistent with certified replay.');
  }
  certifyReferenceJournalCheckpoints({
    initialState: snapshot.journalProjection.initialState,
    commandJournal: snapshot.commandJournal,
    reducerRegistry,
  });
  return snapshot;
}

export function createReferenceScopedEditEnvelope(snapshotInput, input = {}) {
  const snapshot = assertScopedEditReferenceSnapshot(snapshotInput);
  const journal = snapshot.commandJournal;
  const sequence = journal.nextSequence;
  return createCommandEnvelope({
    commandId: `CJ-${String(sequence).padStart(6, '0')}`,
    sessionId: journal.sessionId,
    documentId: journal.documentId,
    sequence,
    commandType: requiredContractText(input.commandType, 'Reference commandType'),
    payload: input.payload,
    basis: { documentHash: snapshot.documentHash, revision: String(snapshot.document.revision) },
    origin: {
      kind: requiredContractText(input.origin?.kind, 'Reference origin kind'),
      actorId: requiredContractText(input.origin?.actorId, 'Reference origin actorId'),
      issuedAt: input.origin?.issuedAt,
    },
    transactionId: input.transactionId ?? null,
    inverse: input.inverse ?? null,
  });
}
