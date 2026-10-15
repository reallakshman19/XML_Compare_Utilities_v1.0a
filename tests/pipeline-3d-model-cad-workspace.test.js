import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PipelineCadController,
  readPipelineCadRaw,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-controller.js';
import {
  buildPipelineCadStageHtml,
  isPipelineCadCanvasEnabled,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-workspace.js';
import { Table2XCanvas } from '../tabs/pipeline-3d-model/pipeline-3d-model-table2x-canvas.js';
import { Table3XCanvas } from '../tabs/pipeline-3d-model/pipeline-3d-model-table3x-canvas.js';

const RAW = {
  table2a: `H(coor)\tV(coor)\t[H vs V] Length\tStation Text\tElevation Text
659.791\t—\t—\t0+000.0\t231.32
668.540\t-715.825 → -650.258\t65.567\t0+006.7\t230.95
680.803\t-715.825 → -650.258\t65.567\t0+019.0\t230.82
732.683\t—\t—\t0+070.8\t233.00`,
  table3a: `From H(coor)\tTo H(coor)\tText Position X\tHLength Text
661.791\t682.337\t671.704\t20.5
682.337\t716.683\t700.435\t34.3
716.683\t732.683\t723.927\t16.0`,
  table3b: `From H(coor)\tTo H(coor)\tText Position X\tZ Text
—\t—\t665.621\tA/G
682.337\t732.683\t708.374\t1.5M`,
  table3c: `Text Position X\tMarker Text
688.135\tPM-001`,
};

class FakeTextArea extends EventTarget {
  constructor(value, slotName) {
    super();
    this.value = value;
    this.slotName = slotName;
  }

  matches(selector) {
    return selector === '[data-p3d-split$="-raw"]' && this.slotName.endsWith('-raw');
  }
}

class FakeDialog {
  constructor(raw) {
    this.listeners = new Map();
    this.elements = Object.fromEntries(Object.entries(raw).map(([name, value]) => [
      `[data-p3d-split="${name}-raw"]`,
      new FakeTextArea(value, `${name}-raw`),
    ]));
  }

  querySelector(selector) {
    return this.elements[selector] || null;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((candidate) => candidate !== listener));
  }

  emit(type, target) {
    for (const listener of this.listeners.get(type) || []) listener({ target });
  }
}

class FakeGraph extends EventTarget {
  constructor() {
    super();
    this.model = null;
    this.setModelCalls = [];
    this.reloadCount = 0;
  }

  setModel(model, options) {
    this.model = model;
    this.setModelCalls.push({ model, options });
  }

  reloadGraph() {
    this.reloadCount += 1;
  }
}

const flagStorage = {
  value: null,
  getItem() { return this.value; },
};
assert.equal(isPipelineCadCanvasEnabled({ location: { search: '?pipelineCadCanvas=1' }, storage: flagStorage }), true);
assert.equal(isPipelineCadCanvasEnabled({ location: { search: '' }, storage: { getItem: () => 'enabled' } }), true);
assert.equal(isPipelineCadCanvasEnabled({ location: { search: '' }, storage: { getItem: () => null } }), false);

const table2Markup = buildPipelineCadStageHtml('table2x');
assert.match(table2Markup, /data-p3d-cad-tool="select"/);
assert.match(table2Markup, /data-p3d-cad-tool="add-node"/);
assert.doesNotMatch(table2Markup, /data-p3d-cad-tool="add-marker"/);
assert.match(table2Markup, /data-p3d-cad-action="reload"/);
assert.match(table2Markup, /data-p3d-cad-sentinel/);
const table3Markup = buildPipelineCadStageHtml('table3x');
assert.match(table3Markup, /data-p3d-cad-tool="add-marker"/);
assert.match(table3Markup, /Interactive Table 3X depth and marker graph/);

const dialog = new FakeDialog(RAW);
assert.deepEqual(readPipelineCadRaw(dialog), RAW);
const controller = new PipelineCadController(dialog);
assert.equal(controller.lastError, null);
const table2Graph = new FakeGraph();
const table3Graph = new FakeGraph();
controller.attachGraphs({ table2x: table2Graph, table3x: table3Graph });
assert.equal(table2Graph.model, controller.model);
assert.equal(table3Graph.model, controller.model);

const viewportTable2 = new Table2XCanvas(null, { width: 1000, height: 400 });
viewportTable2.setModel(controller.model);
viewportTable2.zoomAt({ x: 500, y: 200 }, 2);
viewportTable2.panBy(35, -18);
const table2ViewportBeforeCommit = viewportTable2.getViewport();
viewportTable2.setModel(controller.model, { preserveSnapshot: true });
const table2ViewportAfterCommit = viewportTable2.getViewport();
assert.equal(table2ViewportAfterCommit.zoom, table2ViewportBeforeCommit.zoom, 'Table 2 commit must preserve zoom');
assert.equal(table2ViewportAfterCommit.panX, table2ViewportBeforeCommit.panX, 'Table 2 commit must preserve pan X');
assert.equal(table2ViewportAfterCommit.panY, table2ViewportBeforeCommit.panY, 'Table 2 commit must preserve pan Y');
viewportTable2.visualOverrides.set('table2a-0003', 999);
viewportTable2.setModel(controller.model, { preserveSnapshot: false });
assert.equal(viewportTable2.visualOverrides.size, 0, 'manual raw reload must clear Table 2 drag overrides');

const viewportTable3 = new Table3XCanvas(null, { width: 1000, height: 400 });
viewportTable3.setModel(controller.model);
viewportTable3.zoomAt({ x: 500, y: 200 }, 1.8);
viewportTable3.panBy(-21, 14);
const table3ViewportBeforeCommit = viewportTable3.getViewport();
viewportTable3.setModel(controller.model, { preserveSnapshot: true });
const table3ViewportAfterCommit = viewportTable3.getViewport();
assert.equal(table3ViewportAfterCommit.zoom, table3ViewportBeforeCommit.zoom, 'Table 3 commit must preserve zoom');
assert.equal(table3ViewportAfterCommit.panX, table3ViewportBeforeCommit.panX, 'Table 3 commit must preserve pan X');
assert.equal(table3ViewportAfterCommit.panY, table3ViewportBeforeCommit.panY, 'Table 3 commit must preserve pan Y');
viewportTable3.markerOverrides.set('table3c-0001', 999);
viewportTable3.setModel(controller.model, { preserveSnapshot: false });
assert.equal(viewportTable3.markerOverrides.size, 0, 'manual raw reload must clear Table 3 drag overrides');

const table2GraphIdentity = table2Graph;
table2Graph.dispatchEvent(new CustomEvent('nodeMoved', {
  detail: {
    graph: 'table2x',
    entityId: 'table2a-0003',
    entityType: 'elevation-node',
    after: { elevationValue: 235 },
  },
}));
const table2Text = dialog.querySelector('[data-p3d-split="table2a-raw"]').value;
const changedTable2Row = table2Text.split('\n').find((line) => line.includes('0+019.0'));
assert.equal(changedTable2Row.split('\t')[2], '65.567', 'drag must not overwrite the length column');
assert.equal(changedTable2Row.split('\t')[4], '235.00', 'drag must update Elevation Text');
assert.equal(table2Graph, table2GraphIdentity, 'graph instance must survive raw synchronization');
assert.ok(controller.model.dirtyRowIds.has('table2a-0003'));
assert.equal(table2Graph.setModelCalls.at(-1).options.preserveSnapshot, true);

const markerBefore = controller.model.table3MarkerRows[0].absoluteH;
table3Graph.dispatchEvent(new CustomEvent('nodeMoved', {
  detail: {
    graph: 'table3x',
    entityId: 'table3c-0001',
    entityType: 'marker',
    after: { cumulative: 40, absoluteH: 702.450 },
  },
}));
assert.notEqual(controller.model.table3MarkerRows[0].absoluteH, markerBefore);
assert.match(dialog.querySelector('[data-p3d-split="table3c-raw"]').value, /^702\.45\tPM-001$/m);

const markerCount = controller.model.table3MarkerRows.length;
table3Graph.dispatchEvent(new CustomEvent('nodeAdded', {
  detail: { graph: 'table3x', entityType: 'marker', cumulative: 45, absoluteH: 707.5 },
}));
assert.equal(controller.model.table3MarkerRows.length, markerCount + 1);
assert.ok(controller.model.table3MarkerRows.some((row) => row.markerText === 'PM-002'));
const addedMarker = controller.model.table3MarkerRows.find((row) => row.markerText === 'PM-002');
table3Graph.dispatchEvent(new CustomEvent('nodeDeleted', {
  detail: { graph: 'table3x', entityType: 'marker', entityId: addedMarker.id },
}));
assert.equal(controller.model.table3MarkerRows.some((row) => row.id === addedMarker.id), false);
assert.equal(controller.undo(), true);
assert.equal(controller.model.table3MarkerRows.some((row) => row.id === addedMarker.id), true);
assert.equal(controller.redo(), true);
assert.equal(controller.model.table3MarkerRows.some((row) => row.id === addedMarker.id), false);

controller.reloadGraphs();
assert.equal(table2Graph.reloadCount > 0, true);
assert.equal(table3Graph.reloadCount > 0, true);
assert.equal(controller.model.dirtyRowIds.size, 0);

const rawTable2 = dialog.querySelector('[data-p3d-split="table2a-raw"]');
rawTable2.value = rawTable2.value.replace('235.00', '236.25');
const modelBeforeManualInput = controller.model;
dialog.emit('input', rawTable2);
assert.notEqual(controller.model, modelBeforeManualInput, 'manual typing must rebuild the canonical model');
assert.equal(controller.model.table2Rows.find((row) => row.stationValue === 19).elevationValue, 236.25);
assert.equal(table2Graph, table2GraphIdentity, 'manual typing must not replace the graph object');
assert.equal(table2Graph.setModelCalls.at(-1).options.preserveSnapshot, false);

const configSource = readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-config.js', import.meta.url), 'utf8');
assert.match(configSource, /pipeline-3d-model-cad-workspace\.js/);

controller.destroy();
console.log('pipeline-3d-model CAD workspace tests passed');
