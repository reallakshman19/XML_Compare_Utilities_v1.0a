import { supportMemberGeometryDistance } from './support-member-analytical-geometry.js';
import { pointToAabbDistance, pointToSegmentDistance } from './support-steel-analytical-geometry.js';

export function supportMemberToStructuralGeometryDistance(member, structuralGeometry) {
  const support = member?.analyticalGeometry || member;
  if (support?.worldAabb && structuralGeometry?.axis) {
    return aabbToAxisEnvelopeDistance(
      support.worldAabb,
      structuralGeometry.axis,
      structuralGeometry.sectionEnvelopeRadiusMm,
    );
  }
  return supportMemberGeometryDistance(member, structuralGeometry);
}

function aabbToAxisEnvelopeDistance(bounds, axis, radiusValue) {
  const radiusMm = Math.max(0, Number(radiusValue) || 0);
  const expanded = expandBounds(bounds, radiusMm);
  const intersection = segmentAabbIntersection(axis.start, axis.end, expanded);
  if (intersection) return evidence(0, intersection, intersection, radiusMm);

  const candidates = [];
  for (const endpoint of [axis.start, axis.end]) {
    const result = pointToAabbDistance(endpoint, bounds);
    if (!result) continue;
    candidates.push({
      distanceMm: Math.max(0, result.distanceMm - radiusMm),
      supportPoint: result.nearestPoint,
      steelPoint: endpoint,
    });
  }
  for (const corner of aabbCorners(bounds)) {
    const result = pointToSegmentDistance(corner, axis.start, axis.end, radiusMm);
    if (!result) continue;
    candidates.push({
      distanceMm: result.distanceMm,
      supportPoint: corner,
      steelPoint: result.nearestPoint,
    });
  }
  candidates.sort((left, right) => left.distanceMm - right.distanceMm);
  const best = candidates[0];
  return best
    ? evidence(best.distanceMm, best.supportPoint, best.steelPoint, radiusMm)
    : unavailable();
}

function evidence(distanceMm, supportPoint, steelPoint, radiusMm) {
  return {
    distanceMm: round3(distanceMm),
    geometryMethod: radiusMm > 0
      ? 'WORLD_AABB_TO_WORLD_AXIS_ENVELOPE'
      : 'WORLD_AABB_TO_WORLD_AXIS',
    geometryQuality: 'MEDIUM',
    analyticalGeometryAvailable: true,
    contactPointGlobal: midpoint(supportPoint, steelPoint),
    nearestPointOnLeftGlobal: supportPoint,
    nearestPointOnRightGlobal: steelPoint,
  };
}

function segmentAabbIntersection(start, end, bounds) {
  if (!start || !end || !bounds?.min || !bounds?.max) return null;
  let lower = 0;
  let upper = 1;
  for (const axis of ['x', 'y', 'z']) {
    const direction = end[axis] - start[axis];
    if (Math.abs(direction) <= 1e-12) {
      if (start[axis] < bounds.min[axis] || start[axis] > bounds.max[axis]) return null;
      continue;
    }
    let near = (bounds.min[axis] - start[axis]) / direction;
    let far = (bounds.max[axis] - start[axis]) / direction;
    if (near > far) [near, far] = [far, near];
    lower = Math.max(lower, near);
    upper = Math.min(upper, far);
    if (lower > upper) return null;
  }
  return {
    x: start.x + (end.x - start.x) * lower,
    y: start.y + (end.y - start.y) * lower,
    z: start.z + (end.z - start.z) * lower,
  };
}

function expandBounds(bounds, amount) {
  return {
    min: { x: bounds.min.x - amount, y: bounds.min.y - amount, z: bounds.min.z - amount },
    max: { x: bounds.max.x + amount, y: bounds.max.y + amount, z: bounds.max.z + amount },
  };
}
function aabbCorners(bounds) {
  return [bounds.min.x, bounds.max.x].flatMap((x) => (
    [bounds.min.y, bounds.max.y].flatMap((y) => (
      [bounds.min.z, bounds.max.z].map((z) => ({ x, y, z }))
    ))
  ));
}
function midpoint(left, right) {
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
    z: (left.z + right.z) / 2,
  };
}
function unavailable() {
  return {
    distanceMm: null,
    geometryMethod: 'UNAVAILABLE',
    geometryQuality: 'NONE',
    analyticalGeometryAvailable: false,
    contactPointGlobal: null,
    nearestPointOnLeftGlobal: null,
    nearestPointOnRightGlobal: null,
  };
}
function round3(value) { return Number(Number(value).toFixed(3)); }
