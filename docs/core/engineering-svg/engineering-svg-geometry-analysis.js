import {
  ENGINEERING_GEOMETRY_KIND,
  createEngineeringPoint3D,
  createSegmentGeometry,
} from '../engineering-scene/index.js';

function pointsOf(geometry) {
  if (geometry?.kind === ENGINEERING_GEOMETRY_KIND.POINT) return [geometry.position];
  if (geometry?.kind === ENGINEERING_GEOMETRY_KIND.SEGMENT) return [geometry.start, geometry.end];
  if (geometry?.kind === ENGINEERING_GEOMETRY_KIND.POLYLINE) return geometry.points;
  throw new TypeError(`Unsupported geometry kind "${geometry?.kind}".`);
}

export function engineeringGeometryCentroid(geometry) {
  const points = pointsOf(geometry);
  if (!points.length) throw new TypeError('Geometry centroid requires at least one point.');
  const total = points.reduce((sum, point) => ({
    x: sum.x + point.x,
    y: sum.y + point.y,
    z: sum.z + point.z,
  }), { x: 0, y: 0, z: 0 });
  return createEngineeringPoint3D({
    x: total.x / points.length,
    y: total.y / points.length,
    z: total.z / points.length,
  });
}

export function engineeringPointDelta(start, end) {
  return Object.freeze({
    x: end.x - start.x,
    y: end.y - start.y,
    z: end.z - start.z,
  });
}

export function engineeringDeltaMagnitude(delta) {
  return Math.hypot(delta.x, delta.y, delta.z);
}

export function createEngineeringDifferenceGeometry(original, draft) {
  return createSegmentGeometry(
    engineeringGeometryCentroid(original),
    engineeringGeometryCentroid(draft),
  );
}

export function engineeringGeometriesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
