import assert from 'node:assert/strict';

import { PipelineProfileModel } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-model.js';
import {
  PIPELINE_CAD_OVERLAY_FORMULA,
  PIPELINE_CAD_PREVIEW_MODE_OVERLAY,
  PIPELINE_CAD_PREVIEW_MODE_SIDE_BY_SIDE,
  PIPELINE_CAD_PREVIEW_MODE_STORAGE_KEY,
  buildPipelineCadOverlayModel,
  derivePipelineCadDefaultZOrigin,
  normalizePipelineCadPreviewMode,
  projectPipelineCadZToElevation,
  readPipelineCadPreviewMode,
  writePipelineCadPreviewMode,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-preview-modes.js';
import {
  SAMPLE_TABLE_2A_RAW,
  SAMPLE_TABLE_3A_RAW,
  SAMPLE_TABLE_3B_RAW,
  SAMPLE_TABLE_3C_RAW,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-samples.js';

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

const model = PipelineProfileModel.fromRaw({
  table2a: SAMPLE_TABLE_2A_RAW,
  table3a: SAMPLE_TABLE_3A_RAW,
  table3b: SAMPLE_TABLE_3B_RAW,
  table3c: SAMPLE_TABLE_3C_RAW,
});

assert.equal(projectPipelineCadZToElevation(231.8, -1.5), 230.3);
assert.equal(projectPipelineCadZToElevation(231.8, 0.75), 232.55);
assert.equal(projectPipelineCadZToElevation('bad', -1.5), null);
assert.equal(PIPELINE_CAD_OVERLAY_FORMULA, 'Projected elevation = Z-origin elevation + Z');

assert.equal(derivePipelineCadDefaultZOrigin(model), 231.32);

const overlay = buildPipelineCadOverlayModel(model, 231.8);
assert.equal(overlay.schema, 'PipelineCadElevationOverlay.v1');
assert.equal(overlay.zOriginElevation, 231.8);
assert.equal(overlay.elevationPoints.length, 8);
assert.equal(overlay.projectedZPoints.length, 2);
assert.equal(overlay.markers.length, 1);
assert.ok(Math.abs(overlay.projectedZPoints[0].y - 232.55) < 1e-9);
assert.ok(Math.abs(overlay.projectedZPoints[1].y - 230.3) < 1e-9);
assert.ok(overlay.projectedZPoints[0].x > 3 && overlay.projectedZPoints[0].x < 5);
assert.ok(overlay.projectedZPoints[1].x > 45 && overlay.projectedZPoints[1].x < 48);
assert.equal(overlay.markers[0].markerText, 'PM-001');
assert.ok(overlay.xRange.min < 0);
assert.ok(overlay.xRange.max > 77.8);
assert.ok(overlay.yRange.min < 230.3);
assert.ok(overlay.yRange.max > 232.55, 'Y range must include padding above the actual sample maximum');

const shifted = buildPipelineCadOverlayModel(model, 233.8);
assert.deepEqual(
  shifted.elevationPoints.map((point) => point.y),
  overlay.elevationPoints.map((point) => point.y),
  'Table 2X elevation must not move when the Z origin changes',
);
assert.deepEqual(
  shifted.projectedZPoints.map((point, index) => Number((point.y - overlay.projectedZPoints[index].y).toFixed(6))),
  [2, 2],
  'every projected Table 3X point must move by the origin delta',
);

assert.equal(normalizePipelineCadPreviewMode({ mode: 'invalid' }).mode, 'table2x');
assert.equal(normalizePipelineCadPreviewMode({ mode: PIPELINE_CAD_PREVIEW_MODE_SIDE_BY_SIDE }).mode, PIPELINE_CAD_PREVIEW_MODE_SIDE_BY_SIDE);

const storage = new MemoryStorage();
writePipelineCadPreviewMode({
  mode: PIPELINE_CAD_PREVIEW_MODE_OVERLAY,
  zOriginElevation: 231.8,
}, storage);
assert.ok(storage.getItem(PIPELINE_CAD_PREVIEW_MODE_STORAGE_KEY));
assert.deepEqual(readPipelineCadPreviewMode(storage), normalizePipelineCadPreviewMode({
  mode: PIPELINE_CAD_PREVIEW_MODE_OVERLAY,
  zOriginElevation: 231.8,
}));

const corruptedStorage = new MemoryStorage({
  [PIPELINE_CAD_PREVIEW_MODE_STORAGE_KEY]: '{not-json',
});
assert.equal(readPipelineCadPreviewMode(corruptedStorage).mode, 'table2x');
assert.equal(readPipelineCadPreviewMode(corruptedStorage).zOriginElevation, null);

console.log('pipeline-3d-model CAD preview mode tests passed');
