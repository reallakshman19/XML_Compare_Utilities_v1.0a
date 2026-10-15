/** Pure geometry regeneration and qualification for one certified topology node stretch. */
import { immutableJson } from '../../../contracts/contract-values.js';
import { sequentialSemanticFingerprint } from './sequential-command-contracts.js';

export const SEQUENTIAL_NODE_STRETCH_PROFILE_SCHEMA = 'SequentialNodeStretchProfile.v1';
export const SEQUENTIAL_NODE_STRETCH_GEOMETRY_REJECTION = Object.freeze({
  PROFILE_INVALID: 'SEQUENTIAL_NODE_STRETCH_PROFILE_INVALID',
  GEOMETRY_UNSUPPORTED: 'SEQUENTIAL_NODE_STRETCH_GEOMETRY_UNSUPPORTED',
  BINDING_INVALID: 'SEQUENTIAL_NODE_STRETCH_BINDING_INVALID',
  ZERO_LENGTH: 'SEQUENTIAL_NODE_STRETCH_ZERO_LENGTH',
  MINIMUM_LENGTH: 'SEQUENTIAL_NODE_STRETCH_MINIMUM_LENGTH',
  COLLINEARITY: 'SEQUENTIAL_NODE_STRETCH_COLLINEARITY',
});

const AXES = Object.freeze(['x', 'y', 'z']);

function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}
function finite(value, label, minimum = -Infinity) {
  const explicit = value !== null && value !== undefined && String(value).trim() !== '';
  const number = Number(value);
  if (!explicit || !Number.isFinite(number) || number < minimum) {
    fail(SEQUENTIAL_NODE_STRETCH_GEOMETRY_REJECTION.PROFILE_INVALID,
      `${label} must be finite and at least ${minimum}.`, TypeError);
  }
  return number;
}
export function sequentialNodeStretchPoint(value, label = 'Node point') {
  return Object.fromEntries(AXES.map((axis) => [axis, finite(value?.[axis], `${label} ${axis}`)]));
}
export function createSequentialNodeStretchProfile(input = {}) {
  const material = {
    minimumLengthMm: finite(input.minimumLengthMm ?? 1, 'Minimum length', Number.MIN_VALUE),
    zeroLengthToleranceMm: finite(input.zeroLengthToleranceMm ?? 1e-9,
      'Zero-length tolerance', 0),
    collinearityTolerance: finite(input.collinearityTolerance ?? 1e-9,
      'Collinearity tolerance', 0),
  };
  if (material.zeroLengthToleranceMm >= material.minimumLengthMm) {
    fail(SEQUENTIAL_NODE_STRETCH_GEOMETRY_REJECTION.PROFILE_INVALID,
      'Zero-length tolerance must be smaller than minimum length.', TypeError);
  }
  return immutableJson({
    schema: SEQUENTIAL_NODE_STRETCH_PROFILE_SCHEMA,
    ...material,
    profileFingerprint: sequentialSemanticFingerprint('SSK3OSTRETCHPROFILE', material),
  }, 'Sequential node stretch profile');
}
function pointList(geometry) {
  if (geometry?.kind === 'point') return [geometry.position];
  if (geometry?.kind === 'segment') return [geometry.start, geometry.end];
  if (geometry?.kind === 'polyline') return geometry.points || [];
  fail(SEQUENTIAL_NODE_STRETCH_GEOMETRY_REJECTION.GEOMETRY_UNSUPPORTED,
    `Unsupported stretch geometry kind: ${geometry?.kind || 'missing'}`, TypeError);
}
function geometryFromPoints(geometry, points) {
  if (geometry.kind === 'point') return { ...geometry, position: points[0] };
  if (geometry.kind === 'segment') return { ...geometry, start: points[0], end: points[1] };
  return { ...geometry, points };
}
function subtract(left, right) {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
}
function length(vector) {
  return Math.hypot(vector.x, vector.y, vector.z);
}
function segmentLength(left, right) { return length(subtract(right, left)); }
function crossLength(left, right) {
  return Math.hypot(
    left.y * right.z - left.z * right.y,
    left.z * right.x - left.x * right.z,
    left.x * right.y - left.y * right.x,
  );
}
function collinear(left, middle, right, tolerance) {
  const first = subtract(middle, left); const second = subtract(right, middle);
  const scale = Math.max(length(first) * length(second), 1);
  return crossLength(first, second) <= tolerance * scale;
}
function validateBindings(part, points) {
  const nodeIds = part.nodeIds || [];
  if (nodeIds.length !== points.length || !nodeIds.some((id) => id === part.nodeId)) {
    fail(SEQUENTIAL_NODE_STRETCH_GEOMETRY_REJECTION.BINDING_INVALID,
      `Geometry/node binding is incomplete: ${part.geometryPartId}`);
  }
  return nodeIds;
}
function replaceNodePoint(part, targetPoint) {
  const original = pointList(part.geometry).map((point) => sequentialNodeStretchPoint(point));
  const nodeIds = validateBindings(part, original);
  const points = original.map((point, index) => (
    nodeIds[index] === part.nodeId ? targetPoint : point
  ));
  return { original, points, geometry: geometryFromPoints(part.geometry, points) };
}
function segmentDiagnostics(part, points, profile) {
  return points.slice(1).map((point, index) => {
    const value = segmentLength(points[index], point);
    if (value <= profile.zeroLengthToleranceMm) {
      fail(SEQUENTIAL_NODE_STRETCH_GEOMETRY_REJECTION.ZERO_LENGTH,
        `Stretch would create a zero-length segment: ${part.geometryPartId}:${index}`);
    }
    if (value < profile.minimumLengthMm) {
      fail(SEQUENTIAL_NODE_STRETCH_GEOMETRY_REJECTION.MINIMUM_LENGTH,
        `Stretch segment is below minimum length: ${part.geometryPartId}:${index}`);
    }
    return { segmentIndex: index, lengthMm: value };
  });
}
function validatePipeCollinearity(part, original, points, profile) {
  if (part.canonicalType !== 'PIPE' || points.length < 3) return [];
  const changed = points.map((point, index) => (
    point.x !== original[index].x || point.y !== original[index].y || point.z !== original[index].z
  ));
  const diagnostics = [];
  changed.forEach((isChanged, index) => {
    if (!isChanged || index === 0 || index === points.length - 1) return;
    const wasStraight = collinear(original[index - 1], original[index], original[index + 1],
      profile.collinearityTolerance);
    const remainsStraight = collinear(points[index - 1], points[index], points[index + 1],
      profile.collinearityTolerance);
    if (wasStraight && !remainsStraight) {
      fail(SEQUENTIAL_NODE_STRETCH_GEOMETRY_REJECTION.COLLINEARITY,
        `Stretch would kink a straight pipe: ${part.geometryPartId}:${index}`);
    }
    diagnostics.push({ vertexIndex: index, wasStraight, remainsStraight });
  });
  return diagnostics;
}
export function regenerateSequentialNodeStretchPart(partInput, targetPointInput, profileInput = {}) {
  const profile = createSequentialNodeStretchProfile(profileInput);
  const targetPoint = sequentialNodeStretchPoint(targetPointInput, 'Stretch target');
  const part = { ...partInput, nodeId: String(partInput.nodeId || '').trim() };
  const changed = replaceNodePoint(part, targetPoint);
  const segments = segmentDiagnostics(part, changed.points, profile);
  const collinearity = validatePipeCollinearity(
    part, changed.original, changed.points, profile,
  );
  return immutableJson({
    geometryPartId: String(part.geometryPartId),
    componentId: String(part.componentId),
    canonicalType: String(part.canonicalType || '').toUpperCase(),
    nodeId: part.nodeId,
    nodeIds: part.nodeIds,
    originalGeometry: part.geometry,
    draftGeometry: changed.geometry,
    segmentDiagnostics: segments,
    collinearityDiagnostics: collinearity,
  }, 'Sequential node stretch part');
}
export function createSequentialNodeStretchGeometry(input = {}) {
  const profile = createSequentialNodeStretchProfile(input.profile);
  const originalPosition = sequentialNodeStretchPoint(input.originalPosition, 'Original node');
  const targetPosition = sequentialNodeStretchPoint(input.targetPosition, 'Target node');
  const delta = subtract(targetPosition, originalPosition);
  const geometryParts = (input.geometryParts || []).map((part) => (
    regenerateSequentialNodeStretchPart({ ...part, nodeId: input.nodeId }, targetPosition, profile)
  ));
  if (!geometryParts.length) {
    fail(SEQUENTIAL_NODE_STRETCH_GEOMETRY_REJECTION.BINDING_INVALID,
      'Stretch target requires at least one bound geometry part.');
  }
  return immutableJson({
    profile,
    originalPosition,
    targetPosition,
    delta: { ...delta, magnitude: length(delta) },
    geometryParts,
    noChange: length(delta) === 0,
  }, 'Sequential node stretch geometry');
}

export const _test = Object.freeze({ pointList, geometryFromPoints, collinear, segmentLength });
