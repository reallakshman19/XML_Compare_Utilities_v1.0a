/** Immutable Revision Compare visual-model projection into EngineeringScene.v1. */
import {
  createEngineeringRevisionToken,
  createEngineeringScene,
  createPointGeometry,
  createSegmentGeometry,
  freezeJsonValue,
} from '../../core/engineering-scene/index.js';

export const REVISION_COMPARE_SVG_PROJECTION_SCHEMA = 'RevisionCompareEngineeringSvgProjection.v1';

function requiredText(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${label} is required.`);
  return result;
}

function point(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((item) => !Number.isFinite(item))) {
    throw new TypeError(`${label} must be three finite coordinates.`);
  }
  return { x: value[0], y: value[1], z: value[2] };
}

function omission(side, objectId, primitive, reason) {
  return freezeJsonValue({ side, objectId: objectId ?? null, primitive, reason });
}

function entityMetadata(side, model, objectId, primitive, status) {
  return {
    revisionCompare: {
      side,
      objectId,
      primitive,
      modelId: model.modelId,
      documentId: model.documentId ?? null,
      revisionId: model.revisionId ?? null,
      status: status ?? null,
    },
  };
}

function sceneEntity(input) {
  return {
    id: input.objectId,
    kind: input.primitive,
    domainType: input.primitive === 'segment' ? 'RevisionCompareVisualSegment' : 'RevisionCompareVisualMarker',
    geometry: input.geometry,
    domainRef: {
      owner: 'revision-compare',
      side: input.side,
      objectId: input.objectId,
      modelId: input.model.modelId,
    },
    propertySetIds: [],
    editCapabilities: [],
    layer: input.side === 'A' ? 'ghost' : 'authoritative',
    renderOrder: input.side === 'A' ? 10 : 20,
    metadata: entityMetadata(input.side, input.model, input.objectId, input.primitive, input.status),
  };
}

function appendSegment(output, primitive, side, model, status, omissions) {
  try {
    const objectId = requiredText(primitive?.objectId, `${side} segment objectId`);
    output.push(sceneEntity({
      objectId, side, model, status: status[objectId], primitive: 'segment',
      geometry: createSegmentGeometry(point(primitive.start, `${objectId}.start`), point(primitive.end, `${objectId}.end`)),
    }));
  } catch (error) {
    omissions.push(omission(side, primitive?.objectId, 'segment', error.message));
  }
}

function appendMarker(output, primitive, side, model, status, omissions) {
  try {
    const objectId = requiredText(primitive?.objectId, `${side} marker objectId`);
    output.push(sceneEntity({
      objectId, side, model, status: status[objectId], primitive: 'point',
      geometry: createPointGeometry(point(primitive.position, `${objectId}.position`)),
    }));
  } catch (error) {
    omissions.push(omission(side, primitive?.objectId, 'point', error.message));
  }
}

function appendModel(output, model, side, status, omissions) {
  if (!model || typeof model !== 'object') throw new TypeError(`Revision Compare visual model ${side} is required.`);
  for (const segment of model.segments ?? []) appendSegment(output, segment, side, model, status, omissions);
  for (const marker of model.markers ?? []) appendMarker(output, marker, side, model, status, omissions);
}

function assertUniqueIds(entities) {
  const seen = new Set();
  for (const entity of entities) {
    if (seen.has(entity.id)) throw new TypeError(`Revision Compare visual object ID "${entity.id}" is not globally unique.`);
    seen.add(entity.id);
  }
}

function identity(models) {
  return freezeJsonValue({
    sourceModelId: requiredText(models.source.modelId, 'Source modelId'),
    sourceRevisionId: models.source.revisionId ?? null,
    targetModelId: requiredText(models.target.modelId, 'Target modelId'),
    targetRevisionId: models.target.revisionId ?? null,
  });
}

export function createRevisionCompareEngineeringSvgScene(input = {}) {
  const models = input.models ?? input;
  const status = input.statusByObjectId ?? {};
  const entities = [];
  const omissions = [];
  appendModel(entities, models.source, 'A', status, omissions);
  appendModel(entities, models.target, 'B', status, omissions);
  assertUniqueIds(entities);
  const sceneIdentity = identity(models);
  const target = models.target;
  const source = models.source;
  const scene = createEngineeringScene({
    sceneId: `revision-compare:${sceneIdentity.sourceModelId}:${sceneIdentity.targetModelId}`,
    revision: createEngineeringRevisionToken(sceneIdentity),
    coordinateSystem: {
      unit: target.unit ?? source.unit ?? 'mm',
      frame: target.coordinateFrame ?? source.coordinateFrame ?? 'GLOBAL',
      verticalAxis: target.verticalAxis ?? source.verticalAxis ?? 'Z',
      handedness: 'right',
    },
    entities,
    capabilities: { selectable: true, editable: false, overlay: true },
    metadata: { owner: 'revision-compare', sceneIdentity },
  });
  return freezeJsonValue({ schema: REVISION_COMPARE_SVG_PROJECTION_SCHEMA, scene, omissions });
}

export function revisionCompareSvgSceneCompatibilityKey(scene) {
  if (!scene?.sceneId || !scene?.revision) return null;
  return `${scene.sceneId}:${JSON.stringify(scene.revision)}`;
}

function paneEntity(entity, visibleSide) {
  if (entity.domainRef.side === visibleSide) return entity;
  return {
    ...entity,
    selectable: false,
    metadata: {
      ...entity.metadata,
      revisionCompare: { ...entity.metadata.revisionCompare, hiddenFitAuthority: true, visiblePaneSide: visibleSide },
    },
  };
}

export function createRevisionCompareSvgPaneScene(scene, visibleSide) {
  const side = visibleSide === 'A' ? 'A' : 'B';
  return createEngineeringScene({
    ...scene,
    sceneId: `${scene.sceneId}:pane:${side}`,
    entities: scene.entities.map((entity) => paneEntity(entity, side)),
    metadata: { ...scene.metadata, presentationPane: side },
  });
}

export function createRevisionCompareSvgFitScene(scene, selectedIds = null) {
  const selected = selectedIds?.length ? new Set(selectedIds) : null;
  return createEngineeringScene({
    ...scene,
    entities: scene.entities.map((entity) => ({
      ...entity,
      contributesToFit: selected ? selected.has(entity.id) : true,
    })),
    metadata: {
      ...scene.metadata,
      presentationFit: selected ? { scope: 'selection', entityIds: [...selected].sort() } : { scope: 'all' },
    },
  });
}
