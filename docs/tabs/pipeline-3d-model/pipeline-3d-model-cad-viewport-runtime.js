import {
  createWorkbenchTransform,
  workbenchHorizontalViewForRange,
  workbenchScreenToWorld,
  workbenchViewForRange,
  workbenchVisibleRange,
  workbenchWorldToScreen,
} from '../../core/workbench-viewport/index.js';
import { clamp } from './pipeline-3d-model-cad-math.js';
import { drawPipelineCadEngineeringGrid } from './pipeline-3d-model-cad-engineering-grid.js';
import { InteractiveGraph } from './pipeline-3d-model-interactive-graph.js';
import {
  PipelineCadScaleMode,
  normalizePipelineCadViewportState,
  pipelineCadVerticalExaggeration,
} from './pipeline-3d-model-cad-viewport-state.js';

const PATCH = Symbol.for('pipeline3d.cad.viewport-runtime.v2');

function positive(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function graphIdentity(graph) {
  return graph?.canvas?.dataset?.p3dCadCanvas === 'table3x' ? 'table3x' : 'table2x';
}

function ensureState(graph) {
  if (!graph.__pipelineCadViewportState) {
    graph.__pipelineCadViewportState = normalizePipelineCadViewportState({
      graph: graphIdentity(graph),
      zoomX: positive(graph.zoomX ?? graph.zoom, 1),
      zoomY: positive(graph.zoomY ?? graph.zoom, 1),
    });
  }
  graph.zoomX = positive(graph.zoomX, graph.__pipelineCadViewportState.zoomX);
  graph.zoomY = positive(graph.zoomY, graph.__pipelineCadViewportState.zoomY);
  graph.zoom = graph.zoomX;
  return graph.__pipelineCadViewportState;
}

function updateState(graph, patch = {}) {
  const current = ensureState(graph);
  const next = normalizePipelineCadViewportState({
    ...current,
    ...patch,
    graph: graphIdentity(graph),
    zoomX: graph.zoomX,
    zoomY: graph.zoomY,
    panX: graph.panX,
    panY: graph.panY,
  });
  graph.__pipelineCadViewportState = next;
  return next;
}

function dispatchViewport(graph, reason) {
  const detail = { ...graph.getViewport(), reason };
  graph.dispatchGraphEvent?.('viewportChanged', detail);
  graph.render?.();
  return detail;
}

function transformOf(graph) {
  return createWorkbenchTransform(graph.bounds, graph.getPlotRect(), {
    zoomX: graph.zoomX,
    zoomY: graph.zoomY,
    panX: graph.panX,
    panY: graph.panY,
  });
}

function applyCustomRange(graph, range) {
  const next = workbenchViewForRange(graph.bounds, graph.getPlotRect(), range, {
    minZoom: graph.minZoom,
    maxZoom: graph.maxZoom,
  });
  Object.assign(graph, { zoomX: next.zoomX, zoomY: next.zoomY, zoom: next.zoomX, panX: next.panX, panY: next.panY });
}

function worldToScreen(point) {
  ensureState(this);
  return workbenchWorldToScreen(transformOf(this), point);
}

function screenToWorld(point) {
  ensureState(this);
  return workbenchScreenToWorld(transformOf(this), point);
}

function getViewport() {
  const state = ensureState(this);
  return Object.freeze({
    zoom: this.zoomX,
    zoomX: this.zoomX,
    zoomY: this.zoomY,
    panX: this.panX,
    panY: this.panY,
    width: this.width,
    height: this.height,
    bounds: { ...this.bounds },
    padding: { ...this.padding },
    scaleMode: state.scaleMode,
    horizontalScale: state.horizontalScale,
    verticalScale: state.verticalScale,
    displayGrid: state.displayGrid,
    minorGrid: state.minorGrid,
  });
}

function fitToBounds() {
  Object.assign(this, { zoomX: 1, zoomY: 1, zoom: 1, panX: 0, panY: 0 });
  updateState(this, { scaleMode: PipelineCadScaleMode.AUTO, customRange: null });
  return dispatchViewport(this, 'fit');
}

function zoomAt(screenPoint, factor, axes = 'both') {
  ensureState(this);
  const before = this.screenToWorld(screenPoint);
  const multiplier = positive(factor, 1);
  if (axes !== 'y') this.zoomX = clamp(this.zoomX * multiplier, this.minZoom, this.maxZoom);
  if (axes !== 'x') this.zoomY = clamp(this.zoomY * multiplier, this.minZoom, this.maxZoom);
  this.zoom = this.zoomX;
  const after = this.worldToScreen(before);
  if (axes !== 'y') this.panX += Number(screenPoint.x) - after.x;
  if (axes !== 'x') this.panY += Number(screenPoint.y) - after.y;
  updateState(this, { scaleMode: PipelineCadScaleMode.AUTO });
  return dispatchViewport(this, `zoom-${axes}`);
}

function panBy(dx, dy, axes = 'both') {
  ensureState(this);
  if (axes !== 'y') this.panX += Number(dx) || 0;
  if (axes !== 'x') this.panY += Number(dy) || 0;
  updateState(this);
  return dispatchViewport(this, `pan-${axes}`);
}

function applyViewportState(value, options = {}) {
  const state = normalizePipelineCadViewportState(value);
  Object.assign(this, {
    zoomX: state.zoomX,
    zoomY: state.zoomY,
    zoom: state.zoomX,
    panX: state.panX,
    panY: state.panY,
  });
  if (state.scaleMode === PipelineCadScaleMode.CUSTOM && state.customRange) applyCustomRange(this, state.customRange);
  if (state.scaleMode === PipelineCadScaleMode.ENGINEERING) {
    this.zoomY = this.zoomX * pipelineCadVerticalExaggeration(state.horizontalScale, state.verticalScale);
  }
  this.__pipelineCadViewportState = normalizePipelineCadViewportState({
    ...state,
    graph: graphIdentity(this),
    zoomX: this.zoomX,
    zoomY: this.zoomY,
    panX: this.panX,
    panY: this.panY,
  });
  if (options.render !== false) dispatchViewport(this, 'state-applied');
  return this.__pipelineCadViewportState;
}

function setEngineeringScale(horizontalScale, verticalScale) {
  const h = positive(horizontalScale, 1000);
  const v = positive(verticalScale, 100);
  this.zoomY = this.zoomX * pipelineCadVerticalExaggeration(h, v);
  updateState(this, {
    scaleMode: PipelineCadScaleMode.ENGINEERING,
    horizontalScale: h,
    verticalScale: v,
    customRange: null,
  });
  return dispatchViewport(this, 'engineering-scale');
}

function setCustomRange(range) {
  const state = normalizePipelineCadViewportState({
    ...ensureState(this),
    scaleMode: PipelineCadScaleMode.CUSTOM,
    customRange: range,
  });
  if (!state.customRange) throw new RangeError('Custom range requires increasing finite X and Y limits.');
  applyCustomRange(this, state.customRange);
  updateState(this, { scaleMode: PipelineCadScaleMode.CUSTOM, customRange: state.customRange });
  return dispatchViewport(this, 'custom-range');
}

function horizontalRange() {
  const range = workbenchVisibleRange(transformOf(this));
  return Object.freeze({ minX: range.minX, maxX: range.maxX });
}

function setHorizontalViewport(range, options = {}) {
  ensureState(this);
  const next = workbenchHorizontalViewForRange(
    this.bounds,
    this.getPlotRect(),
    range,
    { zoomY: this.zoomY, panY: this.panY },
    { minZoom: this.minZoom, maxZoom: this.maxZoom },
  );
  this.zoomX = next.zoomX;
  this.zoom = next.zoomX;
  this.panX = next.panX;
  updateState(this);
  if (options.silent === true) this.render?.();
  else dispatchViewport(this, 'linked-x');
  return this.getViewport();
}

function setGrid(settings = {}) {
  const current = ensureState(this);
  const state = updateState(this, {
    displayGrid: settings.displayGrid ?? current.displayGrid,
    minorGrid: settings.minorGrid ?? current.minorGrid,
  });
  this.render?.();
  return state;
}

function installMethods(prototype) {
  Object.assign(prototype, {
    worldToScreen,
    screenToWorld,
    getViewport,
    fitToBounds,
    panBy,
    applyPipelineCadViewportState: applyViewportState,
    setPipelineCadEngineeringScale: setEngineeringScale,
    setPipelineCadCustomRange: setCustomRange,
    getPipelineCadHorizontalRange: horizontalRange,
    setPipelineCadHorizontalViewport: setHorizontalViewport,
    setPipelineCadGrid: setGrid,
  });
  prototype.zoomAt = function zoom(point, factor) { return zoomAt.call(this, point, factor, 'both'); };
  prototype.zoomHorizontalAt = function zoomX(point, factor) { return zoomAt.call(this, point, factor, 'x'); };
  prototype.zoomVerticalAt = function zoomY(point, factor) { return zoomAt.call(this, point, factor, 'y'); };
  prototype.panHorizontalBy = function panX(dx) { return panBy.call(this, dx, 0, 'x'); };
  prototype.panVerticalBy = function panY(dy) { return panBy.call(this, 0, dy, 'y'); };
  prototype.getPipelineCadViewportState = function getState() { return ensureState(this); };
  prototype.drawGrid = function drawGrid(context = this.context) {
    return drawPipelineCadEngineeringGrid(this, context, ensureState(this));
  };
}

export function installPipelineCadViewportRuntime() {
  const prototype = InteractiveGraph.prototype;
  if (prototype[PATCH]) return false;
  Object.defineProperty(prototype, PATCH, { value: true });
  installMethods(prototype);
  return true;
}

installPipelineCadViewportRuntime();
