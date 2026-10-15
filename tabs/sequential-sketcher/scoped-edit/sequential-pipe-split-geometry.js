/** Pure exact straight-segment split location and geometry qualification. */
import { sequentialSemanticFingerprint } from './sequential-command-contracts.js';

export const SEQUENTIAL_PIPE_SPLIT_LOCATION_SCHEMA = 'SequentialPipeSplitLocation.v1';
export const SEQUENTIAL_PIPE_SPLIT_GEOMETRY_REJECTION = Object.freeze({
  SEGMENT_INVALID: 'SEQUENTIAL_PIPE_SPLIT_SEGMENT_INVALID',
  LOCATION_INVALID: 'SEQUENTIAL_PIPE_SPLIT_LOCATION_INVALID',
  END_DISTANCE: 'SEQUENTIAL_PIPE_SPLIT_END_DISTANCE',
  PROJECTION_MISS: 'SEQUENTIAL_PIPE_SPLIT_PROJECTION_MISS',
});

function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}
function finite(value, label) {
  if (value == null || (typeof value === 'string' && !value.trim())) {
    fail(SEQUENTIAL_PIPE_SPLIT_GEOMETRY_REJECTION.LOCATION_INVALID,
      `${label} must be finite.`, TypeError);
  }
  const number = Number(value);
  if (!Number.isFinite(number)) fail(SEQUENTIAL_PIPE_SPLIT_GEOMETRY_REJECTION.LOCATION_INVALID,
    `${label} must be finite.`, TypeError);
  return number;
}
function point(value, label) {
  const valid = value && ['x', 'y', 'z'].every((axis) => (
    value[axis] != null && !(typeof value[axis] === 'string' && !value[axis].trim())
      && Number.isFinite(Number(value[axis]))
  ));
  if (!valid) fail(SEQUENTIAL_PIPE_SPLIT_GEOMETRY_REJECTION.LOCATION_INVALID,
    `${label} must contain finite X/Y/Z coordinates.`, TypeError);
  return { x: Number(value.x), y: Number(value.y), z: Number(value.z) };
}
function vector(left, right) {
  return { x: right.x - left.x, y: right.y - left.y, z: right.z - left.z };
}
function dot(left, right) { return left.x * right.x + left.y * right.y + left.z * right.z; }
function magnitude(value) { return Math.hypot(value.x, value.y, value.z); }
function interpolate(start, end, t) {
  return { x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
    z: start.z + (end.z - start.z) * t };
}
function segmentRecord(geometry) {
  if (geometry?.kind !== 'segment') fail(SEQUENTIAL_PIPE_SPLIT_GEOMETRY_REJECTION.SEGMENT_INVALID,
    'Pipe split requires one segment geometry.', TypeError);
  const start = point(geometry.start, 'segment start');
  const end = point(geometry.end, 'segment end');
  const length = magnitude(vector(start, end));
  if (!(length > 0)) fail(SEQUENTIAL_PIPE_SPLIT_GEOMETRY_REJECTION.SEGMENT_INVALID,
    'Pipe split segment must have non-zero length.');
  return { geometry, start, end, length };
}
function projectPoint(segment, acquiredPoint) {
  const candidate = point(acquiredPoint, 'acquired point');
  const direction = vector(segment.start, segment.end);
  const offset = vector(segment.start, candidate);
  const t = dot(offset, direction) / dot(direction, direction);
  const projected = interpolate(segment.start, segment.end, t);
  return { t, projected, residual: magnitude(vector(projected, candidate)), candidate };
}
function locationInput(input, segment) {
  const mode = String(input.mode || 'PARAMETER').trim().toUpperCase();
  if (mode === 'ACQUIRED_POINT') {
    const result = projectPoint(segment, input.acquiredPoint);
    const tolerance = finite(input.projectionTolerance ?? 1e-6, 'projection tolerance');
    if (tolerance < 0 || result.residual > tolerance) {
      fail(SEQUENTIAL_PIPE_SPLIT_GEOMETRY_REJECTION.PROJECTION_MISS,
        `Acquired point residual ${result.residual} exceeds tolerance ${tolerance}.`);
    }
    return { mode, parameter: result.t, acquiredPoint: result.candidate,
      projectionResidual: result.residual, projectionTolerance: tolerance };
  }
  if (mode !== 'PARAMETER') fail(SEQUENTIAL_PIPE_SPLIT_GEOMETRY_REJECTION.LOCATION_INVALID,
    `Unsupported split location mode: ${mode}`, TypeError);
  return { mode, parameter: finite(input.parameter, 'split parameter'),
    acquiredPoint: null, projectionResidual: 0,
    projectionTolerance: finite(input.projectionTolerance ?? 1e-6, 'projection tolerance') };
}
function minimumCheck(parameter, segment, minimumEndDistance) {
  const minimum = finite(minimumEndDistance ?? 1, 'minimum end distance');
  if (minimum < 0 || parameter <= 0 || parameter >= 1) {
    fail(SEQUENTIAL_PIPE_SPLIT_GEOMETRY_REJECTION.END_DISTANCE,
      'Split parameter must lie strictly inside the parent segment.');
  }
  const upstream = segment.length * parameter;
  const downstream = segment.length * (1 - parameter);
  if (upstream < minimum || downstream < minimum) {
    fail(SEQUENTIAL_PIPE_SPLIT_GEOMETRY_REJECTION.END_DISTANCE,
      `Split violates minimum end distance ${minimum}.`);
  }
  return { minimum, upstream, downstream };
}
export function createSequentialPipeSplitLocation(input = {}) {
  const segment = segmentRecord(input.geometry);
  const raw = locationInput(input, segment);
  const lengths = minimumCheck(raw.parameter, segment, input.minimumEndDistance);
  const position = interpolate(segment.start, segment.end, raw.parameter);
  const material = { schema: SEQUENTIAL_PIPE_SPLIT_LOCATION_SCHEMA,
    mode: raw.mode, parameter: raw.parameter, position,
    acquiredPoint: raw.acquiredPoint, projectionResidual: raw.projectionResidual,
    projectionTolerance: raw.projectionTolerance, minimumEndDistance: lengths.minimum,
    parentLength: segment.length, upstreamLength: lengths.upstream,
    downstreamLength: lengths.downstream };
  return Object.freeze({ ...material,
    locationFingerprint: sequentialSemanticFingerprint('SSK3QSPLITLOCATION', material) });
}
export function createSequentialPipeSplitGeometry(input = {}) {
  const location = createSequentialPipeSplitLocation(input);
  const parent = segmentRecord(input.geometry);
  return Object.freeze({ location,
    upstream: Object.freeze({ ...parent.geometry, start: parent.start, end: location.position }),
    downstream: Object.freeze({ ...parent.geometry, start: location.position, end: parent.end }) });
}
export const _test = Object.freeze({ interpolate, projectPoint, segmentRecord });
