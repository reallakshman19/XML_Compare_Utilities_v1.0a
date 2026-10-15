/** Non-publishing exact support move draft; no domain commit path. */
import { immutableJson, requiredContractText } from '../../../contracts/contract-values.js';
import {
  createEngineeringEditIntent,
  createPointGeometry,
} from '../../../core/engineering-scene/index.js';
import { composeEngineeringSvgDraftScene } from '../../../core/engineering-svg/engineering-svg-draft-overlay.js';
import { createEngineeringSvgDraftStore } from '../../../core/engineering-svg/engineering-svg-draft-store.js';
import { sequentialSemanticFingerprint } from './sequential-command-contracts.js';
import { SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_TARGET_SCHEMA } from './sequential-draft-edit-support-move-target.js';

export const SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_PREVIEW_SCHEMA =
  'SequentialDraftEditSupportMovePreview.v1';

function text(value) { return String(value ?? '').trim(); }
function finitePoint(value, label = 'Support move position') {
  const source = value || {};
  const point = Object.fromEntries(['x', 'y', 'z'].map((axis) => {
    const raw = source[axis];
    if (raw == null || (typeof raw === 'string' && !raw.trim())) {
      throw new TypeError(`${label} ${axis.toUpperCase()} is required.`);
    }
    const number = Number(raw);
    if (!Number.isFinite(number)) throw new TypeError(`${label} ${axis.toUpperCase()} must be finite.`);
    return [axis, number];
  }));
  return Object.freeze(point);
}
function samePoint(left, right) {
  return ['x', 'y', 'z'].every((axis) => left[axis] === right[axis]);
}
function provenance(input) {
  return Object.freeze({
    actorId: requiredContractText(input.actorId, 'support move actorId'),
    reason: requiredContractText(input.reason, 'support move reason'),
    evidenceNote: requiredContractText(input.evidenceNote, 'support move evidenceNote'),
  });
}
function delta(original, draft) {
  const value = Object.fromEntries(['x', 'y', 'z'].map((axis) => [axis, draft[axis] - original[axis]]));
  return Object.freeze({
    ...value,
    magnitude: Math.hypot(value.x, value.y, value.z),
  });
}

export function createSequentialDraftEditSupportMoveDraftStore() {
  const store = createEngineeringSvgDraftStore();
  let preview = null;
  let destroyed = false;
  function assertLive() { if (destroyed) throw new Error('Support move draft store is destroyed.'); }
  function clear(reason = 'cancelled') {
    assertLive();
    preview = null;
    return store.clear(text(reason) || 'cancelled');
  }
  function stage(input = {}) {
    assertLive();
    const target = input.target;
    if (target?.schema !== SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_TARGET_SCHEMA) {
      throw new TypeError(`Support move target must use ${SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_TARGET_SCHEMA}.`);
    }
    const originalPosition = finitePoint(target.originalPosition, 'Original support position');
    const draftPosition = finitePoint(input.position, 'Draft support position');
    if (samePoint(originalPosition, draftPosition)) {
      throw new RangeError('Draft support position must differ from the current support position.');
    }
    const source = provenance(input);
    const operationMaterial = {
      targetId: target.supportMoveTargetId,
      entityId: target.entityId,
      originalPosition,
      draftPosition,
      source,
    };
    const operationId = sequentialSemanticFingerprint('SSK3DSUPPORTDRAFT', operationMaterial);
    if (store.getSnapshot().operationId) store.clear('replace-preview');
    store.begin({ operationId, baseRevision: target.sceneRevision });
    store.stageGeometry(target.entityId, {
      original: createPointGeometry(originalPosition),
      draft: createPointGeometry(draftPosition),
    });
    const intent = createEngineeringEditIntent({
      type: 'MOVE_ENTITY',
      operationId,
      baseRevision: target.sceneRevision,
      entityIds: [target.entityId],
      changes: {
        geometry: {
          supportId: target.supportId,
          originalPosition,
          requestedPosition: draftPosition,
        },
      },
      source: {
        interaction: 'typed',
        actorId: source.actorId,
        reason: source.reason,
        evidenceNote: source.evidenceNote,
        authorityId: target.authorityId,
        supportMoveTargetId: target.supportMoveTargetId,
      },
    });
    preview = immutableJson({
      schema: SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_PREVIEW_SCHEMA,
      operationId,
      target,
      intent,
      draft: store.getSnapshot(),
      originalPosition,
      draftPosition,
      delta: delta(originalPosition, draftPosition),
      publicationState: 'NOT_PUBLISHED',
    }, 'Sequential support move draft preview');
    return preview;
  }
  return Object.freeze({
    schema: 'SequentialDraftEditSupportMoveDraftStore.v1',
    stage,
    cancel: clear,
    getDraft() { assertLive(); return store.getSnapshot(); },
    getPreview() { assertLive(); return preview; },
    destroy() {
      if (destroyed) return false;
      destroyed = true; preview = null; store.dispose(); return true;
    },
  });
}

export function composeSequentialSupportMoveDraftScene(scene, draft) {
  return draft?.operationId
    ? composeEngineeringSvgDraftScene(scene, draft, 'original-and-draft')
    : scene;
}
