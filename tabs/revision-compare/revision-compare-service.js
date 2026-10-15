/** Generation-safe lifecycle around the independent RC-002 compare worker. */
import { createRevisionCompareWorkerClient } from './revision-compare-worker-client.js';

export class RevisionCompareSupersededError extends Error {
  constructor() { super('Revision comparison completion was superseded.'); this.name = 'RevisionCompareSupersededError'; this.code = 'REVISION_COMPARE_SUPERSEDED'; }
}
export function createRevisionCompareService(options = {}) {
  const client = options.client ?? createRevisionCompareWorkerClient(options.workerFactory);
  let generation = 0; let activeRunId = null; let disposed = false;
  function assertActive(expected) { if (disposed || generation !== expected) throw new RevisionCompareSupersededError(); }
  async function begin(basisId) {
    const previousRunId = activeRunId; generation += 1; activeRunId = `run:${generation}:${basisId}`;
    if (previousRunId) await client.cancel(previousRunId);
    return Object.freeze({ generation, runId: activeRunId });
  }
  async function compare(token, input, onProgress) {
    assertActive(token.generation);
    try {
      const audit = await client.compare(token.runId, input, (progress) => {
        if (!disposed && generation === token.generation) onProgress?.(progress);
      });
      assertActive(token.generation); activeRunId = null; return audit;
    } catch (error) { assertActive(token.generation); throw error; }
  }
  async function cancel() {
    const runId = activeRunId; generation += 1; activeRunId = null;
    if (runId) await client.cancel(runId); return generation;
  }
  function dispose() { if (disposed) return; disposed = true; generation += 1; activeRunId = null; client.dispose(); }
  return Object.freeze({ begin, compare, cancel, dispose, generation: () => generation, activeRunId: () => activeRunId });
}
