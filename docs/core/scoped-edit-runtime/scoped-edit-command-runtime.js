/** Supervised scoped command lifecycle with no drag-session dependency. */
import { validateCommandEnvelope } from '../../contracts/command-envelope.js';
import { immutableJson, requiredContractText } from '../../contracts/contract-values.js';
import { replayEditJournal } from '../edit-journal/index.js';
import { guardScopeBoundary } from '../engineering-scope/index.js';
import { validateScopedEditJournalProjection } from './scoped-edit-contracts.js';
import {
  SCOPED_EDIT_COMMAND_PROPOSAL_V1,
  SCOPED_EDIT_COMMAND_RESULT_STATUS,
  SCOPED_EDIT_COMMAND_RESULT_V1,
  SCOPED_EDIT_COMMAND_RUNTIME_STATE_V1,
  SCOPED_EDIT_COMMAND_RUNTIME_STATUS,
  validateScopedEditCommandProposal,
  validateScopedEditCommandResult,
  validateScopedEditCommandRuntimeState,
} from './scoped-edit-command-contracts.js';
import { appendScopedEditProjection, readScopedEditHostContext } from './scoped-edit-host.js';

function emptyProjection() {
  return validateScopedEditJournalProjection({
    schema: 'ScopedEditJournalProjection.v1', initialState: {}, envelopes: [], activeCommandIds: [],
  });
}

function replayProjection(projection, registry) {
  return replayEditJournal({ initialState: projection.initialState, envelopes: projection.envelopes,
    activeCommandIds: projection.activeCommandIds, registry });
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function runtimeError(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; return error;
}

function uniqueTexts(values, label) {
  if (!Array.isArray(values) || values.length === 0) throw new TypeError(`${label} must be a non-empty array.`);
  const result = values.map((value, index) => requiredContractText(value, `${label}[${index}]`));
  if (new Set(result).size !== result.length) throw new TypeError(`${label} must contain unique values.`);
  return Object.freeze([...result].sort());
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
  return immutableJson(value, 'Scoped command envelope');
}

function initialState(context, projection, replay, allowedCommandNames) {
  return validateScopedEditCommandRuntimeState({
    schema: SCOPED_EDIT_COMMAND_RUNTIME_STATE_V1,
    status: SCOPED_EDIT_COMMAND_RUNTIME_STATUS.READY,
    sceneId: context.scene.sceneId,
    scope: context.scope,
    scopedScene: context.scopedScene,
    allowedCommandNames,
    journalProjection: projection,
    replayState: replay,
    appliedCommandIds: replay.appliedCommandIds,
    lastBoundaryDecision: null,
    preparedCommand: null,
    lastResult: null,
    sequence: 0,
  });
}

function boundaryEvidence(state, options) {
  return Object.prototype.hasOwnProperty.call(options, 'boundaryDecision')
    ? options.boundaryDecision : state.lastBoundaryDecision;
}

function rejectionResult(state, code, message, options = {}) {
  return validateScopedEditCommandResult({
    schema: SCOPED_EDIT_COMMAND_RESULT_V1,
    status: SCOPED_EDIT_COMMAND_RESULT_STATUS.REJECTED,
    commandId: options.commandId ?? null,
    rejectionCode: code,
    message,
    boundaryDecision: boundaryEvidence(state, options),
    journalProjection: state.journalProjection,
    replayState: state.replayState,
    appliedCommandIds: state.appliedCommandIds,
  });
}

export function createScopedEditCommandRuntime(input = {}) {
  let host = input.host, registry = input.reducerRegistry;
  let context = readScopedEditHostContext(host, input.scopeRequest);
  const allowedCommandNames = uniqueTexts(input.allowedCommandNames, 'allowedCommandNames');
  let projection = validateScopedEditJournalProjection(input.journalProjection ?? emptyProjection());
  let replay = replayProjection(projection, registry);
  let state = initialState(context, projection, replay, allowedCommandNames), prepared = null, destroyed = false;

  function publish(patch) {
    state = validateScopedEditCommandRuntimeState({ ...state, ...patch, sequence: state.sequence + 1 });
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
    publish({ status: SCOPED_EDIT_COMMAND_RUNTIME_STATUS.REJECTED, preparedCommand: null,
      lastResult: result, lastBoundaryDecision: boundaryEvidence(state, options) });
    return result;
  }

  function prepareCommand(value = {}) {
    requireStatus('prepareCommand()', [SCOPED_EDIT_COMMAND_RUNTIME_STATUS.READY,
      SCOPED_EDIT_COMMAND_RUNTIME_STATUS.COMMITTED, SCOPED_EDIT_COMMAND_RUNTIME_STATUS.REJECTED]);
    const commandName = requiredContractText(value.commandName, 'commandName');
    const targetIds = uniqueTargets(value.targetIds), envelope = immutableEnvelope(value.envelope);
    if (envelope.commandType !== commandName) return reject('COMMAND_NAME_MISMATCH',
      `Command name ${commandName} does not match envelope type ${envelope.commandType}.`,
      { commandId: envelope.commandId, boundaryDecision: null });
    if (!allowedCommandNames.includes(commandName)) return reject('COMMAND_NOT_ALLOWED',
      `Command ${commandName} is not authorized for COMMAND_ONLY execution.`,
      { commandId: envelope.commandId, boundaryDecision: null });
    const decision = guardScopeBoundary(context.scope, commandName, targetIds);
    if (!decision.allowed) return reject(decision.reason,
      `Boundary policy ${decision.boundaryPolicy} rejected escaping targets.`,
      { commandId: envelope.commandId, boundaryDecision: decision });
    prepared = validateScopedEditCommandProposal({
      schema: SCOPED_EDIT_COMMAND_PROPOSAL_V1,
      status: SCOPED_EDIT_COMMAND_RESULT_STATUS.PREPARED,
      sceneId: context.scene.sceneId,
      commandName,
      targetIds: decision.targetIds,
      envelope,
      boundaryDecision: decision,
      baseSequence: state.sequence,
    });
    publish({ status: SCOPED_EDIT_COMMAND_RUNTIME_STATUS.PREPARED, preparedCommand: prepared,
      lastBoundaryDecision: decision, lastResult: null });
    return prepared;
  }

  function revalidatePrepared() {
    const current = readScopedEditHostContext(host, context.request);
    if (!sameJson(current.scene, context.scene) || !sameJson(current.scope, context.scope)) {
      throw runtimeError('SCOPE_REVALIDATION_FAILED', 'Scene or scope changed after command preparation.');
    }
    const decision = guardScopeBoundary(current.scope, prepared.commandName, prepared.targetIds);
    if (!decision.allowed || !sameJson(decision, prepared.boundaryDecision)) {
      throw runtimeError('SCOPE_REVALIDATION_FAILED', 'Boundary authority changed after command preparation.');
    }
    validateScopedEditJournalProjection(projection);
    return current;
  }

  function committedResult(nextProjection, nextReplay) {
    return validateScopedEditCommandResult({
      schema: SCOPED_EDIT_COMMAND_RESULT_V1,
      status: SCOPED_EDIT_COMMAND_RESULT_STATUS.COMMITTED,
      commandId: prepared.envelope.commandId,
      boundaryDecision: prepared.boundaryDecision,
      journalProjection: nextProjection,
      replayState: nextReplay,
      appliedCommandIds: nextReplay.appliedCommandIds,
    });
  }

  function commitPrepared() {
    requireStatus('commitPrepared()', [SCOPED_EDIT_COMMAND_RUNTIME_STATUS.PREPARED]);
    if (!prepared) throw runtimeError('COMMAND_NOT_PREPARED', 'No scoped command proposal is prepared.');
    prepared = validateScopedEditCommandProposal(prepared);
    try { context = revalidatePrepared(); }
    catch (error) { return reject(error.code ?? 'SCOPE_REVALIDATION_FAILED', error.message,
      { commandId: prepared.envelope.commandId, boundaryDecision: prepared.boundaryDecision }); }
    let nextProjection;
    try { nextProjection = appendScopedEditProjection(host, projection, prepared.envelope); }
    catch (error) { return reject('APPEND_PROJECTION_INVALID', error.message,
      { commandId: prepared.envelope.commandId, boundaryDecision: prepared.boundaryDecision }); }
    let nextReplay;
    try { nextReplay = replayProjection(nextProjection, registry); }
    catch (error) { return reject('REPLAY_FAILED', error.message,
      { commandId: prepared.envelope.commandId, boundaryDecision: prepared.boundaryDecision }); }
    const result = committedResult(nextProjection, nextReplay);
    projection = nextProjection; replay = nextReplay; prepared = null;
    publish({ status: SCOPED_EDIT_COMMAND_RUNTIME_STATUS.COMMITTED, scope: context.scope,
      scopedScene: context.scopedScene, journalProjection: projection, replayState: replay,
      appliedCommandIds: replay.appliedCommandIds, preparedCommand: null,
      lastResult: result, lastBoundaryDecision: result.boundaryDecision });
    return result;
  }

  function cancelPrepared() {
    requireStatus('cancelPrepared()', [SCOPED_EDIT_COMMAND_RUNTIME_STATUS.PREPARED]);
    prepared = null;
    publish({ status: SCOPED_EDIT_COMMAND_RUNTIME_STATUS.READY, preparedCommand: null });
    return state;
  }

  function getState() { return state; }

  function destroy() {
    if (destroyed) return state;
    destroyed = true; prepared = null; projection = null; replay = null;
    const sceneId = state.sceneId, sequence = state.sequence + 1;
    host = null; registry = null; context = null;
    state = validateScopedEditCommandRuntimeState({ schema: SCOPED_EDIT_COMMAND_RUNTIME_STATE_V1,
      status: SCOPED_EDIT_COMMAND_RUNTIME_STATUS.DESTROYED, sceneId, sequence });
    return state;
  }

  return Object.freeze({ prepareCommand, commitPrepared, cancelPrepared, getState, destroy });
}
