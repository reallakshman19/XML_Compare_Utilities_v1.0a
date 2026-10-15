export const UNIVERSAL_VIRTUAL_WINDOW_SCHEMA = 'universal-viewport-virtual-window/v1';
export const DEFAULT_UNIVERSAL_ROW_HEIGHT = 34;
export const DEFAULT_UNIVERSAL_OVERSCAN = 8;
export const MAX_UNIVERSAL_RENDERED_ROWS = 250;

const freeze = (value) => Object.freeze(value);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function universalVirtualTotalHeight(count, rowHeight = DEFAULT_UNIVERSAL_ROW_HEIGHT) {
  return Math.max(0, Math.floor(finite(count))) * Math.max(1, finite(rowHeight, DEFAULT_UNIVERSAL_ROW_HEIGHT));
}

export function calculateUniversalVirtualWindow(input = {}) {
  const count = Math.max(0, Math.floor(finite(input.count)));
  const rowHeight = Math.max(1, finite(input.rowHeight, DEFAULT_UNIVERSAL_ROW_HEIGHT));
  const viewportHeight = Math.max(rowHeight, finite(input.viewportHeight, rowHeight));
  const overscan = Math.max(0, Math.floor(finite(input.overscan, DEFAULT_UNIVERSAL_OVERSCAN)));
  const maxRows = Math.max(1, Math.floor(finite(input.maxRows, MAX_UNIVERSAL_RENDERED_ROWS)));
  const firstVisible = clamp(Math.floor(Math.max(0, finite(input.scrollTop)) / rowHeight), 0, Math.max(0, count - 1));
  const visibleCount = Math.max(1, Math.ceil(viewportHeight / rowHeight));
  let start = Math.max(0, firstVisible - overscan);
  let end = Math.min(count, start + Math.min(maxRows, visibleCount + overscan * 2));
  if (end === count) start = Math.max(0, end - Math.min(maxRows, visibleCount + overscan * 2));
  return freeze({
    schema: UNIVERSAL_VIRTUAL_WINDOW_SCHEMA,
    count,
    rowHeight,
    viewportHeight,
    overscan,
    start,
    end,
    rendered: Math.max(0, end - start),
    offset: start * rowHeight,
    totalHeight: universalVirtualTotalHeight(count, rowHeight),
    firstVisible,
  });
}

export function universalRevealScrollTop(input = {}) {
  const index = Math.max(0, Math.floor(finite(input.index)));
  const rowHeight = Math.max(1, finite(input.rowHeight, DEFAULT_UNIVERSAL_ROW_HEIGHT));
  const current = Math.max(0, finite(input.scrollTop));
  const viewport = Math.max(rowHeight, finite(input.viewportHeight, rowHeight));
  const top = index * rowHeight;
  const bottom = top + rowHeight;
  if (top < current) return top;
  if (bottom > current + viewport) return Math.max(0, bottom - viewport);
  return current;
}

export function moveUniversalVirtualIndex(currentIndex, key, count) {
  const size = Math.max(0, Math.floor(finite(count)));
  if (!size) return -1;
  const current = clamp(Math.floor(finite(currentIndex, 0)), 0, size - 1);
  if (key === 'Home') return 0;
  if (key === 'End') return size - 1;
  if (key === 'ArrowUp') return Math.max(0, current - 1);
  if (key === 'ArrowDown') return Math.min(size - 1, current + 1);
  return current;
}

function virtualRowHeight(base, view) {
  return clamp(Math.max(1, finite(base, DEFAULT_UNIVERSAL_ROW_HEIGHT)) * Math.max(.5, finite(view?.zoomY, 1)), 22, 80);
}

function surfaceVisible(surface) {
  return Boolean(surface?.offsetParent || surface?.getClientRects?.().length);
}

function createVirtualRuntime(options) {
  const surface = options.surface;
  const spacer = surface?.querySelector?.('[data-uxc-virtual-spacer]');
  const content = surface?.querySelector?.('[data-uxc-viewport-content]');
  if (!surface || !spacer || !content) throw new TypeError('Virtual controller requires surface, spacer and content.');
  if (typeof options.identityFor !== 'function' || typeof options.renderRows !== 'function') {
    throw new TypeError('Virtual controller requires identityFor() and renderRows().');
  }
  return {
    options, surface, spacer, content,
    abort: new AbortController(), rows: [], ids: [], byId: new Map(),
    selectedId: '', relatedIds: new Set(), focusId: '',
    view: { zoomX: 1, zoomY: 1, panX: 0, panY: 0 },
    logicalScrollTop: Math.max(0, finite(surface.scrollTop)),
    frame: null, destroyed: false,
    lastWindow: calculateUniversalVirtualWindow(),
  };
}

function rowHeightFor(runtime) {
  return virtualRowHeight(runtime.options.rowHeight, runtime.view);
}

function syncSurfaceScroll(runtime) {
  if (!surfaceVisible(runtime.surface)) return;
  if (Math.abs(finite(runtime.surface.scrollTop) - runtime.logicalScrollTop) > .5) {
    runtime.surface.scrollTop = runtime.logicalScrollTop;
  }
}

function renderVirtualRuntime(runtime) {
  if (runtime.destroyed) return runtime.lastWindow;
  syncSurfaceScroll(runtime);
  const rowHeight = rowHeightFor(runtime);
  const adjustedTop = Math.max(0, runtime.logicalScrollTop - finite(runtime.view.panY));
  runtime.lastWindow = calculateUniversalVirtualWindow({
    count: runtime.rows.length,
    rowHeight,
    viewportHeight: runtime.surface.clientHeight || 420,
    scrollTop: adjustedTop,
    overscan: runtime.options.overscan,
    maxRows: runtime.options.maxRows,
  });
  renderVirtualRows(runtime, rowHeight);
  runtime.options.onWindowChange?.(runtime.lastWindow, getVirtualScrollAnchor(runtime));
  return runtime.lastWindow;
}

function renderVirtualRows(runtime, rowHeight) {
  const window = runtime.lastWindow;
  runtime.spacer.style.height = `${window.totalHeight}px`;
  runtime.content.style.setProperty('--uxc-row-height', `${rowHeight}px`);
  runtime.content.style.transformOrigin = '0 0';
  runtime.content.style.transform = `translate(${finite(runtime.view.panX)}px,${window.offset + finite(runtime.view.panY)}px) scaleX(${Math.max(.05, finite(runtime.view.zoomX, 1))})`;
  runtime.content.innerHTML = runtime.options.renderRows(runtime.rows.slice(window.start, window.end), {
    start: window.start,
    rowHeight,
    selectedId: runtime.selectedId,
    relatedIds: runtime.relatedIds,
  });
  runtime.surface.setAttribute('aria-rowcount', String(runtime.rows.length));
  runtime.surface.dataset.uxcRenderedRows = String(window.rendered);
  runtime.surface.dataset.uxcMaximumRendered = String(Math.max(Number(runtime.surface.dataset.uxcMaximumRendered || 0), window.rendered));
  runtime.surface.dataset.uxcVirtualTotal = String(runtime.rows.length);
  const empty = runtime.surface.querySelector('[data-uxc-empty-results]');
  if (empty) empty.hidden = runtime.rows.length > 0;
  if (runtime.focusId) runtime.content.querySelector(`[${runtime.options.idAttribute}="${cssValue(runtime.focusId)}"]`)?.focus?.({ preventScroll: true });
}

function scheduleVirtualRender(runtime) {
  if (runtime.frame != null || runtime.destroyed) return;
  runtime.frame = requestAnimationFrame(() => {
    runtime.frame = null;
    renderVirtualRuntime(runtime);
  });
}

function getVirtualScrollAnchor(runtime) {
  const item = runtime.rows[runtime.lastWindow.firstVisible];
  return freeze({
    id: item ? runtime.options.identityFor(item, runtime.lastWindow.firstVisible) : '',
    offset: runtime.logicalScrollTop - runtime.lastWindow.firstVisible * runtime.lastWindow.rowHeight,
  });
}

function revealVirtualIdentity(runtime, id, focus = false) {
  const index = runtime.byId.get(String(id));
  if (!Number.isInteger(index)) return false;
  runtime.logicalScrollTop = universalRevealScrollTop({
    index,
    rowHeight: rowHeightFor(runtime),
    scrollTop: runtime.logicalScrollTop,
    viewportHeight: runtime.surface.clientHeight || 420,
  });
  if (focus) runtime.focusId = String(id);
  renderVirtualRuntime(runtime);
  return true;
}

function applyVirtualScrollAnchor(runtime, anchor = {}) {
  const index = runtime.byId.get(String(anchor.id || ''));
  if (!Number.isInteger(index)) return false;
  runtime.logicalScrollTop = Math.max(0, index * rowHeightFor(runtime) + finite(anchor.offset));
  renderVirtualRuntime(runtime);
  return true;
}

function setVirtualProjection(runtime, nextRows = []) {
  runtime.rows = Array.isArray(nextRows) ? nextRows : [];
  runtime.ids = runtime.rows.map((row, index) => String(runtime.options.identityFor(row, index)));
  runtime.byId = new Map(runtime.ids.map((id, index) => [id, index]));
  const maxScroll = Math.max(0, universalVirtualTotalHeight(runtime.rows.length, rowHeightFor(runtime)) - (runtime.surface.clientHeight || 420));
  runtime.logicalScrollTop = Math.min(runtime.logicalScrollTop, maxScroll);
  return renderVirtualRuntime(runtime);
}

function bindVirtualRuntime(runtime) {
  const { surface, abort, options } = runtime;
  surface.addEventListener('scroll', () => {
    runtime.logicalScrollTop = Math.max(0, finite(surface.scrollTop));
    scheduleVirtualRender(runtime);
  }, { signal: abort.signal, passive: true });
  surface.addEventListener('click', (event) => {
    const row = event.target.closest?.(`[${options.idAttribute}]`);
    if (row) options.onActivate?.(row.getAttribute(options.idAttribute), { focus: false });
  }, { signal: abort.signal });
  surface.addEventListener('keydown', (event) => activateVirtualKeyboardRow(runtime, event), { signal: abort.signal });
}

function activateVirtualKeyboardRow(runtime, event) {
  if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
  const row = event.target.closest?.(`[${runtime.options.idAttribute}]`);
  const currentId = row?.getAttribute(runtime.options.idAttribute) || runtime.selectedId || runtime.ids[0];
  const currentIndex = Math.max(0, runtime.byId.get(currentId) ?? 0);
  const nextIndex = moveUniversalVirtualIndex(currentIndex, event.key, runtime.rows.length);
  const nextId = runtime.ids[nextIndex];
  if (!nextId) return;
  event.preventDefault();
  runtime.focusId = nextId;
  runtime.options.onActivate?.(nextId, { focus: true });
  revealVirtualIdentity(runtime, nextId, true);
}

function destroyVirtualRuntime(runtime) {
  if (runtime.destroyed) return false;
  runtime.destroyed = true;
  runtime.abort.abort();
  if (runtime.frame != null) cancelAnimationFrame(runtime.frame);
  runtime.frame = null;
  runtime.content.replaceChildren();
  return true;
}

export function createUniversalVirtualController(options = {}) {
  const runtime = createVirtualRuntime(options);
  bindVirtualRuntime(runtime);
  return freeze({
    setProjection: (rows) => setVirtualProjection(runtime, rows),
    setSelection(next = {}) {
      runtime.selectedId = String(next.selectedId || '');
      runtime.relatedIds = new Set(next.relatedIds || []);
      return renderVirtualRuntime(runtime);
    },
    setViewTransform(next = {}) {
      runtime.view = { ...runtime.view, ...next };
      return renderVirtualRuntime(runtime);
    },
    reveal: (id, focus) => revealVirtualIdentity(runtime, id, focus),
    applyScrollAnchor: (anchor) => applyVirtualScrollAnchor(runtime, anchor),
    getScrollAnchor: () => getVirtualScrollAnchor(runtime),
    rows: () => runtime.rows,
    ids: () => runtime.ids,
    metrics: () => freeze({ ...runtime.lastWindow, logicalScrollTop: runtime.logicalScrollTop, maximumRendered: Number(runtime.surface.dataset.uxcMaximumRendered || runtime.lastWindow.rendered) }),
    destroy: () => destroyVirtualRuntime(runtime),
  });
}

function cssValue(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

export const _test = freeze({ clamp, virtualRowHeight, surfaceVisible, cssValue });
