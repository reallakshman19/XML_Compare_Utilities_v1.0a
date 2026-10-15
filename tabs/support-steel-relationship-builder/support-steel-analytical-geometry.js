import { cleanText, parsePoint, readPosition, sourceIdentity } from './support-steel-source-utils.js';
import {
  IDENTITY_MATRIX_4X4,
  isIdentityMatrix,
  transformLocalBounds,
  transformPoint,
} from './support-steel-world-matrix.js';

export const SUPPORT_STEEL_ANALYTICAL_GEOMETRY_SCHEMA = 'SupportSteelAnalyticalGeometry.v1';

const AXIS_PAIRS = Object.freeze([
  ['AXIS_START', 'AXIS_END'],
  ['START', 'END'],
  ['P1', 'P2'],
  ['APOS', 'LPOS'],
]);

const LOCAL_BOUNDS_KEYS = Object.freeze(['BOUNDS', 'AABB', 'BBOX', 'BOUNDING_BOX']);
const WORLD_BOUNDS_KEYS = Object.freeze(['WORLD_BOUNDS', 'WORLD_AABB', 'WORLD_BBOX']);
const REPRESENTATIVE_POSITION_KEYS = Object.freeze([
  'WORLD_POS', 'WORLD_POSITION', 'POS', 'CENTRE', 'CENTER', 'ORIGIN',
]);

export function buildStructuralAnalyticalMember(row, attrs = {}, config = {}) {
  const worldMatrix = row?.worldMatrix || IDENTITY_MATRIX_4X4;
  const identity = sourceIdentity(row?.node || {}, attrs) || null;
  const axis = readAxis(attrs, worldMatrix, row?.transformBasis);
  const bounds = readWorldBounds(attrs, worldMatrix);
  const representativePoint = readRepresentativePoint(attrs, config);
  const sectionEnvelopeRadiusMm = readSectionEnvelopeRadius(attrs);
  const geometryMethods = [];
  if (bounds?.worldObb) geometryMethods.push('WORLD_OBB');
  else if (bounds?.worldAabb) geometryMethods.push('WORLD_AABB');
  if (axis) geometryMethods.push(sectionEnvelopeRadiusMm > 0 ? 'WORLD_AXIS_WITH_SECTION_ENVELOPE' : 'WORLD_AXIS');
  if (!geometryMethods.length && representativePoint) geometryMethods.push('REPRESENTATIVE_POINT');
  return {
    schema: SUPPORT_STEEL_ANALYTICAL_GEOMETRY_SCHEMA,
    structuralMemberId: identity,
    transformBasis: row?.transformBasis || 'IDENTITY',
    worldMatrix: [...worldMatrix],
    worldTransformApplied: !isIdentityMatrix(worldMatrix),
    axis,
    localBounds: bounds?.localBounds || null,
    worldAabb: bounds?.worldAabb || null,
    worldObb: bounds?.worldObb || null,
    representativePointGlobal: representativePoint,
    sectionEnvelopeRadiusMm,
    geometryAvailable: geometryMethods.some((method) => method !== 'REPRESENTATIVE_POINT'),
    geometryMethods,
  };
}

export function summarizeSteelAnalyticalGeometry(records = []) {
  const members = records
    .map((record) => record.analyticalGeometry)
    .filter((geometry) => geometry?.geometryMethods?.length);
  const worldAabb = unionAabbs(members.map((member) => member.worldAabb).filter(Boolean));
  return {
    schema: SUPPORT_STEEL_ANALYTICAL_GEOMETRY_SCHEMA,
    analyticalMemberCount: members.filter((member) => member.geometryAvailable).length,
    representativeOnlyMemberCount: members.filter((member) => !member.geometryAvailable).length,
    worldAabb,
    methods: [...new Set(members.flatMap((member) => member.geometryMethods || []))].sort(),
  };
}

export function minimumSupportToSteelGeometryDistance(family, steel) {
  const supportPoints = family?.positions?.length
    ? family.positions
    : [family?.supportPositionGlobal].filter(Boolean);
  const members = steel?.records
    ?.map((record) => ({
      recordId: record.recordId,
      geometry: record.analyticalGeometry,
      fallbackPoint: record.positionGlobal,
    }))
    .filter((entry) => entry.geometry || entry.fallbackPoint) || [];

  let best = null;
  for (const supportPoint of supportPoints) {
    for (const member of members) {
      const candidate = distanceToAnalyticalMember(supportPoint, member);
      if (!candidate) continue;
      if (!best || compareDistanceCandidates(candidate, best) < 0) best = candidate;
    }
  }
  return best || {
    distanceMm: null,
    geometryMethod: 'UNAVAILABLE',
    geometryQuality: 'NONE',
    analyticalGeometryAvailable: false,
    structuralMemberId: null,
    supportPointGlobal: supportPoints[0] || null,
    nearestPointOnSteelGlobal: null,
  };
}

export function pointToSegmentDistance(point, start, end, radiusMm = 0) {
  if (!point || !start || !end) return null;
  const direction = subtract(end, start);
  const lengthSquared = dot(direction, direction);
  const fraction = lengthSquared <= 1e-12
    ? 0
    : clamp(dot(subtract(point, start), direction) / lengthSquared, 0, 1);
  const nearestAxisPoint = add(start, scale(direction, fraction));
  const delta = subtract(point, nearestAxisPoint);
  const centrelineDistance = magnitude(delta);
  const envelopeRadius = Math.max(0, Number(radiusMm) || 0);
  const distanceMm = Math.max(0, centrelineDistance - envelopeRadius);
  const nearestPoint = centrelineDistance <= 1e-12 || envelopeRadius <= 0
    ? nearestAxisPoint
    : add(nearestAxisPoint, scale(delta, Math.min(1, envelopeRadius / centrelineDistance)));
  return {
    distanceMm,
    nearestPoint,
    axisFraction: fraction,
    centrelineDistanceMm: centrelineDistance,
  };
}

export function pointToAabbDistance(point, bounds) {
  if (!point || !bounds?.min || !bounds?.max) return null;
  const nearestPoint = {
    x: clamp(point.x, bounds.min.x, bounds.max.x),
    y: clamp(point.y, bounds.min.y, bounds.max.y),
    z: clamp(point.z, bounds.min.z, bounds.max.z),
  };
  return { distanceMm: magnitude(subtract(point, nearestPoint)), nearestPoint };
}

export function pointToObbDistance(point, obb) {
  if (!point || !obb?.center || !Array.isArray(obb.axes) || !Array.isArray(obb.halfExtents)) return null;
  if (obb.axes.length !== 3 || obb.halfExtents.length !== 3) return null;
  const delta = subtract(point, obb.center);
  let nearestPoint = { ...obb.center };
  for (let index = 0; index < 3; index += 1) {
    const axis = obb.axes[index];
    const extent = Math.max(0, Number(obb.halfExtents[index]) || 0);
    const coordinate = clamp(dot(delta, axis), -extent, extent);
    nearestPoint = add(nearestPoint, scale(axis, coordinate));
  }
  return { distanceMm: magnitude(subtract(point, nearestPoint)), nearestPoint };
}

function distanceToAnalyticalMember(supportPoint, member) {
  const geometry = member.geometry || {};
  if (geometry.worldObb) {
    return candidateFromDistance(pointToObbDistance(supportPoint, geometry.worldObb), {
      geometryMethod: 'POINT_TO_WORLD_OBB',
      geometryQuality: 'HIGH',
      analyticalGeometryAvailable: true,
      structuralMemberId: geometry.structuralMemberId || member.recordId,
      supportPointGlobal: supportPoint,
    });
  }
  if (geometry.worldAabb) {
    return candidateFromDistance(pointToAabbDistance(supportPoint, geometry.worldAabb), {
      geometryMethod: 'POINT_TO_WORLD_AABB',
      geometryQuality: 'MEDIUM',
      analyticalGeometryAvailable: true,
      structuralMemberId: geometry.structuralMemberId || member.recordId,
      supportPointGlobal: supportPoint,
    });
  }
  if (geometry.axis) {
    const result = pointToSegmentDistance(
      supportPoint,
      geometry.axis.start,
      geometry.axis.end,
      geometry.sectionEnvelopeRadiusMm,
    );
    return candidateFromDistance(result, {
      geometryMethod: geometry.sectionEnvelopeRadiusMm > 0
        ? 'POINT_TO_WORLD_AXIS_ENVELOPE'
        : 'POINT_TO_WORLD_AXIS',
      geometryQuality: geometry.sectionEnvelopeRadiusMm > 0 ? 'MEDIUM' : 'LOW',
      analyticalGeometryAvailable: true,
      structuralMemberId: geometry.structuralMemberId || member.recordId,
      supportPointGlobal: supportPoint,
      axisFraction: result?.axisFraction,
    });
  }
  const fallbackPoint = geometry.representativePointGlobal || member.fallbackPoint;
  if (!fallbackPoint) return null;
  return {
    distanceMm: round3(magnitude(subtract(supportPoint, fallbackPoint))),
    geometryMethod: 'POINT_TO_REPRESENTATIVE_POINT',
    geometryQuality: 'FALLBACK',
    analyticalGeometryAvailable: false,
    structuralMemberId: geometry.structuralMemberId || member.recordId,
    supportPointGlobal: supportPoint,
    nearestPointOnSteelGlobal: fallbackPoint,
  };
}

function candidateFromDistance(result, metadata) {
  if (!result || !Number.isFinite(result.distanceMm)) return null;
  return {
    ...metadata,
    distanceMm: round3(result.distanceMm),
    nearestPointOnSteelGlobal: result.nearestPoint || null,
  };
}

function compareDistanceCandidates(left, right) {
  const distanceDelta = left.distanceMm - right.distanceMm;
  if (Math.abs(distanceDelta) > 1e-9) return distanceDelta;
  return geometryRank(left.geometryQuality) - geometryRank(right.geometryQuality);
}

function geometryRank(quality) {
  return ({ HIGH: 0, MEDIUM: 1, LOW: 2, FALLBACK: 3, NONE: 4 })[quality] ?? 5;
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

function readWorldBounds(attrs, worldMatrix) {
  for (const key of WORLD_BOUNDS_KEYS) {
    const worldAabb = parseBounds(attrs[key]);
    if (worldAabb) return { localBounds: null, worldAabb, worldObb: null, sourceKey: key };
  }
  for (const key of LOCAL_BOUNDS_KEYS) {
    const localBounds = parseBounds(attrs[key]);
    if (!localBounds) continue;
    const transformed = transformLocalBounds(worldMatrix, localBounds);
    return { localBounds, ...transformed, sourceKey: key };
  }
  const min = parsePoint(attrs.BOUNDS_MIN || attrs.BBOX_MIN || attrs.MIN);
  const max = parsePoint(attrs.BOUNDS_MAX || attrs.BBOX_MAX || attrs.MAX);
  if (!min || !max) return null;
  const localBounds = normalizeBounds({ min, max });
  const transformed = transformLocalBounds(worldMatrix, localBounds);
  return { localBounds, ...transformed, sourceKey: 'MIN_MAX' };
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
  const values = [
    bounds.min.x, bounds.min.y, bounds.min.z,
    bounds.max.x, bounds.max.y, bounds.max.z,
  ];
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

function readRepresentativePoint(attrs, config) {
  return readPosition(attrs, config.steelPositionKeys || REPRESENTATIVE_POSITION_KEYS);
}

function readSectionEnvelopeRadius(attrs) {
  const explicit = firstFinite(attrs.SECTION_RADIUS, attrs.ENVELOPE_RADIUS, attrs.RADIUS);
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

function unionAabbs(boundsList) {
  if (!boundsList.length) return null;
  return boundsList.reduce((result, bounds) => ({
    min: {
      x: Math.min(result.min.x, bounds.min.x),
      y: Math.min(result.min.y, bounds.min.y),
      z: Math.min(result.min.z, bounds.min.z),
    },
    max: {
      x: Math.max(result.max.x, bounds.max.x),
      y: Math.max(result.max.y, bounds.max.y),
      z: Math.max(result.max.z, bounds.max.z),
    },
  }));
}

function firstFinite(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const number = Number(String(value).replace(/mm|,/giu, '').trim());
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function add(left, right) {
  return { x: left.x + right.x, y: left.y + right.y, z: left.z + right.z };
}

function subtract(left, right) {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
}

function scale(vector, factor) {
  return { x: vector.x * factor, y: vector.y * factor, z: vector.z * factor };
}

function dot(left, right) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function magnitude(vector) {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}
