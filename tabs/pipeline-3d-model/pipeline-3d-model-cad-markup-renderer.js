import { drawPipelineCadMarkupInteractionOverlay } from './pipeline-3d-model-cad-markup-interaction-renderer.js';
import {
  derivePipelineCadDimensionEvidence,
  resolvePipelineCadMarkupAnchor,
} from './pipeline-3d-model-cad-markup-reconciliation.js';

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze); return Object.freeze(value);
}
function authorityLabel(value) {
  if (value === 'ENGINEERING_PROFILE') return 'ENGINEERING PROFILE';
  return value === 'REVIEW_EVIDENCE' ? 'REVIEW EVIDENCE' : 'PRESENTATION ONLY';
}
function anchorIdentity(anchor) {
  return anchor.kind === 'ENTITY'
    ? `${anchor.graph}:${anchor.entityType}:${anchor.entityId}:${anchor.pointRole}`
    : `${anchor.graph}:POINT(${anchor.x},${anchor.y})`;
}
function dimensionGeometry(record, evidence) {
  if (!evidence.first || !evidence.second) return null;
  const { first, second } = evidence; const offset = record.offset;
  if (record.dimensionType === 'LINEAR_HORIZONTAL') {
    return { start: { x: first.x, y: first.y + offset }, end: { x: second.x, y: second.y + offset } };
  }
  if (record.dimensionType === 'LINEAR_VERTICAL') {
    return { start: { x: first.x + offset, y: first.y }, end: { x: second.x + offset, y: second.y } };
  }
  const length = Math.hypot(evidence.dx, evidence.dy) || 1;
  const nx = -evidence.dy / length; const ny = evidence.dx / length;
  return {
    start: { x: first.x + nx * offset, y: first.y + ny * offset },
    end: { x: second.x + nx * offset, y: second.y + ny * offset },
  };
}
function dimensionProjection(record, graphs) {
  const evidence = derivePipelineCadDimensionEvidence(record, graphs);
  return freeze({
    id: record.dimensionId, kind: 'DIMENSION', graph: record.graph,
    type: record.dimensionType, status: record.status,
    authority: record.measurementAuthority,
    authorityLabel: authorityLabel(record.measurementAuthority),
    anchorIdentities: [anchorIdentity(record.firstAnchor), anchorIdentity(record.secondAnchor)],
    evidence, geometry: dimensionGeometry(record, evidence), label: evidence.label,
  });
}
function annotationProjection(record, graphs) {
  const anchor = resolvePipelineCadMarkupAnchor(record.anchor, graphs);
  const point = anchor ? {
    x: anchor.x + (record.leader.enabled ? record.leader.dx : 0),
    y: anchor.y + (record.leader.enabled ? record.leader.dy : 0),
  } : null;
  return freeze({
    id: record.annotationId, kind: 'ANNOTATION', graph: record.graph,
    status: record.status, text: record.text, alignment: record.alignment,
    anchorIdentity: anchorIdentity(record.anchor), anchor, point, leader: record.leader,
  });
}
export function buildPipelineCadMarkupProjection(document, graphs) {
  const dimensions = document.dimensions.map((record) => dimensionProjection(record, graphs));
  const annotations = document.annotations.map((record) => annotationProjection(record, graphs));
  const evidence = [
    ...dimensions.map((item) => ({
      id: item.id, type: item.type, graph: item.graph, textValue: item.label,
      authority: item.authorityLabel, anchors: item.anchorIdentities.join(' → '), status: item.status,
    })),
    ...annotations.map((item) => ({
      id: item.id, type: 'ANNOTATION', graph: item.graph, textValue: item.text,
      authority: 'DRAWING EVIDENCE', anchors: item.anchorIdentity, status: item.status,
    })),
  ].sort((a, b) => a.id.localeCompare(b.id));
  return freeze({ schema: 'PipelineCadMarkupProjection.v1', dimensions, annotations, evidence });
}
export function emptyPipelineCadMarkupProjection() {
  return freeze({ schema: 'PipelineCadMarkupProjection.v1', dimensions: [], annotations: [], evidence: [] });
}

function line(ctx, start, end) {
  ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
}
function drawLabel(ctx, point, text) {
  ctx.font = '11px sans-serif'; const width = ctx.measureText(text).width + 10;
  ctx.fillStyle = 'rgba(2,6,23,.92)'; ctx.fillRect(point.x - width / 2, point.y - 19, width, 17);
  ctx.strokeStyle = '#94a3b8'; ctx.strokeRect(point.x - width / 2, point.y - 19, width, 17);
  ctx.fillStyle = '#f8fafc'; ctx.textAlign = 'center'; ctx.fillText(text, point.x, point.y - 7);
}
function drawDimension(graph, ctx, item) {
  if (!item.geometry || item.status === 'ORPHANED') return false;
  const first = graph.worldToScreen(item.evidence.first);
  const second = graph.worldToScreen(item.evidence.second);
  const start = graph.worldToScreen(item.geometry.start);
  const end = graph.worldToScreen(item.geometry.end);
  ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 1.5;
  line(ctx, first, start); line(ctx, second, end); line(ctx, start, end);
  drawLabel(ctx, { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    `${item.label} · ${item.authorityLabel}`);
  return true;
}
function drawAnnotation(graph, ctx, item) {
  if (!item.anchor || !item.point || item.status === 'ORPHANED') return false;
  const anchor = graph.worldToScreen(item.anchor); const point = graph.worldToScreen(item.point);
  if (item.leader.enabled) {
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1.25; line(ctx, anchor, point);
  }
  ctx.font = '12px sans-serif'; ctx.textAlign = item.alignment.toLowerCase();
  ctx.fillStyle = 'rgba(15,23,42,.94)'; const width = ctx.measureText(item.text).width + 10;
  const left = item.alignment === 'RIGHT' ? point.x - width
    : item.alignment === 'CENTER' ? point.x - width / 2 : point.x;
  ctx.fillRect(left, point.y - 16, width, 18);
  ctx.strokeStyle = '#f59e0b'; ctx.strokeRect(left, point.y - 16, width, 18);
  ctx.fillStyle = '#fef3c7'; ctx.fillText(item.text, point.x, point.y - 3); return true;
}
function drawOrphans(ctx, items) {
  items.forEach((item, index) => {
    const y = 62 + index * 18;
    ctx.fillStyle = 'rgba(127,29,29,.92)'; ctx.fillRect(62, y - 13, 220, 16);
    ctx.fillStyle = '#fecaca'; ctx.font = '10px sans-serif';
    ctx.textAlign = 'left'; ctx.fillText(`ORPHANED · ${item.id}`, 67, y - 2);
  });
}
export function drawPipelineCadMarkupOverlay(graph, ctx, projection) {
  if (!ctx || !projection) return 0;
  const dimensions = projection.dimensions.filter((item) => item.graph === graph.pipelineCadMarkupGraph);
  const annotations = projection.annotations.filter((item) => item.graph === graph.pipelineCadMarkupGraph);
  ctx.save(); let drawn = 0;
  dimensions.forEach((item) => { if (drawDimension(graph, ctx, item)) drawn += 1; });
  annotations.forEach((item) => { if (drawAnnotation(graph, ctx, item)) drawn += 1; });
  drawOrphans(ctx, [...dimensions, ...annotations].filter((item) => item.status === 'ORPHANED'));
  drawPipelineCadMarkupInteractionOverlay(graph, ctx, graph.pipelineCadMarkupInteractionPreview);
  ctx.restore(); return drawn;
}
export const _markupRendererTest = Object.freeze({ anchorIdentity, authorityLabel, dimensionGeometry });
