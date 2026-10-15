import {
  PIPELINE_CAD_MARKUP_INTERACTION_PREVIEW_SCHEMA,
  pipelineCadMarkupDimensionType,
} from './pipeline-3d-model-cad-markup-interaction-contracts.js';

function distance(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function segmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return distance(point, start);
  const ratio = Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return distance(point, { x: start.x + dx * ratio, y: start.y + dy * ratio });
}

function dimensionHit(graph, item, screenPoint) {
  if (!item.geometry || item.status === 'ORPHANED') return null;
  const start = graph.worldToScreen(item.geometry.start);
  const end = graph.worldToScreen(item.geometry.end);
  const label = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - 10 };
  const lineDistance = segmentDistance(screenPoint, start, end);
  const labelDistance = distance(screenPoint, label);
  return {
    item,
    distance: Math.min(lineDistance, labelDistance),
    part: labelDistance < lineDistance ? 'label' : 'line',
  };
}

function annotationHit(graph, item, screenPoint) {
  if (!item.point || item.status === 'ORPHANED') return null;
  const point = graph.worldToScreen(item.point);
  return { item, distance: distance(screenPoint, point), part: 'text' };
}

export function hitTestPipelineCadMarkupProjection(graph, projection, screenPoint, aperture = 12) {
  if (!graph || projection?.schema !== 'PipelineCadMarkupProjection.v1') return null;
  const graphName = graph.pipelineCadMarkupGraph;
  const candidates = [
    ...projection.dimensions.filter((item) => item.graph === graphName)
      .map((item) => dimensionHit(graph, item, screenPoint)),
    ...projection.annotations.filter((item) => item.graph === graphName)
      .map((item) => annotationHit(graph, item, screenPoint)),
  ].filter((hit) => hit && hit.distance <= aperture)
    .sort((left, right) => left.distance - right.distance || left.item.id.localeCompare(right.item.id));
  const hit = candidates[0];
  if (!hit) return null;
  return Object.freeze({
    id: hit.item.id,
    kind: hit.item.kind,
    graph: hit.item.graph,
    status: hit.item.status,
    part: hit.part,
    distance: hit.distance,
    item: hit.item,
  });
}

function line(ctx, start, end) {
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
}

function dimensionGeometry(first, second, type, offset) {
  if (!first || !second) return null;
  if (type === 'LINEAR_HORIZONTAL') {
    return { start: { x: first.x, y: first.y + offset }, end: { x: second.x, y: second.y + offset } };
  }
  if (type === 'LINEAR_VERTICAL') {
    return { start: { x: first.x + offset, y: first.y }, end: { x: second.x + offset, y: second.y } };
  }
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  return {
    start: { x: first.x + nx * offset, y: first.y + ny * offset },
    end: { x: second.x + nx * offset, y: second.y + ny * offset },
  };
}

function drawCross(graph, ctx, worldPoint, color = '#22d3ee') {
  if (!worldPoint) return;
  const point = graph.worldToScreen(worldPoint);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  line(ctx, { x: point.x - 6, y: point.y }, { x: point.x + 6, y: point.y });
  line(ctx, { x: point.x, y: point.y - 6 }, { x: point.x, y: point.y + 6 });
}

function drawDimensionPreview(graph, ctx, preview) {
  const first = preview.first?.worldPoint;
  const second = preview.second?.worldPoint;
  drawCross(graph, ctx, first);
  drawCross(graph, ctx, second);
  if (!first || !second) return;
  const geometry = dimensionGeometry(first, second, preview.dimensionType, preview.offset);
  const firstScreen = graph.worldToScreen(first);
  const secondScreen = graph.worldToScreen(second);
  const start = graph.worldToScreen(geometry.start);
  const end = graph.worldToScreen(geometry.end);
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  line(ctx, firstScreen, start);
  line(ctx, secondScreen, end);
  line(ctx, start, end);
  ctx.setLineDash([]);
}

function drawAnnotationPreview(graph, ctx, preview) {
  const anchor = preview.annotation?.worldPoint;
  drawCross(graph, ctx, anchor, '#f59e0b');
  if (!anchor || !preview.pointer) return;
  const start = graph.worldToScreen(anchor);
  const end = graph.worldToScreen(preview.pointer);
  ctx.strokeStyle = '#f59e0b';
  ctx.setLineDash([4, 3]);
  line(ctx, start, end);
  ctx.setLineDash([]);
}

function drawProjectedItem(graph, ctx, item, color, dashed = false) {
  if (!item || item.status === 'ORPHANED') return;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  if (dashed) ctx.setLineDash([5, 4]);
  if (item.kind === 'DIMENSION' && item.geometry) {
    line(ctx, graph.worldToScreen(item.geometry.start), graph.worldToScreen(item.geometry.end));
  }
  if (item.kind === 'ANNOTATION' && item.point) {
    const point = graph.worldToScreen(item.point);
    ctx.strokeRect(point.x - 7, point.y - 18, 90, 22);
  }
  ctx.setLineDash([]);
}

function drawFeedback(graph, ctx, feedback, pointer) {
  if (!feedback || !pointer) return;
  const point = graph.worldToScreen(pointer);
  const text = `${feedback.acquisitionMode} · ${feedback.identity}`;
  ctx.font = '10px sans-serif';
  const width = Math.min(280, ctx.measureText(text).width + 10);
  ctx.fillStyle = 'rgba(2,6,23,.94)';
  ctx.fillRect(point.x + 10, point.y + 10, width, 18);
  ctx.strokeStyle = '#22d3ee';
  ctx.strokeRect(point.x + 10, point.y + 10, width, 18);
  ctx.fillStyle = '#cffafe';
  ctx.textAlign = 'left';
  ctx.fillText(text, point.x + 15, point.y + 23);
}

export function pipelineCadMarkupPreviewOffset(state) {
  const first = state.first?.worldPoint;
  const second = state.second?.worldPoint;
  const pointer = state.pointer;
  if (!first || !second || !pointer) return 0;
  const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  const type = pipelineCadMarkupDimensionType(state.mode);
  if (type === 'LINEAR_HORIZONTAL') return pointer.y - midpoint.y;
  if (type === 'LINEAR_VERTICAL') return pointer.x - midpoint.x;
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const length = Math.hypot(dx, dy) || 1;
  return (pointer.x - midpoint.x) * (-dy / length)
    + (pointer.y - midpoint.y) * (dx / length);
}

export function createPipelineCadMarkupDragPatch(record, drag, world) {
  const dx = world.x - drag.startWorld.x;
  const dy = world.y - drag.startWorld.y;
  if (record.dimensionId) {
    let delta = dy;
    if (record.dimensionType === 'LINEAR_VERTICAL') delta = dx;
    if (record.dimensionType === 'LINEAR_ALIGNED') {
      const first = drag.item.evidence.first;
      const second = drag.item.evidence.second;
      const vx = second.x - first.x;
      const vy = second.y - first.y;
      const length = Math.hypot(vx, vy) || 1;
      delta = dx * (-vy / length) + dy * (vx / length);
    }
    return Object.freeze({ offset: drag.initial.offset + delta });
  }
  return Object.freeze({ leader: Object.freeze({
    enabled: drag.initial.leader.enabled,
    dx: drag.initial.leader.dx + dx,
    dy: drag.initial.leader.dy + dy,
  }) });
}

export function createPipelineCadMarkupDraggedProjection(item, record, patch) {
  if (!item || !record || !patch) return null;
  if (record.dimensionId) return Object.freeze({
    ...item,
    geometry: dimensionGeometry(
      item.evidence.first, item.evidence.second, record.dimensionType, patch.offset,
    ),
  });
  const pointValue = item.anchor ? {
    x: item.anchor.x + (patch.leader.enabled ? patch.leader.dx : 0),
    y: item.anchor.y + (patch.leader.enabled ? patch.leader.dy : 0),
  } : null;
  return Object.freeze({ ...item, point: pointValue, leader: patch.leader });
}

export function drawPipelineCadMarkupInteractionOverlay(graph, ctx, preview) {
  if (!ctx || preview?.schema !== PIPELINE_CAD_MARKUP_INTERACTION_PREVIEW_SCHEMA) return 0;
  if (preview.graph && preview.graph !== graph.pipelineCadMarkupGraph) return 0;
  ctx.save();
  drawProjectedItem(graph, ctx, preview.selectedItem, '#67e8f9');
  drawProjectedItem(graph, ctx, preview.dragItem, '#facc15', true);
  drawDimensionPreview(graph, ctx, preview);
  drawAnnotationPreview(graph, ctx, preview);
  drawFeedback(graph, ctx, preview.feedback, preview.pointer || preview.first?.worldPoint || preview.annotation?.worldPoint);
  ctx.restore();
  return 1;
}

export const _markupInteractionRendererTest = Object.freeze({
  distance,
  segmentDistance,
  dimensionGeometry,
  dimensionHit,
  annotationHit,
});
