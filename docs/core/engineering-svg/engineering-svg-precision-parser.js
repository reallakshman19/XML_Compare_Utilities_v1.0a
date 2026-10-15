import { createEngineeringPrecisionExpression } from '../engineering-scene/index.js';

const NUMERIC = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
const KIND_BY_ARITY = Object.freeze({ 1: 'scalar', 2: 'pair', 3: 'triple' });

function clean(value) {
  return String(value ?? '').trim();
}

function parseNumericToken(token) {
  if (!NUMERIC.test(token)) {
    throw new TypeError(`Invalid numeric precision value: ${token || '(empty)'}.`);
  }
  const value = Number(token);
  if (!Number.isFinite(value)) throw new TypeError('Precision value must be finite.');
  return value;
}

export function parseEngineeringPrecisionExpression(raw, options = {}) {
  const source = clean(raw);
  if (!source) throw new TypeError('Precision expression is required.');
  const relative = source.startsWith('@');
  const body = relative ? clean(source.slice(1)) : source;
  if (!body) throw new TypeError('Relative precision value is required after @.');
  const tokens = body.split(',').map(clean);
  if (!KIND_BY_ARITY[tokens.length] || tokens.some((token) => !token)) {
    throw new TypeError('Use one, two, or three comma-separated precision values.');
  }
  return createEngineeringPrecisionExpression({
    kind: KIND_BY_ARITY[tokens.length],
    mode: relative ? 'relative' : 'absolute',
    raw: source,
    values: tokens.map(parseNumericToken),
    unit: clean(options.unit),
  });
}

export function parseEngineeringPrecisionScalar(raw, options = {}) {
  const expression = parseEngineeringPrecisionExpression(raw, options);
  if (expression.kind !== 'scalar') throw new TypeError('Scalar precision input requires exactly one value.');
  return expression;
}

export const ENGINEERING_PRECISION_NUMERIC_PATTERN = NUMERIC;
