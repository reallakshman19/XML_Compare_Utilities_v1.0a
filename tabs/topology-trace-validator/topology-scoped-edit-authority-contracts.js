/** Immutable contracts for Topology edit authority and atomic acceptance evidence. */
import { immutableJson, requiredContractText } from '../../contracts/contract-values.js';
import { semanticHash } from './topology-validator-values.js';

export const TOPOLOGY_SCOPED_EDIT_AUTHORITY_BASIS_V1 = 'TopologyScopedEditAuthorityBasis.v1';
export const TOPOLOGY_SCOPED_EDIT_COMMAND_TARGETS_V1 = 'TopologyScopedEditCommandTargets.v1';
export const TOPOLOGY_SCOPED_EDIT_COMMAND_SCOPE_V1 = 'TopologyScopedEditCommandScope.v1';
export const TOPOLOGY_SCOPED_EDIT_AUTHORIZATION_V1 = 'TopologyScopedEditAuthorization.v1';
export const TOPOLOGY_SCOPED_EDIT_MODEL_WIDE_GRANT_V1 = 'TopologyScopedEditModelWideGrant.v1';
export const TOPOLOGY_SCOPED_EDIT_PREPARED_ACCEPTANCE_V1 = 'TopologyScopedEditPreparedAcceptance.v1';
export const TOPOLOGY_SCOPED_EDIT_REGENERATION_EVIDENCE_V1 = 'TopologyScopedEditRegenerationEvidence.v1';
export const TOPOLOGY_SCOPED_EDIT_ACCEPTANCE_V1 = 'TopologyScopedEditAcceptance.v1';
export const TOPOLOGY_SCOPED_EDIT_CONFORMANCE_V1 = 'TopologyScopedEditConformance.v1';

export const TOPOLOGY_SCOPED_EDIT_REJECTION = Object.freeze({
  UNSUPPORTED_COMMAND_TARGET_RESOLVER: 'UNSUPPORTED_COMMAND_TARGET_RESOLVER',
  EMPTY_COMMAND_TARGET_SET: 'EMPTY_COMMAND_TARGET_SET',
  COMMAND_AUTHORITY_MISMATCH: 'COMMAND_AUTHORITY_MISMATCH',
  BOUNDARY_TARGET_NOT_EDITABLE: 'BOUNDARY_TARGET_NOT_EDITABLE',
  EXCLUDED_TARGET_NOT_EDITABLE: 'EXCLUDED_TARGET_NOT_EDITABLE',
  SOURCE_BRANCH_OUTSIDE_SCOPE: 'SOURCE_BRANCH_OUTSIDE_SCOPE',
  INVALID_MODEL_WIDE_AUTHORITY: 'INVALID_MODEL_WIDE_AUTHORITY',
  MODEL_WIDE_AUTHORITY_PROVENANCE_INVALID: 'MODEL_WIDE_AUTHORITY_PROVENANCE_INVALID',
  CANDIDATE_DRAFT_HASH_MISMATCH: 'CANDIDATE_DRAFT_HASH_MISMATCH',
  REGENERATION_EVIDENCE_INVALID: 'REGENERATION_EVIDENCE_INVALID',
  STALE_TOPOLOGY_EDIT_AUTHORITY: 'STALE_TOPOLOGY_EDIT_AUTHORITY',
  RECOVERY_HEAD_MISMATCH: 'RECOVERY_HEAD_MISMATCH',
  RECOVERY_PERSISTENCE_FAILED: 'RECOVERY_PERSISTENCE_FAILED',
  TOPOLOGY_EDIT_WRITER_UNAVAILABLE: 'TOPOLOGY_EDIT_WRITER_UNAVAILABLE',
  PREPARED_ACCEPTANCE_INVALID: 'PREPARED_ACCEPTANCE_INVALID',
  JOURNAL_REPLAY_FAILED: 'JOURNAL_REPLAY_FAILED',
  SESSION_DRAFT_INVALID: 'SESSION_DRAFT_INVALID',
  TOPOLOGY_EDIT_SERVICE_DESTROYED: 'TOPOLOGY_EDIT_SERVICE_DESTROYED',
});

function sortedTexts(values, label, allowEmpty = true) {
  if (!Array.isArray(values)) throw new TypeError(`${label} must be an array.`);
  const output = values.map((value, index) => requiredContractText(value, `${label}[${index}]`));
  if (!allowEmpty && output.length === 0) throw new TypeError(`${label} must not be empty.`);
  return Object.freeze([...new Set(output)].sort());
}
function sortedIndexes(values, label) {
  if (!Array.isArray(values)) throw new TypeError(`${label} must be an array.`);
  const output = values.map(Number);
  if (output.some((value) => !Number.isSafeInteger(value) || value < 0)) throw new TypeError(`${label} must contain non-negative integers.`);
  return Object.freeze([...new Set(output)].sort((left, right) => left - right));
}

export function createTopologyScopedEditAuthorityBasis(input = {}) {
  const material = {
    schema: TOPOLOGY_SCOPED_EDIT_AUTHORITY_BASIS_V1,
    documentId: requiredContractText(input.documentId, 'authority documentId'),
    sourceHash: requiredContractText(input.sourceHash, 'authority sourceHash'),
    baseCanonicalTopologyHash: requiredContractText(input.baseCanonicalTopologyHash, 'baseCanonicalTopologyHash'),
    currentDraftHash: requiredContractText(input.currentDraftHash, 'currentDraftHash'),
    journalHash: requiredContractText(input.journalHash, 'journalHash'),
    replayHash: requiredContractText(input.replayHash, 'replayHash'),
    activeCommandIds: sortedTexts(input.activeCommandIds, 'activeCommandIds'),
    redoCommandIds: sortedTexts(input.redoCommandIds, 'redoCommandIds'),
  };
  return immutableJson({ ...material, authorityId: `TAUTH-${semanticHash(material).split(':')[1]}` }, 'Topology scoped-edit authority basis');
}

export function createTopologyScopedEditCommandTargets(input = {}) {
  const entityIds = sortedTexts(input.entityIds, 'target entityIds');
  const sourcePaths = sortedTexts(input.sourcePaths, 'target sourcePaths');
  const sourceBranchIndexes = sortedIndexes(input.sourceBranchIndexes, 'target sourceBranchIndexes');
  if (!entityIds.length && !sourcePaths.length) throw topologyScopedEditCodedError(
    TOPOLOGY_SCOPED_EDIT_REJECTION.EMPTY_COMMAND_TARGET_SET,
    'Mutating command resolved no target entities or source paths.', TypeError);
  return immutableJson({ schema: TOPOLOGY_SCOPED_EDIT_COMMAND_TARGETS_V1,
    commandKind: requiredContractText(input.commandKind, 'commandKind'),
    commandType: requiredContractText(input.commandType, 'commandType').toUpperCase(),
    entityIds, sourcePaths, sourceBranchIndexes,
    childTargets: Array.isArray(input.childTargets) ? input.childTargets : [],
  }, 'Topology scoped-edit command targets');
}

export function createTopologyScopedEditModelWideGrant(input = {}) {
  const material = {
    schema: TOPOLOGY_SCOPED_EDIT_MODEL_WIDE_GRANT_V1,
    authorityMode: requiredContractText(input.authorityMode, 'grant authorityMode'),
    sourceAuthorityId: requiredContractText(input.sourceAuthorityId, 'grant sourceAuthorityId'),
    originKind: requiredContractText(input.originKind, 'grant originKind').toUpperCase(),
    evidenceKind: requiredContractText(input.evidenceKind, 'grant evidenceKind'),
    evidenceId: requiredContractText(input.evidenceId, 'grant evidenceId'),
    evidenceHash: requiredContractText(input.evidenceHash, 'grant evidenceHash'),
    commandIdentityHash: requiredContractText(input.commandIdentityHash, 'grant commandIdentityHash'),
    targetHash: requiredContractText(input.targetHash, 'grant targetHash'),
    nativeCommandIds: sortedTexts(input.nativeCommandIds, 'grant nativeCommandIds', false),
  };
  return immutableJson({ ...material, grantId: `TGRANT-${semanticHash(material).split(':')[1]}` }, 'Topology model-wide authority grant');
}

export function createTopologyScopedEditPreparedAcceptance(input = {}) {
  return immutableJson({ schema: TOPOLOGY_SCOPED_EDIT_PREPARED_ACCEPTANCE_V1,
    preparedId: requiredContractText(input.preparedId, 'preparedId'),
    operation: requiredContractText(input.operation, 'prepared operation'),
    expectedAuthorityId: requiredContractText(input.expectedAuthorityId, 'expectedAuthorityId'),
    expectedDraftHash: requiredContractText(input.expectedDraftHash, 'expectedDraftHash'),
    commandIdentityHash: requiredContractText(input.commandIdentityHash, 'commandIdentityHash'),
    request: input.request, authorization: input.authorization ?? null,
    candidateJournal: input.candidateJournal, candidateReplayState: input.candidateReplayState,
    candidateSnapshot: input.candidateSnapshot, nextAuthority: input.nextAuthority,
  }, 'Topology scoped-edit prepared acceptance');
}

export function createTopologyScopedEditRegenerationEvidence(input = {}) {
  const material = {
    schema: TOPOLOGY_SCOPED_EDIT_REGENERATION_EVIDENCE_V1,
    preparedId: requiredContractText(input.preparedId, 'regeneration preparedId'),
    candidateDraftHash: requiredContractText(input.candidateDraftHash, 'regeneration candidateDraftHash'),
    canonicalTopologyHash: requiredContractText(input.canonicalTopologyHash, 'regeneration canonicalTopologyHash'),
    artifactsHash: requiredContractText(input.artifactsHash, 'regeneration artifactsHash'),
  };
  return immutableJson({ ...material, evidenceId: `TREGEN-${semanticHash(material).split(':')[1]}` }, 'Topology regeneration evidence');
}

export function createTopologyScopedEditAcceptance(input = {}) {
  const accepted = input.accepted === true;
  return immutableJson({ schema: TOPOLOGY_SCOPED_EDIT_ACCEPTANCE_V1, accepted,
    reasonCode: accepted ? null : requiredContractText(input.reasonCode, 'reasonCode'),
    message: requiredContractText(input.message, 'acceptance message'),
    currentAuthorityId: requiredContractText(input.currentAuthorityId, 'currentAuthorityId'),
    expectedAuthorityId: requiredContractText(input.expectedAuthorityId, 'expectedAuthorityId'),
    authority: accepted ? input.authority : null, state: accepted ? input.state : null,
    snapshot: accepted ? input.snapshot : null,
  }, 'Topology scoped-edit acceptance evidence');
}

export function topologyScopedEditCodedError(code, message, Constructor = Error) {
  const error = new Constructor(message); error.code = code; return error;
}
