/** Exact current-decision binding for supervised Draft Edit boundary classification. */
import { immutableJson, requiredContractText } from '../../../contracts/contract-values.js';
import { assertSequentialScopedEditReadModel } from './sequential-scoped-edit-read-model.js';
import { assertSequentialScopedEditSceneAncestry } from './sequential-scoped-edit-scene-adapter.js';
import { deriveSequentialEditAuthority } from './sequential-edit-authority.js';
import {
  sameSequentialContractValue,
  sequentialSemanticFingerprint,
} from './sequential-command-contracts.js';

export const SEQUENTIAL_DRAFT_EDIT_DECISION_TARGET_SCHEMA =
  'SequentialDraftEditDecisionTarget.v1';

export const SEQUENTIAL_DRAFT_EDIT_BOUNDARY_REASONS = Object.freeze([
  'HEAD_REFERENCE_CANDIDATES_REJECTED',
  'REFERENCE_TARGET_MISSING',
  'REFERENCE_TARGET_PORT_UNRESOLVED',
  'UNEXPLAINED_TERMINAL',
  'UNRESOLVED_PENDING_BRANCH',
]);

export const SEQUENTIAL_DRAFT_EDIT_DECISION_REJECTION = Object.freeze({
  AUTHORITY_STALE: 'DRAFT_EDIT_DECISION_AUTHORITY_STALE',
  BRANCH_MISMATCH: 'DRAFT_EDIT_DECISION_BRANCH_MISMATCH',
  DECISION_MISSING: 'DRAFT_EDIT_DECISION_MISSING',
  DECISION_DEFERRED: 'DRAFT_EDIT_DECISION_DEFERRED',
  CANDIDATES_PRESENT: 'DRAFT_EDIT_DECISION_CANDIDATES_PRESENT',
  REASON_UNSUPPORTED: 'DRAFT_EDIT_DECISION_REASON_UNSUPPORTED',
});

function fail(code, message) {
  const error = new RangeError(message);
  error.code = code;
  throw error;
}

function optionalText(value) {
  const result = String(value || '').trim();
  return result || null;
}

function authorityAgreement(readModel, state) {
  const authority = deriveSequentialEditAuthority(state);
  if (readModel.branchId !== authority.branchId
    || readModel.sessionFingerprint !== authority.sessionFingerprint) {
    fail(
      readModel.branchId === authority.branchId
        ? SEQUENTIAL_DRAFT_EDIT_DECISION_REJECTION.AUTHORITY_STALE
        : SEQUENTIAL_DRAFT_EDIT_DECISION_REJECTION.BRANCH_MISMATCH,
      'Draft Edit scene authority does not match current decision authority.',
    );
  }
  return authority;
}

function currentBoundaryDecision(state) {
  const session = state?.session;
  const request = session?.currentDecisionRequest;
  if (session?.state !== 'USER_DECISION_REQUIRED' || !request) {
    fail(
      SEQUENTIAL_DRAFT_EDIT_DECISION_REJECTION.DECISION_MISSING,
      'Sequential authority has no exact current decision for boundary classification.',
    );
  }
  if (request.state === 'DEFERRED') {
    fail(
      SEQUENTIAL_DRAFT_EDIT_DECISION_REJECTION.DECISION_DEFERRED,
      `Decision ${request.decisionId || '(missing)'} is deferred.`,
    );
  }
  if ((request.candidates || []).length) {
    fail(
      SEQUENTIAL_DRAFT_EDIT_DECISION_REJECTION.CANDIDATES_PRESENT,
      `Decision ${request.decisionId || '(missing)'} still has current candidates.`,
    );
  }
  if (!SEQUENTIAL_DRAFT_EDIT_BOUNDARY_REASONS.includes(request.reason)) {
    fail(
      SEQUENTIAL_DRAFT_EDIT_DECISION_REJECTION.REASON_UNSUPPORTED,
      `Decision reason ${request.reason || '(missing)'} is not boundary-classifiable.`,
    );
  }
  return request;
}

function buildTarget(input = {}) {
  const readModel = assertSequentialScopedEditReadModel(input.readModel);
  assertSequentialScopedEditSceneAncestry(input.scene, readModel);
  const authority = authorityAgreement(readModel, input.currentState);
  const request = currentBoundaryDecision(input.currentState);
  const material = {
    schema: SEQUENTIAL_DRAFT_EDIT_DECISION_TARGET_SCHEMA,
    authorityId: authority.authorityId,
    readAuthorityId: readModel.authorityId,
    branchId: authority.branchId,
    decisionId: requiredContractText(request.decisionId, 'boundary decisionId'),
    decisionScope: optionalText(request.decisionScope),
    reason: requiredContractText(request.reason, 'boundary decision reason'),
    activePortId: optionalText(request.activePortId),
    junctionId: optionalText(request.junctionId),
    referenceTarget: optionalText(request.referenceTarget),
  };
  return immutableJson({
    ...material,
    decisionTargetId: sequentialSemanticFingerprint('SSK3DDECISION', material),
  }, 'Sequential Draft Edit decision target');
}

export function createSequentialDraftEditDecisionTarget(input = {}) {
  return buildTarget(input);
}

export function validateSequentialDraftEditDecisionTarget(target, input = {}) {
  if (target?.schema !== SEQUENTIAL_DRAFT_EDIT_DECISION_TARGET_SCHEMA) {
    fail(
      SEQUENTIAL_DRAFT_EDIT_DECISION_REJECTION.DECISION_MISSING,
      `Draft Edit decision target must use ${SEQUENTIAL_DRAFT_EDIT_DECISION_TARGET_SCHEMA}.`,
    );
  }
  const rebuilt = buildTarget(input);
  if (!sameSequentialContractValue(rebuilt, target)) {
    fail(
      SEQUENTIAL_DRAFT_EDIT_DECISION_REJECTION.AUTHORITY_STALE,
      'Draft Edit boundary decision target is stale against current authority.',
    );
  }
  return rebuilt;
}
