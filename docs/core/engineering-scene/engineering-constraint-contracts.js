import { freezeJsonValue } from './engineering-json-value.js';

export const ENGINEERING_GEOMETRY_CONSTRAINT_SCHEMA = 'EngineeringGeometryConstraint.v1';
export const ENGINEERING_GEOMETRY_CONSTRAINT_KIND = Object.freeze({
  AXIS: 'axis',
  PLANE: 'plane',
  PATH: 'path',
  NORMAL: 'normal',
});

function requiredText(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${label} is required.`);
  return result;
}

function axis(value, label) {
  const result = requiredText(value, label).toUpperCase();
  if (!['X', 'Y', 'Z'].includes(result)) throw new TypeError(`${label} must be X, Y or Z.`);
  return result;
}

function planeAxes(values) {
  if (!Array.isArray(values) || values.length !== 2) throw new TypeError('Plane constraint requires exactly two axes.');
  const result = values.map((value, index) => axis(value, `axes[${index}]`));
  if (new Set(result).size !== 2) throw new TypeError('Plane constraint axes must be different.');
  return result;
}

export function createEngineeringGeometryConstraint(input = {}) {
  const kind = input.kind;
  if (!Object.values(ENGINEERING_GEOMETRY_CONSTRAINT_KIND).includes(kind)) {
    throw new TypeError(`Unsupported geometry constraint kind "${kind}".`);
  }
  const axisValue = kind === 'axis' ? axis(input.axis, 'Axis constraint axis') : null;
  const axes = kind === 'plane' ? planeAxes(input.axes) : null;
  const referenceId = ['path', 'normal'].includes(kind)
    ? requiredText(input.referenceId, `${kind} constraint referenceId`)
    : null;
  return freezeJsonValue({
    schema: ENGINEERING_GEOMETRY_CONSTRAINT_SCHEMA,
    kind,
    axis: axisValue,
    axes,
    referenceId,
    metadata: input.metadata ?? {},
  });
}
