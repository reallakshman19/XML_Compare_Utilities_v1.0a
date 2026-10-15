import {
  WorkbenchViewportCapability,
  createWorkbenchTransform,
  createWorkbenchViewportHost,
  normalizeWorkbenchViewportState,
  workbenchScreenToWorld,
  workbenchViewForRange,
  workbenchWorldToScreen,
} from '../../core/workbench-viewport/index.js';
import {
  loadUniversalSurfaceState,
  pivotViewIdentity,
  saveUniversalSurfaceState,
  viewportIdentity,
} from './universal-viewport-state.js';

const freeze = (value) => Object.freeze(value);
const arr = (value) => Array.isArray(value) ? value : [];

function plotBounds(surface) {
  const rect = surface?.getBoundingClientRect?.() || { width: 1, height: 1 };
  return freeze({ left: 0, top: 0, width: Math.max(1, rect.width), height: Math.max(1, rect.height) });
}

function worldBounds(rows, columns) {
  return freeze({
    minX: 0,
    maxX: Math.max(1, arr(columns).length - 1),
    minY: 0,
    maxY: Math.max(1, arr(rows).length - 1),
  });
}

function transformFor(surface, bounds, view) {
  return createWorkbenchTransform(bounds, plotBounds(surface), view);
}

function attributeValue(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

export function createUniversalPivotViewportHost(options = {}) {
  const surface = options.surface;
  const rows = arr(options.pivot?.rows);
  const columns = arr(options.pivot?.columns);
  const visibleRows = typeof options.rowProvider === 'function' ? options.rowProvider : () => rows;
  const identity = viewportIdentity(options.signature, 'pivot');
  const listeners = new Set();
  let disposed = false;
  let view = loadUniversalSurfaceState(options.signature, 'pivot', options.storage);
  const bounds = () => worldBounds(visibleRows(), columns);
  const notify = (type) => listeners.forEach((listener) => listener({ type, state: view }));
  const invalidate = () => {
    if (typeof options.onViewTransform === 'function') options.onViewTransform(view);
    else applyFallbackTransform(surface, view);
  };
  const apply = (next = {}) => {
    view = saveUniversalSurfaceState(normalizeWorkbenchViewportState({ ...view, ...next, ...identity }), options.storage);
    invalidate();
    notify('viewportChanged');
    return view;
  };
  const host = createWorkbenchViewportHost({
    ...identity,
    capabilities: [
      WorkbenchViewportCapability.FIT,
      WorkbenchViewportCapability.RANGE,
      WorkbenchViewportCapability.CROSSHAIR,
      WorkbenchViewportCapability.SELECT_SURFACE,
    ],
    getPlotBounds: () => plotBounds(surface),
    getWorldBounds: bounds,
    worldToScreen: (point) => {
      const world = bounds();
      return workbenchWorldToScreen(transformFor(surface, world, view), { x: point.x, y: world.maxY - Number(point.y) });
    },
    screenToWorld: (point) => {
      const worldBoundsValue = bounds();
      const world = workbenchScreenToWorld(transformFor(surface, worldBoundsValue, view), point);
      return freeze({ x: world.x, y: worldBoundsValue.maxY - world.y });
    },
    readViewTransform: () => view,
    applyViewTransform: apply,
    invalidate,
    formatPointer: (point) => `${columns[Math.max(0, Math.round(point.x))] || 'Column'} · Row ${Math.max(0, Math.round(point.y)) + 1}`,
    statusSegments: () => ['Pivot', `${visibleRows().length} / ${rows.length} rows`, `${columns.length} columns`],
    subscribe: (listener) => {
      if (disposed || typeof listener !== 'function') return () => undefined;
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose: () => {
      if (disposed) return false;
      disposed = true;
      listeners.clear();
      return true;
    },
    fit: () => apply({ zoomX: 1, zoomY: 1, panX: 0, panY: 0, customRange: null, scaleMode: 'auto-fit' }),
    applyRange: (range) => apply({ ...workbenchViewForRange(bounds(), plotBounds(surface), range), customRange: range, scaleMode: 'custom-range' }),
    zoomBy: (xFactor = 1, yFactor = 1) => apply({ zoomX: view.zoomX * xFactor, zoomY: view.zoomY * yFactor }),
    panBy: (dx = 0, dy = 0) => apply({ panX: view.panX + dx, panY: view.panY + dy }),
    reveal: (id) => {
      if (typeof options.revealIdentity === 'function') return Boolean(options.revealIdentity(id));
      const row = surface?.querySelector?.(`[data-uxc-pivot-id="${attributeValue(id)}"]`);
      row?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      return Boolean(row);
    },
    rows,
    visibleRows,
    columns,
    identityFor: pivotViewIdentity,
  });
  invalidate();
  return host;
}

function applyFallbackTransform(surface, state) {
  const content = surface?.querySelector?.('[data-uxc-viewport-content]');
  if (!content) return;
  content.style.transformOrigin = '0 0';
  content.style.transform = `translate(${state.panX}px,${state.panY}px) scale(${state.zoomX},${state.zoomY})`;
}

export const _test = freeze({ plotBounds, worldBounds, attributeValue, applyFallbackTransform });
