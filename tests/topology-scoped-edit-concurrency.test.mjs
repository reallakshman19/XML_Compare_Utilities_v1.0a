import assert from 'node:assert/strict';
import { createTopologyDraftRecovery } from '../tabs/topology-trace-validator/topology-draft-recovery.js';
import { createTopologyAuthorityFixture as fixture, topologyTestBuilt as builtFor, topologyTestStorage as memoryStorage, TopologyTestLockManager as FakeLockManager } from './topology-scoped-edit-authority-contracts.test.mjs';

const locks = new FakeLockManager(), storage = memoryStorage();
const writer = createTopologyDraftRecovery(storage, { lockManager: locks });
await writer.acquireWriter('topology-document:test');
for (let index = 0; index < 500; index += 1) {
  const contender = createTopologyDraftRecovery(storage, { lockManager: locks });
  await assert.rejects(() => contender.acquireWriter('topology-document:test'), (error) => error.code === 'TOPOLOGY_EDIT_WRITER_UNAVAILABLE');
}
writer.releaseWriter();
await Promise.resolve();

const race = await fixture();
const prepared = Array.from({ length: 501 }, () => race.service.prepareNative(race.authorizedInput));
const first = race.service.acceptPrepared(prepared[0], race.service.certifyRegeneration(prepared[0], builtFor(prepared[0])));
assert.equal(first.accepted, true);
let stale = 0;
for (const candidate of prepared.slice(1)) {
  const evidence = race.service.certifyRegeneration(candidate, builtFor(candidate));
  const result = race.service.acceptPrepared(candidate, evidence);
  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, 'STALE_TOPOLOGY_EDIT_AUTHORITY');
  stale += 1;
}
assert.equal(stale, 500);
assert.equal(race.storage.writes(), 1, 'stale prepared work never overwrites the accepted recovery head');
race.service.destroy();
console.log('[PASS] 500 cross-context writer denials and 500 stale prepared acceptance rejections');
