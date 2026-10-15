export const PIPELINE_CAD_SNAP_CANDIDATE_SCHEMA = 'PipelineCadSnapCandidate.v1';
export const PIPELINE_CAD_SNAP_ACQUISITION_SCHEMA = 'PipelineCadSnapAcquisition.v1';

export const PipelineCadObjectSnapMode = Object.freeze({
  ENDPOINT: 'endpoint',
  MIDPOINT: 'midpoint',
  STATION: 'station',
  MARKER: 'marker',
  NEAREST: 'nearest',
  PROJECTION: 'projection',
  INTERSECTION: 'intersection',
});

export const PIPELINE_CAD_OBJECT_SNAP_PRIORITY = Object.freeze({
  endpoint: 0,
  marker: 1,
  intersection: 2,
  midpoint: 3,
  station: 4,
  projection: 5,
  nearest: 6,
});

const GRAPHS = new Set(['table2x', 'table3x']);
const MODES = new Set(Object.values(PipelineCadObjectSnapMode));
const freezePoint = (point, label) => {
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError(`${label} must contain finite x/y.`);
  return Object.freeze({ x, y });
};

function freezeAxes(value = {}) {
  return Object.freeze({ x: Boolean(value.x), y: Boolean(value.y) });
}

function freezeEvidence(value = {}) {
  return Object.freeze({
    considered: Number(value.considered) || 0,
    inAperture: Number(value.inAperture) || 0,
    deduplicated: Number(value.deduplicated) || 0,
    winnerId: value.winnerId ? String(value.winnerId) : null,
    order: Object.freeze([...(value.order || [])].map(String)),
  });
}

export function createPipelineCadSnapCandidate(input = {}) {
  const graph = String(input.graph || '');
  const mode = String(input.mode || '').toLowerCase();
  const id = String(input.id || '').trim();
  const distance = Number(input.screenDistance);
  const priority = Number(input.priority ?? PIPELINE_CAD_OBJECT_SNAP_PRIORITY[mode]);
  if (!GRAPHS.has(graph)) throw new TypeError(`Unsupported snap graph: ${graph || '(blank)'}.`);
  if (!MODES.has(mode)) throw new TypeError(`Unsupported snap mode: ${mode || '(blank)'}.`);
  if (!id) throw new TypeError('Snap candidate ID is required.');
  if (!Number.isFinite(distance) || distance < 0) throw new TypeError('Snap screen distance must be non-negative.');
  if (!Number.isFinite(priority)) throw new TypeError('Snap priority must be finite.');
  return Object.freeze({
    schema: PIPELINE_CAD_SNAP_CANDIDATE_SCHEMA,
    graph,
    mode,
    id,
    sourceIds: Object.freeze([...(input.sourceIds || [])].map(String)),
    worldPoint: freezePoint(input.worldPoint, 'worldPoint'),
    screenPoint: freezePoint(input.screenPoint, 'screenPoint'),
    screenDistance: distance,
    priority,
    lockedAxes: freezeAxes(input.lockedAxes),
    label: String(input.label || mode),
    metadata: Object.freeze({ ...(input.metadata || {}) }),
  });
}

export function createPipelineCadSnapAcquisition(input = {}) {
  const aperture = Number(input.aperture);
  if (!Number.isFinite(aperture) || aperture <= 0) throw new TypeError('Snap aperture must be positive.');
  const candidate = input.candidate || null;
  if (candidate && candidate.schema !== PIPELINE_CAD_SNAP_CANDIDATE_SCHEMA) {
    throw new TypeError('Acquisition candidate must use PipelineCadSnapCandidate.v1.');
  }
  return Object.freeze({
    schema: PIPELINE_CAD_SNAP_ACQUISITION_SCHEMA,
    rawScreenPoint: freezePoint(input.rawScreenPoint, 'rawScreenPoint'),
    rawWorldPoint: freezePoint(input.rawWorldPoint, 'rawWorldPoint'),
    aperture,
    candidate,
    acquiredWorldPoint: freezePoint(input.acquiredWorldPoint || input.rawWorldPoint, 'acquiredWorldPoint'),
    lockedAxes: freezeAxes(input.lockedAxes || candidate?.lockedAxes),
    evidence: freezeEvidence(input.evidence),
  });
}
