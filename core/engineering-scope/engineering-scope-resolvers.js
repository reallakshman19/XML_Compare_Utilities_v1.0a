import { ENGINEERING_SCENE_SCHEMA } from '../engineering-scene/engineering-scene-contracts.js';
import {
  ENGINEERING_SCOPE_KIND,
  ENGINEERING_SCOPE_SECTION_KIND,
  createEngineeringScope,
  createEngineeringScopeRequest,
} from './engineering-scope-contracts.js';

const AXIS_KEY = Object.freeze({ X: 'x', Y: 'y', Z: 'z' });

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} resolver is required.`);
  return value;
}

function sceneIndex(scene) {
  if (scene?.schema !== ENGINEERING_SCENE_SCHEMA || !Array.isArray(scene.entities)) {
    throw new TypeError(`scene must use schema "${ENGINEERING_SCENE_SCHEMA}".`);
  }
  const entries = scene.entities.map((entity) => [entity?.id, entity]);
  if (entries.some(([id]) => typeof id !== 'string' || !id.trim())) throw new TypeError('Scene entity ids must be non-empty strings.');
  if (new Set(entries.map(([id]) => id)).size !== entries.length) throw new TypeError('Scene entity ids must be unique.');
  return new Map(entries.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
}

function normalizedIds(values, label) {
  if (!Array.isArray(values)) throw new TypeError(`${label} must return an array of ids.`);
  const ids = values.map((value, index) => {
    if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label}[${index}] must be a non-empty string.`);
    return value.trim();
  });
  return [...new Set(ids)].sort();
}

function existingIds(ids, index, label) {
  for (const id of ids) {
    if (!index.has(id)) throw new RangeError(`${label} declared missing scene entity "${id}".`);
  }
  return ids;
}

function finitePoint(value, label) {
  if (!value || typeof value !== 'object') throw new TypeError(`${label} must be a point object.`);
  const result = {};
  for (const axis of ['x', 'y', 'z']) {
    if (typeof value[axis] !== 'number' || !Number.isFinite(value[axis])) throw new TypeError(`${label}.${axis} must be finite.`);
    result[axis] = value[axis];
  }
  return result;
}

function normalizedBounds(value, label) {
  if (value == null) return null;
  const min = finitePoint(value.min, `${label}.min`);
  const max = finitePoint(value.max, `${label}.max`);
  for (const axis of ['x', 'y', 'z']) {
    if (min[axis] > max[axis]) throw new TypeError(`${label}.min.${axis} must not exceed max.${axis}.`);
  }
  return { min, max };
}

function intersectsBox(bounds, section) {
  return ['x', 'y', 'z'].every((axis) => bounds.max[axis] >= section.min[axis] && bounds.min[axis] <= section.max[axis]);
}

function intersectsSlab(bounds, section) {
  const axis = AXIS_KEY[section.axis];
  return bounds.max[axis] >= section.min && bounds.min[axis] <= section.max;
}

function intersectsRadius(bounds, section) {
  let distanceSquared = 0;
  for (const axis of ['x', 'y', 'z']) {
    const coordinate = section.center[axis];
    const nearest = Math.max(bounds.min[axis], Math.min(coordinate, bounds.max[axis]));
    distanceSquared += (coordinate - nearest) ** 2;
  }
  return distanceSquared <= section.radius ** 2;
}

function intersectsSection(bounds, section) {
  if (section.kind === ENGINEERING_SCOPE_SECTION_KIND.BOX) return intersectsBox(bounds, section);
  if (section.kind === ENGINEERING_SCOPE_SECTION_KIND.SLAB) return intersectsSlab(bounds, section);
  return intersectsRadius(bounds, section);
}

function structuralSeeds(scene, request, resolver, index) {
  const ids = normalizedIds(requiredFunction(resolver, 'resolveStructural')(scene, request.structural), 'resolveStructural');
  return existingIds(ids, index, 'resolveStructural');
}

function sectionalSeeds(request, boundsOf, index) {
  const reader = requiredFunction(boundsOf, 'boundsOf');
  const ids = [];
  for (const [id, entity] of index) {
    const bounds = normalizedBounds(reader(entity), `boundsOf(${id})`);
    if (bounds && intersectsSection(bounds, request.sectional)) ids.push(id);
  }
  return ids;
}

function resolveSeeds(scene, request, extensions, index) {
  if (request.kind === ENGINEERING_SCOPE_KIND.STRUCTURAL) {
    return structuralSeeds(scene, request, extensions.resolveStructural, index);
  }
  if (request.kind === ENGINEERING_SCOPE_KIND.SELECTION) {
    return existingIds(request.selection.entityIds, index, 'selection');
  }
  return sectionalSeeds(request, extensions.boundsOf, index);
}

function readReferences(entity, referencesOf, index) {
  const ids = normalizedIds(referencesOf(entity), `referencesOf(${entity.id})`);
  return existingIds(ids, index, `referencesOf(${entity.id})`);
}

function expandEditable(seedIds, depth, referencesOf, index) {
  const editable = new Set(seedIds);
  let frontier = [...seedIds];
  for (let level = 0; level < depth && frontier.length; level += 1) {
    const next = new Set();
    for (const id of frontier.sort()) {
      for (const ref of readReferences(index.get(id), referencesOf, index)) {
        if (!editable.has(ref)) next.add(ref);
      }
    }
    frontier = [...next].sort();
    frontier.forEach((id) => editable.add(id));
  }
  return editable;
}

function closeMounted(editable, referencesOf, index, budget) {
  const mounted = new Set(editable);
  const boundary = new Set();
  const queue = [...editable].sort();
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    for (const ref of readReferences(index.get(queue[cursor]), referencesOf, index)) {
      if (mounted.has(ref)) continue;
      mounted.add(ref);
      boundary.add(ref);
      queue.push(ref);
      if (mounted.size > budget) throw new RangeError(`Resolved scope exceeds elementBudget ${budget}.`);
    }
  }
  return [...boundary].sort();
}

function stats(entityIds, boundaryIds, budget) {
  const mounted = entityIds.length + boundaryIds.length;
  return { matched: entityIds.length, boundary: boundaryIds.length, mounted, budget, consumed: mounted, remaining: budget - mounted };
}

export function resolveEngineeringScope(scene, input, extensions = {}) {
  const request = createEngineeringScopeRequest(input);
  const index = sceneIndex(scene);
  const referencesOf = requiredFunction(extensions.referencesOf, 'referencesOf');
  const seeds = resolveSeeds(scene, request, extensions, index);
  if (seeds.length === 0) throw new RangeError('Engineering scope resolution must not be empty.');
  const depth = request.kind === ENGINEERING_SCOPE_KIND.SELECTION ? request.selection.closureDepth : 0;
  const editable = expandEditable(seeds, depth, referencesOf, index);
  if (editable.size > request.elementBudget) throw new RangeError(`Resolved scope exceeds elementBudget ${request.elementBudget}.`);
  const entityIds = [...editable].sort();
  const boundaryIds = closeMounted(editable, referencesOf, index, request.elementBudget);
  return createEngineeringScope({
    schema: 'EngineeringScope.v1', request, kind: request.kind,
    boundaryPolicy: request.boundaryPolicy, elementBudget: request.elementBudget,
    entityIds, boundaryIds, stats: stats(entityIds, boundaryIds, request.elementBudget),
  });
}
