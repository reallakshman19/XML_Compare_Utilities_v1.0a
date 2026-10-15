export const WORKBENCH_VIEWPORT_SCHEMA = 'WorkbenchViewportState.v1';

export const WorkbenchViewportScaleMode = Object.freeze({
  AUTO: 'auto-fit',
  CUSTOM: 'custom-range',
  RATIO: 'scale-ratio',
});

const SCALE_MODES = new Set(Object.values(WorkbenchViewportScaleMode));

export const DEFAULT_WORKBENCH_VIEWPORT_STATE = Object.freeze({
  schema: WORKBENCH_VIEWPORT_SCHEMA,
  namespace: 'workbench',
  surfaceId: 'surface',
  modeId: 'default',
  scaleMode: WorkbenchViewportScaleMode.AUTO,
  zoomX: 1,
  zoomY: 1,
  panX: 0,
  panY: 0,
  xScale: 1,
  yScale: 1,
  customRange: null,
  displayGrid: true,
  minorGrid: true,
  crosshair: true,
  linkX: false,
  linkY: false,
});

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function identifier(value, fallback) {
  const text = String(value ?? '').trim();
  return text || fallback;
}

export function normalizeWorkbenchViewportRange(value) {
  if (!value || typeof value !== 'object') return null;
  const minX = Number(value.minX);
  const maxX = Number(value.maxX);
  const minY = Number(value.minY);
  const maxY = Number(value.maxY);
  if (![minX, maxX, minY, maxY].every(Number.isFinite)) return null;
  if (!(maxX > minX) || !(maxY > minY)) return null;
  return Object.freeze({ minX, maxX, minY, maxY });
}

export function workbenchViewportScaleRatio(xScale, yScale) {
  return positive(xScale, 1) / positive(yScale, 1);
}

export function normalizeWorkbenchViewportState(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const scaleMode = SCALE_MODES.has(source.scaleMode)
    ? source.scaleMode
    : WorkbenchViewportScaleMode.AUTO;
  const xScale = positive(source.xScale, 1);
  const yScale = positive(source.yScale, 1);
  const ratioZoom = workbenchViewportScaleRatio(xScale, yScale);
  return Object.freeze({
    schema: WORKBENCH_VIEWPORT_SCHEMA,
    namespace: identifier(source.namespace, DEFAULT_WORKBENCH_VIEWPORT_STATE.namespace),
    surfaceId: identifier(source.surfaceId, DEFAULT_WORKBENCH_VIEWPORT_STATE.surfaceId),
    modeId: identifier(source.modeId, DEFAULT_WORKBENCH_VIEWPORT_STATE.modeId),
    scaleMode,
    zoomX: positive(source.zoomX, 1),
    zoomY: positive(source.zoomY, scaleMode === WorkbenchViewportScaleMode.RATIO ? ratioZoom : 1),
    panX: finite(source.panX, 0),
    panY: finite(source.panY, 0),
    xScale,
    yScale,
    customRange: normalizeWorkbenchViewportRange(source.customRange),
    displayGrid: source.displayGrid !== false,
    minorGrid: source.minorGrid !== false,
    crosshair: source.crosshair !== false,
    linkX: source.linkX === true,
    linkY: source.linkY === true,
  });
}
