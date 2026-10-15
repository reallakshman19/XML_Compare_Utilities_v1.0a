import assert from 'node:assert/strict';
import { sha256CiiByteString } from '../tabs/cii-workspace/cii-workspace-byte-sha256.js';
import { createCiiPhysicalFile } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import {
  buildCiiWriter2RestraintDeleteCompactionPlan,
  CII_WRITER_2_RESTRAINT_DELETE_COMPACTION_POLICY,
} from '../tabs/cii-workspace/cii-workspace-writer2-restraint-delete-compaction-plan.js';
import { CII_WRITER_2_RESTRAINT_POINTER_CUSTODY_AUTHORITY } from '../tabs/cii-workspace/cii-workspace-writer2-restraint-delete-custody.js';

function numericRow(values) {
  return `  ${values.map((value) => String(value).padStart(13, ' ')).join('')}`;
}
function textRow(value = '') { return `${String(value.length).padStart(12, ' ')} ${value}`; }
function emptySlot() {
  return [numericRow([0, 0, 0, 0, 0, 0]), numericRow([0, 0, 0]), textRow(), textRow()];
}
function occupiedSlot(node) {
  return [numericRow([node, 1, 1751200000000, 0, 0, 0]), numericRow([1, 0, 0]), textRow(), textRow()];
}
function restraintBlock(node) {
  return [...occupiedSlot(node), ...emptySlot(), ...emptySlot(), ...emptySlot(), ...emptySlot(), ...emptySlot()];
}
function elementBlock(from, to, pointer) {
  const rows = [numericRow([from, to, 0, 0, 0, 0])];
  for (let index = 1; index < 12; index += 1) rows.push(numericRow([0, 0, 0, 0, 0, 0]));
  rows.push(numericRow([0, 0, 0, pointer, 0, 0]));
  rows.push(numericRow([0, 0, 0, 0, 0, 0]));
  rows.push(numericRow([0, 0, 0]));
  assert.equal(rows.length, 15);
  return rows;
}
function beforeSlot(pointer, node) {
  return Object.freeze({
    pointer,
    slot: 1,
    line1: Object.freeze([node, 1, 1751200000000, 0, 0, 0]),
    line2: Object.freeze([1, 0, 0]),
    tag: '',
    guid: '',
    occupied: true,
  });
}

const endpoints = [[10, 20], [30, 40], [50, 60]];
const pointers = [1, 2, 3];
const nodes = [10, 30, 50];
const raw = [
  '#$ VERSION', numericRow([5, 11, 1256]),
  '#$ CONTROL',
  numericRow([3, 0, 0, 0, 0, 0]),
  numericRow([0, 0, 0, 3, 0, 0]),
  numericRow([0, 0, 0, 1, 0, 0]),
  numericRow([0]),
  '#$ ELEMENTS',
  ...endpoints.flatMap((pair, index) => elementBlock(pair[0], pair[1], pointers[index])),
  '#$ RESTRANT',
  ...nodes.flatMap(restraintBlock),
  '#$ DISPLMNT',
  '',
].join('\n');
const physicalFile = createCiiPhysicalFile(new TextEncoder().encode(raw));
const contentSha256 = sha256CiiByteString(physicalFile.originalByteString);
const parsedElements = Object.freeze(endpoints.map((pair, index) => Object.freeze({ index, from: pair[0], to: pair[1] })));
const auxiliaryElements = Object.freeze(Object.fromEntries(endpoints.map((pair, index) => [String(index), Object.freeze({
  parsedElementIndex: index,
  from: String(pair[0]),
  to: String(pair[1]),
  pointers: Object.freeze({ restraint: pointers[index] }),
})])));
const targetDocument = Object.freeze({
  contentSha256,
  physicalFile,
  parsed: Object.freeze({ elements: parsedElements }),
  auxiliaryEvidence: Object.freeze({
    restraints: Object.freeze({
      authority: 'PROTECTED_WRITER_RESTRANT_BLOCK_INDEX_24_ROWS',
      blockRows: 24,
      sectionRowCount: 72,
    }),
    elements: auxiliaryElements,
  }),
});

const mutation = Object.freeze({
  schema: 'CIIWorkspaceRestraintSlotMutation.v1',
  status: 'QUALIFIED',
  mode: 'CLEAR',
  authority: 'PROTECTED_WRITER_EXISTING_24_ROW_BLOCK_EMPTY_SLOT_TEMPLATE',
  pointer: 2,
  slot: 1,
  targetNode: '30',
  beforeSlot: beforeSlot(2, 30),
});
const operation = Object.freeze({
  operationId: 'FOCUSED-RESTRAINT-DELETE-P2',
  family: 'RESTRAINT',
  property: 'Qualified restraint slot mutation',
  action: 'DELETE',
  status: 'PREVIEW_READY',
  policyAuthority: 'CII_WRITER_1B_EXISTING_BLOCK_FIXED_SLOT',
  matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  sourceEvidence: Object.freeze({ value: mutation }),
  proposed: mutation,
  scopeDecision: 'APPLY',
});
const sourceHash = '1'.repeat(64);
const transferPlan = Object.freeze({
  status: 'PREVIEW_READY',
  blockers: Object.freeze([]),
  sourceDocument: Object.freeze({ contentSha256: sourceHash }),
  targetDocument: Object.freeze({ contentSha256 }),
  operations: Object.freeze([operation]),
  excludedOperations: Object.freeze([]),
  transferScope: Object.freeze({
    status: 'BOUND',
    mode: 'EXPLICIT_APPLY_EXCLUDE',
    authority: 'USER_EXPLICIT_OPERATION_SCOPE',
    scopeId: 'focused-restraint-compaction',
    sourceSha256: sourceHash,
    targetSha256: contentSha256,
    appliedOperationIds: Object.freeze([operation.operationId]),
    excludedOperationIds: Object.freeze([]),
    candidateOperationIds: Object.freeze([operation.operationId]),
  }),
});

const result = buildCiiWriter2RestraintDeleteCompactionPlan({ targetDocument, transferPlan });
assert.equal(result.ready, true, result.blockers.join('|'));
assert.equal(result.status, 'READY');
assert.equal(result.authority, CII_WRITER_2_RESTRAINT_DELETE_COMPACTION_POLICY);
assert.equal(result.pointerCustody.status, 'QUALIFIED');
assert.equal(result.pointerCustody.authority, CII_WRITER_2_RESTRAINT_POINTER_CUSTODY_AUTHORITY);
assert.equal(result.blockCountBefore, 3);
assert.equal(result.blockCountAfter, 2);
assert.equal(result.controlCountBefore, 3);
assert.equal(result.controlCountAfter, 2);
assert.deepEqual(result.deletedPointers, [2]);
assert.deepEqual(result.retainedPointers, [1, 3]);
assert.deepEqual(result.oldToNewPointer, { 1: 1, 2: 0, 3: 2 });
assert.deepEqual(
  result.pointerChanges.map((item) => [item.parsedElementIndex, item.oldPointer, item.newPointer]),
  [[1, 2, 0], [2, 3, 2]],
);
for (const item of Object.values(result.pointerCustody.byParsedElementIndex)) {
  assert.equal(item.pointerField.qualified, true);
  assert.equal(item.pointerField.width, 13);
  assert.match(item.pointerField.rawField.trim(), /^[+-]?\d+$/);
}
assert.equal(result.createAuthority.ready, false);
assert.equal(result.deletedRowRanges.length, 1);
assert.deepEqual(result.deletedRowRanges[0], { pointer: 2, sectionRowStart: 24, sectionRowEndExclusive: 48 });

console.log('Writer2 RESTRAINT focused compaction planner 1/2/3 -> 1/0/2: PASS');
