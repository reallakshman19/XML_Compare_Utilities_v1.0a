import { InteractiveGraph } from './pipeline-3d-model-interactive-graph.js';
import { Table2XCanvas } from './pipeline-3d-model-table2x-canvas.js';
import { Table3XCanvas } from './pipeline-3d-model-table3x-canvas.js';

const LIFECYCLE_PATCH = Symbol.for('pipeline3d.cad.lifecycle-performance.patch.v1');
const GRAPH_BOUND = Symbol.for('pipeline3d.cad.lifecycle-performance.graph-bound.v1');
const GRAPH_DESTROYED = Symbol.for('pipeline3d.cad.lifecycle-performance.destroyed.v1');
const GLOBAL_STATE = Symbol.for('pipeline3d.cad.lifecycle-performance.state.v1');
const PREVIEW_SELECTOR = '[data-p3d-split="table2x-preview"], [data-p3d-split="table3x-preview"]';

function createSharedState() {
  return Object.freeze({
    surfaces: new WeakMap(),
    stats: new WeakMap(),
    previewSnapshots: new WeakMap(),
    snapshotObservers: new WeakMap(),
  });
}

const sharedState = globalThis[GLOBAL_STATE] || createSharedState();
if (!globalThis[GLOBAL_STATE]) {
  Object.defineProperty(globalThis, GLOBAL_STATE, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: sharedState,
  });
}
const SURFACES = sharedState.surfaces;
const STATS = sharedState.stats;
const PREVIEW_SNAPSHOTS = sharedState.previewSnapshots;
const SNAPSHOT_OBSERVERS = sharedState.snapshotObservers;

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function statsFor(graph) {
  let stats = STATS.get(graph);
  if (!stats) {
    stats = {
      appliedResizes: 0,
      skippedResizes: 0,
      cancelledInteractions: 0,
      destroyCalls: 0,
      previewRestores: 0,
    };
    STATS.set(graph, stats);
  }
  return stats;
}

export function getPipelineCadLifecycleStats(graph) {
  const stats = statsFor(graph);
  return Object.freeze({
    ...stats,
    destroyed: Boolean(graph?.[GRAPH_DESTROYED]),
    surface: SURFACES.get(graph) ? Object.freeze({ ...SURFACES.get(graph) }) : null,
  });
}

function graphName(graph) {
  return graph instanceof Table3XCanvas ? 'table3x' : 'table2x';
}

function hasActiveInteraction(graph) {
  if (graph?.pointerState) return true;
  if (graph instanceof Table2XCanvas) return Boolean(graph.draggingId);
  if (graph instanceof Table3XCanvas) return Boolean(graph.dragging);
  return false;
}

export function cancelPipelineCadInteraction(graph, reason = 'cancelled') {
  if (!graph) return false;
  const active = hasActiveInteraction(graph);
  graph.spacePressed = false;
  graph.pointerState = null;

  if (graph instanceof Table2XCanvas) {
    if (graph.draggingId) graph.visualOverrides?.delete?.(graph.draggingId);
    graph.draggingId = null;
  } else if (graph instanceof Table3XCanvas) {
    if (graph.dragging?.type === 'marker') graph.markerOverrides?.delete?.(graph.dragging.id);
    if (graph.dragging?.type === 'depth-node') graph.depthOverrides?.delete?.(graph.dragging.id);
    graph.dragging = null;
  }

  if (!active) return false;
  statsFor(graph).cancelledInteractions += 1;
  graph.dispatchGraphEvent?.('interactionCancelled', {
    graph: graphName(graph),
    reason,
    commit: false,
  });
  graph.render?.();
  return true;
}

function visibleSurface(graph, requestedWidth, requestedHeight) {
  const holder = graph?.canvas?.closest?.(PREVIEW_SELECTOR);
  const rect = holder?.getBoundingClientRect?.() || {};
  const visibleWidth = Math.round(finite(holder?.clientWidth || rect.width, 0));
  const visibleHeight = Math.round(finite(holder?.clientHeight || rect.height, 0));
  return {
    width: Math.max(1, visibleWidth > 0 ? visibleWidth : finite(requestedWidth, graph?.width || 1)),
    height: Math.max(1, visibleHeight > 0 ? visibleHeight : finite(requestedHeight, graph?.height || 1)),
    dpr: Math.max(1, finite(globalThis.devicePixelRatio, 1)),
  };
}

function surfaceMatches(graph, surface) {
  const previous = SURFACES.get(graph);
  if (!previous) return false;
  if (previous.width !== surface.width || previous.height !== surface.height || previous.dpr !== surface.dpr) return false;
  const canvas = graph?.canvas;
  if (!canvas) return true;
  return canvas.width === Math.round(surface.width * surface.dpr)
    && canvas.height === Math.round(surface.height * surface.dpr)
    && canvas.style?.width === `${surface.width}px`
    && canvas.style?.height === `${surface.height}px`;
}

function capturePreviewHolder(holder) {
  if (!holder || holder.querySelector?.(':scope > [data-p3d-cad-stage]')) return false;
  PREVIEW_SNAPSHOTS.set(holder, holder.innerHTML);
  holder.dataset.p3dCadPreviewSnapshot = 'legacy';
  return true;
}

export function capturePipelineCadPreviewSnapshots(doc = globalThis.document) {
  if (!doc?.querySelectorAll) return 0;
  let captured = 0;
  doc.querySelectorAll(PREVIEW_SELECTOR).forEach((holder) => {
    if (capturePreviewHolder(holder)) captured += 1;
  });
  return captured;
}

export function installPipelineCadPreviewSnapshotObserver(doc = globalThis.document) {
  if (!doc?.body) return null;
  const existing = SNAPSHOT_OBSERVERS.get(doc);
  if (existing) return existing;
  capturePipelineCadPreviewSnapshots(doc);
  const MutationObserverCtor = globalThis.MutationObserver;
  if (typeof MutationObserverCtor !== 'function') return null;
  const observer = new MutationObserverCtor(() => capturePipelineCadPreviewSnapshots(doc));
  observer.observe(doc.body, { childList: true, subtree: true });
  SNAPSHOT_OBSERVERS.set(doc, observer);
  return observer;
}

export function uninstallPipelineCadPreviewSnapshotObserver(doc = globalThis.document) {
  const observer = SNAPSHOT_OBSERVERS.get(doc);
  observer?.disconnect?.();
  SNAPSHOT_OBSERVERS.delete(doc);
  return Boolean(observer);
}

function restorePreview(graph, canvas) {
  const holder = canvas?.closest?.(PREVIEW_SELECTOR);
  if (!holder) return false;
  const stage = canvas.closest?.('[data-p3d-cad-stage]');
  if (!stage || !holder.contains(stage)) return false;
  const snapshot = PREVIEW_SNAPSHOTS.get(holder);
  if (typeof snapshot === 'string') holder.innerHTML = snapshot;
  else stage.remove?.();
  holder.classList?.remove?.('p3d-cad-host');
  statsFor(graph).previewRestores += 1;
  return true;
}

function bindGraphLifecycle(graph) {
  if (!graph || graph[GRAPH_BOUND] || !graph.canvas) return false;
  Object.defineProperty(graph, GRAPH_BOUND, { value: true });
  const canvas = graph.canvas;
  const doc = canvas.ownerDocument || globalThis.document;

  const cancelLostCapture = () => {
    queueMicrotask(() => {
      if (hasActiveInteraction(graph)) cancelPipelineCadInteraction(graph, 'lost-pointer-capture');
    });
  };
  const cancelWindowBlur = () => {
    if (hasActiveInteraction(graph) || graph.spacePressed) cancelPipelineCadInteraction(graph, 'window-blur');
    else graph.spacePressed = false;
  };
  const cancelHiddenDocument = () => {
    if (doc?.visibilityState === 'hidden') cancelPipelineCadInteraction(graph, 'document-hidden');
  };

  canvas.addEventListener('lostpointercapture', cancelLostCapture);
  globalThis.addEventListener?.('blur', cancelWindowBlur);
  doc?.addEventListener?.('visibilitychange', cancelHiddenDocument);
  graph.destroyCallbacks?.push?.(() => {
    canvas.removeEventListener('lostpointercapture', cancelLostCapture);
    globalThis.removeEventListener?.('blur', cancelWindowBlur);
    doc?.removeEventListener?.('visibilitychange', cancelHiddenDocument);
  });
  return true;
}

function patchGraphSetModel(GraphClass) {
  const prototype = GraphClass.prototype;
  const key = Symbol.for(`pipeline3d.cad.lifecycle-performance.set-model.${GraphClass.name}.v1`);
  if (prototype[key]) return;
  Object.defineProperty(prototype, key, { value: true });
  const originalSetModel = prototype.setModel;
  prototype.setModel = function lifecycleBoundSetModel(...args) {
    bindGraphLifecycle(this);
    return originalSetModel.apply(this, args);
  };
}

function patchCancelledPointerUp(GraphClass) {
  const prototype = GraphClass.prototype;
  const key = Symbol.for(`pipeline3d.cad.lifecycle-performance.pointer-up.${GraphClass.name}.v1`);
  if (prototype[key]) return;
  Object.defineProperty(prototype, key, { value: true });
  const originalPointerUp = prototype.onPrimaryPointerUp;
  prototype.onPrimaryPointerUp = function rollbackCancelledPointer(event, ...args) {
    if (event?.type === 'pointercancel') {
      cancelPipelineCadInteraction(this, 'pointer-cancel');
      return false;
    }
    return originalPointerUp.call(this, event, ...args);
  };
}

export function installPipelineCadLifecyclePerformance() {
  const prototype = InteractiveGraph.prototype;
  if (prototype[LIFECYCLE_PATCH]) return false;
  Object.defineProperty(prototype, LIFECYCLE_PATCH, { value: true });

  const originalSetSize = prototype.setSize;
  prototype.setSize = function idempotentPipelineCadSize(width, height) {
    const surface = visibleSurface(this, width, height);
    if (surfaceMatches(this, surface)) {
      statsFor(this).skippedResizes += 1;
      return false;
    }
    const result = originalSetSize.call(this, surface.width, surface.height);
    SURFACES.set(this, {
      width: this.width,
      height: this.height,
      dpr: surface.dpr,
    });
    statsFor(this).appliedResizes += 1;
    return result;
  };

  const originalDestroy = prototype.destroy;
  prototype.destroy = function destroyPipelineCadGraphOnce() {
    const stats = statsFor(this);
    stats.destroyCalls += 1;
    if (this[GRAPH_DESTROYED]) return false;
    Object.defineProperty(this, GRAPH_DESTROYED, { value: true });
    const canvas = this.canvas;
    cancelPipelineCadInteraction(this, 'destroy');
    const result = originalDestroy.call(this);
    restorePreview(this, canvas);
    this.pointerState = null;
    this.spacePressed = false;
    return result;
  };

  patchGraphSetModel(Table2XCanvas);
  patchGraphSetModel(Table3XCanvas);
  patchCancelledPointerUp(Table2XCanvas);
  patchCancelledPointerUp(Table3XCanvas);
  return true;
}

installPipelineCadLifecyclePerformance();
if (globalThis.document?.body) installPipelineCadPreviewSnapshotObserver(globalThis.document);
else globalThis.document?.addEventListener?.('DOMContentLoaded', () => installPipelineCadPreviewSnapshotObserver(globalThis.document), { once: true });
