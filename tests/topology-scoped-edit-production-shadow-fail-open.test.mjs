import assert from 'node:assert/strict';
import { _test as shadowTest } from '../tabs/topology-trace-validator/topology-scoped-edit-production-shadow.js';

const snapshot = Object.freeze({ schema: 'TopologyScopedEditReadModel.v1', authorityId: 'A0',
  authority: Object.freeze({ authorityId: 'A0' }), selectionSnapshot: Object.freeze({ entityIds: Object.freeze([]) }),
  commandScopeBasis: Object.freeze({ editableEntityIds: Object.freeze([]) }) });
const factories = Object.freeze({ createReadModel: async () => { throw Object.assign(new Error('bad snapshot'), { code: 'BAD' }); },
  assertReadModel: async () => { throw Object.assign(new Error('bad snapshot'), { code: 'BAD' }); },
  createShadow: async () => { throw new Error('unreachable'); }, resolveTargets: () => null,
  runPositive: () => null });
const diagnostics = [];
const shadow = shadowTest.createWithFactories({ snapshotProvider: () => snapshot,
  authorityProvider: () => 'A0', onDiagnostic: (value) => diagnostics.push(value) }, {}, factories);
await assert.doesNotReject(() => shadow.observe());
assert.equal(shadow.evidence().status, 'DEGRADED');
assert.equal(shadow.evidence().mounted, false);
assert.equal(diagnostics.at(-1).error.code, 'BAD');
assert.doesNotThrow(() => shadow.destroy());
assert.equal(shadow.evidence().status, 'DESTROYED');

let releaseSnapshot;
const pendingSnapshot = new Promise((resolve) => { releaseSnapshot = resolve; });
const lifecycleShadow = shadowTest.createWithFactories({ snapshotProvider: () => pendingSnapshot,
  authorityProvider: () => 'A0' }, {}, factories);
const pendingObserve = lifecycleShadow.observe();
await Promise.resolve();
lifecycleShadow.destroy();
releaseSnapshot(snapshot);
await pendingObserve;
assert.equal(lifecycleShadow.evidence().status, 'DESTROYED');
assert.equal(lifecycleShadow.evidence().mounted, false);
console.log('[PASS] P4B diagnostics fail open without mutating or blocking the native editor');
