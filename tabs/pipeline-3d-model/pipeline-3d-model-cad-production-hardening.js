import {
  PipelineProfileModel,
  buildCoordinateAnchors,
  buildTable2StationCoordinateMap,
  parseTable2ARows,
  parseTable3ARows,
} from './pipeline-3d-model-cad-model.js';
import {
  PipelineCadController,
  readPipelineCadRaw,
} from './pipeline-3d-model-cad-controller.js';

const MODEL_PATCH = Symbol.for('pipeline3d.cad.production.model.patch.v1');
const CONTROLLER_PATCH = Symbol.for('pipeline3d.cad.production.controller.patch.v1');
const INDEX_CACHE = new WeakMap();
const DEFAULT_TOLERANCE = 0.002;

function cloneRow(row) {
  return {
    ...row,
    ...(row?.hCoordinate ? { hCoordinate: { ...row.hCoordinate } } : {}),
  };
}

function modelGroups(model) {
  return [
    model.table2Rows,
    model.table3LengthRows,
    model.table3DepthRows,
    model.table3MarkerRows,
  ];
}

function buildModelIndex(model) {
  const groups = modelGroups(model);
  const index = new Map();
  groups.forEach((rows) => rows.forEach((row, rowIndex) => {
    if (index.has(row.id)) throw new Error(`Duplicate profile row id: ${row.id}`);
    index.set(row.id, { row, rows, rowIndex });
  }));
  const entry = {
    revision: model.revision,
    groups,
    index,
  };
  INDEX_CACHE.set(model, entry);
  return entry;
}

function indexedModel(model) {
  const cached = INDEX_CACHE.get(model);
  const groups = modelGroups(model);
  const sameGroups = cached?.groups?.length === groups.length
    && cached.groups.every((rows, index) => rows === groups[index]);
  if (!cached || cached.revision !== model.revision || !sameGroups) return buildModelIndex(model);
  return cached;
}

export function getPipelineCadIndexStats(model) {
  const indexed = indexedModel(model);
  return Object.freeze({
    revision: indexed.revision,
    size: indexed.index.size,
    table2Rows: model.table2Rows.length,
    table3LengthRows: model.table3LengthRows.length,
    table3DepthRows: model.table3DepthRows.length,
    table3MarkerRows: model.table3MarkerRows.length,
  });
}

function issue(code, severity, table, sourceLine, message, details = {}) {
  return Object.freeze({ code, severity, table, sourceLine, message, ...details });
}

function validNumber(value) {
  return Number.isFinite(Number(value));
}

export function auditTable3LengthRows(rows, options = {}) {
  const tolerance = Number.isFinite(options.tolerance)
    ? Math.abs(options.tolerance)
    : DEFAULT_TOLERANCE;
  const issues = [];
  let direction = 0;
  let previous = null;

  (Array.isArray(rows) ? rows : []).forEach((row, index) => {
    const sourceLine = row?.sourceLine ?? index + 1;
    const missing = [
      ['fromH', row?.fromH],
      ['toH', row?.toH],
      ['hLength', row?.hLength],
    ].filter(([, value]) => !validNumber(value)).map(([name]) => name);

    if (missing.length) {
      issues.push(issue(
        'TABLE3A_INVALID_NUMBER',
        'error',
        'table3a',
        sourceLine,
        `Table 3A row ${sourceLine} requires finite ${missing.join(', ')} values.`,
        { fields: missing },
      ));
      previous = null;
      return;
    }

    const fromH = Number(row.fromH);
    const toH = Number(row.toH);
    const hLength = Number(row.hLength);
    if (hLength <= tolerance) {
      issues.push(issue(
        'TABLE3A_NON_POSITIVE_LENGTH',
        'error',
        'table3a',
        sourceLine,
        `Table 3A row ${sourceLine} HLength must be greater than zero.`,
        { hLength },
      ));
    }

    const delta = toH - fromH;
    if (Math.abs(delta) <= tolerance) {
      issues.push(issue(
        'TABLE3A_ZERO_SPAN',
        'error',
        'table3a',
        sourceLine,
        `Table 3A row ${sourceLine} From H and To H cannot be equal.`,
        { fromH, toH },
      ));
    } else {
      const rowDirection = delta > 0 ? 1 : -1;
      if (!direction) direction = rowDirection;
      else if (rowDirection !== direction) {
        issues.push(issue(
          'TABLE3A_DIRECTION_REVERSAL',
          'error',
          'table3a',
          sourceLine,
          `Table 3A row ${sourceLine} reverses the established H-coordinate direction.`,
          { fromH, toH, expectedDirection: direction },
        ));
      }
    }

    if (previous && Math.abs(fromH - previous.toH) > tolerance) {
      issues.push(issue(
        'TABLE3A_DISCONTINUITY',
        'error',
        'table3a',
        sourceLine,
        `Table 3A row ${sourceLine} starts at ${fromH}, but the previous row ends at ${previous.toH}.`,
        { expectedFromH: previous.toH, actualFromH: fromH },
      ));
    }

    if (validNumber(row.textPositionH)) {
      const textPositionH = Number(row.textPositionH);
      const minimum = Math.min(fromH, toH) - tolerance;
      const maximum = Math.max(fromH, toH) + tolerance;
      if (textPositionH < minimum || textPositionH > maximum) {
        issues.push(issue(
          'TABLE3A_TEXT_POSITION_OUTSIDE_SEGMENT',
          'warning',
          'table3a',
          sourceLine,
          `Table 3A row ${sourceLine} text position lies outside its H segment.`,
          { textPositionH, fromH, toH },
        ));
      }
    }

    previous = { toH };
  });

  if (!rows?.length) {
    issues.push(issue(
      'TABLE3A_EMPTY',
      'error',
      'table3a',
      null,
      'Table 3A must contain at least one valid HLength row.',
    ));
  }

  return Object.freeze({
    valid: !issues.some((entry) => entry.severity === 'error'),
    direction,
    issues: Object.freeze(issues),
  });
}

export function auditPipelineCadRaw(raw, options = {}) {
  const issues = [];
  const table2Rows = parseTable2ARows(raw?.table2a);
  const table3LengthRows = parseTable3ARows(raw?.table3a);
  const stationAnchors = table2Rows.filter((row) => validNumber(row.stationValue) && validNumber(row.basisH));

  if (stationAnchors.length < 2) {
    issues.push(issue(
      'TABLE2A_INSUFFICIENT_ANCHORS',
      'error',
      'table2a',
      null,
      'Table 2A must contain at least two finite station/H coordinate anchors.',
      { anchorCount: stationAnchors.length },
    ));
  } else {
    try {
      buildTable2StationCoordinateMap(table2Rows);
    } catch (error) {
      issues.push(issue(
        'TABLE2A_NON_MONOTONIC_ANCHORS',
        'error',
        'table2a',
        null,
        `Table 2A station/H anchors are invalid: ${error.message}`,
      ));
    }
  }

  const table3Audit = auditTable3LengthRows(table3LengthRows, options);
  issues.push(...table3Audit.issues);
  if (table3Audit.valid) {
    try {
      buildCoordinateAnchors(table3LengthRows);
    } catch (error) {
      issues.push(issue(
        'TABLE3A_NON_MONOTONIC_ANCHORS',
        'error',
        'table3a',
        null,
        `Table 3A coordinate anchors are invalid: ${error.message}`,
      ));
    }
  }

  return Object.freeze({
    valid: !issues.some((entry) => entry.severity === 'error'),
    issues: Object.freeze(issues),
    summary: Object.freeze({
      errors: issues.filter((entry) => entry.severity === 'error').length,
      warnings: issues.filter((entry) => entry.severity === 'warning').length,
      table2Rows: table2Rows.length,
      table3LengthRows: table3LengthRows.length,
    }),
  });
}

function diagnosticsError(audit) {
  const errors = audit.issues.filter((entry) => entry.severity === 'error');
  const first = errors[0];
  const message = first
    ? `${first.message}${errors.length > 1 ? ` (+${errors.length - 1} more profile errors)` : ''}`
    : 'Pipeline CAD profile validation failed.';
  const error = new Error(message);
  error.name = 'PipelineCadProfileValidationError';
  error.diagnostics = audit;
  return error;
}

function setControllerStatus(controller, message, state = '') {
  controller?.dialog?.querySelectorAll?.('[data-p3d-cad-status]')?.forEach?.((node) => {
    node.textContent = message;
    node.dataset.state = state;
  });
}

function restoreControllerGraphs(controller) {
  for (const graph of Object.values(controller?.graphs || {}).filter(Boolean)) {
    graph.setModel?.(controller.model, { preserveSnapshot: false });
    graph.reloadGraph?.();
  }
}

export function isProtectedPipelineCadRow(model, id) {
  const indexed = indexedModel(model);
  const entry = indexed.index.get(id);
  if (!entry || entry.row?.sourceTable !== 'table2a') return false;
  return entry.rows === model.table2Rows
    && (entry.rowIndex === 0 || entry.rowIndex === model.table2Rows.length - 1);
}

export function installPipelineCadModelHardening() {
  const prototype = PipelineProfileModel.prototype;
  if (prototype[MODEL_PATCH]) return false;
  Object.defineProperty(prototype, MODEL_PATCH, { value: true });

  prototype.findRow = function findIndexedProfileRow(id) {
    return indexedModel(this).index.get(id)?.row ?? null;
  };

  prototype.mutateRow = function mutateIndexedProfileRow(id, patch, reason) {
    const entry = indexedModel(this).index.get(id);
    if (!entry) throw new Error(`Unknown profile row: ${id}`);
    const before = cloneRow(entry.row);
    const after = { ...entry.row, ...patch };
    entry.rows[entry.rowIndex] = after;
    this.revision += 1;
    this.dirtyRowIds.add(id);
    INDEX_CACHE.delete(this);
    this.dispatchEvent(new CustomEvent('rowChanged', {
      detail: { id, reason, before, after: cloneRow(after), revision: this.revision },
    }));
    return after;
  };

  prototype.deleteRow = function deleteIndexedProfileRow(id) {
    const entry = indexedModel(this).index.get(id);
    if (!entry) throw new Error(`Unknown profile row: ${id}`);
    if (isProtectedPipelineCadRow(this, id)) {
      throw new Error('Table 2 terminal anchors are required and cannot be deleted. Move the endpoint or edit the raw table instead.');
    }
    const [row] = entry.rows.splice(entry.rowIndex, 1);
    this.revision += 1;
    this.dirtyRowIds.delete(id);
    if (row.sourceTable === 'table2a') this.table2StationMap = buildTable2StationCoordinateMap(this.table2Rows);
    if (row.sourceTable === 'table3a') this.coordinateMap = buildCoordinateAnchors(this.table3LengthRows);
    INDEX_CACHE.delete(this);
    this.dispatchEvent(new CustomEvent('rowDeleted', {
      detail: { row: cloneRow(row), index: entry.rowIndex, revision: this.revision },
    }));
    return row;
  };

  return true;
}

export function installPipelineCadControllerHardening() {
  const prototype = PipelineCadController.prototype;
  if (prototype[CONTROLLER_PATCH]) return false;
  Object.defineProperty(prototype, CONTROLLER_PATCH, { value: true });

  const originalRefresh = prototype.refreshFromRaw;
  prototype.refreshFromRaw = function refreshValidatedPipelineCadRaw(options = {}) {
    if (this.internalWrite) return originalRefresh.call(this, options);
    const raw = readPipelineCadRaw(this.dialog);
    const audit = auditPipelineCadRaw(raw);
    this.dispatchEvent(new CustomEvent('profileDiagnostics', {
      detail: { audit, reason: options.reason || 'raw-input' },
    }));
    if (!audit.valid) {
      const error = diagnosticsError(audit);
      this.lastError = error;
      setControllerStatus(this, error.message, 'error');
      this.dispatchEvent(new CustomEvent('validationError', {
        detail: { error, diagnostics: audit, reason: options.reason || 'raw-input' },
      }));
      return false;
    }

    const discardedUndoCount = this.history?.undoStack?.length || 0;
    const discardedRedoCount = this.history?.redoStack?.length || 0;
    const result = originalRefresh.call(this, options);
    if (!result) return false;
    this.model.profileDiagnostics = audit;

    if (options.clearHistory !== false) {
      const detail = {
        reason: options.reason || 'raw-input',
        revision: this.model.revision,
        discardedUndoCount,
        discardedRedoCount,
      };
      this.dispatchEvent(new CustomEvent('historyReset', { detail }));
      setControllerStatus(
        this,
        `Raw data loaded · history reset (${discardedUndoCount} undo, ${discardedRedoCount} redo discarded) · revision ${this.model.revision}`,
      );
    }
    return true;
  };

  const originalExecute = prototype.execute;
  prototype.execute = function executeGuardedPipelineCadCommand(command, reason = 'graph-command') {
    try {
      return originalExecute.call(this, command, reason);
    } catch (error) {
      this.lastError = error;
      restoreControllerGraphs(this);
      setControllerStatus(this, error instanceof Error ? error.message : String(error), 'error');
      this.dispatchEvent(new CustomEvent('commandRejected', {
        detail: { error, reason, revision: this.model?.revision ?? 0 },
      }));
      return false;
    }
  };

  return true;
}

installPipelineCadModelHardening();
installPipelineCadControllerHardening();
