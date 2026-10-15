import assert from 'node:assert/strict';
import {
  buildMonotonicCoordinateMap,
  formatDepth,
  formatStation,
  interpolateAbsoluteHFromCumulative,
  interpolateCumulativeFromAbsoluteH,
  parseDepthText,
  parseStation,
  projectPointToSegment,
  screenXToWorldX,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-math.js';
import {
  PipelineProfileModel,
  parseTable2ARows,
  parseTable3BRows,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-model.js';
import {
  CommandHistory,
  moveTable2ElevationCommand,
  moveTable3MarkerCommand,
  addTable2NodeCommand,
  addTable3MarkerCommand,
  deleteProfileRowCommand,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-commands.js';
import { InteractiveGraph } from '../tabs/pipeline-3d-model/pipeline-3d-model-interactive-graph.js';
import { Table2XCanvas } from '../tabs/pipeline-3d-model/pipeline-3d-model-table2x-canvas.js';
import { Table3XCanvas } from '../tabs/pipeline-3d-model/pipeline-3d-model-table3x-canvas.js';

const RAW = {
  table2a: `H(coor)\tV(coor)\t[H vs V] Length\tStation Text\tElevation Text
659.791\t—\t—\t0+000.0\t231.32
668.540\t-715.825 → -650.258\t65.567\t0+006.7\t230.95
680.803\t-715.825 → -650.258\t65.567\t0+019.0\t230.82
682.337 → 732.683\t—\t—\t—\t—`,
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

assert.equal(formatStation(12.5), '0+012.5');
assert.equal(formatStation(1012.5), '1+012.5');
assert.equal(parseStation('0+019.0'), 19);
assert.equal(parseStation('bad'), null);
assert.equal(formatDepth(0.75), 'A/G');
assert.equal(formatDepth(-1.2), '1.2M');
assert.deepEqual(parseDepthText('A/G'), { mode: 'ABOVE_GROUND', z: 0.75, depth: 0 });
assert.deepEqual(parseDepthText('1.5M'), { mode: 'DEPTH', z: -1.5, depth: 1.5 });

const coordinateMap = buildMonotonicCoordinateMap([
  { cumulative: 0, absoluteH: 661.791 },
  { cumulative: 20.5, absoluteH: 682.337 },
  { cumulative: 54.8, absoluteH: 716.683 },
  { cumulative: 70.8, absoluteH: 732.683 },
]);
const absoluteH = interpolateAbsoluteHFromCumulative(52.4, coordinateMap);
assert.ok(Math.abs(interpolateCumulativeFromAbsoluteH(absoluteH, coordinateMap) - 52.4) < 1e-9);
assert.equal(interpolateAbsoluteHFromCumulative(-10, coordinateMap), 661.791);
assert.equal(interpolateAbsoluteHFromCumulative(999, coordinateMap), 732.683);
assert.throws(() => buildMonotonicCoordinateMap([
  { cumulative: 0, absoluteH: 10 },
  { cumulative: 1, absoluteH: 12 },
  { cumulative: 2, absoluteH: 11 },
]), /strictly monotonic/);
assert.throws(() => buildMonotonicCoordinateMap([
  { cumulative: 0, absoluteH: 10 },
  { cumulative: 0, absoluteH: 11 },
]), /Conflicting/);

assert.equal(screenXToWorldX(450, { plotLeft: 60, plotWidth: 880, worldMin: 0, worldMax: 118.2 }).toFixed(2), '52.38');
const projection = projectPointToSegment({ x: 5, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 });
assert.deepEqual({ x: projection.x, y: projection.y, t: projection.t }, { x: 5, y: 0, t: 0.5 });

const table2Rows = parseTable2ARows(RAW.table2a);
assert.equal(table2Rows[2].id, 'table2a-0003');
assert.equal(table2Rows[2].stationValue, 19);
assert.equal(table2Rows[3].hCoordinate.kind, 'range');
assert.equal(table2Rows[3].basisH, 732.683);
const depthRows = parseTable3BRows(RAW.table3b);
assert.equal(depthRows[0].zMode, 'ABOVE_GROUND');
assert.equal(depthRows[1].z, -1.5);
assert.equal(depthRows[1].absoluteH, 708.374);

const model = PipelineProfileModel.fromRaw(RAW);
assert.equal(model.table3MarkerRows[0].absoluteH, 688.135);
assert.equal(model.coordinateMap.cumulativeMax, 70.8);
model.moveTable2Elevation('table2a-0003', 235);
assert.equal(model.table2Rows[2].elevationText, '235.00');
assert.match(model.serializeRaw().table2a, /0\+019\.0\t235\.00/);
model.moveDepth('table3b-0002', -1.2);
assert.match(model.serializeRaw().table3b, /1\.2M/);
model.moveMarker('table3c-0001', 684.215);
assert.match(model.serializeRaw().table3c, /^684\.215\tPM-001$/m);
assert.ok(model.dirtyRowIds.has('table3c-0001'));

const history = new CommandHistory();
history.execute(moveTable2ElevationCommand(model, 'table2a-0003', 240));
assert.equal(model.table2Rows[2].elevationValue, 240);
assert.equal(history.canUndo, true);
assert.equal(history.undo(), true);
assert.equal(model.table2Rows[2].elevationValue, 235);
assert.equal(history.redo(), true);
assert.equal(model.table2Rows[2].elevationValue, 240);
history.execute(moveTable3MarkerCommand(model, 'table3c-0001', 690));
assert.equal(model.table3MarkerRows[0].absoluteH, 690);
history.execute(addTable2NodeCommand(model, { stationValue: 12.5, elevationValue: 233.4, afterId: 'table2a-0002', beforeId: 'table2a-0003' }));
const insertedTable2 = model.table2Rows.find((row) => row.stationValue === 12.5);
assert.ok(insertedTable2);
assert.equal(insertedTable2.stationText, '0+012.5');
assert.ok(Number.isFinite(insertedTable2.basisH));
history.execute(addTable3MarkerCommand(model, { absoluteH: 700.25, markerText: 'PM-002' }));
const addedMarker = model.table3MarkerRows.find((row) => row.markerText === 'PM-002');
assert.ok(addedMarker);
history.execute(deleteProfileRowCommand(model, addedMarker.id));
assert.equal(model.table3MarkerRows.some((row) => row.id === addedMarker.id), false);
assert.equal(history.undo(), true);
assert.equal(model.table3MarkerRows.some((row) => row.id === addedMarker.id), true);

const graph = new InteractiveGraph(null, { width: 1000, height: 400 });
graph.setWorldBounds({ minX: 0, maxX: 100, minY: -10, maxY: 10 });
const world = { x: 25, y: -4 };
const screen = graph.worldToScreen(world);
const roundTrip = graph.screenToWorld(screen);
assert.ok(Math.abs(roundTrip.x - world.x) < 1e-9);
assert.ok(Math.abs(roundTrip.y - world.y) < 1e-9);
const beforeZoom = graph.screenToWorld(screen);
graph.zoomAt(screen, 2);
const afterZoom = graph.screenToWorld(screen);
assert.ok(Math.abs(afterZoom.x - beforeZoom.x) < 1e-9);
assert.ok(Math.abs(afterZoom.y - beforeZoom.y) < 1e-9);

const canvasModel = PipelineProfileModel.fromRaw(RAW);
const table2Canvas = new Table2XCanvas(null, { width: 1000, height: 400 });
table2Canvas.setModel(canvasModel);
const snapshotBefore = table2Canvas.renderSnapshot.map((point) => ({ ...point }));
const movingNode = table2Canvas.currentNodes().find((node) => node.id === 'table2a-0003');
const movingScreen = table2Canvas.worldToScreen(movingNode);
table2Canvas.onPrimaryPointerDown({ button: 0 }, movingScreen, movingNode);
let table2MoveEvent = null;
table2Canvas.addEventListener('nodeMoved', (event) => { table2MoveEvent = event.detail; });
table2Canvas.onPrimaryPointerMove({}, movingScreen, { x: movingNode.x, y: 235 });
table2Canvas.onPrimaryPointerUp({}, movingScreen, { x: movingNode.x, y: 235 });
assert.equal(table2MoveEvent.entityId, 'table2a-0003');
assert.equal(table2MoveEvent.after.elevationValue, 235);
assert.deepEqual(table2Canvas.renderSnapshot, snapshotBefore, 'profile snapshot must remain stable before Reload Graph');

const table3Canvas = new Table3XCanvas(null, { width: 1000, height: 400 });
table3Canvas.setModel(canvasModel);
const marker = table3Canvas.markerNodes()[0];
const markerScreen = table3Canvas.worldToScreen(marker);
let markerMoveEvent = null;
table3Canvas.addEventListener('nodeMoved', (event) => { markerMoveEvent = event.detail; });
table3Canvas.onPrimaryPointerDown({ button: 0 }, markerScreen, marker);
table3Canvas.onPrimaryPointerMove({}, markerScreen, { x: 40, y: marker.y });
table3Canvas.onPrimaryPointerUp({}, markerScreen, { x: 40, y: marker.y });
assert.equal(markerMoveEvent.entityType, 'marker');
assert.equal(markerMoveEvent.after.cumulative, 40);
assert.ok(Number.isFinite(markerMoveEvent.after.absoluteH));
assert.ok(Math.abs(interpolateCumulativeFromAbsoluteH(markerMoveEvent.after.absoluteH, canvasModel.coordinateMap) - 40) < 1e-9);

console.log('pipeline-3d-model CAD foundation tests passed');
