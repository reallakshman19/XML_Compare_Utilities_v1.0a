import { acquirePipelineCadMarkupAnchor } from './pipeline-3d-model-cad-markup-anchor-acquisition.js';
import {
  PipelineCadMarkupMode,
  PipelineCadMarkupStage,
  createPipelineCadMarkupInteractionPreview,
  isPipelineCadMarkupDimensionMode,
  pipelineCadMarkupDimensionType,
} from './pipeline-3d-model-cad-markup-interaction-contracts.js';
import { createPipelineCadMarkupInteractionSession } from './pipeline-3d-model-cad-markup-interaction-session.js';
import {
  createPipelineCadMarkupDragPatch,
  createPipelineCadMarkupDraggedProjection,
  hitTestPipelineCadMarkupProjection,
  pipelineCadMarkupPreviewOffset,
} from './pipeline-3d-model-cad-markup-interaction-renderer.js';
import { mountPipelineCadMarkupInteractionView } from './pipeline-3d-model-cad-markup-interaction-view.js';
import { buildPipelineCadMarkupProjection } from './pipeline-3d-model-cad-markup-renderer.js';
export const PIPELINE_CAD_MARKUP_INTERACTION_RUNTIME_SCHEMA =
  'PipelineCadMarkupInteractionRuntime.v1';
function bind(target, type, listener, cleanup, options) {
  target?.addEventListener?.(type, listener, options);
  cleanup.push(() => target?.removeEventListener?.(type, listener, options));
}
function records(documentValue) {
  return [...(documentValue?.dimensions || []), ...(documentValue?.annotations || [])];
}
function recordId(record) {
  return record?.dimensionId || record?.annotationId || '';
}
function recordById(documentValue, id) {
  return records(documentValue).find((record) => recordId(record) === id) || null;
}
function selectedDescriptor(record) {
  if (!record) return null;
  return {
    id: recordId(record),
    kind: record.dimensionId ? 'DIMENSION' : 'ANNOTATION',
    graph: record.graph,
    status: record.status,
  };
}
export function mountPipelineCadMarkupInteractionRuntime(options = {}) {
  const { dialog, stages, graphs, markup, markupView } = options;
  if (!dialog || !markup || !graphs?.table2x || !graphs?.table3x) {
    throw new TypeError('Markup interaction runtime requires dialog, markup and both graphs.');
  }
  const session = createPipelineCadMarkupInteractionSession();
  const view = mountPipelineCadMarkupInteractionView({ dialog, stages });
  const cleanup = [];
  let projection = buildPipelineCadMarkupProjection(markup.getDocument(), graphs);
  let destroyed = false;
  let capture = null;
  function assertActive() {
    if (destroyed) throw new Error('Pipeline CAD markup interaction runtime is destroyed.');
  }
  function selectedItem(state) {
    const id = state.selected?.id;
    return projection.dimensions.find((item) => item.id === id)
      || projection.annotations.find((item) => item.id === id)
      || null;
  }
  function previewFor(state) {
    const item = selectedItem(state);
    const record = recordById(markup.getDocument(), state.selected?.id);
    const patch = state.drag?.previewPatch || null;
    return createPipelineCadMarkupInteractionPreview({
      graph: state.graph || state.selected?.graph || null,
      mode: state.mode,
      stage: state.stage,
      first: state.first,
      second: state.second,
      pointer: state.pointer,
      dimensionType: pipelineCadMarkupDimensionType(state.mode),
      offset: pipelineCadMarkupPreviewOffset(state),
      annotation: state.annotation,
      selectedItem: item,
      dragItem: createPipelineCadMarkupDraggedProjection(item, record, patch),
      feedback: state.feedback,
    });
  }
  function render() {
    const state = session.getState();
    const preview = previewFor(state);
    Object.entries(graphs).forEach(([name, graph]) => {
      graph.pipelineCadMarkupInteractionPreview = preview.graph === name ? preview : null;
      graph.render?.();
    });
    markupView?.setSelectedId?.(state.selected?.id || '');
    view.render(state, markup.getDocument(), markup.canUndo, markup.canRedo);
  }
  function syncProjection() {
    projection = buildPipelineCadMarkupProjection(markup.getDocument(), graphs);
    const ids = new Set(records(markup.getDocument()).map(recordId));
    session.reconcileSelection(ids);
    render();
  }
  function selectById(id) {
    assertActive();
    const record = recordById(markup.getDocument(), id);
    session.setSelection(selectedDescriptor(record));
    return record;
  }
  function screenWorld(graphName, event) {
    const graph = graphs[graphName];
    const screen = graph.eventToScreen(event);
    return { graph, screen, world: graph.screenToWorld(screen) };
  }
  function acquire(graphName, context) {
    return acquirePipelineCadMarkupAnchor({
      graphName,
      graph: context.graph,
      screenPoint: context.screen,
      worldPoint: context.world,
    });
  }
  function startCapture(layer, event) {
    if (event.pointerId == null) return;
    layer.setPointerCapture?.(event.pointerId);
    capture = { layer, pointerId: event.pointerId };
  }
  function releaseCapture() {
    if (!capture) return;
    if (capture.layer.hasPointerCapture?.(capture.pointerId)) {
      capture.layer.releasePointerCapture?.(capture.pointerId);
    }
    capture = null;
  }
  function beginSelectionDrag(graphName, event, context) {
    const hit = hitTestPipelineCadMarkupProjection(context.graph, projection, context.screen);
    if (!hit) {
      session.setSelection(null);
      return;
    }
    const record = selectById(hit.id);
    if (!record || record.status === 'ORPHANED') return;
    const initial = record.dimensionId
      ? { offset: record.offset }
      : { leader: record.leader };
    session.beginDrag({ id: hit.id, kind: hit.kind, graph: graphName, item: hit.item, initial, startWorld: context.world });
    startCapture(event.currentTarget, event);
  }
  function commitDimension() {
    const state = session.getState();
    if (state.stage !== PipelineCadMarkupStage.OFFSET) return false;
    markup.createDimension({
      graph: state.graph,
      dimensionType: pipelineCadMarkupDimensionType(state.mode),
      firstAnchor: state.first.anchor,
      secondAnchor: state.second.anchor,
      offset: pipelineCadMarkupPreviewOffset(state),
      labelMode: 'MEASURED',
    });
    session.cancelTransient('dimension-committed');
    return true;
  }
  function commitAnnotation() {
    const state = session.getState();
    if (state.stage !== PipelineCadMarkupStage.PALETTE) return false;
    markup.createAnnotation({
      graph: state.graph,
      anchor: state.annotation.anchor,
      ...view.annotationPayload(),
    });
    session.cancelTransient('annotation-committed');
    return true;
  }
  function onPointerDown(graphName, event) {
    const state = session.getState();
    if (state.graph !== graphName || !state.mode) return;
    const context = screenWorld(graphName, event);
    event.preventDefault();
    if (state.mode === PipelineCadMarkupMode.MARKUP_SELECT) {
      beginSelectionDrag(graphName, event, context);
      return;
    }
    if (isPipelineCadMarkupDimensionMode(state.mode) && state.stage === PipelineCadMarkupStage.OFFSET) {
      commitDimension();
      return;
    }
    session.acceptAnchor(acquire(graphName, context));
  }
  function onPointerMove(graphName, event) {
    const state = session.getState();
    if (state.graph !== graphName || !state.mode) return;
    const context = screenWorld(graphName, event);
    if (state.drag) {
      const record = recordById(markup.getDocument(), state.drag.id);
      session.updateDrag(createPipelineCadMarkupDragPatch(record, state.drag, context.world), context.world);
      return;
    }
    const acquisitionStages = [PipelineCadMarkupStage.FIRST_ANCHOR,
      PipelineCadMarkupStage.SECOND_ANCHOR, PipelineCadMarkupStage.ANCHOR];
    if (acquisitionStages.includes(state.stage)) {
      session.updatePointer(context.world, acquire(graphName, context)); return;
    }
    if (state.stage === PipelineCadMarkupStage.OFFSET) session.updatePointer(context.world, state.feedback);
  }
  function onPointerUp() {
    const drag = session.finishDrag();
    releaseCapture();
    if (!drag?.previewPatch) return;
    const record = recordById(markup.getDocument(), drag.id);
    if (record?.dimensionId) markup.updateDimension(drag.id, drag.previewPatch);
    if (record?.annotationId) markup.updateAnnotation(drag.id, drag.previewPatch);
  }
  function cancel(reason = 'cancelled') {
    assertActive();
    const cancelled = session.cancelTransient(reason);
    if (cancelled) releaseCapture();
    return cancelled;
  }
  function applySelectedPatch() {
    const state = session.getState();
    const record = recordById(markup.getDocument(), state.selected?.id);
    if (!record) return false;
    const patch = view.selectedPatch(record);
    if (record.dimensionId) markup.updateDimension(record.dimensionId, patch);
    else markup.updateAnnotation(record.annotationId, patch);
    return true;
  }
  function deleteSelected() {
    const record = recordById(markup.getDocument(), session.getState().selected?.id);
    if (!record) return false;
    if (record.dimensionId) markup.deleteDimension(record.dimensionId);
    else markup.deleteAnnotation(record.annotationId);
    session.setSelection(null);
    return true;
  }
  function actionError(callback) {
    try { callback(); view.setStatus('', 'info'); } catch (error) { view.setStatus(error.message || String(error), 'error'); }
  }
  view.modeButtons.forEach((control) => bind(control, 'click', () => actionError(() => {
    const mode = control.dataset.markupMode;
    if (mode === 'OFF') session.deactivate();
    else session.activate(mode, control.dataset.markupGraph);
  }), cleanup));
  Object.entries(view.layers).forEach(([graphName, layer]) => {
    bind(layer, 'pointerdown', (event) => actionError(() => onPointerDown(graphName, event)), cleanup);
    bind(layer, 'pointermove', (event) => actionError(() => onPointerMove(graphName, event)), cleanup);
    bind(layer, 'pointerup', () => actionError(onPointerUp), cleanup);
    bind(layer, 'pointercancel', () => actionError(() => cancel('pointer-cancelled')), cleanup);
  });
  bind(view.annotation.commit, 'click', () => actionError(commitAnnotation), cleanup);
  bind(view.annotation.cancel, 'click', () => actionError(() => cancel('annotation-cancelled')), cleanup);
  bind(view.property.apply, 'click', () => actionError(applySelectedPatch), cleanup);
  bind(view.property.remove, 'click', () => actionError(deleteSelected), cleanup);
  bind(view.property.undo, 'click', () => actionError(() => markup.undo()), cleanup);
  bind(view.property.redo, 'click', () => actionError(() => markup.redo()), cleanup);
  bind(dialog, 'keydown', (event) => {
    if (event.key === 'Escape' && cancel('escape')) { event.preventDefault(); event.stopPropagation(); return; }
    if (event.key === 'Backspace' && session.backspace()) event.preventDefault();
    if (event.key === 'Enter' && !event.target?.matches?.('input,textarea,select')) {
      if (commitDimension()) event.preventDefault();
    }
  }, cleanup);
  Object.values(graphs).forEach((graph) => bind(graph, 'reloadRequested', () => cancel('graph-reloaded'), cleanup));
  markupView?.setSelectHandler?.((id) => actionError(() => selectById(id)));
  const unsubscribeSession = session.subscribe(render);
  const unsubscribeMarkup = markup.subscribe(syncProjection);
  cleanup.push(unsubscribeSession, unsubscribeMarkup);
  render();
  return Object.freeze({
    schema: PIPELINE_CAD_MARKUP_INTERACTION_RUNTIME_SCHEMA,
    getState() { assertActive(); return session.getState(); },
    selectMarkup: selectById,
    cancelTransient: cancel,
    setWorkspaceMode(mode) {
      assertActive();
      const state = session.getState();
      if (mode === 'overlay' || (state.graph && state.graph !== mode)) session.deactivate();
      return true;
    },
    handleSourceReplacement() {
      assertActive();
      session.cancelTransient('source-replaced');
      releaseCapture();
      return true;
    },
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      releaseCapture();
      cleanup.splice(0).reverse().forEach((dispose) => dispose());
      markupView?.setSelectHandler?.(null);
      session.destroy();
      Object.values(graphs).forEach((graph) => {
        delete graph.pipelineCadMarkupInteractionPreview;
        graph.render?.();
      });
      view.destroy();
      return true;
    },
  });
}
export const _markupInteractionRuntimeTest = Object.freeze({ selectedDescriptor, recordById });
