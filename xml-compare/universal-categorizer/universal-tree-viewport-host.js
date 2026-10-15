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
  saveUniversalSurfaceState,
  treeViewIdentity,
  viewportIdentity,
} from './universal-viewport-state.js';

const freeze = (value) => Object.freeze(value);
const arr = (value) => Array.isArray(value) ? value : [];

function plotBounds(surface) {
  const rect = surface?.getBoundingClientRect?.() || { width: 1, height: 1 };
  return freeze({ left: 0, top: 0, width: Math.max(1, rect.width), height: Math.max(1, rect.height) });
}

function worldBounds(nodes) {
  const maxDepth = Math.max(1, ...arr(nodes).map((node) => Number(node.depth) || 0));
  const maxRow = Math.max(1, arr(nodes).length - 1);
  return freeze({ minX: 0, maxX: maxDepth + 1, minY: 0, maxY: maxRow });
}

function transformFor(surface, bounds, view) {
  return createWorkbenchTransform(bounds, plotBounds(surface), view);
}

function attributeValue(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

export function createUniversalTreeViewportHost(options = {}) {
  const surface = options.surface;
  const nodes = arr(options.tree?.nodes);
  const visibleRows = typeof options.rowProvider === 'function' ? options.rowProvider : () => nodes;
  const identity = viewportIdentity(options.signature, 'tree');
  const listeners = new Set();
  let disposed = false;
  let view = loadUniversalSurfaceState(options.signature, 'tree', options.storage);
  const bounds = () => worldBounds(visibleRows());
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
    formatPointer: (point) => `Depth ${Math.max(0, Math.round(point.x))} · Row ${Math.max(0, Math.round(point.y)) + 1}`,
    statusSegments: () => ['Tree', `${visibleRows().length} / ${nodes.length} rows`],
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
      const row = surface?.querySelector?.(`[data-uxc-tree-id="${attributeValue(id)}"]`);
      row?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      return Boolean(row);
    },
    rows: nodes,
    visibleRows,
    identityFor: treeViewIdentity,
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
