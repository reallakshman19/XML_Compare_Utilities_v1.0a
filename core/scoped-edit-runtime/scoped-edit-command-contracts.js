/** Versioned JSON-safe contracts for supervised non-drag scoped commands. */
import { validateCommandEnvelope } from '../../contracts/command-envelope.js';
import { immutableJson, requiredContractText } from '../../contracts/contract-values.js';
import { SCOPED_ENGINEERING_SCENE_SCHEMA, assertEngineeringScope } from '../engineering-scope/index.js';
import { validateScopedEditJournalProjection } from './scoped-edit-contracts.js';

export const SCOPED_EDIT_COMMAND_RUNTIME_STATE_V1 = 'ScopedEditCommandRuntimeState.v1';
export const SCOPED_EDIT_COMMAND_PROPOSAL_V1 = 'ScopedEditCommandProposal.v1';
export const SCOPED_EDIT_COMMAND_RESULT_V1 = 'ScopedEditCommandResult.v1';

export const SCOPED_EDIT_COMMAND_RUNTIME_STATUS = Object.freeze({
  READY: 'READY', PREPARED: 'PREPARED', COMMITTED: 'COMMITTED',
  REJECTED: 'REJECTED', DESTROYED: 'DESTROYED',
});

export const SCOPED_EDIT_COMMAND_RESULT_STATUS = Object.freeze({
  PREPARED: 'PREPARED', COMMITTED: 'COMMITTED', REJECTED: 'REJECTED',
});

const RUNTIME_STATUSES = Object.freeze(Object.values(SCOPED_EDIT_COMMAND_RUNTIME_STATUS));

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a JSON object.`);
  }
  return value;
}

function schema(value, expected, label) {
  if (value !== expected) throw new TypeError(`${label} schema must be ${expected}.`);
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function uniqueTexts(values, label, allowEmpty = false) {
  if (!Array.isArray(values)) throw new TypeError(`${label} must be an array.`);
  const result = values.map((value, index) => requiredContractText(value, `${label}[${index}]`));
  if (!allowEmpty && result.length === 0) throw new TypeError(`${label} must not be empty.`);
  if (new Set(result).size !== result.length) throw new TypeError(`${label} must contain unique values.`);
  return Object.freeze(result);
}

function envelope(value, label = 'Command envelope') {
  const errors = validateCommandEnvelope(value);
  if (errors.length) throw new TypeError(`${label} is invalid: ${errors.join('; ')}`);
  return immutableJson(value, label);
}

function boundaryDecision(value, optional = false) {
  if (value == null && optional) return null;
  const input = record(value, 'Boundary decision');
  if (typeof input.allowed !== 'boolean') throw new TypeError('Boundary decision allowed must be boolean.');
  const targetIds = uniqueTexts(input.targetIds, 'Boundary targetIds', true);
  const escapingIds = uniqueTexts(input.escapingIds, 'Boundary escapingIds', true);
  for (const id of escapingIds) if (!targetIds.includes(id)) throw new TypeError('Boundary escapingIds must be targetIds.');
  return immutableJson({
    allowed: input.allowed,
    commandName: requiredContractText(input.commandName, 'Boundary commandName'),
    boundaryPolicy: requiredContractText(input.boundaryPolicy, 'Boundary policy'),
    targetIds,
    escapingIds,
    reason: input.reason == null ? null : requiredContractText(input.reason, 'Boundary reason'),
  }, 'Boundary decision');
}

function replayRecord(value) {
  const input = record(value, 'Replay state');
  const appliedCommandIds = uniqueTexts(input.appliedCommandIds, 'Replay appliedCommandIds', true);
  return immutableJson({ state: record(input.state, 'Replay state.state'), appliedCommandIds }, 'Replay state');
}

function assertAppliedIdsMatch(replayState, appliedCommandIds, label) {
  if (!sameJson(appliedCommandIds, replayState.appliedCommandIds)) {
    throw new TypeError(`${label} appliedCommandIds must match replayState.appliedCommandIds.`);
  }
}

function assertResultMatchesState(result, journalProjection, replayState, appliedCommandIds) {
  if (!result) return;
  if (!sameJson(result.journalProjection, journalProjection)) {
    throw new TypeError('runtime.lastResult journalProjection must match runtime.journalProjection.');
  }
  if (!sameJson(result.replayState, replayState)) {
    throw new TypeError('runtime.lastResult replayState must match runtime.replayState.');
  }
  if (!sameJson(result.appliedCommandIds, appliedCommandIds)) {
    throw new TypeError('runtime.lastResult appliedCommandIds must match runtime.appliedCommandIds.');
  }
}

export function validateScopedEditCommandProposal(input) {
  const value = record(input, 'Scoped command proposal');
  schema(value.schema, SCOPED_EDIT_COMMAND_PROPOSAL_V1, 'Scoped command proposal');
  if (value.status !== SCOPED_EDIT_COMMAND_RESULT_STATUS.PREPARED) {
    throw new TypeError('Scoped command proposal status must be PREPARED.');
  }
  const decision = boundaryDecision(value.boundaryDecision);
  if (!decision.allowed) throw new TypeError('A prepared scoped command requires an allowed boundary decision.');
  const targetIds = uniqueTexts(value.targetIds, 'proposal.targetIds');
  if (!sameJson(targetIds, decision.targetIds)) {
    throw new TypeError('Proposal targetIds must match the boundary decision.');
  }
  return immutableJson({
    schema: SCOPED_EDIT_COMMAND_PROPOSAL_V1,
    status: SCOPED_EDIT_COMMAND_RESULT_STATUS.PREPARED,
    sceneId: requiredContractText(value.sceneId, 'proposal.sceneId'),
    commandName: requiredContractText(value.commandName, 'proposal.commandName'),
    targetIds,
    envelope: envelope(value.envelope),
    boundaryDecision: decision,
    baseSequence: Number.isSafeInteger(value.baseSequence) && value.baseSequence >= 0
      ? value.baseSequence : (() => { throw new TypeError('proposal.baseSequence must be non-negative.'); })(),
  }, 'Scoped command proposal');
}

function committedEvidence(value, journalProjection, replayState) {
  const commandId = requiredContractText(value.commandId, 'result.commandId');
  const decision = boundaryDecision(value.boundaryDecision);
  if (!decision.allowed) throw new TypeError('A committed scoped command requires an allowed boundary decision.');
  const envelopeIds = journalProjection.envelopes.map((entry) => entry.commandId);
  if (!envelopeIds.includes(commandId)) throw new TypeError('Committed commandId must exist in journalProjection.');
  if (!journalProjection.activeCommandIds.includes(commandId)) {
    throw new TypeError('Committed commandId must be active in journalProjection.');
  }
  if (!replayState.appliedCommandIds.includes(commandId)) {
    throw new TypeError('Committed commandId must be present in replayState.appliedCommandIds.');
  }
  return { commandId, boundaryDecision: decision };
}

export function validateScopedEditCommandResult(input) {
  const value = record(input, 'Scoped command result');
  schema(value.schema, SCOPED_EDIT_COMMAND_RESULT_V1, 'Scoped command result');
  if (![SCOPED_EDIT_COMMAND_RESULT_STATUS.COMMITTED, SCOPED_EDIT_COMMAND_RESULT_STATUS.REJECTED].includes(value.status)) {
    throw new TypeError('Scoped command result status must be COMMITTED or REJECTED.');
  }
  const journalProjection = validateScopedEditJournalProjection(value.journalProjection);
  const replayState = replayRecord(value.replayState);
  const appliedCommandIds = uniqueTexts(value.appliedCommandIds, 'result.appliedCommandIds', true);
  assertAppliedIdsMatch(replayState, appliedCommandIds, 'Scoped command result');
  const committed = value.status === SCOPED_EDIT_COMMAND_RESULT_STATUS.COMMITTED;
  const evidence = committed ? committedEvidence(value, journalProjection, replayState) : {
    commandId: value.commandId == null ? null : requiredContractText(value.commandId, 'result.commandId'),
    boundaryDecision: boundaryDecision(value.boundaryDecision, true),
  };
  return immutableJson({
    schema: SCOPED_EDIT_COMMAND_RESULT_V1,
    status: value.status,
    ...evidence,
    rejectionCode: committed ? null : requiredContractText(value.rejectionCode, 'rejectionCode'),
    message: committed ? null : requiredContractText(value.message, 'rejection message'),
    journalProjection,
    replayState,
    appliedCommandIds,
  }, 'Scoped command result');
}

export function validateScopedEditCommandRuntimeState(input) {
  const value = record(input, 'Scoped command runtime state');
  schema(value.schema, SCOPED_EDIT_COMMAND_RUNTIME_STATE_V1, 'Scoped command runtime state');
  if (!RUNTIME_STATUSES.includes(value.status)) throw new TypeError('Unknown scoped command runtime status.');
  if (!Number.isSafeInteger(value.sequence) || value.sequence < 0) throw new TypeError('Runtime sequence must be non-negative.');
  const sceneId = requiredContractText(value.sceneId, 'runtime.sceneId');
  if (value.status === SCOPED_EDIT_COMMAND_RUNTIME_STATUS.DESTROYED) {
    return immutableJson({ schema: SCOPED_EDIT_COMMAND_RUNTIME_STATE_V1, status: value.status, sceneId,
      sequence: value.sequence }, 'Destroyed scoped command runtime state');
  }
  const scope = assertEngineeringScope(value.scope);
  if (value.scopedScene?.schema !== SCOPED_ENGINEERING_SCENE_SCHEMA) {
    throw new TypeError('runtime.scopedScene schema is invalid.');
  }
  const journalProjection = validateScopedEditJournalProjection(value.journalProjection);
  const replayState = replayRecord(value.replayState);
  const appliedCommandIds = uniqueTexts(value.appliedCommandIds, 'runtime.appliedCommandIds', true);
  assertAppliedIdsMatch(replayState, appliedCommandIds, 'Scoped command runtime state');
  const preparedCommand = value.preparedCommand == null ? null : validateScopedEditCommandProposal(value.preparedCommand);
  const lastResult = value.lastResult == null ? null : validateScopedEditCommandResult(value.lastResult);
  if (preparedCommand && preparedCommand.sceneId !== sceneId) {
    throw new TypeError('runtime.preparedCommand sceneId must match runtime.sceneId.');
  }
  assertResultMatchesState(lastResult, journalProjection, replayState, appliedCommandIds);
  return immutableJson({
    schema: SCOPED_EDIT_COMMAND_RUNTIME_STATE_V1,
    status: value.status,
    sceneId,
    scope,
    scopedScene: value.scopedScene,
    allowedCommandNames: uniqueTexts(value.allowedCommandNames, 'runtime.allowedCommandNames'),
    journalProjection,
    replayState,
    appliedCommandIds,
    lastBoundaryDecision: boundaryDecision(value.lastBoundaryDecision, true),
    preparedCommand,
    lastResult,
    sequence: value.sequence,
  }, 'Scoped command runtime state');
}
