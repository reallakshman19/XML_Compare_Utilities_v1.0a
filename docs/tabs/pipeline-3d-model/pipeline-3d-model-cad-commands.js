import {
  buildMonotonicCoordinateMap,
  formatDepth,
  formatStation,
  parseDepthText,
} from './pipeline-3d-model-cad-math.js';

export class SnapshotCommand {
  constructor(model, description, applyMutation) {
    if (!model || typeof model.snapshot !== 'function' || typeof model.restore !== 'function') {
      throw new TypeError('SnapshotCommand requires a snapshot-capable model.');
    }
    if (typeof applyMutation !== 'function') throw new TypeError('applyMutation must be a function.');
    this.model = model; this.description = description || 'Pipeline profile mutation';
    this.applyMutation = applyMutation; this.before = null; this.after = null;
  }
  execute() {
    if (this.after) { this.model.restore(this.after, `redo:${this.description}`); return; }
    this.before = this.model.snapshot();
    try {
      this.applyMutation(this.model);
      this.after = this.model.snapshot();
    } catch (error) {
      this.model.restore(this.before, `rollback:${this.description}`);
      this.before = null; this.after = null;
      throw error;
    }
  }
  undo() {
    if (!this.before) throw new Error('Command has not been executed.');
    this.model.restore(this.before, `undo:${this.description}`);
  }
}

export class CommandHistory extends EventTarget {
  constructor(limit = 100) {
    super(); this.limit = Math.max(1, Number(limit) || 100); this.undoStack = []; this.redoStack = [];
  }
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
  execute(command) {
    if (!command || typeof command.execute !== 'function' || typeof command.undo !== 'function') {
      throw new TypeError('Command must implement execute() and undo().');
    }
    command.execute(); this.undoStack.push(command);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = []; this.#emit('execute', command);
  }
  undo() {
    const command = this.undoStack.pop(); if (!command) return false;
    command.undo(); this.redoStack.push(command); this.#emit('undo', command); return true;
  }
  redo() {
    const command = this.redoStack.pop(); if (!command) return false;
    command.execute(); this.undoStack.push(command); this.#emit('redo', command); return true;
  }
  clear() { this.undoStack = []; this.redoStack = []; this.#emit('clear', null); }
  #emit(action, command) {
    this.dispatchEvent(new CustomEvent('historyChanged', { detail: {
      action, description: command?.description ?? '', canUndo: this.canUndo, canRedo: this.canRedo,
    } }));
  }
}

export function moveTable2ElevationCommand(model, id, elevation) {
  return new SnapshotCommand(model, `Move Table 2 elevation ${id}`, (target) => target.moveTable2Elevation(id, elevation));
}
export function moveTable3DepthCommand(model, id, z) {
  return new SnapshotCommand(model, `Move Table 3 depth ${id}`, (target) => target.moveDepth(id, z));
}
export function moveTable3MarkerCommand(model, id, absoluteH) {
  return new SnapshotCommand(model, `Move Table 3 marker ${id}`, (target) => target.moveMarker(id, absoluteH));
}
export function renameTable3MarkerCommand(model, id, markerText) {
  return new SnapshotCommand(model, `Rename Table 3 marker ${id}`, (target) => target.renameMarker(id, markerText));
}
export function addTable2NodeCommand(model, payload) {
  return new SnapshotCommand(model, 'Add Table 2 elevation node', (target) => target.insertTable2Node(payload));
}
export function addTable3DepthCommand(model, payload) {
  return new SnapshotCommand(model, 'Add Table 3 depth node', (target) => target.addDepth(payload));
}
export function addTable3MarkerCommand(model, payload) {
  return new SnapshotCommand(model, 'Add Table 3 marker', (target) => target.addMarker(payload));
}

function validateSingleRowDeletion(model, id) {
  const row = model?.findRow?.(id);
  if (!row) throw new Error(`Unknown profile row: ${id}`);
  if (row.sourceTable !== 'table2a') return id;
  const remaining = (model.table2Rows || []).filter((candidate) => candidate.id !== id
    && Number.isFinite(candidate.stationValue) && Number.isFinite(candidate.basisH));
  if (remaining.length < 2) throw new Error('Delete would violate the Table 2 station authority minimum.');
  return id;
}

export function deleteProfileRowCommand(model, id) {
  const rowId = validateSingleRowDeletion(model, id);
  return new SnapshotCommand(model, `Delete profile row ${rowId}`, (target) => target.deleteRow(rowId));
}

function rebuildTable2StationMap(model) {
  const anchors = model.table2Rows
    .filter((row) => Number.isFinite(row.stationValue) && Number.isFinite(row.basisH))
    .map((row) => ({ cumulative: row.stationValue, absoluteH: row.basisH }));
  model.table2StationMap = buildMonotonicCoordinateMap(anchors);
}

export function editTable2NodeCommand(model, id, after = {}) {
  return new SnapshotCommand(model, `Precision edit Table 2 node ${id}`, (target) => {
    const station = Number(after.station); const elevation = Number(after.elevation);
    if (!Number.isFinite(station) || !Number.isFinite(elevation)) {
      throw new TypeError('Table 2 precision values must be finite.');
    }
    target.mutateRow(id, {
      stationValue: station, stationText: formatStation(station),
      elevationValue: elevation, elevationText: elevation.toFixed(2),
    }, 'precision-edit-table2-node');
    rebuildTable2StationMap(target);
  });
}

export function editTable3DepthCommand(model, id, after = {}) {
  return new SnapshotCommand(model, `Precision edit Table 3 depth ${id}`, (target) => {
    const absoluteH = Number(after.absoluteH); const z = Number(after.z);
    if (!Number.isFinite(absoluteH) || !Number.isFinite(z)) {
      throw new TypeError('Table 3 depth precision values must be finite.');
    }
    const zText = formatDepth(z); const parsed = parseDepthText(zText);
    target.mutateRow(id, {
      absoluteH, textPositionH: absoluteH, z: parsed?.z ?? z, zText,
      zMode: parsed?.mode ?? 'DEPTH', depth: parsed?.depth ?? Math.max(0, -z),
    }, 'precision-edit-table3-depth');
    target.table3DepthRows.sort((a, b) => (a.absoluteH ?? Infinity) - (b.absoluteH ?? Infinity));
  });
}

export function editTable3MarkerCommand(model, id, after = {}) {
  return new SnapshotCommand(model, `Precision edit Table 3 marker ${id}`, (target) => {
    const absoluteH = Number(after.absoluteH); const markerText = String(after.label ?? '').trim();
    if (!Number.isFinite(absoluteH) || !markerText) throw new TypeError('Marker position and label are required.');
    target.mutateRow(id, { absoluteH, markerText }, 'precision-edit-table3-marker');
    target.table3MarkerRows.sort((a, b) => (a.absoluteH ?? Infinity) - (b.absoluteH ?? Infinity));
  });
}

export const _precisionTest = Object.freeze({ rebuildTable2StationMap, validateSingleRowDeletion });