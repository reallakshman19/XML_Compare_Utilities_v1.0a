/** Package adapter for branch-local support-adjustment histories. */
import { immutableJson } from '../../../contracts/contract-values.js';
import { assertSequentialSupportAdjustmentHistory } from '../support/sequential-support-adjustment-history.js';

export const SEQUENTIAL_SUPPORT_ADJUSTMENT_PACKAGE_STATE_SCHEMA =
  'SequentialSupportAdjustmentPackageState.v1';

function fail(code, detail = '', Constructor = RangeError) {
  const error = new Constructor(`${code}${detail ? `: ${detail}` : ''}`);
  error.code = code;
  throw error;
}
function text(value, label) {
  const result = String(value ?? '').trim();
  if (!result) fail('SUPPORT_PACKAGE_TEXT_REQUIRED', label, TypeError);
  return result;
}
function ids(values, label) {
  if (!Array.isArray(values)) fail('SUPPORT_PACKAGE_IDS_INVALID', label, TypeError);
  const result = values.map((value) => text(value, label)).sort();
  if (new Set(result).size !== result.length) fail('SUPPORT_PACKAGE_IDS_DUPLICATE', label);
  return Object.freeze(result);
}
function row(value) {
  const branchId = text(value?.branchId, 'support package branchId');
  const history = assertSequentialSupportAdjustmentHistory(value?.history, {
    constructionFingerprint: text(value?.constructionFingerprint,
      'support package constructionFingerprint'),
    baseProjectionFingerprint: text(value?.baseProjectionFingerprint,
      'support package baseProjectionFingerprint'),
  });
  return Object.freeze({
    branchId,
    constructionFingerprint: history.constructionFingerprint,
    baseProjectionFingerprint: history.baseProjectionFingerprint,
    history,
    consumedPreparedIds: ids(value?.consumedPreparedIds || [],
      'support package consumedPreparedId'),
  });
}
function canonicalRows(values) {
  if (!Array.isArray(values)) fail('SUPPORT_PACKAGE_BRANCHES_INVALID', '', TypeError);
  const result = values.map(row).sort((left, right) => left.branchId.localeCompare(right.branchId));
  const branchIds = result.map((item) => item.branchId);
  if (new Set(branchIds).size !== branchIds.length) fail('SUPPORT_PACKAGE_BRANCH_DUPLICATE');
  return Object.freeze(result);
}
function stateMaterial(values) {
  const branches = canonicalRows(values);
  return {
    schema: SEQUENTIAL_SUPPORT_ADJUSTMENT_PACKAGE_STATE_SCHEMA,
    branches,
    branchCount: branches.length,
    currentAdjustmentCount: branches.reduce((count, item) =>
      count + item.history.currentRegister.entries.length, 0),
    undoCount: branches.reduce((count, item) => count + item.history.undoStack.length, 0),
    redoCount: branches.reduce((count, item) => count + item.history.redoStack.length, 0),
  };
}
function assertCounts(value, expected) {
  for (const key of ['branchCount', 'currentAdjustmentCount', 'undoCount', 'redoCount']) {
    if (value?.[key] !== expected[key]) fail('SUPPORT_PACKAGE_COUNT_INVALID', key);
  }
}
function hasDurableAuthority(stored, consumed) {
  const history = stored.history;
  return history.currentRegister.entries.length > 0
    || history.undoStack.length > 0
    || history.redoStack.length > 0
    || consumed.size > 0;
}

export function createSequentialSupportAdjustmentPackageState(values = []) {
  return immutableJson(stateMaterial(values), 'Sequential support-adjustment package state');
}
export function assertSequentialSupportAdjustmentPackageState(value) {
  if (value?.schema !== SEQUENTIAL_SUPPORT_ADJUSTMENT_PACKAGE_STATE_SCHEMA) {
    fail('SUPPORT_PACKAGE_SCHEMA_INVALID', value?.schema, TypeError);
  }
  const rebuilt = stateMaterial(value.branches);
  assertCounts(value, rebuilt);
  return immutableJson(rebuilt, 'Sequential support-adjustment package state');
}
export function supportAdjustmentPackageRows(byBranch, consumedByBranch) {
  const rows = [...byBranch.entries()].flatMap(([branchId, stored]) => {
    const consumed = consumedByBranch.get(branchId) || new Set();
    if (!hasDurableAuthority(stored, consumed)) return [];
    return [{
      branchId,
      constructionFingerprint: stored.history.constructionFingerprint,
      baseProjectionFingerprint: stored.baseProjectionFingerprint,
      history: stored.history,
      consumedPreparedIds: [...consumed],
    }];
  });
  return createSequentialSupportAdjustmentPackageState(rows);
}
export function restoreSupportAdjustmentPackageMaps(value) {
  const state = assertSequentialSupportAdjustmentPackageState(value);
  const byBranch = new Map();
  const consumedByBranch = new Map();
  state.branches.forEach((item) => {
    byBranch.set(item.branchId, Object.freeze({
      baseProjectionFingerprint: item.baseProjectionFingerprint,
      history: item.history,
    }));
    consumedByBranch.set(item.branchId, new Set(item.consumedPreparedIds));
  });
  return Object.freeze({ state, byBranch, consumedByBranch });
}
