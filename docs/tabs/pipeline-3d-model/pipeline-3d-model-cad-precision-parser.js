import { parseDepthText } from './pipeline-3d-model-cad-math.js';
import { createPipelineCadPrecisionExpression } from './pipeline-3d-model-cad-precision-contracts.js';

const NUMERIC = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

function clean(value) {
  return String(value ?? '').trim();
}

function parseNumericToken(token) {
  if (!NUMERIC.test(token)) throw new Error(`Invalid numeric precision value: ${token || '(empty)'}.`);
  const value = Number(token);
  if (!Number.isFinite(value)) throw new Error('Precision value must be finite.');
  return value;
}

export function parsePipelineCadPrecisionScalar(raw, options = {}) {
  let token = clean(raw);
  if (!token) throw new Error('Precision value is required.');
  const relative = token.startsWith('@');
  if (relative) token = clean(token.slice(1));
  if (!token) throw new Error('Relative precision value is required after @.');
  if (options.depth === true) {
    const parsed = parseDepthText(token, { aboveGroundZ: options.aboveGroundZ });
    if (!parsed) throw new Error('Depth must be A/G or a numeric value such as 1.5M.');
    return Object.freeze({ value: parsed.z, mode: relative ? 'relative' : 'absolute', unit: 'depth', raw: clean(raw) });
  }
  return Object.freeze({ value: parseNumericToken(token), mode: relative ? 'relative' : 'absolute', unit: '', raw: clean(raw) });
}

export function parsePipelineCadPrecisionExpression(raw, options = {}) {
  const source = clean(raw);
  if (!source) throw new Error('Precision expression is required.');
  const relative = source.startsWith('@');
  const body = relative ? clean(source.slice(1)) : source;
  const tokens = body.split(',').map(clean);
  if (!tokens.length || tokens.length > 2 || tokens.some((token) => !token)) {
    throw new Error('Use one value or an X,Y pair.');
  }
  const depthIndex = Number.isInteger(options.depthIndex) ? options.depthIndex : -1;
  const values = tokens.map((token, index) => parsePipelineCadPrecisionScalar(
    `${relative ? '@' : ''}${token.replace(/^@/, '')}`,
    { depth: index === depthIndex, aboveGroundZ: options.aboveGroundZ },
  ).value);
  return createPipelineCadPrecisionExpression({
    kind: values.length === 2 ? 'pair' : 'scalar',
    mode: relative ? 'relative' : 'absolute',
    raw: source,
    values,
    unit: depthIndex >= 0 ? 'mixed' : '',
  });
}

export function parsePipelineCadPrecisionFields(fields = {}, options = {}) {
  const inputMode = fields.inputMode === 'relative' ? 'relative' : 'absolute';
  const prefix = inputMode === 'relative' ? '@' : '';
  const x = fields.x === '' || fields.x == null ? null
    : parsePipelineCadPrecisionScalar(`${prefix}${clean(fields.x).replace(/^@/, '')}`).value;
  const y = fields.y === '' || fields.y == null ? null
    : parsePipelineCadPrecisionScalar(`${prefix}${clean(fields.y).replace(/^@/, '')}`, {
      depth: options.depth === true,
      aboveGroundZ: options.aboveGroundZ,
    }).value;
  if (x == null && y == null && !clean(fields.label)) throw new Error('Enter at least one value.');
  return Object.freeze({ inputMode, x, y, label: clean(fields.label) });
}

export const _test = Object.freeze({ clean, parseNumericToken });
