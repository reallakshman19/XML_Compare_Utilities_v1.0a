/** Headless synthetic integration of scope, Edit 3D, boundary and journal replay. */
import { validateCommandEnvelope } from '../../contracts/command-envelope.js';
import { immutableJson, requiredContractText } from '../../contracts/contract-values.js';
import { createEditDragSession, validateEdit3DDragRequest } from '../edit-3d/index.js';
import { replayEditJournal } from '../edit-journal/index.js';
import { guardScopeBoundary } from '../engineering-scope/index.js';
import {
  SCOPED_EDIT_COMMIT_PROPOSAL_V1,
  SCOPED_EDIT_COMMIT_RESULT_V1,
  SCOPED_EDIT_COMMIT_STATUS,
  SCOPED_EDIT_JOURNAL_PROJECTION_V1,
  SCOPED_EDIT_RUNTIME_STATE_V1,
  SCOPED_EDIT_RUNTIME_STATUS,
  validateScopedEditCommitProposal,
  validateScopedEditCommitResult,
  validateScopedEditJournalProjection,
  validateScopedEditRuntimeState,
} from './scoped-edit-contracts.js';
import {
  appendScopedEditProjection,
  readScopedEditEntityGeometry,
  readScopedEditHostContext,
} from './scoped-edit-host.js';

function emptyProjection() {
  return validateScopedEditJournalProjection({
    schema: SCOPED_EDIT_JOURNAL_PROJECTION_V1,
    initialState: {},
    envelopes: [],
    activeCommandIds: [],
  });
}

function replayProjection(projection, registry) {
  return replayEditJournal({
    initialState: projection.initialState,
    envelopes: projection.envelopes,
    activeCommandIds: projection.activeCommandIds,
    registry,
  });
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function runtimeError(code, message, Constructor = RangeError) {
  const error = new Constructor(message);
  error.code = code;
  return error;
}

function exactPoint(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function uniqueTargets(values) {
  if (!Array.isArray(values) || values.length === 0) throw new TypeError('targetIds must be a non-empty array.');
  const ids = values.map((value, index) => requiredContractText(value, `targetIds[${index}]`));
  if (new Set(ids).size !== ids.length) throw new TypeError('targetIds must contain unique values.');
  return Object.freeze([...ids].sort());
}

function immutableEnvelope(value) {
  const errors = validateCommandEnvelope(value);
  if (errors.length) throw new TypeError(`Invalid command envelope: ${errors.join('; ')}`);
  return immutableJson(value, 'Scoped edit command envelope');
}

function initialState(context, projection, replay) {
  return validateScopedEditRuntimeState({
    schema: SCOPED_EDIT_RUNTIME_STATE_V1,
    status: SCOPED_EDIT_RUNTIME_STATUS.READY,
    sceneId: context.scene.sceneId,
    scope: context.scope,
    scopedScene: context.scopedScene,
    activeEntityId: null,
    dragState: null,
    lastDragResult: null,
    journalProjection: projection,
    replayState: replay,
    appliedCommandIds: replay.appliedCommandIds,
    lastBoundaryDecision: null,
    preparedCommit: null,
    lastCommitResult: null,
    sequence: 0,
  });
}

function rejectionResult(state, code, message, options = {}) {
  return validateScopedEditCommitResult({
    schema: SCOPED_EDIT_COMMIT_RESULT_V1,
    status: SCOPED_EDIT_COMMIT_STATUS.REJECTED,
    entityId: options.entityId ?? state.activeEntityId,
    commandId: options.commandId ?? null,
    rejectionCode: code,
    message,
    dragResult: state.lastDragResult,
    boundaryDecision: options.boundaryDecision ?? state.lastBoundaryDecision,
    journalProjection: state.journalProjection,
    replayState: state.replayState,
    appliedCommandIds: state.appliedCommandIds,
  });
}

export function createScopedEditRuntime(input = {}) {
  let host = input.host, registry = input.reducerRegistry;
  let context = readScopedEditHostContext(host, input.scopeRequest);
  let projection = validateScopedEditJournalProjection(input.journalProjection ?? emptyProjection());
  let replay = replayProjection(projection, registry);
  let state = initialState(context, projection, replay), dragSession = null, prepared = null, destroyed = false;

  function publish(patch) {
    state = validateScopedEditRuntimeState({ ...state, ...patch, sequence: state.sequence + 1 });
    return state;
  }

  function requireLive(operation) {
    if (destroyed) throw runtimeError('RUNTIME_DESTROYED', `${operation} is unavailable after destroy().`);
  }

  function requireStatus(operation, statuses) {
    requireLive(operation);
    if (!statuses.includes(state.status)) {
      throw runtimeError('INVALID_RUNTIME_STATE', `${operation} is not allowed while status is ${state.status}.`);
    }
  }

  function reject(code, message, options = {}) {
    prepared = null;
    const result = rejectionResult(state, code, message, options);
    publish({ status: SCOPED_EDIT_RUNTIME_STATUS.REJECTED, preparedCommit: null, lastCommitResult: result,
      lastBoundaryDecision: options.boundaryDecision ?? state.lastBoundaryDecision });
    return result;
  }

  function beginDrag(value = {}) {
    requireStatus('beginDrag()', [SCOPED_EDIT_RUNTIME_STATUS.READY, SCOPED_EDIT_RUNTIME_STATUS.COMMITTED]);
    const entityId = requiredContractText(value.entityId, 'entityId');
    if (context.scope.boundaryIds.includes(entityId)) throw runtimeError('ENTITY_BOUNDARY_ONLY', `Entity ${entityId} is boundary-only.`);
    if (!context.scope.entityIds.includes(entityId)) throw runtimeError('ENTITY_OUT_OF_SCOPE', `Entity ${entityId} is outside the editable scope.`);
    const geometry = readScopedEditEntityGeometry(host, entityId);
    const request = validateEdit3DDragRequest(value.dragRequest);
    if (!exactPoint(request.start, geometry.anchor)) throw runtimeError('DRAG_START_MISMATCH', 'Drag start does not match authoritative entity geometry.');
    dragSession = createEditDragSession(request); prepared = null;
    publish({ status: SCOPED_EDIT_RUNTIME_STATUS.DRAGGING, activeEntityId: entityId,
      dragState: dragSession.getState(), lastDragResult: null, lastBoundaryDecision: null,
      preparedCommit: null, lastCommitResult: state.lastCommitResult });
    return state;
  }

  function solveDrag(ray) {
    requireStatus('solveDrag()', [SCOPED_EDIT_RUNTIME_STATUS.DRAGGING]);
    const result = dragSession.solve(ray);
    publish({ status: result.valid ? SCOPED_EDIT_RUNTIME_STATUS.DRAG_SOLVED : SCOPED_EDIT_RUNTIME_STATUS.DRAGGING,
      dragState: dragSession.getState(), lastDragResult: result, preparedCommit: null });
    return result;
  }

  function cancelDrag() {
    requireStatus('cancelDrag()', [SCOPED_EDIT_RUNTIME_STATUS.DRAGGING, SCOPED_EDIT_RUNTIME_STATUS.DRAG_SOLVED]);
    const dragState = dragSession.cancel(); dragSession = null; prepared = null;
    publish({ status: SCOPED_EDIT_RUNTIME_STATUS.CANCELLED, dragState, preparedCommit: null });
    return state;
  }

  function invalidDragRejection() {
    if (state.status === SCOPED_EDIT_RUNTIME_STATUS.CANCELLED) {
      return reject('DRAG_CANCELLED', 'A cancelled drag cannot be committed.');
    }
    if (state.status === SCOPED_EDIT_RUNTIME_STATUS.DRAGGING && state.lastDragResult?.valid === false) {
      return reject('DRAG_INVALID', `The latest drag solve is invalid: ${state.lastDragResult.reason}.`);
    }
    return null;
  }

  function prepareCommit(value = {}) {
    requireLive('prepareCommit()');
    const invalid = invalidDragRejection();
    if (invalid) return invalid;
    requireStatus('prepareCommit()', [SCOPED_EDIT_RUNTIME_STATUS.DRAG_SOLVED]);
    if (!state.lastDragResult?.valid) return reject('DRAG_INVALID', 'A valid drag result is required.');
    const commandName = requiredContractText(value.commandName, 'commandName');
    const targetIds = uniqueTargets(value.targetIds), envelope = immutableEnvelope(value.envelope);
    const decision = guardScopeBoundary(context.scope, commandName, targetIds);
    if (!decision.allowed) return reject(decision.reason, `Boundary policy ${decision.boundaryPolicy} rejected escaping targets.`,
      { commandId: envelope.commandId, boundaryDecision: decision });
    prepared = validateScopedEditCommitProposal({
      schema: SCOPED_EDIT_COMMIT_PROPOSAL_V1,
      status: SCOPED_EDIT_COMMIT_STATUS.PREPARED,
      entityId: state.activeEntityId,
      commandName,
      targetIds: decision.targetIds,
      envelope,
      dragResult: state.lastDragResult,
      boundaryDecision: decision,
      baseSequence: state.sequence,
    });
    publish({ preparedCommit: prepared, lastBoundaryDecision: decision, lastCommitResult: null });
    return prepared;
  }

  function revalidatePrepared() {
    const current = readScopedEditHostContext(host, context.request);
    if (!sameJson(current.scene, context.scene) || !sameJson(current.scope, context.scope)) {
      throw runtimeError('SCOPE_REVALIDATION_FAILED', 'Scene or scope changed after commit preparation.');
    }
    const decision = guardScopeBoundary(current.scope, prepared.commandName, prepared.targetIds);
    if (!decision.allowed || !sameJson(decision, prepared.boundaryDecision)) {
      throw runtimeError('SCOPE_REVALIDATION_FAILED', 'Boundary authority changed after commit preparation.');
    }
    validateScopedEditJournalProjection(projection);
    return current;
  }

  function committedResult(nextProjection, nextReplay) {
    return validateScopedEditCommitResult({
      schema: SCOPED_EDIT_COMMIT_RESULT_V1,
      status: SCOPED_EDIT_COMMIT_STATUS.COMMITTED,
      entityId: prepared.entityId,
      commandId: prepared.envelope.commandId,
      dragResult: prepared.dragResult,
      boundaryDecision: prepared.boundaryDecision,
      journalProjection: nextProjection,
      replayState: nextReplay,
      appliedCommandIds: nextReplay.appliedCommandIds,
    });
  }

  function commitPrepared() {
    requireStatus('commitPrepared()', [SCOPED_EDIT_RUNTIME_STATUS.DRAG_SOLVED]);
    if (!prepared) throw runtimeError('COMMIT_NOT_PREPARED', 'No commit proposal is prepared.');
    prepared = validateScopedEditCommitProposal(prepared);
    try { context = revalidatePrepared(); }
    catch (error) { return reject(error.code ?? 'SCOPE_REVALIDATION_FAILED', error.message, { commandId: prepared.envelope.commandId, boundaryDecision: prepared.boundaryDecision }); }
    let nextProjection;
    try { nextProjection = appendScopedEditProjection(host, projection, prepared.envelope); }
    catch (error) { return reject('APPEND_PROJECTION_INVALID', error.message, { commandId: prepared.envelope.commandId, boundaryDecision: prepared.boundaryDecision }); }
    let nextReplay;
    try { nextReplay = replayProjection(nextProjection, registry); }
    catch (error) { return reject('REPLAY_FAILED', error.message, { commandId: prepared.envelope.commandId, boundaryDecision: prepared.boundaryDecision }); }
    const result = committedResult(nextProjection, nextReplay);
    projection = nextProjection; replay = nextReplay; dragSession = null; prepared = null;
    publish({ status: SCOPED_EDIT_RUNTIME_STATUS.COMMITTED, scope: context.scope, scopedScene: context.scopedScene,
      journalProjection: projection, replayState: replay, appliedCommandIds: replay.appliedCommandIds,
      preparedCommit: null, lastCommitResult: result, lastBoundaryDecision: result.boundaryDecision });
    return result;
  }

  function getState() { return state; }

  function destroy() {
    if (destroyed) return state;
    destroyed = true; dragSession = null; prepared = null; projection = null; replay = null;
    const sceneId = state.sceneId, sequence = state.sequence + 1;
    host = null; registry = null; context = null;
    state = validateScopedEditRuntimeState({ schema: SCOPED_EDIT_RUNTIME_STATE_V1,
      status: SCOPED_EDIT_RUNTIME_STATUS.DESTROYED, sceneId, sequence });
    return state;
  }

  return Object.freeze({ beginDrag, solveDrag, cancelDrag, prepareCommit, commitPrepared, getState, destroy });
}
