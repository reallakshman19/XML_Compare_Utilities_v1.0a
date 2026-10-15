import {
  PIPELINE_CAD_MARKUP_STATUS,
  createPipelineCadAnnotation,
  createPipelineCadDimension,
  createPipelineCadMarkupDocument,
} from './pipeline-3d-model-cad-markup-contracts.js';

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze); return Object.freeze(value);
}
function stableRow(row, fields) { return Object.fromEntries(fields.map((name) => [name, row?.[name] ?? null])); }
function canonicalSourceRows(model) {
  return [
    ...(model?.table2Rows || []).map((row) => stableRow(row, ['id', 'sourceTable', 'sourceLine', 'stationValue', 'elevationValue', 'basisH'])),
    ...(model?.table3LengthRows || []).map((row) => stableRow(row, ['id', 'sourceTable', 'sourceLine', 'fromH', 'toH', 'hLength'])),
    ...(model?.table3DepthRows || []).map((row) => stableRow(row, ['id', 'sourceTable', 'sourceLine', 'absoluteH', 'z', 'zMode'])),
    ...(model?.table3MarkerRows || []).map((row) => stableRow(row, ['id', 'sourceTable', 'sourceLine', 'absoluteH', 'markerText'])),
  ].sort((a, b) => String(a.id).localeCompare(String(b.id)));
}
function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0); hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
export function buildPipelineCadSourceFingerprint(model) {
  return `pcad-src-${fnv1a(JSON.stringify(canonicalSourceRows(model)))}`;
}

export function buildPipelineCadMarkupEntityIndex(model) {
  const entries = [
    ...(model?.table2Rows || []).map((row) => ({ graph: 'table2x', entityId: row.id, entityType: 'elevation-node' })),
    ...(model?.table3DepthRows || []).map((row) => ({ graph: 'table3x', entityId: row.id, entityType: 'depth-node' })),
    ...(model?.table3MarkerRows || []).map((row) => ({ graph: 'table3x', entityId: row.id, entityType: 'marker' })),
  ].sort((a, b) => `${a.graph}:${a.entityId}:${a.entityType}`.localeCompare(`${b.graph}:${b.entityId}:${b.entityType}`));
  return freeze({ schema: 'PipelineCadMarkupEntityIndex.v1', sourceFingerprint: buildPipelineCadSourceFingerprint(model), entries });
}
function entityExists(anchor, index) {
  if (anchor.kind === 'GRAPH_POINT') return true;
  return index.entries.some((entry) => entry.graph === anchor.graph
    && entry.entityId === anchor.entityId && entry.entityType === anchor.entityType);
}
function recordStatus(record, index) {
  const anchors = record.firstAnchor ? [record.firstAnchor, record.secondAnchor] : [record.anchor];
  return anchors.every((anchor) => entityExists(anchor, index))
    ? PIPELINE_CAD_MARKUP_STATUS.ACTIVE : PIPELINE_CAD_MARKUP_STATUS.ORPHANED;
}
function reconcileRecord(record, index) {
  const status = recordStatus(record, index);
  if (record.status === status) return record;
  return record.dimensionId
    ? createPipelineCadDimension({ ...record, status, revision: record.revision + 1 })
    : createPipelineCadAnnotation({ ...record, status, revision: record.revision + 1 });
}
function changedRecordIds(document, dimensions, annotations) {
  return [...dimensions, ...annotations].filter((record) => {
    const prior = document.dimensions.find((item) => item.dimensionId === record.dimensionId)
      || document.annotations.find((item) => item.annotationId === record.annotationId);
    return prior?.status !== record.status;
  }).map((record) => record.dimensionId || record.annotationId).sort();
}
export function reconcilePipelineCadMarkupDocument(document, modelOrIndex) {
  const index = modelOrIndex?.schema === 'PipelineCadMarkupEntityIndex.v1'
    ? modelOrIndex : buildPipelineCadMarkupEntityIndex(modelOrIndex);
  const dimensions = document.dimensions.map((record) => reconcileRecord(record, index));
  const annotations = document.annotations.map((record) => reconcileRecord(record, index));
  const changedIds = changedRecordIds(document, dimensions, annotations);
  const fingerprintChanged = document.sourceFingerprint !== index.sourceFingerprint;
  const changed = fingerprintChanged || changedIds.length > 0;
  const next = createPipelineCadMarkupDocument({
    ...document, sourceFingerprint: index.sourceFingerprint,
    revision: document.revision + (changed ? 1 : 0), dimensions, annotations,
  });
  const records = [...dimensions, ...annotations];
  const idOf = (record) => record.dimensionId || record.annotationId;
  return freeze({
    document: next,
    report: {
      schema: 'PipelineCadMarkupReconciliationReport.v1',
      previousFingerprint: document.sourceFingerprint, sourceFingerprint: index.sourceFingerprint,
      fingerprintChanged, changed, changedIds,
      activeIds: records.filter((record) => record.status === 'ACTIVE').map(idOf).sort(),
      orphanedIds: records.filter((record) => record.status === 'ORPHANED').map(idOf).sort(),
    },
  });
}

function graphEntities(graph, graphName) {
  if (!graph) return [];
  return graphName === 'table2x'
    ? graph.currentNodes?.() || []
    : [...(graph.depthNodes?.() || []), ...(graph.markerNodes?.() || [])];
}
export function resolvePipelineCadMarkupAnchor(anchor, graphs) {
  if (anchor.kind === 'GRAPH_POINT') return freeze({ x: anchor.x, y: anchor.y, source: 'GRAPH_POINT' });
  const node = graphEntities(graphs?.[anchor.graph], anchor.graph)
    .find((candidate) => candidate.id === anchor.entityId && candidate.type === anchor.entityType);
  if (!node || !Number.isFinite(Number(node.x)) || !Number.isFinite(Number(node.y))) return null;
  return freeze({ x: Number(node.x), y: Number(node.y), source: 'ENTITY', entityId: node.id, entityType: node.type });
}
function displayNumber(value) { return Number(value.toFixed(3)).toString(); }
export function derivePipelineCadDimensionEvidence(dimension, graphs) {
  const first = resolvePipelineCadMarkupAnchor(dimension.firstAnchor, graphs);
  const second = resolvePipelineCadMarkupAnchor(dimension.secondAnchor, graphs);
  if (!first || !second || dimension.status === 'ORPHANED') {
    return freeze({ value: null, label: 'ORPHANED', first, second });
  }
  const dx = second.x - first.x; const dy = second.y - first.y;
  const value = dimension.dimensionType === 'LINEAR_HORIZONTAL'
    ? Math.abs(dx) : dimension.dimensionType === 'LINEAR_VERTICAL' ? Math.abs(dy) : Math.hypot(dx, dy);
  const label = dimension.labelMode === 'CUSTOM' ? dimension.customLabel : displayNumber(value);
  return freeze({ value, label, first, second, dx, dy });
}
export const _markupReconciliationTest = Object.freeze({ canonicalSourceRows, entityExists, fnv1a });
