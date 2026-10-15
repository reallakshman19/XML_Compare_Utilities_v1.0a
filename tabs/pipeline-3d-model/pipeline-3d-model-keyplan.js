// Functionality: renders a plan-view HTML5 Canvas key plan and vanilla HTML
// legend showing how multi-sheet Table 1 geometry was stitched together.
// Parameters: canvas, transformed points, sheet metadata, and optional tooltip.
// Outputs: painted canvas plus legend HTML. Fallback: no hidden mock data.

import { drawMarkerTriangles, findClosestMarker, findClosestPoint, markerTooltipText, pointTooltipText } from './pipeline-3d-model-keyplan-markers.js?v=20260712-marker-triangles-1';

const SHEET_COLORS = ['#38bdf8', '#facc15', '#34d399', '#f472b6', '#a78bfa', '#fb923c', '#22d3ee', '#f87171'];
const VB_W = 760;
const VB_H = 420;
const CLEANUP_KEY = '__pipeline3dKeyPlanCleanup';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function formatAngle(angleDeg) {
  return `${Number(angleDeg).toFixed(2)}°`;
}

// Compute actual bearing-change angle between the last segment of the
// previous sheet and the first segment of the current sheet (global frame).
function computeJunctionAngle(points, sheet, prevSheet) {
  if (!prevSheet || prevSheet.endIndex < prevSheet.startIndex + 1) return null;
  if (sheet.endIndex < sheet.startIndex + 1) return null;
  const pA = points[prevSheet.endIndex - 1];
  const pB = points[prevSheet.endIndex];
  const pC = points[sheet.startIndex];
  const pD = points[sheet.startIndex + 1];
  if (!pA || !pB || !pC || !pD) return null;
  const bearingPrev = Math.atan2(pB.globalY - pA.globalY, pB.globalX - pA.globalX) * 180 / Math.PI;
  const bearingNext = Math.atan2(pD.globalY - pC.globalY, pD.globalX - pC.globalX) * 180 / Math.PI;
  let delta = bearingNext - bearingPrev;
  while (delta > 180) delta -= 360;
  while (delta <= -180) delta += 360;
  return delta;
}

export function buildKeyPlanLegendHtml(points, sheets) {
  if (!points.length) {
    return '';
  }

  return sheets.map((sheet, si) => {
    const color = SHEET_COLORS[sheet.sheetIndex % SHEET_COLORS.length];
    const prevSheet = si > 0 ? sheets[si - 1] : null;
    const junctionAngle = computeJunctionAngle(points, sheet, prevSheet);
    const anglePart = si === 0
      ? 'reference'
      : `Δ angle ${junctionAngle != null ? formatAngle(junctionAngle) : formatAngle(sheet.angleDeg)}`;
    const lengthPart = sheet.meta?.length != null ? ` · length ${sheet.meta.length}` : '';
    return `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:14px;font-size:12px;font-family:monospace;color:#e2e8f0;">
      <span style="display:inline-block;width:12px;height:12px;background:${color};border-radius:2px;flex-shrink:0;"></span>
      Sheet ${sheet.sheetIndex + 1} · ${esc(anglePart)}${esc(lengthPart)}
    </span>`;
  }).join('');

}

// Paints the geometry onto the canvas and manages user interactions (zoom, pan, hovers)
export function paintKeyPlanCanvas(canvas, points, sheets, tooltipEl, markerPoints) {
  if (!canvas) return;
  if (typeof canvas?.[CLEANUP_KEY] === 'function') canvas[CLEANUP_KEY]();
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = VB_W;
  const h = VB_H;
  const dpr = window.devicePixelRatio || 1;

  // Set physical vs virtual pixels
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  if (!points.length) {
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Run to draw pipeline key plan', w / 2, h / 2);
    return;
  }

  const xs = points.map(p => p.globalX);
  const ys = points.map(p => p.globalY);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  const pad = 44;
  const scaleX = (w - pad * 2) / spanX;
  const scaleY = (h - pad * 2) / spanY;
  const baseScale = Math.min(scaleX, scaleY);
  const centerLocalX = minX + spanX / 2;
  const centerLocalY = minY + spanY / 2;

  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let hoveredPoint = null;
  let hoveredMarker = null;
  const markers = Array.isArray(markerPoints) ? markerPoints : [];

  function toScreen(x, y) {
    return {
      sx: w / 2 + (x - centerLocalX) * baseScale * zoom + panX,
      sy: h / 2 - (y - centerLocalY) * baseScale * zoom + panY
    };
  }

  function toLocal(sx, sy) {
    return {
      x: centerLocalX + (sx - w / 2 - panX) / (baseScale * zoom),
      y: centerLocalY - (sy - h / 2 - panY) / (baseScale * zoom)
    };
  }

  function drawGrid() {
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const spacing = 40;
    for (let x = panX % spacing; x < w; x += spacing) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = panY % spacing; y < h; y += spacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  }

  function drawSheets() {
    sheets.forEach((sheet) => {
      const color = SHEET_COLORS[sheet.sheetIndex % SHEET_COLORS.length];
      const sheetPoints = points.slice(sheet.startIndex, sheet.endIndex + 1);
      if (sheetPoints.length < 2) return;

      ctx.beginPath();
      const pStart = toScreen(sheetPoints[0].globalX, sheetPoints[0].globalY);
      ctx.moveTo(pStart.sx, pStart.sy);
      for (let i = 1; i < sheetPoints.length; i++) {
        const p = toScreen(sheetPoints[i].globalX, sheetPoints[i].globalY);
        ctx.lineTo(p.sx, p.sy);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    });
  }

  function drawPointsAndLabels() {
    sheets.forEach((sheet, si) => {
      const color = SHEET_COLORS[sheet.sheetIndex % SHEET_COLORS.length];
      const sheetPoints = points.slice(sheet.startIndex, sheet.endIndex + 1);

      const prevSheet = si > 0 ? sheets[si - 1] : null;
      const junctionAngle = computeJunctionAngle(points, sheet, prevSheet);
      if (si > 0 && sheetPoints.length) {
        const { sx, sy } = toScreen(sheetPoints[0].globalX, sheetPoints[0].globalY);
        const label = junctionAngle != null ? `Δ ${formatAngle(junctionAngle)}` : `Δ ${formatAngle(sheet.angleDeg)}`;
        ctx.fillStyle = '#f87171';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(label, sx + 8, sy - 8);
      }

      sheetPoints.forEach((p, i) => {
        const { sx, sy } = toScreen(p.globalX, p.globalY);
        const isBoundary = i === 0 || i === sheetPoints.length - 1;
        const radius = isBoundary ? 5.5 : 3.5;

        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = isBoundary ? '#f87171' : color;
        ctx.strokeStyle = '#0b1220';
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();

        if (hoveredPoint === p) {
          ctx.beginPath();
          ctx.arc(sx, sy, radius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(248, 113, 113, 0.45)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });
    });
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    drawGrid();
    drawSheets();
    drawPointsAndLabels();
    drawMarkerTriangles(ctx, markers, toScreen, hoveredMarker);

    // Footer overlay
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Triangles = Table 3 markers | Red dots = sheet boundaries | Drag to Pan, Scroll to Zoom', w - 10, h - 10);
  }

  let isDragging = false;
  let startX = 0, startY = 0;

  function getMouseCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      mx: (e.clientX - rect.left) * (w / rect.width),
      my: (e.clientY - rect.top) * (h / rect.height)
    };
  }

  const onMouseDown = (e) => {
    isDragging = true;
    const { mx, my } = getMouseCoords(e);
    startX = mx;
    startY = my;
    canvas.style.cursor = 'grabbing';
  };

  const onMouseMove = (e) => {
    const { mx, my } = getMouseCoords(e);
    if (isDragging) {
      panX += mx - startX;
      panY += my - startY;
      startX = mx;
      startY = my;
      draw();
    } else {
      const newMarker = findClosestMarker(markers, toScreen, mx, my);
      const newPoint = newMarker ? null : findClosestPoint(points, toScreen, mx, my);
      if (newMarker !== hoveredMarker || newPoint !== hoveredPoint) {
        hoveredMarker = newMarker;
        hoveredPoint = newPoint;
        draw();
      }
      if ((hoveredMarker || hoveredPoint) && tooltipEl) {
        tooltipEl.textContent = hoveredMarker ? markerTooltipText(hoveredMarker) : pointTooltipText(hoveredPoint);
        tooltipEl.style.left = `${e.pageX + 10}px`;
        tooltipEl.style.top = `${e.pageY + 10}px`;
        tooltipEl.style.display = 'block';
      } else if (tooltipEl) {
        tooltipEl.style.display = 'none';
      }
    }
  };

  const onMouseUp = () => {
    isDragging = false;
    canvas.style.cursor = 'grab';
  };

  const onMouseLeave = () => {
    isDragging = false;
    canvas.style.cursor = 'grab';
    if (tooltipEl) tooltipEl.style.display = 'none';
    if (hoveredPoint || hoveredMarker) { hoveredPoint = null; hoveredMarker = null; draw(); }
  };

  const onWheel = (e) => {
    e.preventDefault();
    const { mx, my } = getMouseCoords(e);
    const local = toLocal(mx, my);
    const zoomFactor = Math.exp(-e.deltaY * 0.001);
    const nextZoom = Math.min(Math.max(zoom * zoomFactor, 0.1), 30);

    panX = mx - w / 2 - (local.x - centerLocalX) * baseScale * nextZoom;
    panY = my - h / 2 + (local.y - centerLocalY) * baseScale * nextZoom;
    zoom = nextZoom;
    draw();
  };

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', onMouseLeave);
  canvas.addEventListener('wheel', onWheel);
  canvas[CLEANUP_KEY] = () => {
    canvas.removeEventListener('mousedown', onMouseDown);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mouseup', onMouseUp);
    canvas.removeEventListener('mouseleave', onMouseLeave);
    canvas.removeEventListener('wheel', onWheel);
  };

  draw();
}
