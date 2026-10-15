import { cleanText, parsePoint, readPosition } from './support-steel-source-utils.js';
import {
  IDENTITY_MATRIX_4X4,
  isIdentityMatrix,
  transformLocalBounds,
  transformPoint,
} from './support-steel-world-matrix.js';
import {
  pointToAabbDistance,
  pointToObbDistance,
  pointToSegmentDistance,
} from './support-steel-analytical-geometry.js';

export const SUPPORT_MEMBER_ANALYTICAL_GEOMETRY_SCHEMA = 'SupportMemberAnalyticalGeometry.v1';

const AXIS_PAIRS = Object.freeze([
  ['AXIS_START', 'AXIS_END'],
  ['START', 'END'],
  ['P1', 'P2'],
  ['APOS', 'LPOS'],
]);

const LOCAL_BOUNDS_KEYS = Object.freeze(['BOUNDS', 'AABB', 'BBOX', 'BOUNDING_BOX']);
const WORLD_BOUNDS_KEYS = Object.freeze(['WORLD_BOUNDS', 'WORLD_AABB', 'WORLD_BBOX']);
const SUPPORT_POSITION_KEYS = Object.freeze([
  'WORLD_POS', 'WORLD_POSITION', 'POS', 'SUPPORT_POS', 'SUPPORT_POSITION', 'CENTRE', 'CENTER', 'ORIGIN',
]);

export function buildSupportMemberAnalyticalGeometry(member = {}, config = {}) {
  const attrs = member.attributes || {};
  const worldMatrix = member.worldMatrix || IDENTITY_MATRIX_4X4;
  const bounds = readBounds(attrs, worldMatrix);
  const axis = readAxis(attrs, worldMatrix, member.transformBasis);
  const representativePointGlobal = member.positionGlobal
    || readPosition(attrs, config.supportPositionKeys || SUPPORT_POSITION_KEYS)
    || null;
  const sectionEnvelopeRadiusMm = readEnvelopeRadius(attrs);
  const geometryMethods = [];
  if (bounds?.worldObb) geometryMethods.push('WORLD_OBB');
  else if (bounds?.worldAabb) geometryMethods.push('WORLD_AABB');
  if (axis) geometryMethods.push(sectionEnvelopeRadiusMm > 0 ? 'WORLD_AXIS_WITH_ENVELOPE' : 'WORLD_AXIS');
  if (!geometryMethods.length && representativePointGlobal) geometryMethods.push('REPRESENTATIVE_POINT');
  return {
    schema: SUPPORT_MEMBER_ANALYTICAL_GEOMETRY_SCHEMA,
    memberId: member.memberId || null,
    semanticRole: member.semanticRole || 'OTHER_FAMILY_MEMBER',
    transformBasis: member.transformBasis || 'IDENTITY',
    worldMatrix: [...worldMatrix],
    worldTransformApplied: !isIdentityMatrix(worldMatrix),
    localBounds: bounds?.localBounds || null,
    worldAabb: bounds?.worldAabb || null,
    worldObb: bounds?.worldObb || null,
    axis,
    representativePointGlobal,
    sectionEnvelopeRadiusMm,
    physicalGeometryAvailable: Boolean(bounds?.worldObb || bounds?.worldAabb || axis),
    geometryMethods,
  };
}

export function supportMemberGeometryDistance(leftMember, rightMember) {
  const left = leftMember?.analyticalGeometry || leftMember;
  const right = rightMember?.analyticalGeometry || rightMember;
  if (!left || !right) return unavailableDistance(leftMember, rightMember);

  if (left.worldObb && right.worldObb) {
    const overlap = obbOverlapSat(left.worldObb, right.worldObb);
    if (overlap === true) {
      return distanceRecord(0, midpoint(left.worldObb.center, right.worldObb.center), {
        geometryMethod: 'WORLD_OBB_SAT_OVERLAP',
        geometryQuality: 'HIGH',
        analyticalGeometryAvailable: true,
      });
    }
    const aabbDistance = aabbToAabbDistance(left.worldAabb, right.worldAabb);
    if (aabbDistance && aabbDistance.distanceMm > 0) {
      return distanceRecord(aabbDistance.distanceMm, midpoint(aabbDistance.nearestPointA, aabbDistance.nearestPointB), {
        geometryMethod: 'WORLD_AABB_ENVELOPE_SEPARATION',
        geometryQuality: 'MEDIUM',
        analyticalGeometryAvailable: true,
        nearestPointOnLeftGlobal: aabbDistance.nearestPointA,
        nearestPointOnRightGlobal: aabbDistance.nearestPointB,
      });
    }
    return {
      ...unavailableDistance(leftMember, rightMember),
      geometryMethod: 'WORLD_OBB_SEPARATED_WITH_OVERLAPPING_AABB',
      geometryQuality: 'LOW',
      analyticalGeometryAvailable: true,
    };
  }

  if (left.worldAabb && right.worldAabb) {
    const result = aabbToAabbDistance(left.worldAabb, right.worldAabb);
    return result ? distanceRecord(result.distanceMm, midpoint(result.nearestPointA, result.nearestPointB), {
      geometryMethod: 'WORLD_AABB_TO_AABB',
      geometryQuality: 'MEDIUM',
      analyticalGeometryAvailable: true,
      nearestPointOnLeftGlobal: result.nearestPointA,
      nearestPointOnRightGlobal: result.nearestPointB,
    }) : unavailableDistance(leftMember, rightMember);
  }

  if (left.axis && right.axis) {
    const result = segmentToSegmentDistance(left.axis.start, left.axis.end, right.axis.start, right.axis.end);
    const envelope = Math.max(0, Number(left.sectionEnvelopeRadiusMm) || 0)
      + Math.max(0, Number(right.sectionEnvelopeRadiusMm) || 0);
    const distanceMm = Math.max(0, result.distanceMm - envelope);
    return distanceRecord(distanceMm, midpoint(result.nearestPointA, result.nearestPointB), {
      geometryMethod: envelope > 0 ? 'WORLD_AXIS_ENVELOPE_TO_AXIS_ENVELOPE' : 'WORLD_AXIS_TO_AXIS',
      geometryQuality: envelope > 0 ? 'MEDIUM' : 'LOW',
      analyticalGeometryAvailable: true,
      nearestPointOnLeftGlobal: result.nearestPointA,
      nearestPointOnRightGlobal: result.nearestPointB,
    });
  }

  const leftPoint = preferredPoint(left);
  const rightPoint = preferredPoint(right);
  if (leftPoint && right.worldObb) return pointAgainstGeometry(leftPoint, right.worldObb, 'WORLD_OBB', true);
  if (rightPoint && left.worldObb) return swapDistance(pointAgainstGeometry(rightPoint, left.worldObb, 'WORLD_OBB', true));
  if (leftPoint && right.worldAabb) return pointAgainstGeometry(leftPoint, right.worldAabb, 'WORLD_AABB', false);
  if (rightPoint && left.worldAabb) return swapDistance(pointAgainstGeometry(rightPoint, left.worldAabb, 'WORLD_AABB', false));
  if (leftPoint && right.axis) return pointAgainstAxis(leftPoint, right);
  if (rightPoint && left.axis) return swapDistance(pointAgainstAxis(rightPoint, left));

  if (leftPoint && rightPoint) {
    const distanceMm = magnitude(subtract(leftPoint, rightPoint));
    return distanceRecord(distanceMm, midpoint(leftPoint, rightPoint), {
      geometryMethod: 'REPRESENTATIVE_POINT_TO_POINT',
      geometryQuality: 'FALLBACK',
      analyticalGeometryAvailable: false,
      nearestPointOnLeftGlobal: leftPoint,
      nearestPointOnRightGlobal: rightPoint,
    });
  }
  return unavailableDistance(leftMember, rightMember);
}

export function pointToSupportMemberGeometryDistance(point, member) {
  const geometry = member?.analyticalGeometry || member;
  if (!point || !geometry) return unavailableDistance(point, member);
  if (geometry.worldObb) return pointAgainstGeometry(point, geometry.worldObb, 'WORLD_OBB', true);
  if (geometry.worldAabb) return pointAgainstGeometry(point, geometry.worldAabb, 'WORLD_AABB', false);
  if (geometry.axis) return pointAgainstAxis(point, geometry);
  const representative = preferredPoint(geometry);
  if (!representative) return unavailableDistance(point, member);
  return distanceRecord(magnitude(subtract(point, representative)), midpoint(point, representative), {
    geometryMethod: 'POINT_TO_REPRESENTATIVE_POINT',
    geometryQuality: 'FALLBACK',
    analyticalGeometryAvailable: false,
    nearestPointOnLeftGlobal: point,
    nearestPointOnRightGlobal: representative,
  });
}

export function aabbToAabbDistance(left, right) {
  if (!left?.min || !left?.max || !right?.min || !right?.max) return null;
  const nearestPointA = {};
  const nearestPointB = {};
  let squared = 0;
  for (const axis of ['x', 'y', 'z']) {
    if (left.max[axis] < right.min[axis]) {
      nearestPointA[axis] = left.max[axis];
      nearestPointB[axis] = right.min[axis];
    } else if (right.max[axis] < left.min[axis]) {
      nearestPointA[axis] = left.min[axis];
      nearestPointB[axis] = right.max[axis];
    } else {
      const overlapMin = Math.max(left.min[axis], right.min[axis]);
      const overlapMax = Math.min(left.max[axis], right.max[axis]);
      const coordinate = (overlapMin + overlapMax) / 2;
      nearestPointA[axis] = coordinate;
      nearestPointB[axis] = coordinate;
    }
    const delta = nearestPointB[axis] - nearestPointA[axis];
    squared += delta * delta;
  }
  return { distanceMm: round3(Math.sqrt(squared)), nearestPointA, nearestPointB };
}

export function obbOverlapSat(left, right, tolerance = 1e-8) {
  if (!validObb(left) || !validObb(right)) return null;
  const candidateAxes = [...left.axes, ...right.axes];
  for (const axisA of left.axes) {
    for (const axisB of right.axes) {
      const crossAxis = cross(axisA, axisB);
      if (magnitude(crossAxis) > tolerance) candidateAxes.push(normalize(crossAxis));
    }
  }
  const centerDelta = subtract(right.center, left.center);
  for (const axis of candidateAxes) {
    const normalized = normalize(axis);
    if (magnitude(normalized) <= tolerance) continue;
    const distance = Math.abs(dot(centerDelta, normalized));
    const radiusLeft = projectedRadius(left, normalized);
    const radiusRight = projectedRadius(right, normalized);
    if (distance > radiusLeft + radiusRight + tolerance) return false;
  }
  return true;
}

export function segmentToSegmentDistance(p1, q1, p2, q2) {
  const d1 = subtract(q1, p1);
  const d2 = subtract(q2, p2);
  const r = subtract(p1, p2);
  const a = dot(d1, d1);
  const e = dot(d2, d2);
  const f = dot(d2, r);
  let s = 0;
  let t = 0;
  if (a <= 1e-12 && e <= 1e-12) {
    return { distanceMm: magnitude(subtract(p1, p2)), nearestPointA: p1, nearestPointB: p2 };
  }
  if (a <= 1e-12) {
    t = clamp(f / e, 0, 1);
  } else {
    const c = dot(d1, r);
    if (e <= 1e-12) {
      s = clamp(-c / a, 0, 1);
    } else {
      const b = dot(d1, d2);
      const denominator = a * e - b * b;
      if (Math.abs(denominator) > 1e-12) s = clamp((b * f - c * e) / denominator, 0, 1);
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = clamp((b - c) / a, 0, 1);
      }
    }
  }
  const nearestPointA = add(p1, scale(d1, s));
  const nearestPointB = add(p2, scale(d2, t));
  return {
    distanceMm: round3(magnitude(subtract(nearestPointA, nearestPointB))),
    nearestPointA,
    nearestPointB,
    fractionA: s,
    fractionB: t,
  };
}

function readBounds(attrs, worldMatrix) {
  for (const key of WORLD_BOUNDS_KEYS) {
    const worldAabb = parseBounds(attrs[key]);
    if (worldAabb) return { localBounds: null, worldAabb, worldObb: null, sourceKey: key };
  }
  for (const key of LOCAL_BOUNDS_KEYS) {
    const localBounds = parseBounds(attrs[key]);
    if (!localBounds) continue;
    return { localBounds, ...transformLocalBounds(worldMatrix, localBounds), sourceKey: key };
  }
  const min = parsePoint(attrs.BOUNDS_MIN || attrs.BBOX_MIN || attrs.MIN);
  const max = parsePoint(attrs.BOUNDS_MAX || attrs.BBOX_MAX || attrs.MAX);
  if (!min || !max) return null;
  const localBounds = normalizeBounds({ min, max });
  return { localBounds, ...transformLocalBounds(worldMatrix, localBounds), sourceKey: 'MIN_MAX' };
}

function readAxis(attrs, worldMatrix, transformBasis) {
  for (const [startKey, endKey] of AXIS_PAIRS) {
    const start = parsePoint(attrs[startKey]);
    const end = parsePoint(attrs[endKey]);
    if (!start || !end) continue;
    const coordinateSpace = axisCoordinateSpace(attrs, transformBasis);
    return {
      sourceStartKey: startKey,
      sourceEndKey: endKey,
      sourceCoordinateSpace: coordinateSpace,
      start: coordinateSpace === 'LOCAL' ? transformPoint(worldMatrix, start) : start,
      end: coordinateSpace === 'LOCAL' ? transformPoint(worldMatrix, end) : end,
    };
  }
  return null;
}

function parseBounds(value) {
  if (!value) return null;
  if (Array.isArray(value) && value.length >= 6) {
    return normalizeBounds({
      min: { x: Number(value[0]), y: Number(value[1]), z: Number(value[2]) },
      max: { x: Number(value[3]), y: Number(value[4]), z: Number(value[5]) },
    });
  }
  if (typeof value === 'string') {
    const numbers = value.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/gu)?.map(Number) || [];
    return numbers.length >= 6 ? parseBounds(numbers) : null;
  }
  if (typeof value !== 'object') return null;
  const min = parsePoint(value.min || value.minimum || value.lo || value.lower);
  const max = parsePoint(value.max || value.maximum || value.hi || value.upper);
  return min && max ? normalizeBounds({ min, max }) : null;
}

function normalizeBounds(bounds) {
  const values = [bounds.min.x, bounds.min.y, bounds.min.z, bounds.max.x, bounds.max.y, bounds.max.z];
  if (!values.every(Number.isFinite)) return null;
  return {
    min: {
      x: Math.min(bounds.min.x, bounds.max.x),
      y: Math.min(bounds.min.y, bounds.max.y),
      z: Math.min(bounds.min.z, bounds.max.z),
    },
    max: {
      x: Math.max(bounds.min.x, bounds.max.x),
      y: Math.max(bounds.min.y, bounds.max.y),
      z: Math.max(bounds.min.z, bounds.max.z),
    },
  };
}

function readEnvelopeRadius(attrs) {
  const explicit = firstFinite(attrs.ENVELOPE_RADIUS, attrs.SECTION_RADIUS, attrs.RADIUS);
  if (explicit !== null) return Math.max(0, explicit);
  const width = firstFinite(attrs.WIDTH, attrs.BREADTH, attrs.SECTION_WIDTH, attrs.BF);
  const depth = firstFinite(attrs.DEPTH, attrs.HEIGHT, attrs.SECTION_DEPTH, attrs.D);
  const dimensions = [width, depth].filter(Number.isFinite);
  return dimensions.length ? Math.max(...dimensions) / 2 : 0;
}

function axisCoordinateSpace(attrs, transformBasis) {
  const value = cleanText(attrs.AXIS_COORDINATE_SPACE || attrs.GEOMETRY_COORDINATE_SPACE || attrs.COORDINATE_SPACE).toUpperCase();
  if (value === 'WORLD' || value === 'GLOBAL') return 'WORLD';
  if (value === 'LOCAL') return 'LOCAL';
  return transformBasis && transformBasis !== 'IDENTITY' ? 'LOCAL' : 'WORLD';
}

function pointAgainstGeometry(point, bounds, kind, obb) {
  const result = obb ? pointToObbDistance(point, bounds) : pointToAabbDistance(point, bounds);
  return result ? distanceRecord(result.distanceMm, midpoint(point, result.nearestPoint), {
    geometryMethod: `POINT_TO_${kind}`,
    geometryQuality: obb ? 'HIGH' : 'MEDIUM',
    analyticalGeometryAvailable: true,
    nearestPointOnLeftGlobal: point,
    nearestPointOnRightGlobal: result.nearestPoint,
  }) : unavailableDistance(point, bounds);
}

function pointAgainstAxis(point, geometry) {
  const result = pointToSegmentDistance(
    point,
    geometry.axis.start,
    geometry.axis.end,
    geometry.sectionEnvelopeRadiusMm,
  );
  return result ? distanceRecord(result.distanceMm, midpoint(point, result.nearestPoint), {
    geometryMethod: geometry.sectionEnvelopeRadiusMm > 0 ? 'POINT_TO_WORLD_AXIS_ENVELOPE' : 'POINT_TO_WORLD_AXIS',
    geometryQuality: geometry.sectionEnvelopeRadiusMm > 0 ? 'MEDIUM' : 'LOW',
    analyticalGeometryAvailable: true,
    nearestPointOnLeftGlobal: point,
    nearestPointOnRightGlobal: result.nearestPoint,
  }) : unavailableDistance(point, geometry);
}

function preferredPoint(geometry) {
  return geometry.representativePointGlobal
    || geometry.worldObb?.center
    || aabbCenter(geometry.worldAabb)
    || geometry.axis?.start
    || null;
}

function aabbCenter(bounds) {
  return bounds?.min && bounds?.max ? midpoint(bounds.min, bounds.max) : null;
}

function distanceRecord(distanceMm, contactPointGlobal, metadata) {
  return {
    distanceMm: Number.isFinite(distanceMm) ? round3(distanceMm) : null,
    contactPointGlobal: contactPointGlobal || null,
    geometryMethod: metadata.geometryMethod,
    geometryQuality: metadata.geometryQuality,
    analyticalGeometryAvailable: Boolean(metadata.analyticalGeometryAvailable),
    nearestPointOnLeftGlobal: metadata.nearestPointOnLeftGlobal || null,
    nearestPointOnRightGlobal: metadata.nearestPointOnRightGlobal || null,
  };
}

function swapDistance(result) {
  return {
    ...result,
    nearestPointOnLeftGlobal: result.nearestPointOnRightGlobal,
    nearestPointOnRightGlobal: result.nearestPointOnLeftGlobal,
  };
}

function unavailableDistance(left, right) {
  return {
    distanceMm: null,
    contactPointGlobal: null,
    geometryMethod: 'UNAVAILABLE',
    geometryQuality: 'NONE',
    analyticalGeometryAvailable: false,
    nearestPointOnLeftGlobal: null,
    nearestPointOnRightGlobal: null,
    leftMemberId: left?.memberId || null,
    rightMemberId: right?.memberId || null,
  };
}

function validObb(obb) {
  return obb?.center
    && Array.isArray(obb.axes)
    && obb.axes.length === 3
    && Array.isArray(obb.halfExtents)
    && obb.halfExtents.length === 3;
}

function projectedRadius(obb, axis) {
  return obb.axes.reduce((sum, obbAxis, index) => (
    sum + Math.abs(dot(obbAxis, axis)) * Math.max(0, Number(obb.halfExtents[index]) || 0)
  ), 0);
}

function firstFinite(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function midpoint(left, right) {
  if (!left || !right) return null;
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2, z: (left.z + right.z) / 2 };
}

function subtract(left, right) {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
}

function add(left, right) {
  return { x: left.x + right.x, y: left.y + right.y, z: left.z + right.z };
}

function scale(vector, factor) {
  return { x: vector.x * factor, y: vector.y * factor, z: vector.z * factor };
}

function dot(left, right) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function cross(left, right) {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
}

function magnitude(vector) {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function normalize(vector) {
  const length = magnitude(vector);
  return length > 1e-12 ? scale(vector, 1 / length) : { x: 0, y: 0, z: 0 };
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}
