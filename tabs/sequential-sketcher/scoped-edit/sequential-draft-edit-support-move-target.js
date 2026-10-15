/** Exact confirmed-support target for non-publishing move drafts. */
import { immutableJson, requiredContractText } from '../../../contracts/contract-values.js';
import { createSequentialSupportAdjustmentRegister } from '../support/sequential-support-adjustment-register.js';
import {
  applySequentialSupportAdjustmentRegister,
  sequentialSupportProjectionFingerprint,
} from '../support/sequential-support-adjusted-projection.js';
import { assertSequentialScopedEditReadModel } from './sequential-scoped-edit-read-model.js';
import { assertSequentialScopedEditSceneAncestry } from './sequential-scoped-edit-scene-adapter.js';
import { deriveSequentialEditAuthority } from './sequential-edit-authority.js';
import {
  sameSequentialContractValue,
  sequentialSemanticFingerprint,
} from './sequential-command-contracts.js';

export const SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_TARGET_SCHEMA =
  'SequentialDraftEditSupportMoveTarget.v1';
export const SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_REJECTION = Object.freeze({
  OBJECT_REQUIRED: 'DRAFT_EDIT_SUPPORT_OBJECT_REQUIRED',
  ENTITY_MISSING: 'DRAFT_EDIT_SUPPORT_ENTITY_MISSING',
  ENTITY_NOT_SUPPORT: 'DRAFT_EDIT_ENTITY_NOT_CONFIRMED_SUPPORT',
  CAPABILITY_MISSING: 'DRAFT_EDIT_SUPPORT_MOVE_CAPABILITY_MISSING',
  AUTHORITY_STALE: 'DRAFT_EDIT_SUPPORT_AUTHORITY_STALE',
  BRANCH_MISMATCH: 'DRAFT_EDIT_SUPPORT_BRANCH_MISMATCH',
  SUPPORT_MISSING: 'DRAFT_EDIT_SUPPORT_EVIDENCE_MISSING',
  SUPPORT_MISMATCH: 'DRAFT_EDIT_SUPPORT_EVIDENCE_MISMATCH',
});

function fail(code, message) {
  const error = new RangeError(message); error.code = code; throw error;
}
function text(value) { return String(value ?? '').trim(); }
function requiredObjectId(value) {
  const result = text(value);
  if (!result) fail(SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_REJECTION.OBJECT_REQUIRED,
    'Draft Edit support selection requires an exact scene object ID.');
  return result;
}
function point(value) {
  if (!value || !['x', 'y', 'z'].every((axis) => Number.isFinite(value[axis]))) return null;
  return Object.freeze({ x: value.x, y: value.y, z: value.z });
}
function supportFamilies(projection) {
  return new Map((projection?.branchBundles || []).flatMap((bundle) => (
    bundle.resolvedSupportFamilies || []
  )).map((family) => [family.familyId, family]));
}
function normalizedSupportAuthority(state) {
  const base = state?.baseSupportProjection || state?.supportProjection || null;
  if (!base) return Object.freeze({ projection: null, register: null });
  const register = state?.supportAdjustmentRegister
    || createSequentialSupportAdjustmentRegister({
      constructionFingerprint: base.constructionFingerprint,
    });
  const projection = state?.baseSupportProjection
    ? state.supportProjection
    : applySequentialSupportAdjustmentRegister(base, register);
  return Object.freeze({ projection, register });
}
function authorityAgreement(readModel, state) {
  const authority = deriveSequentialEditAuthority(state);
  const support = normalizedSupportAuthority(state);
  if (readModel.branchId !== authority.branchId
    || readModel.sessionFingerprint !== authority.sessionFingerprint
    || readModel.supportConstructionFingerprint
      !== (support.projection?.constructionFingerprint || null)
    || readModel.supportProjectionFingerprint
      !== (support.projection ? sequentialSupportProjectionFingerprint(support.projection) : null)
    || readModel.supportAdjustmentRegisterFingerprint !== support.register?.headFingerprint) {
    fail(readModel.branchId === authority.branchId
      ? SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_REJECTION.AUTHORITY_STALE
      : SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_REJECTION.BRANCH_MISMATCH,
    'Draft Edit scene authority does not match current support authority.');
  }
  return authority;
}
function exactEntity(scene, objectId) {
  const entity = scene.entities.find((row) => row.id === objectId);
  if (!entity) fail(SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_REJECTION.ENTITY_MISSING,
    `Scene entity ${objectId} is not part of the certified Draft Edit scene.`);
  const ref = entity.domainRef || {};
  if (entity.domainType !== 'SEQUENTIAL_CONFIRMED_SUPPORT'
    || ref.category !== 'support' || !text(ref.supportId)) {
    fail(SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_REJECTION.ENTITY_NOT_SUPPORT,
      `Scene entity ${objectId} is not a certified confirmed support.`);
  }
  if (!entity.editCapabilities?.includes('MOVE_DRAFT')) {
    fail(SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_REJECTION.CAPABILITY_MISSING,
      `Scene entity ${objectId} does not expose MOVE_DRAFT.`);
  }
  return Object.freeze({ entity, supportId: text(ref.supportId),
    familyId: text(ref.familyId), carrierId: text(ref.carrierId) });
}
function exactSupport(state, resolved) {
  const projection = state?.supportProjection;
  if (projection?.schema !== 'SequentialConfirmedSupportProjection.v1') {
    fail(SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_REJECTION.SUPPORT_MISSING,
      'Current authority has no confirmed support projection.');
  }
  const glyph = (projection.supportGlyphs || [])
    .find((row) => row.glyphId === resolved.supportId);
  if (!glyph) fail(SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_REJECTION.SUPPORT_MISSING,
    `Support ${resolved.supportId} is not current support evidence.`);
  const position = point(glyph.centerlinePointGlobal);
  const scenePosition = point(resolved.entity.geometry?.position);
  const family = supportFamilies(projection).get(glyph.familyId) || null;
  if (!position || !scenePosition
    || glyph.familyId !== resolved.familyId
    || glyph.carrierId !== resolved.carrierId
    || !family || !sameSequentialContractValue(position, scenePosition)) {
    fail(SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_REJECTION.SUPPORT_MISMATCH,
      `Support ${resolved.supportId} differs from current family, carrier or position evidence.`);
  }
  return Object.freeze({ glyph, family, position });
}
function buildTarget(input = {}) {
  const readModel = assertSequentialScopedEditReadModel(input.readModel);
  const scene = assertSequentialScopedEditSceneAncestry(input.scene, readModel);
  const authority = authorityAgreement(readModel, input.currentState);
  const objectId = requiredObjectId(input.objectId);
  const resolved = exactEntity(scene, objectId);
  const current = exactSupport(input.currentState, resolved);
  const material = {
    schema: SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_TARGET_SCHEMA,
    authorityId: authority.authorityId,
    readAuthorityId: readModel.authorityId,
    branchId: authority.branchId,
    sceneRevision: readModel.revision,
    supportId: requiredContractText(current.glyph.glyphId, 'supportId'),
    familyId: requiredContractText(current.glyph.familyId, 'support familyId'),
    carrierId: requiredContractText(current.glyph.carrierId, 'support carrierId'),
    entityId: objectId,
    originalPosition: current.position,
  };
  return immutableJson({
    ...material,
    supportMoveTargetId: sequentialSemanticFingerprint('SSK3DSUPPORTMOVE', material),
  }, 'Sequential Draft Edit support move target');
}

export function selectSequentialDraftEditSupportMoveTarget(input = {}) {
  return buildTarget(input);
}
export function validateSequentialDraftEditSupportMoveTarget(target, input = {}) {
  if (target?.schema !== SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_TARGET_SCHEMA) fail(
    SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_REJECTION.SUPPORT_MISMATCH,
    `Support move target must use ${SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_TARGET_SCHEMA}.`);
  const rebuilt = buildTarget({ ...input, objectId: target.entityId });
  if (!sameSequentialContractValue(rebuilt, target)) fail(
    SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_REJECTION.AUTHORITY_STALE,
    'Support move target is stale against current authority.');
  return rebuilt;
}
