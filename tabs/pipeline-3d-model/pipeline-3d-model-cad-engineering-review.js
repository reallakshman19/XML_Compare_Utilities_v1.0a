import {
  clamp,
  formatDepth,
  formatStation,
  interpolateAbsoluteHFromCumulative,
  interpolateCumulativeFromAbsoluteH,
} from './pipeline-3d-model-cad-math.js';

export const PIPELINE_CAD_ENGINEERING_REVIEW_BUILD = '2026.07.14-pcad-001';
export const PIPELINE_CAD_TABLE2_X_AXIS_LABEL = 'Station / Chainage (m)';
export const PIPELINE_CAD_TABLE2_Y_AXIS_LABEL = 'Elevation (m)';
export const PIPELINE_CAD_TABLE3_X_AXIS_LABEL = 'HLength Cumulative (m)';
export const PIPELINE_CAD_TABLE3_Y_AXIS_LABEL = 'Depth / Z (m)';

const STYLE_ID = 'pipeline-3d-cad-engineering-review-style';

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function niceEngineeringTickStep(span, targetTicks = 7) {
  const range = Math.abs(finite(span));
  if (!(range > 0)) return 1;
  const rough = range / Math.max(2, Math.floor(finite(targetTicks, 7)));
  const power = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / power;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return factor * power;
}

export function buildEngineeringTicks(minimum, maximum, targetTicks = 7) {
  const min = finite(minimum);
  const max = finite(maximum, min + 1);
  if (!(max > min)) return Object.freeze([min]);
  const step = niceEngineeringTickStep(max - min, targetTicks);
  const first = Math.ceil((min - step * 1e-9) / step) * step;
  const values = [];
  for (let value = first, guard = 0; value <= max + step * 1e-9 && guard < 100; value += step, guard += 1) {
    values.push(Math.abs(value) < step * 1e-10 ? 0 : Number(value.toPrecision(12)));
  }
  return Object.freeze(values);
}

export function interpolateEngineeringProfile(points, x) {
  const value = Number(x);
  const rows = (Array.isArray(points) ? points : [])
    .filter((point) => Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y)))
    .map((point) => ({ x: Number(point.x), y: Number(point.y) }))
    .sort((a, b) => a.x - b.x);
  if (!rows.length || !Number.isFinite(value)) return null;
  if (rows.length === 1 || value <= rows[0].x) return rows[0].y;
  if (value >= rows.at(-1).x) return rows.at(-1).y;
  for (let index = 0; index < rows.length - 1; index += 1) {
    const start = rows[index];
    const end = rows[index + 1];
    if (value < start.x || value > end.x) continue;
    const span = end.x - start.x;
    return Math.abs(span) < 1e-12 ? start.y : start.y + ((value - start.x) / span) * (end.y - start.y);
  }
  return null;
}

export function resolvePipelineCadLengthSegment(rows, cumulative) {
  const value = Number(cumulative);
  if (!Number.isFinite(value)) return null;
  let start = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!Number.isFinite(row?.fromH) || !Number.isFinite(row?.toH) || !Number.isFinite(row?.hLength)) continue;
    const end = start + Number(row.hLength);
    if (value >= start - 1e-9 && value <= end + 1e-9) {
      return Object.freeze({
        id: row.id, sourceLine: row.sourceLine, cumulativeFrom: start, cumulativeTo: end,
        fromH: Number(row.fromH), toH: Number(row.toH), hLength: Number(row.hLength),
      });
    }
    start = end;
  }
  return null;
}

function table2Profile(model) {
  return (model?.table2Rows || [])
    .filter((row) => Number.isFinite(row.stationValue) && Number.isFinite(row.elevationValue))
    .map((row) => ({ x: Number(row.stationValue), y: Number(row.elevationValue) }));
}

function table3Profile(model) {
  const map = model?.coordinateMap;
  if (!map) return [];
  return (model?.table3DepthRows || [])
    .filter((row) => Number.isFinite(row.absoluteH) && Number.isFinite(row.z))
    .map((row) => ({ x: interpolateCumulativeFromAbsoluteH(row.absoluteH, map), y: Number(row.z) }));
}

function nearestMarker(model, cumulative) {
  const map = model?.coordinateMap;
  if (!map) return null;
  const domain = Math.max(1, Number(map.cumulativeMax) - Number(map.cumulativeMin));
  const nearest = (model?.table3MarkerRows || [])
    .filter((row) => Number.isFinite(row.absoluteH))
    .map((row) => ({
      id: row.id, markerText: row.markerText, absoluteH: Number(row.absoluteH),
      cumulative: interpolateCumulativeFromAbsoluteH(row.absoluteH, map),
    }))
    .map((marker) => ({ ...marker, delta: Math.abs(marker.cumulative - cumulative) }))
    .sort((a, b) => a.delta - b.delta)[0];
  return nearest?.delta <= Math.max(0.75, domain * 0.025) ? Object.freeze(nearest) : null;
}

export function buildPipelineCadInspection(model, cumulative, options = {}) {
  if (!model?.coordinateMap || !Number.isFinite(Number(cumulative))) return null;
  const position = clamp(Number(cumulative), model.coordinateMap.cumulativeMin, model.coordinateMap.cumulativeMax);
  const depthZ = interpolateEngineeringProfile(table3Profile(model), position);
  return Object.freeze({
    schema: 'PipelineCadCoordinateInspection.v1',
    build: PIPELINE_CAD_ENGINEERING_REVIEW_BUILD,
    sourceGraph: options.sourceGraph || '',
    cumulative: position,
    stationText: formatStation(position, 1),
    absoluteH: interpolateAbsoluteHFromCumulative(position, model.coordinateMap),
    elevation: interpolateEngineeringProfile(table2Profile(model), position),
    depthZ,
    depthText: Number.isFinite(depthZ) ? formatDepth(depthZ) : '—',
    segment: resolvePipelineCadLengthSegment(model.table3LengthRows, position),
    marker: nearestMarker(model, position),
  });
}

function visibleRange(graph) {
  const plot = graph.getPlotRect();
  const a = graph.screenToWorld({ x: plot.left, y: plot.bottom });
  const b = graph.screenToWorld({ x: plot.right, y: plot.top });
  return { plot, minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minY: Math.min(a.y, b.y), maxY: Math.max(a.y, b.y) };
}

function compact(value, decimals = 1) {
  return Number(value).toFixed(decimals).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

export function drawPipelineCadEngineeringAxes(graph, graphName) {
  const context = graph?.context;
  if (!context) return false;
  const table3 = graphName === 'table3x';
  const xLabel = table3 ? PIPELINE_CAD_TABLE3_X_AXIS_LABEL : PIPELINE_CAD_TABLE2_X_AXIS_LABEL;
  const yLabel = table3 ? PIPELINE_CAD_TABLE3_Y_AXIS_LABEL : PIPELINE_CAD_TABLE2_Y_AXIS_LABEL;
  const range = visibleRange(graph);
  const xTicks = buildEngineeringTicks(range.minX, range.maxX, Math.max(4, Math.floor(range.plot.width / 105)));
  const yTicks = buildEngineeringTicks(range.minY, range.maxY, Math.max(4, Math.floor(range.plot.height / 68)));
  context.save();
  context.strokeStyle = 'rgba(148,163,184,.72)';
  context.fillStyle = '#cbd5e1';
  context.font = '10px ui-monospace,monospace';
  context.textAlign = 'center';
  for (const tick of xTicks) {
    const point = graph.worldToScreen({ x: tick, y: range.minY });
    context.fillText(table3 ? compact(tick, 1) : formatStation(tick, 1), point.x, range.plot.bottom + 7);
  }
  context.textAlign = 'right';
  for (const tick of yTicks) {
    const point = graph.worldToScreen({ x: range.minX, y: tick });
    context.fillText(compact(tick, 2), range.plot.left - 8, point.y);
  }
  context.font = '600 12px ui-monospace,monospace';
  context.textAlign = 'center';
  context.fillText(xLabel, range.plot.left + range.plot.width / 2, graph.height - 12);
  context.save();
  context.translate(16, range.plot.top + range.plot.height / 2);
  context.rotate(-Math.PI / 2);
  context.fillText(yLabel, 0, 0);
  context.restore();
  context.restore();
  graph.canvas.dataset.p3dCadXAxisLabel = xLabel;
  graph.canvas.dataset.p3dCadYAxisLabel = yLabel;
  graph.canvas.dataset.p3dCadXTickCount = String(xTicks.length);
  graph.canvas.dataset.p3dCadYTickCount = String(yTicks.length);
  const aria = String(graph.canvas.getAttribute('aria-label') || '').trim();
  if (!aria.includes(`X axis: ${xLabel}`)) {
    graph.canvas.setAttribute('aria-label', `${aria}. X axis: ${xLabel}. Y axis: ${yLabel}.`);
  }
  return true;
}

function ensureInspector(modal) {
  let inspector = modal.querySelector('[data-p3d-cad-coordinate-inspector]');
  if (inspector) return inspector;
  inspector = modal.ownerDocument.createElement('aside');
  inspector.className = 'p3d-cad-coordinate-inspector';
  inspector.dataset.p3dCadCoordinateInspector = '1';
  inspector.dataset.active = 'false';
  inspector.innerHTML = `<strong>Coordinate Inspector</strong><dl>
<dt>Cumulative HLength</dt><dd data-p3d-cad-inspector-field="cumulative">—</dd><dt>Station / Chainage</dt><dd data-p3d-cad-inspector-field="station">—</dd><dt>Absolute H</dt><dd data-p3d-cad-inspector-field="absoluteH">—</dd><dt>Elevation</dt><dd data-p3d-cad-inspector-field="elevation">—</dd><dt>Depth / Z</dt><dd data-p3d-cad-inspector-field="depth">—</dd><dt>Segment</dt><dd data-p3d-cad-inspector-field="segment">—</dd><dt>Segment HLength</dt><dd data-p3d-cad-inspector-field="segmentLength">—</dd><dt>Item</dt><dd data-p3d-cad-inspector-field="item">—</dd></dl>`;
  modal.appendChild(inspector);
  return inspector;
}

function ensureStyle(doc) {
  if (!doc?.head || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `.p3d-cad-coordinate-inspector{position:absolute;z-index:6;right:16px;top:72px;width:300px;padding:9px 11px;border:1px solid #fb923c;border-radius:8px;background:rgba(7,17,31,.94);color:#e2e8f0;font:11px ui-monospace,monospace;pointer-events:none;opacity:0}.p3d-cad-coordinate-inspector[data-active="true"]{opacity:1}.p3d-cad-coordinate-inspector dl{display:grid;grid-template-columns:max-content 1fr;gap:3px 9px;margin:6px 0 0}.p3d-cad-coordinate-inspector dd{margin:0;text-align:right}`;
  doc.head.appendChild(style);
}

function updateInspector(inspector, detail) {
  inspector.dataset.active = detail ? 'true' : 'false';
  if (!detail) return;
  const values = {
    cumulative: `${detail.cumulative.toFixed(1)} m`, station: detail.stationText,
    absoluteH: detail.absoluteH.toFixed(3), elevation: Number.isFinite(detail.elevation) ? `${detail.elevation.toFixed(2)} m` : '—',
    depth: Number.isFinite(detail.depthZ) ? `${detail.depthText} (Z ${detail.depthZ.toFixed(2)} m)` : '—',
    segment: detail.segment ? `${detail.segment.fromH.toFixed(3)} → ${detail.segment.toH.toFixed(3)}` : '—',
    segmentLength: detail.segment ? `${detail.segment.hLength.toFixed(1)} m` : '—', item: detail.marker?.markerText || '—',
  };
  for (const [name, value] of Object.entries(values)) {
    const field = inspector.querySelector(`[data-p3d-cad-inspector-field="${name}"]`);
    if (field) field.textContent = value;
  }
}

export function mountPipelineCadEngineeringReview({ dialog, graphs, controller }) {
  const modal = dialog.querySelector('[data-p3d-split="x-modal"]');
  ensureStyle(dialog.ownerDocument || globalThis.document);
  const inspector = ensureInspector(modal);
  const cleanup = [];
  let activeDetail = null;
  for (const [name, graph] of Object.entries(graphs)) {
    const originalRender = graph.render;
    let decorationFrame = null;
    graph.render = function decoratedRender(...args) {
      const result = originalRender.apply(this, args);
      if (decorationFrame == null) decorationFrame = requestAnimationFrame(() => {
        decorationFrame = null;
        drawPipelineCadEngineeringAxes(graph, name);
      });
      return result;
    };
    const move = (event) => {
      const screen = graph.eventToScreen(event);
      const plot = graph.getPlotRect();
      if (screen.x < plot.left || screen.x > plot.right || screen.y < plot.top || screen.y > plot.bottom) return;
      activeDetail = buildPipelineCadInspection(controller.model, graph.screenToWorld(screen).x, { sourceGraph: name });
      updateInspector(inspector, activeDetail);
      Object.values(graphs).forEach((candidate) => { candidate.canvas.dataset.p3dCadInspectionCumulative = activeDetail.cumulative.toFixed(3); });
    };
    const leave = () => {
      activeDetail = null;
      updateInspector(inspector, null);
      Object.values(graphs).forEach((candidate) => { delete candidate.canvas.dataset.p3dCadInspectionCumulative; });
    };
    graph.canvas.addEventListener('pointermove', move);
    graph.canvas.addEventListener('pointerleave', leave);
    cleanup.push(() => graph.canvas.removeEventListener('pointermove', move));
    cleanup.push(() => graph.canvas.removeEventListener('pointerleave', leave));
    cleanup.push(() => { if (decorationFrame != null) cancelAnimationFrame(decorationFrame); graph.render = originalRender; });
    graph.render();
  }
  return Object.freeze({
    destroy() {
      cleanup.splice(0).forEach((dispose) => dispose());
      inspector.remove();
      activeDetail = null;
      return true;
    },
  });
}
