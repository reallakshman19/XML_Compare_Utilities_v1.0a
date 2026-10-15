/** Immutable non-publishing move-preview draft store for SSK-TS-3L/3M. */
import { immutableJson } from '../../../contracts/contract-values.js';
import { composeEngineeringSvgDraftScene } from '../../../core/engineering-svg/engineering-svg-draft-overlay.js';
import { createEngineeringSvgDraftStore } from '../../../core/engineering-svg/engineering-svg-draft-store.js';
import { sequentialSemanticFingerprint } from './sequential-command-contracts.js';
import { assertSequentialMoveSnapSelection } from './sequential-move-snap-contracts.js';
import {
  constrainSequentialMoveDelta,
  createSequentialMoveConstraint,
  diagnoseSequentialMoveBoundaries,
  sequentialMovePivot,
  translateSequentialMoveGeometry,
} from './sequential-single-entity-move-geometry.js';
import { SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_SCHEMA } from './sequential-single-entity-move-target.js';

export const SEQUENTIAL_SINGLE_ENTITY_MOVE_DRAFT_SCHEMA =
  'SequentialSingleEntityMoveDraft.v1';

function assertTarget(target) {
  if (target?.schema !== SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_SCHEMA) {
    throw new TypeError(`Move-preview target must use ${SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_SCHEMA}.`);
  }
  return target;
}
function assertLive(state) {
  if (state.destroyed) throw new Error('Single-entity move draft store is destroyed.');
}
function interactionRecord(input) {
  const kind = String(input?.kind || 'numeric').trim().toLowerCase();
  if (!['numeric', 'pointer'].includes(kind)) {
    throw new TypeError('Move-preview interaction kind must be numeric or pointer.');
  }
  return immutableJson({
    kind,
    source: String(input?.source || (kind === 'pointer' ? 'viewer-ray' : 'exact-xyz')),
  }, 'Sequential move interaction');
}
function operationId(input, material) {
  const explicit = String(input.operationId || '').trim();
  return explicit || sequentialSemanticFingerprint('SSK3LMOVEDRAFT', material);
}
function previewDisposition(diagnosis, noChange) {
  if (noChange) return 'NO_CHANGE';
  if (diagnosis.aggregateDisposition === 'REPAIR_BOUNDARY_LOCKED') {
    return 'PREVIEW_ONLY_REPAIR_BOUNDARY_LOCKED';
  }
  if (diagnosis.aggregateDisposition === 'WOULD_DISCONNECT') {
    return 'PREVIEW_ONLY_BOUNDARY_DISCONNECTION';
  }
  return 'PREVIEW_ONLY_RIGID_TRANSLATION_CLEAR';
}
function stageParts(store, translated, constraint) {
  translated.forEach((part) => store.stageGeometry(part.geometryPartId, {
    original: part.originalGeometry,
    draft: part.draftGeometry,
    constraint,
  }));
  return store.getSnapshot();
}
function add(point, delta) {
  return { x: point.x + delta.x, y: point.y + delta.y, z: point.z + delta.z };
}
function samePoint(left, right) {
  return ['x', 'y', 'z'].every((axis) => left[axis] === right[axis]);
}
function snapSelection(input, target, delta) {
  if (input.snapSelection == null) return null;
  const selection = assertSequentialMoveSnapSelection(input.snapSelection);
  const effective = add(sequentialMovePivot(target.geometryParts), delta);
  if (!samePoint(effective, selection.candidate.worldPoint)) {
    throw new RangeError('Snapped move delta does not terminate at the selected candidate point.');
  }
  return selection;
}
function stageMaterial(input) {
  const target = assertTarget(input.target);
  const constraint = createSequentialMoveConstraint(input.constraint);
  const rawDelta = constrainSequentialMoveDelta(input.rawDelta ?? input.delta, constraint);
  const delta = constrainSequentialMoveDelta(input.delta, constraint);
  const interaction = interactionRecord(input.interaction);
  const selection = snapSelection(input, target, delta);
  const translated = translateSequentialMoveGeometry(target.geometryParts, delta);
  const boundaryDiagnosis = diagnoseSequentialMoveBoundaries(target, delta);
  return {
    target, constraint, rawDelta, delta, interaction,
    snapSelection: selection, translated, boundaryDiagnosis,
  };
}
function previewMaterial(data) {
  return {
    targetId: data.target.moveTargetId,
    constraint: data.constraint,
    rawDelta: data.rawDelta,
    delta: data.delta,
    interaction: data.interaction,
    snapSelection: data.snapSelection,
    snapshotFingerprint: data.target.snapshotFingerprint,
  };
}
function stageMoveDraft(state, input = {}) {
  assertLive(state);
  const data = stageMaterial(input);
  const material = previewMaterial(data);
  const id = operationId(input, material);
  if (state.store.getSnapshot().operationId) state.store.clear('replace-move-preview');
  state.store.begin({ operationId: id, baseRevision: data.target.sceneRevision });
  const draft = stageParts(state.store, data.translated, data.constraint);
  const noChange = data.delta.magnitude === 0;
  const pivot = sequentialMovePivot(data.target.geometryParts);
  state.preview = immutableJson({
    schema: SEQUENTIAL_SINGLE_ENTITY_MOVE_DRAFT_SCHEMA,
    operationId: id,
    target: data.target,
    constraint: data.constraint,
    interaction: data.interaction,
    pivot,
    rawDelta: data.rawDelta,
    delta: data.delta,
    rawTargetPoint: add(pivot, data.rawDelta),
    effectiveTargetPoint: add(pivot, data.delta),
    snapSelection: data.snapSelection,
    snapApplied: Boolean(data.snapSelection),
    geometryParts: data.translated,
    boundaryDiagnosis: data.boundaryDiagnosis,
    noChange,
    previewDisposition: previewDisposition(data.boundaryDiagnosis, noChange),
    draft,
    publicationState: 'NOT_PUBLISHED',
    draftFingerprint: sequentialSemanticFingerprint('SSK3MMOVEPREVIEW', {
      ...material,
      translated: data.translated,
      boundaryDiagnosis: data.boundaryDiagnosis,
    }),
  }, 'Sequential single-entity move draft');
  return state.preview;
}
function clearMoveDraft(state, reason = 'cancelled') {
  assertLive(state);
  state.preview = null;
  return state.store.clear(String(reason || 'cancelled'));
}
function destroyMoveDraft(state) {
  if (state.destroyed) return false;
  state.destroyed = true; state.preview = null; state.store.dispose(); return true;
}

export function createSequentialSingleEntityMoveDraftStore() {
  const state = { store: createEngineeringSvgDraftStore(), preview: null, destroyed: false };
  return Object.freeze({
    schema: 'SequentialSingleEntityMoveDraftStore.v1',
    stage: (input) => stageMoveDraft(state, input),
    cancel: (reason) => clearMoveDraft(state, reason),
    getDraft() { assertLive(state); return state.store.getSnapshot(); },
    getPreview() { assertLive(state); return state.preview; },
    destroy: () => destroyMoveDraft(state),
  });
}

export function composeSequentialSingleEntityMoveDraftScene(scene, draft) {
  return draft?.operationId
    ? composeEngineeringSvgDraftScene(scene, draft, 'original-and-draft')
    : scene;
}
