import { SnapshotCommand } from './pipeline-3d-model-cad-commands.js';

function uniqueIds(ids = []) { return [...new Set((ids || []).map(String).filter(Boolean))]; }
function requireBatch(values, label) {
  if (!values.length) throw new TypeError(`${label} requires at least one valid row.`);
  return values;
}
function validateDeleteBatch(model, rowIds) {
  const removed = new Set(rowIds);
  const remainingTable2 = (model?.table2Rows || []).filter((row) => !removed.has(row.id)
    && Number.isFinite(row.stationValue) && Number.isFinite(row.basisH));
  if (remainingTable2.length < 2) {
    throw new Error('Batch delete would violate the Table 2 station authority minimum.');
  }
  return rowIds;
}
function ownedEdits(model, edits, valueKey, sourceTable, label) {
  const values = new Map();
  for (const edit of edits || []) {
    const id = String(edit?.id || ''); const value = Number(edit?.[valueKey]);
    const row = id ? model?.findRow?.(id) : null;
    if (row?.sourceTable === sourceTable && Number.isFinite(value)) {
      values.set(id, Object.freeze({ id, [valueKey]: value }));
    }
  }
  return requireBatch(Object.freeze([...values.values()]), label);
}

export function deleteProfileRowsCommand(model, ids = []) {
  const rowIds = validateDeleteBatch(model, requireBatch(
    uniqueIds(ids).filter((id) => model?.findRow?.(id)), 'Batch delete',
  ));
  return new SnapshotCommand(model, `Delete ${rowIds.length} profile rows`, (target) => {
    for (const id of rowIds) target.deleteRow(id);
  });
}

export function moveTable2RowsCommand(model, edits = []) {
  const rows = ownedEdits(model, edits, 'elevation', 'table2a', 'Table 2 batch move');
  return new SnapshotCommand(model, `Move ${rows.length} Table 2 rows`, (target) => {
    for (const row of rows) target.moveTable2Elevation(row.id, row.elevation);
  });
}

export function moveTable3MarkerRowsCommand(model, edits = []) {
  const rows = ownedEdits(model, edits, 'absoluteH', 'table3c', 'Table 3 marker batch move');
  return new SnapshotCommand(model, `Move ${rows.length} Table 3 markers`, (target) => {
    for (const row of rows) target.moveMarker(row.id, row.absoluteH);
  });
}

export const _test = Object.freeze({ ownedEdits, uniqueIds, validateDeleteBatch });
