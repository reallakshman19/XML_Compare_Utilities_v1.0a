/** Independent compare-worker runtime with progress and cancellation. */
import { runRevisionCompare } from './revision-compare-engine.js';

export function createRevisionCompareWorkerRuntime(options = {}) {
  const cancelled = new Set();
  async function compare(message, emitProgress) {
    const runId = String(message.runId ?? '');
    if (!runId) throw new TypeError('Compare runId is required.');
    cancelled.delete(runId);
    try {
      return await runRevisionCompare(message.input, {
        cryptoRef: options.cryptoRef ?? globalThis.crypto, clock: options.clock,
        onProgress: (progress) => emitProgress(runId, progress), isCancelled: () => cancelled.has(runId),
      });
    } finally { cancelled.delete(runId); }
  }
  function cancel(message) {
    const runId = String(message.runId ?? ''); if (runId) cancelled.add(runId);
    return { runId, cancelled: Boolean(runId) };
  }
  async function handle(message, emitProgress = () => {}) {
    if (message.type === 'compare') return compare(message, emitProgress);
    if (message.type === 'cancel') return cancel(message);
    throw new Error(`Unknown compare worker request: ${message.type}`);
  }
  return Object.freeze({ handle });
}
