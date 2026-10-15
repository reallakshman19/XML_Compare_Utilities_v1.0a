/** Latest-revision-only coordinator for the browser scene derivation worker. */

export function createSceneDerivationScheduler(worker, onSnapshot, onError) {
  if (!worker?.postMessage || !worker?.addEventListener) throw new TypeError('Scene derivation requires a browser Worker.');
  if (typeof onSnapshot !== 'function' || typeof onError !== 'function') throw new TypeError('Scene derivation callbacks are required.');
  let requestedRevision = 0;
  let appliedRevision = 0;

  const handleMessage = (event) => {
    const response = event.data;
    if (!Number.isInteger(response?.revision) || !response.snapshot) return;
    if (response.revision !== requestedRevision || response.revision <= appliedRevision) return;
    appliedRevision = response.revision;
    onSnapshot(response.snapshot, response.revision);
  };
  const handleError = (event) => onError(new Error(`Scene derivation worker failed: ${event.message || 'unknown error'}`));
  worker.addEventListener('message', handleMessage);
  worker.addEventListener('error', handleError);

  return {
    request(models) {
      requestedRevision += 1;
      worker.postMessage({ revision: requestedRevision, models });
      return requestedRevision;
    },
    getState() { return { requestedRevision, appliedRevision, pending: requestedRevision !== appliedRevision }; },
    dispose() {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      worker.terminate();
    },
  };
}
