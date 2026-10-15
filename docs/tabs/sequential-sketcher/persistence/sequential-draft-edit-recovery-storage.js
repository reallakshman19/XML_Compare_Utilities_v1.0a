/** Bounded injected storage for pending Draft Edit recovery records. */
import {
  assertSequentialDraftEditRecoveryRecord,
  sequentialDraftEditRecoveryRecordKey,
} from '../scoped-edit/sequential-draft-edit-recovery-contract.js';

export const SEQUENTIAL_DRAFT_EDIT_RECOVERY_STORAGE_SCHEMA =
  'SequentialDraftEditRecoveryStorage.v1';
export const SEQUENTIAL_DRAFT_EDIT_RECOVERY_STORAGE_NAMESPACE =
  'XML_COMPARE_UTILITIES:SSK3D:P1C:RECOVERY:v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function storageAdapter(value) {
  if (!value) return null;
  for (const name of ['getItem', 'setItem', 'removeItem']) requiredFunction(value[name], `storage.${name}`);
  return value;
}
function diagnostic(state, code, error = null) {
  const row = Object.freeze({ schema: 'SequentialDraftEditRecoveryStorageDiagnostic.v1',
    code, message: error?.message || String(error || code) });
  state.lastDiagnostic = row;
  try { state.onDiagnostic(row); } catch {}
  return row;
}
function envelope(records = []) {
  return Object.freeze({ schema: SEQUENTIAL_DRAFT_EDIT_RECOVERY_STORAGE_SCHEMA,
    records: Object.freeze(records.map(assertSequentialDraftEditRecoveryRecord)) });
}
function sorted(records) {
  return [...records].sort((left, right) => left.savedAt.localeCompare(right.savedAt)
    || sequentialDraftEditRecoveryRecordKey(left).localeCompare(sequentialDraftEditRecoveryRecordKey(right)));
}
function parseEnvelope(state, text) {
  if (!text) return envelope();
  if (text.length > state.maxBytes) throw new RangeError('Pending draft recovery storage exceeds its byte bound.');
  const parsed = JSON.parse(text);
  if (parsed?.schema !== SEQUENTIAL_DRAFT_EDIT_RECOVERY_STORAGE_SCHEMA || !Array.isArray(parsed.records)) {
    throw new TypeError('Pending draft recovery storage envelope is invalid.');
  }
  if (parsed.records.length > state.maxRecords) {
    throw new RangeError('Pending draft recovery storage exceeds its record bound.');
  }
  const records = sorted(parsed.records.map(assertSequentialDraftEditRecoveryRecord));
  const keys = records.map(sequentialDraftEditRecoveryRecordKey);
  if (new Set(keys).size !== keys.length) throw new RangeError('Pending draft recovery storage keys must be unique.');
  return envelope(records);
}
function read(state) {
  if (state.destroyed || !state.storage || !state.available) return envelope();
  try { return parseEnvelope(state, state.storage.getItem(state.namespace)); }
  catch (error) {
    state.available = false;
    try { state.storage.removeItem(state.namespace); } catch {}
    diagnostic(state, 'DRAFT_EDIT_RECOVERY_STORAGE_READ_FAILED', error);
    return envelope();
  }
}
function encoded(records) {
  return JSON.stringify(envelope(records));
}
function bounded(state, records) {
  const rows = sorted(records).slice(-state.maxRecords);
  while (rows.length && encoded(rows).length > state.maxBytes) rows.shift();
  if (encoded(rows).length > state.maxBytes) {
    throw new RangeError('Pending draft recovery record exceeds the configured storage bound.');
  }
  return rows;
}
function write(state, records) {
  if (state.destroyed || !state.storage || !state.available) return false;
  try {
    state.storage.setItem(state.namespace, encoded(bounded(state, records)));
    state.lastDiagnostic = null;
    return true;
  } catch (error) {
    state.available = false;
    diagnostic(state, 'DRAFT_EDIT_RECOVERY_STORAGE_WRITE_FAILED', error);
    return false;
  }
}
function removeWhere(state, predicate) {
  const before = read(state).records;
  const after = before.filter((row) => !predicate(row));
  if (after.length === before.length) return false;
  return write(state, after);
}

export function createSequentialDraftEditRecoveryStorage(options = {}) {
  const state = {
    storage: storageAdapter(options.storage),
    namespace: String(options.namespace || SEQUENTIAL_DRAFT_EDIT_RECOVERY_STORAGE_NAMESPACE),
    maxRecords: Math.max(1, Number(options.maxRecords) || 16),
    maxBytes: Math.max(2048, Number(options.maxBytes) || 262144),
    onDiagnostic: requiredFunction(options.onDiagnostic || (() => {}), 'onDiagnostic'),
    available: Boolean(options.storage), destroyed: false, lastDiagnostic: null,
  };
  if (!state.storage) diagnostic(state, 'DRAFT_EDIT_RECOVERY_STORAGE_UNAVAILABLE',
    new Error('Browser recovery storage is unavailable.'));
  return Object.freeze({
    schema: SEQUENTIAL_DRAFT_EDIT_RECOVERY_STORAGE_SCHEMA,
    save(value) {
      const record = assertSequentialDraftEditRecoveryRecord(value);
      if (encoded([record]).length > state.maxBytes) {
        diagnostic(state, 'DRAFT_EDIT_RECOVERY_RECORD_TOO_LARGE',
          new RangeError('Pending draft recovery record exceeds the configured storage bound.'));
        return false;
      }
      const key = sequentialDraftEditRecoveryRecordKey(record);
      const records = read(state).records.filter((row) => sequentialDraftEditRecoveryRecordKey(row) !== key);
      return write(state, [...records, record]);
    },
    list() { return Object.freeze([...read(state).records]); },
    forBranch(branchId) {
      const id = String(branchId || '').trim();
      return Object.freeze(read(state).records.filter((row) => row.authority.branchId === id));
    },
    remove(branchId, kind) {
      const id = String(branchId || '').trim(); const type = String(kind || '').trim().toUpperCase();
      return removeWhere(state, (row) => row.authority.branchId === id && row.kind === type);
    },
    clearBranch(branchId) {
      const id = String(branchId || '').trim();
      return removeWhere(state, (row) => row.authority.branchId === id);
    },
    clearAll() {
      if (state.destroyed || !state.storage) return false;
      try { state.storage.removeItem(state.namespace); state.available = true; return true; }
      catch (error) { state.available = false;
        diagnostic(state, 'DRAFT_EDIT_RECOVERY_STORAGE_CLEAR_FAILED', error); return false; }
    },
    getState: () => Object.freeze({ available: state.available, namespace: state.namespace,
      recordCount: read(state).records.length, maxRecords: state.maxRecords,
      maxBytes: state.maxBytes, lastDiagnostic: state.lastDiagnostic, destroyed: state.destroyed }),
    destroy() { if (state.destroyed) return false; state.destroyed = true; return true; },
  });
}

export const _test = Object.freeze({ bounded, envelope, parseEnvelope, sorted });
