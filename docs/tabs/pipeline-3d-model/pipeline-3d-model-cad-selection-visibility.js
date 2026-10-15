import { InteractiveGraph } from './pipeline-3d-model-interactive-graph.js';
import { Table2XCanvas } from './pipeline-3d-model-table2x-canvas.js';
import { Table3XCanvas } from './pipeline-3d-model-table3x-canvas.js';

const PATCH = Symbol.for('pipeline3d.cad.selection-visibility.patch.v1');

function selectedEntity(graph) {
  if (graph instanceof Table2XCanvas) {
    return graph.currentNodes?.().find?.((node) => node.id === graph.selectedId) ?? null;
  }
  if (graph instanceof Table3XCanvas) {
    const id = graph.selected?.id;
    if (!id) return null;
    return [
      ...(graph.markerNodes?.() || []),
      ...(graph.depthNodes?.() || []),
    ].find((node) => node.id === id) ?? null;
  }
  return null;
}

export function keepPipelineCadSelectionVisible(graph, options = {}) {
  const entity = selectedEntity(graph);
  if (!entity) return false;
  const plot = graph.getPlotRect?.();
  const screen = graph.worldToScreen?.(entity);
  if (!plot || !screen) return false;
  const margin = Math.max(18, Number(options.margin) || 32);
  let dx = 0;
  let dy = 0;
  if (screen.x < plot.left + margin) dx = plot.left + margin - screen.x;
  else if (screen.x > plot.right - margin) dx = plot.right - margin - screen.x;
  if (screen.y < plot.top + margin) dy = plot.top + margin - screen.y;
  else if (screen.y > plot.bottom - margin) dy = plot.bottom - margin - screen.y;
  if (!dx && !dy) return false;
  graph.panBy?.(dx, dy);
  return true;
}

export function installPipelineCadSelectionVisibility() {
  const prototype = InteractiveGraph.prototype;
  if (prototype[PATCH]) return false;
  Object.defineProperty(prototype, PATCH, { value: true });
  const originalZoomAt = prototype.zoomAt;
  prototype.zoomAt = function zoomAtKeepingSelectionVisible(...args) {
    const result = originalZoomAt.apply(this, args);
    keepPipelineCadSelectionVisible(this);
    return result;
  };
  return true;
}

installPipelineCadSelectionVisibility();
