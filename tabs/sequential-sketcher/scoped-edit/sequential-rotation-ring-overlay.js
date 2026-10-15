/** Accessible SVG overlay for canonical X/Y/Z rotation rings. */
export const SEQUENTIAL_ROTATION_RING_OVERLAY_SCHEMA = 'SequentialRotationRingOverlay.v1';

const SVG_NS = 'http://www.w3.org/2000/svg';
const RING_RADIUS_PX = 52;
const LABEL_RADIUS_PX = 60;
const SEGMENTS = 48;
const FALLBACK_DIRECTIONS = Object.freeze({
  X: Object.freeze({ x: 1, y: 0 }),
  Y: Object.freeze({ x: 0, y: -1 }),
  Z: Object.freeze({ x: -0.7, y: 0.7 }),
});

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function svgElement(documentRef, name, attributes = {}) {
  const element = documentRef.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}
function finitePoint(value, label) {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new TypeError(`${label} must be a projected screen point.`);
  }
  return { x: value.x, y: value.y };
}
function length(value) {
  return Math.hypot(value.x, value.y);
}
function normalize(value, fallback) {
  const magnitude = length(value);
  return magnitude >= 2
    ? { x: value.x / magnitude, y: value.y / magnitude }
    : { ...fallback };
}
function axisPoint(model, axis) {
  const span = Number(model.projectionSpan) || 1;
  return [model.pivot.x + (axis === 'X' ? span : 0),
    model.pivot.y + (axis === 'Y' ? span : 0),
    model.pivot.z + (axis === 'Z' ? span : 0)];
}
function perpendicular(value) {
  return { x: -value.y, y: value.x };
}
function basisDirections(model, viewer) {
  const project = viewer.projectPoint || viewer.worldToScreen;
  if (typeof project !== 'function') throw new TypeError('Rotation-ring viewer projection is unavailable.');
  const pivot = finitePoint(project.call(viewer, [model.pivot.x, model.pivot.y, model.pivot.z]),
    'Rotation-ring pivot');
  const axes = {};
  for (const axis of ['X', 'Y', 'Z']) {
    const projected = finitePoint(project.call(viewer, axisPoint(model, axis)),
      `Rotation-ring ${axis} axis`);
    axes[axis] = normalize({ x: projected.x - pivot.x, y: projected.y - pivot.y },
      FALLBACK_DIRECTIONS[axis]);
  }
  return { pivot, axes };
}
function orthogonalBasis(left, right) {
  const alignment = Math.abs(left.x * right.x + left.y * right.y);
  if (alignment < 0.92) return { left, right };
  return { left, right: perpendicular(left) };
}
function ringPath(modelRing, projected) {
  const basis = orthogonalBasis(
    projected.axes[modelRing.planeAxes[0]],
    projected.axes[modelRing.planeAxes[1]],
  );
  const points = [];
  for (let index = 0; index <= SEGMENTS; index += 1) {
    const angle = index / SEGMENTS * Math.PI * 2;
    points.push({
      x: projected.pivot.x + RING_RADIUS_PX * (basis.left.x * Math.cos(angle)
        + basis.right.x * Math.sin(angle)),
      y: projected.pivot.y + RING_RADIUS_PX * (basis.left.y * Math.cos(angle)
        + basis.right.y * Math.sin(angle)),
    });
  }
  return `M ${points.map((point) => `${point.x} ${point.y}`).join(' L ')}`;
}
function labelPoint(modelRing, projected) {
  const direction = normalize(projected.axes[modelRing.planeAxes[0]], { x: 1, y: 0 });
  return { x: projected.pivot.x + direction.x * LABEL_RADIUS_PX,
    y: projected.pivot.y + direction.y * LABEL_RADIUS_PX };
}
function setHidden(state, hidden) {
  state.svg.hidden = hidden; state.svg.setAttribute('aria-hidden', hidden ? 'true' : 'false');
}
function hide(state) {
  setHidden(state, true); state.model = null;
}
function renderState(state) {
  for (const [axis, group] of state.groups) {
    const active = axis === state.activeAxis;
    const dragging = axis === state.draggingAxis;
    group.setAttribute('aria-pressed', active ? 'true' : 'false');
    group.setAttribute('data-active', active ? 'true' : 'false');
    group.setAttribute('data-dragging', dragging ? 'true' : 'false');
    group.style.opacity = dragging ? '1' : active ? '.98' : '.72';
    group.style.filter = active ? 'drop-shadow(0 0 5px rgba(255,255,255,.8))' : '';
  }
}
function ringColor(axis) {
  return axis === 'X' ? '#ef4444' : axis === 'Y' ? '#22c55e' : '#3b82f6';
}
function createRingGroup(state, ring) {
  const group = svgElement(state.document, 'g', {
    'data-ssk-rotation-ring': ring.axisId, role: 'button', tabindex: '0',
    'aria-label': ring.label, 'aria-pressed': 'false',
  });
  group.style.cursor = 'grab';
  const hit = svgElement(state.document, 'path', {
    fill: 'none', stroke: 'rgba(255,255,255,.001)', 'stroke-width': 15,
  });
  const visible = svgElement(state.document, 'path', {
    fill: 'none', stroke: ringColor(ring.axisId), 'stroke-width': 3,
  });
  const label = svgElement(state.document, 'text', {
    'text-anchor': 'middle', fill: 'white', 'font-size': 11,
    'font-family': 'system-ui, sans-serif', 'font-weight': 800,
    'paint-order': 'stroke', stroke: 'rgba(7,16,31,.9)', 'stroke-width': 3,
    'pointer-events': 'none',
  });
  label.textContent = ring.axisId;
  group.append(hit, visible, label); state.layer.appendChild(group);
  state.groups.set(ring.axisId, group);
  state.paths.set(ring.axisId, { hit, visible, label });
}
function install(host) {
  const documentRef = host.ownerDocument;
  const svg = svgElement(documentRef, 'svg', {
    'data-ssk-rotation-rings': '', role: 'group', 'aria-label': 'Rotation rings',
  });
  svg.style.cssText = 'position:absolute;inset:0;z-index:12;width:100%;height:100%;overflow:visible;pointer-events:none';
  const layer = svgElement(documentRef, 'g', { 'pointer-events': 'all' });
  const pivot = svgElement(documentRef, 'circle', {
    r: 5, fill: 'white', stroke: 'rgba(7,16,31,.9)', 'stroke-width': 2,
    'pointer-events': 'none',
  });
  svg.append(pivot, layer); host.appendChild(svg);
  return { documentRef, svg, layer, pivot };
}
function bind(state) {
  state.onPointerDown = (event) => {
    const group = event.target?.closest?.('[data-ssk-rotation-ring]');
    if (!group || state.destroyed) return;
    const axis = group.dataset.sskRotationRing;
    state.draggingAxis = axis; renderState(state); group.setPointerCapture?.(event.pointerId);
    try { state.pointerDown(axis, event); }
    catch (error) { state.draggingAxis = null; renderState(state); throw error; }
  };
  state.onPointerMove = (event) => { if (state.draggingAxis) state.pointerMove(event); };
  state.onPointerEnd = (event) => {
    if (!state.draggingAxis) return;
    state.draggingAxis = null; renderState(state); state.pointerEnd(event);
  };
  state.onPointerCancel = (event) => {
    if (!state.draggingAxis) return;
    state.draggingAxis = null; renderState(state); state.pointerCancel(event);
  };
  state.onKeyDown = (event) => {
    const group = event.target?.closest?.('[data-ssk-rotation-ring]');
    if (event.key === 'Escape') state.pointerCancel(event);
    else if (group && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault(); state.keyboardSelect(group.dataset.sskRotationRing);
    }
  };
  state.svg.addEventListener('pointerdown', state.onPointerDown);
  state.svg.addEventListener('pointermove', state.onPointerMove);
  state.svg.addEventListener('pointerup', state.onPointerEnd);
  state.svg.addEventListener('pointercancel', state.onPointerCancel);
  state.svg.addEventListener('keydown', state.onKeyDown);
}
function unbind(state) {
  state.svg.removeEventListener('pointerdown', state.onPointerDown);
  state.svg.removeEventListener('pointermove', state.onPointerMove);
  state.svg.removeEventListener('pointerup', state.onPointerEnd);
  state.svg.removeEventListener('pointercancel', state.onPointerCancel);
  state.svg.removeEventListener('keydown', state.onKeyDown);
}
function setModel(state, model, viewer) {
  if (state.destroyed) return false;
  if (!model) { hide(state); return false; }
  if (!state.groups.size) model.rings.forEach((ring) => createRingGroup(state, ring));
  const projected = basisDirections(model, viewer);
  state.model = model; setHidden(state, false);
  state.pivot.setAttribute('cx', projected.pivot.x);
  state.pivot.setAttribute('cy', projected.pivot.y);
  for (const ring of model.rings) {
    const path = ringPath(ring, projected); const label = labelPoint(ring, projected);
    const elements = state.paths.get(ring.axisId);
    elements.hit.setAttribute('d', path); elements.visible.setAttribute('d', path);
    elements.label.setAttribute('x', label.x); elements.label.setAttribute('y', label.y + 4);
  }
  renderState(state); return true;
}
function destroy(state) {
  if (state.destroyed) return false;
  state.destroyed = true; unbind(state); state.svg.remove(); return true;
}
export function createSequentialRotationRingOverlay(options = {}) {
  const host = options.host;
  if (!host?.ownerDocument) throw new TypeError('Rotation-ring overlay requires a host.');
  const installed = install(host);
  const state = {
    host, document: installed.documentRef, svg: installed.svg, layer: installed.layer,
    pivot: installed.pivot, groups: new Map(), paths: new Map(), model: null,
    activeAxis: null, draggingAxis: null, destroyed: false,
    pointerDown: requiredFunction(options.onPointerDown, 'onPointerDown'),
    pointerMove: requiredFunction(options.onPointerMove, 'onPointerMove'),
    pointerEnd: requiredFunction(options.onPointerEnd, 'onPointerEnd'),
    pointerCancel: requiredFunction(options.onPointerCancel, 'onPointerCancel'),
    keyboardSelect: requiredFunction(options.onKeyboardSelect || (() => {}), 'onKeyboardSelect'),
  };
  bind(state);
  return Object.freeze({
    schema: SEQUENTIAL_ROTATION_RING_OVERLAY_SCHEMA,
    setModel: (model, viewer) => setModel(state, model, viewer),
    setActiveAxis(value) { state.activeAxis = value || null; renderState(state); return state.activeAxis; },
    hide: () => hide(state),
    getState: () => Object.freeze({ visible: !state.svg.hidden,
      ringModelId: state.model?.ringModelId || null, activeAxis: state.activeAxis,
      draggingAxis: state.draggingAxis, ringCount: state.groups.size, destroyed: state.destroyed }),
    destroy: () => destroy(state),
  });
}

export const _test = Object.freeze({ axisPoint, basisDirections, labelPoint, orthogonalBasis, ringPath });
