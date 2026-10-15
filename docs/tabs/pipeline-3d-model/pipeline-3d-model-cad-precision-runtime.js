import { createPipelineCadPrecisionSessionController } from './pipeline-3d-model-cad-precision-session.js';
import { createPipelineCadPrecisionView } from './pipeline-3d-model-cad-precision-view.js';

function bind(target, type, listener, cleanup, options) {
  target?.addEventListener?.(type, listener, options);
  cleanup.push(() => target?.removeEventListener?.(type, listener, options));
}
function identityFromDetail(detail = {}) {
  const graph = detail.graph; const entityId = detail.entityId;
  const entityType = detail.entityType || (graph === 'table2x' ? 'elevation-node' : 'depth-node');
  return graph && entityId ? Object.freeze({ graph, entityId, entityType }) : null;
}
function closePrecision(state) { state.sessions.close(); state.view.close(); }
function openIdentity(state, identity, source = 'typed') {
  if (!identity || state.disabled) return null;
  try {
    const opened = state.sessions.begin(identity, source);
    state.view.close(); state.view.open(identity.graph, identity, opened.before);
    if (source === 'context') state.view.focus(identity.graph);
    return opened;
  } catch (error) {
    state.view.status(identity.graph, error.message, 'error'); return null;
  }
}
function handleSelection(state, detail = {}) {
  const count = Number.isFinite(Number(detail.count)) ? Number(detail.count) : detail.entityId ? 1 : 0;
  if (count !== 1) { closePrecision(state); return null; }
  return openIdentity(state, identityFromDetail(detail), 'typed');
}
function stageCurrent(state, name) {
  if (state.disabled || state.sessions.identity?.graph !== name) return null;
  try {
    const session = state.sessions.stage(state.view.values(name), 'typed');
    state.view.status(name, 'Preview only · Apply to commit.', ''); return session;
  } catch (error) {
    state.view.status(name, error.message, 'error'); return null;
  }
}
function applyCurrent(state, name) {
  const staged = stageCurrent(state, name); if (!staged) return false;
  try {
    const result = state.sessions.commit();
    state.view.open(name, state.sessions.identity, state.sessions.before);
    state.view.status(name, `${result.reason} committed.`, ''); return true;
  } catch (error) {
    state.view.status(name, error.message, 'error'); return false;
  }
}
function cancelCurrent(state, name, close = true) {
  if (close) closePrecision(state);
  else {
    const reset = state.sessions.reset();
    if (reset) state.view.open(name, reset.identity, reset.before);
  }
}
function bindPanel(state, name) {
  const panel = state.view.panels[name];
  const onInput = (event) => {
    const control = event.target; if (!control?.matches?.('[data-field]')) return;
    if (['coordinateMode', 'inputMode'].includes(control.dataset.field)) {
      state.view.sync(name, state.sessions.identity, state.sessions.before);
    }
    stageCurrent(state, name);
  };
  const onClick = (event) => {
    const action = event.target?.dataset?.action;
    if (action === 'apply') applyCurrent(state, name);
    if (action === 'reset') cancelCurrent(state, name, false);
    if (action === 'cancel') cancelCurrent(state, name, true);
  };
  const onKey = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); cancelCurrent(state, name, true); state.graphs[name].canvas.focus(); }
    if (event.key === 'Enter' && event.target?.matches?.('input')) { event.preventDefault(); applyCurrent(state, name); }
  };
  bind(panel, 'input', onInput, state.cleanup); bind(panel, 'change', onInput, state.cleanup);
  bind(panel, 'click', onClick, state.cleanup); bind(panel, 'keydown', onKey, state.cleanup);
}
function bindGraph(state, name) {
  const graph = state.graphs[name];
  bind(graph, 'selectionChanged', (event) => handleSelection(state, event.detail), state.cleanup);
  bind(graph.canvas, 'dblclick', (event) => {
    const hit = graph.hitTest(graph.eventToScreen(event)); if (!hit || state.disabled) return;
    event.preventDefault();
    graph.setSelection?.([{ id: hit.node.id, type: hit.type }], {
      primaryId: hit.node.id, source: 'context', mode: 'replace', emit: false,
    });
    openIdentity(state, { graph: name, entityId: hit.node.id, entityType: hit.type }, 'context');
  }, state.cleanup, true);
  bind(graph, 'nodePreviewMoved', (event) => {
    const identity = state.sessions.identity;
    if (!identity || identity.graph !== name || identity.entityId !== event.detail?.entityId) return;
    state.view.status(name, 'Grip preview · release to commit.', '');
  }, state.cleanup);
  bind(graph, 'nodeMoved', () => {
    if (state.sessions.identity?.graph !== name) return;
    const refreshed = state.sessions.refresh();
    if (refreshed) state.view.open(name, refreshed.identity, refreshed.before);
  }, state.cleanup);
}
function bindController(state) {
  for (const eventName of ['modelChanged', 'historyApplied', 'graphsReloaded']) {
    bind(state.controller, eventName, () => closePrecision(state), state.cleanup);
  }
}

export function mountPipelineCadPrecisionEditing(options = {}) {
  const { dialog, graphs, stages, controller } = options;
  if (!dialog || !controller || !graphs?.table2x || !graphs?.table3x || !stages) {
    throw new TypeError('Precision editing requires dialog, controller, stages and both graphs.');
  }
  const state = { dialog, graphs, stages, controller, cleanup: [], disabled: false, destroyed: false };
  state.view = createPipelineCadPrecisionView({ dialog, stages });
  state.sessions = createPipelineCadPrecisionSessionController({ controller, graphs });
  for (const name of ['table2x', 'table3x']) { bindPanel(state, name); bindGraph(state, name); }
  bindController(state);
  const modal = dialog.querySelector('[data-p3d-split="x-modal"]');
  const setMode = (mode) => {
    state.disabled = mode === 'overlay'; state.view.setDisabled(state.disabled);
    if (state.disabled) closePrecision(state);
  };
  bind(modal, 'pipelineCadPreviewModeChanged', (event) => setMode(event.detail?.mode), state.cleanup);
  setMode(options.mode || modal?.dataset?.p3dCadPreviewMode || 'table2x');
  dialog.dataset.p3dCadPrecisionLifecycle = '1';
  return Object.freeze({
    view: state.view, sessions: state.sessions, setMode,
    open: (identity) => openIdentity(state, identity, 'typed'),
    cancel: () => { closePrecision(state); return true; },
    destroy() {
      if (state.destroyed) return false; state.destroyed = true; closePrecision(state);
      state.cleanup.splice(0).reverse().forEach((dispose) => dispose()); state.view.destroy();
      delete dialog.dataset.p3dCadPrecisionLifecycle; return true;
    },
  });
}

export const _test = Object.freeze({ identityFromDetail, handleSelection });
