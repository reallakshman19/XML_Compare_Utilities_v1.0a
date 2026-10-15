import {
  buildSupportMemberAnalyticalGeometry,
  supportMemberGeometryDistance,
} from './support-member-analytical-geometry.js';
import {
  pointToAabbDistance,
  pointToObbDistance,
} from './support-steel-analytical-geometry.js';
import { cleanText } from './support-steel-source-utils.js';

export const SUPPORT_CARRIER_ANALYTICAL_GEOMETRY_SCHEMA = 'SupportCarrierAnalyticalGeometry.v1';

export function buildSupportCarrierAnalyticalGeometry(carrier = {}) {
  const attributes = normalizeCarrierGeometryAttributes(carrier.attributes || {});
  const geometry = buildSupportMemberAnalyticalGeometry({
    memberId: carrier.carrierObjectId,
    semanticRole: 'PIPE_CARRIER',
    positionGlobal: carrier.positionGlobal || null,
    worldMatrix: carrier.worldMatrix || null,
    transformBasis: carrier.transformBasis || 'IDENTITY',
    attributes,
  });
  return {
    ...geometry,
    schema: SUPPORT_CARRIER_ANALYTICAL_GEOMETRY_SCHEMA,
    carrierObjectId: carrier.carrierObjectId || null,
    carrierObjectClass: carrier.carrierObjectClass || 'PHYSICAL_PIPE_CARRIER',
    outsideRadiusMm: readOutsideRadius(attributes),
    physicalCarrierGeometryAvailable: Boolean(geometry.physicalGeometryAvailable),
  };
}

export function supportToCarrierGeometryDistance(member, carrier) {
  const supportGeometry = member?.analyticalGeometry || member;
  const carrierGeometry = carrier?.analyticalGeometry || carrier;
  if (carrierGeometry?.axis && supportGeometry?.worldObb) {
    return carrierAxisToBoundsDistance(
      supportGeometry.worldObb,
      carrierGeometry,
      true,
    );
  }
  if (carrierGeometry?.axis && supportGeometry?.worldAabb) {
    return carrierAxisToBoundsDistance(
      supportGeometry.worldAabb,
      carrierGeometry,
      false,
    );
  }
  return supportMemberGeometryDistance(member, carrierGeometry);
}

export function normalizeCarrierGeometryAttributes(attrs = {}) {
  const radius = readOutsideRadius(attrs);
  if (!Number.isFinite(radius) || radius <= 0 || finite(attrs.RADIUS) !== null) {
    return { ...attrs };
  }
  return { ...attrs, RADIUS: radius };
}

function carrierAxisToBoundsDistance(bounds, carrierGeometry, obb) {
  const nearest = minimumSegmentToBounds(
    carrierGeometry.axis.start,
    carrierGeometry.axis.end,
    bounds,
    obb,
  );
  if (!nearest) return supportMemberGeometryDistance(bounds, carrierGeometry);
  const radius = Math.max(
    0,
    Number(carrierGeometry.outsideRadiusMm)
      || Number(carrierGeometry.sectionEnvelopeRadiusMm)
      || 0,
  );
  const surfaceGap = Math.max(0, nearest.centerlineDistanceMm - radius);
  const carrierSurfacePoint = carrierSurfacePointTowardSupport(
    nearest.axisPoint,
    nearest.supportPoint,
    radius,
  );
  return {
    distanceMm: round3(surfaceGap),
    contactPointGlobal: midpoint(nearest.supportPoint, carrierSurfacePoint),
    geometryMethod: obb
      ? 'WORLD_SUPPORT_OBB_TO_CARRIER_AXIS_ENVELOPE'
      : 'WORLD_SUPPORT_AABB_TO_CARRIER_AXIS_ENVELOPE',
    geometryQuality: obb ? 'HIGH' : 'MEDIUM',
    analyticalGeometryAvailable: true,
    nearestPointOnLeftGlobal: nearest.supportPoint,
    nearestPointOnRightGlobal: carrierSurfacePoint,
    carrierAxisPointGlobal: nearest.axisPoint,
    carrierOutsideRadiusMm: radius,
    centerlineDistanceMm: round3(nearest.centerlineDistanceMm),
  };
}

function minimumSegmentToBounds(start, end, bounds, obb) {
  const evaluate = (fraction) => {
    const axisPoint = interpolate(start, end, fraction);
    const result = obb
      ? pointToObbDistance(axisPoint, bounds)
      : pointToAabbDistance(axisPoint, bounds);
    return result ? {
      fraction,
      axisPoint,
      supportPoint: result.nearestPoint,
      centerlineDistanceMm: result.distanceMm,
    } : null;
  };
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 48; iteration += 1) {
    const leftFraction = low + (high - low) / 3;
    const rightFraction = high - (high - low) / 3;
    const left = evaluate(leftFraction);
    const right = evaluate(rightFraction);
    if (!left || !right) return null;
    if (left.centerlineDistanceMm <= right.centerlineDistanceMm) high = rightFraction;
    else low = leftFraction;
  }
  return [evaluate(0), evaluate(1), evaluate((low + high) / 2)]
    .filter(Boolean)
    .sort((left, right) => left.centerlineDistanceMm - right.centerlineDistanceMm)[0] || null;
}

function carrierSurfacePointTowardSupport(axisPoint, supportPoint, radius) {
  const delta = subtract(supportPoint, axisPoint);
  const length = magnitude(delta);
  if (!Number.isFinite(length) || length <= 1e-9 || radius <= 0) return axisPoint;
  const travel = Math.min(radius, length);
  return add(axisPoint, scale(delta, travel / length));
}

function readOutsideRadius(attrs) {
  const explicit = firstFinite(
    attrs.OUTSIDE_RADIUS,
    attrs.OUTER_RADIUS,
    attrs.PIPE_RADIUS,
    attrs.RADIUS,
  );
  if (explicit !== null) return Math.max(0, explicit);
  const diameter = firstFinite(
    attrs.OUTSIDE_DIAMETER,
    attrs.OUTER_DIAMETER,
    attrs.PIPE_OD,
    attrs.OD,
    attrs.DIAMETER,
    attrs.NOMINAL_DIAMETER,
    attrs.BORE,
  );
  return diameter === null ? 0 : Math.max(0, diameter / 2);
}

function firstFinite(...values) {
  for (const value of values) {
    const number = finite(value);
    if (number !== null) return number;
  }
  return null;
}

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(cleanText(value).replace(/mm|,/giu, ''));
  return Number.isFinite(number) ? number : null;
}

function interpolate(start, end, fraction) {
  return {
    x: start.x + (end.x - start.x) * fraction,
    y: start.y + (end.y - start.y) * fraction,
    z: start.z + (end.z - start.z) * fraction,
  };
}

function midpoint(left, right) {
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
    z: (left.z + right.z) / 2,
  };
}

function subtract(left, right) {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
}

function add(left, right) {
  return { x: left.x + right.x, y: left.y + right.y, z: left.z + right.z };
}

function scale(value, factor) {
  return { x: value.x * factor, y: value.y * factor, z: value.z * factor };
}

function magnitude(value) {
  return Math.hypot(value.x, value.y, value.z);
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}
