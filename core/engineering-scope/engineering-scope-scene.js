import { validateEngineeringScene } from '../engineering-scene/engineering-contract-validation.js';
import { freezeJsonValue } from '../engineering-scene/engineering-json-value.js';
import { assertEngineeringScope } from './engineering-scope-contracts.js';

export const SCOPED_ENGINEERING_SCENE_SCHEMA = 'ScopedEngineeringScene.v1';
export const SCOPED_ENGINEERING_SCENE_ROLE = Object.freeze({ EDITABLE: 'EDITABLE', BOUNDARY: 'BOUNDARY' });

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} is required.`);
  return value;
}

function isDeeplyFrozen(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  if (!Object.isFrozen(value)) return false;
  seen.add(value);
  return Object.values(value).every((child) => isDeeplyFrozen(child, seen));
}

function sceneIndex(scene) {
  validateEngineeringScene(scene);
  if (!isDeeplyFrozen(scene)) throw new TypeError('scene must be deeply immutable.');
  return new Map(scene.entities.map((entity) => [entity.id, entity]));
}

function frozenMount(scope) {
  return Object.freeze({
    boundaryPolicy: scope.boundaryPolicy,
    elementBudget: scope.elementBudget,
    entityIds: scope.entityIds,
    boundaryIds: scope.boundaryIds,
  });
}

function frozenRoles(ids, editable) {
  const entries = ids.map((id) => [id, editable.has(id)
    ? SCOPED_ENGINEERING_SCENE_ROLE.EDITABLE
    : SCOPED_ENGINEERING_SCENE_ROLE.BOUNDARY]);
  return Object.freeze(Object.fromEntries(entries));
}

export function scopeScene(scene, inputScope) {
  const scope = assertEngineeringScope(inputScope);
  const index = sceneIndex(scene);
  const mountedIds = [...scope.entityIds, ...scope.boundaryIds].sort();
  const missing = mountedIds.filter((id) => !index.has(id));
  if (missing.length) throw new RangeError(`Scope declares missing scene ids: ${missing.join(', ')}.`);
  const entities = Object.freeze(mountedIds.map((id) => index.get(id)));
  return Object.freeze({
    schema: SCOPED_ENGINEERING_SCENE_SCHEMA,
    authoritative: false,
    authority: 'DERIVED_SCOPE_VIEW',
    sourceSceneSchema: scene.schema,
    sceneId: scene.sceneId,
    revision: scene.revision,
    coordinateSystem: scene.coordinateSystem,
    entities,
    projections: scene.projections,
    capabilities: scene.capabilities,
    metadata: scene.metadata,
    scope: frozenMount(scope),
    entityRoles: frozenRoles(mountedIds, new Set(scope.entityIds)),
  });
}

function normalizedReferences(values, label) {
  if (!Array.isArray(values)) throw new TypeError(`${label} must return an array of ids.`);
  const ids = values.map((value, index) => {
    if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label}[${index}] must be a non-empty string.`);
    return value.trim();
  });
  return [...new Set(ids)].sort();
}

export function validateScopeClosure(scopedScene, extensions = {}) {
  if (scopedScene?.schema !== SCOPED_ENGINEERING_SCENE_SCHEMA || !Array.isArray(scopedScene.entities)) {
    throw new TypeError(`scopedScene must use schema "${SCOPED_ENGINEERING_SCENE_SCHEMA}".`);
  }
  const referencesOf = requiredFunction(extensions.referencesOf, 'referencesOf');
  const mounted = new Set(scopedScene.entities.map((entity) => entity.id));
  const missingByEntity = [];
  for (const entity of [...scopedScene.entities].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)) {
    const missingIds = normalizedReferences(referencesOf(entity), `referencesOf(${entity.id})`)
      .filter((id) => !mounted.has(id));
    if (missingIds.length) missingByEntity.push({ entityId: entity.id, missingIds });
  }
  const missingIds = [...new Set(missingByEntity.flatMap((entry) => entry.missingIds))].sort();
  return freezeJsonValue({ closed: missingIds.length === 0, missingIds, missingByEntity });
}
