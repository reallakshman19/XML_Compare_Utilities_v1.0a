import {
  ENGINEERING_GEOMETRY_KIND,
  ENGINEERING_SCENE_PROJECTION,
} from '../engineering-scene/index.js';

const COS_30 = Math.sqrt(3) / 2;
const SIN_30 = 0.5;

function assertProjection(projection) {
  if (!ENGINEERING_SCENE_PROJECTION.includes(projection)) {
    throw new TypeError(`Unsupported SVG projection "${projection}".`);
  }
  return projection;
}

export function projectEngineeringPoint(point, projection = 'ISO') {
  assertProjection(projection);
  if (projection === 'XY') return Object.freeze({ x: point.x, y: point.y, depth: point.z });
  if (projection === 'XZ') return Object.freeze({ x: point.x, y: point.z, depth: point.y });
  if (projection === 'YZ') return Object.freeze({ x: point.y, y: point.z, depth: point.x });
  return Object.freeze({
    x: (point.x - point.y) * COS_30,
    y: point.z + ((point.x + point.y) * SIN_30),
    depth: point.x + point.y + point.z,
  });
}

function projectPoints(points, projection) {
  return points.map((point) => projectEngineeringPoint(point, projection));
}

export function projectEngineeringGeometry(geometry, projection = 'ISO') {
  if (geometry == null) return null;
  if (geometry.kind === ENGINEERING_GEOMETRY_KIND.POINT) {
    return Object.freeze({ kind: 'point', points: projectPoints([geometry.position], projection) });
  }
  if (geometry.kind === ENGINEERING_GEOMETRY_KIND.SEGMENT) {
    return Object.freeze({ kind: 'segment', points: projectPoints([geometry.start, geometry.end], projection) });
  }
  if (geometry.kind === ENGINEERING_GEOMETRY_KIND.POLYLINE) {
    return Object.freeze({ kind: 'polyline', points: projectPoints(geometry.points, projection), closed: geometry.closed === true });
  }
  throw new TypeError(`Unsupported engineering geometry kind "${geometry.kind}".`);
}

export function projectedGeometryPoints(projectedGeometry) {
  return projectedGeometry?.points ? [...projectedGeometry.points] : [];
}

export const ENGINEERING_SVG_ISO_CONSTANTS = Object.freeze({ COS_30, SIN_30 });
