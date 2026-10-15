import { parseDepthText } from './pipeline-3d-model-cad-math.js';
import { PipelineProfileModel } from './pipeline-3d-model-cad-model.js';
import {
  CommandHistory,
  addTable2NodeCommand,
  addTable3DepthCommand,
  addTable3MarkerCommand,
  deleteProfileRowCommand,
  moveTable2ElevationCommand,
  moveTable3DepthCommand,
  moveTable3MarkerCommand,
  renameTable3MarkerCommand,
} from './pipeline-3d-model-cad-commands.js';

const RAW_NAMES = Object.freeze(['table2a', 'table3a', 'table3b', 'table3c']);
const RAW_SLOT_NAMES = Object.freeze({
  table2a: 'table2a-raw',
  table3a: 'table3a-raw',
  table3b: 'table3b-raw',
  table3c: 'table3c-raw',
});

function normalize(value) {
  return String(value ?? '').replace(/->/g, '→').replace(/\s+/g, ' ').trim();
}

function numericTokens(value) {
  return (String(value ?? '').match(/-?\d+(?:\.\d+)?/g) || []).map(Number).filter(Number.isFinite);
}

function approximatelyContains(text, value, tolerance = 0.002) {
  if (!Number.isFinite(Number(value))) return false;
  return numericTokens(text).some((candidate) => Math.abs(candidate - Number(value)) <= tolerance);
}

function findRawElement(dialog, name) {
  return dialog?.querySelector?.(`[data-p3d-split="${RAW_SLOT_NAMES[name]}"]`) ?? null;
}

export function readPipelineCadRaw(dialog) {
  return Object.freeze(Object.fromEntries(RAW_NAMES.map((name) => [name, findRawElement(dialog, name)?.value ?? ''])));
}

function setRawValue(element, value) {
  if (!element || element.value === value) return;
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

function tableRows(root) {
  return Array.from(root?.querySelectorAll?.('tbody tr') || []);
}

function rowCells(row) {
  return Array.from(row?.querySelectorAll?.('td') || []).map((cell) => normalize(cell.textContent));
}

function rowMatchesModelRow(cells, modelRow) {
  if (!modelRow) return false;
  if (modelRow.sourceTable === 'table2a') {
    const station = normalize(modelRow.stationText);
    return Boolean(station && station !== '—' && cells.includes(station));
  }
  if (modelRow.sourceTable === 'table3b') {
    const zText = normalize(modelRow.zText);
    const identityValues = [modelRow.fromH, modelRow.toH, modelRow.textPositionH ?? modelRow.absoluteH].filter(Number.isFinite);
    return cells.includes(zText) && identityValues.some((value) => cells.some((cell) => approximatelyContains(cell, value)));
  }
  if (modelRow.sourceTable === 'table3c') {
    return cells.includes(normalize(modelRow.markerText));
  }
  return false;
}

export function applyPipelineCadDirtyHighlights(dialog, model) {
  const outputRoots = [
    dialog?.querySelector?.('[data-p3d="table2x-output"]'),
    dialog?.querySelector?.('[data-p3d="table3x-output"]'),
  ].filter(Boolean);
  outputRoots.forEach((root) => tableRows(root).forEach((row) => {
    row.classList?.remove?.('p3d-cad-dirty-row');
    row.removeAttribute?.('data-p3d-cad-dirty-row');
  }));
  if (!model) return;
  for (const id of model.dirtyRowIds) {
    const modelRow = model.findRow(id);
    if (!modelRow) continue;
    for (const root of outputRoots) {
      const match = tableRows(root).find((row) => rowMatchesModelRow(rowCells(row), modelRow));
      if (!match) continue;
      match.classList?.add?.('p3d-cad-dirty-row');
      match.setAttribute?.('data-p3d-cad-dirty-row', id);
      break;
    }
  }
}

function nextMarkerText(model) {
  const used = new Set((model?.table3MarkerRows || []).map((row) => normalize(row.markerText).toUpperCase()));
  let number = 1;
  while (used.has(`PM-${String(number).padStart(3, '0')}`)) number += 1;
  return `PM-${String(number).padStart(3, '0')}`;
}

export class PipelineCadController extends EventTarget {
  constructor(dialog, options = {}) {
    super();
    this.dialog = dialog;
    this.history = options.history || new CommandHistory(options.historyLimit || 100);
    this.model = null;
    this.graphs = { table2x: null, table3x: null };
    this.internalWrite = false;
    this.lastError = null;
    this.cleanup = [];
    this.graphCleanup = [];
    this.#bindRawInputs();
    this.#bindHistory();
    this.refreshFromRaw({ clearHistory: false, reloadGraphs: true, reason: 'initial-load' });
  }

  attachGraphs(graphs) {
    this.#clearGraphBindings();
    this.graphs = { table2x: graphs?.table2x || null, table3x: graphs?.table3x || null };
    for (const graph of Object.values(this.graphs).filter(Boolean)) {
      for (const eventName of ['nodeAdded', 'nodeMoved', 'nodeDeleted', 'reloadRequested', 'selectionChanged']) {
        const listener = (event) => this.#handleGraphEvent(eventName, event.detail || {});
        graph.addEventListener(eventName, listener);
        this.graphCleanup.push(() => graph.removeEventListener(eventName, listener));
      }
      graph.setModel?.(this.model, { preserveSnapshot: false });
    }
  }

  refreshFromRaw(options = {}) {
    if (this.internalWrite) return false;
    try {
      const nextModel = PipelineProfileModel.fromRaw(readPipelineCadRaw(this.dialog));
      this.model = nextModel;
      this.lastError = null;
      if (options.clearHistory !== false) this.history.clear();
      for (const graph of Object.values(this.graphs).filter(Boolean)) {
        graph.setModel?.(nextModel, { preserveSnapshot: options.reloadGraphs === false });
      }
      this.#scheduleHighlight();
      this.dispatchEvent(new CustomEvent('modelChanged', {
        detail: { reason: options.reason || 'raw-input', revision: nextModel.revision },
      }));
      return true;
    } catch (error) {
      this.lastError = error;
      this.dispatchEvent(new CustomEvent('validationError', { detail: { error, reason: options.reason || 'raw-input' } }));
      return false;
    }
  }

  execute(command, reason = 'graph-command') {
    if (!this.model) return false;
    this.history.execute(command);
    this.#writeModelToRaw();
    for (const graph of Object.values(this.graphs).filter(Boolean)) {
      graph.setModel?.(this.model, { preserveSnapshot: true });
    }
    this.#scheduleHighlight();
    this.dispatchEvent(new CustomEvent('commandCommitted', {
      detail: { reason, revision: this.model.revision, dirtyRowIds: [...this.model.dirtyRowIds] },
    }));
    return true;
  }

  undo() {
    if (!this.model || !this.history.undo()) return false;
    this.#afterHistoryNavigation('undo');
    return true;
  }

  redo() {
    if (!this.model || !this.history.redo()) return false;
    this.#afterHistoryNavigation('redo');
    return true;
  }

  reloadGraphs() {
    for (const graph of Object.values(this.graphs).filter(Boolean)) graph.reloadGraph?.();
    this.model?.clearDirtyRows?.();
    this.#scheduleHighlight();
    this.dispatchEvent(new CustomEvent('graphsReloaded', { detail: { revision: this.model?.revision ?? 0 } }));
  }

  renameEntity({ graph, entityId, entityType, value }) {
    if (!this.model) return false;
    if (graph === 'table2x' && entityType === 'elevation-node') {
      const elevation = Number(value);
      if (!Number.isFinite(elevation)) throw new Error('Elevation must be numeric.');
      return this.execute(moveTable2ElevationCommand(this.model, entityId, elevation), 'rename-table2-elevation');
    }
    if (graph === 'table3x' && entityType === 'depth-node') {
      const parsed = parseDepthText(value);
      if (!parsed) throw new Error('Depth must be A/G or a numeric value such as 1.5M.');
      return this.execute(moveTable3DepthCommand(this.model, entityId, parsed.z), 'rename-table3-depth');
    }
    if (graph === 'table3x' && entityType === 'marker') {
      return this.execute(renameTable3MarkerCommand(this.model, entityId, value), 'rename-table3-marker');
    }
    return false;
  }

  destroy() {
    this.#clearGraphBindings();
    this.cleanup.splice(0).forEach((dispose) => dispose());
  }

  #bindRawInputs() {
    const listener = (event) => {
      if (this.internalWrite) return;
      const target = event.target?.matches ? event.target : null;
      if (!target?.matches?.('[data-p3d-split$="-raw"]')) return;
      this.refreshFromRaw({ clearHistory: true, reloadGraphs: true, reason: 'manual-raw-input' });
    };
    this.dialog?.addEventListener?.('input', listener);
    this.cleanup.push(() => this.dialog?.removeEventListener?.('input', listener));
  }

  #bindHistory() {
    const listener = (event) => this.dispatchEvent(new CustomEvent('historyChanged', { detail: event.detail }));
    this.history.addEventListener('historyChanged', listener);
    this.cleanup.push(() => this.history.removeEventListener('historyChanged', listener));
  }

  #handleGraphEvent(eventName, detail) {
    if (!this.model) return;
    if (eventName === 'reloadRequested') {
      this.#scheduleHighlight();
      return;
    }
    if (eventName === 'selectionChanged') {
      this.dispatchEvent(new CustomEvent('selectionChanged', { detail }));
      return;
    }
    if (eventName === 'nodeMoved') {
      if (detail.graph === 'table2x') {
        this.execute(moveTable2ElevationCommand(this.model, detail.entityId, detail.after?.elevationValue), 'move-table2-node');
      } else if (detail.entityType === 'marker') {
        this.execute(moveTable3MarkerCommand(this.model, detail.entityId, detail.after?.absoluteH), 'move-table3-marker');
      } else {
        this.execute(moveTable3DepthCommand(this.model, detail.entityId, detail.after?.z), 'move-table3-depth');
      }
      return;
    }
    if (eventName === 'nodeAdded') {
      if (detail.graph === 'table2x') {
        this.execute(addTable2NodeCommand(this.model, {
          stationValue: detail.stationValue,
          elevationValue: detail.elevationValue,
          afterId: detail.insertAfterId,
          beforeId: detail.insertBeforeId,
        }), 'add-table2-node');
      } else if (detail.entityType === 'marker') {
        this.execute(addTable3MarkerCommand(this.model, {
          absoluteH: detail.absoluteH,
          markerText: nextMarkerText(this.model),
        }), 'add-table3-marker');
      } else {
        this.execute(addTable3DepthCommand(this.model, { absoluteH: detail.absoluteH, z: detail.z }), 'add-table3-depth');
      }
      return;
    }
    if (eventName === 'nodeDeleted') {
      this.execute(deleteProfileRowCommand(this.model, detail.entityId), 'delete-profile-row');
    }
  }

  #writeModelToRaw() {
    if (!this.model) return;
    const serialized = this.model.serializeRaw();
    this.internalWrite = true;
    try {
      RAW_NAMES.forEach((name) => setRawValue(findRawElement(this.dialog, name), serialized[name]));
    } finally {
      this.internalWrite = false;
    }
  }

  #afterHistoryNavigation(action) {
    this.#writeModelToRaw();
    for (const graph of Object.values(this.graphs).filter(Boolean)) {
      graph.setModel?.(this.model, { preserveSnapshot: false });
      graph.reloadGraph?.();
    }
    this.#scheduleHighlight();
    this.dispatchEvent(new CustomEvent('historyApplied', { detail: { action, revision: this.model.revision } }));
  }

  #scheduleHighlight() {
    queueMicrotask(() => applyPipelineCadDirtyHighlights(this.dialog, this.model));
  }

  #clearGraphBindings() {
    this.graphCleanup.splice(0).forEach((dispose) => dispose());
  }
}
