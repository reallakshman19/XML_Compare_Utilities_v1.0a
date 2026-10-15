import assert from 'node:assert/strict';
import {
  WorkbenchViewportCapability,
  validateWorkbenchViewportHost,
} from '../core/workbench-viewport/index.js';
import '../tabs/pipeline-3d-model/pipeline-3d-model-cad-viewport-runtime.js';
import '../tabs/pipeline-3d-model/pipeline-3d-model-cad-authoring.js';
import { PipelineProfileModel } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-model.js';
import { Table2XCanvas } from '../tabs/pipeline-3d-model/pipeline-3d-model-table2x-canvas.js';
import { Table3XCanvas } from '../tabs/pipeline-3d-model/pipeline-3d-model-table3x-canvas.js';
import { createPipelineCadViewportHost } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-viewport-host.js';
import {
  PipelineCadScaleMode,
  loadPipelineCadViewportState,
  normalizePipelineCadViewportState,
  savePipelineCadViewportState,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-viewport-state.js';
import { buildPipelineCadEngineeringGrid } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-engineering-grid.js';
import { pipelineCadViewportShellModel } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-viewport-shell-view.js';
import { buildPipelineCadOverlayModel } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-preview-mode-overlay.js';
import { normalizePipelineCadPreviewMode } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-preview-mode-state.js';
import {
  DEFAULT_PIPELINE_CAD_SNAP_SETTINGS,
  normalizePipelineCadSnapSettings,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-snap.js';
import {
  SAMPLE_TABLE_2A_RAW,
  SAMPLE_TABLE_3A_RAW,
  SAMPLE_TABLE_3B_RAW,
  SAMPLE_TABLE_3C_RAW,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-samples.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const model = PipelineProfileModel.fromRaw({
  table2a: SAMPLE_TABLE_2A_RAW,
  table3a: SAMPLE_TABLE_3A_RAW,
  table3b: SAMPLE_TABLE_3B_RAW,
  table3c: SAMPLE_TABLE_3C_RAW,
});
const table2x = new Table2XCanvas(null, { width: 1000, height: 500 });
const table3x = new Table3XCanvas(null, { width: 1000, height: 500 });
table2x.setModel(model);
table3x.setModel(model);
const host2 = createPipelineCadViewportHost(table2x, { surfaceId: 'table2x' });
const host3 = createPipelineCadViewportHost(table3x, { surfaceId: 'table3x' });
assert.equal(validateWorkbenchViewportHost(host2), true);
assert.equal(validateWorkbenchViewportHost(host3), true);
assert.equal(host2.namespace, 'pipeline-cad');
assert.equal(host2.modeId, 'pipeline-profile');
assert.ok(host2.capabilities.includes(WorkbenchViewportCapability.LINK_X));
assert.match(host2.formatPointer({ x: 19, y: 231.2 }), /Elev/);
assert.match(host3.formatPointer({ x: 20.5, y: -1.5 }), /HLength/);

const storage = new MemoryStorage();
const state = normalizePipelineCadViewportState({
  graph: 'table2x',
  previewMode: 'side-by-side',
  scaleMode: PipelineCadScaleMode.ENGINEERING,
  horizontalScale: 1000,
  verticalScale: 100,
});
savePipelineCadViewportState(state, storage);
assert.equal(loadPipelineCadViewportState('table2x', 'side-by-side', storage).horizontalScale, 1000);
assert.equal(storage.values.size, 1);

assert.equal(normalizePipelineCadPreviewMode({ zOriginElevation: null }).zOriginElevation, null);
assert.equal(normalizePipelineCadPreviewMode({ zOriginElevation: '' }).zOriginElevation, null);
const overlay = buildPipelineCadOverlayModel(model, null);
assert.equal(overlay.zOriginElevation, model.table2Rows[0].elevationValue);
assert.equal(overlay.projectedZPoints[0].y, overlay.zOriginElevation + overlay.projectedZPoints[0].z);

table2x.setPipelineCadEngineeringScale(1000, 100);
assert.equal(table2x.getViewport().zoomY / table2x.getViewport().zoomX, 10);
table2x.setPipelineCadCustomRange({ minX: 10, maxX: 30, minY: 230, maxY: 233 });
const custom = table2x.getPipelineCadHorizontalRange();
assert.ok(Math.abs(custom.minX - 10) < 1e-6);
assert.ok(Math.abs(custom.maxX - 30) < 1e-6);

const yBefore = table3x.getViewport();
table3x.setPipelineCadHorizontalViewport(custom, { silent: true });
const yAfter = table3x.getViewport();
assert.equal(yAfter.zoomY, yBefore.zoomY);
assert.equal(yAfter.panY, yBefore.panY);

const grid = buildPipelineCadEngineeringGrid(
  { minX: 0, maxX: 100, minY: -5, maxY: 5 },
  { width: 1000, height: 500 },
);
assert.equal(grid.schema, 'WorkbenchGridModel.v1');
assert.notEqual(grid.xMajorStep, grid.yMajorStep);
assert.ok(grid.xMajor.length + grid.yMajor.length < 240);

const shell = pipelineCadViewportShellModel();
assert.ok(shell.actions.some((action) => action.id === 'fit'));
assert.ok(shell.actions.some((action) => action.id === 'link-x'));
assert.deepEqual(normalizePipelineCadSnapSettings({ stationStep: -1 }), DEFAULT_PIPELINE_CAD_SNAP_SETTINGS);

host2.dispose();
host3.dispose();
table2x.destroy();
table3x.destroy();
console.log('pipeline-3d-model CAD viewport adapter tests passed');
