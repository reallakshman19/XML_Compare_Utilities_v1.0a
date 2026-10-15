/** Pure CommandJournal.v1 projection and dry-run append for the Topology host seam. */
import { immutableJson, requiredContractText } from '../../contracts/contract-values.js';
import { validateCommandEnvelope } from '../../contracts/command-envelope.js';
import { appendJournalCommand, validateCommandJournal } from '../../contracts/command-journal.js';
import { validateScopedEditJournalProjection } from '../../core/scoped-edit-runtime/scoped-edit-contracts.js';
import { authorizeTopologyCommandTargets } from './topology-scoped-edit-command-scope.js';
import { resolveTopologyNativeCommandTargets } from './topology-scoped-edit-command-targets.js';
import {
  TOPOLOGY_JOURNAL_COMMANDS,
  replayTopologyCommandJournal,
  topologyReplayStateHash,
} from './topology-command-replay.js';
import { objectRecord, semanticHash, semanticStringify } from './topology-validator-values.js';

export const TOPOLOGY_SCOPED_EDIT_JOURNAL_PROJECTION_V1 = 'TopologyScopedEditJournalProjection.v1';
export const TOPOLOGY_SCOPED_EDIT_DRY_RUN_V1 = 'TopologyScopedEditDryRun.v1';
export const TOPOLOGY_SCOPED_EDIT_DRY_RUN_REJECTION = Object.freeze({
  PROJECTION_MISMATCH: 'TOPOLOGY_DRY_RUN_PROJECTION_MISMATCH',
  ENVELOPE_INVALID: 'TOPOLOGY_DRY_RUN_ENVELOPE_INVALID',
  ENVELOPE_MISMATCH: 'TOPOLOGY_DRY_RUN_ENVELOPE_MISMATCH',
  COMMAND_UNSUPPORTED: 'TOPOLOGY_DRY_RUN_COMMAND_UNSUPPORTED',
  REPLAY_MISMATCH: 'TOPOLOGY_DRY_RUN_REPLAY_MISMATCH',
});

function fail(code, message, Constructor = TypeError) {
  const error = new Constructor(message);
  error.code = code;
  throw error;
}

function same(left, right) {
  return semanticStringify(left) === semanticStringify(right);
}

function validatedJournal(journal) {
  const errors = validateCommandJournal(journal);
  if (errors.length) fail(TOPOLOGY_SCOPED_EDIT_DRY_RUN_REJECTION.PROJECTION_MISMATCH,
    `Invalid Topology CommandJournal: ${errors.join('; ')}`);
  return journal;
}

function coreProjection(journal, initialState) {
  return validateScopedEditJournalProjection({ schema: 'ScopedEditJournalProjection.v1',
    initialState, envelopes: journal.entries, activeCommandIds: journal.activeCommandIds });
}

export function createTopologyScopedEditJournalProjection(input = {}) {
  const journal = validatedJournal(input.journal);
  const projection = coreProjection(journal, input.initialState);
  return immutableJson({ schema: TOPOLOGY_SCOPED_EDIT_JOURNAL_PROJECTION_V1,
    authorityId: requiredContractText(input.authorityId, 'projection authorityId'),
    journalId: journal.journalId, sessionId: journal.sessionId, documentId: journal.documentId,
    journalHash: semanticHash(journal), projectionHash: semanticHash(projection), projection,
    redoCommandIds: journal.redoCommandIds, nextSequence: journal.nextSequence,
    checkpoints: journal.checkpoints }, 'Topology scoped-edit journal projection');
}

export function assertTopologyScopedEditCurrentProjection(readModel, currentInput) {
  const current = validateScopedEditJournalProjection(currentInput?.projection ?? currentInput);
  const expected = readModel.journalProjection.projection;
  if (!same(current, expected)) fail(TOPOLOGY_SCOPED_EDIT_DRY_RUN_REJECTION.PROJECTION_MISMATCH,
    'Current scoped-edit projection does not match accepted Topology journal authority.', RangeError);
  return current;
}

function validatedEnvelope(readModel, input) {
  const errors = validateCommandEnvelope(input);
  if (errors.length) fail(TOPOLOGY_SCOPED_EDIT_DRY_RUN_REJECTION.ENVELOPE_INVALID,
    `Invalid dry-run command envelope: ${errors.join('; ')}`);
  if (input.commandType !== TOPOLOGY_JOURNAL_COMMANDS.TOPOLOGY) {
    fail(TOPOLOGY_SCOPED_EDIT_DRY_RUN_REJECTION.COMMAND_UNSUPPORTED,
      `Dry-run append supports ${TOPOLOGY_JOURNAL_COMMANDS.TOPOLOGY} only.`, RangeError);
  }
  if (input.basis.documentHash !== readModel.baseDraft.baseCanonicalTopologyHash
    || input.basis.revision !== 'TopologyEditDraft.v1') {
    fail(TOPOLOGY_SCOPED_EDIT_DRY_RUN_REJECTION.ENVELOPE_MISMATCH,
      'Command envelope basis does not match the accepted Topology draft basis.', RangeError);
  }
  return immutableJson(input, 'Topology dry-run command envelope');
}

function appendExactEnvelope(readModel, envelope) {
  const updatedAt = envelope.origin.issuedAt;
  if (!updatedAt) fail(TOPOLOGY_SCOPED_EDIT_DRY_RUN_REJECTION.ENVELOPE_INVALID,
    'Dry-run append requires a deterministic issuedAt timestamp.');
  const candidate = appendJournalCommand(readModel.commandJournal, {
    commandType: envelope.commandType, payload: envelope.payload, basis: envelope.basis,
    origin: envelope.origin, transactionId: envelope.transactionId, inverse: envelope.inverse,
  }, updatedAt);
  if (!same(candidate.entries.at(-1), envelope)) {
    fail(TOPOLOGY_SCOPED_EDIT_DRY_RUN_REJECTION.ENVELOPE_MISMATCH,
      'Supplied envelope does not match the exact next CommandJournal entry.', RangeError);
  }
  return candidate;
}

function nativeCommand(envelope) {
  const command = objectRecord(objectRecord(envelope.payload).nativeCommand);
  if (!command.id || !command.type || !command.payload) {
    fail(TOPOLOGY_SCOPED_EDIT_DRY_RUN_REJECTION.COMMAND_UNSUPPORTED,
      'TOPOLOGY_COMMAND payload requires one native TopologyEditCommand.v1.', TypeError);
  }
  return command;
}

function authorize(readModel, envelope) {
  const command = nativeCommand(envelope);
  const targets = resolveTopologyNativeCommandTargets(command, readModel.canonicalTopology);
  const authorization = authorizeTopologyCommandTargets({ targets,
    scope: readModel.commandScopeBasis, commandType: command.type,
    originKind: envelope.origin.kind });
  return { command, targets, authorization };
}

function replayCandidate(readModel, journal, core) {
  if (typeof core?.appendTopologyEditCommand !== 'function') {
    fail(TOPOLOGY_SCOPED_EDIT_DRY_RUN_REJECTION.REPLAY_MISMATCH,
      'Dry-run append requires the pure Topology replay core.');
  }
  try { return replayTopologyCommandJournal(journal, readModel.baseDraft, core); }
  catch (error) { fail(TOPOLOGY_SCOPED_EDIT_DRY_RUN_REJECTION.REPLAY_MISMATCH, error.message); }
}

export function createTopologyScopedEditDryRun(input = {}) {
  const readModel = input.readModel;
  const current = assertTopologyScopedEditCurrentProjection(readModel, input.currentProjection);
  const envelope = validatedEnvelope(readModel, input.envelope);
  const { command, targets, authorization } = authorize(readModel, envelope);
  const candidateJournal = appendExactEnvelope(readModel, envelope);
  const candidateReplay = replayCandidate(readModel, candidateJournal, input.core);
  const candidateProjection = createTopologyScopedEditJournalProjection({
    authorityId: readModel.authorityId, journal: candidateJournal,
    initialState: current.initialState,
  });
  return immutableJson({ schema: TOPOLOGY_SCOPED_EDIT_DRY_RUN_V1,
    authorityId: readModel.authorityId, currentProjectionHash: semanticHash(current),
    commandId: envelope.commandId, commandType: command.type, targetEvidence: targets,
    authorizationEvidence: authorization, currentRedoCommandIds: readModel.commandJournal.redoCommandIds,
    candidateProjection: candidateProjection.projection,
    candidateProjectionEvidence: candidateProjection,
    candidateReplayHash: topologyReplayStateHash(candidateReplay), accepted: false,
    persistencePerformed: false, productionAcceptancePerformed: false,
  }, 'Topology scoped-edit dry-run evidence');
}
