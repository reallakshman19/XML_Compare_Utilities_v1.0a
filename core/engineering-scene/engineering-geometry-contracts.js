import { freezeJsonValue } from './engineering-json-value.js';

export const ENGINEERING_COORDINATE_SYSTEM_SCHEMA = 'EngineeringCoordinateSystem.v1';
export const ENGINEERING_POINT_SCHEMA = 'EngineeringPoint3D.v1';
export const ENGINEERING_GEOMETRY_SCHEMA = 'EngineeringGeometry.v1';
export const ENGINEERING_VERTICAL_AXIS = Object.freeze(['X', 'Y', 'Z']);
export const ENGINEERING_HANDEDNESS = Object.freeze(['left', 'right']);
export const ENGINEERING_GEOMETRY_KIND = Object.freeze({
  POINT: 'point',
  SEGMENT: 'segment',
  POLYLINE: 'polyline',
});

function requiredText(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${label} is required.`);
  return result;
}

function finiteCoordinate(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number.`);
  }
  return value;
}

export function createEngineeringPoint3D(input = {}) {
  return freezeJsonValue({
    schema: ENGINEERING_POINT_SCHEMA,
    x: finiteCoordinate(input.x, 'x'),
    y: finiteCoordinate(input.y, 'y'),
    z: finiteCoordinate(input.z, 'z'),
  });
}

export function createEngineeringCoordinateSystem(input = {}) {
  const unit = requiredText(input.unit ?? 'mm', 'Coordinate-system unit');
  const frame = requiredText(input.frame ?? 'GLOBAL', 'Coordinate-system frame');
  const verticalAxis = input.verticalAxis ?? 'Z';
  const handedness = input.handedness ?? 'right';
  if (!ENGINEERING_VERTICAL_AXIS.includes(verticalAxis)) throw new TypeError(`Unsupported vertical axis "${verticalAxis}".`);
  if (!ENGINEERING_HANDEDNESS.includes(handedness)) throw new TypeError(`Unsupported handedness "${handedness}".`);
  return freezeJsonValue({
    schema: ENGINEERING_COORDINATE_SYSTEM_SCHEMA,
    unit,
    verticalAxis,
    frame,
    handedness,
  });
}

export function createPointGeometry(position) {
  return freezeJsonValue({
    schema: ENGINEERING_GEOMETRY_SCHEMA,
    kind: ENGINEERING_GEOMETRY_KIND.POINT,
    position: createEngineeringPoint3D(position),
  });
}

export function createSegmentGeometry(start, end) {
  return freezeJsonValue({
    schema: ENGINEERING_GEOMETRY_SCHEMA,
    kind: ENGINEERING_GEOMETRY_KIND.SEGMENT,
    start: createEngineeringPoint3D(start),
    end: createEngineeringPoint3D(end),
  });
}

export function createPolylineGeometry(points = [], closed = false) {
  if (!Array.isArray(points) || points.length < 2) throw new TypeError('Polyline geometry requires at least two points.');
  return freezeJsonValue({
    schema: ENGINEERING_GEOMETRY_SCHEMA,
    kind: ENGINEERING_GEOMETRY_KIND.POLYLINE,
    points: points.map((point) => createEngineeringPoint3D(point)),
    closed: closed === true,
  });
}
