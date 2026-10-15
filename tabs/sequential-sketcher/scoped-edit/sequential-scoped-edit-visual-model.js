/** Pure EngineeringScene.v1 to VisualGeometryModel.v2 projection for Sequential Draft Edit 3D. */
import { createVisualGeometryModelV2 } from '../../../contracts/visual-geometry-model.js';
import { validateEngineeringScene } from '../../../core/engineering-scene/engineering-contract-validation.js';
import { composeSequentialSupportMoveDraftScene } from './sequential-draft-edit-support-move-draft.js';
import { composeSequentialNodeStretchDraftScene } from './sequential-node-stretch-draft.js';
import { composeSequentialPipeSplitDraftScene } from './sequential-pipe-split-draft.js';
import { composeSequentialRotationDraftScene } from './sequential-rotation-draft.js';
import { composeSequentialSingleEntityMoveDraftScene } from './sequential-single-entity-move-draft.js';
import { assertSequentialScopedEditReadModel } from './sequential-scoped-edit-read-model.js';
import { assertSequentialScopedEditSceneAncestry } from './sequential-scoped-edit-scene-adapter.js';

export const SEQUENTIAL_SCOPED_EDIT_VISUAL_MODEL_V1 = 'SequentialScopedEditVisualModel.v1';

const CATEGORY_STYLE = Object.freeze({
  confirmed: Object.freeze({ colorInt: 0x64748b, radiusMm: 12, markerKind: 'NODE' }),
  repair: Object.freeze({ colorInt: 0xf59e0b, radiusMm: 7, markerKind: 'NODE' }),
  candidate: Object.freeze({ colorInt: 0x60a5fa, radiusMm: 5, markerKind: 'NODE' }),
  reversalCandidate: Object.freeze({ colorInt: 0xa78bfa, radiusMm: 6, markerKind: 'ISSUE_BADGE' }),
  support: Object.freeze({ colorInt: 0x22d3ee, radiusMm: 8, markerKind: 'SUPPORT' }),
  activePort: Object.freeze({ colorInt: 0x22c55e, radiusMm: 7, markerKind: 'NODE' }),
  rejectedCandidate: Object.freeze({ colorInt: 0xef4444, radiusMm: 4, markerKind: 'ISSUE_BADGE' }),
});
const OVERLAY_STYLE = Object.freeze({
  ghost: Object.freeze({ colorInt: 0x94a3b8, radiusMm: 7, markerKind: 'NODE' }),
  draft: Object.freeze({ colorInt: 0xfacc15, radiusMm: 10, markerKind: 'NODE' }),
});
function xyz(point) {
  return [point?.x, point?.y, point?.z].every(Number.isFinite)
    ? [point.x, point.y, point.z] : null;
}
function category(entity) {
  return String(entity.domainRef?.category || entity.metadata?.sequential?.category || '').trim();
}
function overlayType(entity) {
  return String(entity.metadata?.engineeringSvgOverlay?.type || '').trim();
}
function componentKind(entity) {
  const value = entity.metadata?.sequential?.component?.canonicalType;
  const kind = String(value || '').trim().toUpperCase();
  const aliases = { ELBO: 'ELBOW', BEND: 'ELBOW', REDU: 'REDUCER', FLAN: 'FLANGE', VALV: 'VALVE' };
  const normalized = aliases[kind] || kind;
  if (['PIPE', 'VALVE', 'FLANGE', 'GASK', 'INST', 'ELBOW', 'TEE', 'OLET', 'REDUCER'].includes(normalized)) {
    return normalized;
  }
  return 'PIPE';
}
function style(entity) {
  const overlay = OVERLAY_STYLE[overlayType(entity)];
  if (overlay && category(entity) === 'support') return { ...overlay, markerKind: 'SUPPORT' };
  return overlay || CATEGORY_STYLE[category(entity)] || CATEGORY_STYLE.confirmed;
}
function segmentRecord(entity, start, end, suffix = '0') {
  const visual = style(entity);
  return {
    primitiveId: `ssk3d:segment:${entity.id}:${suffix}`,
    objectId: entity.id, start, end, radiusMm: visual.radiusMm,
    kind: componentKind(entity), colorInt: visual.colorInt,
    pathId: String(entity.domainRef?.componentId || entity.domainRef?.connectionId || ''),
  };
}
function segments(entity) {
  const geometry = entity.geometry;
  if (geometry?.kind === 'segment') {
    const start = xyz(geometry.start); const end = xyz(geometry.end);
    return start && end ? [segmentRecord(entity, start, end)] : [];
  }
  if (geometry?.kind !== 'polyline') return [];
  const points = (geometry.points || []).map(xyz).filter(Boolean);
  return points.slice(1).map((end, index) => segmentRecord(entity, points[index], end, String(index)));
}
function overlayLabel(entity, overlay, entityCategory) {
  if (overlay === 'ghost') return entityCategory === 'support' ? 'ORIGINAL SUPPORT' : 'ORIGINAL COMPONENT';
  if (overlay === 'draft') return entityCategory === 'support' ? 'DRAFT SUPPORT' : 'DRAFT COMPONENT';
  if (entityCategory === 'rejectedCandidate') return 'REJECTED';
  if (entityCategory === 'reversalCandidate') return 'REVERSE ENTRY';
  return null;
}
function marker(entity) {
  if (entity.geometry?.kind !== 'point') return null;
  const position = xyz(entity.geometry.position);
  if (!position) return null;
  const visual = style(entity); const entityCategory = category(entity);
  const overlay = overlayType(entity); const label = overlayLabel(entity, overlay, entityCategory);
  return {
    primitiveId: `ssk3d:marker:${entity.id}`, objectId: entity.id, nodeId: entity.id,
    kind: visual.markerKind, position,
    sizeMm: overlay === 'draft' ? 34 : overlay === 'ghost' ? 24
      : entityCategory === 'support' ? 28 : entityCategory === 'reversalCandidate' ? 26 : 22,
    colorInt: visual.colorInt, ...(label ? { label } : {}), isObjectMarker: true,
  };
}
function bounds(segmentsInput, markersInput) {
  const points = [
    ...segmentsInput.flatMap((row) => [row.start, row.end]),
    ...markersInput.map((row) => row.position),
  ];
  const values = points.length ? points : [[0, 0, 0], [1, 1, 1]];
  return {
    min: [0, 1, 2].map((axis) => Math.min(...values.map((point) => point[axis]))),
    max: [0, 1, 2].map((axis) => Math.max(...values.map((point) => point[axis]))),
  };
}
function composedScene(authoritative, input) {
  const support = composeSequentialSupportMoveDraftScene(authoritative, input.draft);
  const move = composeSequentialSingleEntityMoveDraftScene(support, input.moveDraft);
  const stretch = composeSequentialNodeStretchDraftScene(move, input.nodeStretchDraft);
  const rotation = composeSequentialRotationDraftScene(stretch, input.rotationDraft);
  return composeSequentialPipeSplitDraftScene(rotation, input.splitDraft);
}
function combinedDraftId(input) {
  return [input.draft?.operationId, input.moveDraft?.operationId,
    input.nodeStretchDraft?.operationId, input.rotationDraft?.operationId,
    input.splitDraft?.operationId].filter(Boolean).join(':') || null;
}
export function createSequentialScopedEditVisualModel(input = {}) {
  const readModel = assertSequentialScopedEditReadModel(input.readModel);
  const authoritative = assertSequentialScopedEditSceneAncestry(
    validateEngineeringScene(input.scene), readModel,
  );
  const scene = composedScene(authoritative, input);
  const visible = scene.entities.filter((entity) => entity.visible !== false);
  const fitVisible = visible.filter((entity) => category(entity) !== 'reversalCandidate');
  const segmentRows = visible.flatMap(segments); const markerRows = visible.map(marker).filter(Boolean);
  const fitSegments = fitVisible.flatMap(segments); const fitMarkers = fitVisible.map(marker).filter(Boolean);
  const draftId = combinedDraftId(input);
  return createVisualGeometryModelV2({
    modelId: `sequential-draft-edit:${readModel.authorityId}${draftId ? `:${draftId}` : ''}`,
    documentId: `sequential-document:${readModel.branchId}`,
    revisionId: draftId ? `${readModel.authorityId}:${draftId}` : readModel.authorityId,
    unit: scene.coordinateSystem.unit, coordinateFrame: scene.coordinateSystem.frame,
    verticalAxis: scene.coordinateSystem.verticalAxis, origin: [0, 0, 0],
    segments: segmentRows, markers: markerRows, bounds: bounds(fitSegments, fitMarkers),
  });
}
export const _test = Object.freeze({
  xyz, category, overlayType, componentKind, style, segments, marker, bounds,
});
