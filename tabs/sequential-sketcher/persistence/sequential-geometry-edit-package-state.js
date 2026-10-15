/** Package adapter for branch-local accepted geometry history and edit preparations. */
import { immutableJson } from '../../../contracts/contract-values.js';
import { assertSequentialGeometryEditJournal } from '../scoped-edit/sequential-geometry-edit-journal.js';
import { sameSequentialContractValue } from '../scoped-edit/sequential-command-contracts.js';
import {
  assertSequentialGeometryEditHistory,
  createSequentialGeometryEditHistory,
  sequentialGeometryEditHistoryJournal,
} from '../scoped-edit/sequential-geometry-edit-history.js';

export const SEQUENTIAL_GEOMETRY_EDIT_PACKAGE_STATE_SCHEMA =
  'SequentialGeometryEditPackageState.v1';

function fail(code, detail = '', Constructor = RangeError) {
  const error = new Constructor(`${code}${detail ? `: ${detail}` : ''}`);
  error.code = code; throw error;
}
function text(value, label) {
  const result = String(value ?? '').trim();
  if (!result) fail('GEOMETRY_PACKAGE_TEXT_REQUIRED', label, TypeError);
  return result;
}
function ids(values, label) {
  if (!Array.isArray(values)) fail('GEOMETRY_PACKAGE_IDS_INVALID', label, TypeError);
  const result = values.map((value) => text(value, label)).sort();
  if (new Set(result).size !== result.length) fail('GEOMETRY_PACKAGE_IDS_DUPLICATE', label);
  return Object.freeze(result);
}
function historyValue(value) {
  if (!value?.history) {
    const journal = assertSequentialGeometryEditJournal(value?.journal);
    return Object.freeze({ history: createSequentialGeometryEditHistory({ journal }), journal });
  }
  const history = assertSequentialGeometryEditHistory(value.history);
  const journal = sequentialGeometryEditHistoryJournal(history);
  if (value.journal && !sameSequentialContractValue(
    assertSequentialGeometryEditJournal(value.journal), journal)) {
    fail('GEOMETRY_PACKAGE_ACTIVE_JOURNAL_MISMATCH');
  }
  return Object.freeze({ history, journal });
}
function row(value) {
  const branchId = text(value?.branchId, 'geometry package branchId');
  const { history, journal } = historyValue(value);
  if (history.branchId !== branchId) fail('GEOMETRY_PACKAGE_BRANCH_MISMATCH', branchId);
  return Object.freeze({
    branchId,
    confirmedConstructionFingerprint: history.confirmedConstructionFingerprint,
    baseFingerprint: history.baseFingerprint,
    history,
    journal,
    consumedPreparedIds: ids(value?.consumedPreparedIds || [],
      'geometry package consumedPreparedId'),
  });
}
function canonicalRows(values) {
  if (!Array.isArray(values)) fail('GEOMETRY_PACKAGE_BRANCHES_INVALID', '', TypeError);
  const result = values.map(row).sort((left, right) => left.branchId.localeCompare(right.branchId));
  const branchIds = result.map((item) => item.branchId);
  if (new Set(branchIds).size !== branchIds.length) fail('GEOMETRY_PACKAGE_BRANCH_DUPLICATE');
  return Object.freeze(result);
}
function stateMaterial(values) {
  const branches = canonicalRows(values);
  return {
    schema: SEQUENTIAL_GEOMETRY_EDIT_PACKAGE_STATE_SCHEMA,
    branches,
    branchCount: branches.length,
    editCount: branches.reduce((count, item) => count + item.history.entries.length, 0),
    activeEditCount: branches.reduce((count, item) => count + item.history.cursor, 0),
    redoEditCount: branches.reduce((count, item) =>
      count + item.history.entries.length - item.history.cursor, 0),
    consumedPreparedCount: branches.reduce((count, item) =>
      count + item.consumedPreparedIds.length, 0),
    consumedTransitionCount: branches.reduce((count, item) =>
      count + item.history.consumedTransitionIds.length, 0),
  };
}
function assertCounts(value, expected) {
  for (const key of ['branchCount', 'editCount', 'consumedPreparedCount']) {
    if (value?.[key] !== expected[key]) fail('GEOMETRY_PACKAGE_COUNT_INVALID', key);
  }
  for (const key of ['activeEditCount', 'redoEditCount', 'consumedTransitionCount']) {
    if (value?.[key] != null && value[key] !== expected[key]) {
      fail('GEOMETRY_PACKAGE_COUNT_INVALID', key);
    }
  }
}
function hasDurableAuthority(history, consumed) {
  return history.entries.length > 0 || history.consumedTransitionIds.length > 0 || consumed.size > 0;
}

export function createSequentialGeometryEditPackageState(values = []) {
  return immutableJson(stateMaterial(values), 'Sequential geometry-edit package state');
}
export function assertSequentialGeometryEditPackageState(value) {
  if (value?.schema !== SEQUENTIAL_GEOMETRY_EDIT_PACKAGE_STATE_SCHEMA) {
    fail('GEOMETRY_PACKAGE_SCHEMA_INVALID', value?.schema, TypeError);
  }
  const rebuilt = stateMaterial(value.branches);
  assertCounts(value, rebuilt);
  return immutableJson(rebuilt, 'Sequential geometry-edit package state');
}
export function geometryEditPackageRows(byBranch, consumedByBranch) {
  const rows = [...byBranch.entries()].flatMap(([branchId, history]) => {
    const consumed = consumedByBranch.get(branchId) || new Set();
    if (!hasDurableAuthority(history, consumed)) return [];
    return [{
      branchId,
      confirmedConstructionFingerprint: history.confirmedConstructionFingerprint,
      baseFingerprint: history.baseFingerprint,
      history,
      journal: sequentialGeometryEditHistoryJournal(history),
      consumedPreparedIds: [...consumed],
    }];
  });
  return createSequentialGeometryEditPackageState(rows);
}
export function restoreGeometryEditPackageMaps(value) {
  const state = assertSequentialGeometryEditPackageState(value);
  const byBranch = new Map(); const consumedByBranch = new Map();
  state.branches.forEach((item) => {
    byBranch.set(item.branchId, item.history);
    consumedByBranch.set(item.branchId, new Set(item.consumedPreparedIds));
  });
  return Object.freeze({ state, byBranch, consumedByBranch });
}