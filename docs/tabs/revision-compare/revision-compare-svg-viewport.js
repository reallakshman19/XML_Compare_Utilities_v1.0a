/** Revision Compare-local linked SVG viewBox navigation. */
export const REVISION_COMPARE_SVG_VIEWPORT_SCHEMA = 'RevisionCompareSvgViewport.v1';
export const REVISION_COMPARE_SVG_MIN_ZOOM = 0.25;
export const REVISION_COMPARE_SVG_MAX_ZOOM = 32;
export const REVISION_COMPARE_SVG_FINE_PAN = 0.05;
export const REVISION_COMPARE_SVG_COARSE_PAN = 0.20;
export const REVISION_COMPARE_SVG_KEYBOARD_ZOOM_FACTOR = 1.20;
export const REVISION_COMPARE_SVG_KEYBOARD_ZOOM_ANCHOR = Object.freeze({ x: 0.5, y: 0.5 });
function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function positive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
function normalizedLimits(input = {}) {
  const minimumZoom = positive(input.minimumZoom, REVISION_COMPARE_SVG_MIN_ZOOM);
  const maximumZoom = Math.max(minimumZoom, positive(input.maximumZoom, REVISION_COMPARE_SVG_MAX_ZOOM));
  return Object.freeze({ minimumZoom, maximumZoom });
}
export function normalizeRevisionCompareSvgViewportState(input = {}, limitsInput = {}) {
  const limits = normalizedLimits({ ...limitsInput, ...input });
  return Object.freeze({
    schema: REVISION_COMPARE_SVG_VIEWPORT_SCHEMA,
    zoom: clamp(finite(input.zoom, 1) || 1, limits.minimumZoom, limits.maximumZoom),
    panX: clamp(finite(input.panX, 0), -4, 4),
    panY: clamp(finite(input.panY, 0), -4, 4),
    minimumZoom: limits.minimumZoom,
    maximumZoom: limits.maximumZoom,
    appliedViewBoxes: Object.freeze({}),
  });
}
function parseViewBox(root) {
  const values = String(root?.getAttribute?.('viewBox') ?? '').trim().split(/\s+/).map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) return null;
  const [x, y, width, height] = values;
  if (width <= 0 || height <= 0) return null;
  return Object.freeze({ x, y, width, height });
}
export function revisionCompareSvgViewBox(base, stateInput) {
  if (!base || !Number.isFinite(base.width) || base.width <= 0 || !Number.isFinite(base.height) || base.height <= 0) {
    throw new TypeError('Revision Compare SVG base viewBox must be positive and finite.');
  }
  const state = normalizeRevisionCompareSvgViewportState(stateInput, stateInput);
  const width = base.width / state.zoom;
  const height = base.height / state.zoom;
  const centerX = base.x + (base.width / 2) + (state.panX * base.width);
  const centerY = base.y + (base.height / 2) + (state.panY * base.height);
  return Object.freeze({ x: centerX - (width / 2), y: centerY - (height / 2), width, height });
}
function stateWithApplied(state, applied) {
  return Object.freeze({ ...state, appliedViewBoxes: Object.freeze({ ...applied }) });
}
function viewBoxText(value) {
  return `${value.x} ${value.y} ${value.width} ${value.height}`;
}
function ancestorMatches(target, root, predicate) {
  let current = target;
  while (current) {
    if (predicate(current)) return true;
    if (current === root) return false;
    current = current.parentNode;
  }
  return false;
}
function belongsToRoot(target, root) {
  let current = target;
  while (current) {
    if (current === root) return true;
    current = current.parentNode;
  }
  return false;
}
function entityTarget(target, root) {
  return ancestorMatches(target, root, (node) => Boolean(node.getAttribute?.('data-engineering-svg-entity-id')));
}
function blockedControlTarget(target, root) {
  return ancestorMatches(target, root, (node) => {
    const name = String(node.localName ?? node.tagName ?? '').toLowerCase();
    const editable = node.isContentEditable
      || (node.getAttribute?.('contenteditable') != null && node.getAttribute('contenteditable') !== 'false');
    return ['input', 'textarea', 'select', 'button'].includes(name) || editable;
  });
}
function pointerAnchor(event, root) {
  const rect = root?.getBoundingClientRect?.();
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  const x = finite(event?.clientX, Number.NaN);
  const y = finite(event?.clientY, Number.NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return Object.freeze({
    x: clamp((x - rect.left) / rect.width, 0, 1),
    y: clamp((y - rect.top) / rect.height, 0, 1),
    rect,
  });
}
export function zoomRevisionCompareSvgViewport(stateInput, base, anchor, factor) {
  const state = normalizeRevisionCompareSvgViewportState(stateInput, stateInput);
  if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)
      || !Number.isFinite(factor) || factor <= 0) return state;
  const current = revisionCompareSvgViewBox(base, state);
  const zoom = clamp(state.zoom * factor, state.minimumZoom, state.maximumZoom);
  if (zoom === state.zoom) return state;
  const width = base.width / zoom;
  const height = base.height / zoom;
  const worldX = current.x + (anchor.x * current.width);
  const worldY = current.y + (anchor.y * current.height);
  const nextX = worldX - (anchor.x * width);
  const nextY = worldY - (anchor.y * height);
  return normalizeRevisionCompareSvgViewportState({
    ...state,
    zoom,
    panX: ((nextX + (width / 2)) - (base.x + (base.width / 2))) / base.width,
    panY: ((nextY + (height / 2)) - (base.y + (base.height / 2))) / base.height,
  }, state);
}
function panState(stateInput, dx, dy) {
  const state = normalizeRevisionCompareSvgViewportState(stateInput, stateInput);
  return normalizeRevisionCompareSvgViewportState({ ...state, panX: state.panX + dx, panY: state.panY + dy }, state);
}
const KEY_COMMANDS = Object.freeze({
  ArrowLeft: Object.freeze({ type: 'pan', x: -1, y: 0 }),
  ArrowRight: Object.freeze({ type: 'pan', x: 1, y: 0 }),
  ArrowUp: Object.freeze({ type: 'pan', x: 0, y: -1 }),
  ArrowDown: Object.freeze({ type: 'pan', x: 0, y: 1 }),
  '+': Object.freeze({ type: 'zoom', factor: REVISION_COMPARE_SVG_KEYBOARD_ZOOM_FACTOR }),
  '=': Object.freeze({ type: 'zoom', factor: REVISION_COMPARE_SVG_KEYBOARD_ZOOM_FACTOR }),
  '-': Object.freeze({ type: 'zoom', factor: 1 / REVISION_COMPARE_SVG_KEYBOARD_ZOOM_FACTOR }),
  '0': Object.freeze({ type: 'reset' }),
});
export function normalizeRevisionCompareSvgViewportKey(event = {}) {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const command = KEY_COMMANDS[String(event.key ?? '')];
  if (!command) return null;
  if (command.type !== 'pan') return command;
  return Object.freeze({ ...command, coarse: Boolean(event.shiftKey) });
}
function surfaceCounts(context) {
  return Object.freeze({ surfaces: context.surfaces.size, listeners: context.listeners.size * 7 });
}
function dragGesture(id, event) {
  return { id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
    lastX: event.clientX, lastY: event.clientY, moved: false };
}
export function createRevisionCompareSvgViewport(options = {}) {
  const context = {
    state: normalizeRevisionCompareSvgViewportState(options.initialState, options),
    surfaces: new Map(), listeners: new Map(), gesture: null, suppressClick: false, disposed: false,
    onChange: typeof options.onChange === 'function' ? options.onChange : null,
  };
  function apply(reason = 'apply') {
    const applied = {};
    for (const [id, surface] of context.surfaces) {
      const viewBox = revisionCompareSvgViewBox(surface.base, context.state);
      surface.root.setAttribute('viewBox', viewBoxText(viewBox));
      applied[id] = viewBox;
    }
    context.state = stateWithApplied(context.state, applied);
    context.onChange?.(context.state, reason);
    return context.state;
  }
  function keyboardTransition(id, root, event) {
    if (context.surfaces.get(id)?.root !== root || (event.currentTarget && event.currentTarget !== root)) return false;
    if (!belongsToRoot(event.target, root) || entityTarget(event.target, root) || blockedControlTarget(event.target, root)) return false;
    const command = normalizeRevisionCompareSvgViewportKey(event);
    if (!command) return false;
    const surface = context.surfaces.get(id);
    event.preventDefault();
    event.stopPropagation();
    if (command.type === 'pan') {
      const amount = (command.coarse ? REVISION_COMPARE_SVG_COARSE_PAN : REVISION_COMPARE_SVG_FINE_PAN)
        / context.state.zoom;
      context.state = panState(context.state, command.x * amount, command.y * amount);
      apply('keyboard-pan');
    } else if (command.type === 'zoom') {
      context.state = zoomRevisionCompareSvgViewport(
        context.state, surface.base, REVISION_COMPARE_SVG_KEYBOARD_ZOOM_ANCHOR, command.factor,
      );
      apply('keyboard-zoom');
    } else {
      context.state = normalizeRevisionCompareSvgViewportState({}, context.state);
      apply('keyboard-reset');
    }
    return true;
  }
  function install(id, root) {
    const pointerdown = (event) => {
      if (event.button !== 0 || entityTarget(event.target, root)) return;
      const anchor = pointerAnchor(event, root);
      if (!anchor) return;
      context.gesture = dragGesture(id, event);
      root.setPointerCapture?.(event.pointerId);
    };
    const pointermove = (event) => {
      const gesture = context.gesture;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      const anchor = pointerAnchor(event, root);
      if (!anchor) return;
      const totalX = event.clientX - gesture.startX;
      const totalY = event.clientY - gesture.startY;
      if (!gesture.moved && Math.hypot(totalX, totalY) < 4) return;
      const dx = event.clientX - gesture.lastX;
      const dy = event.clientY - gesture.lastY;
      gesture.lastX = event.clientX;
      gesture.lastY = event.clientY;
      gesture.moved = true;
      context.state = panState(context.state,
        -dx / (anchor.rect.width * context.state.zoom), -dy / (anchor.rect.height * context.state.zoom));
      apply('pan');
    };
    const finish = (event, suppressClick) => {
      const gesture = context.gesture;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      context.suppressClick = Boolean(suppressClick && gesture.moved);
      root.releasePointerCapture?.(event.pointerId);
      context.gesture = null;
    };
    const pointerup = (event) => finish(event, true);
    const pointercancel = (event) => finish(event, false);
    const click = (event) => {
      if (!context.suppressClick) return;
      context.suppressClick = false;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.();
    };
    const wheel = (event) => {
      const anchor = pointerAnchor(event, root);
      if (!anchor || !Number.isFinite(event.deltaY)) return;
      event.preventDefault();
      const surface = context.surfaces.get(id);
      context.state = zoomRevisionCompareSvgViewport(
        context.state, surface.base, anchor, Math.exp(-event.deltaY * 0.0015));
      apply('zoom');
    };
    const keydown = (event) => keyboardTransition(id, root, event);
    root.addEventListener('pointerdown', pointerdown);
    root.addEventListener('pointermove', pointermove);
    root.addEventListener('pointerup', pointerup);
    root.addEventListener('pointercancel', pointercancel);
    root.addEventListener('click', click, true);
    root.addEventListener('wheel', wheel, { passive: false });
    root.addEventListener('keydown', keydown);
    context.listeners.set(id, { root, pointerdown, pointermove, pointerup, pointercancel, click, wheel, keydown });
  }
  function removeListeners() {
    for (const value of context.listeners.values()) {
      value.root.removeEventListener('pointerdown', value.pointerdown);
      value.root.removeEventListener('pointermove', value.pointermove);
      value.root.removeEventListener('pointerup', value.pointerup);
      value.root.removeEventListener('pointercancel', value.pointercancel);
      value.root.removeEventListener('click', value.click, true);
      value.root.removeEventListener('wheel', value.wheel);
      value.root.removeEventListener('keydown', value.keydown);
    }
    context.listeners.clear(); context.gesture = null; context.suppressClick = false;
  }
  return Object.freeze({
    attachSurface(id, root) {
      if (context.disposed) throw new Error('Revision Compare SVG viewport is disposed.');
      const key = String(id ?? '').trim();
      const base = parseViewBox(root);
      if (!key || !base) throw new TypeError('Revision Compare SVG surface requires an ID and valid viewBox.');
      if (context.surfaces.has(key)) throw new Error(`Revision Compare SVG surface ${key} is already attached.`);
      context.surfaces.set(key, { root, base }); install(key, root); return apply('attach');
    },
    refreshBases() {
      for (const surface of context.surfaces.values()) {
        const base = parseViewBox(surface.root);
        if (base) surface.base = base;
      }
      return apply('refresh');
    },
    setState(value, reason = 'restore') { context.state = normalizeRevisionCompareSvgViewportState(value, context.state); return apply(reason); },
    reset(reason = 'fit') { context.state = normalizeRevisionCompareSvgViewportState({}, context.state); return apply(reason); },
    getState: () => context.state,
    getResourceCounts: () => surfaceCounts(context),
    detach() { removeListeners(); context.surfaces.clear(); return true; },
    dispose() { if (context.disposed) return false; context.disposed = true; removeListeners(); context.surfaces.clear(); return true; },
  });
}
