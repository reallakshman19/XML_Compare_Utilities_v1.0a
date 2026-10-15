import assert from 'node:assert/strict';
import test from 'node:test';

import { CII_SIX_FIELD_WIDTHS } from '../parser/fixed-field.js';
import {
  V14_AUX_BLOCKS,
  resolveV14AuxiliaryRecord,
} from '../tabs/cii-workspace/cii-workspace-find-replace-v14-aux-authority.js';
import {
  _test as scopeTest,
  resolveFindReplaceScope,
} from '../tabs/cii-workspace/cii-workspace-find-replace-scope-resolver.js';

function row(values) {
  return CII_SIX_FIELD_WIDTHS.map((width, index) => String(values[index] ?? 0).padStart(width, ' ')).join('');
}

function elementBlock(from, to, pointers = []) {
  const pointerRows = [pointers.slice(0, 6), pointers.slice(6, 12), pointers.slice(12, 15)];
  const rows = [
    row([from, to, 100, 0, 0, 114.3]),
    ...Array.from({ length: 11 }, () => row([0, 0, 0, 0, 0, 0])),
    ...pointerRows.map((values) => row(values)),
  ];
  assert.equal(rows.length, 15);
  return rows;
}

function pointerSet(block, value) {
  const pointers = Array(15).fill(0);
  pointers[V14_AUX_BLOCKS[block].pointerIndex] = value;
  return pointers;
}

function controlRows(block, count, elementCount = 2) {
  const rows = Array.from({ length: 4 }, () => Array(6).fill(0));
  rows[0][0] = elementCount;
  const spec = V14_AUX_BLOCKS[block];
  rows[spec.controlRow][spec.controlField] = count;
  return rows.map((values) => row(values));
}

function numericRows(count, marker = 1000) {
  return Array.from({ length: count }, (_, index) => row([marker + index, index, 0, 0, 0, 0]));
}

function fixture({ block, count = 1, selectedPointer = 1, otherPointer = 0, sectionRows }) {
  const lines = [
    '#$ CONTROL',
    ...controlRows(block, count),
    '#$ ELEMENTS',
    ...elementBlock(10, 20, pointerSet(block, selectedPointer)),
    ...elementBlock(20, 30, pointerSet(block, otherPointer)),
    `#$ ${V14_AUX_BLOCKS[block].section}`,
    ...(sectionRows ?? numericRows(count * V14_AUX_BLOCKS[block].rowsPerRecord)),
  ];
  return `${lines.join('\r\n')}\r\n`;
}

function resolveOwned(target0, block, from = 10, to = 20) {
  const lines = scopeTest.physicalLines(target0);
  return resolveV14AuxiliaryRecord(lines, { scope: 'BLOCK', block, from, to }, {
    elementBlocks: scopeTest.elementBlocks,
    exactElementBlock: scopeTest.exactElementBlock,
  });
}

test('v14 registry pins all 15 IEL pointers, CONTROL fields and record cardinalities', () => {
  const expected = {
    BEND: [0, 1, 0, 3], RIGID: [1, 1, 1, 1], EXPJT: [2, 1, 2, 1],
    RESTRANT: [3, 1, 3, 24], DISPLMNT: [4, 1, 4, 20], FORCMNT: [5, 1, 5, 20],
    UNIFORM: [6, 2, 0, 6], WIND: [7, 2, 1, 1], OFFSETS: [8, 2, 2, 1],
    ALLOWBLS: [9, 2, 3, 28], 'SIF&TEES': [10, 2, 4, 14], NODENAME: [11, 0, 3, 1],
    REDUCERS: [12, 0, 4, 2], FLANGES: [13, 0, 5, 12], EQUIPMNT: [14, 3, 0, 6],
  };
  for (const [block, [pointerIndex, controlRow, controlField, rowsPerRecord]] of Object.entries(expected)) {
    const spec = V14_AUX_BLOCKS[block];
    assert.deepEqual(
      [spec.pointerIndex, spec.controlRow, spec.controlField, spec.rowsPerRecord],
      [pointerIndex, controlRow, controlField, rowsPerRecord],
      block,
    );
  }
});

function assertOwnedRows(block, rowsPerRecord) {
  const target0 = fixture({ block, count: 1 });
  const resolved = resolveOwned(target0, block);
  assert.equal(resolved.status, 'PASS');
  assert.equal(resolved.refs.length, rowsPerRecord);
  assert.equal(resolved.evidence.rowCount, rowsPerRecord);
  assert.equal(resolved.evidence.controlCount, 1);
  assert.equal(resolved.evidence.ownerCount, 1);
}

test('v14 registry resolves BEND pointer 2 to the second exact 3-row record', () => {
  const target0 = fixture({ block: 'BEND', count: 2, selectedPointer: 2, otherPointer: 1 });
  const resolved = resolveOwned(target0, 'BEND');
  assert.equal(resolved.status, 'PASS');
  assert.equal(resolved.evidence.pointer, 2);
  assert.equal(resolved.evidence.recordIndex, 1);
  assert.equal(resolved.refs.length, 3);
  assert.match(resolved.refs[0].body, /1003/);
});

test('single and multi-row v14 auxiliary cardinalities resolve exactly', () => {
  assertOwnedRows('RIGID', 1);
  assertOwnedRows('EXPJT', 1);
  assertOwnedRows('RESTRANT', 24);
  assertOwnedRows('UNIFORM', 6);
  assertOwnedRows('WIND', 1);
  assertOwnedRows('OFFSETS', 1);
  assertOwnedRows('ALLOWBLS', 28);
  assertOwnedRows('SIF&TEES', 14);
  assertOwnedRows('REDUCERS', 2);
  assertOwnedRows('EQUIPMNT', 6);
});

test('legacy ALLOWBLS, SIF&TEES and REDUCERS row counts fail v14 cardinality', () => {
  for (const [block, legacyRows] of [['ALLOWBLS', 26], ['SIF&TEES', 10], ['REDUCERS', 1]]) {
    const resolved = resolveOwned(fixture({ block, count: 1, sectionRows: numericRows(legacyRows) }), block);
    assert.equal(resolved.status, 'BLOCKED');
    assert.ok(resolved.blockers.some((item) => item.startsWith(`AUX_SECTION_CARDINALITY_MISMATCH:${block}:`)));
  }
});

test('FLANGES preserves a meaningful blank physical payload row', () => {
  const sectionRows = numericRows(12);
  sectionRows[5] = '';
  const resolved = resolveOwned(fixture({ block: 'FLANGES', sectionRows }), 'FLANGES');
  assert.equal(resolved.status, 'PASS');
  assert.equal(resolved.refs.length, 12);
  assert.equal(resolved.refs[5].body, '');
});

test('pointer zero, out-of-range, malformed and shared ownership fail closed', () => {
  let resolved = resolveOwned(fixture({ block: 'BEND', count: 1, selectedPointer: 0 }), 'BEND');
  assert.ok(resolved.blockers.includes('AUX_POINTER_REQUIRED:BEND:10:20'));

  resolved = resolveOwned(fixture({ block: 'BEND', count: 1, selectedPointer: 2 }), 'BEND');
  assert.ok(resolved.blockers.some((item) => item.startsWith('AUX_POINTER_OUT_OF_RANGE:BEND:2:1:')));

  resolved = resolveOwned(fixture({ block: 'BEND', count: 1, selectedPointer: '1.5' }), 'BEND');
  assert.ok(resolved.blockers.includes('AUX_POINTER_UNREADABLE:BEND:0'));

  resolved = resolveOwned(fixture({ block: 'BEND', count: 1, selectedPointer: 1, otherPointer: 1 }), 'BEND');
  assert.ok(resolved.blockers.includes('AUX_POINTER_SHARED:BEND:1:2'));
});

test('CONTROL mismatch and embedded comments fail before record indexing', () => {
  let resolved = resolveOwned(fixture({ block: 'BEND', count: 2, sectionRows: numericRows(3) }), 'BEND');
  assert.ok(resolved.blockers.some((item) => item.startsWith('AUX_SECTION_CARDINALITY_MISMATCH:BEND:3:6:')));

  const rows = numericRows(3);
  rows[1] = '* ambiguous comment inside fixed-record payload';
  resolved = resolveOwned(fixture({ block: 'BEND', sectionRows: rows }), 'BEND');
  assert.ok(resolved.blockers.some((item) => item.startsWith('SECTION_COMMENT_AMBIGUOUS:BEND:')));
});

test('generic auxiliary ownership is visible but mutation remains blocked in Find & Replace', () => {
  const target0 = fixture({ block: 'BEND', count: 2, selectedPointer: 2, otherPointer: 1 });
  const resolved = resolveFindReplaceScope(target0, { scope: 'BLOCK', block: 'BEND', from: 10, to: 20 });
  assert.equal(resolved.status, 'BLOCKED');
  assert.equal(resolved.authority, 'CII_V14_AUX_RECORD_OWNERSHIP_READ_ONLY');
  assert.equal(resolved.evidence.pointer, 2);
  assert.deepEqual(resolved.spans, []);
  assert.ok(resolved.blockers.includes('BLOCK_MUTATION_NOT_QUALIFIED:BEND'));
});

function displacementRows(from = 10, to = 20) {
  return [
    row([from]),
    row([333, 0, 0, 0, 0, 0]),
    ...Array.from({ length: 8 }, () => row([0, 0, 0, 0, 0, 0])),
    row([to]),
    ...Array.from({ length: 9 }, () => row([0, 0, 0, 0, 0, 0])),
  ];
}

test('Displacement uses common CONTROL ownership while preserving endpoint identity checks', () => {
  let target0 = fixture({ block: 'DISPLMNT', sectionRows: displacementRows() });
  let resolved = resolveFindReplaceScope(target0, { scope: 'BLOCK', block: 'DISPLACEMENT', from: 10, to: 20 });
  assert.equal(resolved.status, 'PASS');
  assert.equal(resolved.authority, 'CII_V14_ELEMENT_DISPLMNT_POINTER_20_ROW_BLOCK');
  assert.equal(resolved.spans.length, 20);
  assert.equal(resolved.evidence.controlCount, 1);

  target0 = fixture({ block: 'DISPLMNT', sectionRows: displacementRows(999, 20) });
  resolved = resolveFindReplaceScope(target0, { scope: 'BLOCK', block: 'DISPLACEMENT', from: 10, to: 20 });
  assert.equal(resolved.status, 'BLOCKED');
  assert.ok(resolved.blockers.includes('DISPLMNT_ENDPOINT_IDENTITY_MISMATCH:999'));

  target0 = fixture({ block: 'DISPLMNT', selectedPointer: 0, sectionRows: displacementRows() });
  resolved = resolveFindReplaceScope(target0, { scope: 'BLOCK', block: 'DISPLACEMENT', from: 10, to: 20 });
  assert.ok(resolved.blockers.includes('DISPLMNT_POINTER_REQUIRED:10:20'));

  target0 = fixture({ block: 'DISPLMNT', count: 1, sectionRows: [...displacementRows(), ...displacementRows()] });
  resolved = resolveFindReplaceScope(target0, { scope: 'BLOCK', block: 'DISPLACEMENT', from: 10, to: 20 });
  assert.ok(resolved.blockers.some((item) => item.startsWith('AUX_SECTION_CARDINALITY_MISMATCH:DISPLMNT:40:20:')));

  target0 = fixture({ block: 'DISPLMNT', selectedPointer: 1, otherPointer: 1, sectionRows: displacementRows() });
  resolved = resolveFindReplaceScope(target0, { scope: 'BLOCK', block: 'DISPLACEMENT', from: 10, to: 20 });
  assert.ok(resolved.blockers.includes('AUX_POINTER_SHARED:DISPLMNT:1:2'));
});

test('Node Name stays on the existing specialized fixed-field path', () => {
  const nodename = `  ${'FROM-10'.padEnd(26, ' ')}${'TO-20'.padEnd(25, ' ')}`;
  const target0 = fixture({ block: 'NODENAME', sectionRows: [nodename] });
  const resolved = resolveFindReplaceScope(target0, { scope: 'BLOCK', block: 'NODENAME', from: 10, to: 20 });
  assert.equal(resolved.status, 'PASS');
  assert.equal(resolved.authority, 'CII_V14_ELEMENT_NODENAME_POINTER_FIXED_FIELDS');
  assert.equal(resolved.spans.length, 2);
  assert.equal(resolved.evidence.pointer, 1);
});

test('FORCE/FORCMNT remains explicitly de-scoped', () => {
  const target0 = fixture({ block: 'FORCMNT', sectionRows: numericRows(20) });
  const resolved = resolveFindReplaceScope(target0, { scope: 'BLOCK', block: 'FORCE', from: 10, to: 20 });
  assert.equal(resolved.status, 'BLOCKED');
  assert.ok(resolved.blockers.includes('FORCMNT_BLOCK_AUTHORITY_NOT_QUALIFIED'));
});
