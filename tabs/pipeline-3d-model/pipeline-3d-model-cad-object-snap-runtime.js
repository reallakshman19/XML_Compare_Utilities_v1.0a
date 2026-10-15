import { buildPipelineCadSnapPrimitives } from './pipeline-3d-model-cad-object-snap-adapters.js';
import { acquirePipelineCadObjectSnap, composePipelineCadSnapPoint } from './pipeline-3d-model-cad-object-snap-engine.js';
import {
  DEFAULT_PIPELINE_CAD_SNAP_SETTINGS,
  normalizePipelineCadSnapSettings,
  pipelineCadObjectSnapModes,
  savePipelineCadSnapSettings,
  snapTable2Elevation,
  snapTable2Station,
  snapTable3CommittedDepth,
  snapTable3Cumulative,
  snapTable3Depth,
} from './pipeline-3d-model-cad-snap.js';
import { createPipelineCadObjectSnapView } from './pipeline-3d-model-cad-object-snap-view.js';

const OBJECT_KEYS = Object.freeze([
  'objectEnabled', 'objectAperture', 'endpointEnabled', 'midpointEnabled', 'stationObjectEnabled',
  'markerEnabled', 'nearestEnabled', 'projectionEnabled', 'intersectionEnabled',
]);

function bind(target, type, listener, cleanup, options) {
  target?.addEventListener?.(type, listener, options);
  cleanup.push(() => target?.removeEventListener?.(type, listener, options));
}

function activeName(state) {
  return state.shell?.element?.querySelector?.('[data-p3d-cad-view-target]')?.value || 'table2x';
}

function interactionFor(name, graph) {
  if (name === 'table2x') {
    if (graph.draggingId) return { type: 'drag-node', allowedAxes: { x: false, y: true }, excludeIds: [graph.draggingId] };
    if (graph.tool === 'add-node') return { type: 'add-node', allowedAxes: { x: true, y: true }, excludeIds: [] };
  } else {
    if (graph.dragging?.type === 'marker') return { type: 'drag-marker', allowedAxes: { x: true, y: false }, excludeIds: [graph.dragging.id] };
    if (graph.dragging?.type === 'depth-node') return { type: 'drag-depth', allowedAxes: { x: false, y: true }, excludeIds: [graph.dragging.id] };
    if (graph.tool === 'add-marker') return { type: 'add-marker', allowedAxes: { x: true, y: false }, excludeIds: [] };
    if (graph.tool === 'add-node') return { type: 'add-node', allowedAxes: { x: true, y: true }, excludeIds: [] };
  }
  return { type: 'hover', allowedAxes: { x: true, y: true }, excludeIds: [] };
}

function acquire(state, name, screen, world, interaction) {
  const graph = state.graphs[name];
  const settings = normalizePipelineCadSnapSettings(graph.getSnapSettings?.());
  const acquisition = acquirePipelineCadObjectSnap({
    graphName: name,
    graph,
    rawScreenPoint: screen,
    rawWorldPoint: world,
    primitives: buildPipelineCadSnapPrimitives(name, graph),
    settings: { ...settings, enabledModes: pipelineCadObjectSnapModes(settings) },
    allowedAxes: interaction.allowedAxes,
    excludeIds: interaction.excludeIds,
  });
  state.acquisitions[name] = acquisition;
  graph.dispatchGraphEvent?.('objectSnapAcquired', { acquisition, interaction: interaction.type });
  if (acquisition.candidate && !state.disabled) state.view.show(name, acquisition, graph);
  else state.view.hide(name);
  return acquisition;
}

function scalarRules(name, graph, settings, interaction) {
  if (name === 'table2x') return {
    x: interaction.type === 'add-node' ? (value) => snapTable2Station(value, graph.model, settings) : null,
    y: (value) => snapTable2Elevation(value, settings),
  };
  return {
    x: ['add-node', 'add-marker', 'drag-marker'].includes(interaction.type)
      ? (value) => snapTable3Cumulative(value, graph.model, settings) : null,
    y: ['add-node', 'drag-depth'].includes(interaction.type) ? (value) => snapTable3Depth(value, settings) : null,
  };
}

function composePointer(state, name, context) {
  const graph = state.graphs[name];
  const interaction = interactionFor(name, graph);
  const acquisition = acquire(state, name, context.screen, context.world, interaction);
  const settings = normalizePipelineCadSnapSettings(graph.getSnapSettings?.());
  const composed = composePipelineCadSnapPoint(context.world, acquisition, scalarRules(name, graph, settings, interaction));
  const y = name === 'table3x' && ['add-node', 'drag-depth'].includes(interaction.type)
    ? snapTable3CommittedDepth(composed.y, settings) : composed.y;
  state.composed[name] = Object.freeze({ ...composed, y, interaction: interaction.type, candidateId: acquisition.candidate?.id || null });
  return Object.freeze({ x: composed.x, y });
}

function composeTable2NodeAdded(state, detail) {
  const graph = state.graphs.table2x;
  const settings = normalizePipelineCadSnapSettings(graph.getSnapSettings?.());
  const locks = state.composed.table2x?.lockedAxes || {};
  const start = graph.renderSnapshot?.find?.((row) => row.id === detail.insertAfterId);
  const end = graph.renderSnapshot?.find?.((row) => row.id === detail.insertBeforeId);
  let stationValue = Number(detail.stationValue);
  if (!locks.x) stationValue = snapTable2Station(stationValue, graph.model, settings, {
    excludeIds: [detail.insertAfterId, detail.insertBeforeId],
    min: Math.min(start?.x ?? stationValue, end?.x ?? stationValue),
    max: Math.max(start?.x ?? stationValue, end?.x ?? stationValue),
  });
  const ratio = start && end && Math.abs(end.x - start.x) > 1e-9 ? (stationValue - start.x) / (end.x - start.x) : 0;
  let elevationValue = locks.y ? Number(detail.elevationValue)
    : start && end ? start.y + ratio * (end.y - start.y) : Number(detail.elevationValue);
  if (!locks.y) elevationValue = snapTable2Elevation(elevationValue, settings);
  return Object.freeze({
    ...detail,
    stationValue,
    elevationValue,
    snapApplied: true,
    objectSnapCandidateId: state.composed.table2x?.candidateId || null,
  });
}

function installHooks(state, name) {
  const graph = state.graphs[name];
  const previousPointer = graph.composePipelineCadPointerWorld;
  const previousAdded = graph.composePipelineCadNodeAdded;
  graph.composePipelineCadPointerWorld = (context) => composePointer(state, name, context);
  if (name === 'table2x') graph.composePipelineCadNodeAdded = (detail) => composeTable2NodeAdded(state, detail);
  state.cleanup.push(() => {
    if (previousPointer) graph.composePipelineCadPointerWorld = previousPointer;
    else delete graph.composePipelineCadPointerWorld;
    if (name === 'table2x') {
      if (previousAdded) graph.composePipelineCadNodeAdded = previousAdded;
      else delete graph.composePipelineCadNodeAdded;
    }
  });
}

function applySettings(state, name, values) {
  const graph = state.graphs[name];
  const settings = normalizePipelineCadSnapSettings({ ...graph.getSnapSettings?.(), ...values });
  graph.setSnapSettings?.(settings);
  savePipelineCadSnapSettings(name, settings, state.storage);
  state.view.update(settings, state.disabled);
  return settings;
}

function bindView(state) {
  bind(state.view.toggle, 'click', () => {
    const name = activeName(state);
    applySettings(state, name, { objectEnabled: !state.graphs[name].getSnapSettings().objectEnabled });
    state.view.hide();
  }, state.cleanup);
  bind(state.view.settingsButton, 'click', () => state.view.open(state.graphs[activeName(state)].getSnapSettings()), state.cleanup);
  bind(state.view.palette, 'click', (event) => {
    const action = event.target?.dataset?.objectSnapAction;
    if (!action) return;
    if (action === 'cancel') { state.view.palette.hidden = true; state.view.hide(); return; }
    const name = activeName(state);
    const values = action === 'defaults'
      ? Object.fromEntries(OBJECT_KEYS.map((key) => [key, DEFAULT_PIPELINE_CAD_SNAP_SETTINGS[key]]))
      : state.view.values();
    applySettings(state, name, values);
    state.view.palette.hidden = true;
  }, state.cleanup);
}

function bindHover(state, name) {
  const graph = state.graphs[name];
  const onMove = (event) => {
    if (state.disabled || graph.draggingId || graph.dragging) return;
    state.pending = { name, screen: graph.eventToScreen(event) };
    if (state.frame != null) return;
    state.frame = requestAnimationFrame(() => {
      state.frame = null;
      const pending = state.pending;
      state.pending = null;
      if (!pending || state.destroyed || state.disabled) return;
      acquire(state, pending.name, pending.screen, state.graphs[pending.name].screenToWorld(pending.screen), interactionFor(pending.name, state.graphs[pending.name]));
    });
  };
  const clear = () => { state.acquisitions[name] = null; state.view.hide(name); };
  const cancel = () => {
    clear();
    if (name === 'table2x') { graph.draggingId = null; graph.visualOverrides?.clear?.(); }
    else { graph.dragging = null; graph.depthOverrides?.clear?.(); graph.markerOverrides?.clear?.(); }
    graph.render?.();
  };
  bind(graph.canvas, 'pointermove', onMove, state.cleanup);
  bind(graph.canvas, 'pointerleave', clear, state.cleanup);
  bind(graph, 'interactionCancelled', cancel, state.cleanup);
  bind(graph, 'snapSettingsChanged', () => state.view.update(state.graphs[activeName(state)].getSnapSettings(), state.disabled), state.cleanup);
}

export function mountPipelineCadObjectSnap(options = {}) {
  const { dialog, graphs, stages, shell } = options;
  if (!dialog || !graphs?.table2x || !graphs?.table3x || !stages) throw new TypeError('Object Snap requires dialog, stages and both graphs.');
  const state = {
    dialog, graphs, stages, shell, storage: options.storage ?? globalThis.localStorage,
    acquisitions: { table2x: null, table3x: null }, composed: { table2x: null, table3x: null },
    cleanup: [], frame: null, pending: null, disabled: false, destroyed: false,
  };
  state.view = createPipelineCadObjectSnapView({ dialog, stages, shell });
  for (const name of ['table2x', 'table3x']) { installHooks(state, name); bindHover(state, name); }
  bindView(state);
  const modal = dialog.querySelector('[data-p3d-split="x-modal"]');
  const setMode = (mode) => {
    state.disabled = mode === 'overlay';
    state.view.update(graphs[activeName(state)].getSnapSettings(), state.disabled);
    if (state.disabled) state.view.hide();
  };
  bind(modal, 'pipelineCadPreviewModeChanged', (event) => setMode(event.detail?.mode), state.cleanup);
  bind(shell?.element?.querySelector?.('[data-p3d-cad-view-target]'), 'change', () => state.view.update(graphs[activeName(state)].getSnapSettings(), state.disabled), state.cleanup);
  setMode(options.mode || modal?.dataset?.p3dCadPreviewMode || 'table2x');
  dialog.dataset.p3dCadObjectSnapLifecycle = '1';
  return Object.freeze({
    view: state.view,
    getAcquisition: (name) => state.acquisitions[name] || null,
    getLastComposed: (name) => state.composed[name] || null,
    setMode,
    clear() { state.acquisitions = { table2x: null, table3x: null }; state.view.hide(); return true; },
    destroy() {
      if (state.destroyed) return false;
      state.destroyed = true;
      if (state.frame != null) cancelAnimationFrame(state.frame);
      state.cleanup.splice(0).reverse().forEach((dispose) => dispose());
      state.view.destroy();
      delete dialog.dataset.p3dCadObjectSnapLifecycle;
      return true;
    },
  });
}
