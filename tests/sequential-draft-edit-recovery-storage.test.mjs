import assert from 'node:assert/strict';
import { createSequentialDraftEditRecoveryRecord } from '../tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-recovery-contract.js';
import {
  createSequentialDraftEditRecoveryStorage,
  SEQUENTIAL_DRAFT_EDIT_RECOVERY_STORAGE_NAMESPACE,
} from '../tabs/sequential-sketcher/persistence/sequential-draft-edit-recovery-storage.js';

class MemoryStorage {
  constructor() { this.rows = new Map(); this.failWrite = false; }
  getItem(key) { return this.rows.get(key) ?? null; }
  setItem(key, value) { if (this.failWrite) throw new Error('quota'); this.rows.set(key, value); }
  removeItem(key) { this.rows.delete(key); }
}
const authority = (branchId) => ({ authorityId: `AUTH:${branchId}`, sourceFingerprint: 'SOURCE', branchId,
  branchSetFingerprint: 'BRANCHES', journalHeadFingerprint: 'JOURNAL',
  confirmedConstructionFingerprint: 'CONSTRUCTION', supportProjectionFingerprint: 'SUPPORT',
  ownerRevisionFingerprint: 'OWNER' });
function move(branchId, savedAt, delta = 1) {
  return createSequentialDraftEditRecoveryRecord({ kind: 'MOVE_COMPONENT', authority: authority(branchId),
    editBaseFingerprint: 'EDIT', selector: { objectId: `ENTITY:${branchId}` },
    targetEvidence: { targetId: `TARGET:${branchId}`, authorityId: `AUTH:${branchId}`, sceneRevision: 'REV' },
    input: { constraint: { kind: 'axis', axis: 'X' },
      rawDelta: { x: delta, y: 0, z: 0 }, delta: { x: delta, y: 0, z: 0 },
      interaction: { kind: 'numeric', source: 'exact-xyz' }, snapSelection: null }, savedAt });
}

const adapter = new MemoryStorage(); const diagnostics = [];
const storage = createSequentialDraftEditRecoveryStorage({ storage: adapter, maxRecords: 2,
  onDiagnostic: (row) => diagnostics.push(row) });
assert.equal(storage.save(move('/A', '2026-07-30T16:00:00.000Z')), true);
assert.equal(storage.save(move('/A', '2026-07-30T16:01:00.000Z', 2)), true);
assert.equal(storage.list().length, 1);
assert.equal(storage.list()[0].input.delta.x, 2);
assert.equal(storage.save(move('/B', '2026-07-30T16:02:00.000Z')), true);
assert.equal(storage.save(move('/C', '2026-07-30T16:03:00.000Z')), true);
assert.deepEqual(storage.list().map((row) => row.authority.branchId), ['/B', '/C']);
assert.equal(storage.forBranch('/B').length, 1);
assert.equal(storage.remove('/B', 'MOVE_COMPONENT'), true);
assert.equal(storage.forBranch('/B').length, 0);
assert.equal(storage.clearBranch('/C'), true);
assert.equal(storage.list().length, 0);

adapter.rows.set(SEQUENTIAL_DRAFT_EDIT_RECOVERY_STORAGE_NAMESPACE, '{broken');
assert.deepEqual(storage.list(), []);
assert.equal(storage.getState().available, false);
assert.equal(diagnostics.at(-1).code, 'DRAFT_EDIT_RECOVERY_STORAGE_READ_FAILED');

const failingAdapter = new MemoryStorage(); failingAdapter.failWrite = true;
const failing = createSequentialDraftEditRecoveryStorage({ storage: failingAdapter,
  onDiagnostic: (row) => diagnostics.push(row) });
assert.equal(failing.save(move('/D', '2026-07-30T16:04:00.000Z')), false);
assert.equal(failing.getState().available, false);
assert.equal(diagnostics.at(-1).code, 'DRAFT_EDIT_RECOVERY_STORAGE_WRITE_FAILED');

const oversizedAdapter = new MemoryStorage();
const oversizedDiagnostics = [];
const boundedStorage = createSequentialDraftEditRecoveryStorage({ storage: oversizedAdapter,
  maxBytes: 2048, onDiagnostic: (row) => oversizedDiagnostics.push(row) });
const oversizedBase = move('/E', '2026-07-30T16:05:00.000Z');
const oversized = createSequentialDraftEditRecoveryRecord({ ...oversizedBase,
  targetEvidence: { ...oversizedBase.targetEvidence, note: 'x'.repeat(4000) } });
assert.equal(boundedStorage.save(oversized), false);
assert.equal(boundedStorage.getState().available, true);
assert.equal(oversizedDiagnostics.at(-1).code, 'DRAFT_EDIT_RECOVERY_RECORD_TOO_LARGE');

assert.equal(storage.destroy(), true); assert.equal(storage.destroy(), false);
console.log('Sequential pending draft recovery storage: ok');
