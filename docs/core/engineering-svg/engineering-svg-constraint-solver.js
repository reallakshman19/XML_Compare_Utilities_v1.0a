import {
  ENGINEERING_GEOMETRY_CONSTRAINT_SCHEMA,
  createEngineeringGeometryConstraint,
  freezeJsonValue,
} from '../engineering-scene/index.js';
import { applyEngineeringSvgFit } from './engineering-svg-fit.js';
import { projectEngineeringPoint } from './engineering-svg-projection.js';

export const ENGINEERING_SVG_CONSTRAINT_SOLUTION_SCHEMA = 'EngineeringSvgConstraintSolution.v1';

const AXIS_DIRECTIONS = Object.freeze({
  X: Object.freeze({ x: 1, y: 0, z: 0 }),
  Y: Object.freeze({ x: 0, y: 1, z: 0 }),
  Z: Object.freeze({ x: 0, y: 0, z: 1 }),
});

function finitePoint(value, label) {
  const point = { x: Number(value?.x), y: Number(value?.y) };
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new TypeError(`${label} must contain finite x and y values.`);
  }
  return point;
}

function validFit(value) {
  const fit = {
    scale: Number(value?.scale),
    offsetX: Number(value?.offsetX),
    offsetY: Number(value?.offsetY),
  };
  if (!Number.isFinite(fit.scale) || fit.scale <= 0
    || !Number.isFinite(fit.offsetX) || !Number.isFinite(fit.offsetY)) {
    throw new TypeError('Constraint solving requires a finite positive SVG fit transform.');
  }
  return fit;
}

function normalizeDirection(value, label) {
  const direction = { x: Number(value?.x), y: Number(value?.y), z: Number(value?.z) };
  if (![direction.x, direction.y, direction.z].every(Number.isFinite)) {
    throw new TypeError(`${label} must contain finite x, y and z values.`);
  }
  const length = Math.hypot(direction.x, direction.y, direction.z);
  if (!length) throw new TypeError(`${label} cannot be a zero vector.`);
  return Object.freeze({
    x: direction.x / length,
    y: direction.y / length,
    z: direction.z / length,
  });
}

export function projectEngineeringSvgDirection(directionValue, projection = 'ISO', fitValue) {
  const direction = normalizeDirection(directionValue, 'Projected direction');
  const fit = validFit(fitValue);
  const origin = applyEngineeringSvgFit(projectEngineeringPoint({ x: 0, y: 0, z: 0 }, projection), fit);
  const endpoint = applyEngineeringSvgFit(projectEngineeringPoint(direction, projection), fit);
  const vector = { x: endpoint.x - origin.x, y: endpoint.y - origin.y };
  const length = Math.hypot(vector.x, vector.y);
  if (length <= 1e-12) throw new Error(`Constraint direction is not visible in ${projection} projection.`);
  return Object.freeze({ ...vector, length, direction });
}

function screenDelta(start, current) {
  return Object.freeze({ x: current.x - start.x, y: current.y - start.y });
}

function directionSolution(delta, vector) {
  const parameter = ((delta.x * vector.x) + (delta.y * vector.y)) / (vector.length * vector.length);
  const projected = { x: vector.x * parameter, y: vector.y * parameter };
  return {
    parameters: [parameter],
    worldDelta: {
      x: vector.direction.x * parameter,
      y: vector.direction.y * parameter,
      z: vector.direction.z * parameter,
    },
    screenResidual: { x: delta.x - projected.x, y: delta.y - projected.y },
    projectedVectors: [vector],
  };
}

function planeSolution(delta, axes, vectors) {
  const [first, second] = vectors;
  const determinant = (first.x * second.y) - (first.y * second.x);
  if (Math.abs(determinant) <= 1e-12) throw new Error('Constraint plane is degenerate in the active projection.');
  const firstValue = ((delta.x * second.y) - (delta.y * second.x)) / determinant;
  const secondValue = ((first.x * delta.y) - (first.y * delta.x)) / determinant;
  const worldDelta = { x: 0, y: 0, z: 0 };
  worldDelta[axes[0].toLowerCase()] = firstValue;
  worldDelta[axes[1].toLowerCase()] = secondValue;
  const projected = {
    x: (first.x * firstValue) + (second.x * secondValue),
    y: (first.y * firstValue) + (second.y * secondValue),
  };
  return {
    parameters: [firstValue, secondValue],
    worldDelta,
    screenResidual: { x: delta.x - projected.x, y: delta.y - projected.y },
    projectedVectors: vectors,
  };
}

function referenceDirection(constraint, resolver) {
  if (typeof resolver !== 'function') throw new TypeError(`${constraint.kind} constraint requires resolveReferenceVector.`);
  return normalizeDirection(resolver({
    kind: constraint.kind,
    referenceId: constraint.referenceId,
    constraint,
  }), `${constraint.kind} reference direction`);
}

export function solveEngineeringSvgConstraintDrag(input = {}) {
  const constraint = createEngineeringGeometryConstraint(input.constraint);
  if (constraint.schema !== ENGINEERING_GEOMETRY_CONSTRAINT_SCHEMA) throw new TypeError('Invalid geometry constraint.');
  const projection = input.projection || 'ISO';
  const fit = validFit(input.fit);
  const start = finitePoint(input.start, 'Constraint drag start');
  const current = finitePoint(input.current, 'Constraint drag current');
  const delta = screenDelta(start, current);
  let solution;
  if (constraint.kind === 'plane') {
    const vectors = constraint.axes.map((axis) => projectEngineeringSvgDirection(
      AXIS_DIRECTIONS[axis], projection, fit,
    ));
    solution = planeSolution(delta, constraint.axes, vectors);
  } else {
    const direction = constraint.kind === 'axis'
      ? AXIS_DIRECTIONS[constraint.axis]
      : referenceDirection(constraint, input.resolveReferenceVector);
    solution = directionSolution(delta, projectEngineeringSvgDirection(direction, projection, fit));
  }
  return freezeJsonValue({
    schema: ENGINEERING_SVG_CONSTRAINT_SOLUTION_SCHEMA,
    projection,
    constraint,
    screenDelta: delta,
    ...solution,
  });
}
