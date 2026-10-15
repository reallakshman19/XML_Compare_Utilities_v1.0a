import {
  DEFAULT_PIPELINE_CAD_SNAP_SETTINGS,
  describePipelineCadSnapSettings,
  normalizePipelineCadSnapSettings,
  savePipelineCadSnapSettings,
} from './pipeline-3d-model-cad-snap.js';
import {
  ensurePipelineCadViewportShellStyle,
  pipelineCadViewportShellHtml,
  showPipelineCadPalette,
} from './pipeline-3d-model-cad-viewport-shell-view.js';
import {
  describePipelineCadViewportScale,
  loadPipelineCadViewportState,
  savePipelineCadViewportState,
} from './pipeline-3d-model-cad-viewport-state.js';

function activeGraph(state) {
  return state.graphs[state.active] || state.graphs.table2x || state.graphs.table3x;
}

function ensureCrosshair(graph) {
  const stage = graph.canvas.closest('[data-p3d-cad-stage]');
  let crosshair = stage.querySelector('[data-p3d-cad-crosshair]');
  if (!crosshair) {
    stage.insertAdjacentHTML('beforeend', '<div class="p3d-cad-crosshair" data-p3d-cad-crosshair><i class="p3d-cad-crosshair-v"></i><i class="p3d-cad-crosshair-h"></i><span class="p3d-cad-crosshair-hud"></span></div>');
    crosshair = stage.querySelector('[data-p3d-cad-crosshair]');
  }
  return crosshair;
}

function persistGraph(state, name) {
  const graph = state.graphs[name];
  if (!graph?.getPipelineCadViewportState) return;
  savePipelineCadViewportState({
    ...graph.getPipelineCadViewportState(),
    graph: name,
    previewMode: state.mode,
    linkX: state.linkX,
  }, state.storage);
}

function statusText(state, pointer = null) {
  const graph = activeGraph(state);
  const view = graph?.getPipelineCadViewportState?.();
  const snap = describePipelineCadSnapSettings(graph?.getSnapSettings?.());
  const coordinate = pointer || state.lastPointer || 'Pointer outside drawing';
  const scale = state.mode === 'overlay' ? 'Overlay review-only' : describePipelineCadViewportScale(view || {});
  return `${state.mode} · ${state.active} · ${coordinate} · ${snap} · ${scale}`;
}

function updateControls(state) {
  const graph = activeGraph(state);
  const view = graph?.getPipelineCadViewportState?.();
  const snap = normalizePipelineCadSnapSettings(graph?.getSnapSettings?.());
  state.target.value = state.active;
  state.hScale.value = view?.horizontalScale || 1000;
  state.vScale.value = view?.verticalScale || 100;
  state.ve.textContent = view ? `VE ${describePipelineCadViewportScale(view).split(' VE ')[1]}` : 'VE —';
  state.grid.setAttribute('aria-pressed', view?.displayGrid === false ? 'false' : 'true');
  state.minor.setAttribute('aria-pressed', view?.minorGrid === false ? 'false' : 'true');
  state.gridSnap.setAttribute('aria-pressed', snap.gridEnabled ? 'true' : 'false');
  state.stationSnap.setAttribute('aria-pressed', snap.stationEnabled ? 'true' : 'false');
  state.link.hidden = state.mode !== 'side-by-side';
  state.link.setAttribute('aria-pressed', state.linkX ? 'true' : 'false');
  const disabled = state.mode === 'overlay' || !graph;
  [state.fit, state.range, state.hScale, state.vScale, state.grid, state.minor,
    state.gridSnap, state.stationSnap, state.snapSettings].forEach((node) => { node.disabled = disabled; });
  state.status.textContent = statusText(state);
}

function visibleRange(graph) {
  const plot = graph.getPlotRect();
  const a = graph.screenToWorld({ x: plot.left, y: plot.bottom });
  const b = graph.screenToWorld({ x: plot.right, y: plot.top });
  return { minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minY: Math.min(a.y, b.y), maxY: Math.max(a.y, b.y) };
}

function synchronizeX(state, sourceName) {
  if (state.guard || !state.linkX || state.mode !== 'side-by-side') return;
  const source = state.graphs[sourceName];
  const targetName = sourceName === 'table2x' ? 'table3x' : 'table2x';
  const target = state.graphs[targetName];
  const range = source?.getPipelineCadHorizontalRange?.();
  if (!target?.setPipelineCadHorizontalViewport || !range) return;
  state.guard = true;
  try {
    target.setPipelineCadHorizontalViewport(range, { silent: true });
    persistGraph(state, targetName);
  } finally {
    state.guard = false;
  }
}

function bindGraph(state, name) {
  const graph = state.graphs[name];
  const host = state.hosts[name];
  const crosshair = ensureCrosshair(graph);
  const onMove = (event) => {
    if (state.mode === 'overlay') return;
    state.active = name;
    const screen = graph.eventToScreen(event);
    const plot = host.getPlotBounds();
    if (screen.x < plot.left || screen.x > plot.right || screen.y < plot.top || screen.y > plot.bottom) return;
    const world = host.screenToWorld(screen);
    crosshair.dataset.active = 'true';
    crosshair.querySelector('.p3d-cad-crosshair-v').style.left = `${screen.x}px`;
    crosshair.querySelector('.p3d-cad-crosshair-h').style.top = `${screen.y}px`;
    const hud = crosshair.querySelector('.p3d-cad-crosshair-hud');
    hud.style.left = `${Math.min(screen.x + 8, graph.width - 240)}px`;
    hud.style.top = `${Math.max(4, screen.y - 24)}px`;
    Object.values(state.graphs).forEach((candidate) => { candidate.canvas.dataset.p3dCadInspectionCumulative = world.x.toFixed(3); });
    state.lastPointer = host.formatPointer(world);
    hud.textContent = state.lastPointer;
    state.status.textContent = statusText(state, state.lastPointer);
    updateControls(state);
  };
  const onLeave = () => {
    crosshair.dataset.active = 'false';
    Object.values(state.graphs).forEach((candidate) => { delete candidate.canvas.dataset.p3dCadInspectionCumulative; });
    state.lastPointer = null;
    updateControls(state);
  };
  const unsubscribe = host.subscribe((event) => {
    if (event.type === 'viewportChanged') { persistGraph(state, name); synchronizeX(state, name); }
    updateControls(state);
  });
  graph.canvas.addEventListener('pointermove', onMove);
  graph.canvas.addEventListener('pointerleave', onLeave);
  state.cleanup.push(() => graph.canvas.removeEventListener('pointermove', onMove));
  state.cleanup.push(() => graph.canvas.removeEventListener('pointerleave', onLeave));
  state.cleanup.push(unsubscribe);
}

function openRange(state) {
  const range = visibleRange(activeGraph(state));
  for (const [key, value] of Object.entries(range)) {
    state.rangePalette.querySelector(`[data-range="${key}"]`).value = Number(value).toFixed(3);
  }
  showPipelineCadPalette(state.rangePalette, state.range, state.modal.ownerDocument);
}

function openSnap(state) {
  const settings = normalizePipelineCadSnapSettings(activeGraph(state)?.getSnapSettings?.());
  for (const [key, value] of Object.entries(settings)) {
    const input = state.snapPalette.querySelector(`[data-snap="${key}"]`);
    if (input) input.value = value;
  }
  showPipelineCadPalette(state.snapPalette, state.snapSettings, state.modal.ownerDocument);
}

function applySnap(state, defaults = false) {
  const graph = activeGraph(state);
  const values = defaults ? { ...DEFAULT_PIPELINE_CAD_SNAP_SETTINGS } : {};
  if (!defaults) state.snapPalette.querySelectorAll('[data-snap]').forEach((input) => { values[input.dataset.snap] = input.value; });
  const settings = normalizePipelineCadSnapSettings(values);
  graph?.setSnapSettings?.(settings);
  savePipelineCadSnapSettings(state.active, settings, state.storage);
  state.snapPalette.hidden = true;
}

function fit(state) {
  const graph = activeGraph(state);
  graph?.fitToBounds?.();
  if (state.mode === 'side-by-side' && state.linkX) {
    const other = state.graphs[state.active === 'table2x' ? 'table3x' : 'table2x'];
    other?.fitToBounds?.();
    synchronizeX(state, state.active);
  }
}

function onShellClick(state, event) {
  const action = event.target?.closest?.('[data-p3d-cad-view-action]')?.dataset?.p3dCadViewAction;
  const graph = activeGraph(state);
  if (action === 'fit') fit(state);
  else if (action === 'range') openRange(state);
  else if (action === 'grid') graph?.setPipelineCadGrid?.({ displayGrid: graph.getPipelineCadViewportState().displayGrid === false });
  else if (action === 'minor') graph?.setPipelineCadGrid?.({ minorGrid: graph.getPipelineCadViewportState().minorGrid === false });
  else if (action === 'grid-snap') graph?.setSnapSettings?.({ gridEnabled: !graph.getSnapSettings().gridEnabled });
  else if (action === 'station-snap') graph?.setSnapSettings?.({ stationEnabled: !graph.getSnapSettings().stationEnabled });
  else if (action === 'snap') openSnap(state);
  else if (action === 'link') state.linkX = !state.linkX;
  const rangeAction = event.target?.dataset?.rangeAction;
  if (rangeAction === 'apply') {
    const range = {};
    state.rangePalette.querySelectorAll('[data-range]').forEach((input) => { range[input.dataset.range] = input.value; });
    try { graph?.setPipelineCadCustomRange?.(range); state.rangePalette.hidden = true; }
    catch (error) { state.status.textContent = error instanceof Error ? error.message : String(error); }
  } else if (rangeAction === 'cancel') state.rangePalette.hidden = true;
  const snapAction = event.target?.dataset?.snapAction;
  if (snapAction === 'apply') applySnap(state);
  else if (snapAction === 'defaults') applySnap(state, true);
  else if (snapAction === 'cancel') state.snapPalette.hidden = true;
  Object.keys(state.graphs).forEach((name) => persistGraph(state, name));
  updateControls(state);
}

export function mountPipelineCadViewportShell(options = {}) {
  const { modal, graphs, hosts } = options;
  if (!modal || !graphs?.table2x || !graphs?.table3x) throw new TypeError('Pipeline CAD viewport shell requires modal and both graphs.');
  ensurePipelineCadViewportShellStyle(modal.ownerDocument || globalThis.document);
  const tabs = modal.querySelector('.p3d-x-tabs');
  tabs.insertAdjacentHTML('afterend', pipelineCadViewportShellHtml());
  modal.insertAdjacentHTML('beforeend', '<div class="p3d-cad-viewport-status" data-p3d-cad-viewport-status></div>');
  const shell = modal.querySelector('[data-p3d-cad-viewbar]');
  const state = {
    modal, graphs, hosts, shell, storage: options.storage ?? globalThis.localStorage,
    mode: options.mode || 'table2x', active: 'table2x', linkX: true, guard: false, lastPointer: null, cleanup: [],
    target: shell.querySelector('[data-p3d-cad-view-target]'), fit: shell.querySelector('[data-p3d-cad-view-action="fit"]'),
    range: shell.querySelector('[data-p3d-cad-view-action="range"]'), hScale: shell.querySelector('[data-p3d-cad-h-scale]'),
    vScale: shell.querySelector('[data-p3d-cad-v-scale]'), ve: shell.querySelector('[data-p3d-cad-ve]'),
    grid: shell.querySelector('[data-p3d-cad-view-action="grid"]'), minor: shell.querySelector('[data-p3d-cad-view-action="minor"]'),
    gridSnap: shell.querySelector('[data-p3d-cad-view-action="grid-snap"]'), stationSnap: shell.querySelector('[data-p3d-cad-view-action="station-snap"]'),
    snapSettings: shell.querySelector('[data-p3d-cad-view-action="snap"]'), link: shell.querySelector('[data-p3d-cad-view-action="link"]'),
    rangePalette: shell.querySelector('[data-p3d-cad-range-palette]'), snapPalette: shell.querySelector('[data-p3d-cad-snap-palette]'),
    status: modal.querySelector('[data-p3d-cad-viewport-status]'),
  };
  modal.ownerDocument.body.append(state.rangePalette, state.snapPalette);
  const onClick = (event) => onShellClick(state, event);
  const onTarget = () => { state.active = state.target.value; updateControls(state); };
  const onScale = () => { activeGraph(state)?.setPipelineCadEngineeringScale?.(state.hScale.value, state.vScale.value); };
  shell.addEventListener('click', onClick);
  state.rangePalette.addEventListener('click', onClick);
  state.snapPalette.addEventListener('click', onClick);
  state.target.addEventListener('change', onTarget);
  state.hScale.addEventListener('blur', onScale);
  state.vScale.addEventListener('blur', onScale);
  state.cleanup.push(() => shell.removeEventListener('click', onClick));
  state.cleanup.push(() => state.rangePalette.removeEventListener('click', onClick));
  state.cleanup.push(() => state.snapPalette.removeEventListener('click', onClick));
  state.cleanup.push(() => state.target.removeEventListener('change', onTarget));
  state.cleanup.push(() => state.hScale.removeEventListener('blur', onScale));
  state.cleanup.push(() => state.vScale.removeEventListener('blur', onScale));
  Object.keys(graphs).forEach((name) => {
    graphs[name].applyPipelineCadViewportState(loadPipelineCadViewportState(name, state.mode, state.storage), { render: false });
    bindGraph(state, name);
  });
  updateControls(state);
  return Object.freeze({
    element: shell,
    setMode(mode) {
      state.mode = mode;
      state.active = mode === 'table3x' ? 'table3x' : state.active;
      if (mode === 'table2x') state.active = 'table2x';
      Object.keys(graphs).forEach((name) => graphs[name].applyPipelineCadViewportState(loadPipelineCadViewportState(name, mode, state.storage)));
      updateControls(state);
    },
    destroy() {
      state.cleanup.splice(0).forEach((dispose) => dispose());
      state.rangePalette.remove();
      state.snapPalette.remove();
      shell.remove();
      state.status.remove();
      return true;
    },
  });
}
