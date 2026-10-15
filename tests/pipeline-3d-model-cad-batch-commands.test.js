import assert from 'node:assert/strict';
import {
  deleteProfileRowsCommand,
  moveTable2RowsCommand,
  moveTable3MarkerRowsCommand,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-batch-commands.js';
import { _test as batchControllerTest } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-batch-controller.js';
import {
  CommandHistory,
  deleteProfileRowCommand,
  SnapshotCommand,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-commands.js';
import { PipelineProfileModel } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-model.js';

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
688.135\tPM-001
700.000\tPM-002`,
};

function createModel() { return PipelineProfileModel.fromRaw(raw); }

const moved = createModel(); const history = new CommandHistory();
const rows = moved.table2Rows.slice(1, 3); const elevations = rows.map((row) => row.elevationValue);
history.execute(moveTable2RowsCommand(moved, rows.map((row, index) => ({
  id: row.id, elevation: elevations[index] + 1,
}))));
history.undo(); assert.deepEqual(rows.map((row) => moved.findRow(row.id).elevationValue), elevations);
history.redo(); assert.deepEqual(rows.map((row) => moved.findRow(row.id).elevationValue), elevations.map((value) => value + 1));

const markers = moved.table3MarkerRows; const markerBefore = markers.map((row) => row.absoluteH);
history.execute(moveTable3MarkerRowsCommand(moved, markers.map((row, index) => ({
  id: row.id, absoluteH: markerBefore[index] + 2,
}))));
assert.deepEqual(markers.map((row) => moved.findRow(row.id).absoluteH), markerBefore.map((value) => value + 2));

const deleted = createModel(); const deleteHistory = new CommandHistory();
const deleteIds = [deleted.table2Rows[1].id, deleted.table3MarkerRows[0].id];
deleteHistory.execute(deleteProfileRowsCommand(deleted, deleteIds));
assert.ok(deleteIds.every((id) => !deleted.findRow(id)));
deleteHistory.undo(); assert.ok(deleteIds.every((id) => deleted.findRow(id)));
deleteHistory.redo(); assert.ok(deleteIds.every((id) => !deleted.findRow(id)));

const twoAnchors = createModel();
twoAnchors.table2Rows = twoAnchors.table2Rows.slice(0, 2);
const beforeRaw = twoAnchors.serializeRaw(); const beforeRevision = twoAnchors.revision;
assert.throws(() => deleteProfileRowCommand(twoAnchors, twoAnchors.table2Rows[0].id), /authority minimum/);
assert.deepEqual(twoAnchors.serializeRaw(), beforeRaw);
assert.equal(twoAnchors.revision, beforeRevision);

const oneMarker = createModel(); const oneMarkerHistory = new CommandHistory();
const markerId = oneMarker.table3MarkerRows[0].id;
oneMarkerHistory.execute(deleteProfileRowCommand(oneMarker, markerId));
assert.equal(oneMarker.findRow(markerId), null);
oneMarkerHistory.undo(); assert(oneMarker.findRow(markerId));
oneMarkerHistory.redo(); assert.equal(oneMarker.findRow(markerId), null);

const rollback = createModel(); const rollbackHistory = new CommandHistory();
const rollbackRaw = rollback.serializeRaw(); const rollbackRevision = rollback.revision;
const rollbackMarker = rollback.table3MarkerRows[0];
assert.throws(() => rollbackHistory.execute(new SnapshotCommand(rollback, 'rollback proof', (target) => {
  target.moveMarker(rollbackMarker.id, rollbackMarker.absoluteH + 10);
  throw new Error('incomplete command');
})), /incomplete command/);
assert.deepEqual(rollback.serializeRaw(), rollbackRaw);
assert.equal(rollback.revision, rollbackRevision);
assert.equal(rollbackHistory.undoStack.length, 0);

const immutableIds = batchControllerTest.frozenIds(['row-2', 'row-1']);
assert.equal(Object.isFrozen(immutableIds), true);
assert.throws(() => immutableIds.push('row-3'), TypeError);

const invalid = createModel();
assert.throws(() => deleteProfileRowsCommand(invalid, invalid.table2Rows.map((row) => row.id)), /authority minimum/);
assert.throws(() => moveTable2RowsCommand(moved, [{ id: markers[0].id, elevation: 1 }]), /valid row/);
assert.throws(() => moveTable3MarkerRowsCommand(moved, [{ id: moved.table3DepthRows[0].id, absoluteH: 1 }]), /valid row/);
console.log('Pipeline CAD batch command tests passed');