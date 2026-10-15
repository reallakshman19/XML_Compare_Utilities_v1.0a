/** Browser module worker for staged revision parsing, filtering, and projection. */
import { createRevisionWorkerRuntime } from './revision-intake-worker-runtime.js';
const runtime = createRevisionWorkerRuntime(); const workerScope = globalThis.self;
if (workerScope?.addEventListener && workerScope?.postMessage) {
  workerScope.addEventListener('message', async (event) => {
    const message = event.data ?? {};
    try { workerScope.postMessage({ id: message.id, ok: true, result: await runtime.handle(message) }); }
    catch (error) { workerScope.postMessage({ id: message.id, ok: false, error: String(error?.message ?? error) }); }
  });
}
