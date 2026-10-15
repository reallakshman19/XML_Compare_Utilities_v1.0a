import assert from 'node:assert/strict';
import {
  assertCiiV14Writer2FixedFieldAuthority,
  _test,
} from '../tabs/cii-workspace/cii-workspace-v14-writer2-fixed-field-authority.js';

function fixedRow(values) {
  return values.map((value, index) => String(value).padStart(index === 0 ? 15 : 13, ' ')).join('');
}

function doc(sections) {
  const lines = [];
  for (const [name, rows] of sections) lines.push(`#$ ${name}`, ...rows);
  return new TextEncoder().encode(`${lines.join('\r\n')}\r\n`);
}

function elementRows(pointerValue) {
  const rows = Array.from({ length: 15 }, (_, row) => fixedRow([100 + row, 0, 0, 0, 0, 0]));
  rows[13] = fixedRow([113, 0, 0, 0, 0, pointerValue]);
  return rows;
}

// CAESAR fixed-FORTRAN I13 is a lexical contract. Numerically integral REAL
// tokens are not valid count/pointer syntax merely because Number() can parse them.
assert.equal(_test.integerValue('3'), 3);
assert.equal(_test.integerValue('+3'), 3);
assert.equal(_test.integerValue('0003'), 3);
assert.equal(_test.integerValue('  -3  '), -3);
assert.equal(_test.integerValue('3.000000'), null);
assert.equal(_test.integerValue('3.000000E+00'), null);
assert.equal(_test.integerValue('3.000000D+00'), null);
assert.equal(_test.integerValue('3.5'), null);

const nodenameBefore = ['N-1'];
const nodenameAfter = ['N-1', 'N-2'];

// CONTROL row 1 / field 4 (NONAM) must remain lexical I13. This transaction is
// otherwise cardinality-consistent, so a permissive numeric-integrality parser
// would incorrectly admit it.
{
  const controlBefore = [fixedRow([1, 2, 3, 1, 5, 6])];
  const controlAfter = [fixedRow([1, 2, 3, '2.000000', 5, 6])];
  assert.throws(
    () => assertCiiV14Writer2FixedFieldAuthority(
      doc([['CONTROL', controlBefore], ['ELEMENTS', elementRows(1)], ['NODENAME', nodenameBefore]]),
      doc([['CONTROL', controlAfter], ['ELEMENTS', elementRows(2)], ['NODENAME', nodenameAfter]]),
    ),
    /CII_V14_WRITER2_FIXED_FIELD_INTEGER_REQUIRED:CONTROL_NODENAME_NONAM_COUNT:0:3/,
  );
}

// ELEMENT row 14 / field 6 (NODENAME pointer) is also I13. Scientific REAL
// notation must not pass even when its numerical value is exactly integral.
{
  const controlBefore = [fixedRow([1, 2, 3, 1, 5, 6])];
  const controlAfter = [fixedRow([1, 2, 3, 2, 5, 6])];
  assert.throws(
    () => assertCiiV14Writer2FixedFieldAuthority(
      doc([['CONTROL', controlBefore], ['ELEMENTS', elementRows(1)], ['NODENAME', nodenameBefore]]),
      doc([['CONTROL', controlAfter], ['ELEMENTS', elementRows('2.000000E+00')], ['NODENAME', nodenameAfter]]),
    ),
    /CII_V14_WRITER2_FIXED_FIELD_INTEGER_REQUIRED:ELEMENT_NODENAME_POINTER:13:5/,
  );
}

console.log('CII Workspace V14 Writer2 lexical I13 fixed-field authority: PASS');
