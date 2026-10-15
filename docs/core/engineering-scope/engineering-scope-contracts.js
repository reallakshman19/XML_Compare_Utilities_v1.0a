import { freezeJsonValue, isPlainObject } from '../engineering-scene/engineering-json-value.js';

export const ENGINEERING_SCOPE_REQUEST_SCHEMA = 'EngineeringScopeRequest.v1';
export const ENGINEERING_SCOPE_SCHEMA = 'EngineeringScope.v1';
export const ENGINEERING_SCOPE_KIND = Object.freeze({
  STRUCTURAL: 'STRUCTURAL',
  SELECTION: 'SELECTION',
  SECTIONAL: 'SECTIONAL',
});
export const ENGINEERING_SCOPE_BOUNDARY_POLICY = Object.freeze({
  FROZEN: 'FROZEN',
  GHOSTED: 'GHOSTED',
  PROPAGATE: 'PROPAGATE',
});
export const ENGINEERING_SCOPE_SECTION_KIND = Object.freeze({
  BOX: 'box',
  SLAB: 'slab',
  RADIUS: 'radius',
});

const KIND_VALUES = Object.freeze(Object.values(ENGINEERING_SCOPE_KIND));
const POLICY_VALUES = Object.freeze(Object.values(ENGINEERING_SCOPE_BOUNDARY_POLICY));
const SECTION_VALUES = Object.freeze(Object.values(ENGINEERING_SCOPE_SECTION_KIND));

function requiredText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} is required.`);
  return value.trim();
}

function enumValue(value, allowed, label) {
  const result = requiredText(value, label);
  if (!allowed.includes(result)) throw new TypeError(`Unsupported ${label} "${result}".`);
  return result;
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${label} must be a positive integer.`);
  return value;
}

function nonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${label} must be a non-negative integer.`);
  return value;
}

function finiteNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${label} must be a finite number.`);
  return value;
}

function uniqueSortedTexts(values, label, allowEmpty = false) {
  if (!Array.isArray(values)) throw new TypeError(`${label} must be an array.`);
  const result = values.map((value, index) => requiredText(value, `${label}[${index}]`));
  if (!allowEmpty && result.length === 0) throw new TypeError(`${label} must not be empty.`);
  if (new Set(result).size !== result.length) throw new TypeError(`${label} must contain unique values.`);
  return result.sort();
}

function point3(input, label) {
  if (!isPlainObject(input)) throw new TypeError(`${label} must be a plain object.`);
  return {
    x: finiteNumber(input.x, `${label}.x`),
    y: finiteNumber(input.y, `${label}.y`),
    z: finiteNumber(input.z, `${label}.z`),
  };
}

function structuralMaterial(input) {
  if (!isPlainObject(input)) throw new TypeError('structural must be a plain object.');
  return { identifiers: uniqueSortedTexts(input.identifiers, 'structural.identifiers') };
}

function selectionMaterial(input) {
  if (!isPlainObject(input)) throw new TypeError('selection must be a plain object.');
  return {
    entityIds: uniqueSortedTexts(input.entityIds, 'selection.entityIds'),
    closureDepth: nonNegativeInteger(input.closureDepth ?? 0, 'selection.closureDepth'),
  };
}

function boxSection(input) {
  const min = point3(input.min, 'sectional.min');
  const max = point3(input.max, 'sectional.max');
  for (const axis of ['x', 'y', 'z']) {
    if (min[axis] > max[axis]) throw new TypeError(`sectional.min.${axis} must not exceed sectional.max.${axis}.`);
  }
  return { kind: ENGINEERING_SCOPE_SECTION_KIND.BOX, min, max };
}

function slabSection(input) {
  const axis = enumValue(input.axis, ['X', 'Y', 'Z'], 'sectional.axis');
  const min = finiteNumber(input.min, 'sectional.min');
  const max = finiteNumber(input.max, 'sectional.max');
  if (min > max) throw new TypeError('sectional.min must not exceed sectional.max.');
  return { kind: ENGINEERING_SCOPE_SECTION_KIND.SLAB, axis, min, max };
}

function radiusSection(input) {
  const radius = finiteNumber(input.radius, 'sectional.radius');
  if (radius < 0) throw new TypeError('sectional.radius must be non-negative.');
  return { kind: ENGINEERING_SCOPE_SECTION_KIND.RADIUS, center: point3(input.center, 'sectional.center'), radius };
}

function sectionalMaterial(input) {
  if (!isPlainObject(input)) throw new TypeError('sectional must be a plain object.');
  const kind = enumValue(input.kind, SECTION_VALUES, 'sectional kind');
  if (kind === ENGINEERING_SCOPE_SECTION_KIND.BOX) return boxSection(input);
  if (kind === ENGINEERING_SCOPE_SECTION_KIND.SLAB) return slabSection(input);
  return radiusSection(input);
}

function requestMaterial(kind, input) {
  if (kind === ENGINEERING_SCOPE_KIND.STRUCTURAL) return { structural: structuralMaterial(input.structural) };
  if (kind === ENGINEERING_SCOPE_KIND.SELECTION) return { selection: selectionMaterial(input.selection) };
  return { sectional: sectionalMaterial(input.sectional) };
}

export function createEngineeringScopeRequest(input = {}) {
  if (input.schema !== ENGINEERING_SCOPE_REQUEST_SCHEMA) {
    throw new TypeError(`Scope request schema must be "${ENGINEERING_SCOPE_REQUEST_SCHEMA}".`);
  }
  const kind = enumValue(input.kind, KIND_VALUES, 'scope kind');
  const boundaryPolicy = enumValue(input.boundaryPolicy, POLICY_VALUES, 'boundary policy');
  const elementBudget = positiveInteger(input.elementBudget, 'elementBudget');
  return freezeJsonValue({
    schema: ENGINEERING_SCOPE_REQUEST_SCHEMA,
    kind,
    boundaryPolicy,
    elementBudget,
    ...requestMaterial(kind, input),
  });
}

export function assertEngineeringScopeRequest(value) {
  return createEngineeringScopeRequest(value);
}

function assertSortedUnique(ids, label, allowEmpty) {
  const result = uniqueSortedTexts(ids, label, allowEmpty);
  if (JSON.stringify(result) !== JSON.stringify(ids)) throw new TypeError(`${label} must be deterministically sorted.`);
  return result;
}

function scopeStats(input, matched, boundary, budget) {
  if (!isPlainObject(input)) throw new TypeError('Scope stats must be a plain object.');
  const mounted = matched + boundary;
  const expected = { matched, boundary, mounted, budget, consumed: mounted, remaining: budget - mounted };
  for (const [name, value] of Object.entries(expected)) {
    if (input[name] !== value) throw new TypeError(`Scope stats.${name} must equal ${value}.`);
  }
  return expected;
}

export function createEngineeringScope(input = {}) {
  if (input.schema !== ENGINEERING_SCOPE_SCHEMA) {
    throw new TypeError(`Scope schema must be "${ENGINEERING_SCOPE_SCHEMA}".`);
  }
  const request = createEngineeringScopeRequest(input.request);
  if (input.kind !== request.kind) throw new TypeError('Scope kind must match request kind.');
  if (input.boundaryPolicy !== request.boundaryPolicy) throw new TypeError('Scope boundaryPolicy must match request policy.');
  if (input.elementBudget !== request.elementBudget) throw new TypeError('Scope elementBudget must match request budget.');
  const entityIds = assertSortedUnique(input.entityIds, 'entityIds', false);
  const boundaryIds = assertSortedUnique(input.boundaryIds, 'boundaryIds', true);
  if (boundaryIds.some((id) => entityIds.includes(id))) throw new TypeError('Scope entityIds and boundaryIds must be disjoint.');
  if (entityIds.length + boundaryIds.length > request.elementBudget) throw new RangeError('Resolved scope exceeds elementBudget.');
  return freezeJsonValue({
    schema: ENGINEERING_SCOPE_SCHEMA,
    request,
    kind: request.kind,
    boundaryPolicy: request.boundaryPolicy,
    elementBudget: request.elementBudget,
    entityIds,
    boundaryIds,
    stats: scopeStats(input.stats, entityIds.length, boundaryIds.length, request.elementBudget),
  });
}

export function assertEngineeringScope(value) {
  return createEngineeringScope(value);
}
