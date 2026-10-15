/** Browser worker for expensive scene revision, chunk, LOD, and index derivation. */

import { deriveSceneRuntimeSnapshot, SCENE_CHUNK_SIZE } from './scene-runtime.js';

const OPTIONS = Object.freeze({ chunkSize: SCENE_CHUNK_SIZE, originGridMm: 1000, minimumCellMm: 100 });
let previousSnapshot = null;

self.addEventListener('message', (event) => {
  const request = event.data;
  if (!Number.isInteger(request?.revision) || !request.models) throw new TypeError('Scene worker received an invalid derivation request.');
  const snapshot = deriveSceneRuntimeSnapshot(request.models, OPTIONS, previousSnapshot);
  previousSnapshot = snapshot;
  self.postMessage({ revision: request.revision, snapshot });
});
