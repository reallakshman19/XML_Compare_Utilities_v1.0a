/** Immutable branch-local history for support-adjustment register transitions. */
import { immutableJson, requiredContractText } from '../../../contracts/contract-values.js';
import { stableToken } from '../sequential-sketcher-contract.js';
import {
  assertSequentialSupportAdjustmentRegister,
  createSequentialSupportAdjustmentRegister,
} from './sequential-support-adjustment-register.js';

export const SEQUENTIAL_SUPPORT_ADJUSTMENT_HISTORY_SCHEMA =
  'SequentialSupportAdjustmentHistory.v1';
export const SEQUENTIAL_SUPPORT_ADJUSTMENT_HISTORY_ACTIONS = Object.freeze([
  'UNDO_SUPPORT_ADJUSTMENT',
  'REDO_SUPPORT_ADJUSTMENT',
]);

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}
function fingerprint(prefix, value) {
  return `fnv1a32-canonical-json-v1:${prefix}:${stableToken(canonicalJson(value))}`;
}
function same(left, right) { return canonicalJson(left) === canonicalJson(right); }
function action(value) {
  const result = requiredContractText(value, 'support history action').toUpperCase();
  if (!SEQUENTIAL_SUPPORT_ADJUSTMENT_HISTORY_ACTIONS.includes(result)) {
    throw new RangeError(`Unsupported support adjustment history action: ${result}`);
  }
  return result;
}
function register(value, constructionFingerprint) {
  return assertSequentialSupportAdjustmentRegister(value, constructionFingerprint);
}
function registerStack(value, constructionFingerprint, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array.`);
  return value.map((row) => register(row, constructionFingerprint));
}
function createHistory(input = {}) {
  const constructionFingerprint = requiredContractText(
    input.constructionFingerprint,
    'support history constructionFingerprint',
  );
  const baseProjectionFingerprint = requiredContractText(
    input.baseProjectionFingerprint,
    'support history baseProjectionFingerprint',
  );
  const currentRegister = register(input.currentRegister, constructionFingerprint);
  const undoStack = registerStack(input.undoStack || [], constructionFingerprint, 'Support history undoStack');
  const redoStack = registerStack(input.redoStack || [], constructionFingerprint, 'Support history redoStack');
  const material = {
    schema: SEQUENTIAL_SUPPORT_ADJUSTMENT_HISTORY_SCHEMA,
    constructionFingerprint,
    baseProjectionFingerprint,
    currentRegister,
    undoStack,
    redoStack,
  };
  return immutableJson({
    ...material,
    historyFingerprint: fingerprint('SSUPPORTADJUSTMENTHISTORY', material),
  }, 'Sequential support adjustment history');
}
function assertAppend(previous, next) {
  if (next.entries.length !== previous.entries.length + 1
    || !same(previous.entries, next.entries.slice(0, -1))) {
    throw new RangeError('Accepted support adjustment must append exactly one canonical register entry.');
  }
}

export function createSequentialSupportAdjustmentHistory(input = {}) {
  const constructionFingerprint = requiredContractText(
    input.constructionFingerprint,
    'support history constructionFingerprint',
  );
  const currentRegister = input.currentRegister || createSequentialSupportAdjustmentRegister({
    constructionFingerprint,
  });
  return createHistory({
    constructionFingerprint,
    baseProjectionFingerprint: input.baseProjectionFingerprint,
    currentRegister,
    undoStack: input.undoStack || [],
    redoStack: input.redoStack || [],
  });
}
export function assertSequentialSupportAdjustmentHistory(value, expected = {}) {
  if (value?.schema !== SEQUENTIAL_SUPPORT_ADJUSTMENT_HISTORY_SCHEMA) {
    throw new TypeError(`Support adjustment history must use ${SEQUENTIAL_SUPPORT_ADJUSTMENT_HISTORY_SCHEMA}.`);
  }
  const rebuilt = createHistory(value);
  if (!same(rebuilt, value)) {
    throw new RangeError('Support adjustment history differs from canonical regeneration.');
  }
  if (expected.constructionFingerprint
    && rebuilt.constructionFingerprint !== expected.constructionFingerprint) {
    throw new RangeError('Support adjustment history construction fingerprint is stale.');
  }
  if (expected.baseProjectionFingerprint
    && rebuilt.baseProjectionFingerprint !== expected.baseProjectionFingerprint) {
    throw new RangeError('Support adjustment history base projection fingerprint is stale.');
  }
  return rebuilt;
}
export function recordSequentialSupportAdjustmentRegister(historyValue, nextRegisterValue) {
  const history = assertSequentialSupportAdjustmentHistory(historyValue);
  const nextRegister = register(nextRegisterValue, history.constructionFingerprint);
  assertAppend(history.currentRegister, nextRegister);
  return createHistory({
    ...history,
    currentRegister: nextRegister,
    undoStack: [...history.undoStack, history.currentRegister],
    redoStack: [],
  });
}
export function transitionSequentialSupportAdjustmentHistory(historyValue, actionValue) {
  const history = assertSequentialSupportAdjustmentHistory(historyValue);
  const normalized = action(actionValue);
  if (normalized === 'UNDO_SUPPORT_ADJUSTMENT') {
    if (!history.undoStack.length) throw new RangeError('No support adjustment is available to undo.');
    const currentRegister = history.undoStack.at(-1);
    return Object.freeze({
      action: normalized,
      affectedEntry: history.currentRegister.entries.at(-1) || null,
      history: createHistory({
        ...history,
        currentRegister,
        undoStack: history.undoStack.slice(0, -1),
        redoStack: [...history.redoStack, history.currentRegister],
      }),
    });
  }
  if (!history.redoStack.length) throw new RangeError('No support adjustment is available to redo.');
  const currentRegister = history.redoStack.at(-1);
  return Object.freeze({
    action: normalized,
    affectedEntry: currentRegister.entries.at(-1) || null,
    history: createHistory({
      ...history,
      currentRegister,
      undoStack: [...history.undoStack, history.currentRegister],
      redoStack: history.redoStack.slice(0, -1),
    }),
  });
}
export function sequentialSupportAdjustmentHistoryCapabilities(historyValue) {
  const history = assertSequentialSupportAdjustmentHistory(historyValue);
  return Object.freeze({
    canUndo: history.undoStack.length > 0,
    canRedo: history.redoStack.length > 0,
    undoCount: history.undoStack.length,
    redoCount: history.redoStack.length,
    currentAdjustmentCount: history.currentRegister.entries.length,
    currentRegisterHeadFingerprint: history.currentRegister.headFingerprint,
    historyFingerprint: history.historyFingerprint,
  });
}

export const _test = Object.freeze({ canonicalJson, fingerprint, same, assertAppend });
