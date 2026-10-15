import { PipelineCadController } from './pipeline-3d-model-cad-controller.js';
import {
  cancelPipelineCanvasFrame,
  schedulePipelineCanvasFrame,
  syncPipelineCanvasGeometry,
} from './pipeline-3d-model-canvas-runtime.js';
import {
  createPipelineCanvasGeometryUpdatedPayload,
  createPipelineCanvasNodeMovedPayload,
} from './pipeline-3d-model-canvas-contracts.js';

const CONTROLLER_PATCH = Symbol.for('pipeline3d.canvas-audit.controller.v2');
const ACTIVE_MANAGERS = new Set();
const OBSERVERS = new WeakMap();
let operationSequence = 0;

function dispatchCustomEvent(target, type, detail, bubbles = false) {
  const CustomEventCtor = target?.ownerDocument?.defaultView?.CustomEvent || globalThis.CustomEvent;
  if (!target?.dispatchEvent || typeof CustomEventCtor !== 'function') return false;
  target.dispatchEvent(new CustomEventCtor(type, { detail, bubbles }));
  return true;
}

function bindEvent(target, type, listener, cleanup) {
  target?.addEventListener?.(type, listener);
  cleanup.push(() => target?.removeEventListener?.(type, listener));
}

function expectedCommitReason(detail = {}) {
  if (detail.graph === 'table2x') return 'move-table2-node';
  return detail.entityType === 'marker' ? 'move-table3-marker' : 'move-table3-depth';
}

export class PipelineCanvasManager extends EventTarget {
  constructor(controller, graphs = {}) {
    super();
    this.controller = controller || null;
    this.graphs = { table2x: graphs.table2x || null, table3x: graphs.table3x || null };
    this.nodes = Object.freeze([]);
    this.edges = Object.freeze([]);
    this.cleanup = [];
    this.previewFrame = null;
    this.pendingPreview = null;
    this.pendingCommit = null;
    this.operations = new Map();
    this.destroyed = false;
    this.bindGraphs();
    this.bindController();
    ACTIVE_MANAGERS.add(this);
    installPipelineCanvasLifecycleObserver(controller?.dialog?.ownerDocument || globalThis.document);
  }

  syncGeometry() {
    const geometries = Object.values(this.graphs).filter(Boolean).map(syncPipelineCanvasGeometry);
    this.nodes = Object.freeze(geometries.flatMap((geometry) => geometry.nodes));
    this.edges = Object.freeze(geometries.flatMap((geometry) => geometry.edges));
    return { nodes: this.nodes, edges: this.edges };
  }

  operation(detail = {}) {
    const key = `${detail.graph || 'unknown'}:${detail.entityId || 'unknown'}`;
    let operation = this.operations.get(key);
    if (!operation) {
      operation = { id: `canvas-op-${++operationSequence}`, key, detail: { ...detail } };
      this.operations.set(key, operation);
    } else operation.detail = { ...operation.detail, ...detail };
    return operation;
  }

  dispatch(type, payload, graphName = null) {
    dispatchCustomEvent(this, type, payload);
    if (type === 'canvas:nodeMoved') {
      dispatchCustomEvent(this.graphs?.[graphName]?.canvas, type, payload, true);
    } else {
      dispatchCustomEvent(this.controller?.dialog, type, payload, true);
    }
  }

  emitNodeMove(operation, phase, detail, reason = null) {
    const payload = createPipelineCanvasNodeMovedPayload({
      operationId: operation.id,
      phase,
      detail,
      reason,
      modelRevision: this.controller?.model?.revision,
      nodes: this.nodes,
      edges: this.edges,
    });
    this.dispatch('canvas:nodeMoved', payload, detail.graph);
  }

  emitGeometry(reason, graph = null, operationId = null) {
    const payload = createPipelineCanvasGeometryUpdatedPayload({
      reason,
      graph,
      operationId,
      modelRevision: this.controller?.model?.revision,
      nodes: this.nodes,
      edges: this.edges,
    });
    this.dispatch('canvas:geometryUpdated', payload);
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
      this.emitNodeMove(pending.operation, 'preview', pending.detail);
      this.emitGeometry('node-preview', pending.detail.graph, pending.operation.id);
    });
  }

  cancelPreview() {
    cancelPipelineCanvasFrame(this.previewFrame);
    this.previewFrame = null;
    this.pendingPreview = null;
  }

  cancelOperations(detail = {}) {
    const graph = detail.graph || null;
    const affected = [...this.operations.values()].filter((operation) => !graph || operation.detail.graph === graph);
    this.cancelPreview();
    this.pendingCommit = null;
    this.syncGeometry();
    affected.forEach((operation) => this.emitNodeMove(operation, 'cancelled', operation.detail, detail.reason || 'interaction-cancelled'));
    affected.forEach((operation) => this.operations.delete(operation.key));
    this.emitGeometry(detail.reason || 'interaction-cancelled', graph);
  }

  bindGraphs() {
    Object.values(this.graphs).filter(Boolean).forEach((graph) => {
      bindEvent(graph, 'nodePreviewMoved', (event) => this.queuePreview(event.detail || {}), this.cleanup);
      bindEvent(graph, 'nodeMoved', (event) => this.capturePendingCommit(event.detail || {}), this.cleanup);
      bindEvent(graph, 'interactionCancelled', (event) => this.cancelOperations(event.detail || {}), this.cleanup);
    });
  }

  rollbackDetail(detail = {}) {
    const graph = this.graphs?.[detail.graph];
    if (!graph || !detail.entityId) return false;
    if (detail.graph === 'table2x') graph.visualOverrides?.delete?.(detail.entityId);
    else if (detail.entityType === 'marker') graph.markerOverrides?.delete?.(detail.entityId);
    else graph.depthOverrides?.delete?.(detail.entityId);
    if ('draggingId' in graph) graph.draggingId = null;
    if ('dragging' in graph) graph.dragging = null;
    graph.render?.();
    return true;
  }

  capturePendingCommit(detail) {
    this.cancelPreview();
    this.pendingCommit = {
      detail,
      operation: this.operation(detail),
      expectedReason: expectedCommitReason(detail),
    };
    queueMicrotask(() => {
      if (!this.pendingCommit || this.pendingCommit.detail !== detail || this.destroyed) return;
      const pending = this.pendingCommit;
      this.pendingCommit = null;
      this.rollbackDetail(pending.detail);
      this.syncGeometry();
      this.emitNodeMove(pending.operation, 'cancelled', pending.detail, 'commit-rejected');
      this.operations.delete(pending.operation.key);
      this.emitGeometry('commit-rejected', pending.detail.graph, pending.operation.id);
    });
  }

  bindController() {
    bindEvent(this.controller, 'commandCommitted', (event) => this.commitPendingMove(event.detail || {}), this.cleanup);
    ['modelChanged', 'graphsReloaded', 'historyApplied'].forEach((type) => bindEvent(this.controller, type, (event) => {
      this.resetForGeometryChange(type, event.detail || {});
    }, this.cleanup));
  }

  commitPendingMove(detail) {
    const pending = this.pendingCommit;
    const matched = pending && detail.reason === pending.expectedReason;
    this.syncGeometry();
    if (matched) {
      this.pendingCommit = null;
      this.emitNodeMove(pending.operation, 'committed', pending.detail, detail.reason);
      this.operations.delete(pending.operation.key);
    }
    this.emitGeometry('commandCommitted', matched ? pending.detail.graph : null, matched ? pending.operation.id : null);
  }

  resetForGeometryChange(reason, detail = {}) {
    this.cancelPreview();
    this.pendingCommit = null;
    this.operations.clear();
    this.syncGeometry();
    this.emitGeometry(reason, detail.graph || null);
  }

  destroy() {
    if (this.destroyed) return false;
    this.destroyed = true;
    this.cancelPreview();
    this.pendingCommit = null;
    this.operations.clear();
    this.cleanup.splice(0).forEach((dispose) => dispose());
    ACTIVE_MANAGERS.delete(this);
    return true;
  }
}

function patchController() {
  const prototype = PipelineCadController.prototype;
  if (prototype[CONTROLLER_PATCH]) return;
  Object.defineProperty(prototype, CONTROLLER_PATCH, { value: true });
  const attachGraphs = prototype.attachGraphs;
  prototype.attachGraphs = function attachAuditedGraphs(graphs, ...args) {
    this.canvasManager?.destroy?.();
    const manager = new PipelineCanvasManager(this, graphs || {});
    this.canvasManager = manager;
    try {
      const result = attachGraphs.call(this, graphs, ...args);
      manager.graphs = { ...this.graphs };
      manager.syncGeometry();
      return result;
    } catch (error) {
      this.canvasManager = null;
      manager.destroy();
      throw error;
    }
  };
  const destroy = prototype.destroy;
  prototype.destroy = function destroyAuditedController() {
    const manager = this.canvasManager;
    this.canvasManager = null;
    manager?.destroy?.();
    return destroy.call(this);
  };
}

function managerIsDetached(manager, doc) {
  const dialog = manager?.controller?.dialog;
  if (!dialog) return false;
  if (typeof dialog.isConnected === 'boolean') return !dialog.isConnected;
  return Boolean(doc?.documentElement?.contains) && !doc.documentElement.contains(dialog);
}

function destroyManagerHost(manager) {
  const graphs = Object.values(manager.graphs).filter(Boolean);
  manager.controller?.destroy?.();
  graphs.forEach((graph) => graph.destroy?.());
}

export function pruneDetachedPipelineCanvasManagers(doc = globalThis.document) {
  let destroyed = 0;
  [...ACTIVE_MANAGERS].forEach((manager) => {
    if (!managerIsDetached(manager, doc)) return;
    destroyManagerHost(manager);
    destroyed += 1;
  });
  return destroyed;
}

export function installPipelineCanvasLifecycleObserver(doc = globalThis.document) {
  if (!doc?.body || OBSERVERS.has(doc)) return OBSERVERS.get(doc) || null;
  const MutationObserverCtor = doc.defaultView?.MutationObserver || globalThis.MutationObserver;
  if (typeof MutationObserverCtor !== 'function') return null;
  const observer = new MutationObserverCtor(() => pruneDetachedPipelineCanvasManagers(doc));
  observer.observe(doc.body, { childList: true, subtree: true });
  OBSERVERS.set(doc, observer);
  return observer;
}

export function installPipelineCanvasAuditHardening() {
  patchController();
}

installPipelineCanvasAuditHardening();
if (globalThis.document?.body) installPipelineCanvasLifecycleObserver(globalThis.document);
else globalThis.document?.addEventListener?.('DOMContentLoaded', () => installPipelineCanvasLifecycleObserver(globalThis.document), { once: true });
