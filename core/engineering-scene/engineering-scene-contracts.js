import { freezeJsonValue, isPlainObject } from './engineering-json-value.js';
import { createEngineeringCoordinateSystem } from './engineering-geometry-contracts.js';
import { assertEngineeringRevisionToken } from './engineering-revision-contracts.js';

export const ENGINEERING_SCENE_SCHEMA = 'EngineeringScene.v1';
export const ENGINEERING_SCENE_ENTITY_SCHEMA = 'EngineeringSceneEntity.v1';
export const ENGINEERING_SCENE_PROJECTION = Object.freeze(['ISO', 'XY', 'XZ', 'YZ']);

function text(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${label} is required.`);
  return result;
}

function uniqueTexts(values, label) {
  if (!Array.isArray(values)) throw new TypeError(`${label} must be an array.`);
  const result = values.map((value, index) => text(value, `${label}[${index}]`));
  if (new Set(result).size !== result.length) throw new TypeError(`${label} must contain unique values.`);
  return result;
}

function finiteOrDefault(value, fallback, label) {
  if (value == null) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${label} must be a finite number.`);
  return value;
}

export function createEngineeringSceneEntity(input = {}) {
  if (!isPlainObject(input.domainRef)) throw new TypeError('Scene entity domainRef must be a plain object.');
  return freezeJsonValue({
    schema: ENGINEERING_SCENE_ENTITY_SCHEMA,
    id: text(input.id, 'Scene entity id'),
    kind: text(input.kind, 'Scene entity kind'),
    domainType: text(input.domainType ?? input.kind, 'Scene entity domainType'),
    geometry: input.geometry ?? null,
    domainRef: input.domainRef,
    propertySetIds: uniqueTexts(input.propertySetIds || [], 'propertySetIds'),
    editCapabilities: uniqueTexts(input.editCapabilities || [], 'editCapabilities'),
    layer: text(input.layer ?? 'authoritative', 'Scene entity layer'),
    renderOrder: finiteOrDefault(input.renderOrder, 0, 'Scene entity renderOrder'),
    visible: input.visible !== false,
    selectable: input.selectable !== false,
    contributesToFit: input.contributesToFit !== false,
    metadata: input.metadata ?? {},
  });
}

export function createEngineeringScene(input = {}) {
  const revision = assertEngineeringRevisionToken(input.revision);
  const projections = uniqueTexts(input.projections || ENGINEERING_SCENE_PROJECTION, 'projections');
  if (!Array.isArray(input.entities)) throw new TypeError('Engineering scene entities must be an array.');
  projections.forEach((projection) => {
    if (!ENGINEERING_SCENE_PROJECTION.includes(projection)) throw new TypeError(`Unsupported scene projection "${projection}".`);
  });
  const entities = input.entities.map((entity) => createEngineeringSceneEntity(entity));
  const ids = entities.map((entity) => entity.id);
  if (new Set(ids).size !== ids.length) throw new TypeError('Engineering scene entity ids must be globally unique.');
  return freezeJsonValue({
    schema: ENGINEERING_SCENE_SCHEMA,
    sceneId: text(input.sceneId, 'Engineering scene id'),
    revision,
    coordinateSystem: createEngineeringCoordinateSystem(input.coordinateSystem),
    entities,
    projections,
    capabilities: input.capabilities ?? {},
    metadata: input.metadata ?? {},
  });
}
