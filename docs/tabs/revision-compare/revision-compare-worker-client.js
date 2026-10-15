/** Promise client for the independent RC-002 compare worker. */
import { createRevisionCompareWorkerRuntime } from './revision-compare-worker-runtime.js';

function browserWorkerFactory() {
  if (typeof Worker === 'undefined') throw new Error('Module workers are unavailable; visual comparison is blocked.');
  return new Worker(new URL('./revision-compare-worker.js', import.meta.url), { type: 'module' });
}
function rejectPending(pending, error) { pending.forEach((entry) => entry.reject(error)); pending.clear(); }
export function createRevisionCompareWorkerClient(workerFactory = browserWorkerFactory) {
  const worker = workerFactory(); const pending = new Map(); let nextId = 1; let disposed = false;
  worker.addEventListener('message', (event) => {
    const message = event.data ?? {}; const entry = pending.get(message.id); if (!entry) return;
    if (message.type === 'progress') { entry.onProgress?.(message.progress); return; }
    pending.delete(message.id);
    if (message.ok) entry.resolve(message.result);
    else { const failure = new Error(message.error || 'Compare worker request failed.'); failure.code = message.code ?? null; entry.reject(failure); }
  });
  worker.addEventListener('error', (event) => rejectPending(pending, new Error(event.message || 'Compare worker crashed.')));
  function request(type, payload = {}, onProgress) {
    if (disposed) return Promise.reject(new Error('Compare worker client is disposed.'));
    return new Promise((resolve, reject) => {
      const id = nextId++; pending.set(id, { resolve, reject, onProgress }); worker.postMessage({ id, type, ...payload });
    });
  }
  return Object.freeze({
    compare: (runId, input, onProgress) => request('compare', { runId, input }, onProgress), cancel: (runId) => request('cancel', { runId }),
    dispose: () => { if (disposed) return; disposed = true; worker.terminate(); rejectPending(pending, new Error('Compare worker client was disposed.')); },
  });
}
export function createInlineRevisionCompareWorkerClient(options = {}) {
  const runtime = createRevisionCompareWorkerRuntime(options); let disposed = false;
  return Object.freeze({
    compare: (runId, input, onProgress) => {
      if (disposed) return Promise.reject(new Error('Inline compare client is disposed.'));
      return runtime.handle({ type: 'compare', runId, input }, (_runId, progress) => onProgress?.(progress));
    },
    cancel: (runId) => runtime.handle({ type: 'cancel', runId }), dispose: () => { disposed = true; },
  });
}
