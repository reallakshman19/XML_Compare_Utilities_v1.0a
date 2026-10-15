import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createRevisionLoadService } from '../tabs/revision-compare/revision-load-service.js';
import { createInlineRevisionWorkerClient } from '../tabs/revision-compare/revision-intake-worker-client.js';
import { completeRevisionLoad, completeRevisionScope, createRevisionIntakeState } from '../tabs/revision-compare/revision-intake-state.js';
import {
  REVISION_COMPARE_JSON_DOCUMENT_SCHEMA, createRevisionCompareJsonDocumentSnapshot,
  revisionCompareJsonSnapshotMatchesDocument,
} from '../tabs/revision-compare/revision-json-document.js';

const hash = (value) => value.repeat(64);
const component = { id: 'C-1', type: 'PIPE', description: null, active: false, negativeZero: -0, unknownExtension: { order: [3, 1, 2], flag: true } };
const bare = [{ name: 'B-1', children: [component], extension: 'branch-extra' }];
const before = structuredClone(bare);
const snapshot = await createRevisionCompareJsonDocumentSnapshot({
  side: 'REV_A', sourceDocumentId: 'baseline:aaa', sourceContentSha256: hash('a'),
  fileName: 'rev-a.json', profile: 'inputxml-managed-stage/v1', parsedValue: bare,
}, webcrypto);
assert.equal(snapshot.schema, REVISION_COMPARE_JSON_DOCUMENT_SCHEMA);
assert.equal(snapshot.rootKind, 'ARRAY');
assert.deepEqual(snapshot.parsedValue, before);
assert.deepEqual(bare, before, 'snapshot creation must not mutate source input');
assert.equal(snapshot.parsedValue[0].children[0].description, null);
assert.equal(Object.hasOwn(snapshot.parsedValue[0].children[0], 'missing'), false);
assert.equal(snapshot.parsedValue[0].children[0].active, false);
assert.equal(Object.is(snapshot.parsedValue[0].children[0].negativeZero, -0), true);
assert.deepEqual(snapshot.parsedValue[0].children[0].unknownExtension.order, [3, 1, 2]);
assert(Object.isFrozen(snapshot) && Object.isFrozen(snapshot.parsedValue[0].children[0]));
assert.equal(snapshot.entityIndex.length, 2);
assert.equal(snapshot.entityIndex[1].entityId, 'record:A:baseline:aaa:$[0].children[0]');
assert.equal(snapshot.entityIndex[1].canonicalPath, '/0/children/0');
assert.match(snapshot.entityIndex[1].entitySha256, /^[a-f0-9]{64}$/);
assert(snapshot.pathIndex.some((entry) => entry.canonicalPath === '/0/children/0/unknownExtension/order/2'));
assert.equal(revisionCompareJsonSnapshotMatchesDocument(snapshot, {
  documentId: 'baseline:aaa', sourceHash: hash('a'), fileName: 'rev-a.json',
}), true);

for (const rootKey of ['objects', 'hierarchy', 'branches']) {
  const envelope = { schema: 'xml-cii2019-enriched-stage/v1', metadata: { retained: true }, [rootKey]: [{ name: `B-${rootKey}`, components: [{ objectId: 'X-1', material: 'CS' }] }], futureField: { x: 1 } };
  const copy = structuredClone(envelope);
  const value = await createRevisionCompareJsonDocumentSnapshot({
    side: 'REV_B', sourceDocumentId: `candidate:${rootKey}`, sourceContentSha256: hash('b'),
    fileName: `${rootKey}.json`, profile: envelope.schema, parsedValue: envelope,
  }, webcrypto);
  assert.equal(value.rootKind, 'ENVELOPE');
  assert.deepEqual(value.parsedValue, copy);
  assert.equal(value.parsedValue.metadata.retained, true);
  assert.equal(value.parsedValue.futureField.x, 1);
  assert.equal(value.entityIndex[1].entityId, `record:B:candidate:${rootKey}:$.${rootKey}[0].components[0]`);
  assert.equal(value.entityIndex[1].canonicalPath, `/${rootKey}/0/components/0`);
}

await assert.rejects(() => createRevisionCompareJsonDocumentSnapshot({
  side: 'REV_A', sourceDocumentId: 'bad', sourceContentSha256: hash('a'), fileName: 'bad.json', parsedValue: { unsupported: [] },
}, webcrypto), /Unsupported staged JSON root/);
await assert.rejects(() => createRevisionCompareJsonDocumentSnapshot({
  side: 'REV_A', sourceDocumentId: 'bad', sourceContentSha256: hash('a'), fileName: 'bad.json', parsedValue: [{ name: 'B', children: [{ value: undefined }] }],
}, webcrypto), /plain JSON values/);

const service = createRevisionLoadService(webcrypto, { clientFactory: () => createInlineRevisionWorkerClient({ cryptoRef: webcrypto }) });
const generation = service.begin('baseline');
const loaded = await service.loadText('baseline', 'loaded.json', JSON.stringify(bare), '2026-07-22T09:00:00.000Z', generation);
assert.equal(loaded.jsonSnapshot.schema, REVISION_COMPARE_JSON_DOCUMENT_SCHEMA);
assert.deepEqual(loaded.jsonSnapshot.parsedValue, JSON.parse(JSON.stringify(bare)));
let intake = createRevisionIntakeState('baseline', 'REFERENCE');
intake = Object.freeze({ ...intake, requestGeneration: generation, status: 'LOADING' });
intake = completeRevisionLoad(intake, loaded);
assert.equal(intake.status, 'READY'); assert.equal(intake.jsonSnapshot, loaded.jsonSnapshot);
const scopedResult = await service.applyScope('baseline', { selectedIds: ['branch:B-1'] }, '2026-07-22T09:01:00.000Z');
const scoped = completeRevisionScope(intake, scopedResult, Object.freeze({ selectedIds: Object.freeze(['branch:B-1']), exclusions: Object.freeze([]) }));
assert.equal(scoped.jsonSnapshot, loaded.jsonSnapshot, 'scope changes must preserve the full lossless snapshot');
service.dispose();

console.log('revision-compare-json-document.test.mjs passed');
