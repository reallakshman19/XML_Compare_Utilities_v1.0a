/** Immutable non-publishing rigid-rotation draft store for one component or subgraph. */
import { immutableJson } from '../../../contracts/contract-values.js';
import { composeEngineeringSvgDraftScene } from '../../../core/engineering-svg/engineering-svg-draft-overlay.js';
import { createEngineeringSvgDraftStore } from '../../../core/engineering-svg/engineering-svg-draft-store.js';
import { sameSequentialContractValue, sequentialSemanticFingerprint } from './sequential-command-contracts.js';
import {
  createSequentialRotationBoundaryDiagnosis,
  createSequentialRotationTransform,
  rotateSequentialGeometry,
  rotateSequentialPoint,
} from './sequential-rotation-geometry.js';
import { SEQUENTIAL_ROTATION_TARGET_SCHEMA } from './sequential-rotation-target.js';

export const SEQUENTIAL_ROTATION_DRAFT_SCHEMA = 'SequentialRotationDraft.v1';

function assertTarget(value) {
  if (value?.schema !== SEQUENTIAL_ROTATION_TARGET_SCHEMA) {
    throw new TypeError(`Rotation target must use ${SEQUENTIAL_ROTATION_TARGET_SCHEMA}.`);
  }
  return value;
}
function assertLive(state) {
  if (state.destroyed) throw new Error('Rotation draft store is destroyed.');
}
function stageParts(store, parts, transform) {
  parts.forEach((part) => store.stageGeometry(part.geometryPartId, {
    original: part.originalGeometry, draft: part.draftGeometry, constraint: transform,
  }));
  return store.getSnapshot();
}
function rotatedParts(target, transform) {
  return target.geometryParts.map((part) => ({
    geometryPartId: part.geometryPartId, componentId: part.componentId,
    nodeIds: part.nodeIds, originalGeometry: part.geometry,
    draftGeometry: rotateSequentialGeometry(part.geometry, transform),
  }));
}
function rotatedPositions(rows, key, transform) {
  return rows.map((row) => ({
    [key]: row[key],
    position: rotateSequentialPoint(row.position, transform),
  }));
}
function noChange(target, parts, ports, nodes) {
  const portMap = new Map(target.ports.map((row) => [row.portId, row.position]));
  const nodeMap = new Map(target.nodes.map((row) => [row.nodeId, row.position]));
  return parts.every((row) => sameSequentialContractValue(row.originalGeometry, row.draftGeometry))
    && ports.every((row) => sameSequentialContractValue(portMap.get(row.portId), row.position))
    && nodes.every((row) => sameSequentialContractValue(nodeMap.get(row.nodeId), row.position));
}
function operationId(input, material) {
  const explicit = String(input.operationId || '').trim();
  return explicit || sequentialSemanticFingerprint('SSK3PROTATIONDRAFT', material);
}
function disposition(target, diagnosis, unchanged) {
  if (unchanged) return 'NO_CHANGE';
  if (target.locks.length) return 'PREVIEW_ONLY_ROTATION_LOCKED';
  return diagnosis.aggregateDisposition === 'PRESERVED'
    ? 'PREVIEW_ONLY_ROTATION_CLEAR' : 'PREVIEW_ONLY_BOUNDARY_DISCONNECTION';
}
function previewMaterial(target, transform) {
  return {
    rotationTargetId: target.rotationTargetId,
    scope: target.scope,
    affectedComponentIds: target.affectedComponentIds,
    transformFingerprint: transform.transformFingerprint,
    snapshotFingerprint: target.snapshotFingerprint,
  };
}
function stageRotation(state, input = {}) {
  assertLive(state);
  const target = assertTarget(input.target);
  const transform = createSequentialRotationTransform(input);
  const geometryParts = rotatedParts(target, transform);
  const ports = rotatedPositions(target.ports, 'portId', transform);
  const nodes = rotatedPositions(target.nodes, 'nodeId', transform);
  const diagnosis = createSequentialRotationBoundaryDiagnosis(target.boundaryCuts, transform);
  const unchanged = noChange(target, geometryParts, ports, nodes);
  const material = previewMaterial(target, transform);
  const id = operationId(input, material);
  if (state.store.getSnapshot().operationId) state.store.clear('replace-rotation-preview');
  state.store.begin({ operationId: id, baseRevision: target.sceneRevision });
  const draft = stageParts(state.store, geometryParts, transform);
  state.preview = immutableJson({
    schema: SEQUENTIAL_ROTATION_DRAFT_SCHEMA,
    operationId: id, target, transform,
    geometryParts, ports, nodes, boundaryDiagnosis: diagnosis,
    noChange: unchanged, previewDisposition: disposition(target, diagnosis, unchanged),
    draft, publicationState: 'NOT_PUBLISHED',
    draftFingerprint: sequentialSemanticFingerprint('SSK3PROTATIONPREVIEW', {
      ...material, geometryParts, ports, nodes,
      boundaryDiagnosisFingerprint: diagnosis.diagnosisFingerprint,
    }),
  }, 'Sequential rotation draft');
  return state.preview;
}
function clearRotation(state, reason = 'cancelled') {
  assertLive(state); state.preview = null; return state.store.clear(String(reason || 'cancelled'));
}
function destroyRotation(state) {
  if (state.destroyed) return false;
  state.destroyed = true; state.preview = null; state.store.dispose(); return true;
}
export function createSequentialRotationDraftStore() {
  const state = { store: createEngineeringSvgDraftStore(), preview: null, destroyed: false };
  return Object.freeze({
    schema: 'SequentialRotationDraftStore.v1',
    stage: (input) => stageRotation(state, input),
    cancel: (reason) => clearRotation(state, reason),
    getDraft() { assertLive(state); return state.store.getSnapshot(); },
    getPreview() { assertLive(state); return state.preview; },
    destroy: () => destroyRotation(state),
  });
}
export function composeSequentialRotationDraftScene(scene, draft) {
  return draft?.operationId
    ? composeEngineeringSvgDraftScene(scene, draft, 'original-and-draft')
    : scene;
}
export const _test = Object.freeze({ disposition, noChange, rotatedParts, rotatedPositions });
