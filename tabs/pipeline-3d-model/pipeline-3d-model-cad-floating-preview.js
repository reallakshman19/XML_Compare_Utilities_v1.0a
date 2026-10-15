export const PIPELINE_CAD_FLOATING_PREVIEW_BUILD = '2026.07.13-floating-preview-1';
export const PIPELINE_CAD_FLOATING_PREVIEW_STORAGE_KEY = 'pipeline3dCadFloatingPreviewV1';
export const PIPELINE_CAD_FLOATING_PREVIEW_Z_INDEX = 2147483000;

const STYLE_ID = 'pipeline-3d-cad-floating-preview-style';
const PANEL_SELECTOR = '[data-p3d-split="x-modal"]';
const PATCHED = Symbol.for('pipeline3d.cad.floating-preview.patched.v1');
const STATE = Symbol.for('pipeline3d.cad.floating-preview.state.v1');
const INSTALL_STATE = Symbol.for('pipeline3d.cad.floating-preview.install-state.v1');
const VIEWPORT_MARGIN = 12;
const MIN_WIDTH = 560;
const MIN_HEIGHT = 380;
const DEFAULT_MAX_WIDTH = 1120;
const DEFAULT_MAX_HEIGHT = 820;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function viewportSize(viewport = globalThis) {
  return {
    width: Math.max(320, finite(viewport?.innerWidth ?? viewport?.width, 1440)),
    height: Math.max(240, finite(viewport?.innerHeight ?? viewport?.height, 900)),
  };
}

export function getPipelineCadFloatingPreviewDefaultRect(viewport = globalThis) {
  const size = viewportSize(viewport);
  const availableWidth = Math.max(280, size.width - (VIEWPORT_MARGIN * 2));
  const availableHeight = Math.max(220, size.height - (VIEWPORT_MARGIN * 2));
  const width = Math.min(DEFAULT_MAX_WIDTH, Math.max(Math.min(MIN_WIDTH, availableWidth), Math.round(size.width * 0.72)), availableWidth);
  const height = Math.min(DEFAULT_MAX_HEIGHT, Math.max(Math.min(MIN_HEIGHT, availableHeight), Math.round(size.height * 0.78)), availableHeight);
  return Object.freeze({
    left: Math.round(clamp(size.width - width - 28, VIEWPORT_MARGIN, size.width - width - VIEWPORT_MARGIN)),
    top: Math.round(clamp(36, VIEWPORT_MARGIN, size.height - height - VIEWPORT_MARGIN)),
    width: Math.round(width),
    height: Math.round(height),
  });
}

export function clampPipelineCadFloatingPreviewRect(rect = {}, viewport = globalThis) {
  const size = viewportSize(viewport);
  const availableWidth = Math.max(280, size.width - (VIEWPORT_MARGIN * 2));
  const availableHeight = Math.max(220, size.height - (VIEWPORT_MARGIN * 2));
  const fallback = getPipelineCadFloatingPreviewDefaultRect(size);
  const minimumWidth = Math.min(MIN_WIDTH, availableWidth);
  const minimumHeight = Math.min(MIN_HEIGHT, availableHeight);
  const width = clamp(finite(rect.width, fallback.width), minimumWidth, availableWidth);
  const height = clamp(finite(rect.height, fallback.height), minimumHeight, availableHeight);
  const left = clamp(finite(rect.left, fallback.left), VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, size.width - width - VIEWPORT_MARGIN));
  const top = clamp(finite(rect.top, fallback.top), VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, size.height - height - VIEWPORT_MARGIN));
  return Object.freeze({
    left: Math.round(left),
    top: Math.round(top),
    width: Math.round(width),
    height: Math.round(height),
  });
}

function safeGet(storage, key) {
  try {
    return storage?.getItem?.(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(storage, key, value) {
  try {
    storage?.setItem?.(key, value);
    return true;
  } catch {
    return false;
  }
}

export function readPipelineCadFloatingPreviewRect(storage = globalThis.localStorage, viewport = globalThis) {
  const raw = safeGet(storage, PIPELINE_CAD_FLOATING_PREVIEW_STORAGE_KEY);
  if (!raw) return getPipelineCadFloatingPreviewDefaultRect(viewport);
  try {
    return clampPipelineCadFloatingPreviewRect(JSON.parse(raw), viewport);
  } catch {
    return getPipelineCadFloatingPreviewDefaultRect(viewport);
  }
}

export function persistPipelineCadFloatingPreviewRect(rect, storage = globalThis.localStorage, viewport = globalThis) {
  const normalized = clampPipelineCadFloatingPreviewRect(rect, viewport);
  safeSet(storage, PIPELINE_CAD_FLOATING_PREVIEW_STORAGE_KEY, JSON.stringify({
    schema: 'PipelineCadFloatingPreviewRect.v1',
    build: PIPELINE_CAD_FLOATING_PREVIEW_BUILD,
    ...normalized,
  }));
  return normalized;
}

function ensureStyle(doc = globalThis.document) {
  if (!doc?.head || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
${PANEL_SELECTOR}[data-p3d-floating-preview="1"]{
  position:fixed!important;
  inset:auto!important;
  z-index:${PIPELINE_CAD_FLOATING_PREVIEW_Z_INDEX}!important;
  display:none;
  flex-direction:column!important;
  padding:0!important;
  box-sizing:border-box!important;
  min-width:min(${MIN_WIDTH}px,calc(100vw - ${VIEWPORT_MARGIN * 2}px))!important;
  min-height:min(${MIN_HEIGHT}px,calc(100vh - ${VIEWPORT_MARGIN * 2}px))!important;
  max-width:calc(100vw - ${VIEWPORT_MARGIN * 2}px)!important;
  max-height:calc(100vh - ${VIEWPORT_MARGIN * 2}px)!important;
  overflow:hidden!important;
  resize:both;
  border:1px solid rgba(125,211,252,.62)!important;
  border-radius:12px!important;
  background:#07111f!important;
  color:#e2e8f0!important;
  box-shadow:0 24px 80px rgba(0,0,0,.68),0 0 0 1px rgba(14,165,233,.12)!important;
  isolation:isolate;
  contain:layout paint style;
  pointer-events:auto;
}
${PANEL_SELECTOR}[data-p3d-floating-preview="1"][style*="display: flex"],
${PANEL_SELECTOR}[data-p3d-floating-preview="1"][style*="display:flex"]{display:flex!important}
${PANEL_SELECTOR}[data-p3d-floating-preview="1"] .p3d-x-modal-head{
  flex:0 0 auto;
  margin:0!important;
  padding:9px 12px!important;
  min-height:48px;
  cursor:move;
  user-select:none;
  touch-action:none;
  background:linear-gradient(180deg,#12243a 0%,#0b1728 100%);
  border-bottom:1px solid rgba(125,211,252,.28)!important;
}
${PANEL_SELECTOR}[data-p3d-floating-preview="1"] .p3d-x-modal-head:focus-visible{
  outline:2px solid #38bdf8;
  outline-offset:-3px;
}
${PANEL_SELECTOR}[data-p3d-floating-preview="1"] .p3d-x-modal-head button{cursor:pointer}
${PANEL_SELECTOR}[data-p3d-floating-preview="1"] .p3d-floating-preview-hint{
  color:#94a3b8;
  font:10px ui-monospace,monospace;
  white-space:nowrap;
}
${PANEL_SELECTOR}[data-p3d-floating-preview="1"] .p3d-x-tabs{
  flex:0 0 auto;
  margin:8px 12px!important;
}
${PANEL_SELECTOR}[data-p3d-floating-preview="1"] .p3d-x-content{
  flex:1 1 auto;
  min-height:0!important;
  margin:0 12px 48px;
  border:1px solid rgba(148,163,184,.18);
  border-radius:8px;
  background:#020617;
}
${PANEL_SELECTOR}[data-p3d-floating-preview="1"] .p3d-cad-renderer-control{
  left:12px!important;
  right:12px!important;
  bottom:8px!important;
  max-width:none!important;
  overflow-x:auto;
}
${PANEL_SELECTOR}[data-p3d-floating-preview="1"]::after{
  content:'↘';
  position:absolute;
  right:3px;
  bottom:1px;
  color:#7dd3fc;
  font:14px system-ui,sans-serif;
  pointer-events:none;
  opacity:.8;
}
`;
  doc.head.appendChild(style);
}

function panelRect(panel) {
  const bounds = panel.getBoundingClientRect?.();
  return {
    left: finite(parseFloat(panel.style.left), bounds?.left),
    top: finite(parseFloat(panel.style.top), bounds?.top),
    width: finite(parseFloat(panel.style.width), bounds?.width),
    height: finite(parseFloat(panel.style.height), bounds?.height),
  };
}

function applyRect(panel, rect, viewport = globalThis) {
  const normalized = clampPipelineCadFloatingPreviewRect(rect, viewport);
  panel.style.setProperty('left', `${normalized.left}px`, 'important');
  panel.style.setProperty('top', `${normalized.top}px`, 'important');
  panel.style.setProperty('right', 'auto', 'important');
  panel.style.setProperty('bottom', 'auto', 'important');
  panel.style.setProperty('width', `${normalized.width}px`, 'important');
  panel.style.setProperty('height', `${normalized.height}px`, 'important');
  panel.style.setProperty('z-index', String(PIPELINE_CAD_FLOATING_PREVIEW_Z_INDEX), 'important');
  return normalized;
}

function addHeaderAffordances(panel, head, doc) {
  const title = head.querySelector('h3');
  if (title && !title.id) title.id = `pipeline-cad-floating-preview-title-${Math.random().toString(36).slice(2, 9)}`;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  if (title?.id) panel.setAttribute('aria-labelledby', title.id);
  panel.setAttribute('aria-description', 'Movable and resizable Table 2X and Table 3X preview window.');
  head.dataset.p3dFloatingPreviewHandle = '1';
  head.tabIndex = 0;
  head.setAttribute('aria-label', 'Move Table 2X and Table 3X preview window. Use arrow keys to move and Shift plus arrow keys for larger steps.');

  const group = head.querySelector('div') || head;
  if (!group.querySelector('[data-p3d-floating-preview-hint]')) {
    const hint = doc.createElement('span');
    hint.className = 'p3d-floating-preview-hint';
    hint.dataset.p3dFloatingPreviewHint = '1';
    hint.textContent = 'Drag title bar · Resize ↘';
    group.appendChild(hint);
  }
  let reset = group.querySelector('[data-p3d-floating-preview-reset]');
  if (!reset) {
    reset = doc.createElement('button');
    reset.type = 'button';
    reset.dataset.p3dFloatingPreviewReset = '1';
    reset.textContent = 'Reset Window';
    reset.title = 'Restore the default floating-window position and size';
    reset.style.cssText = 'background:#1e293b;color:#e2e8f0;border:1px solid rgba(148,163,184,.4);border-radius:4px;padding:4px 9px;font-size:11px;cursor:pointer;';
    group.appendChild(reset);
  }
  return reset;
}

function eventTargetsControl(event, head) {
  const target = event.target instanceof Element ? event.target : null;
  return Boolean(target && target !== head && target.closest('button,a,input,select,textarea,[role="button"]'));
}

export function patchPipelineCadFloatingPreview(panel, options = {}) {
  if (!panel || panel[PATCHED]) return panel?.[STATE] ?? null;
  Object.defineProperty(panel, PATCHED, { value: true });
  panel.dataset.p3dFloatingPreview = '1';
  panel.dataset.p3dFloatingPreviewBuild = PIPELINE_CAD_FLOATING_PREVIEW_BUILD;
  const doc = panel.ownerDocument || options.document || globalThis.document;
  const target = options.target || doc?.defaultView || globalThis;
  const storage = options.storage || target?.localStorage || globalThis.localStorage;
  ensureStyle(doc);
  const head = panel.querySelector('.p3d-x-modal-head');
  if (!head) return null;
  const reset = addHeaderAffordances(panel, head, doc);
  const state = {
    panel,
    head,
    target,
    storage,
    dragging: null,
    resizeObserver: null,
    persistTimer: null,
    cleanup: [],
  };
  Object.defineProperty(panel, STATE, { value: state });

  applyRect(panel, readPipelineCadFloatingPreviewRect(storage, target), target);

  const persist = () => persistPipelineCadFloatingPreviewRect(panelRect(panel), storage, target);
  const schedulePersist = () => {
    target.clearTimeout?.(state.persistTimer);
    state.persistTimer = target.setTimeout?.(persist, 80);
  };

  const finishDrag = (event, cancelled = false) => {
    if (!state.dragging) return;
    try { head.releasePointerCapture?.(state.dragging.pointerId); } catch { /* capture may already be lost */ }
    if (cancelled) applyRect(panel, state.dragging.startRect, target);
    else applyRect(panel, panelRect(panel), target);
    state.dragging = null;
    panel.removeAttribute('data-p3d-floating-preview-dragging');
    persist();
    event?.preventDefault?.();
  };

  const onPointerDown = (event) => {
    if (event.button !== 0 || eventTargetsControl(event, head)) return;
    const startRect = clampPipelineCadFloatingPreviewRect(panelRect(panel), target);
    state.dragging = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      startRect,
    };
    panel.dataset.p3dFloatingPreviewDragging = '1';
    head.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };
  const onPointerMove = (event) => {
    if (!state.dragging || event.pointerId !== state.dragging.pointerId) return;
    applyRect(panel, {
      ...state.dragging.startRect,
      left: state.dragging.startRect.left + (event.clientX - state.dragging.clientX),
      top: state.dragging.startRect.top + (event.clientY - state.dragging.clientY),
    }, target);
    event.preventDefault();
  };
  const onPointerUp = (event) => finishDrag(event, false);
  const onPointerCancel = (event) => finishDrag(event, true);
  const onKeyDown = (event) => {
    if (event.target !== head) return;
    const direction = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[event.key];
    if (!direction) return;
    const step = event.shiftKey ? 32 : 8;
    const rect = panelRect(panel);
    applyRect(panel, {
      ...rect,
      left: rect.left + (direction[0] * step),
      top: rect.top + (direction[1] * step),
    }, target);
    persist();
    event.preventDefault();
  };
  const resetWindow = () => {
    const rect = applyRect(panel, getPipelineCadFloatingPreviewDefaultRect(target), target);
    persistPipelineCadFloatingPreviewRect(rect, storage, target);
    head.focus?.();
  };
  const onViewportResize = () => {
    if (!panel.isConnected) {
      target.removeEventListener?.('resize', onViewportResize);
      state.resizeObserver?.disconnect?.();
      return;
    }
    const rect = applyRect(panel, panelRect(panel), target);
    persistPipelineCadFloatingPreviewRect(rect, storage, target);
  };

  head.addEventListener('pointerdown', onPointerDown);
  head.addEventListener('pointermove', onPointerMove);
  head.addEventListener('pointerup', onPointerUp);
  head.addEventListener('pointercancel', onPointerCancel);
  head.addEventListener('lostpointercapture', (event) => finishDrag(event, false));
  head.addEventListener('keydown', onKeyDown);
  head.addEventListener('dblclick', (event) => {
    if (!eventTargetsControl(event, head)) resetWindow();
  });
  reset.addEventListener('click', resetWindow);
  target.addEventListener?.('resize', onViewportResize);

  const ResizeObserverCtor = target.ResizeObserver || globalThis.ResizeObserver;
  if (typeof ResizeObserverCtor === 'function') {
    state.resizeObserver = new ResizeObserverCtor(() => {
      if (!state.dragging && panel.style.display !== 'none') schedulePersist();
    });
    state.resizeObserver.observe(panel);
  }

  state.cleanup.push(
    () => head.removeEventListener('pointerdown', onPointerDown),
    () => head.removeEventListener('pointermove', onPointerMove),
    () => head.removeEventListener('pointerup', onPointerUp),
    () => head.removeEventListener('pointercancel', onPointerCancel),
    () => head.removeEventListener('keydown', onKeyDown),
    () => reset.removeEventListener('click', resetWindow),
    () => target.removeEventListener?.('resize', onViewportResize),
    () => state.resizeObserver?.disconnect?.(),
  );
  return state;
}

export function installPipelineCadFloatingPreview(doc = globalThis.document, options = {}) {
  if (!doc?.body) return null;
  ensureStyle(doc);
  const target = options.target || doc.defaultView || globalThis;
  const installState = target[INSTALL_STATE] || { observer: null };
  if (!target[INSTALL_STATE]) Object.defineProperty(target, INSTALL_STATE, { configurable: true, value: installState });
  const patchAll = () => doc.querySelectorAll(PANEL_SELECTOR).forEach((panel) => patchPipelineCadFloatingPreview(panel, { ...options, document: doc, target }));
  patchAll();
  if (installState.observer) return installState.observer;
  const MutationObserverCtor = target.MutationObserver || globalThis.MutationObserver;
  if (typeof MutationObserverCtor !== 'function') return null;
  installState.observer = new MutationObserverCtor(patchAll);
  installState.observer.observe(doc.body, { childList: true, subtree: true });
  return installState.observer;
}

if (globalThis.document?.body) installPipelineCadFloatingPreview(globalThis.document);
else globalThis.document?.addEventListener?.('DOMContentLoaded', () => installPipelineCadFloatingPreview(globalThis.document), { once: true });
