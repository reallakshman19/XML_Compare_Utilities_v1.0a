/** Lifecycle controller connecting rotation rings to the existing rotation preview. */
import {
  createSequentialRotationRingModel,
  createSequentialRotationRingStart,
  SEQUENTIAL_ROTATION_RING_AXES,
} from './sequential-rotation-ring-contract.js';
import { createSequentialRotationRingOverlay } from './sequential-rotation-ring-overlay.js';

export const SEQUENTIAL_ROTATION_RING_CONTROLLER_SCHEMA =
  'SequentialRotationRingController.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function axisValue(value) {
  const axis = String(value || '').trim().toUpperCase();
  if (!SEQUENTIAL_ROTATION_RING_AXES.includes(axis)) {
    throw new TypeError(`Unsupported rotation-ring axis: ${value}`);
  }
  return axis;
}
function pointer(event) {
  return { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY };
}
function stop(event) {
  event.preventDefault?.(); event.stopImmediatePropagation?.();
}
function available(state) {
  return Boolean(state.active && state.readTarget() && state.readViewer());
}
function render(state) {
  if (state.destroyed || !available(state)) {
    state.model = null; state.overlay.hide(); return false;
  }
  try {
    state.model = createSequentialRotationRingModel(state.readTarget(), state.readPivot());
    state.overlay.setModel(state.model, state.readViewer());
    state.overlay.setActiveAxis(state.readAxisId());
    state.lastError = null; return true;
  } catch (error) {
    state.lastError = error; state.model = null; state.overlay.hide(); return false;
  }
}
function schedule(state) {
  if (state.frame || state.destroyed || !state.active) return;
  const frame = state.window?.requestAnimationFrame?.bind(state.window);
  if (!frame) return;
  const tick = () => {
    state.frame = null;
    if (state.destroyed || !state.active) return;
    render(state); state.frame = frame(tick);
  };
  state.frame = frame(tick);
}
function cancelFrame(state) {
  if (!state.frame) return;
  state.window?.cancelAnimationFrame?.(state.frame); state.frame = null;
}
function setAxis(state, value) {
  const axis = axisValue(value); state.setAxis(axis);
  state.overlay.setActiveAxis(axis); return axis;
}
function begin(state, axisId, event) {
  if (!state.model || state.dragging) return null;
  const target = state.readTarget(); const pivotValue = state.readPivot();
  const axis = setAxis(state, axisId);
  const ringStart = createSequentialRotationRingStart({
    target, pivot: pivotValue, axisId: axis, pointer: pointer(event),
  });
  try {
    const result = state.beginDrag({ target, pivot: pivotValue, ringStart,
      profile: state.readProfile(), ...pointer(event) });
    state.dragging = { axisId: axis, pointerId: event.pointerId };
    stop(event); return result;
  } catch (error) {
    state.lastError = error; state.dragging = null; throw error;
  }
}
function update(state, event) {
  if (!state.dragging || event.pointerId !== state.dragging.pointerId) return null;
  const result = state.updateDrag(pointer(event));
  state.setAngle(result.preview.transform.angleDegrees); stop(event); return result;
}
function end(state, event) {
  if (!state.dragging || event.pointerId !== state.dragging.pointerId) return null;
  const result = state.endDrag(event.pointerId); state.dragging = null;
  state.onReview(result); stop(event); render(state); return result;
}
function cancel(state, eventOrReason = 'rotation-ring-cancel') {
  if (!state.dragging) return null;
  const reason = typeof eventOrReason === 'string'
    ? eventOrReason : eventOrReason?.type || 'rotation-ring-cancel';
  state.dragging = null; const result = state.cancelDrag(reason);
  if (typeof eventOrReason !== 'string') stop(eventOrReason);
  state.onCancel(reason); render(state); return result;
}
function destroy(state) {
  if (state.destroyed) return false;
  state.destroyed = true; cancelFrame(state); state.overlay.destroy(); return true;
}
function controllerState(options, host) {
  return {
    host, window: host.ownerDocument.defaultView,
    readViewer: requiredFunction(options.readViewer, 'readViewer'),
    readTarget: requiredFunction(options.readTarget, 'readTarget'),
    readPivot: requiredFunction(options.readPivot, 'readPivot'),
    readProfile: requiredFunction(options.readProfile, 'readProfile'),
    readAxisId: requiredFunction(options.readAxisId, 'readAxisId'),
    setAxis: requiredFunction(options.setAxis, 'setAxis'),
    setAngle: requiredFunction(options.setAngle, 'setAngle'),
    beginDrag: requiredFunction(options.beginDrag, 'beginDrag'),
    updateDrag: requiredFunction(options.updateDrag, 'updateDrag'),
    endDrag: requiredFunction(options.endDrag, 'endDrag'),
    cancelDrag: requiredFunction(options.cancelDrag, 'cancelDrag'),
    onReview: requiredFunction(options.onReview || (() => {}), 'onReview'),
    onCancel: requiredFunction(options.onCancel || (() => {}), 'onCancel'),
    active: false, model: null, dragging: null, frame: null,
    lastError: null, destroyed: false, overlay: null,
  };
}
function installOverlay(state) {
  state.overlay = createSequentialRotationRingOverlay({
    host: state.host,
    onPointerDown: (axis, event) => begin(state, axis, event),
    onPointerMove: (event) => update(state, event),
    onPointerEnd: (event) => end(state, event),
    onPointerCancel: (event) => cancel(state, event),
    onKeyboardSelect: (axis) => setAxis(state, axis),
  });
}
export function createSequentialRotationRingController(options = {}) {
  const root = options.root;
  const host = options.host || root?.querySelector?.('[data-ssk-draft-edit-3d-host]');
  if (!host?.ownerDocument) throw new TypeError('Rotation-ring controller requires the Draft Edit host.');
  const state = controllerState(options, host); installOverlay(state);
  return Object.freeze({
    schema: SEQUENTIAL_ROTATION_RING_CONTROLLER_SCHEMA,
    setActive(value) {
      state.active = value === true && !state.destroyed;
      if (!state.active) { cancel(state, 'rotation-ring-inactive'); cancelFrame(state); }
      else schedule(state);
      return render(state);
    },
    refresh: () => render(state),
    clear(reason = 'rotation-ring-cleared') {
      cancel(state, reason); state.model = null; state.overlay.hide(); return true;
    },
    setAxis: (value) => setAxis(state, value),
    cancel: (reason) => cancel(state, reason),
    getState: () => Object.freeze({
      active: state.active, visible: state.overlay.getState().visible,
      ringModelId: state.model?.ringModelId || null,
      axisId: state.readAxisId(), dragging: state.dragging,
      lastError: state.lastError?.message || null, destroyed: state.destroyed,
      overlay: state.overlay.getState(),
    }),
    destroy: () => destroy(state),
  });
}

export const _test = Object.freeze({ available, axisValue, pointer });
