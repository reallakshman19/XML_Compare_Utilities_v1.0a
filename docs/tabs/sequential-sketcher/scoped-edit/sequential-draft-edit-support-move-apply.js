/** Deterministic prepare/accept service for one exact same-carrier support adjustment. */
import { immutableJson, isIsoTimestamp } from '../../../contracts/contract-values.js';
import { locateSupportOnCarrier, POSITION_STATUS } from '../support/sj-pipe-support-geometry.js';
import { pointDistance } from '../support/sj-pipe-support-utils.js';
import {
  appendSequentialSupportAdjustment,
  assertSequentialSupportAdjustmentRegister,
} from '../support/sequential-support-adjustment-register.js';
import {
  applySequentialSupportAdjustmentRegister,
  sequentialSupportProjectionFingerprint,
} from '../support/sequential-support-adjusted-projection.js';
import {
  sameSequentialContractValue,
  sequentialSemanticFingerprint,
} from './sequential-command-contracts.js';
import { deriveSequentialEditAuthority } from './sequential-edit-authority.js';

export const SEQUENTIAL_PREPARED_SUPPORT_ADJUSTMENT_SCHEMA =
  'SequentialPreparedSupportAdjustment.v1';
export const SEQUENTIAL_PREPARED_SUPPORT_ADJUSTMENT_CANDIDATE_SCHEMA =
  'SequentialPreparedSupportAdjustmentCandidate.v1';
export const SEQUENTIAL_SUPPORT_ADJUSTMENT_ACCEPTANCE_SCHEMA =
  'SequentialSupportAdjustmentAcceptance.v1';
export const SEQUENTIAL_SUPPORT_ADJUSTMENT_REJECTION = Object.freeze({
  PREVIEW_INVALID: 'SUPPORT_ADJUSTMENT_PREVIEW_INVALID',
  AUTHORITY_STALE: 'SUPPORT_ADJUSTMENT_AUTHORITY_STALE',
  SUPPORT_STALE: 'SUPPORT_ADJUSTMENT_SUPPORT_STALE',
  CARRIER_MISSING: 'SUPPORT_ADJUSTMENT_CARRIER_MISSING',
  NOT_SAME_CARRIER: 'SUPPORT_ADJUSTMENT_NOT_SAME_CARRIER',
  HIDDEN_SNAP: 'SUPPORT_ADJUSTMENT_HIDDEN_SNAP',
  PREPARED_INVALID: 'SUPPORT_ADJUSTMENT_PREPARED_INVALID',
  PUBLICATION_FAILED: 'SUPPORT_ADJUSTMENT_PUBLICATION_FAILED',
});

const EXACT_POINT_TOLERANCE_MM = 1e-9;
const ACCEPTED_POSITION_STATUS = new Set([
  POSITION_STATUS.ON_CENTERLINE,
  POSITION_STATUS.ATTACHED_TO_COMPONENT_PORT,
  POSITION_STATUS.ATTACHED_TO_FITTING,
]);

function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}
function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function exactNow(now) {
  const value = now();
  if (!isIsoTimestamp(value)) throw new TypeError('Support adjustment clock must return an exact ISO timestamp.');
  return value;
}
function targetMaterial(target = {}) {
  return {
    schema: 'SequentialDraftEditSupportMoveTarget.v1',
    authorityId: target.authorityId,
    readAuthorityId: target.readAuthorityId,
    branchId: target.branchId,
    sceneRevision: target.sceneRevision,
    supportId: target.supportId,
    familyId: target.familyId,
    carrierId: target.carrierId,
    entityId: target.entityId,
    originalPosition: target.originalPosition,
  };
}
function previewValue(value) {
  if (value?.schema !== 'SequentialDraftEditSupportMovePreview.v1'
    || value.intent?.schema !== 'EngineeringEditIntent.v1'
    || value.intent.type !== 'MOVE_ENTITY'
    || value.publicationState !== 'NOT_PUBLISHED') {
    fail(SEQUENTIAL_SUPPORT_ADJUSTMENT_REJECTION.PREVIEW_INVALID,
      'Support adjustment requires one exact non-published MOVE_ENTITY preview.', TypeError);
  }
  const target = value.target || {};
  const expectedTargetId = sequentialSemanticFingerprint('SSK3DSUPPORTMOVE', targetMaterial(target));
  const geometry = value.draft?.geometry?.[target.entityId];
  const exact = target.supportMoveTargetId === expectedTargetId
    && value.operationId === value.intent.operationId
    && value.operationId === value.draft?.operationId
    && sameSequentialContractValue(value.intent.baseRevision, target.sceneRevision)
    && sameSequentialContractValue(value.draft?.baseRevision, target.sceneRevision)
    && sameSequentialContractValue(value.intent.entityIds, [target.entityId])
    && sameSequentialContractValue(value.originalPosition, target.originalPosition)
    && sameSequentialContractValue(geometry?.original?.position, value.originalPosition)
    && sameSequentialContractValue(geometry?.draft?.position, value.draftPosition)
    && value.intent.source?.supportMoveTargetId === target.supportMoveTargetId
    && value.intent.source?.authorityId === target.authorityId;
  if (!exact) fail(SEQUENTIAL_SUPPORT_ADJUSTMENT_REJECTION.PREVIEW_INVALID,
    'Support adjustment preview differs from canonical target, intent or draft evidence.');
  return value;
}
function point(value, label) {
  if (!value || !['x', 'y', 'z'].every((axis) => Number.isFinite(value[axis]))) {
    fail(SEQUENTIAL_SUPPORT_ADJUSTMENT_REJECTION.PREVIEW_INVALID,
      `${label} must contain finite X/Y/Z coordinates.`, TypeError);
  }
  return Object.freeze({ x: value.x, y: value.y, z: value.z });
}
function currentGlyph(state, preview) {
  const target = preview.target;
  const glyph = (state.supportProjection?.supportGlyphs || [])
    .find((row) => row.glyphId === target.supportId);
  if (!glyph || glyph.familyId !== target.familyId || glyph.carrierId !== target.carrierId
    || !sameSequentialContractValue(point(glyph.centerlinePointGlobal, 'Current support point'),
      point(preview.originalPosition, 'Preview original point'))) {
    fail(SEQUENTIAL_SUPPORT_ADJUSTMENT_REJECTION.SUPPORT_STALE,
      'Preview support identity or original point is stale.');
  }
  return glyph;
}
function baseCarrier(state, preview) {
  const base = state.baseSupportProjection;
  if (base?.schema !== 'SequentialConfirmedSupportProjection.v1') {
    fail(SEQUENTIAL_SUPPORT_ADJUSTMENT_REJECTION.CARRIER_MISSING,
      'Current authority has no immutable base support projection.');
  }
  for (const bundle of base.branchBundles || []) {
    const carrier = (bundle.carriers || [])
      .find((row) => row.carrierId === preview.target.carrierId);
    if (carrier) return Object.freeze({ base, bundle, carrier });
  }
  fail(SEQUENTIAL_SUPPORT_ADJUSTMENT_REJECTION.CARRIER_MISSING,
    `Certified carrier ${preview.target.carrierId} is unavailable.`);
}
function exactCarrierResolution(state, preview) {
  const found = baseCarrier(state, preview);
  const requested = point(preview.draftPosition, 'Preview requested point');
  const resolved = locateSupportOnCarrier({
    supportPosGlobal: requested,
    carrier: found.carrier,
    projectionToleranceMm: 0.001,
    onCenterlineToleranceMm: 0.001,
    plantUp: found.bundle.coordinateSystem?.plantUp,
  });
  if (!resolved || !ACCEPTED_POSITION_STATUS.has(resolved.positionStatus)) {
    fail(SEQUENTIAL_SUPPORT_ADJUSTMENT_REJECTION.NOT_SAME_CARRIER,
      'Requested support point is not an exact accepted location on the certified carrier.');
  }
  const canonical = point(resolved.centerlinePointGlobal, 'Resolved support point');
  if (pointDistance(canonical, requested) > EXACT_POINT_TOLERANCE_MM) {
    fail(SEQUENTIAL_SUPPORT_ADJUSTMENT_REJECTION.HIDDEN_SNAP,
      'Requested support point would require hidden projection or snapping.');
  }
  return Object.freeze({ ...found, requested, resolved: { ...resolved,
    supportPosGlobal: requested, centerlinePointGlobal: canonical } });
}
function expectedRegister(state, base) {
  return assertSequentialSupportAdjustmentRegister(
    state.supportAdjustmentRegister,
    base.constructionFingerprint,
  );
}
function preparedMaterial(preview, expectedAuthority, candidate) {
  return { schema: SEQUENTIAL_PREPARED_SUPPORT_ADJUSTMENT_SCHEMA,
    preview, expectedAuthority, candidate };
}
function preparedValue(value) {
  if (value?.schema !== SEQUENTIAL_PREPARED_SUPPORT_ADJUSTMENT_SCHEMA) {
    fail(SEQUENTIAL_SUPPORT_ADJUSTMENT_REJECTION.PREPARED_INVALID,
      `Prepared support adjustment must use ${SEQUENTIAL_PREPARED_SUPPORT_ADJUSTMENT_SCHEMA}.`,
      TypeError);
  }
  previewValue(value.preview);
  const material = preparedMaterial(value.preview, value.expectedAuthority, value.candidate);
  if (value.preparedId !== sequentialSemanticFingerprint('SSUPPORTADJUSTPREP', material)) {
    fail(SEQUENTIAL_SUPPORT_ADJUSTMENT_REJECTION.PREPARED_INVALID,
      'Prepared support adjustment differs from canonical regeneration.');
  }
  return value;
}

export function createSequentialDraftEditSupportMoveApplyService(options = {}) {
  const readCurrentState = requiredFunction(options.readCurrentState, 'readCurrentState');
  const publishCandidate = requiredFunction(options.publishCandidate, 'publishCandidate');
  const now = requiredFunction(options.now, 'now');

  function prepare(previewInput) {
    const preview = previewValue(previewInput);
    const state = readCurrentState();
    const expectedAuthority = deriveSequentialEditAuthority(state);
    if (preview.target.authorityId !== expectedAuthority.authorityId
      || preview.target.branchId !== expectedAuthority.branchId) {
      fail(SEQUENTIAL_SUPPORT_ADJUSTMENT_REJECTION.AUTHORITY_STALE,
        'Support move preview authority is stale.');
    }
    currentGlyph(state, preview);
    const located = exactCarrierResolution(state, preview);
    const register = expectedRegister(state, located.base);
    const provenance = preview.intent.source || {};
    const appended = appendSequentialSupportAdjustment(register, {
      supportId: preview.target.supportId, familyId: preview.target.familyId,
      carrierId: preview.target.carrierId, fromPosition: preview.originalPosition,
      toPosition: located.requested, resolvedPosition: located.resolved,
      targetId: preview.target.supportMoveTargetId, operationId: preview.operationId,
      actorId: provenance.actorId, reason: provenance.reason,
      evidenceNote: provenance.evidenceNote, appliedAt: exactNow(now),
    });
    const supportProjection = applySequentialSupportAdjustmentRegister(
      located.base,
      appended.register,
    );
    const candidate = immutableJson({
      schema: SEQUENTIAL_PREPARED_SUPPORT_ADJUSTMENT_CANDIDATE_SCHEMA,
      expectedBaseProjectionFingerprint: sequentialSupportProjectionFingerprint(located.base),
      expectedRegisterHeadFingerprint: register.headFingerprint,
      register: appended.register,
      supportProjection,
      entry: appended.entry,
    }, 'Sequential prepared support adjustment candidate');
    const material = preparedMaterial(preview, expectedAuthority, candidate);
    return immutableJson({
      ...material,
      preparedId: sequentialSemanticFingerprint('SSUPPORTADJUSTPREP', material),
    }, 'Sequential prepared support adjustment');
  }
  function accept(preparedInput) {
    const prepared = preparedValue(preparedInput);
    const currentAuthority = deriveSequentialEditAuthority(readCurrentState());
    if (!sameSequentialContractValue(currentAuthority, prepared.expectedAuthority)) {
      return immutableJson({
        schema: SEQUENTIAL_SUPPORT_ADJUSTMENT_ACCEPTANCE_SCHEMA,
        accepted: false,
        reasonCode: SEQUENTIAL_SUPPORT_ADJUSTMENT_REJECTION.AUTHORITY_STALE,
        preparedId: prepared.preparedId,
        expectedAuthorityId: prepared.expectedAuthority.authorityId,
        currentAuthorityId: currentAuthority.authorityId,
        publicationState: 'NOT_PUBLISHED', publication: null,
      }, 'Sequential support adjustment acceptance');
    }
    try {
      const publication = publishCandidate({
        preparedId: prepared.preparedId,
        expectedAuthority: prepared.expectedAuthority,
        candidate: prepared.candidate,
      });
      return immutableJson({
        schema: SEQUENTIAL_SUPPORT_ADJUSTMENT_ACCEPTANCE_SCHEMA,
        accepted: true, reasonCode: null, preparedId: prepared.preparedId,
        expectedAuthorityId: prepared.expectedAuthority.authorityId,
        currentAuthorityId: currentAuthority.authorityId,
        publicationState: 'COMMITTED', publication,
      }, 'Sequential support adjustment acceptance');
    } catch (error) {
      fail(SEQUENTIAL_SUPPORT_ADJUSTMENT_REJECTION.PUBLICATION_FAILED,
        error?.message || String(error), Error);
    }
  }
  return Object.freeze({
    schema: 'SequentialDraftEditSupportMoveApplyService.v1', prepare, accept,
  });
}

export const _test = Object.freeze({ EXACT_POINT_TOLERANCE_MM, exactCarrierResolution });
