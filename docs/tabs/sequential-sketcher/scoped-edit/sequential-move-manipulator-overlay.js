/** Accessible projected overlay for the canonical translation manipulator. */
export const SEQUENTIAL_MOVE_MANIPULATOR_OVERLAY_SCHEMA = 'SequentialMoveManipulatorOverlay.v1';
export const SEQUENTIAL_MOVE_MANIPULATOR_SCREEN_BOUNDS = Object.freeze({
  axisLengthPx: Object.freeze({ min: 48, max: 72, preferred: 58 }),
  planeOffsetPx: Object.freeze({ min: 28, max: 44, preferred: 35 }), hitRadiusPx:
    Object.freeze({ min: 12, max: 16, preferred: 13 }), });
const SVG_NS = 'http://www.w3.org/2000/svg';
const AXES = Object.freeze(['X', 'Y', 'Z']); const PROJECTION_EPSILON_PX = 2;
function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`); return value;
}
function svgElement(documentRef, name, attributes = {}) {
  const element = documentRef.createElementNS(SVG_NS, name); Object.entries(attributes)
    .forEach(([key, value]) => element.setAttribute(key, String(value))); return element;
}
function finitePoint(value, label) {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y))
    throw new TypeError(`${label} must be a projected screen point.`); return { x: Number(value.x), y: Number(value.y) };
}
function length(value) { return Math.hypot(value.x, value.y); } function unit(value) { const magnitude = length(value); return magnitude >= PROJECTION_EPSILON_PX
  ? { x: value.x / magnitude, y: value.y / magnitude } : null; }
function add(point, vector, amount) { return {
  x: point.x + vector.x * amount, y: point.y + vector.y * amount }; }
function axisWorldPoint(model, axis, sign) {
  const span = Number(model.projectionSpan) || 1;
  return [model.pivot.x + (axis === 'X' ? span * sign : 0),
    model.pivot.y + (axis === 'Y' ? span * sign : 0),
    model.pivot.z + (axis === 'Z' ? span * sign : 0)];
}
function projectedAxis(project, viewer, model, pivot, axis) {
  const plus = finitePoint(project.call(viewer, axisWorldPoint(model, axis, 1)), `Manipulator ${axis}+ axis`);
  const minus = finitePoint(project.call(viewer, axisWorldPoint(model, axis, -1)), `Manipulator ${axis}- axis`);
  const plusVector = { x: plus.x - pivot.x, y: plus.y - pivot.y };
  const minusVector = { x: minus.x - pivot.x, y: minus.y - pivot.y };
  const selected = length(plusVector) >= length(minusVector) ? plusVector : minusVector;
  const direction = unit(selected);
  return Object.freeze({
    axis, direction, viewAligned: !direction,
    screenSpan: Math.max(length(plusVector), length(minusVector)),
  });
}
function projection(model, viewer) {
  const project = viewer?.projectPoint || viewer?.worldToScreen;
  if (typeof project !== 'function')
    throw new TypeError('Manipulator viewer projection API is unavailable.');
  const pivot = finitePoint(project.call(viewer, [model.pivot.x, model.pivot.y,
    model.pivot.z]), 'Manipulator pivot');
  const axes = Object.fromEntries(AXES.map((axis) =>
    [axis, projectedAxis(project, viewer, model, pivot, axis)]));
  return Object.freeze({ pivot, axes });
}
function bounded(preferred, bounds) { return Math.min(bounds.max, Math.max(bounds.min, preferred)); }
function axisHandlePoint(projected, axis) {
  const material = projected.axes[axis];
  if (material.viewAligned) return projected.pivot;
  const distance = bounded(SEQUENTIAL_MOVE_MANIPULATOR_SCREEN_BOUNDS.axisLengthPx.preferred,
    SEQUENTIAL_MOVE_MANIPULATOR_SCREEN_BOUNDS.axisLengthPx);
  return add(projected.pivot, material.direction, distance);
}
function planeMaterial(handle, projected) {
  const left = projected.axes[handle.axes[0]].direction;
  const right = projected.axes[handle.axes[1]].direction;
  const available = [left, right].filter(Boolean);
  if (!available.length) return { center: projected.pivot, left, right, degenerate: true };
  const combined = available.reduce((sum, value) => (
    { x: sum.x + value.x, y: sum.y + value.y }
  ), { x: 0, y: 0 });
  const direction = unit(combined) || available[0];
  const distance = bounded(SEQUENTIAL_MOVE_MANIPULATOR_SCREEN_BOUNDS.planeOffsetPx.preferred,
    SEQUENTIAL_MOVE_MANIPULATOR_SCREEN_BOUNDS.planeOffsetPx);
  return {
    center: add(projected.pivot, direction, distance), left, right,
    degenerate: !left || !right || !unit(combined),
  };
}
function relativePlanePoints(material) {
  const first = material.left || material.right || { x: 1, y: 0 };
  let second = material.right || material.left || { x: 0, y: 1 };
  if (Math.abs(first.x * second.y - first.y * second.x) < 0.18)
    second = { x: -first.y, y: first.x };
  const a = { x: first.x * 11, y: first.y * 11 };
  const b = { x: second.x * 9, y: second.y * 9 };
  return [
    `${-a.x - b.x},${-a.y - b.y}`, `${a.x - b.x},${a.y - b.y}`,
    `${a.x + b.x},${a.y + b.y}`, `${-a.x + b.x},${-a.y + b.y}`,
  ].join(' ');
}
function setVisible(state, visible) {
  state.svg.hidden = !visible; state.svg.setAttribute('aria-hidden', visible ? 'false' : 'true');
  state.svg.style.pointerEvents = visible ? 'auto' : 'none'; if (visible) {
    state.svg.removeAttribute('hidden'); state.svg.removeAttribute('inert'); } else { state.svg.setAttribute('hidden', ''); state.svg.setAttribute('inert', ''); }
}
function releaseCapture(state) {
  if (state.capturedPointerId == null) return;
  try { state.captureElement?.releasePointerCapture?.(state.capturedPointerId); } catch {}
  state.capturedPointerId = null; state.captureElement = null;
}
function announce(state, message) { state.live.textContent = String(message || ''); } function renderHandleState(state) {
  for (const [id, element] of state.handles) {
    const active = id === state.activeHandle;
    const dragging = id === state.draggingHandle;
    element.setAttribute('aria-pressed', active ? 'true' : 'false');
    element.setAttribute('data-active', active ? 'true' : 'false');
    element.setAttribute('data-dragging', dragging ? 'true' : 'false');
    element.setAttribute('tabindex', id === (state.focusHandle || state.activeHandle) ? '0' : '-1');
    element.style.opacity = dragging ? '1' : active ? '.96' : '.78';
  }
}
function hide(state, reason = null) {
  releaseCapture(state); state.draggingHandle = null; state.model = null;
  setVisible(state, false); renderHandleState(state); if (reason) announce(state, reason); return false;
}
function createHandleGroup(state, handle) {
  const group = svgElement(state.document, 'g', {
    'data-ssk-move-manipulator-handle': handle.handleId,
    role: 'button', tabindex: '-1', 'aria-label': handle.label, 'aria-pressed': 'false',
  });
  group.style.cursor = 'grab';
  const shape = handle.kind === 'axis'
    ? svgElement(state.document, 'circle', {
      r: SEQUENTIAL_MOVE_MANIPULATOR_SCREEN_BOUNDS.hitRadiusPx.preferred,
      fill: 'rgba(15,23,42,.92)', stroke: 'white', 'stroke-width': 2,
    })
    : svgElement(state.document, 'polygon', {
      points: '-12,-9 12,-9 12,9 -12,9',
      fill: 'rgba(15,23,42,.92)', stroke: 'white', 'stroke-width': 2,
    });
  const label = svgElement(state.document, 'text', {
    x: 0, y: 4, 'text-anchor': 'middle', fill: 'white',
    'font-size': 10, 'font-family': 'system-ui, sans-serif', 'font-weight': 700,
    'pointer-events': 'none',
  });
  label.textContent = handle.handleId;
  group.append(shape, label); state.handleLayer.appendChild(group);
  state.handles.set(handle.handleId, group); state.shapes.set(handle.handleId, shape);
}
function install(host) {
  const documentRef = host.ownerDocument; const svg = svgElement(documentRef, 'svg', {
    'data-ssk-move-manipulator': '', 'aria-label': 'Translation manipulator',
    role: 'group', hidden: '', 'aria-hidden': 'true', inert: '',
  });
  svg.style.cssText = 'position:absolute;inset:0;z-index:11;width:100%;height:100%;overflow:visible;pointer-events:none';
  const lineLayer = svgElement(documentRef, 'g', { 'pointer-events': 'none' });
  const handleLayer = svgElement(documentRef, 'g', { 'pointer-events': 'all' });
  const pivot = svgElement(documentRef, 'circle', {
    r: 4, fill: 'white', stroke: 'rgba(15,23,42,.9)', 'stroke-width': 2,
  });
  const live = svgElement(documentRef, 'text', {
    'data-ssk-move-manipulator-status': '', role: 'status', 'aria-live': 'polite', opacity: 0,
  });
  lineLayer.appendChild(pivot); svg.append(lineLayer, handleLayer, live); host.appendChild(svg);
  return { documentRef, svg, lineLayer, handleLayer, pivot, live };
}
function handleFromEvent(event) { return event.target?.closest?.(
  '[data-ssk-move-manipulator-handle]') || null; }
function bind(state) {
  state.onPointerDown = (event) => {
    const element = handleFromEvent(event);
    if (!element || state.destroyed || state.draggingHandle) return;
    const handleId = element.dataset.sskMoveManipulatorHandle;
    try {
      const result = state.pointerDown(handleId, event);
      if (result == null || result === false) return;
      state.draggingHandle = handleId; state.focusHandle = handleId;
      element.setPointerCapture?.(event.pointerId);
      state.capturedPointerId = event.pointerId; state.captureElement = element;
      announce(state, `${handleId} drag started.`); renderHandleState(state);
    } catch (error) {
      releaseCapture(state); state.draggingHandle = null; renderHandleState(state);
      state.onError(error, 'pointerdown');
    }
  };
  state.onPointerMove = (event) => {
    if (!state.draggingHandle) return;
    try { state.pointerMove(event); } catch (error) { state.onError(error, 'pointermove'); }
  };
  state.onPointerEnd = (event) => {
    if (!state.draggingHandle || event.pointerId !== state.capturedPointerId) return;
    const handleId = state.draggingHandle;
    try { state.pointerEnd(event); announce(state, `${handleId} released to review.`); }
    catch (error) { state.onError(error, 'pointerup'); }
    finally { releaseCapture(state); state.draggingHandle = null; renderHandleState(state); }
  };
  state.onPointerCancel = (event) => {
    if (!state.draggingHandle) return;
    const handleId = state.draggingHandle;
    try { state.pointerCancel(event); announce(state, `${handleId} drag cancelled.`); }
    catch (error) { state.onError(error, 'pointercancel'); }
    finally { releaseCapture(state); state.draggingHandle = null; renderHandleState(state); }
  };
  state.onKeyDown = (event) => {
    const element = handleFromEvent(event);
    if (event.key === 'Escape' && state.draggingHandle) state.onPointerCancel(event);
    else if (element && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault(); state.keyboardSelect(element.dataset.sskMoveManipulatorHandle);
    } else if (element && ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      const ids = [...state.handles.keys()];
      const offset = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1;
      const index = ids.indexOf(element.dataset.sskMoveManipulatorHandle);
      state.focusHandle = ids[(index + offset + ids.length) % ids.length];
      renderHandleState(state); state.handles.get(state.focusHandle)?.focus?.();
    }
  };
  state.svg.addEventListener('pointerdown', state.onPointerDown);
  state.svg.addEventListener('pointermove', state.onPointerMove);
  state.svg.addEventListener('pointerup', state.onPointerEnd);
  state.svg.addEventListener('pointercancel', state.onPointerCancel);
  state.svg.addEventListener('keydown', state.onKeyDown);
}
function unbind(state) {
  for (const [type, callback] of [['pointerdown', state.onPointerDown],
    ['pointermove', state.onPointerMove], ['pointerup', state.onPointerEnd],
    ['pointercancel', state.onPointerCancel], ['keydown', state.onKeyDown]]) {
    state.svg.removeEventListener(type, callback);
  }
}
function renderModel(state, model, viewer) {
  const projected = projection(model, viewer);
  state.model = model; setVisible(state, true);
  state.pivotElement.setAttribute('cx', projected.pivot.x);
  state.pivotElement.setAttribute('cy', projected.pivot.y);
  state.viewAlignedAxes = [];
  for (const handle of model.handles) {
    const element = state.handles.get(handle.handleId);
    if (handle.kind === 'axis') {
      const material = projected.axes[handle.handleId];
      if (material.viewAligned) state.viewAlignedAxes.push(handle.handleId);
      const point = axisHandlePoint(projected, handle.handleId);
      element.setAttribute('transform', `translate(${point.x} ${point.y})`);
      element.setAttribute('data-view-aligned', material.viewAligned ? 'true' : 'false');
      const line = state.axisLines.get(handle.handleId);
      line.hidden = material.viewAligned;
      if (!material.viewAligned) {
        line.setAttribute('x1', projected.pivot.x); line.setAttribute('y1', projected.pivot.y);
        line.setAttribute('x2', point.x); line.setAttribute('y2', point.y);
      }
    } else {
      const material = planeMaterial(handle, projected);
      element.setAttribute('transform', `translate(${material.center.x} ${material.center.y})`);
      element.setAttribute('data-projection-degenerate', material.degenerate ? 'true' : 'false');
      state.shapes.get(handle.handleId).setAttribute('points', relativePlanePoints(material));
    }
  }
  renderHandleState(state); return true;
}
function destroyOverlay(state) {
  if (state.destroyed) return false; state.destroyed = true; releaseCapture(state); unbind(state);
  state.svg.remove(); return true;
}
export function createSequentialMoveManipulatorOverlay(options = {}) {
  const host = options.host;
  if (!host?.ownerDocument) throw new TypeError('Manipulator overlay requires a host.');
  const installed = install(host);
  const state = {
    host, document: installed.documentRef, svg: installed.svg,
    lineLayer: installed.lineLayer, handleLayer: installed.handleLayer,
    pivotElement: installed.pivot, live: installed.live,
    handles: new Map(), shapes: new Map(), axisLines: new Map(),
    pointerDown: requiredFunction(options.onPointerDown, 'onPointerDown'),
    pointerMove: requiredFunction(options.onPointerMove, 'onPointerMove'),
    pointerEnd: requiredFunction(options.onPointerEnd, 'onPointerEnd'),
    pointerCancel: requiredFunction(options.onPointerCancel, 'onPointerCancel'),
    keyboardSelect: requiredFunction(options.onKeyboardSelect || (() => {}), 'onKeyboardSelect'),
    onError: requiredFunction(options.onError || (() => {}), 'onError'),
    model: null, activeHandle: null, focusHandle: null, draggingHandle: null,
    capturedPointerId: null, captureElement: null, viewAlignedAxes: [], destroyed: false,
  };
  for (const axis of AXES) {
    const stroke = axis === 'X' ? '#ef4444' : axis === 'Y' ? '#22c55e' : '#3b82f6';
    const line = svgElement(state.document, 'line', { stroke, 'stroke-width': 3 });
    state.lineLayer.appendChild(line); state.axisLines.set(axis, line);
  }
  bind(state);
  return Object.freeze({
    schema: SEQUENTIAL_MOVE_MANIPULATOR_OVERLAY_SCHEMA,
    setModel(model, viewer) {
      if (state.destroyed) return false;
      if (!model) return hide(state);
      if (!state.handles.size) model.handles.forEach((handle) => createHandleGroup(state, handle));
      return renderModel(state, model, viewer);
    },
    setActiveHandle(value) {
      state.activeHandle = value || null; state.focusHandle ||= state.activeHandle;
      renderHandleState(state); return state.activeHandle;
    },
    hide: (reason) => hide(state, reason),
    cancelPointerInteraction(reason = null) { releaseCapture(state); state.draggingHandle = null; renderHandleState(state); if (reason) announce(state, reason); return true; },
    getState: () => Object.freeze({
      visible: state.svg.getAttribute('hidden') == null && !state.svg.hidden, manipulatorId: state.model?.manipulatorId || null,
      activeHandle: state.activeHandle, draggingHandle: state.draggingHandle,
      capturedPointerId: state.capturedPointerId, handleCount: state.handles.size,
      viewAlignedAxes: Object.freeze([...state.viewAlignedAxes]), destroyed: state.destroyed,
    }),
    destroy: () => destroyOverlay(state),
  });
}
export const _test = Object.freeze({
  axisHandlePoint, axisWorldPoint, planeMaterial, projectedAxis, projection, relativePlanePoints,
});