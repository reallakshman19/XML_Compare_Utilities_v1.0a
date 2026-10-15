/** Canonical explicit-axis rigid rotation math and boundary diagnosis for Sequential edits. */
import { immutableJson } from '../../../contracts/contract-values.js';
import { sequentialSemanticFingerprint } from './sequential-command-contracts.js';

export const SEQUENTIAL_ROTATION_PROFILE_SCHEMA = 'SequentialRotationProfile.v1';
export const SEQUENTIAL_ROTATION_TRANSFORM_SCHEMA = 'SequentialRotationTransform.v1';
export const SEQUENTIAL_ROTATION_BOUNDARY_DIAGNOSIS_SCHEMA =
  'SequentialRotationBoundaryDiagnosis.v1';
export const SEQUENTIAL_ROTATION_REJECTION = Object.freeze({
  INPUT_INVALID: 'SEQUENTIAL_ROTATION_INPUT_INVALID',
  AXIS_INVALID: 'SEQUENTIAL_ROTATION_AXIS_INVALID',
  ANGLE_NO_CHANGE: 'SEQUENTIAL_ROTATION_ANGLE_NO_CHANGE',
  GEOMETRY_UNSUPPORTED: 'SEQUENTIAL_ROTATION_GEOMETRY_UNSUPPORTED',
});

const AXES = Object.freeze(['x', 'y', 'z']);

function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}
function finite(value, label) {
  if (value == null || String(value).trim() === '') fail(SEQUENTIAL_ROTATION_REJECTION.INPUT_INVALID,
    `${label} is required.`, TypeError);
  const number = Number(value);
  if (!Number.isFinite(number)) fail(SEQUENTIAL_ROTATION_REJECTION.INPUT_INVALID,
    `${label} must be finite.`, TypeError);
  return number;
}
function clean(value, digits) {
  const number = Number(value.toFixed(digits));
  return Object.is(number, -0) ? 0 : number;
}
function finitePoint(value, label) {
  return Object.fromEntries(AXES.map((axis) => [
    axis, finite(value?.[axis], `${label} ${axis}`),
  ]));
}
function profileMaterial(input = {}) {
  const precisionDigits = Number(input.precisionDigits ?? 12);
  const boundaryTolerance = finite(input.boundaryTolerance ?? 1e-9, 'Boundary tolerance');
  if (!Number.isInteger(precisionDigits) || precisionDigits < 0 || precisionDigits > 15
    || boundaryTolerance < 0) {
    fail(SEQUENTIAL_ROTATION_REJECTION.INPUT_INVALID,
      'Rotation profile precision must be 0-15 and tolerance must be non-negative.', TypeError);
  }
  return { precisionDigits, boundaryTolerance };
}
export function createSequentialRotationProfile(input = {}) {
  const material = profileMaterial(input);
  return immutableJson({
    schema: SEQUENTIAL_ROTATION_PROFILE_SCHEMA,
    ...material,
    profileFingerprint: sequentialSemanticFingerprint('SSK3PROTATIONPROFILE', material),
  }, 'Sequential rotation profile');
}
function canonicalAngle(value) {
  const raw = finite(value, 'Rotation angle');
  const wrapped = ((raw + 180) % 360 + 360) % 360 - 180;
  const angle = Object.is(wrapped, -0) ? 0 : wrapped;
  if (angle === 0) fail(SEQUENTIAL_ROTATION_REJECTION.ANGLE_NO_CHANGE,
    'Rotation angle must not be equivalent to zero degrees.');
  return angle;
}
function unitAxis(value, digits) {
  const axis = finitePoint(value, 'Rotation axis');
  const length = Math.hypot(axis.x, axis.y, axis.z);
  if (!(length > 0)) fail(SEQUENTIAL_ROTATION_REJECTION.AXIS_INVALID,
    'Rotation axis must have non-zero length.');
  const normalized = Object.fromEntries(AXES.map((key) => [
    key, clean(axis[key] / length, digits),
  ]));
  const renormalizedLength = Math.hypot(normalized.x, normalized.y, normalized.z);
  if (!(renormalizedLength > 0)) fail(SEQUENTIAL_ROTATION_REJECTION.AXIS_INVALID,
    'Rotation axis loses direction at the selected precision.');
  return Object.fromEntries(AXES.map((key) => [
    key, clean(normalized[key] / renormalizedLength, digits),
  ]));
}
export function createSequentialRotationTransform(input = {}) {
  const profile = createSequentialRotationProfile(input.profile);
  const pivot = finitePoint(input.pivot, 'Rotation pivot');
  const axis = unitAxis(input.axis, profile.precisionDigits);
  const angleDegrees = canonicalAngle(input.angleDegrees);
  const angleRadians = clean(angleDegrees * Math.PI / 180, 15);
  const material = { pivot, axis, angleDegrees, angleRadians, profile };
  return immutableJson({
    schema: SEQUENTIAL_ROTATION_TRANSFORM_SCHEMA,
    ...material,
    transformFingerprint: sequentialSemanticFingerprint('SSK3PROTATIONTRANSFORM', material),
  }, 'Sequential rotation transform');
}
function vector(point, pivot) {
  return { x: point.x - pivot.x, y: point.y - pivot.y, z: point.z - pivot.z };
}
function cross(axis, value) {
  return {
    x: axis.y * value.z - axis.z * value.y,
    y: axis.z * value.x - axis.x * value.z,
    z: axis.x * value.y - axis.y * value.x,
  };
}
function dot(left, right) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}
export function rotateSequentialPoint(pointInput, transformInput) {
  const transform = transformInput?.schema === SEQUENTIAL_ROTATION_TRANSFORM_SCHEMA
    ? transformInput : createSequentialRotationTransform(transformInput);
  const point = finitePoint(pointInput, 'Rotation point');
  const value = vector(point, transform.pivot);
  const cosine = Math.cos(transform.angleRadians);
  const sine = Math.sin(transform.angleRadians);
  const axial = dot(transform.axis, value) * (1 - cosine);
  const perpendicular = cross(transform.axis, value);
  const rotated = {
    x: value.x * cosine + perpendicular.x * sine + transform.axis.x * axial,
    y: value.y * cosine + perpendicular.y * sine + transform.axis.y * axial,
    z: value.z * cosine + perpendicular.z * sine + transform.axis.z * axial,
  };
  return Object.fromEntries(AXES.map((axis) => [
    axis, clean(rotated[axis] + transform.pivot[axis], transform.profile.precisionDigits),
  ]));
}
function geometryPoints(geometry) {
  if (geometry?.kind === 'point') return [geometry.position];
  if (geometry?.kind === 'segment') return [geometry.start, geometry.end];
  if (geometry?.kind === 'polyline' && geometry.points?.length) return geometry.points;
  fail(SEQUENTIAL_ROTATION_REJECTION.GEOMETRY_UNSUPPORTED,
    `Unsupported rotation geometry: ${geometry?.kind || 'missing'}`, TypeError);
}
function geometryFromPoints(geometry, points) {
  if (geometry.kind === 'point') return { ...geometry, position: points[0] };
  if (geometry.kind === 'segment') return { ...geometry, start: points[0], end: points[1] };
  return { ...geometry, points };
}
export function rotateSequentialGeometry(geometry, transform) {
  return geometryFromPoints(geometry,
    geometryPoints(geometry).map((point) => rotateSequentialPoint(point, transform)));
}
function separation(rotated, stationary) {
  const vectorValue = {
    x: rotated.x - stationary.x,
    y: rotated.y - stationary.y,
    z: rotated.z - stationary.z,
  };
  return { vector: vectorValue, magnitude: Math.hypot(vectorValue.x, vectorValue.y, vectorValue.z) };
}
function boundaryRow(row, transform) {
  const selectedPosition = finitePoint(row.selectedPosition, 'Selected boundary position');
  const stationaryPosition = finitePoint(row.stationaryPosition, 'Stationary boundary position');
  const rotatedPosition = rotateSequentialPoint(selectedPosition, transform);
  const gap = separation(rotatedPosition, stationaryPosition);
  return {
    boundaryId: String(row.boundaryId),
    connectionId: row.connectionId == null ? null : String(row.connectionId),
    selectedPortId: String(row.selectedPortId),
    stationaryPortId: String(row.stationaryPortId),
    selectedPosition, rotatedPosition, stationaryPosition,
    separationVector: gap.vector, separationMagnitude: gap.magnitude,
    disposition: gap.magnitude <= transform.profile.boundaryTolerance
      ? 'PRESERVED' : 'WOULD_DISCONNECT',
  };
}
export function createSequentialRotationBoundaryDiagnosis(boundaries = [], transformInput) {
  const transform = transformInput?.schema === SEQUENTIAL_ROTATION_TRANSFORM_SCHEMA
    ? transformInput : createSequentialRotationTransform(transformInput);
  const rows = [...boundaries].sort((left, right) => (
    String(left.boundaryId).localeCompare(String(right.boundaryId))
  )).map((row) => boundaryRow(row, transform));
  const material = {
    transformFingerprint: transform.transformFingerprint,
    boundaries: rows,
    aggregateDisposition: rows.some((row) => row.disposition === 'WOULD_DISCONNECT')
      ? 'WOULD_DISCONNECT' : 'PRESERVED',
  };
  return immutableJson({
    schema: SEQUENTIAL_ROTATION_BOUNDARY_DIAGNOSIS_SCHEMA,
    ...material,
    diagnosisFingerprint: sequentialSemanticFingerprint('SSK3PROTATIONBOUNDARY', material),
  }, 'Sequential rotation boundary diagnosis');
}
export const _test = Object.freeze({ canonicalAngle, geometryPoints, geometryFromPoints, unitAxis });
