/** Qualified active-plane intersections for explicit Sequential move snap evidence. */
import { immutableJson } from '../../../contracts/contract-values.js';
import {
  SEQUENTIAL_MOVE_SNAP_MODE,
  SEQUENTIAL_MOVE_SNAP_REJECTION,
  createSequentialMoveSnapProfile,
  normalizeSequentialSnapNumber,
  normalizeSequentialSnapPoint,
  sequentialMoveSnapCandidateId,
} from './sequential-move-snap-contracts.js';
import { createSequentialMoveConstraint } from './sequential-single-entity-move-geometry.js';

const PLANE_AXES = Object.freeze({
  XY: Object.freeze({ axes: ['x', 'y'], omitted: 'z' }),
  XZ: Object.freeze({ axes: ['x', 'z'], omitted: 'y' }),
  YZ: Object.freeze({ axes: ['y', 'z'], omitted: 'x' }),
});

function pairCount(length) { return length * (length - 1) / 2; }

function failEnvelope(count, profile) {
  if (count <= profile.maxIntersectionPairs) return;
  const error = new RangeError(
    `Snap intersection pair envelope exceeded: ${count} > ${profile.maxIntersectionPairs}.`,
  );
  error.code = SEQUENTIAL_MOVE_SNAP_REJECTION.INTERSECTION_ENVELOPE;
  throw error;
}

function planeRecord(constraintInput) {
  const constraint = createSequentialMoveConstraint(constraintInput);
  return constraint.kind === 'plane' ? { constraint, ...PLANE_AXES[constraint.plane] } : null;
}

function coplanar(segment, omitted, tolerance) {
  return Math.abs(segment.start[omitted] - segment.end[omitted]) <= tolerance;
}

function samePlane(left, right, omitted, tolerance) {
  return coplanar(left, omitted, tolerance)
    && coplanar(right, omitted, tolerance)
    && Math.abs(left.start[omitted] - right.start[omitted]) <= tolerance;
}

function projectedIntersection(left, right, axes, tolerance) {
  const [u, v] = axes;
  const ax = left.end[u] - left.start[u];
  const ay = left.end[v] - left.start[v];
  const bx = right.end[u] - right.start[u];
  const by = right.end[v] - right.start[v];
  const offsetX = right.start[u] - left.start[u];
  const offsetY = right.start[v] - left.start[v];
  const determinant = ax * by - ay * bx;
  if (Math.abs(determinant) <= tolerance) return null;
  const leftParameter = (offsetX * by - offsetY * bx) / determinant;
  const rightParameter = (offsetX * ay - offsetY * ax) / determinant;
  if (leftParameter < -tolerance || leftParameter > 1 + tolerance
    || rightParameter < -tolerance || rightParameter > 1 + tolerance) return null;
  return { leftParameter, rightParameter };
}

function intersectionPoint(segment, parameter, profile) {
  return normalizeSequentialSnapPoint(Object.fromEntries(['x', 'y', 'z'].map((axis) => [
    axis, segment.start[axis] + parameter * (segment.end[axis] - segment.start[axis]),
  ])), profile);
}

function effectivePoint(source, raw, axes, profile) {
  const point = { ...raw };
  axes.forEach((axis) => { point[axis] = source[axis]; });
  return normalizeSequentialSnapPoint(point, profile);
}

function lockedAxes(axes) {
  const allowed = new Set(axes);
  return { x: allowed.has('x'), y: allowed.has('y'), z: allowed.has('z') };
}

function intersectionCandidate(left, right, result, plane, raw, profile) {
  const pair = [left.segmentId, right.segmentId].sort();
  const source = intersectionPoint(left, result.leftParameter, profile);
  const worldPoint = effectivePoint(source, raw, plane.axes, profile);
  const material = { mode: SEQUENTIAL_MOVE_SNAP_MODE.INTERSECTION, pair, worldPoint };
  return immutableJson({
    id: sequentialMoveSnapCandidateId(material),
    providerId: 'sequential:intersection',
    mode: SEQUENTIAL_MOVE_SNAP_MODE.INTERSECTION,
    sourceEntityIds: [...new Set([left.geometryPartId, right.geometryPartId])].sort(),
    worldPoint,
    priority: 15,
    lockedAxes: lockedAxes(plane.axes),
    compatibleConstraintKinds: ['plane'],
    compatibleReferenceIds: [],
    label: `Intersection ${pair.join(' × ')}`,
    metadata: {
      derivation: 'QUALIFIED_SEGMENT_INTERSECTION',
      plane: plane.constraint.plane,
      sourceSegmentIds: pair,
      leftParameter: normalizeSequentialSnapNumber(result.leftParameter, profile),
      rightParameter: normalizeSequentialSnapNumber(result.rightParameter, profile),
      sourceWorldPoint: source,
    },
  }, 'Sequential raw intersection candidate');
}

export function deriveSequentialMoveSnapIntersectionCandidates(input = {}) {
  const profile = createSequentialMoveSnapProfile(input.profile);
  if (!profile.enabledModes.includes(SEQUENTIAL_MOVE_SNAP_MODE.INTERSECTION)) return [];
  const plane = planeRecord(input.constraint);
  if (!plane) return [];
  const segments = [...(input.segments || [])].sort((left, right) => (
    left.segmentId.localeCompare(right.segmentId)
  ));
  failEnvelope(pairCount(segments.length), profile);
  const raw = normalizeSequentialSnapPoint(input.rawWorldPoint, profile);
  const candidates = [];
  for (let leftIndex = 0; leftIndex < segments.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < segments.length; rightIndex += 1) {
      const left = segments[leftIndex];
      const right = segments[rightIndex];
      if (!samePlane(left, right, plane.omitted, profile.worldTolerance)) continue;
      const result = projectedIntersection(left, right, plane.axes, profile.worldTolerance);
      if (!result) continue;
      candidates.push(intersectionCandidate(left, right, result, plane, raw, profile));
    }
  }
  return immutableJson(candidates.sort((left, right) => left.id.localeCompare(right.id)),
    'Sequential snap intersection candidates');
}
