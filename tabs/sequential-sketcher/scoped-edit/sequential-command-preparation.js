/** Pure preparation of one Sequential command against an exact authority basis. */
import { createCommandEnvelope, validateCommandEnvelope } from '../../../contracts/command-envelope.js';
import { DECISION_ACTIONS } from '../construction/sequential-construction-contract.js';
import {
  advanceConstruction,
  applyConstructionDecision,
  runConstructionUntilBlocked,
} from '../construction/sequential-construction-runtime.js';
import { createConfirmedSequentialConstruction } from '../construction/sequential-construction-acceptance.js';
import { buildConfirmedConstructionSupportProjection } from '../support/sequential-confirmed-support-projection.js';
import {
  SEQUENTIAL_COMMAND_REJECTION,
  SEQUENTIAL_PREPARATION_ENABLED_COMMAND_TYPES,
  createSequentialNativeCommand,
  createSequentialPreparedCommand,
  sameSequentialContractValue,
  sequentialCommandCodedError,
} from './sequential-command-contracts.js';
import { appendSequentialCommandJournal } from './sequential-command-journal.js';
import { deriveSequentialCommandScope, deriveSequentialEditAuthority } from './sequential-edit-authority.js';
import { resolveSequentialCommandTargets } from './sequential-command-targets.js';

const ACTION_BY_COMMAND = Object.freeze({
  CONNECT_CANDIDATE: DECISION_ACTIONS.CONNECT,
  MANUAL_CONNECT: DECISION_ACTIONS.MANUAL_CONNECT,
  REJECT_CANDIDATE: DECISION_ACTIONS.REJECT_CANDIDATE,
  MARK_TERMINAL: DECISION_ACTIONS.MARK_TERMINAL,
  MARK_EXTERNAL_BOUNDARY: DECISION_ACTIONS.MARK_EXTERNAL_BOUNDARY,
  REVERSE_COMPONENT: DECISION_ACTIONS.REVERSE_COMPONENT,
  DEFER_DECISION: DECISION_ACTIONS.DEFER_DECISION,
  RESUME_DECISION: DECISION_ACTIONS.RESUME_DECISION,
  UNDO_LAST_TRANSACTION: DECISION_ACTIONS.UNDO_LAST_TRANSACTION,
  REDO_LAST_TRANSACTION: DECISION_ACTIONS.REDO_LAST_TRANSACTION,
});
const SUPPORT_OPTIONS = Object.freeze({
  projectionToleranceMm: 50,
  onCenterlineToleranceMm: 0.001,
  ambiguityToleranceMm: 1,
});

function fail(code, message, Constructor = Error) {
  throw sequentialCommandCodedError(code, message, Constructor);
}
function verifiedNativeCommand(value) {
  const normalized = createSequentialNativeCommand(value);
  if (!sameSequentialContractValue(normalized, value)) {
    fail(
      SEQUENTIAL_COMMAND_REJECTION.COMMAND_SCHEMA_INVALID,
      'Sequential native command identity does not match its complete contents.',
      TypeError,
    );
  }
  return normalized;
}
function verifyEnvelope(envelope, nativeCommand, authority, journalState) {
  const errors = validateCommandEnvelope(envelope);
  if (errors.length) fail(SEQUENTIAL_COMMAND_REJECTION.COMMAND_SCHEMA_INVALID, errors.join('; '), TypeError);
  const journal = journalState?.journal;
  if (envelope.sessionId !== journal?.sessionId || envelope.documentId !== journal?.documentId
    || envelope.sequence !== journal?.nextSequence
    || envelope.commandId !== `CJ-${String(journal?.nextSequence || 0).padStart(6, '0')}`) {
    fail(SEQUENTIAL_COMMAND_REJECTION.COMMAND_AUTHORITY_MISMATCH, 'Command envelope does not match the current Sequential journal head.', RangeError);
  }
  if (envelope.commandType !== nativeCommand.commandType
    || !sameSequentialContractValue(envelope.payload, nativeCommand)
    || envelope.basis.documentHash !== authority.sourceFingerprint
    || envelope.basis.revision !== authority.authorityId) {
    fail(SEQUENTIAL_COMMAND_REJECTION.COMMAND_AUTHORITY_MISMATCH, 'Command envelope basis or native payload is not exact current authority.', RangeError);
  }
}
function runtimePayload(command, issuedAt) {
  return {
    ...command.payload,
    candidateId: command.candidateId,
    componentId: command.componentId,
    connectionId: command.connectionId,
    fromPortId: command.fromPortId,
    toPortId: command.toPortId,
    entryPortId: command.entryPortId,
    issuedAt,
  };
}
function executeNativeCommand(input, command, issuedAt) {
  const options = { ...(input.engineOptions || {}), commandIssuedAt: issuedAt };
  if (command.commandType === 'ADVANCE_ONE') {
    return advanceConstruction(input.session, input.evidence, input.indexes, options);
  }
  if (command.commandType === 'RUN_UNTIL_BLOCKED') {
    const result = runConstructionUntilBlocked(input.session, input.evidence, input.indexes, options);
    return Object.freeze({ session: result.session, outcome: result.outcomes.at(-1) || 'NO_CHANGE' });
  }
  const action = ACTION_BY_COMMAND[command.commandType];
  if (!action) fail(SEQUENTIAL_COMMAND_REJECTION.COMMAND_SCHEMA_INVALID, `No native action maps ${command.commandType}.`, TypeError);
  return applyConstructionDecision(
    input.session,
    input.evidence,
    input.indexes,
    action,
    runtimePayload(command, issuedAt),
    options,
  );
}
function downstream(session, indexes) {
  if (session?.state !== 'ROUTE_COMPLETE') {
    return Object.freeze({ confirmedConstruction: null, supportProjection: null });
  }
  const confirmedConstruction = createConfirmedSequentialConstruction(session, indexes);
  const supportProjection = buildConfirmedConstructionSupportProjection(
    confirmedConstruction,
    indexes,
    SUPPORT_OPTIONS,
  );
  return Object.freeze({ confirmedConstruction, supportProjection });
}
function candidateBranchEntries(branchRegistry, branchId, snapshot) {
  const entries = [...(branchRegistry?.entries?.() || [])];
  const index = entries.findIndex((row) => row.branchId === branchId);
  const replacement = Object.freeze({ branchId, snapshot });
  if (index >= 0) entries[index] = replacement;
  else entries.push(replacement);
  return Object.freeze(entries.sort((left, right) => left.branchId.localeCompare(right.branchId)));
}
function newTransactionIds(beforeSession, afterSession) {
  const before = beforeSession?.transactionLedger?.length || 0;
  const rows = (afterSession?.transactionLedger || []).slice(before);
  if (rows.length > 1) fail(
    SEQUENTIAL_COMMAND_REJECTION.TRANSACTION_MAPPING_INVALID,
    'One Sequential command produced multiple native transactions without an approved mapping contract.',
    RangeError,
  );
  return Object.freeze(rows.map((row) => row.transactionId));
}
function acceptedEnvelope(envelope, transactionIds) {
  const transactionId = transactionIds[0] || null;
  if (envelope.transactionId && envelope.transactionId !== transactionId) fail(
    SEQUENTIAL_COMMAND_REJECTION.TRANSACTION_MAPPING_INVALID,
    'Prepared command transaction mapping differs from native recomputation.',
    RangeError,
  );
  return createCommandEnvelope({ ...envelope, transactionId });
}
function candidateJournal(journalState, envelope) {
  const next = appendSequentialCommandJournal(journalState, {
    commandType: envelope.commandType,
    payload: envelope.payload,
    basis: envelope.basis,
    origin: envelope.origin,
    transactionId: envelope.transactionId,
    inverse: envelope.inverse,
  }, envelope.origin.issuedAt);
  if (!sameSequentialContractValue(next.journal.entries.at(-1), envelope)) {
    fail(SEQUENTIAL_COMMAND_REJECTION.COMMAND_AUTHORITY_MISMATCH, 'Appended journal envelope differs from the prepared envelope.');
  }
  return next;
}

export function prepareSequentialCommand(input = {}) {
  const authority = deriveSequentialEditAuthority(input);
  if (!sameSequentialContractValue(authority, input.expectedAuthority)) {
    fail(SEQUENTIAL_COMMAND_REJECTION.COMMAND_AUTHORITY_MISMATCH, 'Sequential preparation authority does not match expected authority.', RangeError);
  }
  const nativeCommand = verifiedNativeCommand(input.nativeCommand);
  verifyEnvelope(input.envelope, nativeCommand, authority, input.journalState);
  if (!SEQUENTIAL_PREPARATION_ENABLED_COMMAND_TYPES.includes(nativeCommand.commandType)) {
    fail(
      SEQUENTIAL_COMMAND_REJECTION.COMMAND_RUNTIME_NOT_DETERMINISTIC,
      `Sequential command ${nativeCommand.commandType} is blocked until its native decision path accepts issuedAt.`,
      RangeError,
    );
  }
  const scope = deriveSequentialCommandScope({ ...input, authority });
  const targets = resolveSequentialCommandTargets({
    command: nativeCommand,
    session: input.session,
    indexes: input.indexes,
  }).evidence;
  const result = executeNativeCommand(input, nativeCommand, input.envelope.origin.issuedAt);
  const transactionIds = newTransactionIds(input.session, result.session);
  const envelope = acceptedEnvelope(input.envelope, transactionIds);
  const projections = downstream(result.session, input.indexes);
  const snapshot = Object.freeze({
    session: result.session,
    confirmedConstruction: projections.confirmedConstruction,
    supportProjection: projections.supportProjection,
    selectedCandidateId: '',
  });
  const candidate = Object.freeze({
    outcome: result.outcome,
    transactionIds,
    session: result.session,
    confirmedConstruction: projections.confirmedConstruction,
    supportProjection: projections.supportProjection,
    branchEntries: candidateBranchEntries(input.branchRegistry, authority.branchId, snapshot),
    journalState: candidateJournal(input.journalState, envelope),
  });
  return createSequentialPreparedCommand({
    envelope,
    nativeCommand,
    expectedAuthority: authority,
    scope,
    targets,
    candidate,
  });
}
