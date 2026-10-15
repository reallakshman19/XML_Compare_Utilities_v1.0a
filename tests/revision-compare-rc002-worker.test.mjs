import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createRevisionWorkerRuntime } from '../tabs/revision-compare/revision-intake-worker-runtime.js';
import { filterStagedDocument } from '../tabs/revision-compare/revision-staged-core.js';
import { sha256Text } from '../tabs/revision-compare/revision-hash.js';

const document = {
  schema: 'inputxml-managed-stage/v1', unit: 'mm', verticalAxis: 'Z', coordinateFrame: 'PLANT',
  branches: [
    { name: '/IN', children: [{ id: 'IN-1', type: 'PIPE', position: [0, 0, 0] }] },
    { name: '/OUT', children: [{ id: 'OUT-1', type: 'PIPE', position: [1, 0, 0] }] },
  ],
};
const text = JSON.stringify(document);
const sourceHash = await sha256Text(text, webcrypto);
const filtered = filterStagedDocument(document, { selectedIds: ['branch:/IN'] });
const scopedHash = await sha256Text(JSON.stringify(filtered.filtered), webcrypto);
const request = {
  basisId: 'basis:worker', side: 'A', sourceDocumentId: 'doc:A', sourceHash, scopedHash,
  selectedBranchIds: ['branch:/IN'],
};

const runtime = createRevisionWorkerRuntime({ cryptoRef: webcrypto });
const parsed = await runtime.handle({ type: 'parse', text, sourceHash });
assert.equal(parsed.stats.branchCount, 2);
const projection = await runtime.handle({ type: 'projectCompareRecords', request });
assert.equal(projection.records.length, 1);
assert.equal(projection.records[0].branchId, 'branch:/IN');
assert.equal(projection.records[0].identityEvidence[0].value, 'IN-1');
assert.equal(Object.hasOwn(projection, 'filtered'), false);
assert.doesNotMatch(JSON.stringify(projection), /OUT-1|"children"/);
assert(Object.isFrozen(projection) && Object.isFrozen(projection.records));

await assert.rejects(
  runtime.handle({ type: 'projectCompareRecords', request: { ...request, sourceHash: 'wrong' } }),
  /source hash does not match/,
);
await assert.rejects(
  runtime.handle({ type: 'projectCompareRecords', request: { ...request, scopedHash: 'wrong' } }),
  /scoped hash does not match/,
);
await assert.rejects(
  runtime.handle({ type: 'projectCompareRecords', request: { ...request, selectedBranchIds: ['branch:/MISSING'] } }),
  /branches do not reconcile|scope is not present/,
);
await runtime.handle({ type: 'reset' });
await assert.rejects(runtime.handle({ type: 'projectCompareRecords', request }), /No staged revision/);

console.log('revision-compare-rc002-worker.test.mjs passed');
