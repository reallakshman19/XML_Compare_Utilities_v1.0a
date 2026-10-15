import assert from 'node:assert/strict';
import {
  CommandHistory,
  editTable2NodeCommand,
  editTable3DepthCommand,
  editTable3MarkerCommand,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-commands.js';
import { PipelineProfileModel } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-model.js';
import {
  precisionCanvasValues,
  readPipelineCadPrecisionBefore,
  stagePipelineCadPrecisionEdit,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-precision-adapters.js';

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

const model = PipelineProfileModel.fromRaw(raw);
const table2Identity = { graph: 'table2x', entityId: 'table2a-0003', entityType: 'elevation-node' };
const table2Before = readPipelineCadPrecisionBefore(model, table2Identity);
assert.deepEqual(table2Before, { station: 19, elevation: 230.82 });
const absolute = stagePipelineCadPrecisionEdit({
  model,
  identity: table2Identity,
  sessionId: 't2-absolute',
  fields: { inputMode: 'absolute', coordinateMode: 'cumulative', x: '20', y: '231.25' },
});
assert.deepEqual(absolute.staged, { station: 20, elevation: 231.25 });
assert.equal(model.findRow(table2Identity.entityId).stationValue, 19, 'typed preview must not mutate the model');
assert.deepEqual(precisionCanvasValues(absolute), { stationValue: 20, elevationValue: 231.25 });
const relative = stagePipelineCadPrecisionEdit({
  model,
  identity: table2Identity,
  sessionId: 't2-relative',
  fields: { inputMode: 'relative', coordinateMode: 'cumulative', x: '1', y: '-0.2' },
});
assert.equal(relative.staged.station, 20);
assert.equal(relative.staged.elevation, 230.62);
assert.throws(() => stagePipelineCadPrecisionEdit({
  model,
  identity: table2Identity,
  sessionId: 'bad-order',
  fields: { inputMode: 'absolute', x: '71', y: '231' },
}), /less than/);

const depthIdentity = { graph: 'table3x', entityId: 'table3b-0002', entityType: 'depth-node' };
const depthBefore = readPipelineCadPrecisionBefore(model, depthIdentity);
const depthAbsolute = stagePipelineCadPrecisionEdit({
  model,
  identity: depthIdentity,
  sessionId: 'depth-h',
  fields: { inputMode: 'absolute', coordinateMode: 'absolute-h', x: '710', y: '2.0M' },
});
assert.equal(depthAbsolute.staged.absoluteH, 710);
assert.equal(depthAbsolute.staged.z, -2);
assert.ok(Number.isFinite(depthAbsolute.staged.cumulative));
const depthRelative = stagePipelineCadPrecisionEdit({
  model,
  identity: depthIdentity,
  sessionId: 'depth-relative',
  fields: { inputMode: 'relative', coordinateMode: 'cumulative', x: '1', y: '-0.5' },
});
assert.equal(depthRelative.staged.z, -2);
assert.equal(depthRelative.staged.zText, '2.0M');
assert.equal(depthRelative.staged.cumulative, depthBefore.cumulative + 1);
const aboveGround = stagePipelineCadPrecisionEdit({
  model,
  identity: depthIdentity,
  sessionId: 'depth-ag',
  fields: { inputMode: 'absolute', coordinateMode: 'cumulative', x: String(depthBefore.cumulative), y: 'A/G' },
});
assert.equal(aboveGround.staged.z, 0.75);
assert.equal(aboveGround.staged.zText, 'A/G');

const markerIdentity = { graph: 'table3x', entityId: 'table3c-0001', entityType: 'marker' };
const marker = stagePipelineCadPrecisionEdit({
  model,
  identity: markerIdentity,
  sessionId: 'marker',
  fields: { inputMode: 'absolute', coordinateMode: 'absolute-h', x: '690', y: '', label: 'PM-002' },
});
assert.deepEqual(precisionCanvasValues(marker), {
  cumulative: marker.staged.cumulative,
  absoluteH: 690,
  markerText: 'PM-002',
});

const history = new CommandHistory();
history.execute(editTable2NodeCommand(model, table2Identity.entityId, absolute.staged));
assert.equal(model.findRow(table2Identity.entityId).stationValue, 20);
assert.equal(model.findRow(table2Identity.entityId).elevationValue, 231.25);
assert.match(model.serializeRaw().table2a, /0\+020\.0\t231\.25/);
history.undo();
assert.equal(model.findRow(table2Identity.entityId).stationValue, 19);
history.redo();
assert.equal(model.findRow(table2Identity.entityId).stationValue, 20);

history.execute(editTable3DepthCommand(model, depthIdentity.entityId, depthAbsolute.staged));
assert.equal(model.findRow(depthIdentity.entityId).absoluteH, 710);
assert.equal(model.findRow(depthIdentity.entityId).zText, '2.0M');
history.execute(editTable3MarkerCommand(model, markerIdentity.entityId, marker.staged));
assert.equal(model.findRow(markerIdentity.entityId).markerText, 'PM-002');
assert.equal(model.findRow(markerIdentity.entityId).absoluteH, 690);

console.log('Pipeline CAD precision adapter and command tests passed');
