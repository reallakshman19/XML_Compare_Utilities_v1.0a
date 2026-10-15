/** Immutable non-publishing draft store for one certified node stretch. */
import { immutableJson } from '../../../contracts/contract-values.js';
import { composeEngineeringSvgDraftScene } from '../../../core/engineering-svg/engineering-svg-draft-overlay.js';
import { createEngineeringSvgDraftStore } from '../../../core/engineering-svg/engineering-svg-draft-store.js';
import { sequentialSemanticFingerprint } from './sequential-command-contracts.js';
import { createSequentialNodeStretchGeometry } from './sequential-node-stretch-geometry.js';
import { SEQUENTIAL_NODE_STRETCH_TARGET_SCHEMA } from './sequential-node-stretch-target.js';

export const SEQUENTIAL_NODE_STRETCH_DRAFT_SCHEMA = 'SequentialNodeStretchDraft.v1';

function assertTarget(value) {
  if (value?.schema !== SEQUENTIAL_NODE_STRETCH_TARGET_SCHEMA) {
    throw new TypeError(`Node stretch target must use ${SEQUENTIAL_NODE_STRETCH_TARGET_SCHEMA}.`);
  }
  return value;
}
function assertLive(state) {
  if (state.destroyed) throw new Error('Node stretch draft store is destroyed.');
}
function stageParts(store, geometryParts, profile) {
  geometryParts.forEach((part) => store.stageGeometry(part.geometryPartId, {
    original: part.originalGeometry,
    draft: part.draftGeometry,
    constraint: profile,
  }));
  return store.getSnapshot();
}
function operationId(input, material) {
  const explicit = String(input.operationId || '').trim();
  return explicit || sequentialSemanticFingerprint('SSK3OSTRETCHDRAFT', material);
}
function stageMaterial(input) {
  const target = assertTarget(input.target);
  const stretch = createSequentialNodeStretchGeometry({
    nodeId: target.nodeId,
    originalPosition: target.originalPosition,
    targetPosition: input.targetPosition,
    geometryParts: target.geometryParts,
    profile: input.profile,
  });
  return { target, stretch };
}
function previewMaterial(data) {
  return {
    stretchTargetId: data.target.stretchTargetId,
    nodeId: data.target.nodeId,
    targetPosition: data.stretch.targetPosition,
    profile: data.stretch.profile,
    snapshotFingerprint: data.target.snapshotFingerprint,
  };
}
function stageNodeStretch(state, input = {}) {
  assertLive(state);
  const data = stageMaterial(input);
  const material = previewMaterial(data);
  const id = operationId(input, material);
  if (state.store.getSnapshot().operationId) state.store.clear('replace-node-stretch-preview');
  state.store.begin({ operationId: id, baseRevision: data.target.sceneRevision });
  const draft = stageParts(state.store, data.stretch.geometryParts, data.stretch.profile);
  state.preview = immutableJson({
    schema: SEQUENTIAL_NODE_STRETCH_DRAFT_SCHEMA,
    operationId: id,
    target: data.target,
    profile: data.stretch.profile,
    originalPosition: data.stretch.originalPosition,
    targetPosition: data.stretch.targetPosition,
    delta: data.stretch.delta,
    geometryParts: data.stretch.geometryParts,
    noChange: data.stretch.noChange,
    previewDisposition: data.stretch.noChange
      ? 'NO_CHANGE' : 'PREVIEW_ONLY_NODE_STRETCH_QUALIFIED',
    draft,
    publicationState: 'NOT_PUBLISHED',
    draftFingerprint: sequentialSemanticFingerprint('SSK3OSTRETCHPREVIEW', {
      ...material,
      geometryParts: data.stretch.geometryParts,
      delta: data.stretch.delta,
    }),
  }, 'Sequential node stretch draft');
  return state.preview;
}
function clearNodeStretch(state, reason = 'cancelled') {
  assertLive(state); state.preview = null; return state.store.clear(String(reason || 'cancelled'));
}
function destroyNodeStretch(state) {
  if (state.destroyed) return false;
  state.destroyed = true; state.preview = null; state.store.dispose(); return true;
}
export function createSequentialNodeStretchDraftStore() {
  const state = { store: createEngineeringSvgDraftStore(), preview: null, destroyed: false };
  return Object.freeze({
    schema: 'SequentialNodeStretchDraftStore.v1',
    stage: (input) => stageNodeStretch(state, input),
    cancel: (reason) => clearNodeStretch(state, reason),
    getDraft() { assertLive(state); return state.store.getSnapshot(); },
    getPreview() { assertLive(state); return state.preview; },
    destroy: () => destroyNodeStretch(state),
  });
}
export function composeSequentialNodeStretchDraftScene(scene, draft) {
  return draft?.operationId
    ? composeEngineeringSvgDraftScene(scene, draft, 'original-and-draft')
    : scene;
}
