/** Pure stationary source projection for explicit Sequential move snap candidates. */
import { immutableJson } from '../../../contracts/contract-values.js';
import {
  SEQUENTIAL_MOVE_SNAP_MODE,
  SEQUENTIAL_MOVE_SNAP_REJECTION,
  createSequentialMoveSnapProfile,
  normalizeSequentialSnapNumber,
  normalizeSequentialSnapPoint,
  sequentialMoveSnapCandidateId,
  sequentialSnapPoint,
} from './sequential-move-snap-contracts.js';
import { createSequentialMoveConstraint } from './sequential-single-entity-move-geometry.js';

const PRIORITY = Object.freeze({
  [SEQUENTIAL_MOVE_SNAP_MODE.ENDPOINT]: 10,
  [SEQUENTIAL_MOVE_SNAP_MODE.MIDPOINT]: 20,
  [SEQUENTIAL_MOVE_SNAP_MODE.AXIS_X]: 30,
  [SEQUENTIAL_MOVE_SNAP_MODE.AXIS_Y]: 30,
  [SEQUENTIAL_MOVE_SNAP_MODE.AXIS_Z]: 30,
  [SEQUENTIAL_MOVE_SNAP_MODE.CENTERLINE]: 40,
  [SEQUENTIAL_MOVE_SNAP_MODE.GRID]: 50,
});

function allowedAxes(constraintInput) {
  const constraint = createSequentialMoveConstraint(constraintInput);
  return constraint.kind === 'axis' ? [constraint.axis.toLowerCase()]
    : constraint.axes.map((axis) => axis.toLowerCase());
}

function locks(axes) {
  const enabled = new Set(axes);
  return { x: enabled.has('x'), y: enabled.has('y'), z: enabled.has('z') };
}

function constrainedPoint(source, raw, axes, profile) {
  const point = { ...raw };
  axes.forEach((axis) => { point[axis] = source[axis]; });
  return normalizeSequentialSnapPoint(point, profile);
}

function sourceCandidate(input) {
  const material = {
    mode: input.mode,
    sourceKey: input.sourceKey,
    worldPoint: input.worldPoint,
    lockedAxes: input.lockedAxes,
  };
  return immutableJson({
    id: sequentialMoveSnapCandidateId(material),
    providerId: input.providerId,
    mode: input.mode,
    sourceEntityIds: [...new Set(input.sourceEntityIds)].sort(),
    worldPoint: input.worldPoint,
    priority: PRIORITY[input.mode],
    lockedAxes: input.lockedAxes,
    compatibleConstraintKinds: ['axis', 'plane'],
    compatibleReferenceIds: [],
    label: input.label,
    metadata: input.metadata,
  }, 'Sequential raw snap candidate');
}

function geometrySegments(entity) {
  if (entity.geometry?.kind === 'segment') {
    return [{ index: 0, start: entity.geometry.start, end: entity.geometry.end }];
  }
  if (entity.geometry?.kind !== 'polyline') return [];
  return (entity.geometry.points || []).slice(1).map((end, index) => ({
    index,
    start: entity.geometry.points[index],
    end,
  }));
}

export function projectSequentialSnapSegments(scene, target, profileInput) {
  const profile = createSequentialMoveSnapProfile(profileInput);
  const excluded = new Set(target.geometryPartIds);
  const segments = scene.entities
    .filter((row) => row.domainRef?.category === 'confirmed' && !excluded.has(row.id))
    .flatMap((entity) => geometrySegments(entity).map((segment) => ({
      segmentId: `${entity.id}:segment:${segment.index}`,
      geometryPartId: entity.id,
      componentId: entity.domainRef?.componentId || null,
      index: segment.index,
      start: normalizeSequentialSnapPoint(segment.start, profile),
      end: normalizeSequentialSnapPoint(segment.end, profile),
    })))
    .sort((left, right) => left.segmentId.localeCompare(right.segmentId));
  if (segments.length > profile.maxSegments) {
    const error = new RangeError(`Snap source segment envelope exceeded: ${segments.length}.`);
    error.code = SEQUENTIAL_MOVE_SNAP_REJECTION.SEGMENT_ENVELOPE;
    throw error;
  }
  return immutableJson(segments, 'Sequential snap segments');
}

export function projectSequentialSnapAnchors(snapshot, target, profileInput) {
  const profile = createSequentialMoveSnapProfile(profileInput);
  const excludedParts = new Set(target.geometryPartIds);
  return immutableJson(snapshot.nodes.flatMap((node) => {
    const sourceEntityIds = node.incidentGeometryPartIds.filter((id) => !excludedParts.has(id));
    const sourceComponentIds = node.incidentComponentIds.filter((id) => id !== target.componentId);
    if (!sourceEntityIds.length || !sourceComponentIds.length) return [];
    return [{
      anchorId: `node:${node.nodeId}`,
      nodeId: node.nodeId,
      portIds: node.portIds,
      componentIds: sourceComponentIds,
      sourceEntityIds: sourceEntityIds.sort(),
      point: normalizeSequentialSnapPoint(node.position, profile),
    }];
  }).sort((left, right) => left.anchorId.localeCompare(right.anchorId)),
  'Sequential snap anchors');
}

function endpointCandidates(anchors, raw, axes, profile) {
  return anchors.map((anchor) => sourceCandidate({
    mode: SEQUENTIAL_MOVE_SNAP_MODE.ENDPOINT,
    providerId: 'sequential:endpoint',
    sourceKey: anchor.anchorId,
    sourceEntityIds: anchor.sourceEntityIds,
    worldPoint: constrainedPoint(anchor.point, raw, axes, profile),
    lockedAxes: locks(axes),
    label: `Endpoint ${anchor.nodeId}`,
    metadata: { derivation: 'CONFIRMED_NODE', sourceWorldPoint: anchor.point,
      nodeId: anchor.nodeId, portIds: anchor.portIds, componentIds: anchor.componentIds },
  }));
}

function midpoint(left, right, profile) {
  return normalizeSequentialSnapPoint({
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
    z: (left.z + right.z) / 2,
  }, profile);
}

function midpointCandidates(segments, raw, axes, profile) {
  return segments.map((segment) => sourceCandidate({
    mode: SEQUENTIAL_MOVE_SNAP_MODE.MIDPOINT,
    providerId: 'sequential:midpoint',
    sourceKey: segment.segmentId,
    sourceEntityIds: [segment.geometryPartId],
    worldPoint: constrainedPoint(midpoint(segment.start, segment.end, profile), raw, axes, profile),
    lockedAxes: locks(axes),
    label: `Midpoint ${segment.segmentId}`,
    metadata: { derivation: 'SEGMENT_MIDPOINT', ...segment },
  }));
}

function closestPoint(segment, raw, profile) {
  const vector = ['x', 'y', 'z'].map((axis) => segment.end[axis] - segment.start[axis]);
  const length2 = vector.reduce((sum, value) => sum + value * value, 0);
  if (length2 <= profile.worldTolerance * profile.worldTolerance) {
    const error = new RangeError(`Zero-length snap segment: ${segment.segmentId}`);
    error.code = SEQUENTIAL_MOVE_SNAP_REJECTION.ZERO_LENGTH_SEGMENT;
    throw error;
  }
  const offset = ['x', 'y', 'z'].map((axis) => raw[axis] - segment.start[axis]);
  const parameter = Math.max(0, Math.min(1,
    offset.reduce((sum, value, index) => sum + value * vector[index], 0) / length2));
  const point = Object.fromEntries(['x', 'y', 'z'].map((axis, index) => [
    axis, segment.start[axis] + parameter * vector[index],
  ]));
  return { parameter: normalizeSequentialSnapNumber(parameter, profile),
    point: normalizeSequentialSnapPoint(point, profile) };
}

function centerlineCandidates(segments, raw, axes, profile) {
  return segments.flatMap((segment) => {
    const closest = closestPoint(segment, raw, profile);
    if (closest.parameter <= profile.worldTolerance
      || closest.parameter >= 1 - profile.worldTolerance) return [];
    return [sourceCandidate({
      mode: SEQUENTIAL_MOVE_SNAP_MODE.CENTERLINE,
      providerId: 'sequential:centerline',
      sourceKey: `${segment.segmentId}:${closest.parameter}`,
      sourceEntityIds: [segment.geometryPartId],
      worldPoint: constrainedPoint(closest.point, raw, axes, profile),
      lockedAxes: locks(axes),
      label: `Centerline ${segment.segmentId}`,
      metadata: { derivation: 'CLOSEST_POINT_ON_SEGMENT', ...segment,
        parameter: closest.parameter, sourceWorldPoint: closest.point },
    })];
  });
}

function axisCandidates(anchors, raw, axes, profile) {
  return anchors.flatMap((anchor) => axes.map((axis) => {
    const upper = axis.toUpperCase();
    const mode = SEQUENTIAL_MOVE_SNAP_MODE[`AXIS_${upper}`];
    return sourceCandidate({
      mode,
      providerId: 'sequential:axis',
      sourceKey: `${anchor.anchorId}:${upper}`,
      sourceEntityIds: anchor.sourceEntityIds,
      worldPoint: constrainedPoint(anchor.point, raw, [axis], profile),
      lockedAxes: locks([axis]),
      label: `${upper}-axis ${anchor.nodeId}`,
      metadata: { derivation: 'ANCHOR_AXIS_ALIGNMENT', axis: upper,
        nodeId: anchor.nodeId, sourceWorldPoint: anchor.point },
    });
  }));
}

function gridCandidate(raw, axes, profile) {
  if (!profile.grid.enabled || !profile.enabledModes.includes(SEQUENTIAL_MOVE_SNAP_MODE.GRID)) return [];
  const source = { ...raw };
  axes.forEach((axis) => {
    const origin = profile.grid.origin[axis];
    source[axis] = origin + Math.round((raw[axis] - origin) / profile.grid.spacing)
      * profile.grid.spacing;
  });
  const worldPoint = normalizeSequentialSnapPoint(source, profile);
  return [sourceCandidate({
    mode: SEQUENTIAL_MOVE_SNAP_MODE.GRID,
    providerId: 'sequential:grid',
    sourceKey: `${profile.grid.spacing}:${worldPoint.x}:${worldPoint.y}:${worldPoint.z}`,
    sourceEntityIds: [],
    worldPoint,
    lockedAxes: locks(axes),
    label: `Grid ${profile.grid.spacing}`,
    metadata: { derivation: 'EXPLICIT_GRID', spacing: profile.grid.spacing,
      origin: profile.grid.origin },
  })];
}

export function deriveSequentialMoveSnapSourceCandidates(input = {}) {
  const profile = createSequentialMoveSnapProfile(input.profile);
  const raw = normalizeSequentialSnapPoint(input.rawWorldPoint, profile);
  const axes = allowedAxes(input.constraint);
  const enabled = new Set(profile.enabledModes);
  const needsSegments = [SEQUENTIAL_MOVE_SNAP_MODE.MIDPOINT,
    SEQUENTIAL_MOVE_SNAP_MODE.CENTERLINE, SEQUENTIAL_MOVE_SNAP_MODE.INTERSECTION]
    .some((mode) => enabled.has(mode));
  const needsAnchors = [SEQUENTIAL_MOVE_SNAP_MODE.ENDPOINT,
    SEQUENTIAL_MOVE_SNAP_MODE.AXIS_X, SEQUENTIAL_MOVE_SNAP_MODE.AXIS_Y,
    SEQUENTIAL_MOVE_SNAP_MODE.AXIS_Z].some((mode) => enabled.has(mode));
  const segments = needsSegments
    ? projectSequentialSnapSegments(input.scene, input.target, profile) : [];
  const anchors = needsAnchors
    ? projectSequentialSnapAnchors(input.snapshot, input.target, profile) : [];
  const candidates = [
    ...(enabled.has(SEQUENTIAL_MOVE_SNAP_MODE.ENDPOINT)
      ? endpointCandidates(anchors, raw, axes, profile) : []),
    ...(enabled.has(SEQUENTIAL_MOVE_SNAP_MODE.MIDPOINT)
      ? midpointCandidates(segments, raw, axes, profile) : []),
    ...(enabled.has(SEQUENTIAL_MOVE_SNAP_MODE.CENTERLINE)
      ? centerlineCandidates(segments, raw, axes, profile) : []),
    ...([SEQUENTIAL_MOVE_SNAP_MODE.AXIS_X, SEQUENTIAL_MOVE_SNAP_MODE.AXIS_Y,
      SEQUENTIAL_MOVE_SNAP_MODE.AXIS_Z].some((mode) => enabled.has(mode))
      ? axisCandidates(anchors, raw, axes, profile).filter((row) => enabled.has(row.mode)) : []),
    ...gridCandidate(raw, axes, profile),
  ];
  return immutableJson({ segments, anchors, candidates }, 'Sequential snap source projection');
}
