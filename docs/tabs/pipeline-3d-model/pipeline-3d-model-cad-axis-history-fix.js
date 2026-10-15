import { PipelineCadController } from './pipeline-3d-model-cad-controller.js';
import { Table3XCanvas } from './pipeline-3d-model-table3x-canvas.js';

export const PIPELINE_CAD_TABLE3_X_AXIS_LABEL = 'HLength Cumulative (m)';
export const PIPELINE_CAD_AXIS_HISTORY_BUILD = '2026.07.13-axis-history-1';

const TABLE3_RENDER_PATCH = Symbol.for('pipeline3d.cad.table3-axis.render.patch.v1');
const CONTROLLER_PATCH = Symbol.for('pipeline3d.cad.history-toolbar.controller.patch.v1');
const CONTROLLER_BOUND = Symbol.for('pipeline3d.cad.history-toolbar.controller.bound.v1');

function setButtonState(button, enabled) {
  if (!button) return;
  button.disabled = !enabled;
  button.setAttribute?.('aria-disabled', enabled ? 'false' : 'true');
}

export function syncPipelineCadHistoryButtons(controller) {
  const dialog = controller?.dialog;
  const history = controller?.history;
  if (!dialog?.querySelectorAll || !history) {
    return Object.freeze({ undoButtons: 0, redoButtons: 0, canUndo: false, canRedo: false });
  }

  const undoButtons = Array.from(dialog.querySelectorAll('[data-p3d-cad-action="undo"]'));
  const redoButtons = Array.from(dialog.querySelectorAll('[data-p3d-cad-action="redo"]'));
  const canUndo = Boolean(history.canUndo);
  const canRedo = Boolean(history.canRedo);
  undoButtons.forEach((button) => setButtonState(button, canUndo));
  redoButtons.forEach((button) => setButtonState(button, canRedo));

  return Object.freeze({
    undoButtons: undoButtons.length,
    redoButtons: redoButtons.length,
    canUndo,
    canRedo,
  });
}

function scheduleHistoryButtonSync(controller) {
  const schedule = globalThis.queueMicrotask || ((callback) => Promise.resolve().then(callback));
  schedule(() => syncPipelineCadHistoryButtons(controller));
}

export function drawPipelineCadTable3XAxisLabel(graph, context = graph?.context) {
  if (!graph || !context?.fillText || typeof graph.getPlotRect !== 'function') return false;
  const plot = graph.getPlotRect();
  const availableBottom = Math.max(18, Number(graph.height || 0) - Number(plot.bottom || 0));
  const x = Number(plot.left || 0) + (Number(plot.width || 0) / 2);
  const y = Math.min(
    Math.max(Number(plot.bottom || 0) + 18, Number(graph.height || 0) - availableBottom / 2),
    Math.max(18, Number(graph.height || 0) - 14),
  );

  context.save?.();
  context.fillStyle = '#cbd5e1';
  context.font = '600 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(PIPELINE_CAD_TABLE3_X_AXIS_LABEL, x, y);
  context.restore?.();

  if (graph.canvas) {
    graph.canvas.dataset.p3dCadXAxisLabel = PIPELINE_CAD_TABLE3_X_AXIS_LABEL;
    const current = String(graph.canvas.getAttribute?.('aria-label') || '').trim();
    if (current && !current.includes(PIPELINE_CAD_TABLE3_X_AXIS_LABEL)) {
      graph.canvas.setAttribute?.('aria-label', `${current}. X axis: ${PIPELINE_CAD_TABLE3_X_AXIS_LABEL}.`);
    }
  }
  return true;
}

function patchTable3Render() {
  const prototype = Table3XCanvas.prototype;
  if (prototype[TABLE3_RENDER_PATCH]) return false;
  Object.defineProperty(prototype, TABLE3_RENDER_PATCH, { value: true });
  const originalRender = prototype.render;
  prototype.render = function renderWithTable3XAxisLabel(...args) {
    const result = originalRender.apply(this, args);
    drawPipelineCadTable3XAxisLabel(this, this.context);
    return result;
  };
  return true;
}

function patchControllerHistoryBinding() {
  const prototype = PipelineCadController.prototype;
  if (prototype[CONTROLLER_PATCH]) return false;
  Object.defineProperty(prototype, CONTROLLER_PATCH, { value: true });
  const originalAttachGraphs = prototype.attachGraphs;
  prototype.attachGraphs = function attachGraphsWithHistoryToolbarFix(...args) {
    const result = originalAttachGraphs.apply(this, args);
    if (!this[CONTROLLER_BOUND]) {
      Object.defineProperty(this, CONTROLLER_BOUND, { value: true });
      const onHistoryChanged = () => scheduleHistoryButtonSync(this);
      this.addEventListener('historyChanged', onHistoryChanged);
      this.cleanup?.push?.(() => this.removeEventListener('historyChanged', onHistoryChanged));
    }
    scheduleHistoryButtonSync(this);
    return result;
  };
  return true;
}

export function installPipelineCadAxisHistoryFix() {
  const table3Patched = patchTable3Render();
  const historyPatched = patchControllerHistoryBinding();
  return Object.freeze({ table3Patched, historyPatched });
}

installPipelineCadAxisHistoryFix();
