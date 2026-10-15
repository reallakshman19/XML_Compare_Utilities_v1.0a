export const PIPELINE_CANVAS_NODE_MOVED_SCHEMA = 'PipelineCanvasNodeMoved.v1';
export const PIPELINE_CANVAS_GEOMETRY_UPDATED_SCHEMA = 'PipelineCanvasGeometryUpdated.v1';

const PHASES = new Set(['preview', 'committed', 'cancelled']);

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function freezeRecord(value) {
  if (!value || typeof value !== 'object') return null;
  return Object.freeze({ ...value });
}

function normalizedAfter(detail = {}) {
  const source = detail.after && typeof detail.after === 'object' ? detail.after : detail;
  if (detail.graph === 'table2x') {
    return Object.freeze({
      stationValue: finite(source.stationValue),
      elevationValue: finite(source.elevationValue),
    });
  }
  if (detail.entityType === 'marker') {
    return Object.freeze({
      cumulative: finite(source.cumulative),
      absoluteH: finite(source.absoluteH),
      markerText: source.markerText == null ? null : String(source.markerText),
    });
  }
  return Object.freeze({
    cumulative: finite(source.cumulative),
    absoluteH: finite(source.absoluteH),
    z: finite(source.z),
    zText: source.zText == null ? null : String(source.zText),
  });
}

export function createPipelineCanvasNodeMovedPayload(options = {}) {
  const detail = options.detail || {};
  const phase = PHASES.has(options.phase) ? options.phase : 'preview';
  return Object.freeze({
    schema: PIPELINE_CANVAS_NODE_MOVED_SCHEMA,
    operationId: String(options.operationId || ''),
    phase,
    graph: detail.graph || null,
    entityId: detail.entityId || null,
    entityType: detail.entityType || null,
    before: freezeRecord(detail.before),
    after: normalizedAfter(detail),
    reason: options.reason || detail.reason || null,
    modelRevision: finite(options.modelRevision),
    nodes: options.nodes || Object.freeze([]),
    edges: options.edges || Object.freeze([]),
  });
}

export function createPipelineCanvasGeometryUpdatedPayload(options = {}) {
  return Object.freeze({
    schema: PIPELINE_CANVAS_GEOMETRY_UPDATED_SCHEMA,
    reason: options.reason || null,
    graph: options.graph || null,
    operationId: options.operationId ? String(options.operationId) : null,
    modelRevision: finite(options.modelRevision),
    nodes: options.nodes || Object.freeze([]),
    edges: options.edges || Object.freeze([]),
  });
}
