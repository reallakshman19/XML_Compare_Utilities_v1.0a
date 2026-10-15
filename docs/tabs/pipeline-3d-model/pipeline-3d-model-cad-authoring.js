import { GraphTool } from './pipeline-3d-model-interactive-graph.js';
import { Table2XCanvas } from './pipeline-3d-model-table2x-canvas.js';
import { Table3XCanvas } from './pipeline-3d-model-table3x-canvas.js';
import { deleteProfileRowCommand } from './pipeline-3d-model-cad-commands.js';
import {
  clearPipelineCadBatchOverrides,
  executePipelineCadBatchDelete,
  executePipelineCadBatchMove,
} from './pipeline-3d-model-cad-batch-controller.js';
import {
  describePipelineCadSnapSettings,
  loadPipelineCadSnapSettings,
  normalizePipelineCadSnapSettings,
  savePipelineCadSnapSettings,
  snapTable2Elevation,
  snapTable2Station,
  snapTable3Cumulative,
  snapTable3Depth,
} from './pipeline-3d-model-cad-snap.js';
import { PipelineCadShortcut, pipelineCadShortcutLabel, resolvePipelineCadShortcut } from './pipeline-3d-model-cad-shortcuts.js';

const TABLE2_PATCH = Symbol.for('pipeline3d.cad.authoring.table2.v2');
const TABLE3_PATCH = Symbol.for('pipeline3d.cad.authoring.table3.v2');
const STYLE_ID = 'pipeline-3d-cad-authoring-style';

function ensureSnapState(graph) {
  if (!graph.snapSettings) graph.snapSettings = normalizePipelineCadSnapSettings();
  return graph.snapSettings;
}
function setSnapSettings(settings) {
  this.snapSettings = normalizePipelineCadSnapSettings({ ...ensureSnapState(this), ...(settings || {}) });
  this.dispatchGraphEvent?.('snapSettingsChanged', { settings: this.snapSettings }); this.render?.(); return this.snapSettings;
}
function composedWorld(graph, context, fallback) {
  return typeof graph.composePipelineCadPointerWorld === 'function' ? graph.composePipelineCadPointerWorld(context) : fallback();
}
function table2World(graph, event, screen, world, phase) {
  return composedWorld(graph, { graphName: 'table2x', event, screen, world, phase }, () => graph.draggingId
    ? { ...world, y: snapTable2Elevation(world.y, ensureSnapState(graph)) } : world);
}
function table2Added(graph, detail) {
  if (typeof graph.composePipelineCadNodeAdded === 'function') return graph.composePipelineCadNodeAdded(detail);
  const start = graph.renderSnapshot?.find?.((row) => row.id === detail.insertAfterId);
  const end = graph.renderSnapshot?.find?.((row) => row.id === detail.insertBeforeId);
  const stationValue = snapTable2Station(detail.stationValue, graph.model, ensureSnapState(graph), {
    excludeIds: [detail.insertAfterId, detail.insertBeforeId],
    min: Math.min(start?.x ?? detail.stationValue, end?.x ?? detail.stationValue),
    max: Math.max(start?.x ?? detail.stationValue, end?.x ?? detail.stationValue),
  });
  const ratio = start && end && Math.abs(end.x - start.x) > 1e-9 ? (stationValue - start.x) / (end.x - start.x) : 0;
  const elevationValue = start && end ? start.y + ratio * (end.y - start.y) : detail.elevationValue;
  return { ...detail, stationValue, elevationValue: snapTable2Elevation(elevationValue, ensureSnapState(graph)), snapApplied: true };
}
function patchTable2() {
  const prototype = Table2XCanvas.prototype; if (prototype[TABLE2_PATCH]) return false;
  Object.defineProperty(prototype, TABLE2_PATCH, { value: true });
  prototype.setSnapSettings = setSnapSettings;
  prototype.getSnapSettings = function getSnapSettings() { return ensureSnapState(this); };
  for (const name of ['onPrimaryPointerDown', 'onPrimaryPointerMove', 'onPrimaryPointerUp']) {
    const original = prototype[name];
    prototype[name] = function snappedInteraction(event, screen, world) {
      return original.call(this, event, screen, table2World(this, event, screen, world, name));
    };
  }
  const dispatch = prototype.dispatchGraphEvent;
  prototype.dispatchGraphEvent = function snappedDispatch(type, detail = {}) {
    return dispatch.call(this, type, type === 'nodeAdded' && detail.graph === 'table2x' ? table2Added(this, detail) : detail);
  };
  return true;
}
function table3World(graph, event, screen, world, phase) {
  return composedWorld(graph, { graphName: 'table3x', event, screen, world, phase }, () => {
    const settings = ensureSnapState(graph); const next = { ...world };
    const marker = graph.dragging?.type === 'marker' || graph.tool === GraphTool.ADD_MARKER;
    const depth = graph.dragging?.type === 'depth-node' || graph.tool === GraphTool.ADD_NODE;
    if (marker || depth) next.x = snapTable3Cumulative(world.x, graph.model, settings);
    if (depth) next.y = snapTable3Depth(world.y, settings);
    return next;
  });
}
function patchTable3() {
  const prototype = Table3XCanvas.prototype; if (prototype[TABLE3_PATCH]) return false;
  Object.defineProperty(prototype, TABLE3_PATCH, { value: true });
  prototype.setSnapSettings = setSnapSettings;
  prototype.getSnapSettings = function getSnapSettings() { return ensureSnapState(this); };
  for (const name of ['onPrimaryPointerDown', 'onPrimaryPointerMove', 'onPrimaryPointerUp']) {
    const original = prototype[name];
    prototype[name] = function snappedInteraction(event, screen, world) {
      return original.call(this, event, screen, table3World(this, event, screen, world, name));
    };
  }
  return true;
}
export function installPipelineCadAuthoringPatches() {
  return Object.freeze({ table2x: patchTable2(), table3x: patchTable3() });
}

function ensureStyle(doc) {
  if (!doc?.head || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style'); style.id = STYLE_ID;
  style.textContent = `.p3d-cad-toolbar button[data-p3d-cad-snap][aria-pressed="true"]{background:#a78bfa;color:#2e1065;border-color:#c4b5fd;font-weight:700}.p3d-cad-context-menu{position:absolute;z-index:20;display:flex;min-width:120px;flex-direction:column;gap:3px;padding:5px;border:1px solid #475569;border-radius:7px;background:#0f172a;box-shadow:0 10px 28px #0008}.p3d-cad-context-menu[hidden]{display:none}.p3d-cad-context-menu button{background:#1e293b;color:#e2e8f0;border:1px solid #475569;padding:6px 9px;text-align:left}`;
  doc.head.appendChild(style);
}
function updateSnapControls(stage, graph, storage) {
  const settings = ensureSnapState(graph);
  stage.querySelectorAll('[data-p3d-cad-snap]').forEach((button) => {
    const enabled = button.dataset.p3dCadSnap === 'grid' ? settings.gridEnabled : settings.stationEnabled;
    button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  });
  const hint = stage.querySelector('[data-p3d-cad-snap-hint]');
  if (hint) hint.textContent = describePipelineCadSnapSettings(settings);
  savePipelineCadSnapSettings(stage.dataset.p3dCadStage, settings, storage);
}
function setTool(stage, graph, tool) {
  graph.setTool(tool);
  stage.querySelectorAll('[data-p3d-cad-tool]').forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.p3dCadTool === tool ? 'true' : 'false');
  });
}
function executeShortcut(action, state) {
  const { stage, graph, controller, storage, deleteSelection } = state;
  if (action === PipelineCadShortcut.SELECT) setTool(stage, graph, GraphTool.SELECT);
  else if (action === PipelineCadShortcut.ADD_NODE) setTool(stage, graph, GraphTool.ADD_NODE);
  else if (action === PipelineCadShortcut.ADD_MARKER && state.name === 'table3x') setTool(stage, graph, GraphTool.ADD_MARKER);
  else if (action === PipelineCadShortcut.PAN) setTool(stage, graph, GraphTool.PAN);
  else if (action === PipelineCadShortcut.FIT) graph.fitToBounds();
  else if (action === PipelineCadShortcut.RELOAD) controller.reloadGraphs();
  else if (action === PipelineCadShortcut.UNDO) controller.undo();
  else if (action === PipelineCadShortcut.REDO) controller.redo();
  else if (action === PipelineCadShortcut.DELETE_SELECTION) deleteSelection(state.name);
  else if (action === PipelineCadShortcut.TOGGLE_GRID_SNAP) graph.setSnapSettings({ gridEnabled: !ensureSnapState(graph).gridEnabled });
  else if (action === PipelineCadShortcut.TOGGLE_STATION_SNAP) graph.setSnapSettings({ stationEnabled: !ensureSnapState(graph).stationEnabled });
  else if (action === PipelineCadShortcut.TOGGLE_OBJECT_SNAP) graph.setSnapSettings({ objectEnabled: !ensureSnapState(graph).objectEnabled });
  else return false;
  updateSnapControls(stage, graph, storage);
  const status = stage.querySelector('[data-p3d-cad-status]'); if (status) status.textContent = pipelineCadShortcutLabel(action);
  return true;
}
function createContextMenu(stage) {
  const menu = stage.ownerDocument.createElement('div');
  menu.className = 'p3d-cad-context-menu'; menu.hidden = true;
  menu.innerHTML = '<button type="button" data-p3d-cad-context-action="edit">Edit value / label</button><button type="button" data-p3d-cad-context-action="delete">Delete selection</button>';
  stage.appendChild(menu); return menu;
}
function createStageHandlers(state, menu) {
  const { stage, graph, storage } = state; const canvas = graph.canvas;
  let hit = null; let contextClient = null;
  const onToolbar = (event) => {
    const button = event.target?.closest?.('[data-p3d-cad-snap]'); if (!button) return;
    const key = button.dataset.p3dCadSnap === 'grid' ? 'gridEnabled' : 'stationEnabled';
    graph.setSnapSettings({ [key]: !ensureSnapState(graph)[key] }); updateSnapControls(stage, graph, storage);
  };
  const onKey = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a' && graph.tool === GraphTool.SELECT) {
      event.preventDefault(); state.selectAll(state.name); return;
    }
    const action = resolvePipelineCadShortcut(event, state.name);
    if (action && executeShortcut(action, state)) event.preventDefault();
  };
  const onContext = (event) => {
    const screen = graph.eventToScreen(event); hit = graph.hitTest(screen); if (!hit) return;
    event.preventDefault(); contextClient = { x: event.clientX, y: event.clientY }; graph.selectHit?.(hit, event);
    const edit = menu.querySelector('[data-p3d-cad-context-action="edit"]');
    if (edit) edit.disabled = graph.getSelectionDetail?.().count !== 1;
    menu.style.left = `${screen.x}px`; menu.style.top = `${screen.y}px`; menu.hidden = false;
  };
  const onMenu = (event) => {
    const action = event.target?.dataset?.p3dCadContextAction;
    if (action === 'delete') state.deleteSelection(state.name);
    if (action === 'edit' && hit && contextClient && graph.getSelectionDetail?.().count === 1) {
      canvas.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: contextClient.x, clientY: contextClient.y }));
    }
    hit = null; contextClient = null; menu.hidden = true;
  };
  return { onToolbar, onKey, onContext, onMenu };
}
function mountStage(state) {
  const { stage, graph, storage } = state; const canvas = graph.canvas;
  graph.setSnapSettings(loadPipelineCadSnapSettings(state.name, storage));
  const toolbar = stage.querySelector('.p3d-cad-toolbar'); const separator = toolbar?.querySelector('.p3d-cad-toolbar-separator');
  if (separator && !toolbar.querySelector('[data-p3d-cad-snap]')) {
    separator.insertAdjacentHTML('beforebegin', '<button type="button" data-p3d-cad-snap="grid" aria-pressed="false">Grid Snap</button><button type="button" data-p3d-cad-snap="station" aria-pressed="false">Station Snap</button><span data-p3d-cad-snap-hint></span>');
  }
  const menu = createContextMenu(stage); const handlers = createStageHandlers(state, menu);
  toolbar?.addEventListener('click', handlers.onToolbar); canvas.addEventListener('keydown', handlers.onKey);
  canvas.addEventListener('contextmenu', handlers.onContext); menu.addEventListener('click', handlers.onMenu);
  updateSnapControls(stage, graph, storage);
  return () => {
    toolbar?.removeEventListener('click', handlers.onToolbar); canvas.removeEventListener('keydown', handlers.onKey);
    canvas.removeEventListener('contextmenu', handlers.onContext); menu.removeEventListener('click', handlers.onMenu); menu.remove();
  };
}
function selectionIds(graph) { return graph?.getSelectionDetail?.().entityIds || []; }
function createSelectionActions(graphs, controller) {
  let selection = null;
  const select = (detail) => {
    if (!detail?.graph) return;
    if (selection?.graph && selection.graph !== detail.graph) {
      graphs[selection.graph]?.clearSelection?.({ emit: false, source: 'graph-switch' });
    }
    selection = detail.count ? detail : null;
  };
  const deleteSelection = (name = selection?.graph) => {
    const graph = graphs[name]; const ids = selectionIds(graph).filter((id) => controller.model?.findRow?.(id));
    if (!ids.length) return false;
    const changed = ids.length === 1
      ? controller.execute(deleteProfileRowCommand(controller.model, ids[0]), 'delete-selected-profile-row')
      : executePipelineCadBatchDelete(controller, { graph: name, entityIds: ids });
    graph.clearSelection?.({ emit: false, source: 'delete' }); selection = null; return changed;
  };
  const selectAll = (name) => {
    if (selection?.graph && selection.graph !== name) {
      graphs[selection.graph]?.clearSelection?.({ emit: false, source: 'graph-switch' });
    }
    return graphs[name]?.selectAll?.({ source: 'select-all' });
  };
  return { select, deleteSelection, selectAll, getSelection: () => selection };
}
function bindAuthoringGraphs(graphs, controller, actions) {
  const onSelection = (event) => actions.select(event.detail);
  const onBatchMoved = (event) => {
    executePipelineCadBatchMove(controller, event.detail); clearPipelineCadBatchOverrides(graphs[event.detail.graph]);
  };
  Object.values(graphs).forEach((graph) => {
    graph.addEventListener('selectionChanged', onSelection); graph.addEventListener('batchMoved', onBatchMoved);
  });
  return () => Object.values(graphs).forEach((graph) => {
    graph.removeEventListener('selectionChanged', onSelection); graph.removeEventListener('batchMoved', onBatchMoved);
  });
}

export function mountPipelineCadAuthoring(options = {}) {
  installPipelineCadAuthoringPatches();
  const { stages, graphs, controller } = options; const storage = options.storage ?? globalThis.localStorage;
  ensureStyle(stages.table2x.ownerDocument || globalThis.document);
  const actions = createSelectionActions(graphs, controller);
  const cleanups = Object.keys(graphs).map((name) => mountStage({
    name, stage: stages[name], graph: graphs[name], controller, storage,
    deleteSelection: actions.deleteSelection, selectAll: actions.selectAll,
  }));
  const unbind = bindAuthoringGraphs(graphs, controller, actions);
  return Object.freeze({
    getSelection: actions.getSelection, deleteSelection: actions.deleteSelection, selectAll: actions.selectAll,
    destroy() { unbind(); cleanups.splice(0).forEach((dispose) => dispose()); return true; },
  });
}

installPipelineCadAuthoringPatches();
