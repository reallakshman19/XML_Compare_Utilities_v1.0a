/** Explicit Restore/Discard owner for pending, non-publishing Draft Edit recovery. */
import {
  createSequentialDraftEditRecoveryRecord,
  SEQUENTIAL_DRAFT_EDIT_RECOVERY_KINDS,
  sequentialDraftEditRecoveryContextMatches,
} from './sequential-draft-edit-recovery-contract.js';

export const SEQUENTIAL_DRAFT_EDIT_RECOVERY_CONTROLLER_SCHEMA =
  'SequentialDraftEditRecoveryController.v1';

const PRESERVE_REASON = /closed|workspace|branch|mode|authority|destroy|interruption/i;

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function required(root, selector) {
  const value = root.querySelector(selector);
  if (!value) throw new Error(`Draft recovery element missing: ${selector}`);
  return value;
}
function markup() {
  return `<section data-ssk-draft-recovery hidden aria-hidden="true" inert>
<header><strong>Pending Draft Edit recovery</strong><span data-ssk-draft-recovery-kind></span></header>
<pre data-ssk-draft-recovery-detail>No pending draft.</pre>
<div><button type="button" data-ssk-draft-recovery-restore>Restore draft</button><button type="button" data-ssk-draft-recovery-discard>Discard draft</button></div>
<output data-ssk-draft-recovery-status role="status" aria-live="polite">Recovery is pending work only and never publishes.</output>
</section>`;
}
function install(root) {
  const host = required(root, '[data-ssk-visual-stack]');
  if (!root.querySelector('[data-ssk-draft-recovery]')) host.insertAdjacentHTML('beforeend', markup());
  const panel = required(root, '[data-ssk-draft-recovery]');
  panel.style.cssText = [
    'position:absolute', 'left:12px', 'bottom:12px', 'z-index:14',
    'width:min(420px,calc(100% - 24px))', 'padding:12px',
    'border:1px solid rgba(245,158,11,.55)', 'border-radius:12px',
    'background:rgba(7,16,31,.97)', 'color:#e2e8f0',
  ].join(';');
  panel.querySelectorAll?.('button')?.forEach((button) => {
    button.style.cssText = 'margin:8px 6px 0 0;padding:7px;border:1px solid rgba(148,163,184,.35);border-radius:7px;background:#172337;color:#dbeafe';
  });
  return panel;
}
function setHidden(panel, hidden) {
  panel.hidden = hidden; panel.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  if (hidden) panel.setAttribute('inert', ''); else panel.removeAttribute('inert');
}
function newest(records) {
  return [...records].sort((left, right) => right.savedAt.localeCompare(left.savedAt))[0] || null;
}
function currentContext(state, kind) { return state.readContext(kind); }
function currentBranch(state) {
  for (const kind of SEQUENTIAL_DRAFT_EDIT_RECOVERY_KINDS) {
    try { return currentContext(state, kind).authority.branchId; } catch {}
  }
  return null;
}
function render(state) {
  const record = state.record;
  setHidden(state.panel, !record && !state.warning);
  state.kind.textContent = record ? record.kind : '';
  state.detail.textContent = record
    ? `Branch: ${record.authority.branchId}\nSaved: ${record.savedAt}\nTarget: ${record.targetEvidence.targetId}\nValues: ${JSON.stringify(record.input)}`
    : state.warning ? 'No pending draft. Crash recovery storage is unavailable or stale.' : 'No pending draft.';
  state.restore.disabled = !record || state.destroyed || state.restoring;
  state.discard.disabled = !record || state.destroyed || state.restoring;
  state.status.textContent = state.notice || 'Recovery is pending work only and never publishes.';
}
function diagnostic(state, code, error = null) {
  state.warning = true;
  const row = Object.freeze({ schema: 'SequentialDraftEditRecoveryDiagnostic.v1', code,
    message: error?.message || String(error || code) });
  state.notice = `${code}: ${row.message}`;
  try { state.onDiagnostic(row); } catch {}
  return row;
}
function syncStorageWarning(state) {
  const storageState = state.storage.getState?.() || null;
  if (storageState && storageState.available === false) {
    state.warning = true;
    const detail = storageState.lastDiagnostic;
    state.notice = detail ? `${detail.code}: ${detail.message}`
      : 'DRAFT_EDIT_RECOVERY_STORAGE_UNAVAILABLE: Crash recovery storage is unavailable.';
    return true;
  }
  return false;
}
function currentGlobalAuthority(state) {
  for (const kind of SEQUENTIAL_DRAFT_EDIT_RECOVERY_KINDS) {
    try { return currentContext(state, kind).authority; } catch {}
  }
  return null;
}
function pruneStaleInventory(state) {
  if (typeof state.storage.list !== 'function') return 0;
  const current = currentGlobalAuthority(state);
  if (!current) return 0;
  const fields = ['sourceFingerprint', 'branchSetFingerprint', 'journalHeadFingerprint'];
  let removed = 0;
  for (const record of state.storage.list()) {
    const globalStale = fields.some((field) => record.authority[field] !== current[field]);
    if (!globalStale) continue;
    if (state.storage.remove(record.authority.branchId, record.kind)) removed += 1;
  }
  if (removed) diagnostic(state, 'DRAFT_EDIT_RECOVERY_STALE_INVENTORY_REMOVED',
    new Error(`${removed} pending recovery record(s) no longer match workspace ancestry.`));
  return removed;
}
function validRecords(state, branchId) {
  const valid = [];
  for (const record of state.storage.forBranch(branchId)) {
    let context;
    try { context = currentContext(state, record.kind); }
    catch { continue; }
    if (sequentialDraftEditRecoveryContextMatches(record, context)) valid.push(record);
    else {
      state.storage.remove(record.authority.branchId, record.kind);
      diagnostic(state, 'DRAFT_EDIT_RECOVERY_STALE_REMOVED',
        new Error(`${record.kind} recovery no longer matches current authority.`));
    }
  }
  return valid;
}
function refresh(state) {
  if (state.destroyed) return null;
  syncStorageWarning(state); pruneStaleInventory(state);
  const branchId = currentBranch(state);
  if (!branchId) { state.lastBranchId = null; state.record = null; render(state); return null; }
  if (state.lastBranchId !== branchId) { state.suppressed.clear(); state.lastBranchId = branchId; }
  const candidates = validRecords(state, branchId)
    .filter((row) => !state.suppressed.has(row.recordFingerprint));
  state.record = newest(candidates); render(state); return state.record;
}
function capture(state, kind, descriptor) {
  if (state.destroyed) return null;
  try {
    const context = currentContext(state, kind);
    const record = createSequentialDraftEditRecoveryRecord({ kind, ...descriptor,
      authority: context.authority, editBaseFingerprint: context.editBaseFingerprint,
      savedAt: state.now() });
    if (!state.storage.save(record)) {
      diagnostic(state, 'DRAFT_EDIT_RECOVERY_NOT_DURABLE',
        new Error('The draft remains usable, but crash recovery storage is unavailable.'));
      return record;
    }
    state.suppressed.add(record.recordFingerprint); state.warning = false;
    state.notice = `${kind} pending draft saved for explicit recovery.`;
    return record;
  } catch (error) {
    diagnostic(state, 'DRAFT_EDIT_RECOVERY_CAPTURE_FAILED', error); return null;
  }
}
function releaseSuppression(state, branchId, kind) {
  state.storage.forBranch(branchId).filter((row) => row.kind === kind)
    .forEach((row) => state.suppressed.delete(row.recordFingerprint));
}
function clear(state, kind, reason = 'cleared') {
  if (state.destroyed) return false;
  const branchId = currentBranch(state);
  if (!branchId) return false;
  if (PRESERVE_REASON.test(String(reason || ''))) {
    releaseSuppression(state, branchId, kind);
    state.notice = `${kind} pending draft preserved for explicit recovery.`;
    return false;
  }
  const removed = state.storage.remove(branchId, kind);
  state.warning = false; state.suppressed.clear(); state.notice = `${kind} recovery cleared: ${reason}.`;
  refresh(state); return removed;
}
function ensureCurrentRecord(state, record) {
  if (state.record?.recordFingerprint !== record.recordFingerprint) {
    throw new RangeError('Pending draft changed while Draft Edit 3D was opening.');
  }
  if (!sequentialDraftEditRecoveryContextMatches(record, currentContext(state, record.kind))) {
    throw new RangeError('Pending draft ancestry changed before restore.');
  }
}
async function restore(state) {
  const record = state.record;
  if (!record || state.restoring) return null;
  state.restoring = true;
  state.notice = `${record.kind} recovery is opening Draft Edit 3D for current-authority review.`;
  render(state);
  try {
    ensureCurrentRecord(state, record);
    const activated = await state.beforeRestore(record);
    if (activated === false) throw new Error('Draft Edit 3D could not be opened for recovery.');
    if (state.destroyed) return null;
    ensureCurrentRecord(state, record);
    const result = await requiredFunction(state.restoreHandlers[record.kind],
      `restoreHandlers.${record.kind}`)(record);
    state.suppressed.add(record.recordFingerprint); state.record = null; state.warning = false;
    state.notice = `${record.kind} draft restored to preview. Prepare and Apply remain explicit.`;
    return result;
  } catch (error) {
    state.storage.remove(record.authority.branchId, record.kind); state.record = null;
    diagnostic(state, 'DRAFT_EDIT_RECOVERY_RESTORE_REJECTED', error); return null;
  } finally {
    state.restoring = false;
    if (!state.destroyed) render(state);
  }
}
function discard(state) {
  const record = state.record;
  if (!record || state.restoring) return false;
  state.storage.remove(record.authority.branchId, record.kind);
  state.warning = false; state.suppressed.delete(record.recordFingerprint); state.record = null;
  state.notice = `${record.kind} pending draft discarded. Accepted authority was unchanged.`;
  render(state); return true;
}

export function createSequentialDraftEditRecoveryController(options = {}) {
  const root = options.root; if (!root?.querySelector) throw new TypeError('Draft recovery controller requires a root.');
  const panel = install(root);
  const state = {
    root, panel, storage: options.storage,
    readContext: requiredFunction(options.readContext, 'readContext'),
    now: requiredFunction(options.now, 'now'),
    beforeRestore: requiredFunction(options.beforeRestore || (async () => true), 'beforeRestore'),
    restoreHandlers: options.restoreHandlers || {},
    onDiagnostic: requiredFunction(options.onDiagnostic || (() => {}), 'onDiagnostic'),
    kind: required(root, '[data-ssk-draft-recovery-kind]'),
    detail: required(root, '[data-ssk-draft-recovery-detail]'),
    restore: required(root, '[data-ssk-draft-recovery-restore]'),
    discard: required(root, '[data-ssk-draft-recovery-discard]'),
    status: required(root, '[data-ssk-draft-recovery-status]'),
    record: null, notice: null, warning: false, suppressed: new Set(), lastBranchId: null,
    restoring: false, destroyed: false,
  };
  if (!state.storage?.save || !state.storage?.forBranch || !state.storage?.remove) {
    throw new TypeError('Draft recovery controller requires a recovery storage owner.');
  }
  syncStorageWarning(state);
  const onRestore = () => { void restore(state); }; const onDiscard = () => discard(state);
  state.restore.addEventListener('click', onRestore); state.discard.addEventListener('click', onDiscard);
  render(state);
  return Object.freeze({
    schema: SEQUENTIAL_DRAFT_EDIT_RECOVERY_CONTROLLER_SCHEMA,
    capture: (kind, descriptor) => capture(state, kind, descriptor),
    clear: (kind, reason) => clear(state, kind, reason),
    refresh: () => refresh(state),
    restore: () => restore(state), discard: () => discard(state),
    getState: () => Object.freeze({ record: state.record, notice: state.notice, warning: state.warning,
      restoring: state.restoring, storage: state.storage.getState?.() || null, destroyed: state.destroyed }),
    destroy() {
      if (state.destroyed) return false;
      state.destroyed = true; state.restore.removeEventListener('click', onRestore);
      state.discard.removeEventListener('click', onDiscard); state.panel.remove(); return true;
    },
  });
}

export const _test = Object.freeze({ currentGlobalAuthority, newest, pruneStaleInventory,
  releaseSuppression, syncStorageWarning, validRecords });
