import {
  PIPELINE_CAD_RUNTIME_BUILD,
  isPipelineCadRuntimeError,
  readPipelineCadFallback,
  resolvePipelineCadRenderer,
} from './pipeline-3d-model-cad-runtime-policy.js';

export const PIPELINE_CAD_SOAK_LEDGER_SCHEMA = 'PipelineCadSoakLedger.v1';
export const PIPELINE_CAD_SOAK_AUDIT_SCHEMA = 'PipelineCadSoakAudit.v1';
export const PIPELINE_CAD_DIAGNOSTICS_SCHEMA = 'PipelineCadDiagnosticsBundle.v1';
export const PIPELINE_CAD_SOAK_BUILD = '2026.07.13-cad-soak-1';
export const PIPELINE_CAD_SOAK_STORAGE_KEY = 'pipeline3dCadSoakLedgerV1';
export const PIPELINE_CAD_SOAK_SESSION_KEY = 'pipeline3dCadSoakSessionV1';

const CHANGE_EVENT = 'pipeline-cad-soak-evidence-changed';
const MAX_SESSIONS = 20;
const MAX_EVENTS = 60;
const POLICY = Object.freeze({ sessions: 3, mounts: 3 });

function safeGet(storage, key) {
  try { return storage?.getItem?.(key) ?? null; } catch { return null; }
}

function safeSet(storage, key, value) {
  try { storage?.setItem?.(key, value); return true; } catch { return false; }
}

function compact(value, limit = 180) {
  return String(value ?? '').replace(/[\t\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, limit);
}

function counters(value = {}) {
  const names = ['mounts', 'unmounts', 'runtimeErrors', 'fallbacks', 'validationErrors',
    'commandRejections', 'historyResets', 'interactionCancellations', 'committedCommands', 'diagnosticsExports'];
  return Object.fromEntries(names.map((name) => [name, Math.max(0, Math.floor(Number(value[name]) || 0))]));
}

function readLedger(storage) {
  try {
    const parsed = JSON.parse(safeGet(storage, PIPELINE_CAD_SOAK_STORAGE_KEY) || 'null');
    if (parsed?.schema === PIPELINE_CAD_SOAK_LEDGER_SCHEMA && Array.isArray(parsed.sessions)) return parsed;
  } catch { /* corrupt evidence resets safely */ }
  const now = new Date().toISOString();
  return { schema: PIPELINE_CAD_SOAK_LEDGER_SCHEMA, build: PIPELINE_CAD_SOAK_BUILD, createdAt: now, updatedAt: now, sessions: [] };
}

function sessionId(sessionStorage) {
  let id = safeGet(sessionStorage, PIPELINE_CAD_SOAK_SESSION_KEY);
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() || `cad-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    safeSet(sessionStorage, PIPELINE_CAD_SOAK_SESSION_KEY, id);
  }
  return compact(id, 100);
}

function sessionFor(ledger, id, renderer) {
  let session = ledger.sessions.find((candidate) => candidate.id === id);
  if (session) return session;
  const now = new Date().toISOString();
  session = {
    id,
    startedAt: now,
    lastSeenAt: now,
    endedAt: null,
    renderer,
    runtimeBuild: PIPELINE_CAD_RUNTIME_BUILD,
    evidenceBuild: PIPELINE_CAD_SOAK_BUILD,
    counters: counters(),
    events: [],
  };
  ledger.sessions.push(session);
  return session;
}

function sanitizedDetail(type, detail = {}) {
  if (type === 'runtime-error' || type === 'command-rejected') {
    return { name: compact(detail.name, 80), message: compact(detail.message, 180), reason: compact(detail.reason, 100) };
  }
  if (type === 'validation-error') {
    return { firstCode: compact(detail.firstCode, 100), errors: Number(detail.errors) || 0, warnings: Number(detail.warnings) || 0 };
  }
  if (type === 'workspace-mounted') return { renderer: 'canvas', ...detail };
  if (type === 'interaction-cancelled') return { graph: compact(detail.graph, 40), reason: compact(detail.reason, 100), commit: false };
  if (type === 'command-committed' || type === 'history-reset') return { reason: compact(detail.reason, 100) };
  return {};
}

function counterName(type) {
  return ({
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
  })[type];
}

function createAudit(ledger) {
  const canvas = ledger.sessions.filter((session) => session.renderer === 'canvas');
  const clean = canvas.filter((session) => session.counters.mounts > 0
    && session.counters.runtimeErrors === 0 && session.counters.fallbacks === 0);
  const totals = ledger.sessions.reduce((sum, session) => {
    Object.entries(counters(session.counters)).forEach(([key, value]) => { sum[key] += value; });
    return sum;
  }, counters());
  const blockers = [];
  if (totals.runtimeErrors) blockers.push({ code: 'CAD_RUNTIME_ERRORS_PRESENT', message: `${totals.runtimeErrors} Pipeline CAD runtime error(s) are recorded.` });
  if (totals.fallbacks) blockers.push({ code: 'CAD_AUTOMATIC_FALLBACK_PRESENT', message: `${totals.fallbacks} automatic SVG fallback event(s) are recorded.` });
  const successfulMounts = clean.reduce((sum, session) => sum + session.counters.mounts, 0);
  const ready = !blockers.length && clean.length >= POLICY.sessions && successfulMounts >= POLICY.mounts;
  return Object.freeze({
    schema: PIPELINE_CAD_SOAK_AUDIT_SCHEMA,
    build: PIPELINE_CAD_SOAK_BUILD,
    generatedAt: new Date().toISOString(),
    verdict: blockers.length ? 'BLOCKED' : ready ? 'READY' : 'IN_PROGRESS',
    policy: Object.freeze({ minimumCanvasSessions: POLICY.sessions, minimumSuccessfulMounts: POLICY.mounts, maximumFallbacks: 0, maximumRuntimeErrors: 0 }),
    progress: Object.freeze({ canvasSessions: canvas.length, requiredCanvasSessions: POLICY.sessions, successfulCanvasSessions: clean.length, successfulMounts, requiredSuccessfulMounts: POLICY.mounts }),
    summary: Object.freeze({ retainedSessions: ledger.sessions.length, canvasSessions: canvas.length, successfulCanvasSessions: clean.length, ...totals }),
    blockers: Object.freeze(blockers.map(Object.freeze)),
  });
}

function dispatchChange(doc, ledger, audit) {
  const EventCtor = doc?.defaultView?.CustomEvent || globalThis.CustomEvent;
  if (doc?.dispatchEvent && typeof EventCtor === 'function') doc.dispatchEvent(new EventCtor(CHANGE_EVENT, { detail: { ledger, audit } }));
}

function record(state, type, detail = {}) {
  const ledger = readLedger(state.storage);
  const session = sessionFor(ledger, state.sessionId, resolvePipelineCadRenderer({ storage: state.storage }));
  session.lastSeenAt = new Date().toISOString();
  if (type === 'workspace-destroyed') session.endedAt = session.lastSeenAt;
  session.counters = counters(session.counters);
  const key = counterName(type);
  if (key) session.counters[key] += 1;
  session.events.push({ type, recordedAt: session.lastSeenAt, detail: sanitizedDetail(type, detail) });
  session.events = session.events.slice(-MAX_EVENTS);
  ledger.sessions = ledger.sessions.slice(-MAX_SESSIONS);
  ledger.updatedAt = session.lastSeenAt;
  safeSet(state.storage, PIPELINE_CAD_SOAK_STORAGE_KEY, JSON.stringify(ledger));
  const audit = createAudit(ledger);
  dispatchChange(state.document, ledger, audit);
  return { ledger, audit };
}

function graphRuntime(state) {
  return Object.entries(state.graphs).map(([graph, instance]) => Object.freeze({
    graph,
    mounted: Boolean(instance),
    lifecycle: null,
    modelCounts: Object.freeze({
      table2Rows: state.controller.model?.table2Rows?.length || 0,
      table3LengthRows: state.controller.model?.table3LengthRows?.length || 0,
      table3DepthRows: state.controller.model?.table3DepthRows?.length || 0,
      table3MarkerRows: state.controller.model?.table3MarkerRows?.length || 0,
    }),
  }));
}

export function buildPipelineCadLifecycleDiagnostics(state) {
  const ledger = readLedger(state.storage);
  return Object.freeze({
    schema: PIPELINE_CAD_DIAGNOSTICS_SCHEMA,
    build: PIPELINE_CAD_SOAK_BUILD,
    generatedAt: new Date().toISOString(),
    privacy: Object.freeze({ rawTablesIncluded: false, xmlIncluded: false, modelRowsIncluded: false, freeFormUserContentIncluded: false, retainedSessionLimit: MAX_SESSIONS, retainedEventLimitPerSession: MAX_EVENTS }),
    runtime: Object.freeze({ renderer: resolvePipelineCadRenderer({ storage: state.storage }), runtimeBuild: PIPELINE_CAD_RUNTIME_BUILD, evidenceBuild: PIPELINE_CAD_SOAK_BUILD, fallback: readPipelineCadFallback(state.storage), fallbackStoragePresent: Boolean(readPipelineCadFallback(state.storage)) }),
    environment: Object.freeze({ devicePixelRatio: Math.max(1, Number(state.target.devicePixelRatio) || 1), viewportWidth: Number(state.target.innerWidth) || 0, viewportHeight: Number(state.target.innerHeight) || 0, language: compact(state.target.navigator?.language, 24) }),
    soakAudit: createAudit(ledger),
    graphRuntime: Object.freeze(graphRuntime(state)),
    ledger,
  });
}

function statusText(audit) {
  if (audit.verdict === 'READY') return `Soak: READY · ${audit.progress.successfulCanvasSessions}/${audit.progress.requiredCanvasSessions} clean sessions`;
  if (audit.verdict === 'BLOCKED') return `Soak: BLOCKED · ${audit.blockers.length} blocker${audit.blockers.length === 1 ? '' : 's'}`;
  return `Soak: ${audit.progress.successfulCanvasSessions}/${audit.progress.requiredCanvasSessions} clean sessions`;
}

function updateStatus(state, audit) {
  state.status.dataset.verdict = audit.verdict;
  state.status.textContent = statusText(audit);
  state.status.title = audit.blockers.map((blocker) => blocker.message).join('\n');
}

function download(state) {
  record(state, 'diagnostics-exported');
  const bundle = buildPipelineCadLifecycleDiagnostics(state);
  const blob = new state.target.Blob([`${JSON.stringify(bundle, null, 2)}\n`], { type: 'application/json' });
  const href = state.target.URL.createObjectURL(blob);
  const anchor = state.document.createElement('a');
  anchor.href = href;
  anchor.download = `pipeline-cad-diagnostics-${bundle.generatedAt.replace(/[:.]/g, '-')}.json`;
  anchor.hidden = true;
  state.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  state.target.setTimeout(() => state.target.URL.revokeObjectURL(href), 0);
}

function ensureControls(state) {
  const modal = state.dialog.querySelector('[data-p3d-split="x-modal"]') || state.dialog;
  const renderer = modal.querySelector('[data-p3d-cad-renderer-control]');
  const host = renderer || state.document.createElement('div');
  if (!renderer) {
    host.className = 'p3d-cad-diagnostics-control';
    host.dataset.p3dCadDiagnosticsHost = '1';
    modal.appendChild(host);
    state.createdHost = true;
  }
  const status = state.document.createElement('span');
  status.className = 'p3d-cad-soak-status';
  status.dataset.p3dCadSoakStatus = '1';
  const button = state.document.createElement('button');
  button.type = 'button';
  button.dataset.p3dCadDiagnosticsDownload = '1';
  button.textContent = 'Download CAD Diagnostics';
  host.append(status, button);
  return { host, status, button };
}

function bind(target, type, listener, cleanup) {
  target?.addEventListener?.(type, listener);
  cleanup.push(() => target?.removeEventListener?.(type, listener));
}

function bindEvidence(state) {
  const changed = (event) => updateStatus(state, event.detail?.audit || createAudit(readLedger(state.storage)));
  bind(state.document, CHANGE_EVENT, changed, state.cleanup);
  bind(state.button, 'click', () => download(state), state.cleanup);
  bind(state.controller, 'commandCommitted', (event) => record(state, 'command-committed', event.detail), state.cleanup);
  bind(state.controller, 'commandRejected', (event) => record(state, 'command-rejected', {
    reason: event.detail?.reason, name: event.detail?.error?.name, message: event.detail?.error?.message,
  }), state.cleanup);
  bind(state.controller, 'historyReset', (event) => record(state, 'history-reset', event.detail), state.cleanup);
  bind(state.controller, 'validationError', (event) => record(state, 'validation-error', {
    firstCode: event.detail?.diagnostics?.issues?.[0]?.code,
    errors: event.detail?.diagnostics?.summary?.errors,
    warnings: event.detail?.diagnostics?.summary?.warnings,
  }), state.cleanup);
  Object.values(state.graphs).forEach((graph) => bind(graph, 'interactionCancelled',
    (event) => record(state, 'interaction-cancelled', event.detail), state.cleanup));
  bind(state.target, 'error', (event) => {
    if (isPipelineCadRuntimeError(event.error || event.message)) {
      record(state, 'runtime-error', { name: event.error?.name, message: event.error?.message || event.message });
    }
  }, state.cleanup);
  bind(state.target, 'unhandledrejection', (event) => {
    if (isPipelineCadRuntimeError(event.reason)) {
      record(state, 'runtime-error', { name: event.reason?.name, message: event.reason?.message || event.reason });
    }
  }, state.cleanup);
}

function mountCounts(model) {
  return {
    table2Rows: model?.table2Rows?.length || 0,
    table3LengthRows: model?.table3LengthRows?.length || 0,
    table3DepthRows: model?.table3DepthRows?.length || 0,
    table3MarkerRows: model?.table3MarkerRows?.length || 0,
  };
}

export function mountPipelineCadDiagnosticsLifecycle(options = {}) {
  const target = options.target ?? globalThis;
  const document = options.dialog?.ownerDocument ?? target.document;
  if (!options.dialog || !options.controller || !options.graphs || !document) return null;
  const state = {
    ...options, target, document,
    storage: options.storage ?? target.localStorage,
    sessionStorage: options.sessionStorage ?? target.sessionStorage,
    cleanup: [], createdHost: false,
  };
  state.sessionId = sessionId(state.sessionStorage);
  Object.assign(state, ensureControls(state));
  bindEvidence(state);
  updateStatus(state, record(state, 'workspace-mounted', mountCounts(state.controller.model)).audit);
  let destroyed = false;
  return Object.freeze({
    buildDiagnostics: () => buildPipelineCadLifecycleDiagnostics(state),
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      record(state, 'workspace-destroyed');
      state.cleanup.splice(0).forEach((dispose) => dispose());
      state.status.remove();
      state.button.remove();
      if (state.createdHost) state.host.remove();
      return true;
    },
  });
}
