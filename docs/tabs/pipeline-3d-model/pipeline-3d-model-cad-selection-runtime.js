import {
  createPipelineCadSelectionDetail,
  normalizePipelineCadSelectionBox,
  normalizePipelineCadSelectionItems,
  pipelineCadSelectionMode,
  selectPipelineCadItemsInBox,
  updatePipelineCadSelection,
} from './pipeline-3d-model-cad-selection-contracts.js';

function modifierActive(event = {}) { return event.shiftKey || event.ctrlKey || event.metaKey; }
function itemForHit(hit) {
  return hit?.node?.id && hit?.type ? Object.freeze({ id: hit.node.id, type: hit.type }) : null;
}
function detailFor(state, source = 'read', mode = 'replace') {
  return createPipelineCadSelectionDetail({
    graph: state.graphName, items: state.items, primaryId: state.primaryId, source, mode,
  });
}
function emitSelection(graph, state, source, mode) {
  const detail = detailFor(state, source, mode);
  state.items = detail.items; state.primaryId = detail.primaryId;
  state.syncLegacy?.(detail); graph.dispatchGraphEvent?.('selectionChanged', detail); graph.render?.();
  return detail;
}
function installReadMethods(graph, state) {
  graph.getSelectionDetail = () => detailFor(state);
  graph.isSelected = (id) => state.items.some((item) => item.id === id);
}
function installSetMethods(graph, state) {
  graph.setSelection = (items, next = {}) => {
    if (!state.enabled && next.force !== true) return graph.getSelectionDetail();
    state.items = normalizePipelineCadSelectionItems(items);
    state.primaryId = next.primaryId || state.items.at(-1)?.id || null;
    if (next.emit === false) {
      const detail = graph.getSelectionDetail(); state.syncLegacy?.(detail); graph.render?.(); return detail;
    }
    return emitSelection(graph, state, next.source || 'programmatic', next.mode || 'replace');
  };
  graph.clearSelection = (next = {}) => graph.setSelection([], {
    ...next, force: true, primaryId: null, source: next.source || 'clear',
  });
  graph.selectAll = (next = {}) => state.enabled
    ? graph.setSelection(state.candidates(), { ...next, source: next.source || 'select-all' })
    : graph.getSelectionDetail();
}
function installHitMethod(graph, state) {
  graph.selectHit = (hit, event = {}) => {
    if (!state.enabled) return graph.getSelectionDetail();
    const item = itemForHit(hit); if (!item) return graph.getSelectionDetail();
    const mode = pipelineCadSelectionMode(event);
    if (!modifierActive(event) && graph.isSelected(item.id) && state.items.length > 1) {
      state.primaryId = item.id; return emitSelection(graph, state, 'pointer', 'preserve');
    }
    state.items = updatePipelineCadSelection(state.items, [item], mode);
    state.primaryId = state.items.some((entry) => entry.id === item.id)
      ? item.id : state.items.at(-1)?.id || null;
    return emitSelection(graph, state, 'pointer', mode);
  };
}
function installBoxMethods(graph, state, options) {
  graph.beginSelectionBox = (screen, event = {}) => {
    if (!state.enabled) return null;
    state.boxMode = pipelineCadSelectionMode(event);
    state.box = normalizePipelineCadSelectionBox(screen, screen); graph.render?.(); return state.box;
  };
  graph.updateSelectionBox = (screen) => {
    if (!state.enabled || !state.box) return null;
    state.box = normalizePipelineCadSelectionBox(state.box.start, screen); graph.render?.(); return state.box;
  };
  graph.finishSelectionBox = () => finishSelectionBox(graph, state, options);
  graph.cancelSelectionBox = () => { state.box = null; graph.render?.(); return true; };
}
function finishSelectionBox(graph, state, options) {
  if (!state.enabled || !state.box) return graph.getSelectionDetail();
  const matches = selectPipelineCadItemsInBox(state.candidates(), state.box, {
    radius: Number(options.selectionRadius) || 7,
    toScreen: (candidate) => graph.worldToScreen(candidate),
  });
  state.items = updatePipelineCadSelection(state.items, matches, state.boxMode);
  state.primaryId = state.items.at(-1)?.id || null;
  const mode = state.boxMode; state.box = null;
  return emitSelection(graph, state, 'selection-box', mode);
}
function installEnableMethod(graph, state) {
  graph.setSelectionEnabled = (enabled) => {
    state.enabled = Boolean(enabled);
    if (!state.enabled) {
      state.box = null; state.items = Object.freeze([]); state.primaryId = null;
      return emitSelection(graph, state, 'review-only', 'clear');
    }
    graph.render?.(); return graph.getSelectionDetail();
  };
}

export function installPipelineCadSelectionRuntime(graph, options = {}) {
  if (!graph) throw new TypeError('Selection runtime requires a graph.');
  if (graph.pipelineCadSelectionState) return graph.pipelineCadSelectionState;
  const state = {
    graphName: options.graphName || null, items: Object.freeze([]), primaryId: null,
    box: null, boxMode: 'replace', enabled: true,
    candidates: options.candidates || (() => []), syncLegacy: options.syncLegacy || null,
  };
  graph.pipelineCadSelectionState = state;
  installReadMethods(graph, state); installSetMethods(graph, state); installHitMethod(graph, state);
  installBoxMethods(graph, state, options); installEnableMethod(graph, state);
  return state;
}

export function drawPipelineCadSelectionBox(graph, context) {
  const box = graph?.pipelineCadSelectionState?.box;
  if (!box || !context) return;
  context.save();
  context.fillStyle = box.direction === 'window' ? 'rgba(14,165,233,.12)' : 'rgba(34,197,94,.12)';
  context.strokeStyle = box.direction === 'window' ? '#38bdf8' : '#4ade80';
  context.setLineDash(box.direction === 'window' ? [] : [5, 4]); context.lineWidth = 1.5;
  context.fillRect(box.left, box.top, box.right - box.left, box.bottom - box.top);
  context.strokeRect(box.left, box.top, box.right - box.left, box.bottom - box.top); context.restore();
}

export function selectedPipelineCadItems(graph, type = null) {
  const items = graph?.getSelectionDetail?.().items || [];
  return type ? items.filter((item) => item.type === type) : [...items];
}
