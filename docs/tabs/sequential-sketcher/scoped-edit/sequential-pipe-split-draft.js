/** Immutable non-publishing preview for one exact straight-pipe split. */
import { createEngineeringScene } from '../../../core/engineering-scene/index.js';
import { immutableJson } from '../../../contracts/contract-values.js';
import { sequentialSemanticFingerprint } from './sequential-command-contracts.js';
import { createSequentialPipeSplitGeometry } from './sequential-pipe-split-geometry.js';
import { createSequentialPipeSplitIdentities } from './sequential-pipe-split-identities.js';
import { SEQUENTIAL_PIPE_SPLIT_TARGET_SCHEMA } from './sequential-pipe-split-target.js';

export const SEQUENTIAL_PIPE_SPLIT_DRAFT_SCHEMA = 'SequentialPipeSplitDraft.v1';

function assertTarget(value) {
  if (value?.schema !== SEQUENTIAL_PIPE_SPLIT_TARGET_SCHEMA) {
    throw new TypeError(`Pipe split target must use ${SEQUENTIAL_PIPE_SPLIT_TARGET_SCHEMA}.`);
  }
  return value;
}
function operationMaterial(target, split) {
  return { splitTargetId: target.splitTargetId,
    parameter: split.location.parameter,
    locationFingerprint: split.location.locationFingerprint };
}
function childPart(identity, componentId, geometry, role) {
  return Object.freeze({ geometryPartId: identity, componentId, role, geometry });
}
function stagePreview(state, input = {}) {
  if (state.destroyed) throw new Error('Pipe split draft store is destroyed.');
  const target = assertTarget(input.target);
  const split = createSequentialPipeSplitGeometry({ geometry: target.geometry,
    mode: input.mode, parameter: input.parameter, acquiredPoint: input.acquiredPoint,
    minimumEndDistance: input.minimumEndDistance,
    projectionTolerance: input.projectionTolerance });
  const material = operationMaterial(target, split);
  const operationId = String(input.operationId || '').trim()
    || sequentialSemanticFingerprint('SSK3QSPLITOPERATION', material);
  const identities = createSequentialPipeSplitIdentities({
    parentComponentId: target.parentComponentId,
    parentGeometryPartId: target.parentGeometryPartId,
    operationId, parameter: split.location.parameter,
  });
  const children = Object.freeze([
    childPart(identities.upstreamGeometryPartId, identities.upstreamComponentId,
      split.upstream, 'upstream'),
    childPart(identities.downstreamGeometryPartId, identities.downstreamComponentId,
      split.downstream, 'downstream'),
  ]);
  state.preview = immutableJson({ schema: SEQUENTIAL_PIPE_SPLIT_DRAFT_SCHEMA,
    operationId, target, location: split.location, identities, children,
    splitPosition: split.location.position,
    publicationState: 'NOT_PUBLISHED',
    previewDisposition: 'PREVIEW_ONLY_PIPE_SPLIT',
    draftFingerprint: sequentialSemanticFingerprint('SSK3QSPLITPREVIEW', {
      ...material, identities, children,
    }) }, 'Sequential pipe split draft');
  return state.preview;
}
function overlayEntity(parent, id, componentId, geometry, type) {
  return { ...parent, id, geometry, domainRef: { ...parent.domainRef, componentId,
    geometryRole: type }, metadata: { ...parent.metadata,
    engineeringSvgOverlay: { type: 'draft', operation: 'SPLIT_PIPE' },
    sequential: { ...parent.metadata?.sequential,
      component: { ...parent.metadata?.sequential?.component,
        componentId, canonicalType: 'PIPE' } } } };
}
export function composeSequentialPipeSplitDraftScene(scene, draft) {
  if (draft?.schema !== SEQUENTIAL_PIPE_SPLIT_DRAFT_SCHEMA) return scene;
  const parentId = draft.target.parentGeometryPartId;
  const parent = scene.entities.find((row) => row.id === parentId);
  if (!parent) throw new RangeError(`Split preview parent scene entity is missing: ${parentId}`);
  const entities = scene.entities.map((row) => row.id === parentId
    ? { ...row, metadata: { ...row.metadata,
      engineeringSvgOverlay: { type: 'ghost', operation: 'SPLIT_PIPE' } } }
    : row);
  draft.children.forEach((child) => entities.push(overlayEntity(parent,
    `ssk:split-preview:${child.geometryPartId}`, child.componentId, child.geometry, child.role)));
  return createEngineeringScene({ ...scene, entities });
}
export function createSequentialPipeSplitDraftStore() {
  const state = { preview: null, destroyed: false };
  return Object.freeze({ schema: 'SequentialPipeSplitDraftStore.v1',
    stage: (input) => stagePreview(state, input),
    cancel() { if (state.destroyed) return false; state.preview = null; return true; },
    getDraft() { if (state.destroyed) throw new Error('Pipe split draft store is destroyed.');
      return state.preview; },
    destroy() { if (state.destroyed) return false; state.destroyed = true;
      state.preview = null; return true; } });
}
