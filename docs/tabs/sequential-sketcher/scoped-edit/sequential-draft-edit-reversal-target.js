/** Exact certified reversal selection; no command preparation or positional inference. */
import { immutableJson, requiredContractText } from '../../../contracts/contract-values.js';
import { projectSequentialReversalCandidates } from '../sequential-engineering-svg-reversal-scene.js';
import { assertSequentialScopedEditReadModel } from './sequential-scoped-edit-read-model.js';
import { assertSequentialScopedEditSceneAncestry } from './sequential-scoped-edit-scene-adapter.js';
import { deriveSequentialEditAuthority } from './sequential-edit-authority.js';
import {
  sameSequentialContractValue,
  sequentialSemanticFingerprint,
} from './sequential-command-contracts.js';

export const SEQUENTIAL_DRAFT_EDIT_REVERSAL_TARGET_SCHEMA =
  'SequentialDraftEditReversalTarget.v1';

export const SEQUENTIAL_DRAFT_EDIT_REVERSAL_REJECTION = Object.freeze({
  OBJECT_REQUIRED: 'DRAFT_EDIT_REVERSAL_OBJECT_REQUIRED',
  ENTITY_MISSING: 'DRAFT_EDIT_REVERSAL_ENTITY_MISSING',
  ENTITY_NOT_REVERSAL: 'DRAFT_EDIT_ENTITY_NOT_REVERSAL_CANDIDATE',
  AUTHORITY_STALE: 'DRAFT_EDIT_REVERSAL_AUTHORITY_STALE',
  BRANCH_MISMATCH: 'DRAFT_EDIT_REVERSAL_BRANCH_MISMATCH',
  DECISION_MISSING: 'DRAFT_EDIT_REVERSAL_DECISION_MISSING',
  CANDIDATE_MISMATCH: 'DRAFT_EDIT_REVERSAL_CANDIDATE_MISMATCH',
  COMPONENT_MISMATCH: 'DRAFT_EDIT_REVERSAL_COMPONENT_MISMATCH',
  ENTRY_PORT_MISMATCH: 'DRAFT_EDIT_REVERSAL_ENTRY_PORT_MISMATCH',
});

function fail(code, message) {
  const error = new RangeError(message);
  error.code = code;
  throw error;
}
function text(value) { return String(value || '').trim(); }
function requiredObjectId(value) {
  const result = text(value);
  if (!result) fail(
    SEQUENTIAL_DRAFT_EDIT_REVERSAL_REJECTION.OBJECT_REQUIRED,
    'Draft Edit reversal selection requires an exact scene object ID.',
  );
  return result;
}
function currentDecision(state) {
  const request = state?.session?.currentDecisionRequest;
  if (state?.session?.state !== 'USER_DECISION_REQUIRED' || !request || request.state === 'DEFERRED') {
    fail(
      SEQUENTIAL_DRAFT_EDIT_REVERSAL_REJECTION.DECISION_MISSING,
      'Sequential authority has no exact open current decision for reversal targeting.',
    );
  }
  return request;
}
function authorityAgreement(readModel, state) {
  const authority = deriveSequentialEditAuthority(state);
  if (readModel.branchId !== authority.branchId
    || readModel.sessionFingerprint !== authority.sessionFingerprint) {
    fail(
      readModel.branchId === authority.branchId
        ? SEQUENTIAL_DRAFT_EDIT_REVERSAL_REJECTION.AUTHORITY_STALE
        : SEQUENTIAL_DRAFT_EDIT_REVERSAL_REJECTION.BRANCH_MISMATCH,
      'Draft Edit scene authority does not match current reversal authority.',
    );
  }
  return authority;
}
function exactEntity(scene, objectId) {
  const entity = scene.entities.find((row) => row.id === objectId);
  if (!entity) fail(
    SEQUENTIAL_DRAFT_EDIT_REVERSAL_REJECTION.ENTITY_MISSING,
    `Scene entity ${objectId} is not part of the certified Draft Edit scene.`,
  );
  const ref = entity.domainRef || {};
  if (entity.domainType !== 'SEQUENTIAL_REVERSAL_CANDIDATE'
    || ref.category !== 'reversalCandidate'
    || !text(ref.candidateId) || !text(ref.componentId) || !text(ref.entryPortId)) {
    fail(
      SEQUENTIAL_DRAFT_EDIT_REVERSAL_REJECTION.ENTITY_NOT_REVERSAL,
      `Scene entity ${objectId} is not a certified reversal candidate.`,
    );
  }
  return Object.freeze({
    entity,
    candidateId: text(ref.candidateId),
    componentId: text(ref.componentId),
    entryPortId: text(ref.entryPortId),
  });
}
function exactCandidate(state, resolved) {
  const indexes = state?.indexes;
  if (!(indexes?.components instanceof Map) || !(indexes?.ports instanceof Map)) {
    fail(
      SEQUENTIAL_DRAFT_EDIT_REVERSAL_REJECTION.AUTHORITY_STALE,
      'Current reversal authority does not expose indexed components and ports.',
    );
  }
  const entryPort = indexes.ports.get(resolved.entryPortId);
  if (!entryPort || entryPort.componentId !== resolved.componentId) {
    fail(
      SEQUENTIAL_DRAFT_EDIT_REVERSAL_REJECTION.ENTRY_PORT_MISMATCH,
      `Reversal entry port ${resolved.entryPortId} is not current evidence for ${resolved.componentId}.`,
    );
  }
  const candidate = projectSequentialReversalCandidates(state.session, indexes)
    .find((row) => row.candidateId === resolved.candidateId);
  if (!candidate || candidate.componentId !== resolved.componentId
    || candidate.entryPortId !== resolved.entryPortId) {
    fail(
      SEQUENTIAL_DRAFT_EDIT_REVERSAL_REJECTION.CANDIDATE_MISMATCH,
      `Reversal candidate ${resolved.candidateId} is not part of the exact current decision.`,
    );
  }
  const component = indexes.components.get(candidate.componentId);
  if (!component || (state.session.confirmedComponentIds || []).includes(candidate.componentId)) {
    fail(
      SEQUENTIAL_DRAFT_EDIT_REVERSAL_REJECTION.COMPONENT_MISMATCH,
      `Reversal component ${candidate.componentId} is not current unconfirmed evidence.`,
    );
  }
  if (!sameSequentialContractValue(candidate.sourcePosition, resolved.entity.geometry?.position)) {
    fail(
      SEQUENTIAL_DRAFT_EDIT_REVERSAL_REJECTION.AUTHORITY_STALE,
      'Reversal scene position differs from current indexed entry-port evidence.',
    );
  }
  return Object.freeze({ candidate, component, entryPort });
}
function buildTarget(input = {}) {
  const readModel = assertSequentialScopedEditReadModel(input.readModel);
  const scene = assertSequentialScopedEditSceneAncestry(input.scene, readModel);
  const authority = authorityAgreement(readModel, input.currentState);
  const request = currentDecision(input.currentState);
  const objectId = requiredObjectId(input.objectId);
  const resolved = exactEntity(scene, objectId);
  const current = exactCandidate(input.currentState, resolved);
  const material = {
    schema: SEQUENTIAL_DRAFT_EDIT_REVERSAL_TARGET_SCHEMA,
    authorityId: authority.authorityId,
    readAuthorityId: readModel.authorityId,
    branchId: authority.branchId,
    decisionId: requiredContractText(request.decisionId, 'reversal decisionId'),
    candidateId: requiredContractText(current.candidate.candidateId, 'reversal candidateId'),
    componentId: requiredContractText(current.component.componentId, 'reversal componentId'),
    entryPortId: requiredContractText(current.entryPort.portId, 'reversal entryPortId'),
    entityId: objectId,
    sourcePosition: current.candidate.sourcePosition,
  };
  return immutableJson({
    ...material,
    reversalTargetId: sequentialSemanticFingerprint('SSK3DREVERSAL', material),
  }, 'Sequential Draft Edit reversal target');
}

export function selectSequentialDraftEditReversalTarget(input = {}) {
  return buildTarget(input);
}

export function validateSequentialDraftEditReversalTarget(target, input = {}) {
  if (target?.schema !== SEQUENTIAL_DRAFT_EDIT_REVERSAL_TARGET_SCHEMA) fail(
    SEQUENTIAL_DRAFT_EDIT_REVERSAL_REJECTION.CANDIDATE_MISMATCH,
    `Draft Edit reversal target must use ${SEQUENTIAL_DRAFT_EDIT_REVERSAL_TARGET_SCHEMA}.`,
  );
  const rebuilt = buildTarget({ ...input, objectId: target.entityId });
  if (!sameSequentialContractValue(rebuilt, target)) fail(
    SEQUENTIAL_DRAFT_EDIT_REVERSAL_REJECTION.AUTHORITY_STALE,
    'Draft Edit reversal target is stale against current authority.',
  );
  return rebuilt;
}
