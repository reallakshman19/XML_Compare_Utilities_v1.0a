import { projectPointToSegment } from './pipeline-3d-model-cad-math.js';

const freeze = (value) => Object.freeze(value);
const point = (value) => freeze({ x: Number(value.x), y: Number(value.y) });

export function pipelineCadSnapPointPrimitive(input = {}) {
  return freeze({
    type: 'point',
    id: String(input.id),
    mode: String(input.mode),
    sourceIds: freeze([...(input.sourceIds || [])].map(String)),
    worldPoint: point(input.worldPoint),
    lockedAxes: freeze({ x: Boolean(input.lockedAxes?.x), y: Boolean(input.lockedAxes?.y) }),
    label: String(input.label || input.mode),
    metadata: freeze({ ...(input.metadata || {}) }),
  });
}

export function pipelineCadSnapSegmentPrimitive(input = {}) {
  return freeze({
    type: 'segment',
    id: String(input.id),
    sourceIds: freeze([...(input.sourceIds || [])].map(String)),
    start: point(input.start),
    end: point(input.end),
    metadata: freeze({ ...(input.metadata || {}) }),
  });
}

export function midpointOfPipelineCadSegment(segment) {
  return freeze({
    x: (segment.start.x + segment.end.x) / 2,
    y: (segment.start.y + segment.end.y) / 2,
  });
}

export function projectPipelineCadScreenPoint(rawScreen, segment, graph) {
  const start = graph.worldToScreen(segment.start);
  const end = graph.worldToScreen(segment.end);
  const projected = projectPointToSegment(rawScreen, start, end);
  const screenPoint = freeze({ x: projected.x, y: projected.y });
  return freeze({
    screenPoint,
    worldPoint: point(graph.screenToWorld(screenPoint)),
    t: projected.t,
    screenDistance: projected.distance,
  });
}

export function intersectPipelineCadSegments(first, second) {
  const p = first.start;
  const r = { x: first.end.x - first.start.x, y: first.end.y - first.start.y };
  const q = second.start;
  const s = { x: second.end.x - second.start.x, y: second.end.y - second.start.y };
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const denominator = cross(r, s);
  if (Math.abs(denominator) <= 1e-9) return null;
  const qp = { x: q.x - p.x, y: q.y - p.y };
  const t = cross(qp, s) / denominator;
  const u = cross(qp, r) / denominator;
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
  return freeze({ x: p.x + t * r.x, y: p.y + t * r.y });
}
