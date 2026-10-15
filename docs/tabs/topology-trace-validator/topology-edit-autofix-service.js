/** Edit Draft commit services for provenance-bound reviewed and safe automatic fixes. */
import { planSafeTopologyAutoFixes, topologyGeometryHash } from './topology-checker-auto-fix.js';
import { TOPOLOGY_COMMAND_AUTHORITY_MODE } from './topology-scoped-edit-command-scope.js';
import { asArray, cleanText, objectRecord } from './topology-validator-values.js';

export const TOPOLOGY_AUTO_FIX_COMMIT_PROOF_SCHEMA = 'TopologyAutoFixCommitProof.v1';

function acceptedState(acceptance) { if (!acceptance.accepted) { const error = new Error(acceptance.message); error.code = acceptance.reasonCode; throw error; } return acceptance.state; }
function acceptBatch(input, commands, built, expectedDraftHash, authorityMode, evidence) {
  const current = input.journalService.currentAuthority();
  const grant = input.journalService.issueModelWideAuthority({ capability: input.authorityCapability,
    expectedAuthorityId: current.authorityId, authorityMode, nativeCommands: commands,
    canonical: input.canonical, evidence });
  const prepared = input.journalService.prepareNativeBatch({ expectedAuthorityId: current.authorityId,
    nativeCommands: commands, origin: input.origin, uiState: input.uiState,
    updatedAt: input.origin.issuedAt, expectedDraftHash, canonical: input.canonical,
    modelWideGrant: grant });
  const regeneration = input.journalService.certifyRegeneration(prepared, built);
  return acceptedState(input.journalService.acceptPrepared(prepared, regeneration));
}

function commitProofFailure(message) {
  const error = new Error(`Auto fix commit proof failed: ${message}`);
  error.code = 'TOPOLOGY_AUTOFIX_COMMIT_PROOF_INVALID';
  throw error;
}

function nativeCommandId(envelope) {
  return cleanText(objectRecord(objectRecord(envelope).payload).nativeCommand?.id);
}

function buildAutoFixCommitProof(input, beforeAuthority, state, built, run) {
  const evidence = objectRecord(input.journalService.evidence());
  const afterAuthority = objectRecord(evidence.authority), journal = objectRecord(evidence.journal);
  const snapshot = objectRecord(evidence.lastSnapshot), replay = objectRecord(state);
  const stateDraft = objectRecord(replay.draft), builtDraft = objectRecord(built?.editDraft);
  const builtCanonical = objectRecord(built?.canonicalTopology);
  const beforeAuthorityId = cleanText(beforeAuthority?.authorityId), afterAuthorityId = cleanText(afterAuthority.authorityId);
  const currentDraftHash = cleanText(stateDraft.topologyEditDraftHash), builtDraftHash = cleanText(builtDraft.topologyEditDraftHash);
  const canonicalTopologyHash = cleanText(builtCanonical.canonicalTopologyHash), transactionId = cleanText(run?.transactionId);
  const activeCommandIds = Object.freeze(asArray(journal.activeCommandIds).map(cleanText).filter(Boolean));
  const activeEnvelopes = asArray(evidence.commandEnvelopes).map(objectRecord);
  const transactionEnvelope = activeEnvelopes.find((row) => nativeCommandId(row) === transactionId);
  const journalCommandId = cleanText(transactionEnvelope?.commandId);
  const recoveryJournal = objectRecord(snapshot.commandJournal);
  const recoveryCommandIds = Object.freeze(asArray(recoveryJournal.activeCommandIds).map(cleanText).filter(Boolean));
  const recoveryEnvelope = asArray(recoveryJournal.entries).map(objectRecord)
    .find((row) => cleanText(row.commandId) === journalCommandId && nativeCommandId(row) === transactionId);

  if (!beforeAuthorityId || !afterAuthorityId || beforeAuthorityId === afterAuthorityId) commitProofFailure('journal authority did not advance.');
  if (!currentDraftHash || currentDraftHash !== cleanText(afterAuthority.currentDraftHash)) commitProofFailure('accepted replay draft does not match current journal authority.');
  if (currentDraftHash !== builtDraftHash) commitProofFailure('accepted replay draft does not match full-regeneration artifacts.');
  if (!canonicalTopologyHash || canonicalTopologyHash !== cleanText(run?.afterTopologyHash)) commitProofFailure('committed canonical hash does not match the autofix receipt.');
  if (!transactionId || !journalCommandId || !activeCommandIds.includes(journalCommandId)) commitProofFailure('autofix transaction is not active in the accepted command journal.');
  if (cleanText(snapshot.schema) !== 'TopologyEditSessionDraft.v2') commitProofFailure('accepted transaction has no persisted recovery snapshot.');
  if (!recoveryEnvelope || !recoveryCommandIds.includes(journalCommandId)) commitProofFailure('persisted recovery snapshot does not contain the autofix transaction envelope.');

  return Object.freeze({ schema: TOPOLOGY_AUTO_FIX_COMMIT_PROOF_SCHEMA,
    beforeAuthorityId, afterAuthorityId, authorityAdvanced: true,
    currentDraftHash, canonicalTopologyHash, transactionId, journalCommandId,
    activeCommandIds, recoverySnapshotSchema: cleanText(snapshot.schema),
    recoverySavedAt: cleanText(snapshot.savedAt), recoveryCommandIds });
}

export async function applyReviewedTopologyFixes(input) {
  const selected = input.selectedSuggestions;
  if (!Array.isArray(selected) || !selected.length) throw new Error('At least one topology fix suggestion is required.');
  if (!input.approvedOnly && selected.length !== 1) throw new Error('Reviewed fixes must be applied one suggestion at a time.');
  const candidate = input.approvedOnly ? input.core.applyApprovedTopologyFixes(input.draft, selected)
    : input.core.applyTopologyFixSuggestion(input.draft, selected[0]);
  if (candidate === input.draft) throw new Error('No approved topology fixes passed their deterministic preconditions.');
  const built = await input.core.buildEditedComponentTopologyArtifacts(input.sourceText, candidate, input.options);
  const commands = candidate.commands.slice(input.draft.commands.length);
  const state = acceptBatch(input, commands, built, candidate.topologyEditDraftHash,
    TOPOLOGY_COMMAND_AUTHORITY_MODE.MODEL_WIDE_REVIEWED_FIX,
    { selectedSuggestions: selected, approvedOnly: input.approvedOnly === true,
      approvalDisposition: input.approvedOnly ? 'AUTO_APPROVED' : 'USER_CONFIRMED' });
  return Object.freeze({ state, built });
}

export async function applySafeTopologyAutoFixes(input) {
  const plan = await planSafeTopologyAutoFixes(input);
  if (!plan.run.committed) return Object.freeze({ ...plan, state: null, built: null });
  const built = await input.core.buildEditedComponentTopologyArtifacts(input.sourceText, plan.candidateDraft, input.options);
  if (topologyGeometryHash(built.canonicalTopology) !== plan.geometryHash) throw new Error('Full Auto fix regeneration differs from safe preflight topology.');
  const commands = plan.candidateDraft.commands.slice(input.draft.commands.length);
  const beforeAuthority = input.journalService.currentAuthority();
  const state = acceptBatch(input, commands, built, plan.candidateDraft.topologyEditDraftHash,
    TOPOLOGY_COMMAND_AUTHORITY_MODE.MODEL_WIDE_SAFE_AUTOFIX, { plan });
  const committedRun = Object.freeze({ ...plan.run, afterTopologyHash: built.canonicalTopology.canonicalTopologyHash });
  const commitProof = buildAutoFixCommitProof(input, beforeAuthority, state, built, committedRun);
  const run = Object.freeze({ ...committedRun, commitProof });
  return Object.freeze({ ...plan, run, state, built });
}

export const _test = Object.freeze({ acceptBatch, buildAutoFixCommitProof, countCommands: (value) => asArray(value).length });
