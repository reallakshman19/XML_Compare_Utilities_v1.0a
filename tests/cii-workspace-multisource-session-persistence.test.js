import assert from 'node:assert/strict';
import {
  CII_MS_SESSION_SCHEMA,
  ciiWriter2SessionCustody,
  ciiWriter2SessionStorage,
  ciiWriter2SessionStorageKey,
  createCiiWriter2SessionSnapshot,
  loadCiiWriter2Session,
  restoreCiiWriter2AnchorSession,
  restoreCiiWriter2AnchorSnapshot,
  restoreCiiWriter2ReviewDecisions,
  saveCiiWriter2Session,
} from '../tabs/cii-workspace/cii-workspace-multisource-session-persistence.js';

const suggestion = {
  sourceNodeId: '10', targetNodeId: '100', basisMethod: 'METHOD_B_NETWORK', confidence: 'HIGH',
  methodB: { status: 'READY' },
};
const inspection = {
  sourceSet: { sourceSetSha256: 'source-set-abc' },
  versionBridge: { target: { originalSha256: 'target-xyz' } },
  memberInspections: [
    { sourceId: 'S1', inspection: { baseAnchorSuggestions: [suggestion] } },
    { sourceId: 'S2', inspection: { baseAnchorSuggestions: [{ ...suggestion, sourceNodeId: '20', targetNodeId: '200' }] } },
  ],
};

const custody = ciiWriter2SessionCustody(inspection);
assert.deepEqual(custody, {
  sourceSetSha256: 'source-set-abc',
  targetOriginalSha256: 'target-xyz',
  storageKey: ciiWriter2SessionStorageKey('source-set-abc', 'target-xyz'),
});
assert.ok(custody.storageKey.includes('source-set-abc:target-xyz'));

const snapshot = createCiiWriter2SessionSnapshot({
  ...custody,
  selectedBySource: new Map([
    ['S1', new Set(['10=>100', 'stale=>key'])],
    ['S2', new Set(['20=>200'])],
  ]),
  manualBySource: new Map([
    ['S1', [{ sourceNodeId: '3910', targetNodeId: '875' }, { sourceNodeId: '3910', targetNodeId: '875' }]],
    ['S2', []],
  ]),
  manualDraftBySource: new Map([
    ['S1', { sourceNodeId: '3940', targetNodeId: '880' }],
    ['S2', { sourceNodeId: '', targetNodeId: 'abc' }],
  ]),
  reviewFilters: { confidence: 'high', search: 'S1 / node', changedOnly: true },
  scopeIntent: 'BOUND_EXPECTED_NODENAME',
  reviewDecisions: new Map([
    ['corr-1', 'ACCEPT'],
    ['corr-2', 'REJECT'],
    ['corr-bad', 'MAYBE'],
  ]),
  correspondenceIdentity: 'corr-set-1',
});
assert.equal(snapshot.schema, CII_MS_SESSION_SCHEMA);
assert.deepEqual(snapshot.review.decisions, { 'corr-1': 'ACCEPT', 'corr-2': 'REJECT' });
assert.deepEqual(snapshot.reviewFilters, { confidence: 'HIGH', search: 'S1 / node', changedOnly: true });
assert.equal(snapshot.scopeIntent, 'BOUND_EXPECTED_NODENAME');

const restoredAnchors = restoreCiiWriter2AnchorSession(snapshot, inspection);
assert.ok(restoredAnchors);
assert.deepEqual(restoredAnchors.selectedBySource.S1, ['10=>100'], 'inactive automatic evidence must survive a manual-active restored session');
assert.equal(restoredAnchors.authorityModeBySource.S1, 'MANUAL', 'legacy saved session still executes manual authority by default');
assert.deepEqual(restoredAnchors.manualBySource.S1, [{ sourceNodeId: '3910', targetNodeId: '875' }], 'manual pairs must restore duplicate-safe');
assert.deepEqual(restoredAnchors.selectedBySource.S2, ['20=>200']);
assert.deepEqual(restoredAnchors.manualDraftBySource.S1, { sourceNodeId: '3940', targetNodeId: '880' });
assert.deepEqual(restoredAnchors.reviewFilters, { confidence: 'HIGH', search: 'S1 / node', changedOnly: true });
assert.equal(restoredAnchors.scopeIntent, 'BOUND_EXPECTED_NODENAME');
assert.deepEqual(restoredAnchors.staleSelectionSourceIds, ['S1'], 'stale automatic keys must be explicit instead of silently becoming authority');

const directProjection = restoreCiiWriter2AnchorSnapshot(snapshot, custody, ['S1', 'S2'], {
  S1: ['10=>100'], S2: ['20=>200'],
});
assert.deepEqual(directProjection.manualBySource.S1, [{ sourceNodeId: '3910', targetNodeId: '875' }]);
assert.deepEqual(directProjection.staleSelectionSourceIds, ['S1']);

const wrongCustody = restoreCiiWriter2AnchorSession({ ...snapshot, targetOriginalSha256: 'other-target' }, inspection);
assert.equal(wrongCustody, null, 'different target custody must never restore session authority');

const reviewMatch = restoreCiiWriter2ReviewDecisions(snapshot, 'corr-set-1', ['corr-1', 'corr-2', 'corr-3']);
assert.equal(reviewMatch.matched, true);
assert.deepEqual(reviewMatch.decisions, { 'corr-1': 'ACCEPT', 'corr-2': 'REJECT' });
const reviewMismatch = restoreCiiWriter2ReviewDecisions(snapshot, 'corr-set-2', ['corr-1', 'corr-2']);
assert.equal(reviewMismatch.matched, false, 'review decisions must fail closed when correspondence identity changes');
assert.deepEqual(reviewMismatch.decisions, {});

const memory = new Map();
const storage = {
  getItem(key) { return memory.has(key) ? memory.get(key) : null; },
  setItem(key, value) { memory.set(key, String(value)); },
};
assert.equal(saveCiiWriter2Session(storage, custody.storageKey, snapshot), true);
assert.deepEqual(loadCiiWriter2Session(storage, custody.storageKey), JSON.parse(JSON.stringify(snapshot)));
memory.set(custody.storageKey, '{broken');
assert.equal(loadCiiWriter2Session(storage, custody.storageKey), null, 'corrupt storage must fail closed');
assert.equal(loadCiiWriter2Session({ getItem() { throw new Error('blocked'); } }, custody.storageKey), null, 'read failures must fail closed');
assert.equal(saveCiiWriter2Session({ setItem() { throw new Error('quota'); } }, custody.storageKey, snapshot), false, 'write failures must fail closed');
assert.equal(ciiWriter2SessionStorage({ get localStorage() { throw new Error('blocked'); } }), null, 'restricted browser storage must fail closed instead of breaking Writer2');

const normalized = createCiiWriter2SessionSnapshot({
  sourceSetSha256: 'source-set-abc', targetOriginalSha256: 'target-xyz',
  reviewFilters: { confidence: 'nonsense', search: 'x'.repeat(300), changedOnly: 1 },
  scopeIntent: 'NOT_AUTHORITY',
});
assert.equal(normalized.reviewFilters.confidence, 'ALL');
assert.equal(normalized.reviewFilters.search.length, 256);
assert.equal(normalized.reviewFilters.changedOnly, true);
assert.equal(normalized.scopeIntent, null, 'unknown scope state must never become persisted authority');

console.log('CII Writer2 multi-source session persistence contract checks: PASS');