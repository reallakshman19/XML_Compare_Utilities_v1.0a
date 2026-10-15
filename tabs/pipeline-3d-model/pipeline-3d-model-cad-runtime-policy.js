export const PIPELINE_CAD_RUNTIME_BUILD = '2026.07.31-popup-reopen-1';
export const PIPELINE_CAD_RENDERER_STORAGE_KEY = 'pipeline3dCadRenderer';
export const PIPELINE_CAD_FALLBACK_STORAGE_KEY = 'pipeline3dCadRendererFallback';
export const PIPELINE_CAD_LEGACY_CANVAS_STORAGE_KEY = 'pipeline3dCadCanvas';
export const PIPELINE_CAD_DIALOG_REOPEN_SESSION_KEY = 'pipeline3dCadDialogReopen';
export const PIPELINE_CAD_RENDERER_CANVAS = 'canvas';
export const PIPELINE_CAD_RENDERER_SVG = 'svg';

const RELOAD_GUARD_SESSION_KEY = 'pipeline3dCadFallbackReloaded';
const RESTORE_OBSERVER_DATA_KEY = 'p3dCadDialogRestoreObserver';
const STYLE_ID = 'pipeline-3d-cad-runtime-policy-style';
const CONTROL_SELECTOR = '[data-p3d-cad-renderer-control]';
const SWITCH_SELECTOR = '[data-p3d-cad-renderer-switch]';
const LAUNCH_SELECTOR = '[data-pipeline-3d-model-launcher] [data-p3d-open="1"]';
const DIALOG_SELECTOR = '.pipeline-3d-model-dialog';
const MESSAGE_ERROR_PATTERN = /PipelineCad|Pipeline CAD Canvas|Table2XCanvas|Table3XCanvas|InteractiveGraph/;
const STACK_ERROR_PATTERN = /\b(?:mountPipelineCadWorkspace|patchDialog|Table2XCanvas|Table3XCanvas|PipelineCadController|InteractiveGraph)\b/;

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

function safeRemove(storage, key) {
  try {
    storage?.removeItem?.(key);
    return true;
  } catch {
    return false;
  }
}

function normalizeRenderer(value) {
  const token = String(value ?? '').trim().toLowerCase();
  if (['svg', 'legacy', 'legacy-svg', 'static'].includes(token)) return PIPELINE_CAD_RENDERER_SVG;
  if (['canvas', 'cad', 'interactive', 'default'].includes(token)) return PIPELINE_CAD_RENDERER_CANVAS;
  return null;
}

function queryRenderer(location = globalThis.location) {
  try {
    const params = new URLSearchParams(location?.search || '');
    const explicit = normalizeRenderer(params.get('pipelineCadRenderer'));
    if (explicit) return explicit;
    if (params.has('pipelineCadCanvas')) {
      const value = String(params.get('pipelineCadCanvas') ?? '').trim().toLowerCase();
      if (['0', 'false', 'off', 'no', 'disabled'].includes(value)) return PIPELINE_CAD_RENDERER_SVG;
      if (['1', 'true', 'on', 'yes', 'enabled'].includes(value)) return PIPELINE_CAD_RENDERER_CANVAS;
    }
  } catch {
    // Invalid or unavailable locations do not override the persisted policy.
  }
  return null;
}

export function resolvePipelineCadRenderer(options = {}) {
  const location = options.location ?? globalThis.location;
  const storage = options.storage ?? globalThis.localStorage;
  const explicit = queryRenderer(location);
  if (explicit) return explicit;
  const stored = normalizeRenderer(safeGet(storage, PIPELINE_CAD_RENDERER_STORAGE_KEY));
  if (stored) return stored;
  const legacyCanvas = String(safeGet(storage, PIPELINE_CAD_LEGACY_CANVAS_STORAGE_KEY) ?? '').toLowerCase();
  if (['1', 'true', 'on', 'yes', 'enabled'].includes(legacyCanvas)) return PIPELINE_CAD_RENDERER_CANVAS;
  return PIPELINE_CAD_RENDERER_CANVAS;
}

export function persistPipelineCadRenderer(renderer, storage = globalThis.localStorage) {
  const normalized = normalizeRenderer(renderer) || PIPELINE_CAD_RENDERER_CANVAS;
  safeSet(storage, PIPELINE_CAD_RENDERER_STORAGE_KEY, normalized);
  if (normalized === PIPELINE_CAD_RENDERER_CANVAS) safeSet(storage, PIPELINE_CAD_LEGACY_CANVAS_STORAGE_KEY, '1');
  else safeRemove(storage, PIPELINE_CAD_LEGACY_CANVAS_STORAGE_KEY);
  return normalized;
}

export function applyPipelineCadRendererPolicy(options = {}) {
  const storage = options.storage ?? globalThis.localStorage;
  const renderer = resolvePipelineCadRenderer(options);
  persistPipelineCadRenderer(renderer, storage);
  return renderer;
}

export function readPipelineCadFallback(storage = globalThis.localStorage) {
  const raw = safeGet(storage, PIPELINE_CAD_FALLBACK_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { reason: String(raw) };
  }
}

export function markPipelineCadDialogReopen(sessionStorage = globalThis.sessionStorage) {
  return safeSet(sessionStorage, PIPELINE_CAD_DIALOG_REOPEN_SESSION_KEY, '1');
}

export function consumePipelineCadDialogReopen(sessionStorage = globalThis.sessionStorage) {
  if (safeGet(sessionStorage, PIPELINE_CAD_DIALOG_REOPEN_SESSION_KEY) !== '1') return false;
  safeRemove(sessionStorage, PIPELINE_CAD_DIALOG_REOPEN_SESSION_KEY);
  return true;
}

function restorePipelineCadDialog(doc, sessionStorage) {
  if (safeGet(sessionStorage, PIPELINE_CAD_DIALOG_REOPEN_SESSION_KEY) !== '1') return false;
  if (doc?.querySelector?.(DIALOG_SELECTOR)) {
    consumePipelineCadDialogReopen(sessionStorage);
    return true;
  }
  const launcher = doc?.querySelector?.(LAUNCH_SELECTOR);
  if (!launcher?.click) return false;
  consumePipelineCadDialogReopen(sessionStorage);
  launcher.click();
  return true;
}

export function installPipelineCadDialogRestore(doc = globalThis.document, options = {}) {
  if (!doc) return null;
  const sessionStorage = options.sessionStorage ?? globalThis.sessionStorage;
  if (restorePipelineCadDialog(doc, sessionStorage)) return null;
  if (safeGet(sessionStorage, PIPELINE_CAD_DIALOG_REOPEN_SESSION_KEY) !== '1') return null;
  if (!doc.body) {
    doc.addEventListener?.('DOMContentLoaded', () => installPipelineCadDialogRestore(doc, options), { once: true });
    return null;
  }
  if (doc.body.dataset?.[RESTORE_OBSERVER_DATA_KEY] === '1') return null;
  const MutationObserverCtor = options.MutationObserver ?? globalThis.MutationObserver;
  if (typeof MutationObserverCtor !== 'function') return null;
  if (doc.body.dataset) doc.body.dataset[RESTORE_OBSERVER_DATA_KEY] = '1';
  const observer = new MutationObserverCtor(() => {
    if (!restorePipelineCadDialog(doc, sessionStorage)) return;
    observer.disconnect();
    if (doc.body?.dataset) delete doc.body.dataset[RESTORE_OBSERVER_DATA_KEY];
  });
  observer.observe(doc.body, { childList: true, subtree: true });
  return observer;
}

export function isPipelineCadRuntimeError(error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error?.message ?? error ?? '');
  const stack = error instanceof Error ? String(error.stack || '') : String(error?.stack || '');
  return MESSAGE_ERROR_PATTERN.test(message) || STACK_ERROR_PATTERN.test(stack);
}

export function handlePipelineCadRuntimeFailure(error, options = {}) {
  if (!isPipelineCadRuntimeError(error)) return false;
  const storage = options.storage ?? globalThis.localStorage;
  const sessionStorage = options.sessionStorage ?? globalThis.sessionStorage;
  const reload = options.reload ?? (() => globalThis.location?.reload?.());
  const message = error instanceof Error ? error.message : String(error?.message ?? error ?? 'Canvas initialization failure');
  persistPipelineCadRenderer(PIPELINE_CAD_RENDERER_SVG, storage);
  safeSet(storage, PIPELINE_CAD_FALLBACK_STORAGE_KEY, JSON.stringify({
    renderer: PIPELINE_CAD_RENDERER_SVG,
    reason: message,
    build: PIPELINE_CAD_RUNTIME_BUILD,
    recordedAt: new Date().toISOString(),
  }));
  const alreadyReloaded = safeGet(sessionStorage, RELOAD_GUARD_SESSION_KEY) === '1';
  if (!alreadyReloaded) {
    safeSet(sessionStorage, RELOAD_GUARD_SESSION_KEY, '1');
    reload?.();
  }
  return true;
}

export function requestPipelineCadRenderer(renderer, options = {}) {
  const storage = options.storage ?? globalThis.localStorage;
  const sessionStorage = options.sessionStorage ?? globalThis.sessionStorage;
  const location = options.location ?? globalThis.location;
  const normalized = persistPipelineCadRenderer(renderer, storage);
  safeRemove(storage, PIPELINE_CAD_FALLBACK_STORAGE_KEY);
  safeRemove(sessionStorage, RELOAD_GUARD_SESSION_KEY);
  if (options.reopenDialog === true) markPipelineCadDialogReopen(sessionStorage);
  try {
    const url = new URL(location?.href || globalThis.location?.href || 'http://localhost/');
    url.searchParams.delete('pipelineCadRenderer');
    url.searchParams.delete('pipelineCadCanvas');
    if (typeof options.navigate === 'function') options.navigate(url.toString());
    else if (typeof location?.assign === 'function') location.assign(url.toString());
    else location?.reload?.();
  } catch {
    location?.reload?.();
  }
  return normalized;
}

function ensureStyle(doc = globalThis.document) {
  if (!doc?.head || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.p3d-cad-renderer-host{position:relative!important}
.p3d-cad-renderer-control{position:absolute;z-index:40;left:12px;bottom:10px;display:flex;align-items:center;gap:8px;max-width:calc(100% - 24px);padding:6px 8px;border:1px solid rgba(148,163,184,.42);border-radius:7px;background:rgba(2,6,23,.92);color:#cbd5e1;font:10px ui-monospace,monospace;box-shadow:0 6px 18px rgba(0,0,0,.32)}
.p3d-cad-renderer-control button{border:1px solid rgba(125,211,252,.55);border-radius:5px;background:#0c4a6e;color:#e0f2fe;padding:4px 7px;font:10px ui-monospace,monospace;cursor:pointer}
.p3d-cad-renderer-control[data-renderer="svg"]{border-color:rgba(251,146,60,.58)}
.p3d-cad-renderer-control[data-renderer="svg"] button{background:#7c2d12;border-color:#fb923c;color:#ffedd5}
`;
  doc.head.appendChild(style);
}

function statusPrefix() {
  return `Renderer: Canvas · ${PIPELINE_CAD_RUNTIME_BUILD}`;
}

function stampCanvasStatuses(dialog) {
  dialog?.querySelectorAll?.('[data-p3d-cad-status]').forEach((status) => {
    const prefix = statusPrefix();
    const current = String(status.textContent || '').trim();
    if (!current.startsWith(prefix)) status.textContent = current ? `${prefix} · ${current}` : prefix;
  });
}

function installRendererControl(dialog, options = {}) {
  if (!dialog?.querySelector) return null;
  const doc = dialog.ownerDocument || globalThis.document;
  ensureStyle(doc);
  const renderer = resolvePipelineCadRenderer(options);
  const fallback = readPipelineCadFallback(options.storage ?? globalThis.localStorage);
  const host = dialog.querySelector('[data-p3d-split="x-modal"]') || dialog;
  host.classList?.add('p3d-cad-renderer-host');
  let control = host.querySelector?.(CONTROL_SELECTOR);
  if (!control) {
    control = doc.createElement('div');
    control.dataset.p3dCadRendererControl = '1';
    control.innerHTML = '<span data-p3d-cad-renderer-label></span><button type="button" data-p3d-cad-renderer-switch></button>';
    host.appendChild(control);
    control.querySelector(SWITCH_SELECTOR)?.addEventListener('click', () => {
      const current = resolvePipelineCadRenderer(options);
      const next = current === PIPELINE_CAD_RENDERER_CANVAS ? PIPELINE_CAD_RENDERER_SVG : PIPELINE_CAD_RENDERER_CANVAS;
      requestPipelineCadRenderer(next, { ...options, reopenDialog: true });
    });
  }
  control.dataset.renderer = renderer;
  const label = control.querySelector('[data-p3d-cad-renderer-label]');
  const button = control.querySelector(SWITCH_SELECTOR);
  if (label) {
    const base = renderer === PIPELINE_CAD_RENDERER_CANVAS ? 'Renderer: CAD Canvas' : 'Renderer: Legacy SVG';
    const nextLabel = fallback?.reason && renderer === PIPELINE_CAD_RENDERER_SVG
      ? `${base} · auto-fallback · ${PIPELINE_CAD_RUNTIME_BUILD}`
      : `${base} · ${PIPELINE_CAD_RUNTIME_BUILD}`;
    if (label.textContent !== nextLabel) label.textContent = nextLabel;
    if (fallback?.reason && renderer === PIPELINE_CAD_RENDERER_SVG) label.title = fallback.reason;
    else label.removeAttribute('title');
  }
  if (button) {
    const nextButton = renderer === PIPELINE_CAD_RENDERER_CANVAS ? 'Use Legacy SVG' : 'Use CAD Canvas';
    if (button.textContent !== nextButton) button.textContent = nextButton;
  }
  stampCanvasStatuses(dialog);
  return control;
}

export function installPipelineCadRendererControls(doc = globalThis.document, options = {}) {
  if (!doc?.body) return null;
  ensureStyle(doc);
  const patchAll = () => doc.querySelectorAll(DIALOG_SELECTOR).forEach((dialog) => installRendererControl(dialog, options));
  patchAll();
  if (doc.body.dataset.p3dCadRendererObserver === '1') return null;
  doc.body.dataset.p3dCadRendererObserver = '1';
  const MutationObserverCtor = globalThis.MutationObserver;
  if (typeof MutationObserverCtor !== 'function') return null;
  const observer = new MutationObserverCtor(patchAll);
  observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
  return observer;
}

export function installPipelineCadRuntimeFailureGuard(target = globalThis, options = {}) {
  if (!target?.addEventListener || target.__pipelineCadRuntimeFailureGuard === true) return false;
  target.__pipelineCadRuntimeFailureGuard = true;
  target.addEventListener('error', (event) => handlePipelineCadRuntimeFailure(event?.error || event?.message, options));
  target.addEventListener('unhandledrejection', (event) => handlePipelineCadRuntimeFailure(event?.reason, options));
  return true;
}

if (globalThis.document) {
  installPipelineCadRuntimeFailureGuard(globalThis);
  applyPipelineCadRendererPolicy();
  installPipelineCadDialogRestore(globalThis.document);
  if (globalThis.document.body) installPipelineCadRendererControls(globalThis.document);
  else globalThis.document.addEventListener('DOMContentLoaded', () => installPipelineCadRendererControls(globalThis.document), { once: true });
}
