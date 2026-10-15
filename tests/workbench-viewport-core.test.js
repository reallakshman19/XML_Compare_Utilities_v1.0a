import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MAX_WORKBENCH_GRID_LINES,
  WORKBENCH_VIEWPORT_HOST_SCHEMA,
  WorkbenchViewportCapability,
  WorkbenchViewportScaleMode,
  buildWorkbenchGridModel,
  buildWorkbenchGridValues,
  buildWorkbenchViewportShellModel,
  createWorkbenchTransform,
  createWorkbenchViewportHost,
  hostSupports,
  loadWorkbenchViewportState,
  normalizeWorkbenchViewportState,
  saveWorkbenchViewportState,
  selectWorkbenchGridStep,
  validateWorkbenchViewportHost,
  workbenchHorizontalViewForRange,
  workbenchScreenToWorld,
  workbenchViewForRange,
  workbenchViewportPersistenceKey,
  workbenchViewportScaleRatio,
  workbenchVisibleRange,
  workbenchWorldToScreen,
} from '../core/workbench-viewport/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORE = path.join(ROOT, 'core/workbench-viewport');

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function close(actual, expected, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} must be close to ${expected}`);
}

function createSyntheticHost(spec) {
  const listeners = new Set();
  const view = { zoomX: 1, zoomY: 1, panX: 0, panY: 0 };
  const model = deepFreeze(spec.model);
  return createWorkbenchViewportHost({
    schema: WORKBENCH_VIEWPORT_HOST_SCHEMA,
    namespace: spec.namespace,
    surfaceId: spec.surfaceId,
    modeId: spec.modeId,
    capabilities: spec.capabilities,
    getPlotBounds: () => ({ left: 0, top: 0, width: 800, height: 400 }),
    getWorldBounds: () => spec.bounds,
    worldToScreen: (point) => point,
    screenToWorld: (point) => point,
    readViewTransform: () => Object.freeze({ ...view }),
    applyViewTransform: (next) => Object.assign(view, next),
    invalidate: () => true,
    formatPointer: spec.formatPointer,
    statusSegments: () => spec.statusSegments,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    dispose: () => listeners.clear(),
    getDomainModel: () => model,
  });
}

function functionLineCounts(source) {
  const lines = source.split(/\r?\n/);
  const counts = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!/\bfunction\s+\w+\s*\(/.test(lines[index])) continue;
    let depth = 0;
    let end = index;
    for (; end < lines.length; end += 1) {
      depth += (lines[end].match(/{/g) || []).length;
      depth -= (lines[end].match(/}/g) || []).length;
      if (end > index && depth <= 0) break;
    }
    counts.push(end - index + 1);
  }
  return counts;
}

const ratioState = normalizeWorkbenchViewportState({
  namespace: 'consumer-a',
  surfaceId: 'profile',
  modeId: 'comparison',
  scaleMode: WorkbenchViewportScaleMode.RATIO,
  xScale: 1000,
  yScale: 100,
});
assert.equal(ratioState.zoomY, 10);
assert.equal(workbenchViewportScaleRatio(1000, 100), 10);
assert.equal(ratioState.customRange, null);
assert.equal(normalizeWorkbenchViewportState({ customRange: { minX: 3, maxX: 2, minY: 0, maxY: 1 } }).customRange, null);

const storage = new MemoryStorage();
const xmlState = normalizeWorkbenchViewportState({ namespace: 'consumer-b', surfaceId: 'tree', modeId: 'hierarchy' });
saveWorkbenchViewportState(ratioState, storage);
saveWorkbenchViewportState(xmlState, storage);
assert.equal(storage.values.size, 2);
assert.notEqual(workbenchViewportPersistenceKey(ratioState), workbenchViewportPersistenceKey(xmlState));
assert.equal(loadWorkbenchViewportState(ratioState, storage).xScale, 1000);
storage.setItem(workbenchViewportPersistenceKey(xmlState), '{broken');
assert.equal(loadWorkbenchViewportState(xmlState, storage).namespace, 'consumer-b');

assert.equal(selectWorkbenchGridStep(100, 1000, 100), 10);
assert.deepEqual(buildWorkbenchGridValues(0, 10, 2), [0, 2, 4, 6, 8, 10]);
const grid = buildWorkbenchGridModel(
  { minX: 0, maxX: 100, minY: -2, maxY: 3 },
  { width: 1000, height: 500 },
);
assert.equal(grid.schema, 'WorkbenchGridModel.v1');
assert.ok(grid.xMajor.length <= MAX_WORKBENCH_GRID_LINES);
assert.ok(grid.yMajor.length <= MAX_WORKBENCH_GRID_LINES);
assert.ok(grid.xMinor.length <= MAX_WORKBENCH_GRID_LINES);
assert.ok(grid.yMinor.length <= MAX_WORKBENCH_GRID_LINES);
assert.ok(grid.xMinor.every((value) => !grid.xMajor.includes(value)));

const bounds = { minX: 0, maxX: 100, minY: -10, maxY: 10 };
const plot = { left: 20, top: 10, width: 960, height: 460 };
const transform = createWorkbenchTransform(bounds, plot, { zoomX: 1.4, zoomY: 2.1, panX: 13, panY: -7 });
const point = { x: 34.5, y: -2.25 };
const roundTrip = workbenchScreenToWorld(transform, workbenchWorldToScreen(transform, point));
close(roundTrip.x, point.x);
close(roundTrip.y, point.y);
const rangeView = workbenchViewForRange(bounds, plot, { minX: 20, maxX: 40, minY: -2, maxY: 2 });
const visible = workbenchVisibleRange(createWorkbenchTransform(bounds, plot, rangeView));
close(visible.minX, 20);
close(visible.maxX, 40);
close(visible.minY, -2);
close(visible.maxY, 2);
const linked = workbenchHorizontalViewForRange(bounds, plot, { minX: 10, maxX: 30 }, { zoomY: 7, panY: 9 });
assert.equal(linked.zoomY, 7);
assert.equal(linked.panY, 9);

const pipelineModel = deepFreeze({
  schema: 'PipelineProfile.v1',
  points: [{ station: 0, elevation: 231.2 }, { station: 50, elevation: 232.1 }],
});
const xmlModel = deepFreeze({
  schema: 'CategorizedGraph.v1',
  nodes: [{ nodeId: 'root', levelId: 'document' }],
});
const pipelineHost = createSyntheticHost({
  namespace: 'pipeline-profile',
  surfaceId: 'elevation-profile',
  modeId: 'side-by-side',
  capabilities: [WorkbenchViewportCapability.FIT, WorkbenchViewportCapability.RANGE, WorkbenchViewportCapability.SCALE_RATIO, WorkbenchViewportCapability.GRID, WorkbenchViewportCapability.LINK_X, 'snap-settings'],
  bounds: { minX: 0, maxX: 50, minY: 230, maxY: 233 },
  model: pipelineModel,
  formatPointer: (item) => `Chainage ${item.x} / Elevation ${item.y}`,
  statusSegments: ['Profile', 'Elevation'],
});
const xmlHost = createSyntheticHost({
  namespace: 'xml-builder',
  surfaceId: 'tree-preview',
  modeId: 'hierarchy',
  capabilities: [WorkbenchViewportCapability.FIT, WorkbenchViewportCapability.GRID, WorkbenchViewportCapability.CROSSHAIR, 'inspect-source'],
  bounds: { minX: 0, maxX: 20, minY: 0, maxY: 10 },
  model: xmlModel,
  formatPointer: (item) => `Level ${item.y} / Index ${item.x}`,
  statusSegments: ['Hierarchy', 'Tree preview'],
});
assert.equal(validateWorkbenchViewportHost(pipelineHost), true);
assert.equal(validateWorkbenchViewportHost(xmlHost), true);
assert.equal(hostSupports(pipelineHost, WorkbenchViewportCapability.LINK_X), true);
assert.equal(hostSupports(xmlHost, WorkbenchViewportCapability.LINK_X), false);
assert.ok(Object.isFrozen(pipelineHost.getDomainModel()));
assert.ok(Object.isFrozen(xmlHost.getDomainModel()));
const pipelineBefore = JSON.stringify(pipelineHost.getDomainModel());
pipelineHost.applyViewTransform({ zoomX: 2, panX: 10 });
assert.equal(JSON.stringify(pipelineHost.getDomainModel()), pipelineBefore);

const extensionActions = [
  { id: 'snap-settings', capability: 'snap-settings', label: 'Snap settings' },
  { id: 'inspect-source', capability: 'inspect-source', label: 'Inspect source' },
];
const pipelineShell = buildWorkbenchViewportShellModel(pipelineHost, { extensionActions });
const xmlShell = buildWorkbenchViewportShellModel(xmlHost, { extensionActions });
assert.ok(pipelineShell.actions.some((action) => action.id === 'snap-settings'));
assert.ok(!pipelineShell.actions.some((action) => action.id === 'inspect-source'));
assert.ok(xmlShell.actions.some((action) => action.id === 'inspect-source'));
assert.ok(!xmlShell.actions.some((action) => action.id === 'snap-settings'));
assert.throws(() => validateWorkbenchViewportHost({ schema: WORKBENCH_VIEWPORT_HOST_SCHEMA }), TypeError);

const coreFiles = fs.readdirSync(CORE).filter((file) => file.endsWith('.js'));
for (const file of coreFiles) {
  const source = fs.readFileSync(path.join(CORE, file), 'utf8');
  assert.ok(source.split(/\r?\n/).length <= 300, `${file} must stay below 300 lines`);
  assert.ok(functionLineCounts(source).every((count) => count <= 40), `${file} functions must stay below 40 lines where practical`);
  assert.doesNotMatch(source, /export\s+default\b/, `${file} must use named exports`);
  assert.doesNotMatch(source, /tabs\/pipeline-3d-model|xml-compare|table2x|table3x|PipelineProfile|CategorizedGraph/i, `${file} must remain domain-neutral`);
}

console.log('common workbench viewport core tests passed');
