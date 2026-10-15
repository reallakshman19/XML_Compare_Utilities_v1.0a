import {
  extractLineKey,
  normalizeAppliesToConfig,
  normalizePipeName,
  text,
} from './navis-tag-applies-to-directive.js';

export function finitePoint(point) {
  return [point?.x, point?.y, point?.z].every((value) => Number.isFinite(Number(value)));
}

function axisFromDelta(deltaE, deltaN, config, basis) {
  const e = Math.abs(Number(deltaE) || 0);
  const n = Math.abs(Number(deltaN) || 0);
  const span = Math.max(e, n);
  if (span < config.appliesToMinimumAxisSpanMm) return { axis: 'UNKNOWN', spanE: e, spanN: n, basis };
  if (e >= n * config.appliesToAxisDominanceRatio) return { axis: 'E-W', spanE: e, spanN: n, basis };
  if (n >= e * config.appliesToAxisDominanceRatio) return { axis: 'N-S', spanE: e, spanN: n, basis };
  return { axis: 'AMBIGUOUS', spanE: e, spanN: n, basis };
}

export function inferPipeAxis(rows = [], anchorPoint = null, inputConfig = {}) {
  const config = normalizeAppliesToConfig(inputConfig);
  const points = [];
  const seen = new Set();
  for (const row of rows || []) {
    const point = row?.supportPosition || row?.position || row;
    if (!finitePoint(point)) continue;
    const key = [point.x, point.y, point.z].map((value) => Number(value).toFixed(3)).join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    points.push({ x: Number(point.x), y: Number(point.y), z: Number(point.z) });
  }
  if (points.length < 2) return { axis: 'UNKNOWN', spanE: 0, spanN: 0, pointCount: points.length, basis: 'INSUFFICIENT_SUPPORT_POINTS' };
  if (finitePoint(anchorPoint)) {
    const ranked = [...points].sort((a, b) => Math.hypot(a.x - anchorPoint.x, a.y - anchorPoint.y) - Math.hypot(b.x - anchorPoint.x, b.y - anchorPoint.y));
    const first = ranked[0];
    const second = ranked.find((point) => point.x !== first.x || point.y !== first.y);
    if (second) return { ...axisFromDelta(second.x - first.x, second.y - first.y, config, 'LOCAL_NEAREST_SUPPORT_VECTOR'), pointCount: points.length };
  }
  const eastings = points.map((point) => point.x);
  const northings = points.map((point) => point.y);
  return {
    ...axisFromDelta(Math.max(...eastings) - Math.min(...eastings), Math.max(...northings) - Math.min(...northings), config, 'PIPE_SUPPORT_EXTENT'),
    pointCount: points.length,
  };
}

function decisionOrder(left, right) {
  return Number(left?.tableRowIndex || 0) - Number(right?.tableRowIndex || 0)
    || text(left?.tableRowId).localeCompare(text(right?.tableRowId));
}

export function buildPipeGroups(decisions = []) {
  const groups = new Map();
  for (const decision of decisions) {
    if (!finitePoint(decision?.supportPosition) || !text(decision?.resolvedPipe)) continue;
    const key = normalizePipeName(decision.resolvedPipe);
    if (!groups.has(key)) groups.set(key, { key, pipeName: decision.resolvedPipe, decisions: [] });
    groups.get(key).decisions.push(decision);
  }
  return [...groups.values()]
    .map((group) => ({ ...group, decisions: [...group.decisions].sort(decisionOrder) }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

export function resolveTargetGroups(requestedPipe, groups, config) {
  const normalized = normalizePipeName(requestedPipe);
  const exact = groups.filter((group) => group.key === normalized);
  if (exact.length) return { groups: exact, basis: 'FULL_PIPE_NAME_EXACT', requestedLineKey: '', regexError: '' };
  const requested = extractLineKey(requestedPipe, config);
  if (!requested.key) return { groups: [], basis: 'LINE_KEY_UNAVAILABLE', requestedLineKey: '', regexError: requested.regexError };
  const fallback = groups.filter((group) => extractLineKey(group.pipeName, config).key === requested.key);
  return { groups: fallback, basis: fallback.length ? 'LINE_KEY_FALLBACK' : 'LINE_KEY_NOT_FOUND', requestedLineKey: requested.key, regexError: requested.regexError };
}

export function resolveAllTargetGroups(sourceDecision, groups, inputConfig = {}) {
  const config = normalizeAppliesToConfig(inputConfig);
  const sourceKey = normalizePipeName(sourceDecision?.resolvedPipe);
  const candidates = config.appliesToAllExcludeSourcePipe
    ? groups.filter((group) => group.key !== sourceKey)
    : [...groups];
  const candidateRowCount = candidates.reduce((sum, group) => sum + group.decisions.length, 0);
  return {
    groups: candidateRowCount > config.appliesToAllMaxTargetRows ? [] : candidates,
    basis: 'ALL_PARALLEL_PIPE_GROUPS',
    sourcePipeExcluded: config.appliesToAllExcludeSourcePipe,
    candidatePipeCount: candidates.length,
    candidateRowCount,
    limitExceeded: candidateRowCount > config.appliesToAllMaxTargetRows,
  };
}

export function coordinateWindow(axis, source, target, inputConfig = {}) {
  const config = normalizeAppliesToConfig(inputConfig);
  const deltaE = Number(target.x) - Number(source.x);
  const deltaN = Number(target.y) - Number(source.y);
  const deltaEl = Number(target.z) - Number(source.z);
  const alongAxisDeltaMm = axis === 'N-S' ? Math.abs(deltaN) : Math.abs(deltaE);
  const parallelOffsetMm = axis === 'N-S' ? Math.abs(deltaE) : Math.abs(deltaN);
  const elevationDeltaMm = Math.abs(deltaEl);
  const rejectionReasons = [];
  if (alongAxisDeltaMm > config.appliesToAlongAxisToleranceMm) rejectionReasons.push('ALONG_AXIS_OUTSIDE_TOLERANCE');
  if (parallelOffsetMm > config.appliesToParallelOffsetToleranceMm) rejectionReasons.push('PARALLEL_OFFSET_OUTSIDE_TOLERANCE');
  if (elevationDeltaMm > config.appliesToElevationToleranceMm) rejectionReasons.push('ELEVATION_OUTSIDE_TOLERANCE');
  return { deltaE, deltaN, deltaEl, alongAxisDeltaMm, parallelOffsetMm, elevationDeltaMm, rejectionReasons };
}
