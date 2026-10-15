import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  PIPELINE_CAD_FLOATING_PREVIEW_STORAGE_KEY,
  PIPELINE_CAD_FLOATING_PREVIEW_Z_INDEX,
  clampPipelineCadFloatingPreviewRect,
  getPipelineCadFloatingPreviewDefaultRect,
  persistPipelineCadFloatingPreviewRect,
  readPipelineCadFloatingPreviewRect,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-floating-preview.js';

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

{
  const rect = getPipelineCadFloatingPreviewDefaultRect({ width: 1440, height: 900 });
  assert.deepEqual(rect, { left: 375, top: 36, width: 1037, height: 702 });
}

{
  const rect = clampPipelineCadFloatingPreviewRect({
    left: -500,
    top: 4000,
    width: 3000,
    height: 40,
  }, { width: 1280, height: 720 });
  assert.deepEqual(rect, {
    left: 12,
    top: 328,
    width: 1256,
    height: 380,
  });
}

{
  const storage = new MemoryStorage();
  const saved = persistPipelineCadFloatingPreviewRect({
    left: 180,
    top: 96,
    width: 840,
    height: 560,
  }, storage, { width: 1440, height: 900 });
  assert.deepEqual(saved, { left: 180, top: 96, width: 840, height: 560 });
  const stored = JSON.parse(storage.getItem(PIPELINE_CAD_FLOATING_PREVIEW_STORAGE_KEY));
  assert.equal(stored.schema, 'PipelineCadFloatingPreviewRect.v1');
  assert.equal(stored.left, 180);
  assert.deepEqual(readPipelineCadFloatingPreviewRect(storage, { width: 1440, height: 900 }), saved);
}

{
  const storage = new MemoryStorage({
    [PIPELINE_CAD_FLOATING_PREVIEW_STORAGE_KEY]: '{not-valid-json',
  });
  assert.deepEqual(
    readPipelineCadFloatingPreviewRect(storage, { width: 1000, height: 700 }),
    getPipelineCadFloatingPreviewDefaultRect({ width: 1000, height: 700 }),
  );
}

{
  const storage = new MemoryStorage({
    [PIPELINE_CAD_FLOATING_PREVIEW_STORAGE_KEY]: JSON.stringify({
      left: 1600,
      top: 1000,
      width: 1000,
      height: 700,
    }),
  });
  const restored = readPipelineCadFloatingPreviewRect(storage, { width: 900, height: 600 });
  assert.deepEqual(restored, { left: 12, top: 12, width: 876, height: 576 });
}

{
  const source = await readFile(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-cad-floating-preview.js', import.meta.url), 'utf8');
  const config = await readFile(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-config.js', import.meta.url), 'utf8');
  assert.match(source, /position:fixed!important/);
  assert.match(source, /aria-modal', 'false'/);
  assert.match(source, /resize:both/);
  assert.match(source, /pointer-events:auto/);
  assert.match(source, new RegExp(`z-index:\\$\\{PIPELINE_CAD_FLOATING_PREVIEW_Z_INDEX\\}!important`));
  assert.ok(PIPELINE_CAD_FLOATING_PREVIEW_Z_INDEX > 2_000_000_000);
  assert.match(config, /pipeline-3d-model-cad-floating-preview\.js\?v=20260713-floating-preview-1/);
}

console.log('pipeline-3d-model CAD floating preview tests passed');
