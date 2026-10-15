/** Immutable contracts for Sequential accepted-command authority. */
import { immutableJson, requiredContractText } from '../../../contracts/contract-values.js';

export const SEQUENTIAL_EDIT_AUTHORITY_BASIS_SCHEMA = 'SequentialEditAuthorityBasis.v1';
export const SEQUENTIAL_NATIVE_COMMAND_SCHEMA = 'SequentialNativeCommand.v1';
export const SEQUENTIAL_PREPARED_COMMAND_SCHEMA = 'SequentialPreparedCommand.v1';
export const SEQUENTIAL_COMMAND_ACCEPTANCE_SCHEMA = 'SequentialCommandAcceptance.v1';
export const SEQUENTIAL_COMMAND_TARGET_EVIDENCE_SCHEMA = 'SequentialCommandTargetEvidence.v1';
export const SEQUENTIAL_COMMAND_SCOPE_SCHEMA = 'SequentialCommandScope.v1';
export const SEQUENTIAL_COMMAND_JOURNAL_STATE_SCHEMA = 'SequentialCommandJournalState.v1';
export const SEQUENTIAL_JOURNAL_ADOPTION_CHECKPOINT_SCHEMA = 'SequentialJournalAdoptionCheckpoint.v1';
export const SEQUENTIAL_SEMANTIC_HASH_PROFILE = 'fnv1a32-canonical-json-v1';

export const SEQUENTIAL_NATIVE_COMMAND_TYPES = Object.freeze([
  'ADVANCE_ONE',
  'RUN_UNTIL_BLOCKED',
  'CONNECT_CANDIDATE',
  'MANUAL_CONNECT',
  'REJECT_CANDIDATE',
  'MARK_TERMINAL',
  'MARK_EXTERNAL_BOUNDARY',
  'REVERSE_COMPONENT',
  'DEFER_DECISION',
  'RESUME_DECISION',
  'UNDO_LAST_TRANSACTION',
  'REDO_LAST_TRANSACTION',
]);

export const SEQUENTIAL_PREPARATION_ENABLED_COMMAND_TYPES = Object.freeze([
  'ADVANCE_ONE',
  'RUN_UNTIL_BLOCKED',
  'CONNECT_CANDIDATE',
  'MANUAL_CONNECT',
  'REJECT_CANDIDATE',
  'MARK_TERMINAL',
  'MARK_EXTERNAL_BOUNDARY',
  'REVERSE_COMPONENT',
  'DEFER_DECISION',
  'RESUME_DECISION',
  'UNDO_LAST_TRANSACTION',
  'REDO_LAST_TRANSACTION',
]);

export const SEQUENTIAL_COMMAND_REJECTION = Object.freeze({
  COMMAND_SCHEMA_INVALID: 'COMMAND_SCHEMA_INVALID',
  COMMAND_AUTHORITY_MISMATCH: 'COMMAND_AUTHORITY_MISMATCH',
  COMMAND_RUNTIME_NOT_DETERMINISTIC: 'COMMAND_RUNTIME_NOT_DETERMINISTIC',
  COMMAND_BRANCH_MISMATCH: 'COMMAND_BRANCH_MISMATCH',
  COMMAND_TARGET_MISSING: 'COMMAND_TARGET_MISSING',
  CURRENT_DECISION_MISMATCH: 'CURRENT_DECISION_MISMATCH',
  CURRENT_CANDIDATE_MISMATCH: 'CURRENT_CANDIDATE_MISMATCH',
  CURRENT_COMPONENT_MISMATCH: 'CURRENT_COMPONENT_MISMATCH',
  CURRENT_CONNECTION_MISMATCH: 'CURRENT_CONNECTION_MISMATCH',
  CURRENT_PORT_MISMATCH: 'CURRENT_PORT_MISMATCH',
  JOURNAL_NOT_ADOPTED: 'JOURNAL_NOT_ADOPTED',
  LEGACY_HISTORY_INVALID: 'LEGACY_HISTORY_INVALID',
  PREPARED_COMMAND_INVALID: 'PREPARED_COMMAND_INVALID',
  PREPARED_COMMAND_STALE: 'PREPARED_COMMAND_STALE',
  COMPLETE_RESULT_MISMATCH: 'COMPLETE_RESULT_MISMATCH',
  TRANSACTION_MAPPING_INVALID: 'TRANSACTION_MAPPING_INVALID',
  PUBLICATION_FAILED: 'PUBLICATION_FAILED',
});

function text(value) { return String(value ?? '').trim(); }
function optionalText(value) { const result = text(value); return result || null; }
function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
}
function fnv1a32(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function sequentialCanonicalStringify(value) {
  const validated = immutableJson(value, 'Sequential canonical value');
  return JSON.stringify(canonicalValue(validated));
}

export function sequentialSemanticFingerprint(prefix, value) {
  const domain = requiredContractText(prefix, 'fingerprint prefix');
  const digest = fnv1a32(`${SEQUENTIAL_SEMANTIC_HASH_PROFILE}|${domain}|${sequentialCanonicalStringify(value)}`);
  return `${SEQUENTIAL_SEMANTIC_HASH_PROFILE}:${domain}:${digest}`;
}

export function sameSequentialContractValue(left, right) {
  return sequentialCanonicalStringify(left) === sequentialCanonicalStringify(right);
}

function commandType(value) {
  const result = requiredContractText(value, 'Sequential commandType').toUpperCase();
  if (!SEQUENTIAL_NATIVE_COMMAND_TYPES.includes(result)) {
    throw sequentialCommandCodedError(
      SEQUENTIAL_COMMAND_REJECTION.COMMAND_SCHEMA_INVALID,
      `Unsupported Sequential command type: ${result}`,
      TypeError,
    );
  }
  return result;
}

export function createSequentialNativeCommand(input = {}) {
  const material = {
    schema: SEQUENTIAL_NATIVE_COMMAND_SCHEMA,
    commandType: commandType(input.commandType),
    branchId: requiredContractText(input.branchId, 'Sequential command branchId'),
    decisionId: optionalText(input.decisionId),
    candidateId: optionalText(input.candidateId),
    componentId: optionalText(input.componentId),
    connectionId: optionalText(input.connectionId),
    fromPortId: optionalText(input.fromPortId),
    toPortId: optionalText(input.toPortId),
    entryPortId: optionalText(input.entryPortId),
    payload: immutableJson(input.payload || {}, 'Sequential command payload'),
  };
  return immutableJson({
    ...material,
    nativeCommandId: sequentialSemanticFingerprint('SNATIVE', material),
  }, 'Sequential native command');
}

export function createSequentialEditAuthorityBasis(input = {}) {
  const material = {
    schema: SEQUENTIAL_EDIT_AUTHORITY_BASIS_SCHEMA,
    sourceFingerprint: requiredContractText(input.sourceFingerprint, 'authority sourceFingerprint'),
    branchId: requiredContractText(input.branchId, 'authority branchId'),
    branchSetFingerprint: requiredContractText(input.branchSetFingerprint, 'authority branchSetFingerprint'),
    sessionFingerprint: requiredContractText(input.sessionFingerprint, 'authority sessionFingerprint'),
    completeSessionFingerprint: requiredContractText(input.completeSessionFingerprint, 'authority completeSessionFingerprint'),
    journalHeadFingerprint: requiredContractText(input.journalHeadFingerprint, 'authority journalHeadFingerprint'),
    transactionHeadId: optionalText(input.transactionHeadId),
    undoHeadTransactionId: optionalText(input.undoHeadTransactionId),
    redoHeadTransactionId: optionalText(input.redoHeadTransactionId),
    confirmedConstructionFingerprint: optionalText(input.confirmedConstructionFingerprint),
    supportProjectionFingerprint: optionalText(input.supportProjectionFingerprint),
    ownerRevisionFingerprint: requiredContractText(input.ownerRevisionFingerprint, 'authority ownerRevisionFingerprint'),
    currentDecisionId: optionalText(input.currentDecisionId),
  };
  return immutableJson({
    ...material,
    authorityId: sequentialSemanticFingerprint('SAUTH', material),
  }, 'Sequential edit authority basis');
}

export function createSequentialCommandTargetEvidence(input = {}) {
  const material = {
    schema: SEQUENTIAL_COMMAND_TARGET_EVIDENCE_SCHEMA,
    commandType: commandType(input.commandType),
    branchId: requiredContractText(input.branchId, 'target branchId'),
    decisionId: optionalText(input.decisionId),
    candidateId: optionalText(input.candidateId),
    componentId: optionalText(input.componentId),
    connectionId: optionalText(input.connectionId),
    fromPortId: optionalText(input.fromPortId),
    toPortId: optionalText(input.toPortId),
    entryPortId: optionalText(input.entryPortId),
  };
  return immutableJson({ ...material, targetEvidenceId: sequentialSemanticFingerprint('STARGET', material) }, 'Sequential target evidence');
}

export function createSequentialCommandScope(input = {}) {
  const allowed = [...new Set((input.allowedCommandTypes || []).map(commandType))].sort();
  const material = {
    schema: SEQUENTIAL_COMMAND_SCOPE_SCHEMA,
    branchId: requiredContractText(input.branchId, 'scope branchId'),
    authorityId: requiredContractText(input.authorityId, 'scope authorityId'),
    allowedCommandTypes: allowed,
    currentDecisionId: optionalText(input.currentDecisionId),
  };
  return immutableJson({ ...material, scopeId: sequentialSemanticFingerprint('SSCOPE', material) }, 'Sequential command scope');
}

export function createSequentialPreparedCommand(input = {}) {
  const material = {
    schema: SEQUENTIAL_PREPARED_COMMAND_SCHEMA,
    envelope: input.envelope,
    nativeCommand: input.nativeCommand,
    expectedAuthority: input.expectedAuthority,
    scope: input.scope,
    targets: input.targets,
    candidate: input.candidate,
  };
  return immutableJson({
    ...material,
    preparedId: sequentialSemanticFingerprint('SPREP', material),
  }, 'Sequential prepared command');
}

export function createSequentialCommandAcceptance(input = {}) {
  const accepted = input.accepted === true;
  return immutableJson({
    schema: SEQUENTIAL_COMMAND_ACCEPTANCE_SCHEMA,
    accepted,
    reasonCode: accepted ? null : requiredContractText(input.reasonCode, 'acceptance reasonCode'),
    message: requiredContractText(input.message, 'acceptance message'),
    expectedAuthorityId: requiredContractText(input.expectedAuthorityId, 'expectedAuthorityId'),
    currentAuthorityId: requiredContractText(input.currentAuthorityId, 'currentAuthorityId'),
    preparedId: requiredContractText(input.preparedId, 'preparedId'),
    publicationState: accepted ? 'COMMITTED' : optionalText(input.publicationState) || 'NOT_PUBLISHED',
    containmentRequired: accepted ? false : input.containmentRequired === true,
    publication: input.publication ? immutableJson(input.publication, 'Sequential publication evidence') : null,
  }, 'Sequential command acceptance');
}

export function sequentialCommandCodedError(code, message, Constructor = Error) {
  const error = new Constructor(message);
  error.code = code;
  return error;
}
