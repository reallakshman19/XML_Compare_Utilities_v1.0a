export const SUPPORT_REV_COMPARE_POLICY_V1 = Object.freeze({
  policyId: 'SUPPORT_REV_COMPARE_POLICY_V1',
  version: '1.0.0',
  coordinate: Object.freeze({ roundingToleranceMm: 1, relocationToleranceMm: 5, anchorResidualLimitMm: 25 }),
  candidate: Object.freeze({ likelyScore: 55, ambiguityMargin: 8, coordinateNearMm: 50 }),
});

const clean = (value) => String(value ?? '').trim();
const upper = (value) => clean(value).toUpperCase();

export function parsePipeIdentity(rawValue) {
  const raw = clean(rawValue);
  const normalizedRaw = raw.replace(/&quot;/gi, '"').replace(/[“”]/g, '"');
  const tokens = normalizedRaw.split('-').map(clean).filter(Boolean);
  const area = tokens.length >= 2 ? `${tokens[0]}-${tokens[1]}` : (tokens[0] || '');
  const scope = tokens[2] || '';
  const nps = ((tokens[3] || normalizedRaw).match(/(\d+(?:\.\d+)?)\s*"?/) || [])[1] || '';
  const lineToken = tokens[4] || '';
  const lineMatch = lineToken.match(/^([A-Za-z]+)?(\d+)$/);
  const service = lineMatch?.[1] || '';
  const lineNumber = lineMatch?.[2] || lineToken;
  const sequence = /^\d+$/.test(tokens.at(-1) || '') ? tokens.at(-1) : '';
  const middle = tokens.slice(5, sequence ? -1 : undefined);
  const qualifier = middle.find((token) => /^(PP|HOT|HT)$/i.test(token)) || '';
  const classSpec = middle.filter((token) => upper(token) !== upper(qualifier)).join('-');
  const normalizedCore = [area, scope, nps, service, lineNumber].map(upper).join('|');
  return Object.freeze({ raw, normalizedRaw, area, scope, nps, service, lineNumber, classSpec, qualifier, sequence, normalizedCore, normalizedFull: [normalizedCore, upper(classSpec), upper(qualifier), sequence].join('|'), tokens: Object.freeze(tokens) });
}

export function pipeTokenChanges(before, after) {
  const a = before?.normalizedCore ? before : parsePipeIdentity(before?.raw ?? before);
  const b = after?.normalizedCore ? after : parsePipeIdentity(after?.raw ?? after);
  const fields = ['area', 'scope', 'nps', 'service', 'lineNumber', 'classSpec', 'qualifier', 'sequence'];
  return Object.freeze(fields.flatMap((field) => upper(a[field]) === upper(b[field]) ? [] : [{ field, before: a[field], after: b[field] }]));
}

export function parseEngineeringCoordinate(rawValue, axis = '') {
  const raw = clean(rawValue);
  if (!raw) return coordinateResult({ raw, axis: upper(axis), formatKey: 'EMPTY' });
  const direction = (raw.match(/\b([NSEW])\b/i) || raw.match(/^\s*([NSEW])/i))?.[1]?.toUpperCase() || '';
  const match = raw.replace(/,/g, '').match(/[-+]?\d+(?:\.\d+)?/);
  const number = match ? Number(match[0]) : null;
  const unitMatch = raw.match(/\b(mm|millimet(?:er|re)s?|m|met(?:er|re)s?)\b/i);
  const units = unitMatch?.[1]?.toLowerCase() || 'mm';
  const factor = /^m(?:$|et)/i.test(units) ? 1000 : 1;
  const magnitude = Number.isFinite(number) ? Math.abs(number) * factor : null;
  const explicitSign = Number.isFinite(number) ? Math.sign(number) || 1 : 0;
  const directionSign = ({ N: 1, E: 1, S: -1, W: -1 })[direction] || 0;
  const mm = Number.isFinite(number) ? number * factor : null;
  const directedMm = magnitude == null ? null : (directionSign ? directionSign * magnitude : mm);
  return coordinateResult({ raw, axis: upper(axis), direction, explicitSign, magnitude, units, mm, directedMm, formatKey: `${direction || 'NONE'}|${explicitSign < 0 ? '-' : '+'}|${units}` });
}

function coordinateResult(values = {}) {
  return Object.freeze({ direction: '', explicitSign: 0, magnitude: null, units: '', mm: null, directedMm: null, ...values });
}

export function parseSupportPosition(fields = {}) {
  return Object.freeze({
    x: parseEngineeringCoordinate(fields.eastWestRaw ?? fields.eastWest ?? '', 'X'),
    y: parseEngineeringCoordinate(fields.northSouthRaw ?? fields.northSouth ?? '', 'Y'),
    z: parseEngineeringCoordinate(fields.bopRaw ?? fields.bop ?? '', 'Z'),
  });
}

export function solveRevisionCoordinateFrame(anchorPairs = [], policy = SUPPORT_REV_COMPARE_POLICY_V1) {
  const axes = Object.freeze(Object.fromEntries(['x', 'y', 'z'].map((axis) => [axis, solveAxis(anchorPairs, axis, policy)])));
  const usable = Object.values(axes).filter((axis) => axis.anchorCount > 0);
  return Object.freeze({ schema: 'support-revision-coordinate-frame/v1', policyId: policy.policyId, axes, anchorCount: Math.max(0, ...usable.map((axis) => axis.anchorCount), 0), status: usable.length ? 'SOLVED' : 'UNPROVEN_DEFAULT' });
}

function solveAxis(anchorPairs, axis, policy) {
  const points = anchorPairs.flatMap((pair) => {
    const source = pair?.source?.position?.[axis]?.directedMm;
    const target = pair?.target?.position?.[axis]?.directedMm;
    return Number.isFinite(source) && Number.isFinite(target) ? [{ source, target }] : [];
  });
  if (!points.length) return Object.freeze({ sign: 1, offsetMm: 0, medianResidualMm: null, anchorCount: 0, status: 'DEFAULT' });
  const best = [1, -1].map((sign) => axisCandidate(points, sign)).sort((a, b) => a.medianResidualMm - b.medianResidualMm || b.sign - a.sign)[0];
  return Object.freeze({ ...best, anchorCount: points.length, status: best.medianResidualMm <= policy.coordinate.anchorResidualLimitMm ? 'VALIDATED' : 'HIGH_RESIDUAL' });
}

function axisCandidate(points, sign) {
  const offsetMm = median(points.map(({ source, target }) => source - (sign * target)));
  const residuals = points.map(({ source, target }) => Math.abs(source - ((sign * target) + offsetMm)));
  return { sign, offsetMm, medianResidualMm: median(residuals) };
}

export function applyCoordinateFrame(position, frame) {
  return Object.freeze(Object.fromEntries(['x', 'y', 'z'].map((axis) => {
    const raw = position?.[axis]?.directedMm;
    const transform = frame?.axes?.[axis] || { sign: 1, offsetMm: 0 };
    return [axis, Number.isFinite(raw) ? (transform.sign * raw) + Number(transform.offsetMm || 0) : null];
  })));
}

export function coordinateDelta(sourcePosition, targetPosition, frame, policy = SUPPORT_REV_COMPARE_POLICY_V1) {
  const source = Object.fromEntries(['x', 'y', 'z'].map((axis) => [axis, sourcePosition?.[axis]?.directedMm ?? null]));
  const target = applyCoordinateFrame(targetPosition, frame);
  const deltas = Object.freeze(Object.fromEntries(['x', 'y', 'z'].map((axis) => [axis, Number.isFinite(source[axis]) && Number.isFinite(target[axis]) ? target[axis] - source[axis] : null])));
  const finite = Object.values(deltas).filter(Number.isFinite);
  const residualMm = finite.length ? Math.sqrt(finite.reduce((sum, value) => sum + (value * value), 0)) : null;
  const rawChanged = ['x', 'y', 'z'].some((axis) => clean(sourcePosition?.[axis]?.raw) !== clean(targetPosition?.[axis]?.raw));
  return Object.freeze({ source, target, deltas, residualMm, rawChanged, classification: coordinateClassification(rawChanged, residualMm, policy) });
}

function coordinateClassification(rawChanged, residualMm, policy) {
  if (rawChanged && residualMm != null && residualMm <= policy.coordinate.roundingToleranceMm) return 'FORMAT_CHANGED';
  if (residualMm != null && residualMm <= policy.coordinate.relocationToleranceMm) return residualMm > policy.coordinate.roundingToleranceMm ? 'ROUNDING_ONLY' : 'UNCHANGED';
  if (residualMm != null) return 'ACTUAL_POSITION_CHANGED';
  return rawChanged ? 'FORMAT_CHANGED' : 'UNCHANGED';
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export const _test = Object.freeze({ median, coordinateClassification });
