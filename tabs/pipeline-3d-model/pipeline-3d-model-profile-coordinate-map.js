import { buildSegments } from './pipeline-3d-model-geometry.js';
import { addPipelineWarning } from './pipeline-3d-model-warning-log.js';

const EPSILON = 1e-6;
const ROUTE_TOLERANCE = 0.5;

function finite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${label} must be finite.`);
  return number;
}

export function roundProfileValue(value, places = 3) {
  const factor = 10 ** places;
  return Math.round(finite(value, 'value') * factor) / factor;
}

export function formatProfileValue(value, places = 3) {
  if (!Number.isFinite(Number(value))) return '—';
  return Number(value).toFixed(places).replace(/\.?0+$/, '');
}

function edgePair(anchors, value, key) {
  const sorted = [...anchors].sort((a, b) => a[key] - b[key]);
  if (sorted.length < 2) throw new Error('At least two coordinate anchors are required.');
  if (value <= sorted[0][key]) return [sorted[0], sorted[1]];
  if (value >= sorted.at(-1)[key]) return [sorted.at(-2), sorted.at(-1)];
  for (let index = 0; index < sorted.length - 1; index += 1) {
    if (value >= sorted[index][key] && value <= sorted[index + 1][key]) return [sorted[index], sorted[index + 1]];
  }
  throw new Error(`Could not bracket ${key} ${value}.`);
}

export function interpolateProfileMap(value, map, xKey, yKey) {
  const input = finite(value, xKey);
  const [a, b] = edgePair(map?.anchors || [], input, xKey);
  const span = b[xKey] - a[xKey];
  if (Math.abs(span) <= EPSILON) return a[yKey];
  return a[yKey] + ((input - a[xKey]) / span) * (b[yKey] - a[yKey]);
}

export function fitStationAlignment(stationMap, warnings = []) {
  const anchors = stationMap?.anchors || [];
  if (anchors.length < 2) throw new Error('At least two station/H anchors are required.');
  const count = anchors.length;
  const meanH = anchors.reduce((sum, row) => sum + row.absoluteH, 0) / count;
  const meanStation = anchors.reduce((sum, row) => sum + row.cumulative, 0) / count;
  let covariance = 0;
  let variance = 0;
  for (const row of anchors) {
    covariance += (row.absoluteH - meanH) * (row.cumulative - meanStation);
    variance += (row.absoluteH - meanH) ** 2;
  }
  if (variance <= EPSILON) throw new Error('Station/H anchors have no usable H span.');
  const slope = covariance / variance;
  const intercept = meanStation - slope * meanH;
  const residuals = anchors.map((row) => Math.abs((slope * row.absoluteH + intercept) - row.cumulative));
  const maxResidual = Math.max(...residuals);
  if (slope <= 0 || maxResidual > 0.5) {
    addPipelineWarning(
      warnings,
      'station_alignment_quality',
      `Station/H alignment is weak (slope ${slope.toFixed(6)}, max residual ${maxResidual.toFixed(3)} m). Output was generated for review.`,
      { slope, maxResidual, anchorCount: anchors.length },
    );
  }
  return Object.freeze({ slope, intercept, maxResidual });
}

export function stationFromAbsoluteH(absoluteH, stationMap) {
  return interpolateProfileMap(absoluteH, stationMap, 'absoluteH', 'cumulative');
}

export function cumulativeFromAbsoluteH(absoluteH, coordinateMap, warnings = []) {
  const h = finite(absoluteH, 'absoluteH');
  const clamped = Math.min(coordinateMap.absoluteHMax, Math.max(coordinateMap.absoluteHMin, h));
  if (Math.abs(clamped - h) > EPSILON) {
    addPipelineWarning(
      warnings,
      'table3_h_clamped',
      `Table 3 H ${formatProfileValue(h)} is outside [${formatProfileValue(coordinateMap.absoluteHMin)}, ${formatProfileValue(coordinateMap.absoluteHMax)}] and was clamped for output.`,
      { requestedH: h, usedH: clamped },
    );
  }
  return interpolateProfileMap(clamped, coordinateMap, 'absoluteH', 'cumulative');
}

function routeLength(segments) {
  return segments.length ? segments.at(-1).end : 0;
}

export function validateRouteDistance(distance, total, label, warnings = []) {
  const value = finite(distance, label);
  const clamped = Math.min(total, Math.max(0, value));
  if (value < -ROUTE_TOLERANCE || value > total + ROUTE_TOLERANCE) {
    addPipelineWarning(
      warnings,
      'route_distance_clamped',
      `${label} ${formatProfileValue(value)} is outside the Table 1 route [0, ${formatProfileValue(total)}] and was clamped for output.`,
      { label, requestedDistance: value, usedDistance: clamped, routeLength: total },
    );
  }
  return clamped;
}

export function buildProfileRouteContext(table1Points, profile) {
  if (table1Points.length < 2) throw new Error('Table 1 must contain at least two route points.');
  const warnings = [];
  const segments = buildSegments(table1Points);
  const total = routeLength(segments);
  const alignment = fitStationAlignment(profile.table2StationMap, warnings);
  const routeStartStation = alignment.slope * table1Points[0].x + alignment.intercept;
  const originH = profile.coordinateMap.anchors[0].absoluteH;
  const originStation = stationFromAbsoluteH(originH, profile.table2StationMap);
  return {
    segments,
    total,
    routeStartStation,
    table3OriginRoute: originStation - routeStartStation,
    stationAlignment: alignment,
    warnings,
  };
}

export function table2RouteDistance(row, context) {
  const distance = row.stationValue - context.routeStartStation;
  return validateRouteDistance(distance, context.total, `Table 2 station ${row.stationText}`, context.warnings);
}

export function table3RouteDistance(absoluteH, profile, context) {
  const local = cumulativeFromAbsoluteH(absoluteH, profile.coordinateMap, context.warnings);
  const distance = context.table3OriginRoute + local;
  return validateRouteDistance(distance, context.total, `Table 3 H ${absoluteH}`, context.warnings);
}

function warnGradeCoverage(rows, context) {
  if (!rows.length) return;
  const coverageStart = rows[0].distance;
  const coverageEnd = rows.at(-1).distance;
  if (coverageStart <= ROUTE_TOLERANCE && coverageEnd >= context.total - ROUTE_TOLERANCE) return;
  addPipelineWarning(
    context.warnings,
    'grade_profile_extrapolated',
    `Table 2 grade coverage ${formatProfileValue(coverageStart)}–${formatProfileValue(coverageEnd)} m does not span the Table 1 route 0–${formatProfileValue(context.total)} m. End elevations were held outside the surveyed range.`,
    {
      routeStart: 0,
      routeEnd: context.total,
      coverageStart,
      coverageEnd,
      heldStartElevation: rows[0].elevation,
      heldEndElevation: rows.at(-1).elevation,
    },
  );
}

export function buildGradeProfile(profile, context) {
  const rows = profile.table2Rows
    .filter((row) => Number.isFinite(row.stationValue) && Number.isFinite(row.elevationValue))
    .map((row) => ({
      distance: table2RouteDistance(row, context),
      elevation: row.elevationValue,
      station: row.stationValue,
      label: `EL ${Number(row.stationValue).toFixed(1)}`,
      sourceId: row.id,
    }))
    .sort((a, b) => a.distance - b.distance);
  warnGradeCoverage(rows, context);
  return rows;
}

export function interpolateGrade(rows, distance) {
  if (!rows.length) throw new Error('At least one Table 2 elevation row is required.');
  if (distance <= rows[0].distance) return rows[0].elevation;
  if (distance >= rows.at(-1).distance) return rows.at(-1).elevation;
  for (let index = 0; index < rows.length - 1; index += 1) {
    const a = rows[index];
    const b = rows[index + 1];
    if (distance < a.distance || distance > b.distance) continue;
    const span = b.distance - a.distance;
    const ratio = span <= EPSILON ? 0 : (distance - a.distance) / span;
    return a.elevation + ratio * (b.elevation - a.elevation);
  }
  return rows.at(-1).elevation;
}

function normalizeDepthRule(row, profile, context) {
  const fallback = row.absoluteH ?? row.textPositionH;
  const startH = Number.isFinite(row.fromH) ? row.fromH : fallback;
  const endH = Number.isFinite(row.toH) ? row.toH : fallback;
  if (!Number.isFinite(startH) || !Number.isFinite(endH) || !row.zMode) return null;
  const start = table3RouteDistance(startH, profile, context);
  const end = table3RouteDistance(endH, profile, context);
  return {
    id: row.id,
    start: Math.min(start, end),
    end: Math.max(start, end),
    zOffset: finite(row.z, `${row.id}.z`),
    zText: row.zText,
    mode: row.zMode,
    pointOnly: Math.abs(end - start) <= EPSILON,
  };
}

export function buildDepthRules(profile, context) {
  return profile.table3DepthRows
    .map((row) => normalizeDepthRule(row, profile, context))
    .filter(Boolean)
    .sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id));
}

export function activeDepthRule(rules, distance) {
  const matches = rules.filter((rule) => distance >= rule.start - EPSILON && distance <= rule.end + EPSILON);
  if (!matches.length) return null;
  const ending = matches.filter((rule) => !rule.pointOnly && Math.abs(rule.end - distance) <= EPSILON);
  if (ending.length) return ending.at(-1);
  const starting = matches.filter((rule) => Math.abs(rule.start - distance) <= EPSILON);
  return (starting.length ? starting : matches).at(-1);
}
