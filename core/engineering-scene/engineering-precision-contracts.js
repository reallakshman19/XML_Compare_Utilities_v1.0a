import { freezeJsonValue } from './engineering-json-value.js';

export const ENGINEERING_PRECISION_EXPRESSION_SCHEMA = 'EngineeringPrecisionExpression.v1';
export const ENGINEERING_PRECISION_KIND = Object.freeze({
  SCALAR: 'scalar',
  PAIR: 'pair',
  TRIPLE: 'triple',
});
export const ENGINEERING_PRECISION_MODE = Object.freeze({
  ABSOLUTE: 'absolute',
  RELATIVE: 'relative',
});

const ARITY = Object.freeze({ scalar: 1, pair: 2, triple: 3 });

function text(value) {
  return String(value ?? '').trim();
}

function finiteValues(values, kind) {
  if (!Array.isArray(values) || values.length !== ARITY[kind]) {
    throw new TypeError(`${kind} precision expressions require ${ARITY[kind]} value(s).`);
  }
  return values.map((value, index) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(`values[${index}] must be finite.`);
    }
    return value;
  });
}

export function createEngineeringPrecisionExpression(input = {}) {
  const kind = input.kind || 'scalar';
  const mode = input.mode || 'absolute';
  if (!Object.values(ENGINEERING_PRECISION_KIND).includes(kind)) {
    throw new TypeError(`Unsupported precision expression kind "${kind}".`);
  }
  if (!Object.values(ENGINEERING_PRECISION_MODE).includes(mode)) {
    throw new TypeError(`Unsupported precision expression mode "${mode}".`);
  }
  return freezeJsonValue({
    schema: ENGINEERING_PRECISION_EXPRESSION_SCHEMA,
    kind,
    mode,
    raw: text(input.raw),
    values: finiteValues(input.values, kind),
    unit: text(input.unit),
  });
}

export function validateEngineeringPrecisionExpression(value) {
  if (value?.schema !== ENGINEERING_PRECISION_EXPRESSION_SCHEMA) {
    throw new TypeError(`Precision expression schema must be "${ENGINEERING_PRECISION_EXPRESSION_SCHEMA}".`);
  }
  const normalized = createEngineeringPrecisionExpression(value);
  if (value.raw !== normalized.raw || value.unit !== normalized.unit) {
    throw new TypeError('Precision expression raw and unit values must already be normalized strings.');
  }
  return value;
}
