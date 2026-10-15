export const STRUCTURED_SEQUENCE_SCHEMA = 'SupportReportStructuredSequence.v1';

export function buildStructuredSequenceContext(locations = [], profile = {}) {
  const points = (locations || [])
    .filter((location) => validPoint(location?.representativePointGlobalMm))
    .map((location) => ({ id: String(location.locationId), point: location.representativePointGlobalMm }));
  if (points.length < 2) return Object.freeze({
    schema: STRUCTURED_SEQUENCE_SCHEMA,
    availableDimensions: Object.freeze(['3D']),
    supports2d: false,
    supports1d: false,
    basis: null,
    lineMaxResidualMm: null,
    planeMaxResidualMm: null,
    locationFeatures: Object.freeze({}),
  });

  const pair = farthestPair(points);
  const axis1 = normalize(subtract(pair.b.point, pair.a.point));
  if (!axis1) return emptyContext();
  const origin = pair.a.point;
  const lineResiduals = points.map((item) => {
    const relative = subtract(item.point, origin);
    const station = dot(relative, axis1);
    const residualVector = subtract(relative, scale(axis1, station));
    return { ...item, station, residualVector, lineResidual: magnitude(residualVector) };
  });
  const maxLine = [...lineResiduals].sort((a, b) => b.lineResidual - a.lineResidual || a.id.localeCompare(b.id))[0];
  const axis2 = maxLine?.lineResidual > 0 ? normalize(maxLine.residualVector) : null;
  const normal = axis2 ? normalize(cross(axis1, axis2)) : null;
  const planeMaxResidualMm = normal
    ? Math.max(...points.map((item) => Math.abs(dot(subtract(item.point, origin), normal))))
    : 0;
  const lineMaxResidualMm = Math.max(...lineResiduals.map((item) => item.lineResidual));
  const linearityToleranceMm = finite(profile.linearityToleranceMm, 0);
  const planarityToleranceMm = finite(profile.planarityToleranceMm, 0);
  const supports1d = lineMaxResidualMm <= linearityToleranceMm;
  const supports2d = Boolean(axis2) && planeMaxResidualMm <= planarityToleranceMm;
  const locationFeatures = {};

  for (const item of lineResiduals) {
    const relative = subtract(item.point, origin);
    const u = dot(relative, axis1);
    const v = axis2 ? dot(relative, axis2) : 0;
    locationFeatures[item.id] = Object.freeze({
      stationMm: u,
      planePointMm: axis2 ? Object.freeze({ u, v }) : null,
      fingerprint3dMm: Object.freeze(distanceFingerprint(points, item.id, (other) => pointDistance(item.point, other.point))),
      fingerprint2dMm: axis2 ? Object.freeze(distanceFingerprint(points, item.id, (other) => {
        const otherRelative = subtract(other.point, origin);
        const du = u - dot(otherRelative, axis1);
        const dv = v - dot(otherRelative, axis2);
        return Math.hypot(du, dv);
      })) : Object.freeze([]),
      fingerprint1dMm: Object.freeze(distanceFingerprint(lineResiduals, item.id, (other) => Math.abs(u - other.station))),
    });
  }

  const availableDimensions = ['3D'];
  if (supports2d) availableDimensions.push('2D');
  if (supports1d) availableDimensions.push('1D');
  return Object.freeze({
    schema: STRUCTURED_SEQUENCE_SCHEMA,
    availableDimensions: Object.freeze(availableDimensions),
    supports2d,
    supports1d,
    basis: Object.freeze({
      origin: freezePoint(origin),
      axis1: freezePoint(axis1),
      axis2: axis2 ? freezePoint(axis2) : null,
      normal: normal ? freezePoint(normal) : null,
    }),
    lineMaxResidualMm,
    planeMaxResidualMm,
    locationFeatures: Object.freeze(locationFeatures),
  });
}

export function compareStructuredSequenceCandidate(leftLocation, rightLocation, leftContext, rightContext, profile = {}) {
  const left = leftContext?.locationFeatures?.[String(leftLocation?.locationId)];
  const right = rightContext?.locationFeatures?.[String(rightLocation?.locationId)];
  const stages = [];
  stages.push(fingerprintStage('3D', left?.fingerprint3dMm || [], right?.fingerprint3dMm || [], finite(profile.geometry3dToleranceMm, Infinity)));
  if (leftContext?.supports2d && rightContext?.supports2d) {
    stages.push(fingerprintStage('2D', left?.fingerprint2dMm || [], right?.fingerprint2dMm || [], finite(profile.geometry2dToleranceMm, Infinity)));
  }
  if (leftContext?.supports1d && rightContext?.supports1d) {
    stages.push(fingerprintStage('1D', left?.fingerprint1dMm || [], right?.fingerprint1dMm || [], finite(profile.stationFingerprintToleranceMm, Infinity)));
  }
  const firstPassing = stages.find((stage) => stage.result === 'PASS') || null;
  return Object.freeze({
    schema: STRUCTURED_SEQUENCE_SCHEMA,
    priority: Object.freeze(['3D', '2D', '1D']),
    stages: Object.freeze(stages),
    firstPassingDimension: firstPassing?.dimension || null,
    leftStationMm: left?.stationMm ?? null,
    rightStationMm: right?.stationMm ?? null,
  });
}

export function memberOrdinalPattern(memberIds = []) {
  return Object.freeze((memberIds || [])
    .map((value) => /\.(\d+)$/u.exec(String(value || '').trim())?.[1])
    .filter((value) => value != null)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b));
}

export function compareMemberOrdinalPatterns(leftIds = [], rightIds = [], profile = {}) {
  const left = memberOrdinalPattern(leftIds);
  const right = memberOrdinalPattern(rightIds);
  if (!left.length || !right.length) return Object.freeze({
    result: 'UNAVAILABLE', left, right, overlapRatio: null, similarity: null,
    reasonCode: 'MEMBER_ORDINAL_PATTERN_UNAVAILABLE',
  });
  const exact = arraysEqual(left, right);
  const overlap = multisetOverlap(left, right);
  const overlapRatio = overlap / Math.max(left.length, right.length);
  const result = exact ? 'EXACT' : overlap ? 'PARTIAL' : 'NONE';
  const scores = profile.memberPatternScores || {};
  const similarity = result === 'EXACT'
    ? finite(scores.exact, 1)
    : result === 'PARTIAL'
      ? finite(scores.partial, 0) * overlapRatio
      : finite(scores.none, 0);
  return Object.freeze({
    result,
    left,
    right,
    overlapRatio,
    similarity,
    reasonCode: exact ? 'MEMBER_ORDINAL_PATTERN_EXACT'
      : overlap ? 'MEMBER_ORDINAL_PATTERN_PARTIAL'
        : 'MEMBER_ORDINAL_PATTERN_DIFFERENT',
  });
}

export function comparePreviousNamePatterns(leftValue, rightValue, profile = {}) {
  const leftNames = nameList(leftValue);
  const rightNames = nameList(rightValue);
  if (!leftNames.length || !rightNames.length) return Object.freeze({
    result: 'UNAVAILABLE', class: 'UNAVAILABLE', similarity: null, wildcardMask: '',
    left: leftNames, right: rightNames, reasonCode: 'PREV_NAME_PATTERN_UNAVAILABLE',
  });
  let best = null;
  for (const left of leftNames) {
    for (const right of rightNames) {
      const candidate = compareNamePair(left, right, profile.prevNamePatternScores || {});
      if (!best || candidate.similarity > best.similarity
        || (candidate.similarity === best.similarity && candidate.class.localeCompare(best.class) < 0)) best = candidate;
    }
  }
  return Object.freeze({
    ...best,
    left: Object.freeze(leftNames),
    right: Object.freeze(rightNames),
  });
}

export function orderedLocationIds(context, direction = 'FORWARD') {
  const entries = Object.entries(context?.locationFeatures || {})
    .filter(([, value]) => Number.isFinite(value?.stationMm))
    .sort((a, b) => a[1].stationMm - b[1].stationMm || a[0].localeCompare(b[0]));
  if (direction === 'REVERSE') entries.reverse();
  return Object.freeze(entries.map(([id]) => id));
}

function fingerprintStage(dimension, left, right, toleranceMm) {
  if (left.length !== right.length) return Object.freeze({
    dimension,
    result: 'FAIL',
    reasonCode: `${dimension}_FINGERPRINT_COUNT_MISMATCH`,
    thresholdMm: toleranceMm,
    residual: null,
  });
  if (!left.length) return Object.freeze({
    dimension,
    result: 'UNAVAILABLE',
    reasonCode: `${dimension}_FINGERPRINT_UNAVAILABLE`,
    thresholdMm: toleranceMm,
    residual: null,
  });
  const residuals = left.map((value, index) => Math.abs(value - right[index])).sort((a, b) => a - b);
  const residual = Object.freeze({ median: quantile(residuals, 0.5), max: residuals[residuals.length - 1] });
  return Object.freeze({
    dimension,
    result: residual.max <= toleranceMm ? 'PASS' : 'FAIL',
    reasonCode: residual.max <= toleranceMm ? `${dimension}_LATTICE_WITHIN_TOLERANCE` : `${dimension}_LATTICE_OUTSIDE_TOLERANCE`,
    thresholdMm: toleranceMm,
    residual,
  });
}

function compareNamePair(left, right, scores) {
  if (left === right) return nameResult('EXACT', left, right, finite(scores.exact, 1));
  const hamming = left.length === right.length
    ? [...left].reduce((count, char, index) => count + (char === right[index] ? 0 : 1), 0)
    : Infinity;
  if (hamming === 1) return nameResult('ONE_POSITION_DIFFERENT', left, right, finite(scores.onePositionDifferent, 0));
  for (const length of [4, 3, 2, 1]) {
    if (left.length >= length && right.length >= length && left.slice(-length) === right.slice(-length)) {
      return nameResult(`SAME_TRAILING_${length}`, left, right, finite(scores[`sameTrailing${length}`], 0));
    }
  }
  const prefix = commonAlphaPrefix(left, right);
  if (prefix.length >= 2) return nameResult('PREFIX_ONLY', left, right, finite(scores.prefixOnly, 0));
  return nameResult('NONE', left, right, finite(scores.none, 0));
}

function nameResult(className, left, right, similarity) {
  return Object.freeze({
    result: className === 'NONE' ? 'NONE' : 'MATCH',
    class: className,
    similarity,
    wildcardMask: wildcardMask(left, right),
    matchedLeft: left,
    matchedRight: right,
    reasonCode: `PREV_NAME_${className}`,
  });
}

function wildcardMask(left, right) {
  const max = Math.max(left.length, right.length);
  const a = left.padStart(max, '*');
  const b = right.padStart(max, '*');
  return [...a].map((char, index) => char === b[index] ? char : '?').join('');
}

function nameList(value) {
  return String(value ?? '').split(',').map(normalizeName).filter(Boolean);
}
function normalizeName(value) {
  return String(value || '').trim().replace(/^\/+/, '').replace(/\(REF\)$/iu, '').toUpperCase();
}
function commonAlphaPrefix(left, right) {
  const a = /^([A-Z]+)/u.exec(left)?.[1] || '';
  const b = /^([A-Z]+)/u.exec(right)?.[1] || '';
  let index = 0;
  while (index < a.length && index < b.length && a[index] === b[index]) index += 1;
  return a.slice(0, index);
}
function distanceFingerprint(items, ownId, distance) {
  return items.filter((other) => String(other.id) !== String(ownId))
    .map(distance).filter(Number.isFinite).sort((a, b) => a - b);
}
function farthestPair(points) {
  let best = { a: points[0], b: points[1], distance: -Infinity, key: '' };
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const distance = pointDistance(points[i].point, points[j].point);
      const key = [points[i].id, points[j].id].sort().join('\u0000');
      if (distance > best.distance || (distance === best.distance && key < best.key)) best = { a: points[i], b: points[j], distance, key };
    }
  }
  return best;
}
function multisetOverlap(left, right) {
  const counts = new Map();
  for (const value of left) counts.set(value, (counts.get(value) || 0) + 1);
  let overlap = 0;
  for (const value of right) {
    const count = counts.get(value) || 0;
    if (count > 0) { overlap += 1; counts.set(value, count - 1); }
  }
  return overlap;
}
function arraysEqual(left, right) { return left.length === right.length && left.every((value, index) => value === right[index]); }
function pointDistance(a, b) { return validPoint(a) && validPoint(b) ? Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) : NaN; }
function subtract(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function scale(a, value) { return { x: a.x * value, y: a.y * value, z: a.z * value }; }
function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross(a, b) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
function magnitude(a) { return Math.hypot(a.x, a.y, a.z); }
function normalize(a) { const value = magnitude(a); return value > 0 ? scale(a, 1 / value) : null; }
function freezePoint(point) { return Object.freeze({ x: point.x, y: point.y, z: point.z }); }
function validPoint(point) { return point && [point.x, point.y, point.z].every(Number.isFinite); }
function finite(value, fallback) { return Number.isFinite(Number(value)) ? Number(value) : fallback; }
function quantile(sorted, ratio) { if (!sorted.length) return null; return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))]; }
function emptyContext() { return Object.freeze({ schema: STRUCTURED_SEQUENCE_SCHEMA, availableDimensions: Object.freeze(['3D']), supports2d: false, supports1d: false, basis: null, lineMaxResidualMm: null, planeMaxResidualMm: null, locationFeatures: Object.freeze({}) }); }

export const _test = Object.freeze({ compareNamePair, wildcardMask, farthestPair });
