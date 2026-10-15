import {
  WorkbenchViewportCapability,
  createWorkbenchViewportHost,
} from '../../core/workbench-viewport/index.js';
import { formatStation, interpolateAbsoluteHFromCumulative } from './pipeline-3d-model-cad-math.js';

export const PIPELINE_CAD_VIEWPORT_NAMESPACE = 'pipeline-cad';
export const PIPELINE_CAD_VIEWPORT_MODE = 'pipeline-profile';

export function pipelineCadViewportSurfaceId(graph) {
  return graph?.canvas?.dataset?.p3dCadCanvas === 'table3x' ? 'table3x' : 'table2x';
}

export function formatPipelineCadViewportPointer(graph, world, surfaceId = pipelineCadViewportSurfaceId(graph)) {
  if (surfaceId === 'table3x') {
    const map = graph.model?.coordinateMap;
    const absoluteH = map ? interpolateAbsoluteHFromCumulative(world.x, map) : NaN;
    const h = Number.isFinite(absoluteH) ? absoluteH.toFixed(3) : '—';
    return `HLength ${world.x.toFixed(2)} m · H ${h} · Z ${world.y.toFixed(2)} m`;
  }
  return `${formatStation(world.x, 2)} · Elev ${world.y.toFixed(2)} m`;
}

function hostCapabilities() {
  return [
    WorkbenchViewportCapability.FIT,
    WorkbenchViewportCapability.RANGE,
    WorkbenchViewportCapability.SCALE_RATIO,
    WorkbenchViewportCapability.GRID,
    WorkbenchViewportCapability.MINOR_GRID,
    WorkbenchViewportCapability.CROSSHAIR,
    WorkbenchViewportCapability.LINK_X,
  ];
}

export function createPipelineCadViewportHost(graph, options = {}) {
  if (!graph) throw new TypeError('Pipeline CAD graph is required.');
  const surfaceId = options.surfaceId || pipelineCadViewportSurfaceId(graph);
  const listeners = new Set();
  const subscriptions = ['viewportChanged', 'toolChanged', 'snapSettingsChanged']
    .map((type) => {
      const handler = (event) => listeners.forEach((listener) => listener({ type, detail: event.detail }));
      graph.addEventListener?.(type, handler);
      return () => graph.removeEventListener?.(type, handler);
    });
  let disposed = false;
  return createWorkbenchViewportHost({
    namespace: PIPELINE_CAD_VIEWPORT_NAMESPACE,
    surfaceId,
    modeId: PIPELINE_CAD_VIEWPORT_MODE,
    capabilities: hostCapabilities(),
    getPlotBounds: () => Object.freeze({ ...graph.getPlotRect() }),
    getWorldBounds: () => Object.freeze({ ...graph.bounds }),
    worldToScreen: (point) => graph.worldToScreen(point),
    screenToWorld: (point) => graph.screenToWorld(point),
    readViewTransform: () => graph.getPipelineCadViewportState?.() || graph.getViewport(),
    applyViewTransform: (state) => graph.applyPipelineCadViewportState?.(state),
    invalidate: () => graph.render?.(),
    formatPointer: (point) => formatPipelineCadViewportPointer(graph, point, surfaceId),
    statusSegments: () => [surfaceId, graph.tool || 'review'],
    subscribe: (listener) => {
      if (disposed || typeof listener !== 'function') return () => undefined;
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose: () => {
      if (disposed) return false;
      disposed = true;
      subscriptions.splice(0).forEach((dispose) => dispose());
      listeners.clear();
      return true;
    },
  });
}
