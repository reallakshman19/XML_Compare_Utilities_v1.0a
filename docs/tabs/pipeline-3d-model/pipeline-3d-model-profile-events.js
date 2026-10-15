import { interpolateXY } from './pipeline-3d-model-geometry.js';
import {
  formatProfileValue,
  interpolateGrade,
  roundProfileValue,
  table3RouteDistance,
  validateRouteDistance,
} from './pipeline-3d-model-profile-coordinate-map.js';
import { addPipelineWarning } from './pipeline-3d-model-warning-log.js';

const EPSILON = 1e-6;
const ROUTE_TOLERANCE = 0.5;

function event(type, distance, label, order = 50, metadata = {}) {
  return { type, distance, label, order, metadata };
}

export function buildVertexEvents(points, segments) {
  let cumulative = 0;
  return points.map((point, index) => {
    if (index > 0) cumulative = segments[index - 1].end;
    return event('vertex', cumulative, point.label, 10, { point });
  });
}

export function buildTable2Events(rows) {
  return rows.map((row) => event('table2', row.distance, row.label, 20, row));
}

export function buildTable3AnchorEvents(profile, context) {
  return profile.coordinateMap.anchors.map((anchor, index) => event(
    'table3-anchor',
    validateRouteDistance(
      context.table3OriginRoute + anchor.cumulative,
      context.total,
      `Table 3 cumulative ${anchor.cumulative}`,
      context.warnings,
    ),
    `HL ${Number(anchor.cumulative).toFixed(1)}`,
    30,
    { absoluteH: anchor.absoluteH, cumulative: anchor.cumulative, index, geometryRole: 'MARKER_ONLY' },
  ));
}

function markerMetadata(rule, positionRole) {
  return {
    sourceId: rule.id,
    zText: rule.zText,
    zMode: rule.mode,
    markerValue: rule.zOffset,
    positionRole,
    geometryRole: 'MARKER_ONLY',
  };
}

export function buildDepthEvents(rules) {
  const events = [];
  for (const rule of rules) {
    if (rule.pointOnly) {
      events.push(event('table3-z-marker', rule.start, rule.zText, 45, markerMetadata(rule, 'POINT')));
      continue;
    }
    events.push(event('table3-z-start-marker', rule.start, `${rule.zText} START`, 40, markerMetadata(rule, 'START')));
    events.push(event('table3-z-end-marker', rule.end, `${rule.zText} END`, 60, markerMetadata(rule, 'END')));
  }
  return events;
}

export function buildMarkerEvents(profile, context) {
  return profile.table3MarkerRows
    .filter((row) => Number.isFinite(row.absoluteH) && row.markerText && row.markerText !== '—')
    .map((row) => event(
      'marker',
      table3RouteDistance(row.absoluteH, profile, context),
      row.markerText,
      50,
      { absoluteH: row.absoluteH, sourceId: row.id, geometryRole: 'MARKER_ONLY' },
    ));
}

function mergeLabel(current, next) {
  if (!current) return next || '';
  if (!next || current === next || current.includes(next)) return current;
  return `${current} / ${next}`;
}

export function materializeProfileEvents(events, context, gradeRows) {
  const points = [];
  const sorted = [...events].sort((a, b) => a.distance - b.distance || a.order - b.order || a.type.localeCompare(b.type));
  for (const item of sorted) {
    const xy = interpolateXY(context.segments, item.distance);
    const grade = interpolateGrade(gradeRows, item.distance);
    const z = grade;
    const previous = points.at(-1);
    if (previous && Math.abs(previous.horizontal - item.distance) <= EPSILON && Math.abs(previous.z - z) <= EPSILON) {
      previous.label = mergeLabel(previous.label, item.label);
      previous.sources.push(item.type);
      previous.markerEvidence.push(item.metadata || {});
      continue;
    }
    points.push({
      horizontal: roundProfileValue(item.distance, 6),
      x: roundProfileValue(xy.x),
      y: roundProfileValue(xy.y),
      z: roundProfileValue(z),
      grade: roundProfileValue(grade),
      label: item.label || '',
      source: item.type,
      sources: [item.type],
      markerEvidence: [item.metadata || {}],
      elevationAuthority: 'TABLE_2',
    });
  }
  return points;
}

export function assertPlausibleProfileSegments(points, routeTotal, warnings = []) {
  let maxSegment = 0;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    const distance = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    maxSegment = Math.max(maxSegment, distance);
    if (distance > routeTotal + ROUTE_TOLERANCE) {
      addPipelineWarning(
        warnings,
        'implausible_segment_length',
        `Generated segment ${index} is ${formatProfileValue(distance)} m, exceeding the ${formatProfileValue(routeTotal)} m source route. Export remains available for review.`,
        { segmentIndex: index, segmentLength: distance, routeLength: routeTotal },
      );
    }
  }
  return maxSegment;
}
