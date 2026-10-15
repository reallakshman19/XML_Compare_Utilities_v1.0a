/** Promise clients for staged intake and approved-scope record projection. */
import { createRevisionWorkerRuntime } from './revision-intake-worker-runtime.js';

function browserWorkerFactory() {
  if (typeof Worker === 'undefined') throw new Error('Module workers are unavailable; revision intake is blocked.');
  return new Worker(new URL('./revision-intake-worker.js', import.meta.url), { type: 'module' });
}
function rejectPending(pending, error) { for (const entry of pending.values()) entry.reject(error); pending.clear(); }
export function createRevisionWorkerClient(workerFactory = browserWorkerFactory) {
  const worker = workerFactory(); const pending = new Map(); let nextId = 1; let disposed = false;
  worker.addEventListener('message', (event) => {
    const { id, ok, result, error } = event.data ?? {}; const entry = pending.get(id);
    if (!entry) return; pending.delete(id); if (ok) entry.resolve(result); else entry.reject(new Error(error || 'Revision worker request failed.'));
  });
  worker.addEventListener('error', (event) => rejectPending(pending, new Error(event.message || 'Revision worker crashed.')));
  function request(type, payload = {}) {
    if (disposed) return Promise.reject(new Error('Revision worker client is disposed.'));
    return new Promise((resolve, reject) => { const id = nextId++; pending.set(id, { resolve, reject }); worker.postMessage({ id, type, ...payload }); });
  }
  return Object.freeze({
    parse: (text, sourceHash) => request('parse', { text, sourceHash }), filter: (scope) => request('filter', { scope }),
    projectCompareRecords: (requestValue) => request('projectCompareRecords', { request: requestValue }), reset: () => request('reset'),
    dispose: () => { if (disposed) return; disposed = true; worker.terminate(); rejectPending(pending, new Error('Revision worker client was disposed.')); },
  });
}
export function createInlineRevisionWorkerClient(options = {}) {
  const runtime = createRevisionWorkerRuntime(options); let disposed = false;
  function request(type, payload = {}) {
    if (disposed) return Promise.reject(new Error('Inline revision client is disposed.'));
    return Promise.resolve().then(() => runtime.handle({ type, ...payload }));
  }
  return Object.freeze({
    parse: (text, sourceHash) => request('parse', { text, sourceHash }), filter: (scope) => request('filter', { scope }),
    projectCompareRecords: (requestValue) => request('projectCompareRecords', { request: requestValue }), reset: () => request('reset'),
    dispose: () => { disposed = true; },
  });
}
