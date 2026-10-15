/** Browser module worker entry for bounded revision comparison. */
import { createRevisionCompareWorkerRuntime } from './revision-compare-worker-runtime.js';

const runtime = createRevisionCompareWorkerRuntime(); const workerScope = globalThis.self;
if (workerScope?.addEventListener && workerScope?.postMessage) {
  workerScope.addEventListener('message', async (event) => {
    const message = event.data ?? {};
    try {
      const result = await runtime.handle(message, (runId, progress) => workerScope.postMessage({ id: message.id, type: 'progress', runId, progress }));
      workerScope.postMessage({ id: message.id, ok: true, result });
    } catch (error) {
      workerScope.postMessage({ id: message.id, ok: false, error: String(error?.message ?? error), code: error?.code ?? null });
    }
  });
}
