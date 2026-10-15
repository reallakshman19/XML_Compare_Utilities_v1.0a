import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createTopologyDraftRecovery, releaseTopologyDraftAuthority, TOPOLOGY_RECOVERY_KEY_PREFIX,
} from '../tabs/topology-trace-validator/topology-draft-recovery.js';
import { runTopologyScopedEditConformance } from '../tabs/topology-trace-validator/topology-scoped-edit-conformance.js';
import { TOPOLOGY_COMMAND_AUTHORITY_MODE } from '../tabs/topology-trace-validator/topology-scoped-edit-command-scope.js';
import { createTopologyAuthorityFixture as fixture, topologyTestStorage as memoryStorage, TopologyTestLockManager as FakeLockManager } from './topology-scoped-edit-authority-contracts.test.mjs';

async function conformanceFixture(name) {
  if (name === 'forged-recovery') {
    const storage = memoryStorage(), locks = new FakeLockManager(), original = await fixture({ storage, lockManager: locks });
    let prepared = original.service.prepareNative(original.authorizedInput);
    let regeneration = original.service.certifyRegeneration(prepared, original.regenerate(prepared));
    assert.equal(original.service.acceptPrepared(prepared, regeneration).accepted, true);
    original.service.checkpoint(original.uiState, original.nextTime());
    const key = `${TOPOLOGY_RECOVERY_KEY_PREFIX}topology-document:test`;
    const snapshot = JSON.parse(storage.entries().get(key)); snapshot.commandJournal.checkpoints[0].stateHash = 'forged';
    storage.seed(key, JSON.stringify(snapshot)); original.service.destroy(); await new Promise((resolve) => setTimeout(resolve, 0));
    return fixture({ storage, lockManager: locks });
  }
  const mode = ['boundary-rejection', 'excluded-rejection'].includes(name)
    ? TOPOLOGY_COMMAND_AUTHORITY_MODE.LARGE_SCOPED : TOPOLOGY_COMMAND_AUTHORITY_MODE.SMALL_FULL;
  const f = await fixture({ mode, failWrites: name === 'persistence-failure' });
  return Object.freeze({ ...f, mismatchCommandType: 'DELETE_EDGE', attemptSecondWriter: async () => {
    const contender = createTopologyDraftRecovery(f.storage, { lockManager: f.lockManager });
    try { await contender.acquireWriter('topology-document:test'); return ''; } catch (error) { return error.code; }
  } });
}

const report = await runTopologyScopedEditConformance({ fixtureFactory: conformanceFixture });
assert.equal(report.schema, 'TopologyScopedEditConformance.v1');
assert.equal(report.valid, true, JSON.stringify(report.checks.filter((row) => !row.passed), null, 2));
for (const name of ['authorized-commit', 'boundary-rejection', 'excluded-rejection', 'payload-command-mismatch',
  'persistence-failure', 'stale-writer', 'forged-recovery', 'undo-redo', 'load-regeneration',
  'destroy-terminality', 'input-immutability']) assert.equal(report.checks.find((row) => row.name === `scenario:${name}`)?.passed, true, name);

let remounts = 0, forged = 0;
for (let index = 0; index < 100; index += 1) {
  const storage = memoryStorage(), locks = new FakeLockManager(), original = await fixture({ storage, lockManager: locks });
  let prepared = original.service.prepareNative(original.authorizedInput);
  const regeneration = original.service.certifyRegeneration(prepared, original.regenerate(prepared));
  assert.equal(original.service.acceptPrepared(prepared, regeneration).accepted, true);
  original.service.checkpoint(original.uiState, original.nextTime());
  const acceptedAuthority = original.service.currentAuthority().authorityId;
  original.service.destroy(); await new Promise((resolve) => setTimeout(resolve, 0));
  const remounted = await fixture({ storage, lockManager: locks });
  assert.equal(remounted.service.restore().authority.authorityId, acceptedAuthority); remounts += 1;
  remounted.service.destroy(); await new Promise((resolve) => setTimeout(resolve, 0));
  const key = `${TOPOLOGY_RECOVERY_KEY_PREFIX}topology-document:test`, snapshot = JSON.parse(storage.entries().get(key));
  snapshot.commandJournal.checkpoints[0].stateHash = `forged-${index}`; storage.seed(key, JSON.stringify(snapshot));
  const forgedService = await fixture({ storage, lockManager: locks });
  assert.throws(() => forgedService.service.restore(), (error) => error.code === 'SESSION_DRAFT_INVALID');
  forgedService.service.destroy(); await new Promise((resolve) => setTimeout(resolve, 0)); forged += 1;
}

async function acquire(storage, locks, documentId) {
  const recovery = createTopologyDraftRecovery(storage, { lockManager: locks });
  await recovery.acquireWriter(documentId);
  return recovery;
}
async function releaseThroughService(recovery) {
  let destroys = 0;
  await releaseTopologyDraftAuthority(Object.freeze({ destroy() { destroys += 1; recovery.releaseWriter(); } }), recovery);
  return destroys;
}

const sameStorage = memoryStorage(), sameLocks = new FakeLockManager();
const sameFirst = await acquire(sameStorage, sameLocks, 'topology-document:same');
assert.equal(await releaseThroughService(sameFirst), 1);
const sameSecond = await acquire(sameStorage, sameLocks, 'topology-document:same');
await sameSecond.releaseWriter(); assert.equal(sameLocks.held.size, 0);

const differentStorage = memoryStorage(), differentLocks = new FakeLockManager();
const oldDocument = await acquire(differentStorage, differentLocks, 'topology-document:old');
assert.equal(await releaseThroughService(oldDocument), 1);
const newDocument = await acquire(differentStorage, differentLocks, 'topology-document:new');
await newDocument.releaseWriter(); assert.equal(differentLocks.held.size, 0);

const failedStorage = memoryStorage(), failedLocks = new FakeLockManager();
const failedInitialization = await acquire(failedStorage, failedLocks, 'topology-document:failed');
await releaseTopologyDraftAuthority(null, failedInitialization);
assert.equal(failedLocks.held.size, 0, 'failed initialization must release its acquired writer');

const files = ['topology-scoped-edit-authority-contracts.js', 'topology-scoped-edit-command-targets.js',
  'topology-scoped-edit-command-scope.js', 'topology-scoped-edit-acceptance.js',
  'topology-scoped-edit-conformance.js', 'topology-edit-journal-service.js',
  'topology-edit-autofix-service.js', 'topology-edit-controller.js', 'topology-draft-recovery.js'];
let controllerSource = '';
for (const file of files) {
  const source = readFileSync(fileURLToPath(new URL(`../tabs/topology-trace-validator/${file}`, import.meta.url)), 'utf8');
  if (file === 'topology-edit-controller.js') controllerSource = source;
  assert(source.split(/\r?\n/).length <= 300, `${file} exceeds 300 lines`);
  assert.doesNotMatch(source, /export\s+default/, `${file} uses default export`);
  assert.doesNotMatch(source, /core\/scoped-edit-runtime|core\/edit-3d/, `${file} mounts shared runtime or Edit 3D`);
}
assert.match(controllerSource, /await releaseJournalAuthority\(\);\s*clearAcceptedEditState\(\);[\s\S]*await recoveryStore\.acquireWriter/,
  'changed-basis initialization must await previous writer release before acquiring the replacement');
assert.match(controllerSource, /catch \(error\) \{\s*await releaseJournalAuthority\(\);\s*clearAcceptedEditState\(\);/,
  'failed replacement initialization must release its newly acquired writer');

console.log(`[PASS] behavioral conformance checks=${report.checkCount} scenarios=11 remount=${remounts} forged=${forged} writerReplacements=3`);
