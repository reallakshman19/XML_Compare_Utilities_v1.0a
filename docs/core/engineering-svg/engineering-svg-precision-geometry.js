import {
  ENGINEERING_GEOMETRY_KIND,
  createEngineeringPoint3D,
  createPointGeometry,
  createPolylineGeometry,
  createSegmentGeometry,
  freezeJsonValue,
  validateEngineeringPrecisionExpression,
} from '../engineering-scene/index.js';
import { engineeringGeometryCentroid, engineeringPointDelta } from './engineering-svg-geometry-analysis.js';

export const ENGINEERING_SVG_PRECISION_MOVEMENT_SCHEMA = 'EngineeringSvgPrecisionMovement.v1';

function precisionAxes(values, arity) {
  if (!Array.isArray(values) || values.length !== arity) {
    throw new TypeError(`Precision movement requires exactly ${arity} axis value(s).`);
  }
  const axes = values.map((value, index) => {
    const axis = String(value ?? '').trim().toUpperCase();
    if (!['X', 'Y', 'Z'].includes(axis)) throw new TypeError(`axes[${index}] must be X, Y or Z.`);
    return axis;
  });
  if (new Set(axes).size !== axes.length) throw new TypeError('Precision movement axes must be unique.');
  return axes;
}

function assertUnit(expression, unit) {
  const expected = String(unit ?? '').trim();
  if (expected && expression.unit && expression.unit !== expected) {
    throw new TypeError(`Precision unit "${expression.unit}" does not match geometry unit "${expected}".`);
  }
}

function pointWithExpression(point, axes, expression) {
  const next = { x: point.x, y: point.y, z: point.z };
  axes.forEach((axis, index) => {
    const key = axis.toLowerCase();
    next[key] = expression.mode === 'relative'
      ? next[key] + expression.values[index]
      : expression.values[index];
  });
  return createEngineeringPoint3D(next);
}

function translatePoint(point, delta) {
  return createEngineeringPoint3D({
    x: point.x + delta.x,
    y: point.y + delta.y,
    z: point.z + delta.z,
  });
}

export function translateEngineeringGeometry(geometry, delta) {
  if (geometry?.kind === ENGINEERING_GEOMETRY_KIND.POINT) {
    return createPointGeometry(translatePoint(geometry.position, delta));
  }
  if (geometry?.kind === ENGINEERING_GEOMETRY_KIND.SEGMENT) {
    return createSegmentGeometry(
      translatePoint(geometry.start, delta),
      translatePoint(geometry.end, delta),
    );
  }
  if (geometry?.kind === ENGINEERING_GEOMETRY_KIND.POLYLINE) {
    return createPolylineGeometry(
      geometry.points.map((point) => translatePoint(point, delta)),
      geometry.closed,
    );
  }
  throw new TypeError(`Unsupported precision geometry kind "${geometry?.kind}".`);
}

export function applyEngineeringPrecisionExpression(point, axesValue, expressionValue) {
  const expression = validateEngineeringPrecisionExpression(expressionValue);
  const axes = precisionAxes(axesValue, expression.values.length);
  return pointWithExpression(point, axes, expression);
}

export function createEngineeringSvgPrecisionMovement(input = {}) {
  const expression = validateEngineeringPrecisionExpression(input.expression);
  const axes = precisionAxes(input.axes, expression.values.length);
  assertUnit(expression, input.unit);
  const beforeCentroid = engineeringGeometryCentroid(input.geometry);
  const targetCentroid = pointWithExpression(beforeCentroid, axes, expression);
  const delta = engineeringPointDelta(beforeCentroid, targetCentroid);
  const draftGeometry = translateEngineeringGeometry(input.geometry, delta);
  return freezeJsonValue({
    schema: ENGINEERING_SVG_PRECISION_MOVEMENT_SCHEMA,
    axes,
    expression,
    beforeCentroid,
    targetCentroid,
    delta,
    originalGeometry: input.geometry,
    draftGeometry,
  });
}
