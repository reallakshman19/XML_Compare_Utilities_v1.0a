import assert from 'node:assert/strict';
import test from 'node:test';

import { CII_SIX_FIELD_WIDTHS } from '../parser/fixed-field.js';
import { V14_AUX_BLOCKS } from '../tabs/cii-workspace/cii-workspace-find-replace-v14-aux-authority.js';
import { resolveFindReplaceScope } from '../tabs/cii-workspace/cii-workspace-find-replace-scope-resolver.js';
import { validateFindReplacePreimage } from '../tabs/cii-workspace/cii-workspace-find-replace-validator.js';

function row(values) {
  return CII_SIX_FIELD_WIDTHS.map((width, index) => String(values[index] ?? 0).padStart(width, ' ')).join('');
}

function lengthText(value, width = 100) {
  const text = String(value);
  return `${' '.repeat(7)}${String(text.length).padStart(5, ' ')} ${text.padEnd(width, ' ')}`;
}

function pointerSet(block, pointer) {
  const values = Array(15).fill(0);
  if (block) values[V14_AUX_BLOCKS[block].pointerIndex] = pointer;
  return values;
}

function elementBlock(from, to, { marker = 777, block = null, pointer = 0, name = 'EL-A', line = 'LINE-A' } = {}) {
  const pointers = pointerSet(block, pointer);
  return [
    row([from, to, 100, 200, 300, 114.3]),
    row([6.02, 25, 3, marker, 0, 0]),
    ...Array.from({ length: 7 }, () => row([0, 0, 0, 0, 0, 0])),
    lengthText(name, 500),
    lengthText(line, 500),
    row([9, 1, 0, 0, 0, 0]),
    row(pointers.slice(0, 6)),
    row(pointers.slice(6, 12)),
    row(pointers.slice(12, 15)),
  ];
}

function controlRows(block, count, elementCount = 2) {
  const values = Array.from({ length: 4 }, () => Array(6).fill(0));
  values[0][0] = elementCount;
  if (block) {
    const spec = V14_AUX_BLOCKS[block];
    values[spec.controlRow][spec.controlField] = count;
  }
  return values.map(row);
}

function elementFixture(options = {}) {
  const lines = [
    '#$ ELEMENTS',
    ...elementBlock(10101, 20202, options),
    ...elementBlock(20202, 30303, { marker: options.marker ?? 777 }),
  ];
  return `${lines.join('\r\n')}\r\n`;
}

function auxFixture({ block, rows, selectedPointer = 1, otherPointer = 0, marker = 777 }) {
  const lines = [
    '#$ CONTROL',
    ...controlRows(block, 1),
    '#$ ELEMENTS',
    ...elementBlock(10101, 20202, { marker, block, pointer: selectedPointer }),
    ...elementBlock(20202, 30303, { marker, block, pointer: otherPointer }),
    `#$ ${V14_AUX_BLOCKS[block].section}`,
    ...rows,
  ];
  return `${lines.join('\r\n')}\r\n`;
}

function numericRows(count, marker = 333) {
  return Array.from({ length: count }, (_, index) => row([index === 0 ? marker : index + 1, 0, 0, 0, 0, 0]));
}

test('field-aware Element mutation protects FROM/TO and all IEL pointers', () => {
  const target0 = elementFixture({ block: 'BEND', pointer: 98765 });
  const resolved = resolveFindReplaceScope(target0, { scope: 'ELEMENT', from: 10101, to: 20202 }, { fieldAwareMutation: true });
  assert.equal(resolved.status, 'PASS');
  assert.equal(resolved.authority, 'CII_V14_ELEMENT_MUTABLE_FIELD_AUTHORITY');
  assert.equal(resolved.fieldAware, true);
  assert.ok(resolved.spans.every((span) => !['10101', '20202', '98765'].includes(span.semanticValue)));
  assert.deepEqual(resolved.evidence.protected, ['FROM', 'TO', 'IEL_POINTERS_1_15']);

  for (const [findText, replaceText] of [['10101', '40404'], ['98765', '87654']]) {
    const validation = validateFindReplacePreimage(target0, [{ scope: 'ELEMENT', from: 10101, to: 20202, findText, replaceText, status: 'APPROVED' }]);
    assert.equal(validation.status, 'FAIL');
    assert.ok(validation.blockers.some((item) => item.includes('NO_MATCHES_IN_SCOPE')));
  }
});

test('Element numeric and text payload fields create field-bound claims only', () => {
  const target0 = elementFixture({ marker: 777, name: 'PUMP-A', line: 'LINE-A' });
  let validation = validateFindReplacePreimage(target0, [{ scope: 'ELEMENT', from: 10101, to: 20202, findText: '777', replaceText: '888', expectedMatches: 1, status: 'APPROVED' }]);
  assert.equal(validation.status, 'PASS');
  assert.equal(validation.claims[0].fieldKind, 'NUMERIC');
  assert.equal(validation.claims[0].fieldIdentity, 'ELEMENT_R2_F4');

  validation = validateFindReplacePreimage(target0, [{ scope: 'ELEMENT', from: 10101, to: 20202, findText: 'PUMP-A', replaceText: 'PUMP-B', expectedMatches: 1, status: 'APPROVED' }]);
  assert.equal(validation.status, 'PASS');
  assert.equal(validation.claims[0].fieldKind, 'TEXT');
  assert.equal(validation.claims[0].fieldIdentity, 'ELEMENT_NAME');
});

test('numeric field replacement fails if the resulting fixed field is not numeric', () => {
  const target0 = elementFixture({ marker: 777 });
  const validation = validateFindReplacePreimage(target0, [{ scope: 'ELEMENT', from: 10101, to: 20202, findText: '777', replaceText: 'ABC', status: 'APPROVED' }]);
  assert.equal(validation.status, 'FAIL');
  assert.ok(validation.blockers.some((item) => item.includes('NUMERIC_FIELD_POSTIMAGE_INVALID:ELEMENT_R2_F4')));
});

test('generic BEND remains read-only for raw resolver calls but validator admits field-aware claims', () => {
  const target0 = auxFixture({ block: 'BEND', rows: numericRows(3, 333) });
  const raw = resolveFindReplaceScope(target0, { scope: 'BLOCK', block: 'BEND', from: 10101, to: 20202 });
  assert.equal(raw.status, 'BLOCKED');
  assert.ok(raw.blockers.includes('BLOCK_MUTATION_NOT_QUALIFIED:BEND'));

  const fieldAware = resolveFindReplaceScope(target0, { scope: 'BLOCK', block: 'BEND', from: 10101, to: 20202 }, { fieldAwareMutation: true });
  assert.equal(fieldAware.status, 'PASS');
  assert.equal(fieldAware.authority, 'CII_V14_AUX_RECORD_FIELD_AUTHORITY');
  assert.equal(fieldAware.fieldAware, true);

  const validation = validateFindReplacePreimage(target0, [{ scope: 'BLOCK', block: 'BEND', from: 10101, to: 20202, findText: '333', replaceText: '444', expectedMatches: 1, status: 'APPROVED' }]);
  assert.equal(validation.status, 'PASS');
  assert.equal(validation.claims.length, 1);
  assert.equal(validation.claims[0].block, 'BEND');
  assert.equal(validation.claims[0].fieldKind, 'NUMERIC');
});

test('generic auxiliary field authority retains U1 shared-pointer fail-closed ownership', () => {
  const target0 = auxFixture({ block: 'BEND', rows: numericRows(3, 333), otherPointer: 1 });
  const validation = validateFindReplacePreimage(target0, [{ scope: 'BLOCK', block: 'BEND', from: 10101, to: 20202, findText: '333', replaceText: '444', status: 'APPROVED' }]);
  assert.equal(validation.status, 'FAIL');
  assert.ok(validation.blockers.some((item) => item.includes('AUX_POINTER_SHARED:BEND:1:2')));
});

test('RESTRANT length-prefixed Tag text is mutable without exposing its length prefix', () => {
  const rows = [];
  for (let dof = 0; dof < 6; dof += 1) {
    rows.push(row([10101, 1, 1000, 0, 0, 0]), row([0, 0, 0, 0, 0, 0]), lengthText(`TAG-A${dof}`, 100), lengthText(`GUID-A${dof}`, 100));
  }
  const target0 = auxFixture({ block: 'RESTRANT', rows });
  const validation = validateFindReplacePreimage(target0, [{ scope: 'BLOCK', block: 'RESTRANT', from: 10101, to: 20202, findText: 'TAG-A0', replaceText: 'TAG-B0', expectedMatches: 1, status: 'APPROVED' }]);
  assert.equal(validation.status, 'PASS');
  assert.equal(validation.claims[0].fieldKind, 'TEXT');
  assert.equal(validation.claims[0].fieldIdentity, 'RESTRANT_R3_TEXT');
  assert.equal(validation.claims[0].before, 'TAG-A0');
});

test('FLANGES A40 class text and meaningful blank row are field-aware', () => {
  const rows = numericRows(12, 10);
  rows[4] = `  ${'CLASS150'.padEnd(40, ' ')}`;
  rows[5] = '';
  const target0 = auxFixture({ block: 'FLANGES', rows });
  const validation = validateFindReplacePreimage(target0, [{ scope: 'BLOCK', block: 'FLANGES', from: 10101, to: 20202, findText: 'CLASS150', replaceText: 'CLASS300', expectedMatches: 1, status: 'APPROVED' }]);
  assert.equal(validation.status, 'PASS');
  assert.equal(validation.claims[0].fieldKind, 'TEXT');
  assert.equal(validation.claims[0].fieldIdentity, 'FLANGES_R5_CLASS');
});


test('all numeric v14 auxiliary families produce field-aware validator claims', () => {
  const families = ['BEND', 'RIGID', 'EXPJT', 'UNIFORM', 'WIND', 'OFFSETS', 'ALLOWBLS', 'SIF&TEES', 'REDUCERS', 'EQUIPMNT'];
  for (const block of families) {
    const rows = numericRows(V14_AUX_BLOCKS[block].rowsPerRecord, 555);
    const target0 = auxFixture({ block, rows });
    const validation = validateFindReplacePreimage(target0, [{
      scope: 'BLOCK', block, from: 10101, to: 20202,
      findText: '555', replaceText: '666', expectedMatches: 1, status: 'APPROVED',
    }]);
    assert.equal(validation.status, 'PASS', `${block}: ${validation.blockers.join(',')}`);
    assert.equal(validation.claims.length, 1, block);
    assert.equal(validation.claims[0].fieldKind, 'NUMERIC', block);
  }
});

test('a literal that exists only across two numeric field boundaries cannot create a claim', () => {
  const target0 = elementFixture({ marker: 987654 });
  const resolved = resolveFindReplaceScope(target0, { scope: 'ELEMENT', from: 10101, to: 20202 }, { fieldAwareMutation: true });
  const left = resolved.spans.find((span) => span.fieldIdentity === 'ELEMENT_R2_F3');
  const right = resolved.spans.find((span) => span.fieldIdentity === 'ELEMENT_R2_F4');
  const cross = target0.slice(left.end - 2, right.start + 2);
  assert.ok(cross.length > 0);
  const validation = validateFindReplacePreimage(target0, [{
    scope: 'ELEMENT', from: 10101, to: 20202,
    findText: cross, replaceText: 'X'.repeat(cross.length), status: 'APPROVED',
  }]);
  assert.equal(validation.status, 'FAIL');
  assert.ok(validation.blockers.some((item) => item.includes('NO_MATCHES_IN_SCOPE')));
});

test('FORCE stays excluded from U2 and field-scoped mutation requires ASCII', () => {
  const force = auxFixture({ block: 'FORCMNT', rows: numericRows(20, 555) });
  let validation = validateFindReplacePreimage(force, [{ scope: 'BLOCK', block: 'FORCE', from: 10101, to: 20202, findText: '555', replaceText: '666', status: 'APPROVED' }]);
  assert.equal(validation.status, 'FAIL');
  assert.ok(validation.blockers.some((item) => item.includes('FORCMNT_BLOCK_AUTHORITY_NOT_QUALIFIED')));

  const element = elementFixture({ marker: 777 });
  validation = validateFindReplacePreimage(element, [{ scope: 'ELEMENT', from: 10101, to: 20202, findText: '777', replaceText: 'ééé', status: 'APPROVED' }]);
  assert.equal(validation.status, 'FAIL');
  assert.ok(validation.blockers.some((item) => item.includes('CII_FIELD_ASCII_TEXT_REQUIRED')));
});

test('canonical compact v14 rows are admitted while malformed near-widths fail closed', () => {
  const compactRow = (values, fieldCount) => CII_SIX_FIELD_WIDTHS.slice(0, fieldCount)
    .map((width, index) => String(values[index] ?? 0).padStart(width, ' ')).join('');

  let target0 = auxFixture({ block: 'RIGID', rows: [compactRow([555, 0], 2)] });
  let validation = validateFindReplacePreimage(target0, [{
    scope: 'BLOCK', block: 'RIGID', from: 10101, to: 20202,
    findText: '555', replaceText: '666', expectedMatches: 1, status: 'APPROVED',
  }]);
  assert.equal(validation.status, 'PASS');

  target0 = auxFixture({ block: 'RIGID', rows: [`${compactRow([555, 0], 2)} `] });
  validation = validateFindReplacePreimage(target0, [{
    scope: 'BLOCK', block: 'RIGID', from: 10101, to: 20202,
    findText: '555', replaceText: '666', status: 'APPROVED',
  }]);
  assert.equal(validation.status, 'FAIL');
  assert.ok(validation.blockers.some((item) => item.includes('AUX_FIELD_ROW_SCHEMA_UNRECOGNIZED:RIGID:0')));

  const elementLines = elementFixture({ marker: 777 }).split('\r\n');
  elementLines[1 + 8] = compactRow([0, 0, 0, 0, 0], 5);
  elementLines[1 + 11] = compactRow([9, 1], 2);
  elementLines[1 + 14] = compactRow([0, 0, 0], 3);
  let resolved = resolveFindReplaceScope(elementLines.join('\r\n'), {
    scope: 'ELEMENT', from: 10101, to: 20202,
  }, { fieldAwareMutation: true });
  assert.equal(resolved.status, 'PASS');

  elementLines[1 + 8] += ' ';
  resolved = resolveFindReplaceScope(elementLines.join('\r\n'), {
    scope: 'ELEMENT', from: 10101, to: 20202,
  }, { fieldAwareMutation: true });
  assert.equal(resolved.status, 'BLOCKED');
  assert.ok(resolved.blockers.includes('NUMERIC_FIELD_ROW_INVALID:ELEMENT_R9'));
});
