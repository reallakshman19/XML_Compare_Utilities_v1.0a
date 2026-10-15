import assert from 'node:assert/strict';
import { semanticHash } from '../tabs/topology-trace-validator/topology-validator-values.js';
import { createTopologyAuthorityFixture as fixture, topologyTestBuilt as builtFor, topologyTestStorage as memoryStorage, TopologyTestLockManager as FakeLockManager } from './topology-scoped-edit-authority-contracts.test.mjs';

let authorized = 0, writes = 0, mutations = 0;
const authorityVariants = new Set();
for (let index = 0; index < 1000; index += 1) {
  const current = await fixture(), inputHash = semanticHash(current.authorizedInput);
  const prepared = current.service.prepareNative(current.authorizedInput);
  const acceptance = current.service.acceptPrepared(prepared, current.service.certifyRegeneration(prepared, builtFor(prepared)));
  assert.equal(acceptance.accepted, true); assert.equal(current.storage.writes(), 1);
  if (semanticHash(current.authorizedInput) !== inputHash) mutations += 1;
  authorityVariants.add(acceptance.authority.authorityId); authorized += 1; writes += current.storage.writes();
  current.service.destroy();
}
assert.equal(mutations, 0); assert.equal(writes, 1000); assert.equal(authorityVariants.size, 1);

const source = await fixture();
let prepared = source.service.prepareNative(source.authorizedInput);
let acceptance = source.service.acceptPrepared(prepared, source.service.certifyRegeneration(prepared, builtFor(prepared)));
assert.equal(acceptance.accepted, true); assert.equal(source.storage.writes(), 1);
const beforeUndo = source.service.currentAuthority().authorityId;
const undoPrepared = source.service.prepareUndo(source.uiState, source.nextTime(), beforeUndo);
assert.throws(() => { throw new Error('full producer regeneration failed'); }, /regeneration failed/);
assert.equal(source.service.currentAuthority().authorityId, beforeUndo);
assert.equal(source.storage.writes(), 1, 'undo preparation and failed regeneration do not persist');
acceptance = source.service.acceptPrepared(undoPrepared, source.service.certifyRegeneration(undoPrepared, builtFor(undoPrepared)));
assert.equal(acceptance.accepted, true); assert.equal(source.storage.writes(), 2);
const redoPrepared = source.service.prepareRedo(source.uiState, source.nextTime(), source.service.currentAuthority().authorityId);
assert.equal(source.storage.writes(), 2);
acceptance = source.service.acceptPrepared(redoPrepared, source.service.certifyRegeneration(redoPrepared, builtFor(redoPrepared)));
assert.equal(acceptance.accepted, true); assert.equal(source.storage.writes(), 3);
const snapshot = source.service.evidence().lastSnapshot; source.service.destroy(); await Promise.resolve();

const target = await fixture({ storage: memoryStorage(), lockManager: new FakeLockManager() });
const targetBefore = target.service.currentAuthority().authorityId;
const loadPrepared = target.service.prepareLoad(snapshot, targetBefore);
assert.equal(target.storage.writes(), 0, 'load preparation is non-publishing');
assert.throws(() => { throw new Error('loaded artifact regeneration failed'); }, /regeneration failed/);
assert.equal(target.service.currentAuthority().authorityId, targetBefore); assert.equal(target.storage.writes(), 0);
acceptance = target.service.acceptPrepared(loadPrepared, target.service.certifyRegeneration(loadPrepared, builtFor(loadPrepared)));
assert.equal(acceptance.accepted, true); assert.equal(target.storage.writes(), 1); target.service.destroy();

const history = await fixture();
prepared = history.service.prepareNative(history.authorizedInput);
acceptance = history.service.acceptPrepared(prepared, history.service.certifyRegeneration(prepared, builtFor(prepared)));
assert.equal(acceptance.accepted, true);
let cycles = 0;
for (let index = 0; index < 100; index += 1) {
  const undo = history.service.prepareUndo(history.uiState, history.nextTime(), history.service.currentAuthority().authorityId);
  assert.equal(history.service.acceptPrepared(undo, history.service.certifyRegeneration(undo, builtFor(undo))).accepted, true);
  const redo = history.service.prepareRedo(history.uiState, history.nextTime(), history.service.currentAuthority().authorityId);
  assert.equal(history.service.acceptPrepared(redo, history.service.certifyRegeneration(redo, builtFor(redo))).accepted, true);
  cycles += 1;
}
assert.equal(history.storage.writes(), 201); history.service.destroy();

const failed = await fixture({ failWrites: true });
prepared = failed.service.prepareNative(failed.authorizedInput);
const failedBefore = failed.service.currentAuthority().authorityId;
acceptance = failed.service.acceptPrepared(prepared, failed.service.certifyRegeneration(prepared, builtFor(prepared)));
assert.equal(acceptance.accepted, false); assert.equal(acceptance.reasonCode, 'RECOVERY_PERSISTENCE_FAILED');
assert.equal(failed.service.currentAuthority().authorityId, failedBefore); assert.equal(failed.storage.writes(), 0); assert.equal(failed.storage.attempts(), 1);
failed.service.destroy();
console.log(`[PASS] authorized=${authorized} mutations=${mutations} authorityVariants=${authorityVariants.size} undoRedo=${cycles} atomic load and persistence containment`);
