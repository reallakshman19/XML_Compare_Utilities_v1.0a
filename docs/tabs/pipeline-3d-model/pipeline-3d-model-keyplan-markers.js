// Canvas marker helpers for Pipeline 3D Model.
// Inputs: combined Table 3 marker points and key-plan screen projection.
// Outputs: triangle markers and hover text. Fallback: no markers are drawn.

const MARKER_HIT_RADIUS = 12;
const POINT_HIT_RADIUS = 10;
const NODE_NUMBER_START = 100;
const NODE_NUMBER_STEP = 10;
const UI_TUNING_STYLE_ID = 'pipeline-3d-keyplan-ui-tuning-style';

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value, digits) {
  const number = finiteNumber(value);
  return number == null ? '-' : number.toFixed(digits);
}

function markerLabel(marker) {
  const label = String(marker?.label || '').trim();
  if (label) return label;
  const index = finiteNumber(marker?.markerIndex);
  return index == null ? 'Marker' : `Marker ${index}`;
}

function ensureUiTuningStyle(doc = globalThis.document) {
  if (!doc || doc.getElementById(UI_TUNING_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = UI_TUNING_STYLE_ID;
  style.textContent = `
.pipeline-3d-model-dialog .p3d-branch-grid{grid-template-columns:repeat(4,minmax(92px,150px))!important;gap:6px 8px!important;align-items:end!important}
.pipeline-3d-model-dialog .p3d-branch-grid label{max-width:150px!important;min-width:0!important;font-size:11px!important}
.pipeline-3d-model-dialog .p3d-branch-grid input{width:100%!important;max-width:145px!important;min-width:0!important;padding:5px 6px!important;font-size:12px!important;box-sizing:border-box!important}
.pipeline-3d-model-dialog .p3d-legend{max-height:30px!important;min-height:0!important;overflow:auto!important;padding:4px 8px!important;margin-bottom:3px!important;align-items:center!important}
.pipeline-3d-model-dialog .p3d-legend span{font-size:10px!important;line-height:1.15!important;margin-right:8px!important;gap:4px!important}
.pipeline-3d-model-dialog .p3d-legend span span{width:9px!important;height:9px!important}
`;
  doc.head?.appendChild(style);
}

ensureUiTuningStyle();

function moveTrianglePath(ctx, sx, sy, size) {
  ctx.beginPath();
  ctx.moveTo(sx, sy - size);
  ctx.lineTo(sx + size * 0.9, sy + size * 0.75);
  ctx.lineTo(sx - size * 0.9, sy + size * 0.75);
  ctx.closePath();
}

function annotateHoverNodeNumbers(point, index, count) {
  if (!point) return point;
  if (!Number.isFinite(finiteNumber(point.nodeNumber))) {
    point.hoverNodeNumber = NODE_NUMBER_START + index * NODE_NUMBER_STEP;
  }
  if (!Number.isFinite(finiteNumber(point.toNodeNumber)) && index < count - 1) {
    point.hoverToNodeNumber = NODE_NUMBER_START + (index + 1) * NODE_NUMBER_STEP;
  }
  return point;
}

export function drawMarkerTriangles(ctx, markers, toScreen, hoveredMarker) {
  for (const marker of Array.isArray(markers) ? markers : []) {
    const { sx, sy } = toScreen(marker.x, marker.y);
    const isHovered = hoveredMarker === marker;
    const size = isHovered ? 9 : 7;
    if (isHovered) {
      moveTrianglePath(ctx, sx, sy, size + 5);
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    moveTrianglePath(ctx, sx, sy, size);
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#0b1220';
    ctx.lineWidth = 1.8;
    ctx.fill();
    ctx.stroke();
  }
}

export function findClosestMarker(markers, toScreen, mx, my) {
  let closest = null;
  let minDist = MARKER_HIT_RADIUS;
  for (const marker of Array.isArray(markers) ? markers : []) {
    const { sx, sy } = toScreen(marker.x, marker.y);
    const dist = Math.hypot(mx - sx, my - sy);
    if (dist < minDist) {
      minDist = dist;
      closest = marker;
    }
  }
  return closest;
}

export function findClosestPoint(points, toScreen, mx, my) {
  let closest = null;
  let minDist = POINT_HIT_RADIUS;
  const routePoints = Array.isArray(points) ? points : [];
  routePoints.forEach((point, index) => {
    const { sx, sy } = toScreen(point.globalX, point.globalY);
    const dist = Math.hypot(mx - sx, my - sy);
    if (dist < minDist) {
      minDist = dist;
      closest = annotateHoverNodeNumbers(point, index, routePoints.length);
    }
  });
  return closest;
}

export function markerTooltipText(marker) {
  return [
    markerLabel(marker),
    `Horizontal: ${formatNumber(marker.horizontal, 2)} m`,
    `Segment: ${formatNumber(marker.markerLength, 2)} m`,
    `Elevation: ${formatNumber(marker.z, 3)} m`,
    `Global X: ${formatNumber(marker.x, 3)}`,
    `Global Y: ${formatNumber(marker.y, 3)}`,
  ].join('\n');
}

export function pointTooltipText(point) {
  const label = String(point?.label || '').trim();
  const nodeNumber = finiteNumber(point?.nodeNumber ?? point?.hoverNodeNumber);
  const toNodeNumber = finiteNumber(point?.toNodeNumber ?? point?.hoverToNodeNumber);
  return [
    label || 'Route point',
    nodeNumber == null ? null : `Node No: ${nodeNumber}`,
    toNodeNumber == null ? null : `To Node Num: ${toNodeNumber}`,
    `Global X: ${formatNumber(point?.globalX, 3)}`,
    `Global Y: ${formatNumber(point?.globalY, 3)}`,
    `Global Z: ${formatNumber(point?.globalZ, 3)}`,
  ].filter(Boolean).join('\n');
}
