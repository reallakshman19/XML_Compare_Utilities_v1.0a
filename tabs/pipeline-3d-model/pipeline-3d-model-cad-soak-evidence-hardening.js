import {
  PIPELINE_CAD_SOAK_STORAGE_KEY,
  createPipelineCadSoakAudit,
  downloadPipelineCadDiagnostics,
  normalizePipelineCadSoakLedger,
  readPipelineCadSoakLedger,
  writePipelineCadSoakLedger,
} from './pipeline-3d-model-cad-soak-evidence.js';

const BASE_INSTALL_STATE = Symbol.for('pipeline3d.cad.soak.install-state.v1');
const HARDENING_STATE = Symbol.for('pipeline3d.cad.soak.control-hardening.state.v1');
const CONTROL_SELECTOR = '[data-p3d-cad-renderer-control]';
const CHANGE_EVENT = 'pipeline-cad-soak-evidence-changed';

function stateFor(target = globalThis) {
  if (!target[HARDENING_STATE]) {
    Object.defineProperty(target, HARDENING_STATE, {
      configurable: true,
      value: {
        installed: false,
        observer: null,
        onChange: null,
      },
    });
  }
  return target[HARDENING_STATE];
}

function compactText(value, limit = 180) {
  return String(value ?? '')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, limit);
}

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function renderer(value) {
  return String(value || '').toLowerCase() === 'svg' ? 'svg' : 'canvas';
}

function sanitizeFallback(detail = {}) {
  return {
    renderer: renderer(detail.renderer),
    reason: compactText(detail.reason, 180),
    build: compactText(detail.build, 80),
    recordedAt: compactText(detail.recordedAt, 40),
  };
}

export function sanitizePipelineCadSoakEvent(type, detail = {}) {
  switch (type) {
    case 'session-start':
      return {
        renderer: renderer(detail.renderer),
        runtimeBuild: compactText(detail.runtimeBuild, 80),
        evidenceBuild: compactText(detail.evidenceBuild, 80),
        devicePixelRatio: Math.max(1, Number(detail.devicePixelRatio) || 1),
        viewportWidth: count(detail.viewportWidth),
        viewportHeight: count(detail.viewportHeight),
        language: compactText(detail.language, 24),
      };
    case 'workspace-mounted':
      return {
        renderer: renderer(detail.renderer),
        table2Rows: count(detail.table2Rows),
        table3LengthRows: count(detail.table3LengthRows),
        table3DepthRows: count(detail.table3DepthRows),
        table3MarkerRows: count(detail.table3MarkerRows),
      };
    case 'workspace-destroyed':
    case 'session-end':
      return { reason: compactText(detail.reason, 80) };
    case 'automatic-fallback':
      return sanitizeFallback(detail);
    case 'runtime-error':
      return {
        name: compactText(detail.name || 'Error', 80),
        message: compactText(detail.message, 180),
      };
    case 'validation-error':
      return {
        name: compactText(detail.name || 'ValidationError', 80),
        firstCode: compactText(detail.firstCode, 100),
        errors: count(detail.errors),
        warnings: count(detail.warnings),
      };
    case 'command-rejected':
      return {
        reason: compactText(detail.reason, 100),
        name: compactText(detail.name || 'Error', 80),
        message: compactText(detail.message, 180),
      };
    case 'history-reset':
      return {
        reason: compactText(detail.reason, 100),
        discardedUndoCount: count(detail.discardedUndoCount),
        discardedRedoCount: count(detail.discardedRedoCount),
      };
    case 'interaction-cancelled':
      return {
        graph: compactText(detail.graph, 40),
        reason: compactText(detail.reason, 100),
        commit: false,
      };
    case 'command-committed':
      return { reason: compactText(detail.reason, 100) };
    case 'diagnostics-exported':
      return { verdict: compactText(detail.verdict, 60) };
    default:
      return {};
  }
}

export function sanitizePipelineCadSoakLedger(value, options = {}) {
  const ledger = normalizePipelineCadSoakLedger(value, options);
  ledger.sessions = ledger.sessions.map((session) => ({
    ...session,
    events: session.events.map((event) => ({
      type: compactText(event.type, 60) || 'unknown',
      recordedAt: compactText(event.recordedAt, 40),
      detail: sanitizePipelineCadSoakEvent(event.type, event.detail),
    })),
  }));
  return ledger;
}

export function sanitizePipelineCadSoakStorage(storage = globalThis.localStorage, options = {}) {
  let parsed = null;
  try {
    const raw = storage?.getItem?.(PIPELINE_CAD_SOAK_STORAGE_KEY);
    parsed = raw ? JSON.parse(raw) : readPipelineCadSoakLedger(storage, options);
  } catch {
    parsed = readPipelineCadSoakLedger(storage, options);
  }
  const sanitized = sanitizePipelineCadSoakLedger(parsed, options);
  return writePipelineCadSoakLedger(sanitized, storage, options);
}

function statusText(audit) {
  if (audit.verdict === 'READY') {
    return `Soak: READY · ${audit.progress.successfulCanvasSessions}/${audit.progress.requiredCanvasSessions} clean sessions`;
  }
  if (audit.verdict === 'BLOCKED') {
    return `Soak: BLOCKED · ${audit.blockers.length} blocker${audit.blockers.length === 1 ? '' : 's'}`;
  }
  return `Soak: ${audit.progress.successfulCanvasSessions}/${audit.progress.requiredCanvasSessions} clean sessions`;
}

function replaceDownloadButton(control, options = {}) {
  const doc = control.ownerDocument || globalThis.document;
  let button = control.querySelector('[data-p3d-cad-diagnostics-download]');
  if (!button) {
    button = doc.createElement('button');
    button.type = 'button';
    button.dataset.p3dCadDiagnosticsDownload = '1';
    button.textContent = 'Download CAD Diagnostics';
    control.appendChild(button);
  }
  if (button.dataset.p3dCadDiagnosticsHardened === '1') return button;

  const hardened = button.cloneNode(true);
  hardened.dataset.p3dCadDiagnosticsHardened = '1';
  button.replaceWith(hardened);
  hardened.addEventListener('click', () => {
    sanitizePipelineCadSoakStorage(options.storage ?? globalThis.localStorage, options);
    downloadPipelineCadDiagnostics({ ...options, document: doc });
  });
  return hardened;
}

function patchControl(control, options = {}) {
  if (!control?.querySelector) return null;
  const doc = control.ownerDocument || globalThis.document;
  const storage = options.storage ?? globalThis.localStorage;
  const ledger = sanitizePipelineCadSoakStorage(storage, options);
  const audit = createPipelineCadSoakAudit(ledger, options);

  let status = control.querySelector('[data-p3d-cad-soak-status]');
  if (!status) {
    status = doc.createElement('span');
    status.className = 'p3d-cad-soak-status';
    status.dataset.p3dCadSoakStatus = '1';
    control.appendChild(status);
  }
  const nextText = statusText(audit);
  const nextTitle = audit.blockers.map((blocker) => blocker.message).join('\n');
  if (status.dataset.verdict !== audit.verdict) status.dataset.verdict = audit.verdict;
  if (status.textContent !== nextText) status.textContent = nextText;
  if (status.title !== nextTitle) status.title = nextTitle;
  replaceDownloadButton(control, options);
  return { status, audit };
}

export function installPipelineCadSoakControlHardening(doc = globalThis.document, options = {}) {
  if (!doc?.body) return null;
  const state = stateFor(globalThis);
  if (state.installed) return state.observer;
  state.installed = true;

  const baseState = globalThis[BASE_INSTALL_STATE];
  baseState?.controlsObserver?.disconnect?.();
  if (baseState) baseState.controlsObserver = null;

  const patchAll = () => doc.querySelectorAll(CONTROL_SELECTOR).forEach((control) => patchControl(control, options));
  patchAll();
  state.onChange = patchAll;
  doc.addEventListener(CHANGE_EVENT, patchAll);

  const MutationObserverCtor = globalThis.MutationObserver;
  if (typeof MutationObserverCtor === 'function') {
    state.observer = new MutationObserverCtor(() => patchAll());
    state.observer.observe(doc.body, { childList: true, subtree: true });
    if (baseState) baseState.controlsObserver = state.observer;
  }
  return state.observer;
}

export function uninstallPipelineCadSoakControlHardening(doc = globalThis.document) {
  const state = stateFor(globalThis);
  state.observer?.disconnect?.();
  if (state.onChange) doc?.removeEventListener?.(CHANGE_EVENT, state.onChange);
  state.observer = null;
  state.onChange = null;
  state.installed = false;
  const baseState = globalThis[BASE_INSTALL_STATE];
  if (baseState) baseState.controlsObserver = null;
  return true;
}

sanitizePipelineCadSoakStorage(globalThis.localStorage);
if (globalThis.document?.body) installPipelineCadSoakControlHardening(globalThis.document);
else globalThis.document?.addEventListener?.('DOMContentLoaded', () => installPipelineCadSoakControlHardening(globalThis.document), { once: true });
