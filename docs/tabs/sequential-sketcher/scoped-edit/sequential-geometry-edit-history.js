/** Immutable branch-local cursor history for accepted Sequential geometry edits. */
import { immutableJson } from '../../../contracts/contract-values.js';
import {
  appendSequentialGeometryEdit,
  assertSequentialGeometryEditJournal,
  createSequentialGeometryEditJournal,
  sequentialGeometryEditBaseFingerprint,
} from './sequential-geometry-edit-journal.js';
import {
  sameSequentialContractValue,
  sequentialSemanticFingerprint,
} from './sequential-command-contracts.js';

export const SEQUENTIAL_GEOMETRY_EDIT_HISTORY_SCHEMA = 'SequentialGeometryEditHistory.v1';
export const SEQUENTIAL_GEOMETRY_EDIT_HISTORY_ACTIONS = Object.freeze([
  'UNDO_GEOMETRY_EDIT',
  'REDO_GEOMETRY_EDIT',
]);

function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message);
  error.code = code;
  throw error;
}
function text(value, label) {
  const result = String(value ?? '').trim();
  if (!result) fail('GEOMETRY_HISTORY_TEXT_REQUIRED', `${label} is required.`, TypeError);
  return result;
}
function ids(values, label) {
  if (!Array.isArray(values)) fail('GEOMETRY_HISTORY_IDS_INVALID', `${label} must be an array.`, TypeError);
  const result = values.map((value) => text(value, label)).sort();
  if (new Set(result).size !== result.length) fail('GEOMETRY_HISTORY_IDS_DUPLICATE', `${label} must be unique.`);
  return result;
}
function cursor(value, length) {
  if (!Number.isSafeInteger(value) || value < 0 || value > length) {
    fail('GEOMETRY_HISTORY_CURSOR_INVALID', `Geometry history cursor must be in [0, ${length}].`);
  }
  return value;
}
function action(value) {
  const result = text(value, 'geometry history action').toUpperCase();
  if (!SEQUENTIAL_GEOMETRY_EDIT_HISTORY_ACTIONS.includes(result)) {
    fail('GEOMETRY_HISTORY_ACTION_INVALID', `Unsupported geometry history action: ${result}`, TypeError);
  }
  return result;
}
function baseJournal(input) {
  return createSequentialGeometryEditJournal({
    branchId: text(input.branchId, 'geometry history branchId'),
    confirmedConstructionFingerprint: text(input.confirmedConstructionFingerprint,
      'geometry history confirmedConstructionFingerprint'),
    baseFingerprint: text(input.baseFingerprint, 'geometry history baseFingerprint'),
  });
}
function rebuildJournal(input, entries) {
  let journal = baseJournal(input);
  entries.forEach((entry) => { journal = appendSequentialGeometryEdit(journal, entry).journal; });
  return journal;
}
function historyMaterial(input = {}) {
  if (!Array.isArray(input.entries)) fail('GEOMETRY_HISTORY_ENTRIES_INVALID',
    'Geometry history entries must be an array.', TypeError);
  const entries = input.entries;
  const activeCursor = cursor(input.cursor, entries.length);
  const fullJournal = rebuildJournal(input, entries);
  const activeJournal = rebuildJournal(input, entries.slice(0, activeCursor));
  return {
    schema: SEQUENTIAL_GEOMETRY_EDIT_HISTORY_SCHEMA,
    branchId: fullJournal.branchId,
    confirmedConstructionFingerprint: fullJournal.confirmedConstructionFingerprint,
    baseFingerprint: fullJournal.baseFingerprint,
    entries: fullJournal.entries,
    cursor: activeCursor,
    consumedTransitionIds: ids(input.consumedTransitionIds || [], 'geometry history transition ID'),
    activeHeadFingerprint: activeJournal.headFingerprint,
  };
}
function createHistory(input) {
  const material = historyMaterial(input);
  return immutableJson({
    ...material,
    historyFingerprint: sequentialSemanticFingerprint('SSKGEOMETRYHISTORY', material),
  }, 'Sequential geometry edit history');
}
function expectedAncestry(history, expected) {
  if (expected.branchId && history.branchId !== expected.branchId) {
    fail('GEOMETRY_HISTORY_BRANCH_STALE', 'Geometry history branch is stale.');
  }
  if (expected.confirmedConstructionFingerprint
    && history.confirmedConstructionFingerprint !== expected.confirmedConstructionFingerprint) {
    fail('GEOMETRY_HISTORY_CONSTRUCTION_STALE', 'Geometry history construction ancestry is stale.');
  }
  if (expected.baseFingerprint && history.baseFingerprint !== expected.baseFingerprint) {
    fail('GEOMETRY_HISTORY_BASE_STALE', 'Geometry history base fingerprint is stale.');
  }
}

export function createSequentialGeometryEditHistory(input = {}) {
  const journal = input.journal ? assertSequentialGeometryEditJournal(input.journal) : null;
  return createHistory({
    branchId: journal?.branchId ?? input.branchId,
    confirmedConstructionFingerprint: journal?.confirmedConstructionFingerprint
      ?? input.confirmedConstructionFingerprint,
    baseFingerprint: journal?.baseFingerprint ?? input.baseFingerprint,
    entries: journal?.entries ?? input.entries ?? [],
    cursor: input.cursor ?? journal?.entries.length ?? 0,
    consumedTransitionIds: input.consumedTransitionIds || [],
  });
}
export function assertSequentialGeometryEditHistory(value, expected = {}) {
  if (value?.schema !== SEQUENTIAL_GEOMETRY_EDIT_HISTORY_SCHEMA) {
    fail('GEOMETRY_HISTORY_SCHEMA_INVALID',
      `Geometry history must use ${SEQUENTIAL_GEOMETRY_EDIT_HISTORY_SCHEMA}.`, TypeError);
  }
  const rebuilt = createHistory(value);
  if (!sameSequentialContractValue(rebuilt, value)) {
    fail('GEOMETRY_HISTORY_CANONICAL_INVALID',
      'Geometry history differs from canonical regeneration.');
  }
  expectedAncestry(rebuilt, expected);
  if (expected.snapshot) {
    const baseFingerprint = sequentialGeometryEditBaseFingerprint(expected.snapshot);
    expectedAncestry(rebuilt, {
      branchId: expected.snapshot.branch.branchId,
      confirmedConstructionFingerprint: expected.snapshot.authority.confirmedConstructionFingerprint,
      baseFingerprint,
    });
    assertSequentialGeometryEditJournal(sequentialGeometryEditHistoryJournal(rebuilt, rebuilt.entries.length),
      expected.snapshot);
  }
  return rebuilt;
}
export function sequentialGeometryEditHistoryJournal(historyValue, cursorValue = null) {
  const history = assertSequentialGeometryEditHistory(historyValue);
  const selectedCursor = cursorValue == null ? history.cursor : cursor(cursorValue, history.entries.length);
  return rebuildJournal(history, history.entries.slice(0, selectedCursor));
}
export function recordSequentialGeometryEditHistoryJournal(historyValue, journalValue) {
  const history = assertSequentialGeometryEditHistory(historyValue);
  const journal = assertSequentialGeometryEditJournal(journalValue);
  const activeJournal = sequentialGeometryEditHistoryJournal(history);
  const prefixValid = journal.entries.length === activeJournal.entries.length + 1
    && sameSequentialContractValue(journal.entries.slice(0, -1), activeJournal.entries);
  if (!prefixValid || journal.branchId !== history.branchId
    || journal.confirmedConstructionFingerprint !== history.confirmedConstructionFingerprint
    || journal.baseFingerprint !== history.baseFingerprint) {
    fail('GEOMETRY_HISTORY_APPEND_INVALID',
      'Accepted geometry edit must append exactly one entry to the active history prefix.');
  }
  const appended = journal.entries.at(-1);
  if (history.entries.some((entry) => entry.operationId === appended.operationId)) {
    fail('GEOMETRY_HISTORY_OPERATION_REPLAY',
      `Geometry operation was already accepted in this history: ${appended.operationId}`);
  }
  return createHistory({
    ...history,
    entries: journal.entries,
    cursor: journal.entries.length,
  });
}
export function transitionSequentialGeometryEditHistory(historyValue, actionValue) {
  const history = assertSequentialGeometryEditHistory(historyValue);
  const normalized = action(actionValue);
  if (normalized === 'UNDO_GEOMETRY_EDIT') {
    if (history.cursor === 0) fail('GEOMETRY_HISTORY_UNDO_BLOCKED', 'No geometry edit is available to undo.');
    return Object.freeze({ action: normalized, affectedEntry: history.entries[history.cursor - 1],
      history: createHistory({ ...history, cursor: history.cursor - 1 }) });
  }
  if (history.cursor === history.entries.length) {
    fail('GEOMETRY_HISTORY_REDO_BLOCKED', 'No geometry edit is available to redo.');
  }
  return Object.freeze({ action: normalized, affectedEntry: history.entries[history.cursor],
    history: createHistory({ ...history, cursor: history.cursor + 1 }) });
}
export function consumeSequentialGeometryHistoryTransition(historyValue, preparedId) {
  const history = assertSequentialGeometryEditHistory(historyValue);
  const id = text(preparedId, 'geometry history preparedId');
  if (history.consumedTransitionIds.includes(id)) {
    fail('GEOMETRY_HISTORY_TRANSITION_REPLAY', `Geometry history transition was already consumed: ${id}`);
  }
  return createHistory({ ...history,
    consumedTransitionIds: [...history.consumedTransitionIds, id] });
}
export function sequentialGeometryEditHistoryCapabilities(historyValue) {
  const history = assertSequentialGeometryEditHistory(historyValue);
  const undoEntry = history.cursor > 0 ? history.entries[history.cursor - 1] : null;
  const redoEntry = history.cursor < history.entries.length ? history.entries[history.cursor] : null;
  return Object.freeze({
    canUndo: Boolean(undoEntry), canRedo: Boolean(redoEntry), cursor: history.cursor,
    totalCount: history.entries.length, activeCount: history.cursor,
    redoCount: history.entries.length - history.cursor,
    undoEntry, redoEntry,
    undoBlockedReason: undoEntry ? null : 'No accepted geometry edit is available to undo.',
    redoBlockedReason: redoEntry ? null : 'No inactive geometry edit is available to redo.',
    historyFingerprint: history.historyFingerprint,
    activeHeadFingerprint: history.activeHeadFingerprint,
  });
}

export const _test = Object.freeze({ action, historyMaterial, rebuildJournal });