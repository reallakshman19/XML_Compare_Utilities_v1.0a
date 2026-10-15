import assert from 'node:assert/strict';
import { createSequentialDraftEditRecoveryController } from '../tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-recovery-controller.js';

function element() {
  const listeners = new Map();
  return { hidden: false, disabled: false, textContent: '', style: { cssText: '' }, attrs: new Map(),
    setAttribute(name, value) { this.attrs.set(name, value); }, removeAttribute(name) { this.attrs.delete(name); },
    addEventListener(type, fn) { listeners.set(type, fn); }, removeEventListener(type) { listeners.delete(type); },
    click() { listeners.get('click')?.({ target: this }); }, remove() { this.removed = true; },
    querySelectorAll() { return []; }, insertAdjacentHTML() {},
  };
}
function root() {
  const selectors = ['[data-ssk-visual-stack]', '[data-ssk-draft-recovery]',
    '[data-ssk-draft-recovery-kind]', '[data-ssk-draft-recovery-detail]',
    '[data-ssk-draft-recovery-restore]', '[data-ssk-draft-recovery-discard]',
    '[data-ssk-draft-recovery-status]'];
  const values = new Map(selectors.map((selector) => [selector, element()]));
  values.get('[data-ssk-draft-recovery]').querySelectorAll = () => [
    values.get('[data-ssk-draft-recovery-restore]'), values.get('[data-ssk-draft-recovery-discard]')];
  return { querySelector: (selector) => values.get(selector) || null, values };
}
function memoryStorage() {
  const rows = new Map();
  return { save(record) { rows.set(`${record.authority.branchId}|${record.kind}`, record); return true; },
    list() { return [...rows.values()]; },
    forBranch(branchId) { return [...rows.values()].filter((row) => row.authority.branchId === branchId); },
    remove(branchId, kind) { return rows.delete(`${branchId}|${kind}`); },
    getState: () => ({ available: true, recordCount: rows.size, lastDiagnostic: null }), rows };
}
const context = { authority: { authorityId: 'AUTH', sourceFingerprint: 'SOURCE', branchId: '/A',
  branchSetFingerprint: 'BRANCHES', journalHeadFingerprint: 'JOURNAL',
  confirmedConstructionFingerprint: 'CONSTRUCTION', supportProjectionFingerprint: 'SUPPORT',
  ownerRevisionFingerprint: 'OWNER' }, editBaseFingerprint: 'EDIT' };
const descriptor = { selector: { objectId: 'ENTITY' },
  targetEvidence: { targetId: 'TARGET', authorityId: 'AUTH', sceneRevision: 'REV' },
  input: { constraint: { kind: 'axis', axis: 'X' }, rawDelta: { x: 5, y: 0, z: 0 },
    delta: { x: 5, y: 0, z: 0 }, interaction: { kind: 'numeric', source: 'exact-xyz' },
    snapSelection: null } };
const storage = memoryStorage();
const first = createSequentialDraftEditRecoveryController({ root: root(), storage,
  readContext: () => context, now: () => '2026-07-30T16:00:00.000Z', restoreHandlers: {} });
first.capture('MOVE_COMPONENT', descriptor);
assert.equal(storage.rows.size, 1);
first.clear('MOVE_COMPONENT', 'workspace-closed');
assert.equal(storage.rows.size, 1);
assert.equal(first.refresh().kind, 'MOVE_COMPONENT');
first.destroy();

let restored = 0; let activated = 0;
const secondRoot = root();
const second = createSequentialDraftEditRecoveryController({ root: secondRoot, storage,
  readContext: () => context, now: () => '2026-07-30T16:01:00.000Z',
  beforeRestore: async () => { activated += 1; return true; },
  restoreHandlers: { MOVE_COMPONENT(record) { restored += 1; return record.input.delta; } } });
assert.equal(second.refresh().kind, 'MOVE_COMPONENT');
assert.equal(second.getState().record.kind, 'MOVE_COMPONENT');
assert.deepEqual(await second.restore(), { x: 5, y: 0, z: 0, magnitude: 5 });
assert.equal(activated, 1);
assert.equal(restored, 1);
assert.equal(second.getState().record, null);
assert.equal(second.getState().restoring, false);
assert.equal(storage.rows.size, 1);
second.refresh();
assert.equal(second.getState().record, null);
second.clear('MOVE_COMPONENT', 'accepted-geometry-move');
assert.equal(storage.rows.size, 0);

second.capture('MOVE_COMPONENT', descriptor);
second.destroy();
const third = createSequentialDraftEditRecoveryController({ root: root(), storage,
  readContext: () => context, now: () => '2026-07-30T16:02:00.000Z',
  restoreHandlers: { MOVE_COMPONENT() { throw new Error('must not restore'); } } });
assert.equal(third.refresh().kind, 'MOVE_COMPONENT');
assert.equal(third.discard(), true);
assert.equal(storage.rows.size, 0);

third.capture('MOVE_COMPONENT', descriptor); third.destroy();
const stale = createSequentialDraftEditRecoveryController({ root: root(), storage,
  readContext: () => ({ ...context, editBaseFingerprint: 'CHANGED' }),
  now: () => '2026-07-30T16:03:00.000Z', restoreHandlers: {} });
assert.equal(stale.refresh(), null);
assert.equal(storage.rows.size, 0);
assert.match(stale.getState().notice, /STALE_REMOVED/);

const transientStorage = memoryStorage();
const transientCapture = createSequentialDraftEditRecoveryController({ root: root(), storage: transientStorage,
  readContext: () => context, now: () => '2026-07-30T16:03:10.000Z', restoreHandlers: {} });
transientCapture.capture('MOVE_COMPONENT', descriptor); transientCapture.destroy();
let moveContextReadable = false;
const transient = createSequentialDraftEditRecoveryController({ root: root(), storage: transientStorage,
  readContext: (kind) => {
    if (kind === 'MOVE_COMPONENT' && !moveContextReadable) throw new RangeError('geometry history is temporarily unavailable');
    return context;
  },
  now: () => '2026-07-30T16:03:11.000Z', restoreHandlers: {} });
assert.equal(transient.refresh(), null);
assert.equal(transient.getState().record, null);
assert.equal(transientStorage.rows.size, 1);
moveContextReadable = true;
assert.equal(transient.refresh().kind, 'MOVE_COMPONENT');
assert.equal(transientStorage.rows.size, 1);
transient.destroy();

const driftStorage = memoryStorage();
let liveContext = context; let driftRestored = 0;
const driftCapture = createSequentialDraftEditRecoveryController({ root: root(), storage: driftStorage,
  readContext: () => liveContext, now: () => '2026-07-30T16:03:30.000Z', restoreHandlers: {} });
driftCapture.capture('MOVE_COMPONENT', descriptor); driftCapture.destroy();
const drift = createSequentialDraftEditRecoveryController({ root: root(), storage: driftStorage,
  readContext: () => liveContext, now: () => '2026-07-30T16:03:31.000Z',
  beforeRestore: async () => { liveContext = { ...context, editBaseFingerprint: 'CHANGED' }; return true; },
  restoreHandlers: { MOVE_COMPONENT() { driftRestored += 1; } } });
assert.equal(drift.refresh().kind, 'MOVE_COMPONENT');
assert.equal(await drift.restore(), null);
assert.equal(driftRestored, 0);
assert.equal(driftStorage.rows.size, 0);
assert.match(drift.getState().notice, /RESTORE_REJECTED/);

const otherContext = { ...context, authority: { ...context.authority, authorityId: 'AUTH-B', branchId: '/B',
  branchSetFingerprint: 'BRANCHES-BEFORE-DELETION' } };
const inventoryStorage = memoryStorage();
const other = createSequentialDraftEditRecoveryController({ root: root(), storage: inventoryStorage,
  readContext: () => otherContext,
  now: () => '2026-07-30T16:04:00.000Z', restoreHandlers: {} });
other.capture('MOVE_COMPONENT', { ...descriptor,
  targetEvidence: { ...descriptor.targetEvidence, authorityId: 'AUTH-B' } });
other.destroy();
const pruner = createSequentialDraftEditRecoveryController({ root: root(), storage: inventoryStorage,
  readContext: () => context,
  now: () => '2026-07-30T16:05:00.000Z', restoreHandlers: {} });
assert.equal(pruner.refresh(), null);
assert.equal(inventoryStorage.rows.size, 0);
assert.match(pruner.getState().notice, /STALE_INVENTORY_REMOVED/);

const unavailableStorage = memoryStorage();
unavailableStorage.getState = () => ({ available: false, recordCount: 0,
  lastDiagnostic: { code: 'DRAFT_EDIT_RECOVERY_STORAGE_UNAVAILABLE', message: 'blocked' } });
const unavailableRoot = root();
const unavailable = createSequentialDraftEditRecoveryController({ root: unavailableRoot,
  storage: unavailableStorage, readContext: () => context,
  now: () => '2026-07-30T16:06:00.000Z', restoreHandlers: {} });
assert.equal(unavailable.getState().warning, true);
assert.equal(unavailableRoot.values.get('[data-ssk-draft-recovery]').hidden, false);

console.log('Sequential pending draft recovery controller: ok');
