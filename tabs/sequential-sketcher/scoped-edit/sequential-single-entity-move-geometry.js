/** Pure constraint, translation and boundary diagnosis for SSK-TS-3L. */
import { immutableJson } from '../../../contracts/contract-values.js';
import { translateEngineeringGeometry } from '../../../core/engineering-svg/engineering-svg-precision-geometry.js';

export const SEQUENTIAL_MOVE_CONSTRAINT_SCHEMA = 'SequentialMoveConstraint.v1';
export const SEQUENTIAL_MOVE_BOUNDARY_DIAGNOSIS_SCHEMA =
  'SequentialMoveBoundaryDiagnosis.v1';

const AXES = Object.freeze({
  X: Object.freeze({ x: 1, y: 0, z: 0 }),
  Y: Object.freeze({ x: 0, y: 1, z: 0 }),
  Z: Object.freeze({ x: 0, y: 0, z: 1 }),
});
const PLANES = Object.freeze({
  XY: Object.freeze({ normal: AXES.Z, axes: ['X', 'Y'] }),
  XZ: Object.freeze({ normal: AXES.Y, axes: ['X', 'Z'] }),
  YZ: Object.freeze({ normal: AXES.X, axes: ['Y', 'Z'] }),
});

function vector(value, label) {
  const result = Object.fromEntries(['x', 'y', 'z'].map((axis) => {
    const raw = value?.[axis];
    if (raw == null || (typeof raw === 'string' && !raw.trim())) {
      throw new TypeError(`${label} ${axis.toUpperCase()} is required.`);
    }
    const number = Number(raw);
    if (!Number.isFinite(number)) throw new TypeError(`${label} ${axis.toUpperCase()} must be finite.`);
    return [axis, number];
  }));
  return result;
}
function add(left, right) {
  return { x: left.x + right.x, y: left.y + right.y, z: left.z + right.z };
}
function subtract(left, right) {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
}
function scale(value, amount) {
  return { x: value.x * amount, y: value.y * amount, z: value.z * amount };
}
function dot(left, right) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}
function pointList(geometry) {
  if (geometry?.kind === 'point') return [geometry.position];
  if (geometry?.kind === 'segment') return [geometry.start, geometry.end];
  if (geometry?.kind === 'polyline') return geometry.points || [];
  throw new TypeError(`Unsupported move-preview geometry kind "${geometry?.kind}".`);
}

export function createSequentialMoveConstraint(input = 'XY') {
  const token = typeof input === 'string'
    ? input.trim().toUpperCase()
    : String(input.axis || input.plane || input.axes?.join('') || '').toUpperCase();
  if (AXES[token]) return immutableJson({
    schema: SEQUENTIAL_MOVE_CONSTRAINT_SCHEMA, kind: 'axis', axis: token,
  }, 'Sequential move constraint');
  if (PLANES[token]) return immutableJson({
    schema: SEQUENTIAL_MOVE_CONSTRAINT_SCHEMA, kind: 'plane', plane: token,
    axes: PLANES[token].axes,
  }, 'Sequential move constraint');
  throw new TypeError('Move constraint must be X, Y, Z, XY, XZ or YZ.');
}

export function constrainSequentialMoveDelta(input, constraintInput) {
  const delta = vector(input, 'Move delta');
  const constraint = createSequentialMoveConstraint(constraintInput);
  const allowed = new Set(constraint.kind === 'axis' ? [constraint.axis] : constraint.axes);
  const constrained = Object.fromEntries(['X', 'Y', 'Z'].map((axis) => [
    axis.toLowerCase(), allowed.has(axis) ? delta[axis.toLowerCase()] : 0,
  ]));
  return immutableJson({
    ...constrained,
    magnitude: Math.hypot(constrained.x, constrained.y, constrained.z),
  }, 'Sequential constrained move delta');
}

export function sequentialMovePivot(geometryParts) {
  const points = geometryParts.flatMap((row) => pointList(row.geometry)).map((row) => vector(row, 'Geometry point'));
  if (!points.length) throw new RangeError('Move-preview target has no geometry points.');
  const total = points.reduce((sum, point) => add(sum, point), { x: 0, y: 0, z: 0 });
  return immutableJson(scale(total, 1 / points.length), 'Sequential move pivot');
}

function ray(value, label) {
  return { origin: vector(value?.origin, `${label} origin`), direction: vector(value?.direction, `${label} direction`) };
}
function intersectPlane(rayValue, pivot, normal) {
  const denominator = dot(rayValue.direction, normal);
  if (Math.abs(denominator) < 1e-12) throw new RangeError('Pointer ray is parallel to the selected move plane.');
  const amount = dot(subtract(pivot, rayValue.origin), normal) / denominator;
  return add(rayValue.origin, scale(rayValue.direction, amount));
}
function axisParameter(rayValue, pivot, axis) {
  const w0 = subtract(pivot, rayValue.origin);
  const b = dot(axis, rayValue.direction);
  const denominator = 1 - (b * b);
  if (Math.abs(denominator) < 1e-12) throw new RangeError('Pointer ray is parallel to the selected move axis.');
  return ((b * dot(rayValue.direction, w0)) - dot(axis, w0)) / denominator;
}

export function solveSequentialMoveDrag(input = {}) {
  const constraint = createSequentialMoveConstraint(input.constraint);
  const pivot = vector(input.pivot, 'Move pivot');
  const start = ray(input.startRay, 'Start ray');
  const current = ray(input.currentRay, 'Current ray');
  let rawDelta;
  if (constraint.kind === 'axis') {
    const axis = AXES[constraint.axis];
    rawDelta = scale(axis,
      axisParameter(current, pivot, axis) - axisParameter(start, pivot, axis));
  } else {
    const normal = PLANES[constraint.plane].normal;
    rawDelta = subtract(intersectPlane(current, pivot, normal), intersectPlane(start, pivot, normal));
  }
  return immutableJson({
    constraint,
    delta: constrainSequentialMoveDelta(rawDelta, constraint),
  }, 'Sequential pointer move solution');
}

export function translateSequentialMoveGeometry(geometryParts, deltaInput) {
  const delta = vector(deltaInput, 'Geometry translation delta');
  return geometryParts.map((part) => ({
    geometryPartId: part.geometryPartId,
    role: part.role,
    originalGeometry: part.geometry,
    draftGeometry: translateEngineeringGeometry(part.geometry, delta),
  }));
}

function diagnosticRow(cut, delta) {
  if (!cut.selectedPosition || !cut.stationaryPosition) {
    throw new RangeError(`Boundary cut position evidence is incomplete: ${cut.boundaryCutId}`);
  }
  const translated = add(cut.selectedPosition, delta);
  const separation = subtract(translated, cut.stationaryPosition);
  const gap = Math.hypot(separation.x, separation.y, separation.z);
  const disposition = cut.nodeRelation === 'REPAIR_MEDIATED_CONTINUITY'
    ? 'REPAIR_BOUNDARY_LOCKED' : gap === 0 ? 'PRESERVED' : 'WOULD_DISCONNECT';
  return {
    boundaryCutId: cut.boundaryCutId,
    connectionId: cut.connectionId,
    selectedPortId: cut.selectedPortId,
    stationaryPortId: cut.stationaryPortId,
    stationaryComponentId: cut.stationaryComponentId,
    originalSelectedPosition: cut.selectedPosition,
    translatedSelectedPosition: translated,
    stationaryPosition: cut.stationaryPosition,
    separation: { ...separation, magnitude: gap },
    disposition,
  };
}

export function diagnoseSequentialMoveBoundaries(target, deltaInput) {
  const delta = vector(deltaInput, 'Boundary diagnosis delta');
  const rows = target.boundaryCuts.map((cut) => diagnosticRow(cut, delta));
  const aggregateDisposition = rows.some((row) => row.disposition === 'REPAIR_BOUNDARY_LOCKED')
    ? 'REPAIR_BOUNDARY_LOCKED'
    : rows.some((row) => row.disposition === 'WOULD_DISCONNECT')
      ? 'WOULD_DISCONNECT' : 'PRESERVED';
  return immutableJson({
    schema: SEQUENTIAL_MOVE_BOUNDARY_DIAGNOSIS_SCHEMA,
    aggregateDisposition,
    boundaryCount: rows.length,
    rows,
  }, 'Sequential move boundary diagnosis');
}
