/** Atomic Topology journal authority with proven grants, regeneration, and one-writer recovery. */
import { activeJournalCommands } from '../../contracts/command-journal.js';
import {
  TOPOLOGY_SCOPED_EDIT_MODEL_WIDE_GRANT_V1, TOPOLOGY_SCOPED_EDIT_REGENERATION_EVIDENCE_V1,
  TOPOLOGY_SCOPED_EDIT_REJECTION, createTopologyScopedEditAcceptance,
  createTopologyScopedEditModelWideGrant, createTopologyScopedEditRegenerationEvidence,
  topologyScopedEditCodedError,
} from './topology-scoped-edit-authority-contracts.js';
import {
  deriveTopologyEditAuthority, prepareTopologyJournalAcceptance, prepareTopologyRecoveryLoad,
  reprepareTopologyJournalAcceptance, validateTopologyRecoverySnapshot,
} from './topology-scoped-edit-acceptance.js';
import { authorizeTopologyCommandTargets } from './topology-scoped-edit-command-scope.js';
import { resolveTopologyAttributeTargets, resolveTopologyNativeCommandTargets, resolveTopologyRemarkTargets } from './topology-scoped-edit-command-targets.js';
import { createTopologyCommandJournal, replayTopologyCommandJournal } from './topology-command-replay.js';
import { asArray, cleanText, objectRecord, semanticHash, semanticStringify } from './topology-validator-values.js';
const REGENERATION_OPERATIONS = new Set(['NATIVE', 'NATIVE_BATCH', 'UNDO', 'REDO', 'LOAD', 'LEGACY_IMPORT']);
function coded(code, message, Constructor = Error) { return topologyScopedEditCodedError(code, message, Constructor); }
function same(left, right) { return semanticStringify(left) === semanticStringify(right); }
function commandIdentity(commands) { return semanticHash(asArray(commands).map((row) => ({ id: cleanText(row.id), type: cleanText(row.type).toUpperCase(), payload: objectRecord(row.payload) }))); }
function flattenedOperations(commands) { return asArray(commands).flatMap((row) => cleanText(row.type).toUpperCase() === 'TRANSACTION' ? asArray(objectRecord(row.payload).operations).map(objectRecord) : [{ type: row.type, payload: row.payload }]).map((row) => ({ type: cleanText(row.type).toUpperCase(), payload: objectRecord(row.payload) })); }
function createServiceState(input) {
  if (typeof input.canonicalProvider !== 'function' || typeof input.scopeProvider !== 'function') throw new TypeError('Topology journal service requires canonicalProvider() and scopeProvider().');
  const journal = createTopologyCommandJournal(input.context, input.createdAt);
  return { core: input.core, context: input.context, baseDraft: input.baseDraft, recovery: input.recovery,
    canonicalProvider: input.canonicalProvider, scopeProvider: input.scopeProvider,
    reviewAuthorityProvider: input.reviewAuthorityProvider, autoFixCapability: input.autoFixCapability, issuedGrants: new Map(), issuedRegenerations: new Map(),
    journal, replayState: replayTopologyCommandJournal(journal, input.baseDraft, input.core),
    lastSnapshot: null, destroyed: false };
}
function requireLive(state, operation) { if (state.destroyed) throw coded(TOPOLOGY_SCOPED_EDIT_REJECTION.TOPOLOGY_EDIT_SERVICE_DESTROYED, `${operation} is unavailable after destroy().`, RangeError); }
function authority(state) { return deriveTopologyEditAuthority(state); }
function canonical(state, supplied) {
  const value = state.canonicalProvider();
  if (!value || typeof value !== 'object') throw coded(TOPOLOGY_SCOPED_EDIT_REJECTION.COMMAND_AUTHORITY_MISMATCH, 'Current canonical topology is required for command authorization.', TypeError);
  if (supplied && !same(supplied, value)) throw coded(TOPOLOGY_SCOPED_EDIT_REJECTION.COMMAND_AUTHORITY_MISMATCH, 'Supplied canonical topology does not match current command authority.', TypeError);
  return value;
}
function targetEvidence(commands, currentCanonical) { return asArray(commands).map((command) => resolveTopologyNativeCommandTargets(command, currentCanonical)); }
function targetHash(targets) { return semanticHash(asArray(targets).map((row) => ({ commandType: row.commandType, entityIds: row.entityIds, sourcePaths: row.sourcePaths, sourceBranchIndexes: row.sourceBranchIndexes }))); }
function liveReviewEvidence(state) {
  if (typeof state.reviewAuthorityProvider !== 'function') throw coded(
    TOPOLOGY_SCOPED_EDIT_REJECTION.MODEL_WIDE_AUTHORITY_PROVENANCE_INVALID,
    'Model-wide authority requires a live checker evidence provider.', TypeError);
  const evidence = objectRecord(state.reviewAuthorityProvider());
  const report = objectRecord(evidence.report), reviewState = objectRecord(evidence.reviewState);
  if (report.schema !== 'TopologyCheckReport.v1' || reviewState.schema !== 'TopologyReviewState.v1'
    || cleanText(report.canonicalTopologyHash) !== cleanText(canonical(state).canonicalTopologyHash)
    || cleanText(reviewState.canonicalTopologyHash) !== cleanText(report.canonicalTopologyHash)) {
    throw coded(TOPOLOGY_SCOPED_EDIT_REJECTION.MODEL_WIDE_AUTHORITY_PROVENANCE_INVALID,
      'Live checker report and review state do not match current canonical authority.', TypeError);
  }
  return { evidence, report, reviewState, suggestions: asArray(evidence.suggestions).map(objectRecord) };
}
function issueStatus(reviewState, issueId) { return cleanText(reviewState.issueStates?.[issueId]?.status) || 'OPEN'; }
function exactCurrentSuggestions(live, supplied) {
  const current = new Map(live.suggestions.map((row) => [cleanText(row.id), row]));
  return supplied.map((row) => {
    const match = current.get(cleanText(row.id));
    if (!match || !same(match, row)) throw coded(
      TOPOLOGY_SCOPED_EDIT_REJECTION.MODEL_WIDE_AUTHORITY_PROVENANCE_INVALID,
      `Suggestion ${cleanText(row.id) || '(missing)'} is not exact current checker evidence.`, TypeError);
    if (!live.report.issues.some((issue) => cleanText(issue.id) === cleanText(match.issueId))) throw coded(
      TOPOLOGY_SCOPED_EDIT_REJECTION.MODEL_WIDE_AUTHORITY_PROVENANCE_INVALID,
      `Suggestion ${match.id} does not reference a current checker issue.`, TypeError);
    if (issueStatus(live.reviewState, match.issueId) !== 'OPEN') throw coded(
      TOPOLOGY_SCOPED_EDIT_REJECTION.MODEL_WIDE_AUTHORITY_PROVENANCE_INVALID,
      `Suggestion ${match.id} is not attached to an Open issue.`, TypeError);
    return match;
  });
}
function reviewedEvidence(state, input, commands) {
  const live = liveReviewEvidence(state), evidence = objectRecord(input.evidence);
  const supplied = asArray(evidence.selectedSuggestions).map(objectRecord);
  if (!supplied.length) throw coded(TOPOLOGY_SCOPED_EDIT_REJECTION.MODEL_WIDE_AUTHORITY_PROVENANCE_INVALID, 'Reviewed authority requires selected suggestion evidence.', TypeError);
  const suggestions = exactCurrentSuggestions(live, supplied), approved = evidence.approvedOnly === true;
  if (approved && suggestions.some((row) => row.approvedByDefault !== true
    || cleanText(row.effectiveFixMode).toUpperCase() !== 'AUTO')) throw coded(
    TOPOLOGY_SCOPED_EDIT_REJECTION.MODEL_WIDE_AUTHORITY_PROVENANCE_INVALID,
    'Approved-only authority contains a suggestion that is not currently auto-approved.', TypeError);
  if (!approved && (suggestions.length !== 1 || evidence.approvalDisposition !== 'USER_CONFIRMED')) throw coded(
    TOPOLOGY_SCOPED_EDIT_REJECTION.MODEL_WIDE_AUTHORITY_PROVENANCE_INVALID,
    'Reviewed authority requires one explicitly confirmed current suggestion.', TypeError);
  const operations = suggestions.flatMap((row) => asArray(row.operations).map(objectRecord))
    .map((row) => ({ type: cleanText(row.type).toUpperCase(), payload: objectRecord(row.payload) }));
  if (!same(operations, flattenedOperations(commands))) throw coded(
    TOPOLOGY_SCOPED_EDIT_REJECTION.MODEL_WIDE_AUTHORITY_PROVENANCE_INVALID,
    'Reviewed suggestion operations do not exactly match the native batch.', TypeError);
  const ids = suggestions.map((row) => cleanText(row.id)).sort();
  return { evidenceKind: 'REVIEWED_FIX', evidenceId: ids.join('|'), evidenceHash: semanticHash({
    reportHash: reportHash(live.report), reviewStateHash: live.reviewState.topologyReviewStateHash,
    approved, suggestions,
  }) };
}
function reportHash(report) { return cleanText(report.topologyCheckReportHash) || semanticHash(report); }
function safeEvidence(state, input, commands) {
  const live = liveReviewEvidence(state), plan = objectRecord(input.evidence?.plan), run = objectRecord(plan.run);
  if (run.committed !== true || !cleanText(run.runId)) throw coded(TOPOLOGY_SCOPED_EDIT_REJECTION.MODEL_WIDE_AUTHORITY_PROVENANCE_INVALID, 'Safe authority requires a committed deterministic plan.', TypeError);
  if (cleanText(run.beforeTopologyHash) !== cleanText(canonical(state).canonicalTopologyHash)
    || cleanText(run.policyHash) !== cleanText(live.evidence.policyHash)) throw coded(
    TOPOLOGY_SCOPED_EDIT_REJECTION.MODEL_WIDE_AUTHORITY_PROVENANCE_INVALID,
    'Safe plan canonical or policy basis is stale.', TypeError);
  const selectedIssueIds = asArray(run.selectedIssueIds).map(cleanText).filter(Boolean).sort();
  const liveByIssue = new Map(live.suggestions.map((row) => [cleanText(row.issueId), row]));
  const eligible = selectedIssueIds.map((issueId) => {
    const suggestion = liveByIssue.get(issueId);
    const issue = asArray(live.report.issues).find((row) => cleanText(row.id) === issueId);
    if (!suggestion || !issue || issueStatus(live.reviewState, issueId) !== 'OPEN'
      || cleanText(suggestion.effectiveFixMode).toUpperCase() !== 'AUTO'
      || cleanText(suggestion.confidence).toUpperCase() !== 'HIGH') throw coded(
      TOPOLOGY_SCOPED_EDIT_REJECTION.MODEL_WIDE_AUTHORITY_PROVENANCE_INVALID,
      `Safe plan issue ${issueId || '(missing)'} is not currently Open + High + Auto.`, TypeError);
    return suggestion;
  });
  const applied = asArray(run.applied).map(objectRecord);
  for (const row of applied) {
    const suggestion = objectRecord(row.suggestion), current = liveByIssue.get(cleanText(row.issue?.id));
    if (!current || !same(current, suggestion) || !eligible.some((item) => cleanText(item.id) === cleanText(current.id))) throw coded(
      TOPOLOGY_SCOPED_EDIT_REJECTION.MODEL_WIDE_AUTHORITY_PROVENANCE_INVALID,
      'Safe plan applied evidence does not match current eligible suggestions.', TypeError);
  }
  const suffix = asArray(plan.candidateDraft?.commands).slice(asArray(state.replayState.draft.commands).length);
  if (!same(suffix, commands)) throw coded(TOPOLOGY_SCOPED_EDIT_REJECTION.MODEL_WIDE_AUTHORITY_PROVENANCE_INVALID, 'Safe plan candidate commands do not exactly match the native batch.', TypeError);
  const operations = applied.flatMap((row) => asArray(row.suggestion?.operations).map(objectRecord))
    .map((row) => ({ type: cleanText(row.type).toUpperCase(), payload: objectRecord(row.payload) }));
  if (!same(operations, flattenedOperations(commands))) throw coded(TOPOLOGY_SCOPED_EDIT_REJECTION.MODEL_WIDE_AUTHORITY_PROVENANCE_INVALID, 'Safe plan operations do not exactly match the native batch.', TypeError);
  return { evidenceKind: 'SAFE_AUTOFIX_PLAN', evidenceId: cleanText(run.runId), evidenceHash: semanticHash({
    plan, reportHash: reportHash(live.report), reviewStateHash: live.reviewState.topologyReviewStateHash,
    policyHash: live.evidence.policyHash,
  }) };
}
function issueModelWideAuthority(state, input = {}) {
  requireLive(state, 'issueModelWideAuthority');
  if (input.capability !== state.autoFixCapability || !state.autoFixCapability) throw coded(TOPOLOGY_SCOPED_EDIT_REJECTION.MODEL_WIDE_AUTHORITY_PROVENANCE_INVALID, 'Model-wide authority issuer capability is invalid.', TypeError);
  const current = authority(state);
  if (cleanText(input.expectedAuthorityId) !== current.authorityId) throw coded(TOPOLOGY_SCOPED_EDIT_REJECTION.STALE_TOPOLOGY_EDIT_AUTHORITY, 'Model-wide authority was requested against stale state.', RangeError);
  const commands = asArray(input.nativeCommands), currentCanonical = canonical(state, input.canonical), targets = targetEvidence(commands, currentCanonical);
  if (!commands.length) throw coded(TOPOLOGY_SCOPED_EDIT_REJECTION.EMPTY_COMMAND_TARGET_SET, 'Model-wide authority requires a native command batch.', TypeError);
  const mode = cleanText(input.authorityMode);
  if (!['MODEL_WIDE_REVIEWED_FIX', 'MODEL_WIDE_SAFE_AUTOFIX'].includes(mode)) throw coded(TOPOLOGY_SCOPED_EDIT_REJECTION.INVALID_MODEL_WIDE_AUTHORITY, 'Unsupported model-wide authority mode.', TypeError);
  const reviewed = mode === 'MODEL_WIDE_REVIEWED_FIX';
  const provenance = reviewed ? reviewedEvidence(state, input, commands) : safeEvidence(state, input, commands);
  const grant = createTopologyScopedEditModelWideGrant({ authorityMode: mode,
    sourceAuthorityId: current.authorityId, originKind: 'AUTOFIX', ...provenance,
    commandIdentityHash: commandIdentity(commands), targetHash: targetHash(targets),
    nativeCommandIds: commands.map((row) => cleanText(row.id)) });
  state.issuedGrants.set(grant.grantId, grant); return grant;
}
function validateGrant(state, grant, commands, targets) {
  const issued = grant?.grantId ? state.issuedGrants.get(grant.grantId) : null;
  if (grant?.schema !== TOPOLOGY_SCOPED_EDIT_MODEL_WIDE_GRANT_V1 || !issued || !same(issued, grant)) throw coded(TOPOLOGY_SCOPED_EDIT_REJECTION.MODEL_WIDE_AUTHORITY_PROVENANCE_INVALID, 'Model-wide authority grant was not issued by this live service.', TypeError);
  if (grant.sourceAuthorityId !== authority(state).authorityId || grant.commandIdentityHash !== commandIdentity(commands) || grant.targetHash !== targetHash(targets)) throw coded(TOPOLOGY_SCOPED_EDIT_REJECTION.MODEL_WIDE_AUTHORITY_PROVENANCE_INVALID, 'Model-wide authority grant does not match current authority, commands, or targets.', TypeError);
  return grant;
}
function authorizationFor(state, input, targets, commandType) {
  const scope = state.scopeProvider({ commandType, targets, origin: input.origin,
    authorityMode: input.authorityMode, modelWideGrant: input.modelWideGrant });
  if (!scope) throw coded(TOPOLOGY_SCOPED_EDIT_REJECTION.COMMAND_AUTHORITY_MISMATCH, 'scopeProvider must return current command authority.', TypeError);
  const derived = authorizeTopologyCommandTargets({ targets, scope, commandType, originKind: input.origin?.kind });
  if (input.scope && !same(input.scope, scope) || input.authorization && !same(input.authorization, derived)) throw coded(TOPOLOGY_SCOPED_EDIT_REJECTION.COMMAND_AUTHORITY_MISMATCH, 'Supplied scope or authorization does not match current command authority.', TypeError);
  return derived;
}
function prepare(state, request) { requireLive(state, 'prepare'); return prepareTopologyJournalAcceptance({ ...state, request }); }
function prepareNative(state, input = {}) {
  const currentCanonical = canonical(state, input.canonical), targets = resolveTopologyNativeCommandTargets(input.nativeCommand, currentCanonical);
  const authorization = authorizationFor(state, input, targets, input.nativeCommand.type);
  return prepare(state, { operation: 'NATIVE', expectedAuthorityId: input.expectedAuthorityId,
    nativeCommand: input.nativeCommand, authorization, origin: input.origin, uiState: input.uiState,
    updatedAt: input.updatedAt, expectedDraftHash: input.expectedDraftHash });
}
function prepareNativeBatch(state, input = {}) {
  const commands = asArray(input.nativeCommands), currentCanonical = canonical(state, input.canonical), targets = targetEvidence(commands, currentCanonical);
  const grant = input.modelWideGrant ? validateGrant(state, input.modelWideGrant, commands, targets) : null;
  const authorizations = commands.map((command, index) => authorizationFor(state,
    { ...input, authorityMode: grant?.authorityMode ?? input.authorityMode, modelWideGrant: grant }, targets[index], command.type));
  return prepare(state, { operation: 'NATIVE_BATCH', expectedAuthorityId: input.expectedAuthorityId,
    nativeCommands: commands, authorizations, origin: input.origin, uiState: input.uiState,
    updatedAt: input.updatedAt, expectedDraftHash: input.expectedDraftHash, modelWideGrant: grant });
}
function prepareAttribute(state, input = {}) { const targets = resolveTopologyAttributeTargets(input.edit, canonical(state, input.canonical)); const authorization = authorizationFor(state, input, targets, 'ATTRIBUTE_EDIT'); return prepare(state, { operation: 'ATTRIBUTE', expectedAuthorityId: input.expectedAuthorityId, edit: input.edit, authorization, origin: input.origin, uiState: input.uiState, updatedAt: input.updatedAt, expectedDraftHash: authority(state).currentDraftHash }); }
function prepareRemark(state, input = {}) { const targets = resolveTopologyRemarkTargets(input.targetId, canonical(state, input.canonical), state.replayState); const authorization = authorizationFor(state, input, targets, 'REMARK_SET'); return prepare(state, { operation: 'REMARK', expectedAuthorityId: input.expectedAuthorityId, targetId: cleanText(input.targetId), value: cleanText(input.value), previousValue: cleanText(state.replayState.remarks[cleanText(input.targetId)]), authorization, origin: input.origin, uiState: input.uiState, updatedAt: input.updatedAt, expectedDraftHash: authority(state).currentDraftHash }); }
function prepareProjection(state, operation, uiState, updatedAt, expectedAuthorityId) { return prepare(state, { operation, expectedAuthorityId, uiState, updatedAt, expectedDraftHash: '' }); }
function prepareLoad(state, snapshot, expectedAuthorityId) { requireLive(state, 'prepareLoad'); return prepareTopologyRecoveryLoad({ ...state, snapshot, expectedAuthorityId }); }
function prepareLegacyImport(state, legacy, origin, uiState, updatedAt, options = {}) { if (legacy?.schema !== 'TopologyEditDraft.v1' || legacy.baseCanonicalTopologyHash !== state.baseDraft.baseCanonicalTopologyHash) throw coded(TOPOLOGY_SCOPED_EDIT_REJECTION.RECOVERY_HEAD_MISMATCH, 'Legacy draft basis does not match.', TypeError); return prepareNativeBatch(state, { ...options, nativeCommands: legacy.commands, origin, uiState, updatedAt, expectedAuthorityId: options.expectedAuthorityId, expectedDraftHash: legacy.topologyEditDraftHash }); }
function certifyRegeneration(state, prepared, built) {
  requireLive(state, 'certifyRegeneration');
  const draftHash = cleanText(built?.editDraft?.topologyEditDraftHash), canonicalHash = cleanText(built?.canonicalTopology?.canonicalTopologyHash);
  if (draftHash !== prepared.expectedDraftHash || !canonicalHash) throw coded(TOPOLOGY_SCOPED_EDIT_REJECTION.REGENERATION_EVIDENCE_INVALID, 'Full producer regeneration does not certify the prepared draft and canonical topology.', TypeError);
  const evidence = createTopologyScopedEditRegenerationEvidence({ preparedId: prepared.preparedId,
    candidateDraftHash: draftHash, canonicalTopologyHash: canonicalHash,
    artifactsHash: semanticHash({ editDraft: built.editDraft, canonicalTopology: built.canonicalTopology,
      editLedger: built.editLedger, editValidation: built.editValidation }) });
  state.issuedRegenerations.set(evidence.evidenceId, evidence); return evidence;
}
function currentHeadCheck(state, prepared) { const current = authority(state); if (prepared.expectedAuthorityId !== current.authorityId) throw coded(TOPOLOGY_SCOPED_EDIT_REJECTION.STALE_TOPOLOGY_EDIT_AUTHORITY, 'Prepared work is stale against accepted in-memory authority.', RangeError); return current; }
function revalidateTargets(state, prepared) {
  const request = prepared.request, currentCanonical = canonical(state);
  if (request.modelWideGrant) validateGrant(state, request.modelWideGrant, request.nativeCommands, targetEvidence(request.nativeCommands, currentCanonical));
  if (request.operation === 'NATIVE') authorizationFor(state, { authorization: prepared.authorization, origin: request.origin }, resolveTopologyNativeCommandTargets(request.nativeCommand, currentCanonical), request.nativeCommand.type);
  if (request.operation === 'NATIVE_BATCH') request.nativeCommands.forEach((command, index) => authorizationFor(state, { authorization: prepared.authorization[index], origin: request.origin, authorityMode: prepared.authorization[index].scope.authorityMode, modelWideGrant: prepared.authorization[index].scope.modelWideGrant }, resolveTopologyNativeCommandTargets(command, currentCanonical), command.type));
  if (request.operation === 'ATTRIBUTE') authorizationFor(state, { authorization: prepared.authorization, origin: request.origin }, resolveTopologyAttributeTargets(request.edit, currentCanonical), 'ATTRIBUTE_EDIT');
  if (request.operation === 'REMARK') authorizationFor(state, { authorization: prepared.authorization, origin: request.origin }, resolveTopologyRemarkTargets(request.targetId, currentCanonical, state.replayState), 'REMARK_SET');
}
function validateRegeneration(state, prepared, evidence) {
  if (!REGENERATION_OPERATIONS.has(prepared.operation)) return;
  const issued = evidence?.evidenceId ? state.issuedRegenerations.get(evidence.evidenceId) : null;
  if (evidence?.schema !== TOPOLOGY_SCOPED_EDIT_REGENERATION_EVIDENCE_V1 || evidence.preparedId !== prepared.preparedId || evidence.candidateDraftHash !== prepared.expectedDraftHash || !issued || !same(issued, evidence)) throw coded(TOPOLOGY_SCOPED_EDIT_REJECTION.REGENERATION_EVIDENCE_INVALID, 'Prepared transition lacks matching full-regeneration evidence.', TypeError);
}
function failure(state, prepared, error) { const current = authority(state); return createTopologyScopedEditAcceptance({ accepted: false, reasonCode: error.code ?? TOPOLOGY_SCOPED_EDIT_REJECTION.PREPARED_ACCEPTANCE_INVALID, message: error.message, currentAuthorityId: current.authorityId, expectedAuthorityId: prepared?.expectedAuthorityId ?? current.authorityId }); }
function snapshotAuthority(state, snapshot) { return validateTopologyRecoverySnapshot({ ...state, snapshot }).authority.authorityId; }
function acceptPrepared(state, prepared, regenerationEvidence = null) {
  try {
    requireLive(state, 'acceptPrepared'); const current = currentHeadCheck(state, prepared); revalidateTargets(state, prepared);
    const verified = reprepareTopologyJournalAcceptance({ ...state, prepared }); validateRegeneration(state, verified, regenerationEvidence);
    const success = createTopologyScopedEditAcceptance({ accepted: true, message: 'Topology edit authority accepted atomically.', currentAuthorityId: verified.nextAuthority.authorityId, expectedAuthorityId: prepared.expectedAuthorityId, authority: verified.nextAuthority, state: verified.candidateReplayState, snapshot: verified.candidateSnapshot });
    let persisted;
    try { persisted = state.recovery.accept({ documentId: state.context.document.documentId,
      expectedAuthorityId: state.lastSnapshot ? current.authorityId : null,
      nextSnapshot: verified.candidateSnapshot, nextAuthorityId: verified.nextAuthority.authorityId,
      authorityOf: (snapshot) => snapshotAuthority(state, snapshot) }); }
    catch (error) { if (error.code) throw error; throw coded(TOPOLOGY_SCOPED_EDIT_REJECTION.RECOVERY_PERSISTENCE_FAILED, error.message, Error); }
    if (!persisted.accepted) throw coded(TOPOLOGY_SCOPED_EDIT_REJECTION.STALE_TOPOLOGY_EDIT_AUTHORITY, 'Persisted recovery authority changed before publication.', RangeError);
    state.journal = verified.candidateJournal; state.replayState = verified.candidateReplayState; state.lastSnapshot = verified.candidateSnapshot;
    const grantId = verified.request.modelWideGrant?.grantId; if (grantId) state.issuedGrants.delete(grantId); if (regenerationEvidence) state.issuedRegenerations.delete(regenerationEvidence.evidenceId);
    return success;
  } catch (error) { return failure(state, prepared, error); }
}
function acceptedState(acceptance) { if (!acceptance.accepted) throw coded(acceptance.reasonCode, acceptance.message, RangeError); return acceptance.state; }
function appendNative(state, nativeCommand, origin, uiState, updatedAt, options = {}) { const prepared = prepareNative(state, { ...options, nativeCommand, origin, uiState, updatedAt, expectedAuthorityId: options.expectedAuthorityId ?? authority(state).authorityId }); return acceptedState(acceptPrepared(state, prepared, options.regenerationEvidence)); }
function appendNativeBatch(state, nativeCommands, origin, uiState, updatedAt, options = {}) { const prepared = prepareNativeBatch(state, { ...options, nativeCommands, origin, uiState, updatedAt, expectedAuthorityId: options.expectedAuthorityId ?? authority(state).authorityId }); return acceptedState(acceptPrepared(state, prepared, options.regenerationEvidence)); }
function appendAttribute(state, edit, origin, uiState, updatedAt, options = {}) { const prepared = prepareAttribute(state, { ...options, edit, origin, uiState, updatedAt, expectedAuthorityId: options.expectedAuthorityId ?? authority(state).authorityId }); return acceptedState(acceptPrepared(state, prepared)); }
function setRemark(state, targetId, value, origin, uiState, updatedAt, options = {}) { const prepared = prepareRemark(state, { ...options, targetId, value, origin, uiState, updatedAt, expectedAuthorityId: options.expectedAuthorityId ?? authority(state).authorityId }); return acceptedState(acceptPrepared(state, prepared)); }
function checkpoint(state, uiState, updatedAt) { const prepared = prepareProjection(state, 'CHECKPOINT', uiState, updatedAt, authority(state).authorityId); return acceptedState(acceptPrepared(state, prepared)); }
function restore(state) { requireLive(state, 'restore'); const snapshot = state.recovery.load(state.context.document.documentId); if (!snapshot) return null; const recovered = validateTopologyRecoverySnapshot({ ...state, snapshot }); state.journal = recovered.snapshot.commandJournal; state.replayState = recovered.replayState; state.lastSnapshot = recovered.snapshot; return Object.freeze({ state: state.replayState, uiState: recovered.snapshot.uiState, commandCount: state.journal.activeCommandIds.length, authority: recovered.authority }); }
function destroy(state) { state.destroyed = true; state.recovery.releaseWriter(); return Object.freeze({ destroyed: true, authorityId: authority(state).authorityId }); }
export function createTopologyEditJournalService(input) {
  const state = createServiceState(input);
  return Object.freeze({ currentAuthority: () => authority(state), issueModelWideAuthority: (value) => issueModelWideAuthority(state, value),
    prepareNative: (value) => prepareNative(state, value), prepareNativeBatch: (value) => prepareNativeBatch(state, value),
    prepareAttribute: (value) => prepareAttribute(state, value), prepareRemark: (value) => prepareRemark(state, value),
    prepareUndo: (uiState, updatedAt, expected) => prepareProjection(state, 'UNDO', uiState, updatedAt, expected),
    prepareRedo: (uiState, updatedAt, expected) => prepareProjection(state, 'REDO', uiState, updatedAt, expected),
    prepareLoad: (snapshot, expected) => prepareLoad(state, snapshot, expected), prepareLegacyImport: (...args) => prepareLegacyImport(state, ...args),
    certifyRegeneration: (prepared, built) => certifyRegeneration(state, prepared, built), acceptPrepared: (prepared, evidence) => acceptPrepared(state, prepared, evidence),
    appendNative: (...args) => appendNative(state, ...args), appendNativeBatch: (...args) => appendNativeBatch(state, ...args),
    appendAttribute: (...args) => appendAttribute(state, ...args), setRemark: (...args) => setRemark(state, ...args), checkpoint: (...args) => checkpoint(state, ...args),
    restore: () => restore(state), evidence: () => Object.freeze({ journal: state.journal, state: state.replayState,
      commandEnvelopes: activeJournalCommands(state.journal), lastSnapshot: state.lastSnapshot,
      authority: authority(state), destroyed: state.destroyed, writer: state.recovery.writerEvidence() }), destroy: () => destroy(state) });
}
