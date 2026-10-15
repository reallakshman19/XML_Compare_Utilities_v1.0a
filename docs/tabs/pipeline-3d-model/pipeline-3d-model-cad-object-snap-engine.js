import {
  PIPELINE_CAD_OBJECT_SNAP_PRIORITY,
  PipelineCadObjectSnapMode,
  createPipelineCadSnapAcquisition,
  createPipelineCadSnapCandidate,
} from './pipeline-3d-model-cad-object-snap-contracts.js';
import {
  midpointOfPipelineCadSegment,
  projectPipelineCadScreenPoint,
} from './pipeline-3d-model-cad-object-snap-primitives.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const candidateOrder = (a, b) => a.priority - b.priority
  || a.screenDistance - b.screenDistance
  || a.id.localeCompare(b.id);

function allowedLocks(locks = {}, allowed = { x: true, y: true }) {
  return { x: Boolean(locks.x && allowed.x), y: Boolean(locks.y && allowed.y) };
}

function pointCandidate(graphName, primitive, rawScreen, graph, allowedAxes) {
  const locks = allowedLocks(primitive.lockedAxes, allowedAxes);
  const source = graph.worldToScreen(primitive.worldPoint);
  const screenPoint = {
    x: locks.x ? source.x : rawScreen.x,
    y: locks.y ? source.y : rawScreen.y,
  };
  return createPipelineCadSnapCandidate({
    ...primitive,
    graph: graphName,
    worldPoint: graph.screenToWorld(screenPoint),
    screenPoint,
    screenDistance: distance(rawScreen, screenPoint),
    lockedAxes: locks,
  });
}

function segmentCandidate(graphName, segment, mode, rawScreen, graph, allowedAxes) {
  const projected = mode === PipelineCadObjectSnapMode.MIDPOINT
    ? { worldPoint: midpointOfPipelineCadSegment(segment) }
    : projectPipelineCadScreenPoint(rawScreen, segment, graph);
  const screenPoint = projected.screenPoint || graph.worldToScreen(projected.worldPoint);
  return createPipelineCadSnapCandidate({
    graph: graphName,
    mode,
    id: `${graphName}:${mode}:${segment.id}`,
    sourceIds: segment.sourceIds,
    worldPoint: projected.worldPoint,
    screenPoint,
    screenDistance: distance(rawScreen, screenPoint),
    priority: PIPELINE_CAD_OBJECT_SNAP_PRIORITY[mode],
    lockedAxes: allowedLocks({ x: true, y: true }, allowedAxes),
    label: mode === 'midpoint' ? 'Midpoint' : mode === 'projection' ? 'Projection' : 'Nearest',
    metadata: { ...segment.metadata, segmentId: segment.id, t: projected.t ?? 0.5 },
  });
}

function candidateKey(candidate) {
  return `${candidate.screenPoint.x.toFixed(3)}:${candidate.screenPoint.y.toFixed(3)}`;
}

export function rankPipelineCadSnapCandidates(candidates = [], aperture = 12) {
  const inAperture = candidates.filter((candidate) => candidate.screenDistance <= aperture).sort(candidateOrder);
  const unique = [];
  const points = new Set();
  for (const candidate of inAperture) {
    const key = candidateKey(candidate);
    if (points.has(key)) continue;
    points.add(key);
    unique.push(candidate);
  }
  return Object.freeze({
    candidate: unique[0] || null,
    candidates: Object.freeze(unique),
    evidence: Object.freeze({
      considered: candidates.length,
      inAperture: inAperture.length,
      deduplicated: inAperture.length - unique.length,
      winnerId: unique[0]?.id || null,
      order: Object.freeze(unique.map((candidate) => candidate.id)),
    }),
  });
}

export function acquirePipelineCadObjectSnap(input = {}) {
  const settings = input.settings || {};
  const rawScreenPoint = { x: Number(input.rawScreenPoint.x), y: Number(input.rawScreenPoint.y) };
  const rawWorldPoint = { x: Number(input.rawWorldPoint.x), y: Number(input.rawWorldPoint.y) };
  const enabled = new Set(settings.enabledModes || Object.values(PipelineCadObjectSnapMode));
  const excluded = new Set((input.excludeIds || []).map(String));
  const allowedAxes = { x: input.allowedAxes?.x !== false, y: input.allowedAxes?.y !== false };
  const candidates = [];
  if (settings.objectEnabled !== false) {
    for (const primitive of input.primitives?.points || []) {
      if (!enabled.has(primitive.mode) || primitive.sourceIds.some((id) => excluded.has(id))) continue;
      candidates.push(pointCandidate(input.graphName, primitive, rawScreenPoint, input.graph, allowedAxes));
    }
    for (const segment of input.primitives?.segments || []) {
      if (segment.sourceIds.some((id) => excluded.has(id))) continue;
      for (const mode of [PipelineCadObjectSnapMode.MIDPOINT, PipelineCadObjectSnapMode.PROJECTION, PipelineCadObjectSnapMode.NEAREST]) {
        if (enabled.has(mode)) candidates.push(segmentCandidate(input.graphName, segment, mode, rawScreenPoint, input.graph, allowedAxes));
      }
    }
  }
  const ranked = rankPipelineCadSnapCandidates(candidates, Number(settings.objectAperture) || 12);
  return createPipelineCadSnapAcquisition({
    rawScreenPoint,
    rawWorldPoint,
    aperture: Number(settings.objectAperture) || 12,
    candidate: ranked.candidate,
    acquiredWorldPoint: ranked.candidate?.worldPoint || rawWorldPoint,
    lockedAxes: ranked.candidate?.lockedAxes || {},
    evidence: ranked.evidence,
  });
}

export function composePipelineCadSnapPoint(rawPoint, acquisition, scalar = {}) {
  const locks = acquisition?.lockedAxes || {};
  let x = locks.x ? acquisition.acquiredWorldPoint.x : Number(rawPoint.x);
  let y = locks.y ? acquisition.acquiredWorldPoint.y : Number(rawPoint.y);
  if (!locks.x && typeof scalar.x === 'function') x = scalar.x(x);
  if (!locks.y && typeof scalar.y === 'function') y = scalar.y(y);
  return Object.freeze({ x, y, lockedAxes: Object.freeze({ x: Boolean(locks.x), y: Boolean(locks.y) }) });
}
