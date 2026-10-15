import {
  cancelPipelineCanvasFrame,
  schedulePipelineCanvasFrame,
  syncPipelineCanvasGeometry,
} from './pipeline-3d-model-canvas-runtime.js';
import {
  createPipelineCanvasGeometryUpdatedPayload,
  createPipelineCanvasNodeMovedPayload,
} from './pipeline-3d-model-canvas-contracts.js';

let operationSequence = 0;

function bind(target, type, listener, cleanup, options) {
  target?.addEventListener?.(type, listener, options);
  cleanup.push(() => target?.removeEventListener?.(type, listener, options));
}

function customEvent(target, type, detail, bubbles = false) {
  const EventCtor = target?.ownerDocument?.defaultView?.CustomEvent || globalThis.CustomEvent;
  if (!target?.dispatchEvent || typeof EventCtor !== 'function') return false;
  target.dispatchEvent(new EventCtor(type, { detail, bubbles }));
  return true;
}

function expectedReason(detail) {
  if (detail.graph === 'table2x') return 'move-table2-node';
  return detail.entityType === 'marker' ? 'move-table3-marker' : 'move-table3-depth';
}

export class ExplicitPipelineCanvasManager extends EventTarget {
  constructor(controller, graphs) {
    super();
    this.controller = controller;
    this.graphs = graphs;
    this.nodes = Object.freeze([]);
    this.edges = Object.freeze([]);
    this.cleanup = [];
    this.operations = new Map();
    this.previewFrame = null;
    this.pendingPreview = null;
    this.pendingCommit = null;
    this.destroyed = false;
    this.bindGraphs();
    this.bindController();
  }

  syncGeometry() {
    const geometries = Object.values(this.graphs).map(syncPipelineCanvasGeometry);
    this.nodes = Object.freeze(geometries.flatMap((geometry) => geometry.nodes));
    this.edges = Object.freeze(geometries.flatMap((geometry) => geometry.edges));
    return Object.freeze({ nodes: this.nodes, edges: this.edges });
  }

  operation(detail) {
    const key = `${detail.graph}:${detail.entityId}`;
    let operation = this.operations.get(key);
    if (!operation) {
      operation = { id: `canvas-op-${++operationSequence}`, key, detail: { ...detail } };
      this.operations.set(key, operation);
    }
    return operation;
  }

  dispatchCanvas(type, payload, graphName) {
    customEvent(this, type, payload);
    if (type === 'canvas:nodeMoved') customEvent(this.graphs[graphName]?.canvas, type, payload, true);
    else customEvent(this.controller.dialog, type, payload, true);
  }

  emitMove(operation, phase, detail, reason = null) {
    this.dispatchCanvas('canvas:nodeMoved', createPipelineCanvasNodeMovedPayload({
      operationId: operation.id,
      phase,
      detail,
      reason,
      modelRevision: this.controller.model?.revision,
      nodes: this.nodes,
      edges: this.edges,
    }), detail.graph);
  }

  emitGeometry(reason, graph = null, operationId = null) {
    this.dispatchCanvas('canvas:geometryUpdated', createPipelineCanvasGeometryUpdatedPayload({
      reason,
      graph,
      operationId,
      modelRevision: this.controller.model?.revision,
      nodes: this.nodes,
      edges: this.edges,
    }));
  }

  queuePreview(detail) {
    const operation = this.operation(detail);
    this.pendingPreview = { detail: { ...detail }, operation };
    if (this.previewFrame != null) return;
    this.previewFrame = schedulePipelineCanvasFrame(() => {
      this.previewFrame = null;
      const pending = this.pendingPreview;
      this.pendingPreview = null;
      if (!pending || this.destroyed) return;
      this.syncGeometry();
      this.emitMove(pending.operation, 'preview', pending.detail);
      this.emitGeometry('node-preview', pending.detail.graph, pending.operation.id);
    });
  }

  captureCommit(detail) {
    cancelPipelineCanvasFrame(this.previewFrame);
    this.previewFrame = null;
    this.pendingPreview = null;
    this.pendingCommit = { detail, operation: this.operation(detail), expected: expectedReason(detail) };
  }

  commit(detail) {
    const pending = this.pendingCommit;
    const matched = pending && pending.expected === detail.reason;
    this.syncGeometry();
    if (matched) {
      this.pendingCommit = null;
      this.emitMove(pending.operation, 'committed', pending.detail, detail.reason);
      this.operations.delete(pending.operation.key);
    }
    this.emitGeometry('commandCommitted', matched ? pending.detail.graph : null, matched ? pending.operation.id : null);
  }

  reset(reason, detail = {}) {
    cancelPipelineCanvasFrame(this.previewFrame);
    this.previewFrame = null;
    this.pendingPreview = null;
    this.pendingCommit = null;
    this.operations.clear();
    this.syncGeometry();
    this.emitGeometry(reason, detail.graph || null);
  }

  bindGraphs() {
    for (const graph of Object.values(this.graphs)) {
      bind(graph, 'nodePreviewMoved', (event) => this.queuePreview(event.detail || {}), this.cleanup);
      bind(graph, 'nodeMoved', (event) => this.captureCommit(event.detail || {}), this.cleanup);
      bind(graph, 'interactionCancelled', (event) => this.reset(event.detail?.reason || 'interaction-cancelled', event.detail), this.cleanup);
    }
  }

  bindController() {
    bind(this.controller, 'commandCommitted', (event) => this.commit(event.detail || {}), this.cleanup);
    for (const type of ['modelChanged', 'graphsReloaded', 'historyApplied']) {
      bind(this.controller, type, (event) => this.reset(type, event.detail || {}), this.cleanup);
    }
  }

  destroy() {
    if (this.destroyed) return false;
    this.destroyed = true;
    cancelPipelineCanvasFrame(this.previewFrame);
    this.cleanup.splice(0).forEach((dispose) => dispose());
    this.operations.clear();
    this.pendingPreview = null;
    this.pendingCommit = null;
    return true;
  }
}

function currentEditValue(controller, hit) {
  const row = controller.model?.findRow?.(hit?.node?.id);
  if (!row) return '';
  if (hit.type === 'marker') return row.markerText || '';
  if (hit.type === 'depth-node') return row.zText || '';
  return Number.isFinite(row.elevationValue) ? row.elevationValue.toFixed(2) : row.elevationText || '';
}

function bindInlineEditor(state, name) {
  const { stage, graph, controller } = state;
  const editor = stage.querySelector('[data-p3d-cad-inline-editor]');
  let active = null;
  const close = () => { active = null; editor.hidden = true; };
  const onDouble = (event) => {
    const screen = graph.eventToScreen(event);
    const hit = graph.hitTest(screen);
    if (!hit) return;
    active = { graph: name, entityId: hit.node.id, entityType: hit.type };
    editor.value = currentEditValue(controller, hit);
    editor.style.left = `${Math.max(6, screen.x - 60)}px`;
    editor.style.top = `${Math.max(48, screen.y - 16)}px`;
    editor.hidden = false;
    editor.focus();
    editor.select();
    event.preventDefault();
  };
  const commit = () => {
    if (!active) return;
    controller.renameEntity({ ...active, value: editor.value });
    close();
  };
  const onKey = (event) => {
    if (event.key === 'Enter') { event.preventDefault(); commit(); }
    if (event.key === 'Escape') { event.preventDefault(); close(); graph.canvas.focus(); }
  };
  bind(graph.canvas, 'dblclick', onDouble, state.cleanup);
  bind(editor, 'keydown', onKey, state.cleanup);
  bind(editor, 'blur', commit, state.cleanup);
}

function bindToolbar(state, name) {
  const { stage, graph, controller } = state;
  const toolbar = stage.querySelector('.p3d-cad-toolbar');
  const history = (detail = {}) => {
    toolbar.querySelector('[data-p3d-cad-action="undo"]').disabled = detail.canUndo ?? !controller.history.canUndo;
    toolbar.querySelector('[data-p3d-cad-action="redo"]').disabled = detail.canRedo ?? !controller.history.canRedo;
  };
  const click = (event) => {
    const button = event.target?.closest?.('button');
    if (!button) return;
    const tool = button.dataset.p3dCadTool;
    const action = button.dataset.p3dCadAction;
    if (tool) {
      graph.setTool(tool);
      toolbar.querySelectorAll('[data-p3d-cad-tool]').forEach((candidate) => candidate.setAttribute('aria-pressed', candidate === button ? 'true' : 'false'));
    } else if (action === 'fit') graph.fitToBounds();
    else if (action === 'reload') controller.reloadGraphs();
    else if (action === 'undo') controller.undo();
    else if (action === 'redo') controller.redo();
    state.resize();
  };
  bind(toolbar, 'click', click, state.cleanup);
  bind(controller, 'historyChanged', (event) => history(event.detail), state.cleanup);
  history();
  bindInlineEditor(state, name);
}

function bindStatus(state, name) {
  const status = state.stages[name].querySelector('[data-p3d-cad-status]');
  bind(state.controller, 'validationError', (event) => {
    status.dataset.state = 'error';
    status.textContent = event.detail?.error?.message || 'Raw profile data is incomplete.';
  }, state.cleanup);
  bind(state.controller, 'commandCommitted', (event) => {
    status.dataset.state = '';
    status.textContent = `${event.detail.reason} · revision ${event.detail.revision}`;
  }, state.cleanup);
}

export function bindPipelineCadWorkspace(options = {}) {
  const state = { ...options, cleanup: [] };
  for (const name of ['table2x', 'table3x']) {
    Object.assign(state, { stage: state.stages[name], graph: state.graphs[name] });
    bindToolbar(state, name);
    bindStatus(state, name);
  }
  const onPreview = (event) => {
    const preview = event.target?.closest?.('[data-p3d-split="btn-preview-x"]');
    const reload = event.target?.closest?.('[data-p3d-split="x-reload"]');
    if (!preview && !reload) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (preview) {
      const modal = state.dialog.querySelector('[data-p3d-split="x-modal"]');
      if (modal) modal.style.display = 'flex';
    } else state.controller.reloadGraphs();
    queueMicrotask(state.resize);
  };
  const onData = (event) => {
    if (!event.target?.closest?.('[data-p3d="new-multisheet"], [data-p3d="run"], [data-p3d-split-add], [data-p3d-split-delete]')) return;
    queueMicrotask(() => {
      state.controller.refreshFromRaw({ clearHistory: true, reloadGraphs: true, reason: 'dialog-data-action' });
      state.resize();
    });
  };
  bind(state.dialog, 'click', onPreview, state.cleanup, true);
  bind(state.dialog, 'click', onData, state.cleanup);
  const ResizeObserverCtor = globalThis.ResizeObserver;
  const observer = typeof ResizeObserverCtor === 'function' ? new ResizeObserverCtor(state.resize) : null;
  if (observer) Object.values(state.holders).forEach((holder) => observer.observe(holder));
  else bind(globalThis, 'resize', state.resize, state.cleanup);
  state.cleanup.push(() => observer?.disconnect?.());
  return Object.freeze({ destroy() { state.cleanup.splice(0).forEach((dispose) => dispose()); return true; } });
}
