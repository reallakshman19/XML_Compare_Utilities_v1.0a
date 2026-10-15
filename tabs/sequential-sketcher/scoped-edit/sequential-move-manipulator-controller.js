/** Lifecycle controller connecting translation handles to the existing move drag session. */
import {
  createSequentialMoveManipulator,
  createSequentialMoveManipulatorHandleStart,
  SEQUENTIAL_MOVE_MANIPULATOR_HANDLES,
} from './sequential-move-manipulator-contract.js';
import { createSequentialMoveManipulatorOverlay } from './sequential-move-manipulator-overlay.js';

export const SEQUENTIAL_MOVE_MANIPULATOR_CONTROLLER_SCHEMA =
  'SequentialMoveManipulatorController.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function requiredConstraintApi(value) {
  return Object.freeze({
    get: requiredFunction(value?.get, 'constraintApi.get'),
    set: requiredFunction(value?.set, 'constraintApi.set'),
    subscribe: requiredFunction(value?.subscribe, 'constraintApi.subscribe'),
  });
}
function handleValue(value) {
  const handle = String(value || '').trim().toUpperCase();
  if (!SEQUENTIAL_MOVE_MANIPULATOR_HANDLES.includes(handle)) {
    throw new TypeError(`Unsupported manipulator constraint: ${value}`);
  }
  return handle;
}
function pointer(event) {
  return { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY };
}
function stop(event) { event.preventDefault?.(); event.stopImmediatePropagation?.(); }
function report(state, error, phase) {
  state.lastError = error instanceof Error ? error : new Error(String(error));
  try { state.onError(state.lastError, phase); } catch {}
}
function currentSnapshot(state) {
  const target = state.readTarget();
  const viewer = state.readViewer();
  if (!target || !viewer) return null;
  return { target, viewer, model: createSequentialMoveManipulator(target) };
}
function sameInteraction(state, snapshot) {
  return Boolean(snapshot && state.dragging
    && snapshot.model.manipulatorId === state.dragging.manipulatorId
    && snapshot.target.moveTargetId === state.dragging.moveTargetId
    && snapshot.target.authorityId === state.dragging.authorityId
    && snapshot.target.sceneRevision === state.dragging.sceneRevision);
}
function cancelInteraction(state, reason = 'manipulator-cancelled') {
  if (!state.dragging || state.cancelling) {
    state.overlay.cancelPointerInteraction(reason); return null;
  }
  const active = state.dragging;
  state.dragging = null; state.cancelling = true; state.overlay.cancelPointerInteraction(reason);
  try { return state.cancelDrag(reason, active); }
  catch (error) { report(state, error, 'cancel'); return null; }
  finally { state.cancelling = false; }
}
function render(state) {
  if (state.destroyed || !state.active) {
    state.model = null; state.overlay.hide('Translation manipulator inactive.'); return false;
  }
  let snapshot;
  try { snapshot = currentSnapshot(state); }
  catch (error) {
    cancelInteraction(state, 'manipulator-authority-invalidated');
    report(state, error, 'render'); state.model = null;
    state.overlay.hide('Translation manipulator authority invalidated.'); return false;
  }
  if (!snapshot) {
    cancelInteraction(state, 'manipulator-target-unavailable'); state.model = null;
    state.overlay.hide('Translation manipulator target unavailable.'); return false;
  }
  if (state.dragging && !sameInteraction(state, snapshot)) {
    cancelInteraction(state, 'manipulator-identity-changed');
  }
  try {
    state.model = snapshot.model; state.overlay.setModel(snapshot.model, snapshot.viewer);
    state.overlay.setActiveHandle(state.constraintApi.get()); state.lastError = null; return true;
  } catch (error) {
    cancelInteraction(state, 'manipulator-projection-failed');
    report(state, error, 'projection'); state.model = null;
    state.overlay.hide('Translation manipulator projection failed.'); return false;
  }
}
function queueRefresh(state) {
  if (state.destroyed || !state.active || state.frame != null) return;
  const request = state.window?.requestAnimationFrame?.bind(state.window);
  if (!request) { render(state); return; }
  state.frame = request(() => { state.frame = null; render(state); });
}
function cancelFrame(state) {
  if (state.frame == null) return;
  state.window?.cancelAnimationFrame?.(state.frame); state.frame = null;
}
function setConstraint(state, value, source = 'manipulator') {
  const handle = handleValue(value);
  state.constraintApi.set(handle, source); state.overlay.setActiveHandle(handle); return handle;
}
function begin(state, handleId, event) {
  if (!state.active || state.dragging || !render(state)) return null;
  const snapshot = currentSnapshot(state);
  if (!snapshot || snapshot.model.manipulatorId !== state.model?.manipulatorId) return null;
  const selected = setConstraint(state, handleId);
  const handleStart = createSequentialMoveManipulatorHandleStart({
    target: snapshot.target, handleId: selected, pointer: pointer(event),
  });
  try {
    const result = state.beginDrag({
      target: snapshot.target, handleStart, pointerId: event.pointerId,
      clientX: event.clientX, clientY: event.clientY,
    });
    if (result == null || result === false) return null;
    state.dragging = {
      handleId: selected, pointerId: event.pointerId,
      manipulatorId: snapshot.model.manipulatorId,
      moveTargetId: snapshot.target.moveTargetId,
      authorityId: snapshot.target.authorityId,
      sceneRevision: snapshot.target.sceneRevision,
    };
    stop(event); return result;
  } catch (error) {
    report(state, error, 'begin'); state.dragging = null; return null;
  }
}
function update(state, event) {
  if (!state.dragging || event.pointerId !== state.dragging.pointerId) return null;
  let snapshot;
  try { snapshot = currentSnapshot(state); }
  catch (error) { report(state, error, 'update-authority'); cancelInteraction(state,
    'manipulator-authority-invalidated'); return null; }
  if (!sameInteraction(state, snapshot)) {
    cancelInteraction(state, 'manipulator-identity-changed'); return null;
  }
  try { const result = state.updateDrag(pointer(event)); stop(event); return result; }
  catch (error) { report(state, error, 'update'); cancelInteraction(state,
    'manipulator-update-failed'); return null; }
}
function end(state, event) {
  if (!state.dragging || event.pointerId !== state.dragging.pointerId) return null;
  const active = state.dragging;
  try {
    const result = state.endDrag(event.pointerId, active); state.dragging = null;
    stop(event); queueRefresh(state); return result;
  } catch (error) {
    report(state, error, 'end'); return cancelInteraction(state, 'manipulator-end-failed');
  }
}
function cancel(state, eventOrReason = 'manipulator-cancel') {
  const reason = typeof eventOrReason === 'string'
    ? eventOrReason : eventOrReason?.type || 'manipulator-cancel';
  const result = cancelInteraction(state, reason);
  if (typeof eventOrReason !== 'string') stop(eventOrReason);
  queueRefresh(state); return result;
}
function bind(state) {
  state.unsubscribeConstraint = state.constraintApi.subscribe((value) => {
    try { state.overlay.setActiveHandle(handleValue(value)); }
    catch (error) { report(state, error, 'constraint'); }
  });
  state.onViewActivity = () => queueRefresh(state);
  for (const type of ['pointermove', 'pointerup', 'wheel']) {
    state.host.addEventListener(type, state.onViewActivity, { passive: true });
  }
  state.window?.addEventListener('resize', state.onViewActivity);
  const ResizeObserverCtor = state.window?.ResizeObserver;
  if (typeof ResizeObserverCtor === 'function') {
    state.resizeObserver = new ResizeObserverCtor(state.onViewActivity);
    state.resizeObserver.observe(state.host);
  }
}
function unbind(state) {
  state.unsubscribeConstraint?.(); state.unsubscribeConstraint = null;
  for (const type of ['pointermove', 'pointerup', 'wheel']) {
    state.host.removeEventListener(type, state.onViewActivity, { passive: true });
  }
  state.window?.removeEventListener('resize', state.onViewActivity);
  state.resizeObserver?.disconnect?.(); state.resizeObserver = null;
}
function destroy(state) {
  if (state.destroyed) return false;
  cancelInteraction(state, 'manipulator-destroyed'); state.destroyed = true;
  cancelFrame(state); unbind(state); state.overlay.destroy(); return true;
}
function createState(options, host) {
  return {
    host, window: host.ownerDocument.defaultView,
    constraintApi: requiredConstraintApi(options.constraintApi),
    readViewer: requiredFunction(options.readViewer, 'readViewer'),
    readTarget: requiredFunction(options.readTarget, 'readTarget'),
    beginDrag: requiredFunction(options.beginDrag, 'beginDrag'),
    updateDrag: requiredFunction(options.updateDrag, 'updateDrag'),
    endDrag: requiredFunction(options.endDrag, 'endDrag'),
    cancelDrag: requiredFunction(options.cancelDrag, 'cancelDrag'),
    onError: requiredFunction(options.onError || (() => {}), 'onError'),
    active: false, model: null, dragging: null, frame: null, lastError: null,
    cancelling: false, destroyed: false, overlay: null,
    unsubscribeConstraint: null, onViewActivity: null, resizeObserver: null,
  };
}
export function createSequentialMoveManipulatorController(options = {}) {
  const host = options.host;
  if (!host?.ownerDocument) throw new TypeError('Manipulator controller requires the Draft Edit host.');
  const state = createState(options, host);
  state.overlay = createSequentialMoveManipulatorOverlay({
    host,
    onPointerDown: (handleId, event) => begin(state, handleId, event),
    onPointerMove: (event) => update(state, event),
    onPointerEnd: (event) => end(state, event),
    onPointerCancel: (event) => cancel(state, event),
    onKeyboardSelect: (handleId) => setConstraint(state, handleId, 'keyboard'),
    onError: (error, phase) => { report(state, error, `overlay-${phase}`);
      cancelInteraction(state, `manipulator-${phase}-failed`); },
  });
  bind(state);
  return Object.freeze({
    schema: SEQUENTIAL_MOVE_MANIPULATOR_CONTROLLER_SCHEMA,
    setActive(value) {
      state.active = value === true && !state.destroyed;
      if (!state.active) {
        cancelInteraction(state, 'manipulator-inactive'); cancelFrame(state);
        state.model = null; return state.overlay.hide('Translation manipulator inactive.');
      }
      return render(state);
    },
    refresh: () => render(state),
    clear(reason = 'manipulator-cleared') {
      cancelInteraction(state, reason); cancelFrame(state); state.model = null;
      return state.overlay.hide(reason);
    },
    setConstraint: (value, source) => setConstraint(state, value, source),
    cancel: (reason) => cancel(state, reason),
    getState: () => Object.freeze({
      active: state.active, visible: state.overlay.getState().visible,
      manipulatorId: state.model?.manipulatorId || null,
      constraint: state.constraintApi.get(), dragging: state.dragging,
      framePending: state.frame != null, lastError: state.lastError?.message || null,
      destroyed: state.destroyed, overlay: state.overlay.getState(),
    }),
    destroy: () => destroy(state),
  });
}

export const _test = Object.freeze({ currentSnapshot, handleValue, pointer, sameInteraction });
