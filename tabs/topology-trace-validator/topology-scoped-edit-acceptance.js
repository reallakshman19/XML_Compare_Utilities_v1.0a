/** Pure candidate preparation and recovery validation for Topology journal authority. */
import { checkpointCommandJournal, redoCommandJournal, undoCommandJournal, validateCommandJournal } from '../../contracts/command-journal.js';
import {
  TOPOLOGY_SCOPED_EDIT_PREPARED_ACCEPTANCE_V1, TOPOLOGY_SCOPED_EDIT_REJECTION,
  createTopologyScopedEditAuthorityBasis, createTopologyScopedEditPreparedAcceptance,
  topologyScopedEditCodedError,
} from './topology-scoped-edit-authority-contracts.js';
import { revalidateTopologyScopedEditAuthorization } from './topology-scoped-edit-command-scope.js';
import {
  appendTopologyAttributeJournalCommand, appendTopologyNativeJournalCommand,
  appendTopologyNativeJournalCommands, appendTopologyRemarkJournalCommand,
  replayTopologyCommandJournal, topologyReplayStateHash,
} from './topology-command-replay.js';
import { assertTopologyDraftBasis, createTopologyEditSessionDraft, validateTopologyEditSessionDraft } from './topology-edit-session-draft.js';
import { cleanText, objectRecord, semanticHash } from './topology-validator-values.js';
function fail(code, message, Constructor = Error) { throw topologyScopedEditCodedError(code, message, Constructor); }
export function deriveTopologyEditAuthority(input = {}) {
  const replayState = input.replayState, journal = input.journal;
  return createTopologyScopedEditAuthorityBasis({ documentId: input.context.document.documentId,
    sourceHash: input.context.document.sourceHash, baseCanonicalTopologyHash: input.baseDraft.baseCanonicalTopologyHash,
    currentDraftHash: replayState.draft.topologyEditDraftHash, journalHash: semanticHash(journal),
    replayHash: topologyReplayStateHash(replayState), activeCommandIds: journal.activeCommandIds,
    redoCommandIds: journal.redoCommandIds });
}
function replayCandidate(input, journal) { try { return replayTopologyCommandJournal(journal, input.baseDraft, input.core); } catch (error) { fail(TOPOLOGY_SCOPED_EDIT_REJECTION.JOURNAL_REPLAY_FAILED, error.message, TypeError); } }
function validateAuthorization(request) {
  if (request.operation === 'NATIVE') return revalidateTopologyScopedEditAuthorization(request.authorization, request.nativeCommand.type);
  if (request.operation === 'NATIVE_BATCH') {
    if (request.authorizations.length !== request.nativeCommands.length) fail(TOPOLOGY_SCOPED_EDIT_REJECTION.COMMAND_AUTHORITY_MISMATCH, 'Native batch authorization count is invalid.', TypeError);
    return request.authorizations.map((authorization, index) => revalidateTopologyScopedEditAuthorization(authorization, request.nativeCommands[index].type));
  }
  if (request.operation === 'ATTRIBUTE') return revalidateTopologyScopedEditAuthorization(request.authorization, 'ATTRIBUTE_EDIT');
  if (request.operation === 'REMARK') return revalidateTopologyScopedEditAuthorization(request.authorization, 'REMARK_SET');
  return null;
}
function candidateJournal(input, request) {
  const journal = input.journal, base = input.baseDraft;
  if (request.operation === 'NATIVE') return appendTopologyNativeJournalCommand(journal, base, request.nativeCommand, request.origin, request.updatedAt);
  if (request.operation === 'NATIVE_BATCH') return appendTopologyNativeJournalCommands(journal, base, request.nativeCommands, request.origin, request.updatedAt);
  if (request.operation === 'ATTRIBUTE') return appendTopologyAttributeJournalCommand(journal, base, request.edit, request.origin, request.updatedAt);
  if (request.operation === 'REMARK') return appendTopologyRemarkJournalCommand(journal, base, request.targetId, request.value, request.previousValue, request.origin, request.updatedAt);
  if (request.operation === 'UNDO') return undoCommandJournal(journal, request.updatedAt);
  if (request.operation === 'REDO') return redoCommandJournal(journal, request.updatedAt);
  if (request.operation === 'CHECKPOINT') return checkpointCommandJournal(journal, topologyReplayStateHash(input.replayState), request.updatedAt);
  fail(TOPOLOGY_SCOPED_EDIT_REJECTION.PREPARED_ACCEPTANCE_INVALID, `Unsupported prepared operation ${request.operation}.`, RangeError);
}
function candidateSnapshot(input, journal, request) {
  try {
    const snapshot = createTopologyEditSessionDraft({ context: input.context, baseDraft: input.baseDraft,
      commandJournal: journal, uiState: request.uiState, savedAt: request.updatedAt });
    const errors = validateTopologyEditSessionDraft(snapshot);
    if (errors.length) fail(TOPOLOGY_SCOPED_EDIT_REJECTION.SESSION_DRAFT_INVALID, errors.join('; '), TypeError);
    return snapshot;
  } catch (error) { if (error.code) throw error; fail(TOPOLOGY_SCOPED_EDIT_REJECTION.SESSION_DRAFT_INVALID, error.message, TypeError); }
}
function expectedDraftHash(request, replayState) {
  const actual = cleanText(replayState.draft.topologyEditDraftHash), expected = cleanText(request.expectedDraftHash) || actual;
  if (actual !== expected) fail(TOPOLOGY_SCOPED_EDIT_REJECTION.CANDIDATE_DRAFT_HASH_MISMATCH, `Candidate draft hash ${actual} does not match expected ${expected}.`, TypeError);
  return expected;
}
function preparedRecord(input, request, authorization, journal, replayState, snapshot, nextAuthority) {
  const expectedHash = expectedDraftHash(request, replayState);
  const requestEvidence = { ...request, expectedDraftHash: expectedHash, authorization: undefined, authorizations: undefined };
  const commandIdentityHash = semanticHash({ request: requestEvidence, authorization });
  const preparedId = `TPREP-${semanticHash({ current: request.expectedAuthorityId, commandIdentityHash, next: nextAuthority.authorityId, snapshot }).split(':')[1]}`;
  return createTopologyScopedEditPreparedAcceptance({ preparedId, operation: request.operation,
    expectedAuthorityId: request.expectedAuthorityId, expectedDraftHash: expectedHash,
    commandIdentityHash, request: { ...request, expectedDraftHash: expectedHash }, authorization,
    candidateJournal: journal, candidateReplayState: replayState, candidateSnapshot: snapshot, nextAuthority });
}
export function prepareTopologyJournalAcceptance(input = {}) {
  const current = deriveTopologyEditAuthority(input), request = objectRecord(input.request);
  if (cleanText(request.expectedAuthorityId) !== current.authorityId) fail(TOPOLOGY_SCOPED_EDIT_REJECTION.STALE_TOPOLOGY_EDIT_AUTHORITY, 'Prepared work does not match the current Topology edit authority.', RangeError);
  const authorization = validateAuthorization(request);
  let journal = candidateJournal(input, request), replayState = replayCandidate(input, journal);
  const sequence = journal.nextSequence - 1, last = journal.checkpoints.at(-1);
  if (request.operation !== 'CHECKPOINT' && sequence > 0 && sequence % 10 === 0 && last?.sequence !== sequence) journal = checkpointCommandJournal(journal, topologyReplayStateHash(replayState), request.updatedAt);
  const snapshot = candidateSnapshot(input, journal, request), nextAuthority = deriveTopologyEditAuthority({ ...input, journal, replayState });
  return preparedRecord(input, { ...request, expectedAuthorityId: current.authorityId }, authorization, journal, replayState, snapshot, nextAuthority);
}
export function prepareTopologyRecoveryLoad(input = {}) {
  const current = deriveTopologyEditAuthority(input), expectedAuthorityId = cleanText(input.expectedAuthorityId);
  if (expectedAuthorityId !== current.authorityId) fail(TOPOLOGY_SCOPED_EDIT_REJECTION.STALE_TOPOLOGY_EDIT_AUTHORITY, 'Loaded draft was prepared against stale authority.', RangeError);
  const loaded = validateTopologyRecoverySnapshot({ ...input, snapshot: input.snapshot });
  const request = { operation: 'LOAD', expectedAuthorityId, expectedDraftHash: loaded.replayState.draft.topologyEditDraftHash,
    snapshot: loaded.snapshot, uiState: loaded.snapshot.uiState, updatedAt: loaded.snapshot.savedAt };
  return preparedRecord(input, request, null, loaded.snapshot.commandJournal, loaded.replayState, loaded.snapshot, loaded.authority);
}
export function reprepareTopologyJournalAcceptance(input = {}) {
  const prepared = input.prepared;
  if (prepared?.schema !== TOPOLOGY_SCOPED_EDIT_PREPARED_ACCEPTANCE_V1) fail(TOPOLOGY_SCOPED_EDIT_REJECTION.PREPARED_ACCEPTANCE_INVALID, 'Prepared acceptance schema is invalid.', TypeError);
  let recomputed;
  if (prepared.operation === 'LOAD') recomputed = prepareTopologyRecoveryLoad({ ...input, expectedAuthorityId: prepared.expectedAuthorityId, snapshot: prepared.request.snapshot });
  else {
    const request = { ...prepared.request };
    if (request.operation === 'NATIVE_BATCH') request.authorizations = prepared.authorization;
    else if (prepared.authorization) request.authorization = prepared.authorization;
    recomputed = prepareTopologyJournalAcceptance({ ...input, request });
  }
  if (recomputed.preparedId !== prepared.preparedId || semanticHash(recomputed) !== semanticHash(prepared)) fail(TOPOLOGY_SCOPED_EDIT_REJECTION.PREPARED_ACCEPTANCE_INVALID, 'Prepared acceptance does not recompute identically.', TypeError);
  return recomputed;
}
function checkpointJournal(journal, checkpoint) {
  const entries = journal.entries.filter((entry) => entry.sequence <= checkpoint.sequence), ids = new Set(entries.map((entry) => entry.commandId));
  if (checkpoint.activeCommandIds.some((id) => !ids.has(id))) fail(TOPOLOGY_SCOPED_EDIT_REJECTION.SESSION_DRAFT_INVALID, `Checkpoint ${checkpoint.checkpointId} references a command after its sequence.`, TypeError);
  const maximum = Math.max(0, ...entries.map((entry) => entry.sequence));
  if (maximum !== checkpoint.sequence) fail(TOPOLOGY_SCOPED_EDIT_REJECTION.SESSION_DRAFT_INVALID, `Checkpoint ${checkpoint.checkpointId} sequence does not identify an exact journal prefix.`, TypeError);
  return Object.freeze({ ...journal, entries: Object.freeze(entries), activeCommandIds: checkpoint.activeCommandIds,
    redoCommandIds: Object.freeze([]), checkpoints: Object.freeze([]), nextSequence: maximum + 1 });
}
export function validateTopologyRecoverySnapshot(input = {}) {
  const snapshot = input.snapshot;
  try { assertTopologyDraftBasis(snapshot, input.context); } catch (error) { fail(TOPOLOGY_SCOPED_EDIT_REJECTION.RECOVERY_HEAD_MISMATCH, error.message, TypeError); }
  if (snapshot.baseDraft.baseCanonicalTopologyHash !== input.baseDraft.baseCanonicalTopologyHash) fail(TOPOLOGY_SCOPED_EDIT_REJECTION.RECOVERY_HEAD_MISMATCH, 'Recovery canonical basis does not match the active producer basis.', TypeError);
  const errors = validateTopologyEditSessionDraft(snapshot); if (errors.length) fail(TOPOLOGY_SCOPED_EDIT_REJECTION.SESSION_DRAFT_INVALID, errors.join('; '), TypeError);
  const journalErrors = validateCommandJournal(snapshot.commandJournal); if (journalErrors.length) fail(TOPOLOGY_SCOPED_EDIT_REJECTION.SESSION_DRAFT_INVALID, journalErrors.join('; '), TypeError);
  for (const checkpoint of snapshot.commandJournal.checkpoints) { const state = replayCandidate(input, checkpointJournal(snapshot.commandJournal, checkpoint)); if (topologyReplayStateHash(state) !== checkpoint.stateHash) fail(TOPOLOGY_SCOPED_EDIT_REJECTION.SESSION_DRAFT_INVALID, `Checkpoint ${checkpoint.checkpointId} stateHash is forged or inconsistent.`, TypeError); }
  const replayState = replayCandidate(input, snapshot.commandJournal);
  return Object.freeze({ snapshot, replayState, authority: deriveTopologyEditAuthority({ ...input, journal: snapshot.commandJournal, replayState }) });
}
export const _test = Object.freeze({ checkpointJournal, candidateJournal, validateAuthorization });
