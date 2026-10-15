import assert from 'node:assert/strict';
import { _test as compositeTest } from '../tabs/cii-workspace/cii-workspace-target-writer-composite.js';

const keep = Object.freeze({ operationId: 'KEEP', action: 'KEEP', status: 'PREVIEW_READY' });
const lower = Object.freeze({
  operationId: 'LOWER', family: 'PROCESS', property: 'P3', action: 'COPY', status: 'PREVIEW_READY',
  policyAuthority: 'CII_WRITER_1B_CARDINALITY_PRESERVING_ELEMENT_FIELD',
});
const nodeName = Object.freeze({
  operationId: 'NAME', family: 'NODE_NAME', property: 'Node name / to-name', action: 'COPY', status: 'PREVIEW_READY',
  policyAuthority: 'CII_WRITER_1C_NODENAME_EXISTING_ROW_FIELD',
});
const sif = Object.freeze({
  operationId: 'SIF', family: 'SIF_TEE', property: 'SIF/Tee slot 1 In-Plane SIF (ii)', action: 'COPY', status: 'PREVIEW_READY',
  policyAuthority: 'CII_WRITER_1C_SIF_IN_PLANE_EXISTING_BLOCK',
});
const split = compositeTest.splitPlan(Object.freeze({ operations: Object.freeze([keep, lower, nodeName, sif]) }));
assert.deepEqual(split.lowerOperations.map((item) => item.operationId), ['LOWER']);
assert.deepEqual(split.writer1COperations.map((item) => item.operationId), ['NAME', 'SIF']);
assert(split.lowerPlan.operations.some((item) => item.operationId === 'KEEP'));
assert(split.writer1CPlan.operations.some((item) => item.operationId === 'KEEP'));
assert.equal(compositeTest.lowerWriterAuthority(lower), 'WRITER_1B');
assert.equal(compositeTest.lowerWriterAuthority({ policyAuthority: 'CII_WRITER_1A_CARDINALITY_PRESERVING_ELEMENT_FIELD' }), 'WRITER_1A');
assert.equal(compositeTest.lowerWriterAuthority({ policyAuthority: 'UNQUALIFIED' }), null);

const identicalWithinFamily = compositeTest.canonicalizeClaims([
  Object.freeze({ spanKey: '10:23', absoluteByteStart: 10, absoluteByteEnd: 23, width: 13, beforeField: '      1.00000', afterField: '      2.00000', operationIds: ['A'], sourceWriters: ['WRITER_1C'] }),
  Object.freeze({ spanKey: '10:23', absoluteByteStart: 10, absoluteByteEnd: 23, width: 13, beforeField: '      1.00000', afterField: '      2.00000', operationIds: ['B'], sourceWriters: ['WRITER_1C'] }),
]);
assert.equal(identicalWithinFamily.length, 1);
assert.deepEqual(identicalWithinFamily[0].operationIds, ['A', 'B']);
assert.deepEqual(identicalWithinFamily[0].sourceWriters, ['WRITER_1C']);

assert.throws(() => compositeTest.canonicalizeClaims([
  Object.freeze({ spanKey: '10:23', absoluteByteStart: 10, absoluteByteEnd: 23, width: 13, beforeField: '      1.00000', afterField: '      2.00000', operationIds: ['A'], sourceWriters: ['WRITER_1B'] }),
  Object.freeze({ spanKey: '10:23', absoluteByteStart: 10, absoluteByteEnd: 23, width: 13, beforeField: '      1.00000', afterField: '      2.00000', operationIds: ['B'], sourceWriters: ['WRITER_1C'] }),
]), /CROSS_FAMILY_SAME_SPAN/);

assert.throws(() => compositeTest.canonicalizeClaims([
  Object.freeze({ spanKey: '10:23', absoluteByteStart: 10, absoluteByteEnd: 23, width: 13, beforeField: '      1.00000', afterField: '      2.00000', operationIds: ['A'], sourceWriters: ['WRITER_1A'] }),
  Object.freeze({ spanKey: '10:23', absoluteByteStart: 10, absoluteByteEnd: 23, width: 13, beforeField: '      1.00000', afterField: '      3.00000', operationIds: ['B'], sourceWriters: ['WRITER_1C'] }),
]), /CROSS_FAMILY_SAME_SPAN/);

assert.throws(() => compositeTest.canonicalizeClaims([
  Object.freeze({ spanKey: '10:23', absoluteByteStart: 10, absoluteByteEnd: 23, width: 13, beforeField: '1234567890123', afterField: 'ABCDEFGHIJKLM', operationIds: ['A'], sourceWriters: ['WRITER_1B'] }),
  Object.freeze({ spanKey: '20:33', absoluteByteStart: 20, absoluteByteEnd: 33, width: 13, beforeField: '1234567890123', afterField: 'ABCDEFGHIJKLM', operationIds: ['B'], sourceWriters: ['WRITER_1C'] }),
]), /CROSS_FAMILY_SPAN_OVERLAP/);

const originalText = '      1.00000\r\n';
const original = new TextEncoder().encode(originalText);
const targetDocument = Object.freeze({ physicalFile: Object.freeze({ lines: Object.freeze([Object.freeze({ byteStart: 0 })]) }) });
const normalized = compositeTest.normalizeLowerMutation(Object.freeze({
  lineNumber: 1, startColumn: 1, endColumn: 13, beforeField: '      1.00000', afterField: '      2.00000', operationId: 'LOWER', section: 'ELEMENTS', field: 'P3',
}), targetDocument, original, lower);
assert.equal(normalized.absoluteByteStart, 0);
assert.equal(normalized.absoluteByteEnd, 13);
assert.deepEqual(normalized.sourceWriters, ['WRITER_1B']);
assert.throws(() => compositeTest.normalizeLowerMutation(Object.freeze({
  lineNumber: 1, startColumn: 1, endColumn: 13, beforeField: '      9.00000', afterField: '      2.00000', operationId: 'LOWER', section: 'ELEMENTS', field: 'P3',
}), targetDocument, original, lower), /ORIGINAL_PREIMAGE_MISMATCH/);
assert.throws(() => compositeTest.normalizeLowerMutation(Object.freeze({
  lineNumber: 1, startColumn: 1, endColumn: 13, beforeField: '      1.00000', afterField: '      2.00000', operationId: 'LOWER', section: 'ELEMENTS', field: 'P3',
}), targetDocument, original, { operationId: 'LOWER', policyAuthority: 'UNQUALIFIED' }), /LOWER_POLICY_AUTHORITY_REQUIRED/);

console.log('Composite split, lower-writer authority, collision, overlap and original-preimage gates passed.');
