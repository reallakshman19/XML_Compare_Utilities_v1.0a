/** Exact scene-entity to current Sequential candidate binding; no positional inference. */
import { immutableJson, requiredContractText } from '../../../contracts/contract-values.js';
import { assertSequentialScopedEditReadModel } from './sequential-scoped-edit-read-model.js';
import { assertSequentialScopedEditSceneAncestry } from './sequential-scoped-edit-scene-adapter.js';
import {
  deriveSequentialEditAuthority,
} from './sequential-edit-authority.js';
import {
  sameSequentialContractValue,
  sequentialSemanticFingerprint,
} from './sequential-command-contracts.js';

export const SEQUENTIAL_DRAFT_EDIT_CANDIDATE_TARGET_SCHEMA =
  'SequentialDraftEditCandidateTarget.v1';

export const SEQUENTIAL_DRAFT_EDIT_TARGET_REJECTION = Object.freeze({
  OBJECT_REQUIRED: 'DRAFT_EDIT_TARGET_OBJECT_REQUIRED',
  ENTITY_MISSING: 'DRAFT_EDIT_TARGET_ENTITY_MISSING',
  ENTITY_NOT_CANDIDATE: 'DRAFT_EDIT_TARGET_ENTITY_NOT_CANDIDATE',
  AUTHORITY_STALE: 'DRAFT_EDIT_TARGET_AUTHORITY_STALE',
  BRANCH_MISMATCH: 'DRAFT_EDIT_TARGET_BRANCH_MISMATCH',
  DECISION_MISSING: 'DRAFT_EDIT_TARGET_DECISION_MISSING',
  CANDIDATE_MISMATCH: 'DRAFT_EDIT_TARGET_CANDIDATE_MISMATCH',
});

function fail(code, message) {
  const error = new RangeError(message);
  error.code = code;
  throw error;
}

function requiredObjectId(value) {
  const result = String(value || '').trim();
  if (!result) fail(
    SEQUENTIAL_DRAFT_EDIT_TARGET_REJECTION.OBJECT_REQUIRED,
    'Draft Edit candidate selection requires an exact scene object ID.',
  );
  return result;
}

function currentDecision(state) {
  const request = state?.session?.currentDecisionRequest;
  if (state?.session?.state !== 'USER_DECISION_REQUIRED' || !request) {
    fail(
      SEQUENTIAL_DRAFT_EDIT_TARGET_REJECTION.DECISION_MISSING,
      'Sequential authority has no exact current decision for candidate targeting.',
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
        ? SEQUENTIAL_DRAFT_EDIT_TARGET_REJECTION.AUTHORITY_STALE
        : SEQUENTIAL_DRAFT_EDIT_TARGET_REJECTION.BRANCH_MISMATCH,
      'Draft Edit scene authority does not match current command authority.',
    );
  }
  return authority;
}

function exactCandidateEntity(scene, objectId) {
  const entity = scene.entities.find((row) => row.id === objectId);
  if (!entity) fail(
    SEQUENTIAL_DRAFT_EDIT_TARGET_REJECTION.ENTITY_MISSING,
    `Scene entity ${objectId} is not part of the certified Draft Edit scene.`,
  );
  const candidateId = String(entity.domainRef?.candidateId || '').trim();
  if (entity.domainRef?.category !== 'candidate' || !candidateId) fail(
    SEQUENTIAL_DRAFT_EDIT_TARGET_REJECTION.ENTITY_NOT_CANDIDATE,
    `Scene entity ${objectId} is not a current candidate target.`,
  );
  return Object.freeze({ entity, candidateId });
}

function buildTarget(input = {}) {
  const readModel = assertSequentialScopedEditReadModel(input.readModel);
  const scene = assertSequentialScopedEditSceneAncestry(input.scene, readModel);
  const authority = authorityAgreement(readModel, input.currentState);
  const request = currentDecision(input.currentState);
  const objectId = requiredObjectId(input.objectId);
  const resolved = exactCandidateEntity(scene, objectId);
  const candidate = (request.candidates || []).find(
    (row) => row.candidateId === resolved.candidateId,
  );
  if (!candidate) fail(
    SEQUENTIAL_DRAFT_EDIT_TARGET_REJECTION.CANDIDATE_MISMATCH,
    `Candidate ${resolved.candidateId} is not part of decision ${request.decisionId}.`,
  );
  const material = {
    schema: SEQUENTIAL_DRAFT_EDIT_CANDIDATE_TARGET_SCHEMA,
    authorityId: authority.authorityId,
    readAuthorityId: readModel.authorityId,
    branchId: authority.branchId,
    decisionId: requiredContractText(request.decisionId, 'candidate decisionId'),
    candidateId: requiredContractText(candidate.candidateId, 'candidateId'),
    entityId: objectId,
  };
  return immutableJson({
    ...material,
    targetSelectionId: sequentialSemanticFingerprint('SSK3DTARGET', material),
  }, 'Sequential Draft Edit candidate target');
}

export function selectSequentialDraftEditCandidateTarget(input = {}) {
  return buildTarget(input);
}

export function validateSequentialDraftEditCandidateTarget(target, input = {}) {
  if (target?.schema !== SEQUENTIAL_DRAFT_EDIT_CANDIDATE_TARGET_SCHEMA) fail(
    SEQUENTIAL_DRAFT_EDIT_TARGET_REJECTION.CANDIDATE_MISMATCH,
    `Draft Edit target must use ${SEQUENTIAL_DRAFT_EDIT_CANDIDATE_TARGET_SCHEMA}.`,
  );
  const rebuilt = buildTarget({ ...input, objectId: target.entityId });
  if (!sameSequentialContractValue(rebuilt, target)) fail(
    SEQUENTIAL_DRAFT_EDIT_TARGET_REJECTION.AUTHORITY_STALE,
    'Draft Edit candidate target is stale against current authority.',
  );
  return rebuilt;
}
