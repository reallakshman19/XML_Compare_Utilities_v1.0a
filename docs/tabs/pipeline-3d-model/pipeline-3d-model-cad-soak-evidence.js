import {
  PIPELINE_CAD_FALLBACK_STORAGE_KEY,
  PIPELINE_CAD_RENDERER_CANVAS,
  PIPELINE_CAD_RUNTIME_BUILD,
  isPipelineCadRuntimeError,
  readPipelineCadFallback,
  resolvePipelineCadRenderer,
} from './pipeline-3d-model-cad-runtime-policy.js';
import { PipelineCadController } from './pipeline-3d-model-cad-controller.js';
import { getPipelineCadLifecycleStats } from './pipeline-3d-model-cad-lifecycle-performance.js';

export const PIPELINE_CAD_SOAK_LEDGER_SCHEMA = 'PipelineCadSoakLedger.v1';
export const PIPELINE_CAD_SOAK_AUDIT_SCHEMA = 'PipelineCadSoakAudit.v1';
export const PIPELINE_CAD_DIAGNOSTICS_SCHEMA = 'PipelineCadDiagnosticsBundle.v1';
export const PIPELINE_CAD_SOAK_BUILD = '2026.07.13-cad-soak-1';
export const PIPELINE_CAD_SOAK_STORAGE_KEY = 'pipeline3dCadSoakLedgerV1';
export const PIPELINE_CAD_SOAK_SESSION_KEY = 'pipeline3dCadSoakSessionV1';
export const PIPELINE_CAD_SOAK_MAX_SESSIONS = 20;
export const PIPELINE_CAD_SOAK_MAX_EVENTS = 60;

const CONTROLLER_PATCH = Symbol.for('pipeline3d.cad.soak.controller.patch.v1');
const CONTROLLER_BOUND = Symbol.for('pipeline3d.cad.soak.controller.bound.v1');
const CONTROLLER_CLEANUP = Symbol.for('pipeline3d.cad.soak.controller.cleanup.v1');
const INSTALL_STATE = Symbol.for('pipeline3d.cad.soak.install-state.v1');
const STYLE_ID = 'pipeline-3d-cad-soak-evidence-style';
const CONTROL_SELECTOR = '[data-p3d-cad-renderer-control]';
const EVENT_CHANGE = 'pipeline-cad-soak-evidence-changed';

const DEFAULT_POLICY = Object.freeze({
  minimumCanvasSessions: 3,
  minimumSuccessfulMounts: 3,
  maximumFallbacks: 0,
  maximumRuntimeErrors: 0,
});

function sharedInstallState() {
  if (!globalThis[INSTALL_STATE]) {
    Object.defineProperty(globalThis, INSTALL_STATE, {
      configurable: true,
      value: {
        installed: false,
        runtimeListenersInstalled: false,
        controlsObserver: null,
        pageLifecycleInstalled: false,
      },
    });
  }
  return globalThis[INSTALL_STATE];
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegativeInteger(value) {
  return Math.max(0, Math.floor(finite(value, 0)));
}

function nowIso(options = {}) {
  const value = typeof options.now === 'function' ? options.now() : options.now;
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
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

function safeRemove(storage, key) {
  try {
    storage?.removeItem?.(key);
    return true;
  } catch {
    return false;
  }
}

function compactText(value, limit = 180) {
  return String(value ?? '')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, limit);
}

function normalizeRenderer(value) {
  return String(value || '').toLowerCase() === 'svg' ? 'svg' : PIPELINE_CAD_RENDERER_CANVAS;
}

function createCounters() {
  return {
    mounts: 0,
    unmounts: 0,
    runtimeErrors: 0,
    fallbacks: 0,
    validationErrors: 0,
    commandRejections: 0,
    historyResets: 0,
    interactionCancellations: 0,
    committedCommands: 0,
    diagnosticsExports: 0,
  };
}

function normalizeCounters(value = {}) {
  const next = createCounters();
  Object.keys(next).forEach((key) => { next[key] = nonNegativeInteger(value?.[key]); });
  return next;
}

function emptyLedger(timestamp = new Date().toISOString()) {
  return {
    schema: PIPELINE_CAD_SOAK_LEDGER_SCHEMA,
    build: PIPELINE_CAD_SOAK_BUILD,
    createdAt: timestamp,
    updatedAt: timestamp,
    sessions: [],
  };
}

function normalizeEvent(event = {}) {
  return {
    type: compactText(event.type, 60) || 'unknown',
    recordedAt: compactText(event.recordedAt, 40) || new Date().toISOString(),
    detail: event.detail && typeof event.detail === 'object' ? { ...event.detail } : {},
  };
}

function normalizeSession(session = {}, timestamp = new Date().toISOString()) {
  return {
    id: compactText(session.id, 100) || createSessionId(),
    startedAt: compactText(session.startedAt, 40) || timestamp,
    lastSeenAt: compactText(session.lastSeenAt, 40) || timestamp,
    endedAt: session.endedAt ? compactText(session.endedAt, 40) : null,
    renderer: normalizeRenderer(session.renderer),
    runtimeBuild: compactText(session.runtimeBuild, 80) || PIPELINE_CAD_RUNTIME_BUILD,
    evidenceBuild: compactText(session.evidenceBuild, 80) || PIPELINE_CAD_SOAK_BUILD,
    counters: normalizeCounters(session.counters),
    events: (Array.isArray(session.events) ? session.events : [])
      .slice(-PIPELINE_CAD_SOAK_MAX_EVENTS)
      .map(normalizeEvent),
  };
}

export function normalizePipelineCadSoakLedger(value, options = {}) {
  const timestamp = nowIso(options);
  const source = value && typeof value === 'object' ? value : {};
  return {
    schema: PIPELINE_CAD_SOAK_LEDGER_SCHEMA,
    build: PIPELINE_CAD_SOAK_BUILD,
    createdAt: compactText(source.createdAt, 40) || timestamp,
    updatedAt: compactText(source.updatedAt, 40) || timestamp,
    sessions: (Array.isArray(source.sessions) ? source.sessions : [])
      .slice(-PIPELINE_CAD_SOAK_MAX_SESSIONS)
      .map((session) => normalizeSession(session, timestamp)),
  };
}

export function readPipelineCadSoakLedger(storage = globalThis.localStorage, options = {}) {
  const raw = safeGet(storage, PIPELINE_CAD_SOAK_STORAGE_KEY);
  if (!raw) return emptyLedger(nowIso(options));
  try {
    return normalizePipelineCadSoakLedger(JSON.parse(raw), options);
  } catch {
    return emptyLedger(nowIso(options));
  }
}

export function writePipelineCadSoakLedger(ledger, storage = globalThis.localStorage, options = {}) {
  const normalized = normalizePipelineCadSoakLedger(ledger, options);
  normalized.updatedAt = nowIso(options);
  safeSet(storage, PIPELINE_CAD_SOAK_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function clearPipelineCadSoakLedger(storage = globalThis.localStorage) {
  return safeRemove(storage, PIPELINE_CAD_SOAK_STORAGE_KEY);
}

function createSessionId() {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  } catch {
    // Fall through to a non-cryptographic local identifier.
  }
  return `cad-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function resolveSessionId(options = {}) {
  if (options.sessionId) return compactText(options.sessionId, 100);
  const sessionStorage = options.sessionStorage ?? globalThis.sessionStorage;
  let id = safeGet(sessionStorage, PIPELINE_CAD_SOAK_SESSION_KEY);
  if (!id) {
    id = createSessionId();
    safeSet(sessionStorage, PIPELINE_CAD_SOAK_SESSION_KEY, id);
  }
  return compactText(id, 100);
}

function sanitizeFallback(fallback) {
  if (!fallback) return null;
  return {
    renderer: normalizeRenderer(fallback.renderer),
    reason: compactText(fallback.reason, 180),
    build: compactText(fallback.build, 80),
    recordedAt: compactText(fallback.recordedAt, 40),
  };
}

function sanitizeDetail(type, detail = {}) {
  switch (type) {
    case 'session-start':
      return {
        renderer: normalizeRenderer(detail.renderer),
        runtimeBuild: compactText(detail.runtimeBuild, 80),
        evidenceBuild: PIPELINE_CAD_SOAK_BUILD,
        devicePixelRatio: Math.max(1, finite(detail.devicePixelRatio, 1)),
        viewportWidth: nonNegativeInteger(detail.viewportWidth),
        viewportHeight: nonNegativeInteger(detail.viewportHeight),
        language: compactText(detail.language, 24),
      };
    case 'workspace-mounted':
      return {
        renderer: normalizeRenderer(detail.renderer),
        table2Rows: nonNegativeInteger(detail.table2Rows),
        table3LengthRows: nonNegativeInteger(detail.table3LengthRows),
        table3DepthRows: nonNegativeInteger(detail.table3DepthRows),
        table3MarkerRows: nonNegativeInteger(detail.table3MarkerRows),
      };
    case 'workspace-destroyed':
      return { reason: compactText(detail.reason || 'destroy', 80) };
    case 'automatic-fallback':
      return sanitizeFallback(detail) || {};
    case 'runtime-error':
      return {
        name: compactText(detail.name || 'Error', 80),
        message: compactText(detail.message, 180),
      };
    case 'validation-error':
      return {
        name: compactText(detail.name || 'ValidationError', 80),
        firstCode: compactText(detail.firstCode, 100),
        errors: nonNegativeInteger(detail.errors),
        warnings: nonNegativeInteger(detail.warnings),
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
        discardedUndoCount: nonNegativeInteger(detail.discardedUndoCount),
        discardedRedoCount: nonNegativeInteger(detail.discardedRedoCount),
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
    case 'session-end':
      return { reason: compactText(detail.reason || 'pagehide', 80) };
    default:
      return {};
  }
}

function incrementCounter(session, type) {
  const keyByType = {
    'workspace-mounted': 'mounts',
    'workspace-destroyed': 'unmounts',
    'runtime-error': 'runtimeErrors',
    'automatic-fallback': 'fallbacks',
    'validation-error': 'validationErrors',
    'command-rejected': 'commandRejections',
    'history-reset': 'historyResets',
    'interaction-cancelled': 'interactionCancellations',
    'command-committed': 'committedCommands',
    'diagnostics-exported': 'diagnosticsExports',
  };
  const key = keyByType[type];
  if (key) session.counters[key] += 1;
}

function evidenceEnvironment(target = globalThis) {
  const doc = target.document;
  return {
    devicePixelRatio: Math.max(1, finite(target.devicePixelRatio, 1)),
    viewportWidth: nonNegativeInteger(target.innerWidth || doc?.documentElement?.clientWidth),
    viewportHeight: nonNegativeInteger(target.innerHeight || doc?.documentElement?.clientHeight),
    language: compactText(target.navigator?.language, 24),
  };
}

function dispatchEvidenceChanged(ledger, audit, target = globalThis) {
  try {
    target.document?.dispatchEvent?.(new CustomEvent(EVENT_CHANGE, {
      detail: { ledger, audit },
    }));
  } catch {
    // Evidence persistence must not depend on DOM event support.
  }
}

export function recordPipelineCadEvidence(type, detail = {}, options = {}) {
  const storage = options.storage ?? globalThis.localStorage;
  const timestamp = nowIso(options);
  const ledger = readPipelineCadSoakLedger(storage, options);
  const sessionId = resolveSessionId(options);
  let session = ledger.sessions.find((candidate) => candidate.id === sessionId);
  if (!session) {
    session = normalizeSession({
      id: sessionId,
      startedAt: timestamp,
      lastSeenAt: timestamp,
      renderer: options.renderer ?? resolvePipelineCadRenderer(options),
      runtimeBuild: PIPELINE_CAD_RUNTIME_BUILD,
      evidenceBuild: PIPELINE_CAD_SOAK_BUILD,
      counters: createCounters(),
      events: [],
    }, timestamp);
    ledger.sessions.push(session);
  }

  session.lastSeenAt = timestamp;
  if (type === 'session-start') {
    session.renderer = normalizeRenderer(detail.renderer ?? session.renderer);
    session.runtimeBuild = compactText(detail.runtimeBuild || session.runtimeBuild, 80);
  }
  if (type === 'session-end') session.endedAt = timestamp;

  const event = {
    type: compactText(type, 60),
    recordedAt: timestamp,
    detail: sanitizeDetail(type, detail),
  };
  session.events.push(event);
  session.events = session.events.slice(-PIPELINE_CAD_SOAK_MAX_EVENTS);
  incrementCounter(session, type);
  ledger.sessions = ledger.sessions.slice(-PIPELINE_CAD_SOAK_MAX_SESSIONS);

  const written = writePipelineCadSoakLedger(ledger, storage, options);
  const audit = createPipelineCadSoakAudit(written, options);
  dispatchEvidenceChanged(written, audit, options.target ?? globalThis);
  return { ledger: written, session, event, audit };
}

export function createPipelineCadSoakAudit(ledgerInput, options = {}) {
  const ledger = normalizePipelineCadSoakLedger(ledgerInput, options);
  const policy = {
    ...DEFAULT_POLICY,
    ...(options.policy && typeof options.policy === 'object' ? options.policy : {}),
  };
  Object.keys(policy).forEach((key) => { policy[key] = nonNegativeInteger(policy[key]); });

  const canvasSessions = ledger.sessions.filter((session) => session.renderer === PIPELINE_CAD_RENDERER_CANVAS);
  const successfulCanvasSessions = canvasSessions.filter((session) => (
    session.counters.mounts > 0
    && session.counters.runtimeErrors === 0
    && session.counters.fallbacks === 0
  ));
  const totals = ledger.sessions.reduce((summary, session) => {
    Object.keys(summary).forEach((key) => { summary[key] += nonNegativeInteger(session.counters[key]); });
    return summary;
  }, createCounters());

  const blockers = [];
  if (totals.runtimeErrors > policy.maximumRuntimeErrors) {
    blockers.push({
      code: 'CAD_RUNTIME_ERRORS_PRESENT',
      message: `${totals.runtimeErrors} Pipeline CAD runtime error(s) are recorded in the retained soak window.`,
    });
  }
  if (totals.fallbacks > policy.maximumFallbacks) {
    blockers.push({
      code: 'CAD_AUTOMATIC_FALLBACK_PRESENT',
      message: `${totals.fallbacks} automatic SVG fallback event(s) are recorded in the retained soak window.`,
    });
  }

  const progress = {
    canvasSessions: canvasSessions.length,
    requiredCanvasSessions: policy.minimumCanvasSessions,
    successfulCanvasSessions: successfulCanvasSessions.length,
    successfulMounts: successfulCanvasSessions.reduce((sum, session) => sum + session.counters.mounts, 0),
    requiredSuccessfulMounts: policy.minimumSuccessfulMounts,
  };
  const ready = !blockers.length
    && progress.successfulCanvasSessions >= policy.minimumCanvasSessions
    && progress.successfulMounts >= policy.minimumSuccessfulMounts;
  const verdict = blockers.length
    ? 'BLOCKED'
    : ready
      ? 'READY'
      : 'IN_PROGRESS';

  return Object.freeze({
    schema: PIPELINE_CAD_SOAK_AUDIT_SCHEMA,
    build: PIPELINE_CAD_SOAK_BUILD,
    generatedAt: nowIso(options),
    verdict,
    policy: Object.freeze({ ...policy }),
    progress: Object.freeze(progress),
    summary: Object.freeze({
      retainedSessions: ledger.sessions.length,
      canvasSessions: canvasSessions.length,
      successfulCanvasSessions: successfulCanvasSessions.length,
      ...totals,
    }),
    blockers: Object.freeze(blockers.map((blocker) => Object.freeze(blocker))),
  });
}

function currentGraphEvidence(doc = globalThis.document) {
  if (!doc?.querySelectorAll) return [];
  return Array.from(doc.querySelectorAll('[data-p3d-cad-canvas]')).map((canvas) => {
    const graph = canvas.__pipelineCadGraph;
    const model = graph?.model;
    const lifecycle = graph ? getPipelineCadLifecycleStats(graph) : null;
    return {
      graph: compactText(canvas.dataset?.p3dCadCanvas, 40),
      mounted: Boolean(graph),
      lifecycle,
      modelCounts: model ? {
        table2Rows: nonNegativeInteger(model.table2Rows?.length),
        table3LengthRows: nonNegativeInteger(model.table3LengthRows?.length),
        table3DepthRows: nonNegativeInteger(model.table3DepthRows?.length),
        table3MarkerRows: nonNegativeInteger(model.table3MarkerRows?.length),
      } : null,
    };
  });
}

export function buildPipelineCadDiagnosticsBundle(options = {}) {
  const storage = options.storage ?? globalThis.localStorage;
  const ledger = readPipelineCadSoakLedger(storage, options);
  const audit = createPipelineCadSoakAudit(ledger, options);
  const target = options.target ?? globalThis;
  const fallback = sanitizeFallback(readPipelineCadFallback(storage));
  return Object.freeze({
    schema: PIPELINE_CAD_DIAGNOSTICS_SCHEMA,
    build: PIPELINE_CAD_SOAK_BUILD,
    generatedAt: nowIso(options),
    privacy: Object.freeze({
      rawTablesIncluded: false,
      xmlIncluded: false,
      modelRowsIncluded: false,
      freeFormUserContentIncluded: false,
      retainedSessionLimit: PIPELINE_CAD_SOAK_MAX_SESSIONS,
      retainedEventLimitPerSession: PIPELINE_CAD_SOAK_MAX_EVENTS,
    }),
    runtime: Object.freeze({
      renderer: resolvePipelineCadRenderer({ ...options, storage }),
      runtimeBuild: PIPELINE_CAD_RUNTIME_BUILD,
      evidenceBuild: PIPELINE_CAD_SOAK_BUILD,
      fallback,
      fallbackStoragePresent: Boolean(safeGet(storage, PIPELINE_CAD_FALLBACK_STORAGE_KEY)),
    }),
    environment: Object.freeze(evidenceEnvironment(target)),
    soakAudit: audit,
    graphRuntime: Object.freeze(currentGraphEvidence(options.document ?? target.document)),
    ledger,
  });
}

export function downloadPipelineCadDiagnostics(options = {}) {
  const target = options.target ?? globalThis;
  const doc = options.document ?? target.document;
  const bundle = buildPipelineCadDiagnosticsBundle(options);
  recordPipelineCadEvidence('diagnostics-exported', { verdict: bundle.soakAudit.verdict }, options);
  if (!doc?.createElement || typeof target.Blob !== 'function' || !target.URL?.createObjectURL) return bundle;

  const blob = new target.Blob([`${JSON.stringify(bundle, null, 2)}\n`], { type: 'application/json' });
  const href = target.URL.createObjectURL(blob);
  const anchor = doc.createElement('a');
  const stamp = bundle.generatedAt.replace(/[:.]/g, '-');
  anchor.href = href;
  anchor.download = `pipeline-cad-diagnostics-${stamp}.json`;
  anchor.hidden = true;
  doc.body?.appendChild(anchor);
  anchor.click();
  anchor.remove();
  target.setTimeout?.(() => target.URL.revokeObjectURL(href), 0);
  return bundle;
}

function modelCounts(controller) {
  const model = controller?.model;
  return {
    table2Rows: nonNegativeInteger(model?.table2Rows?.length),
    table3LengthRows: nonNegativeInteger(model?.table3LengthRows?.length),
    table3DepthRows: nonNegativeInteger(model?.table3DepthRows?.length),
    table3MarkerRows: nonNegativeInteger(model?.table3MarkerRows?.length),
  };
}

function bindControllerEvidence(controller, graphs) {
  if (!controller || controller[CONTROLLER_BOUND]) return false;
  Object.defineProperty(controller, CONTROLLER_BOUND, { value: true });
  const cleanup = [];
  Object.defineProperty(controller, CONTROLLER_CLEANUP, { value: cleanup });

  recordPipelineCadEvidence('workspace-mounted', {
    renderer: resolvePipelineCadRenderer(),
    ...modelCounts(controller),
  });

  const bind = (target, type, listener) => {
    target?.addEventListener?.(type, listener);
    cleanup.push(() => target?.removeEventListener?.(type, listener));
  };

  bind(controller, 'validationError', (event) => {
    const diagnostics = event.detail?.diagnostics;
    recordPipelineCadEvidence('validation-error', {
      name: event.detail?.error?.name,
      firstCode: diagnostics?.issues?.[0]?.code,
      errors: diagnostics?.summary?.errors,
      warnings: diagnostics?.summary?.warnings,
    });
  });
  bind(controller, 'commandRejected', (event) => {
    recordPipelineCadEvidence('command-rejected', {
      reason: event.detail?.reason,
      name: event.detail?.error?.name,
      message: event.detail?.error?.message,
    });
  });
  bind(controller, 'historyReset', (event) => {
    recordPipelineCadEvidence('history-reset', event.detail || {});
  });
  bind(controller, 'commandCommitted', (event) => {
    recordPipelineCadEvidence('command-committed', { reason: event.detail?.reason });
  });

  Object.values(graphs || {}).filter(Boolean).forEach((graph) => {
    bind(graph, 'interactionCancelled', (event) => {
      recordPipelineCadEvidence('interaction-cancelled', event.detail || {});
    });
  });
  return true;
}

export function installPipelineCadSoakControllerPatch() {
  const prototype = PipelineCadController.prototype;
  if (prototype[CONTROLLER_PATCH]) return false;
  Object.defineProperty(prototype, CONTROLLER_PATCH, { value: true });

  const originalAttachGraphs = prototype.attachGraphs;
  prototype.attachGraphs = function attachGraphsWithSoakEvidence(graphs, ...args) {
    const result = originalAttachGraphs.call(this, graphs, ...args);
    bindControllerEvidence(this, graphs);
    return result;
  };

  const originalDestroy = prototype.destroy;
  prototype.destroy = function destroyWithSoakEvidence(...args) {
    if (this[CONTROLLER_BOUND]) {
      recordPipelineCadEvidence('workspace-destroyed', { reason: 'controller-destroy' });
      this[CONTROLLER_CLEANUP]?.splice?.(0)?.forEach?.((dispose) => dispose());
    }
    return originalDestroy.apply(this, args);
  };
  return true;
}

function ensureStyle(doc = globalThis.document) {
  if (!doc?.head || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.p3d-cad-soak-status{padding-left:7px;border-left:1px solid rgba(148,163,184,.35);white-space:nowrap}
.p3d-cad-soak-status[data-verdict="READY"]{color:#86efac}
.p3d-cad-soak-status[data-verdict="BLOCKED"]{color:#fca5a5}
.p3d-cad-soak-status[data-verdict="IN_PROGRESS"]{color:#fde68a}
.p3d-cad-renderer-control [data-p3d-cad-diagnostics-download]{background:#1e3a8a;border-color:#60a5fa;color:#dbeafe}
`;
  doc.head.appendChild(style);
}

function soakStatusText(audit) {
  if (audit.verdict === 'READY') return `Soak: READY · ${audit.progress.successfulCanvasSessions}/${audit.progress.requiredCanvasSessions} clean sessions`;
  if (audit.verdict === 'BLOCKED') return `Soak: BLOCKED · ${audit.blockers.length} blocker${audit.blockers.length === 1 ? '' : 's'}`;
  return `Soak: ${audit.progress.successfulCanvasSessions}/${audit.progress.requiredCanvasSessions} clean sessions`;
}

function installSoakControl(control, options = {}) {
  if (!control?.querySelector) return null;
  const doc = control.ownerDocument || globalThis.document;
  ensureStyle(doc);
  let status = control.querySelector('[data-p3d-cad-soak-status]');
  if (!status) {
    status = doc.createElement('span');
    status.className = 'p3d-cad-soak-status';
    status.dataset.p3dCadSoakStatus = '1';
    control.appendChild(status);
  }
  let button = control.querySelector('[data-p3d-cad-diagnostics-download]');
  if (!button) {
    button = doc.createElement('button');
    button.type = 'button';
    button.dataset.p3dCadDiagnosticsDownload = '1';
    button.textContent = 'Download CAD Diagnostics';
    button.addEventListener('click', () => downloadPipelineCadDiagnostics({ ...options, document: doc }));
    control.appendChild(button);
  }
  const audit = createPipelineCadSoakAudit(readPipelineCadSoakLedger(options.storage ?? globalThis.localStorage, options), options);
  status.dataset.verdict = audit.verdict;
  status.textContent = soakStatusText(audit);
  status.title = audit.blockers.map((blocker) => blocker.message).join('\n');
  return { status, button, audit };
}

export function installPipelineCadSoakControls(doc = globalThis.document, options = {}) {
  if (!doc?.body) return null;
  ensureStyle(doc);
  const patchAll = () => doc.querySelectorAll(CONTROL_SELECTOR).forEach((control) => installSoakControl(control, options));
  patchAll();
  doc.addEventListener?.(EVENT_CHANGE, patchAll);
  const MutationObserverCtor = globalThis.MutationObserver;
  if (typeof MutationObserverCtor !== 'function') return null;
  const state = sharedInstallState();
  if (state.controlsObserver) return state.controlsObserver;
  const observer = new MutationObserverCtor(patchAll);
  observer.observe(doc.body, { childList: true, subtree: true });
  state.controlsObserver = observer;
  return observer;
}

function installRuntimeEvidenceListeners(target = globalThis) {
  const state = sharedInstallState();
  if (state.runtimeListenersInstalled || !target?.addEventListener) return false;
  state.runtimeListenersInstalled = true;
  target.addEventListener('error', (event) => {
    const error = event?.error || event?.message;
    if (!isPipelineCadRuntimeError(error)) return;
    recordPipelineCadEvidence('runtime-error', {
      name: error?.name,
      message: error?.message || error,
    }, { target });
  });
  target.addEventListener('unhandledrejection', (event) => {
    const error = event?.reason;
    if (!isPipelineCadRuntimeError(error)) return;
    recordPipelineCadEvidence('runtime-error', {
      name: error?.name,
      message: error?.message || error,
    }, { target });
  });
  return true;
}

function initializeSessionEvidence(target = globalThis, options = {}) {
  const storage = options.storage ?? target.localStorage;
  const environment = evidenceEnvironment(target);
  const renderer = resolvePipelineCadRenderer({ ...options, storage });
  const result = recordPipelineCadEvidence('session-start', {
    renderer,
    runtimeBuild: PIPELINE_CAD_RUNTIME_BUILD,
    ...environment,
  }, { ...options, storage, target, renderer });

  const fallback = readPipelineCadFallback(storage);
  const session = result.ledger.sessions.find((candidate) => candidate.id === resolveSessionId(options));
  const fallbackAlreadyRecorded = session?.events?.some((event) => (
    event.type === 'automatic-fallback'
    && event.detail?.recordedAt
    && event.detail.recordedAt === compactText(fallback?.recordedAt, 40)
  ));
  if (fallback && !fallbackAlreadyRecorded) {
    recordPipelineCadEvidence('automatic-fallback', fallback, { ...options, storage, target, renderer });
  }
  return result;
}

function installPageLifecycle(target = globalThis, options = {}) {
  const state = sharedInstallState();
  if (state.pageLifecycleInstalled || !target?.addEventListener) return false;
  state.pageLifecycleInstalled = true;
  target.addEventListener('pagehide', () => {
    recordPipelineCadEvidence('session-end', { reason: 'pagehide' }, { ...options, target });
  });
  return true;
}

export function installPipelineCadSoakEvidence(target = globalThis, options = {}) {
  const state = sharedInstallState();
  if (state.installed) return false;
  state.installed = true;
  installPipelineCadSoakControllerPatch();
  installRuntimeEvidenceListeners(target);
  initializeSessionEvidence(target, options);
  installPageLifecycle(target, options);
  if (target.document?.body) installPipelineCadSoakControls(target.document, options);
  else target.document?.addEventListener?.('DOMContentLoaded', () => installPipelineCadSoakControls(target.document, options), { once: true });
  return true;
}

installPipelineCadSoakEvidence(globalThis);
