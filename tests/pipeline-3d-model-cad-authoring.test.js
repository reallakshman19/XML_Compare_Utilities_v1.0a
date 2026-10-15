import assert from 'node:assert/strict';
import '../tabs/pipeline-3d-model/pipeline-3d-model-cad-authoring.js';
import {
  DEFAULT_PIPELINE_CAD_SNAP_SETTINGS,
  describePipelineCadSnapSettings,
  normalizePipelineCadSnapSettings,
  roundToSnapStep,
  snapTable2Elevation,
  snapTable2Station,
  snapTable3Cumulative,
  snapTable3Depth,
  table3StationCandidates,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-snap.js';
import {
  PipelineCadShortcut,
  isPipelineCadEditableTarget,
  resolvePipelineCadShortcut,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-shortcuts.js';
import { PipelineProfileModel } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-model.js';
import { Table2XCanvas } from '../tabs/pipeline-3d-model/pipeline-3d-model-table2x-canvas.js';
import { Table3XCanvas } from '../tabs/pipeline-3d-model/pipeline-3d-model-table3x-canvas.js';

const model = {
  table2Rows: [
    { id: 'a', stationValue: 0 },
    { id: 'b', stationValue: 19 },
    { id: 'c', stationValue: 31.9 },
  ],
  coordinateMap: {
    cumulativeMin: 0,
    cumulativeMax: 70.8,
    anchors: [
      { cumulative: 0, absoluteH: 661.791 },
      { cumulative: 20.5, absoluteH: 682.337 },
      { cumulative: 54.8, absoluteH: 716.683 },
      { cumulative: 70.8, absoluteH: 732.683 },
    ],
  },
};

assert.equal(DEFAULT_PIPELINE_CAD_SNAP_SETTINGS.gridEnabled, false);
assert.equal(roundToSnapStep(12.37, 0.5), 12.5);
assert.equal(roundToSnapStep(-1.24, 0.1), -1.2);
assert.equal(snapTable2Elevation(235.037, { gridEnabled: true, elevationStep: 0.05 }), 235.05);
assert.equal(snapTable2Station(18.55, model, { stationEnabled: true, stationTolerance: 0.6 }), 19);
assert.equal(snapTable2Station(18.55, model, { stationEnabled: true, stationTolerance: 0.6 }, { excludeIds: ['b'] }), 18.55);
assert.deepEqual(table3StationCandidates(model), [0, 20.5, 54.8, 70.8]);
assert.equal(snapTable3Cumulative(20.2, model, { stationEnabled: true, stationTolerance: 0.5 }), 20.5);
assert.equal(snapTable3Cumulative(71.2, model, { gridEnabled: true, stationStep: 0.5 }), 70.8);
assert.equal(snapTable3Depth(-1.24, { gridEnabled: true, depthStep: 0.1 }), -1.2);
assert.equal(snapTable3Depth(-0.05, { aboveGroundTolerance: 0.15, aboveGroundZ: 0.75 }), 0.75);
assert.equal(describePipelineCadSnapSettings({ gridEnabled: true, stationEnabled: true }), 'Grid + Station snap');
assert.equal(normalizePipelineCadSnapSettings({ stationStep: -1 }).stationStep, 0.5);

assert.equal(resolvePipelineCadShortcut({ key: 'v' }, 'table2x'), PipelineCadShortcut.SELECT);
assert.equal(resolvePipelineCadShortcut({ key: 'n' }, 'table2x'), PipelineCadShortcut.ADD_NODE);
assert.equal(resolvePipelineCadShortcut({ key: 'm' }, 'table2x'), null);
assert.equal(resolvePipelineCadShortcut({ key: 'm' }, 'table3x'), PipelineCadShortcut.ADD_MARKER);
assert.equal(resolvePipelineCadShortcut({ key: 'Delete' }, 'table3x'), PipelineCadShortcut.DELETE_SELECTION);
assert.equal(resolvePipelineCadShortcut({ key: 'z', ctrlKey: true }, 'table3x'), PipelineCadShortcut.UNDO);
assert.equal(resolvePipelineCadShortcut({ key: 'z', ctrlKey: true, shiftKey: true }, 'table3x'), PipelineCadShortcut.REDO);
assert.equal(resolvePipelineCadShortcut({ key: 'g' }, 'table3x'), PipelineCadShortcut.TOGGLE_GRID_SNAP);
assert.equal(resolvePipelineCadShortcut({ key: 's' }, 'table3x'), PipelineCadShortcut.TOGGLE_STATION_SNAP);
assert.equal(isPipelineCadEditableTarget({ tagName: 'INPUT' }), true);
assert.equal(resolvePipelineCadShortcut({ key: 'x', target: { tagName: 'INPUT' } }, 'table3x'), null);

const raw = {
  table2a: `H(coor)\tV(coor)\t[H vs V] Length\tStation Text\tElevation Text
659.791\t—\t—\t0+000.0\t231.32
668.540\t—\t—\t0+006.7\t230.95
680.803\t—\t—\t0+019.0\t230.82
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
const profile = PipelineProfileModel.fromRaw(raw);
const table2 = new Table2XCanvas(null, { width: 1000, height: 400 });
table2.setModel(profile);
table2.setSnapSettings({ gridEnabled: true, elevationStep: 0.05 });
let table2Move = null;
table2.addEventListener('nodeMoved', (event) => { table2Move = event.detail; });
const table2Node = table2.currentNodes().find((node) => node.id === 'table2a-0003');
table2.draggingId = table2Node.id;
table2.onPrimaryPointerUp({}, table2.worldToScreen(table2Node), { x: table2Node.x, y: 235.037 });
assert.equal(table2Move.after.elevationValue, 235.05, 'Table 2 drag must use elevation grid snap');

const table3 = new Table3XCanvas(null, { width: 1000, height: 400 });
table3.setModel(profile);
table3.setSnapSettings({ stationEnabled: true, stationTolerance: 0.5 });
let markerMove = null;
table3.addEventListener('nodeMoved', (event) => { markerMove = event.detail; });
const marker = table3.markerNodes()[0];
table3.dragging = { id: marker.id, type: 'marker' };
table3.onPrimaryPointerUp({}, table3.worldToScreen(marker), { x: 20.2, y: marker.y });
assert.equal(markerMove.after.cumulative, 20.5, 'Marker must snap to the nearest HLength anchor');
assert.ok(Number.isFinite(markerMove.after.absoluteH));

table3.setSnapSettings({ gridEnabled: true, depthStep: 0.1, aboveGroundTolerance: 0.15 });
let depthMove = null;
table3.addEventListener('nodeMoved', (event) => { if (event.detail.entityType === 'depth-node') depthMove = event.detail; });
const depth = table3.depthNodes()[0];
table3.dragging = { id: depth.id, type: 'depth-node' };
table3.onPrimaryPointerUp({}, table3.worldToScreen(depth), { x: depth.x, y: -0.05 });
assert.equal(depthMove.after.z, 0.75, 'Near-grade depth must snap to A/G position');

console.log('pipeline-3d-model CAD authoring tests passed');
