import { interpolateCumulativeFromAbsoluteH } from './pipeline-3d-model-cad-math.js';
import { buildPipelineCadInspection, interpolateEngineeringProfile } from './pipeline-3d-model-cad-engineering-review.js';
import {
  PIPELINE_CAD_OVERLAY_FORMULA,
  derivePipelineCadDefaultZOrigin,
  projectPipelineCadZToElevation,
} from './pipeline-3d-model-cad-preview-mode-state.js';

function optionalNumber(value) {
  if (value == null || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function pointsTable2(model) {
  return (model?.table2Rows || [])
    .filter((row) => Number.isFinite(row.stationValue) && Number.isFinite(row.elevationValue))
    .map((row) => ({ id: row.id, x: Number(row.stationValue), y: Number(row.elevationValue) }))
    .sort((a, b) => a.x - b.x);
}

function pointsTable3(model, origin) {
  const map = model?.coordinateMap;
  if (!map) return [];
  return (model?.table3DepthRows || [])
    .filter((row) => Number.isFinite(row.absoluteH) && Number.isFinite(row.z))
    .map((row) => ({
      id: row.id,
      x: interpolateCumulativeFromAbsoluteH(row.absoluteH, map),
      z: Number(row.z),
      y: projectPipelineCadZToElevation(origin, row.z),
      absoluteH: Number(row.absoluteH),
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .sort((a, b) => a.x - b.x);
}

function paddedRange(values, ratio, minimumPad) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (!finite.length) return Object.freeze({ min: 0, max: 1 });
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (!(max > min)) { min -= minimumPad; max += minimumPad; }
  const pad = Math.max(minimumPad, (max - min) * ratio);
  return Object.freeze({ min: min - pad, max: max + pad });
}

export function buildPipelineCadOverlayModel(model, zOriginElevation) {
  const configured = optionalNumber(zOriginElevation);
  const origin = configured ?? derivePipelineCadDefaultZOrigin(model);
  const elevationPoints = pointsTable2(model);
  const projectedZPoints = pointsTable3(model, origin);
  const xRange = paddedRange([...elevationPoints, ...projectedZPoints].map((point) => point.x), 0.025, 0.5);
  const yRange = paddedRange([
    ...elevationPoints.map((point) => point.y),
    ...projectedZPoints.map((point) => point.y),
    origin,
  ], 0.1, 0.4);
  const markers = Object.freeze((model?.table3MarkerRows || []).map((row) => Object.freeze({
    id: row.id,
    markerText: row.markerText,
    x: model.coordinateMap ? interpolateCumulativeFromAbsoluteH(row.absoluteH, model.coordinateMap) : NaN,
  })).filter((marker) => Number.isFinite(marker.x)));
  return Object.freeze({
    schema: 'PipelineCadElevationOverlay.v1',
    formula: PIPELINE_CAD_OVERLAY_FORMULA,
    zOriginElevation: origin,
    elevationPoints: Object.freeze(elevationPoints.map(Object.freeze)),
    projectedZPoints: Object.freeze(projectedZPoints.map(Object.freeze)),
    markers,
    xRange,
    yRange,
  });
}

function screenPoint(plot, model, point) {
  return {
    x: plot.left + ((point.x - model.xRange.min) / (model.xRange.max - model.xRange.min)) * plot.width,
    y: plot.bottom - ((point.y - model.yRange.min) / (model.yRange.max - model.yRange.min)) * plot.height,
  };
}

function drawPolyline(context, points, plot, model, options) {
  if (!points.length) return;
  context.save();
  context.strokeStyle = options.stroke;
  context.fillStyle = options.fill;
  context.lineWidth = 2.2;
  context.setLineDash(options.dash || []);
  context.beginPath();
  points.forEach((point, index) => {
    const screen = screenPoint(plot, model, point);
    if (index) context.lineTo(screen.x, screen.y); else context.moveTo(screen.x, screen.y);
  });
  context.stroke();
  for (const point of points) {
    const screen = screenPoint(plot, model, point);
    context.beginPath();
    context.arc(screen.x, screen.y, 3.5, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function sizeCanvas(canvas, host) {
  const rect = host.getBoundingClientRect?.() || {};
  const width = Math.max(640, Math.round(host.clientWidth || rect.width || 1000));
  const height = Math.max(340, Math.round(host.clientHeight || rect.height || 500));
  const dpr = Math.max(1, Number(globalThis.devicePixelRatio) || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  return { width, height, dpr };
}

function ensureProjectedField(modal) {
  const inspector = modal.querySelector('[data-p3d-cad-coordinate-inspector]');
  const list = inspector?.querySelector('dl');
  if (!list) return null;
  if (!list.querySelector('[data-p3d-cad-inspector-field="projectedElevation"]')) {
    list.insertAdjacentHTML('beforeend', '<dt data-p3d-cad-overlay-only="true">Projected elevation</dt><dd data-p3d-cad-overlay-only="true" data-p3d-cad-inspector-field="projectedElevation">—</dd><dt data-p3d-cad-overlay-only="true">Z origin</dt><dd data-p3d-cad-overlay-only="true" data-p3d-cad-inspector-field="zOrigin">—</dd>');
  }
  return inspector;
}

function updateInspector(modal, detail, projected, origin) {
  const inspector = ensureProjectedField(modal);
  if (!inspector) return;
  inspector.dataset.active = detail ? 'true' : 'false';
  if (!detail) return;
  const values = {
    cumulative: `${detail.cumulative.toFixed(1)} m`,
    station: detail.stationText,
    elevation: Number.isFinite(detail.elevation) ? `${detail.elevation.toFixed(2)} m` : '—',
    absoluteH: Number.isFinite(detail.absoluteH) ? detail.absoluteH.toFixed(3) : '—',
    depth: Number.isFinite(detail.depthZ) ? `${detail.depthText} (Z ${detail.depthZ.toFixed(2)} m)` : '—',
    projectedElevation: Number.isFinite(projected) ? `${projected.toFixed(2)} m` : '—',
    zOrigin: `${origin.toFixed(2)} m`,
    segment: detail.segment ? `${detail.segment.fromH.toFixed(3)} → ${detail.segment.toH.toFixed(3)}` : '—',
    segmentLength: detail.segment ? `${detail.segment.hLength.toFixed(1)} m` : '—',
    item: detail.marker?.markerText || '—',
  };
  for (const [name, value] of Object.entries(values)) {
    const field = inspector.querySelector(`[data-p3d-cad-inspector-field="${name}"]`);
    if (field) field.textContent = value;
  }
}

export function mountPipelineCadOverlay({ modal, overlayContent, controller, initialOrigin, onOriginChange }) {
  const host = overlayContent.querySelector('[data-p3d-cad-overlay-stage]');
  const canvas = overlayContent.querySelector('[data-p3d-cad-overlay-canvas]');
  const context = canvas?.getContext?.('2d');
  const input = overlayContent.querySelector('[data-p3d-cad-z-origin]');
  const startButton = overlayContent.querySelector('[data-p3d-cad-z-origin-start]');
  let active = false;
  let origin = optionalNumber(initialOrigin) ?? derivePipelineCadDefaultZOrigin(controller.model);
  let activeX = null;
  let frame = null;
  input.value = String(origin);

  const render = () => {
    if (!active || !context || !controller.model) return false;
    const size = sizeCanvas(canvas, host);
    const model = buildPipelineCadOverlayModel(controller.model, origin);
    const plot = { left: 70, right: size.width - 28, top: 68, bottom: size.height - 54 };
    plot.width = plot.right - plot.left;
    plot.height = plot.bottom - plot.top;
    context.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    context.clearRect(0, 0, size.width, size.height);
    context.fillStyle = '#07111f';
    context.fillRect(0, 0, size.width, size.height);
    drawPolyline(context, model.elevationPoints, plot, model, { stroke: '#38bdf8', fill: '#7dd3fc' });
    drawPolyline(context, model.projectedZPoints, plot, model, { stroke: '#fb923c', fill: '#fdba74', dash: [8, 5] });
    context.fillStyle = '#e2e8f0';
    context.font = '600 12px ui-monospace,monospace';
    context.textAlign = 'center';
    context.fillText('Station / Chainage (m)', plot.left + plot.width / 2, size.height - 8);
    if (Number.isFinite(activeX)) {
      const x = screenPoint(plot, model, { x: activeX, y: model.yRange.min }).x;
      context.strokeStyle = '#f8fafc';
      context.beginPath(); context.moveTo(x, plot.top); context.lineTo(x, plot.bottom); context.stroke();
    }
    canvas.dataset.p3dCadOverlayOrigin = origin.toFixed(3);
    canvas.dataset.p3dCadOverlayElevationPoints = String(model.elevationPoints.length);
    canvas.dataset.p3dCadOverlayProjectedZPoints = String(model.projectedZPoints.length);
    canvas.dataset.p3dCadOverlayMarkers = String(model.markers.length);
    canvas.dataset.p3dCadOverlayReviewOnly = 'true';
    canvas.dataset.p3dCadOverlayFormula = PIPELINE_CAD_OVERLAY_FORMULA;
    overlayContent.querySelector('[data-p3d-cad-overlay-status]').textContent = `${model.elevationPoints.length} elevation · ${model.projectedZPoints.length} projected Z · review only`;
    return true;
  };

  const schedule = () => {
    if (frame != null) return;
    frame = requestAnimationFrame(() => { frame = null; render(); });
  };
  const onMove = (event) => {
    if (!active || !controller.model) return;
    const rect = canvas.getBoundingClientRect();
    const model = buildPipelineCadOverlayModel(controller.model, origin);
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left - 70) / Math.max(1, rect.width - 98)));
    activeX = model.xRange.min + ratio * (model.xRange.max - model.xRange.min);
    const detail = buildPipelineCadInspection(controller.model, activeX, { sourceGraph: 'overlay' });
    const projected = interpolateEngineeringProfile(model.projectedZPoints, activeX);
    updateInspector(modal, detail, projected, origin);
    schedule();
  };
  const onLeave = () => { activeX = null; updateInspector(modal, null, null, origin); schedule(); };
  const setOrigin = (value) => {
    const next = optionalNumber(value);
    if (next == null) return false;
    origin = next; input.value = String(next); schedule(); onOriginChange?.(origin); return true;
  };
  const onChange = () => { if (!setOrigin(input.value)) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); };
  const onStart = () => setOrigin(derivePipelineCadDefaultZOrigin(controller.model));
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  input.addEventListener('change', onChange);
  startButton.addEventListener('click', onStart);
  return {
    get origin() { return origin; },
    setActive(value) { active = Boolean(value); if (active) schedule(); else updateInspector(modal, null, null, origin); },
    render: schedule,
    setOrigin,
    destroy() {
      if (frame != null) cancelAnimationFrame(frame);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      input.removeEventListener('change', onChange);
      startButton.removeEventListener('click', onStart);
      updateInspector(modal, null, null, origin);
    },
  };
}
