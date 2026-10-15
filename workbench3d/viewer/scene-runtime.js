/** Pure contracts for revision-aware, chunked 3D scene derivation. */

export const SCENE_RUNTIME_CONTRACT = 'SceneRuntimeSnapshot.v1';
export const SCENE_CHUNK_SIZE = 384;

function stableValue(value) {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableValue(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Deterministic, non-cryptographic content fingerprint for render invalidation. */
export function sceneFingerprint(value) {
  const text = stableValue(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function translatedBounds(model, translation) {
  const min = model?.bounds?.min;
  const max = model?.bounds?.max;
  if (!Array.isArray(min) || !Array.isArray(max)) return null;
  return {
    min: min.map((value, axis) => Number(value) + translation[axis]),
    max: max.map((value, axis) => Number(value) + translation[axis]),
  };
}

function combinedBounds(models) {
  const translation = models.registrationTranslation ?? [0, 0, 0];
  const rows = [translatedBounds(models.source, translation), translatedBounds(models.target, [0, 0, 0])].filter(Boolean);
  if (!rows.length) return { min: [0, 0, 0], max: [0, 0, 0] };
  return {
    min: [0, 1, 2].map((axis) => Math.min(...rows.map((row) => row.min[axis]))),
    max: [0, 1, 2].map((axis) => Math.max(...rows.map((row) => row.max[axis]))),
  };
}

/** Grid-rounded world origin keeps GPU coordinates close to zero. */
export function deriveFloatingOrigin(models, gridMm) {
  if (!Number.isFinite(gridMm) || gridMm <= 0) throw new RangeError('Floating-origin grid must be positive.');
  const bounds = combinedBounds(models);
  return [0, 1, 2].map((axis) => Math.round(((bounds.min[axis] + bounds.max[axis]) / 2) / gridMm) * gridMm);
}

function modelChunks(model, modelId, chunkSize) {
  const chunks = [];
  for (const collection of ['segments', 'markers']) {
    const rows = Array.isArray(model?.[collection]) ? model[collection] : [];
    for (let offset = 0; offset < rows.length; offset += chunkSize) {
      const index = Math.floor(offset / chunkSize);
      const items = rows.slice(offset, offset + chunkSize);
      chunks.push({ id: `${modelId}:${collection}:${index}`, modelId, collection, index, count: items.length, fingerprint: sceneFingerprint(items) });
    }
  }
  return chunks;
}

export function deriveSceneChunks(models, chunkSize) {
  if (!Number.isInteger(chunkSize) || chunkSize < 1) throw new RangeError('Scene chunk size must be a positive integer.');
  return [...modelChunks(models.source, 'source', chunkSize), ...modelChunks(models.target, 'target', chunkSize)];
}

export function diffSceneChunks(previousChunks, nextChunks) {
  const before = new Map((previousChunks ?? []).map((chunk) => [chunk.id, chunk.fingerprint]));
  const after = new Map(nextChunks.map((chunk) => [chunk.id, chunk.fingerprint]));
  const changed = new Set();
  for (const [id, hash] of after) if (before.get(id) !== hash) changed.add(id);
  for (const id of before.keys()) if (!after.has(id)) changed.add(id);
  return [...changed].sort();
}

function segmentEntry(row, modelId, index, translation) {
  const radius = Math.max(Number(row.radiusMm) || 0, Number(row.radiusMm2) || 0, 1);
  const points = [row.start, row.end].filter((point) => Array.isArray(point));
  if (points.length !== 2) return null;
  const min = [0, 1, 2].map((axis) => Math.min(...points.map((point) => Number(point[axis]) + translation[axis])) - radius);
  const max = [0, 1, 2].map((axis) => Math.max(...points.map((point) => Number(point[axis]) + translation[axis])) + radius);
  return { id: `${modelId}:segment:${index}`, objectId: row.objectId ?? null, modelId, kind: row.kind ?? null, min, max };
}

function markerEntry(row, modelId, index, translation) {
  if (!Array.isArray(row.position)) return null;
  const radius = Math.max(Number(row.pickSizeMm) || Number(row.sizeMm) || 1, 1);
  const center = row.position.map((value, axis) => Number(value) + translation[axis]);
  return {
    id: `${modelId}:marker:${index}`, objectId: row.objectId ?? null, modelId, kind: row.kind ?? null,
    min: center.map((value) => value - radius), max: center.map((value) => value + radius),
  };
}

function spatialEntries(models) {
  const entries = [];
  for (const [modelId, translation] of [['source', models.registrationTranslation ?? [0, 0, 0]], ['target', [0, 0, 0]]]) {
    const model = models[modelId];
    (model?.segments ?? []).forEach((row, index) => entries.push(segmentEntry(row, modelId, index, translation)));
    (model?.markers ?? []).forEach((row, index) => entries.push(markerEntry(row, modelId, index, translation)));
  }
  return entries.filter(Boolean);
}

function bucketKey(point, cellSize) {
  return point.map((value) => Math.floor(value / cellSize)).join(':');
}

export function createSceneSpatialIndex(models, cellSize) {
  if (!Number.isFinite(cellSize) || cellSize <= 0) throw new RangeError('Spatial-index cell size must be positive.');
  const entries = spatialEntries(models);
  const buckets = {};
  let maxExtent = 0;
  entries.forEach((entry, index) => {
    const center = entry.min.map((value, axis) => (value + entry.max[axis]) / 2);
    const extent = Math.max(...entry.max.map((value, axis) => (value - entry.min[axis]) / 2));
    maxExtent = Math.max(maxExtent, extent);
    const key = bucketKey(center, cellSize);
    (buckets[key] ??= []).push(index);
  });
  return { cellSize, maxExtent, entries, buckets };
}

function overlaps(entry, bounds) {
  return [0, 1, 2].every((axis) => entry.max[axis] >= bounds.min[axis] && entry.min[axis] <= bounds.max[axis]);
}

export function querySceneSpatialIndex(index, bounds) {
  if (!index?.entries || !bounds?.min || !bounds?.max) throw new TypeError('Spatial query requires an index and min/max bounds.');
  const paddedMin = bounds.min.map((value) => value - index.maxExtent);
  const paddedMax = bounds.max.map((value) => value + index.maxExtent);
  const ids = new Set();
  for (let x = Math.floor(paddedMin[0] / index.cellSize); x <= Math.floor(paddedMax[0] / index.cellSize); x += 1) {
    for (let y = Math.floor(paddedMin[1] / index.cellSize); y <= Math.floor(paddedMax[1] / index.cellSize); y += 1) {
      for (let z = Math.floor(paddedMin[2] / index.cellSize); z <= Math.floor(paddedMax[2] / index.cellSize); z += 1) {
        for (const id of index.buckets[`${x}:${y}:${z}`] ?? []) ids.add(id);
      }
    }
  }
  return [...ids].map((id) => index.entries[id]).filter((entry) => overlaps(entry, bounds));
}

function deriveLod(drawableCount) {
  if (drawableCount >= 12000) return { level: 'coarse', nodeSegments: 6, nodeRings: 4 };
  if (drawableCount >= 3000) return { level: 'balanced', nodeSegments: 8, nodeRings: 6 };
  return { level: 'fine', nodeSegments: 12, nodeRings: 10 };
}

export function deriveSceneRuntimeSnapshot(models, options, previousSnapshot) {
  const chunks = deriveSceneChunks(models, options.chunkSize);
  const bounds = combinedBounds(models);
  const diagonal = Math.hypot(...bounds.max.map((value, axis) => value - bounds.min[axis]));
  const drawableCount = chunks.reduce((sum, chunk) => sum + chunk.count, 0);
  const snapshot = {
    contract: SCENE_RUNTIME_CONTRACT,
    revision: sceneFingerprint({ chunks, registrationTranslation: models.registrationTranslation ?? [0, 0, 0] }),
    origin: deriveFloatingOrigin(models, options.originGridMm),
    chunks,
    changedChunkIds: diffSceneChunks(previousSnapshot?.chunks, chunks),
    lod: deriveLod(drawableCount),
    spatialIndex: createSceneSpatialIndex(models, Math.max(options.minimumCellMm, diagonal / 32 || options.minimumCellMm)),
    drawableCount,
  };
  return snapshot;
}
