import assert from 'node:assert/strict';
import { assertCiiV14Writer2FixedFieldAuthority } from '../tabs/cii-workspace/cii-workspace-v14-writer2-fixed-field-authority.js';

function fixedRow(values) {
  return values.map((value, index) => String(value).padStart(index === 0 ? 15 : 13, ' ')).join('');
}
function doc(sections) {
  const lines = [];
  for (const [name, rows] of sections) lines.push(`#$ ${name}`, ...rows);
  return new TextEncoder().encode(`${lines.join('\r\n')}\r\n`);
}
function elementRows() {
  return Array.from({ length: 15 }, (_, row) => fixedRow([100 + row, 0, 0, 0, 0, 0]));
}

// All six V11 Writer2-owned count/pointer coordinates are admitted.
{
  const controlBefore = [
    fixedRow([1, 2, 3, 4, 5, 6]),
    fixedRow([1, 2, 3, 4, 5, 6]),
    fixedRow([1, 2, 3, 4, 5, 6]),
    fixedRow([1, 2, 3, 4, 5, 6]),
  ];
  const controlAfter = [...controlBefore];
  controlAfter[0] = fixedRow([1, 2, 3, 5, 5, 6]);
  controlAfter[1] = fixedRow([1, 2, 3, 3, 5, 6]);
  controlAfter[2] = fixedRow([1, 2, 3, 4, 4, 6]);
  const elementsBefore = elementRows();
  const elementsAfter = [...elementsBefore];
  elementsAfter[12] = fixedRow([112, 0, 0, 3, 0, 0]);
  elementsAfter[13] = fixedRow([113, 0, 0, 0, 4, 5]);
  const nodenameBefore = Array.from({ length: 4 }, (_, index) => `N-${index}`);
  const nodenameAfter = Array.from({ length: 5 }, (_, index) => `N-${index}`);
  const restraintBefore = Array.from({ length: 4 * 24 }, (_, index) => `R-${index}`);
  const restraintAfter = restraintBefore.slice(0, 3 * 24);
  const sifBefore = Array.from({ length: 5 * 14 }, (_, index) => `S-${index}`);
  const sifAfter = sifBefore.slice(0, 4 * 14);
  const result = assertCiiV14Writer2FixedFieldAuthority(
    doc([['CONTROL', controlBefore], ['ELEMENTS', elementsBefore], ['NODENAME', nodenameBefore], ['RESTRANT', restraintBefore], ['SIF&TEES', sifBefore]]),
    doc([['CONTROL', controlAfter], ['ELEMENTS', elementsAfter], ['NODENAME', nodenameAfter], ['RESTRANT', restraintAfter], ['SIF&TEES', sifAfter]]),
  );
  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.claims.map((claim) => claim.fieldIdentity), [
    'CONTROL_NODENAME_NONAM_COUNT',
    'CONTROL_RESTRAINT_BLOCK_COUNT',
    'CONTROL_SIF_TEE_BLOCK_COUNT',
    'ELEMENT_RESTRAINT_POINTER',
    'ELEMENT_SIF_TEE_POINTER',
    'ELEMENT_NODENAME_POINTER',
  ]);
}

// A whole-row replacement cannot bypass field authority merely because baseline
// and source happened to be byte-identical.
{
  const before = [fixedRow([1, 2, 3, 4, 5, 6])];
  const after = [fixedRow([9, 2, 3, 4, 5, 6])];
  assert.throws(
    () => assertCiiV14Writer2FixedFieldAuthority(doc([['CONTROL', before]]), doc([['CONTROL', after]])),
    /CII_V14_WRITER2_FIXED_FIELD_NOT_AUTHORIZED:CONTROL:0:0/,
  );
}

// Wrong CONTROL fields/rows are not Writer2 count authority.
{
  const before = [fixedRow([1, 2, 3, 4, 5, 6]), fixedRow([1, 2, 3, 4, 5, 6]), fixedRow([1, 2, 3, 4, 5, 6]), fixedRow([1, 2, 3, 4, 5, 6])];
  const wrongField = [...before];
  wrongField[0] = fixedRow([1, 2, 9, 4, 5, 6]);
  assert.throws(
    () => assertCiiV14Writer2FixedFieldAuthority(doc([['CONTROL', before]]), doc([['CONTROL', wrongField]])),
    /CII_V14_WRITER2_FIXED_FIELD_NOT_AUTHORIZED:CONTROL:0:2/,
  );
  const wrongRow = [...before];
  wrongRow[3] = fixedRow([1, 2, 3, 9, 5, 6]);
  assert.throws(
    () => assertCiiV14Writer2FixedFieldAuthority(doc([['CONTROL', before]]), doc([['CONTROL', wrongRow]])),
    /CII_V14_WRITER2_FIXED_FIELD_NOT_AUTHORIZED:CONTROL:3:3/,
  );
}

// Wrong ELEMENT fields are not pointer authority.
{
  const before = elementRows();
  for (const [row, field] of [[12, 4], [13, 3], [0, 0]]) {
    const after = [...before];
    const values = [100 + row, 0, 0, 0, 0, 0];
    values[field] = 7;
    after[row] = fixedRow(values);
    assert.throws(
      () => assertCiiV14Writer2FixedFieldAuthority(doc([['ELEMENTS', before]]), doc([['ELEMENTS', after]])),
      new RegExp(`CII_V14_WRITER2_FIXED_FIELD_NOT_AUTHORIZED:ELEMENTS:${row}:${field}`),
    );
  }
}

// Count/pointer values must remain non-negative integers.
{
  const before = [fixedRow([1, 2, 3, 4, 5, 6])];
  const fractional = [fixedRow([1, 2, 3, 4.5, 5, 6])];
  assert.throws(
    () => assertCiiV14Writer2FixedFieldAuthority(doc([['CONTROL', before]]), doc([['CONTROL', fractional]])),
    /CII_V14_WRITER2_FIXED_FIELD_INTEGER_REQUIRED:CONTROL_NODENAME_NONAM_COUNT/,
  );
}

// ELEMENTS physical layout is fixed at 15 rows per element.
{
  const before = elementRows().slice(0, 14);
  const after = [...before];
  after[12] = fixedRow([112, 0, 0, 7, 0, 0]);
  assert.throws(
    () => assertCiiV14Writer2FixedFieldAuthority(doc([['ELEMENTS', before]]), doc([['ELEMENTS', after]])),
    /CII_V14_WRITER2_FIELD_AUTHORITY_ELEMENT_BLOCK_ALIGNMENT:14/,
  );
}

// Writer2 cardinality deltas must be coupled to the matching CONTROL count and
// at least one same-family ELEMENT pointer change. Qualified V11 Writer2 cannot
// change NODENAME/SIF/RESTRAINT physical cardinality without an owned pointer.
{
  const control = [
    fixedRow([1, 2, 3, 1, 5, 6]),
    fixedRow([1, 2, 3, 1, 5, 6]),
    fixedRow([1, 2, 3, 4, 1, 6]),
    fixedRow([1, 2, 3, 4, 5, 6]),
  ];
  const elements = elementRows();
  const nodenameBefore = ['A'];
  const restraintBefore = Array.from({ length: 24 }, (_, index) => `R-${index}`);
  const sifBefore = Array.from({ length: 14 }, (_, index) => `S-${index}`);

  const nodenameAfter = ['A', 'B'];
  assert.throws(
    () => assertCiiV14Writer2FixedFieldAuthority(
      doc([['CONTROL', control], ['ELEMENTS', elements], ['NODENAME', nodenameBefore], ['RESTRANT', restraintBefore], ['SIF&TEES', sifBefore]]),
      doc([['CONTROL', control], ['ELEMENTS', elements], ['NODENAME', nodenameAfter], ['RESTRANT', restraintBefore], ['SIF&TEES', sifBefore]]),
    ),
    /CII_V14_WRITER2_CONTROL_COUNT_CLAIM_REQUIRED:NODENAME:0/,
  );

  const countOnly = [...control];
  countOnly[0] = fixedRow([1, 2, 3, 2, 5, 6]);
  assert.throws(
    () => assertCiiV14Writer2FixedFieldAuthority(
      doc([['CONTROL', control], ['ELEMENTS', elements], ['NODENAME', nodenameBefore], ['RESTRANT', restraintBefore], ['SIF&TEES', sifBefore]]),
      doc([['CONTROL', countOnly], ['ELEMENTS', elements], ['NODENAME', nodenameBefore], ['RESTRANT', restraintBefore], ['SIF&TEES', sifBefore]]),
    ),
    /CII_V14_WRITER2_CONTROL_COUNT_CHANGED_WITHOUT_CARDINALITY:NODENAME/,
  );

  const matching = [...control];
  matching[0] = fixedRow([1, 2, 3, 2, 5, 6]);
  assert.throws(
    () => assertCiiV14Writer2FixedFieldAuthority(
      doc([['CONTROL', control], ['ELEMENTS', elements], ['NODENAME', nodenameBefore], ['RESTRANT', restraintBefore], ['SIF&TEES', sifBefore]]),
      doc([['CONTROL', matching], ['ELEMENTS', elements], ['NODENAME', nodenameAfter], ['RESTRANT', restraintBefore], ['SIF&TEES', sifBefore]]),
    ),
    /CII_V14_WRITER2_POINTER_CLAIM_REQUIRED:NODENAME:0/,
  );

  const matchingElements = [...elements];
  matchingElements[13] = fixedRow([113, 0, 0, 0, 0, 2]);
  const result = assertCiiV14Writer2FixedFieldAuthority(
    doc([['CONTROL', control], ['ELEMENTS', elements], ['NODENAME', nodenameBefore], ['RESTRANT', restraintBefore], ['SIF&TEES', sifBefore]]),
    doc([['CONTROL', matching], ['ELEMENTS', matchingElements], ['NODENAME', nodenameAfter], ['RESTRANT', restraintBefore], ['SIF&TEES', sifBefore]]),
  );
  assert.equal(result.claims.find((claim) => claim.fieldIdentity === 'CONTROL_NODENAME_NONAM_COUNT')?.after, 2);
  assert.equal(result.claims.find((claim) => claim.fieldIdentity === 'ELEMENT_NODENAME_POINTER')?.after, 2);
}

// SIF and RESTRAINT Writer2 bridge authority is DELETE/compaction only; cardinality
// growth remains blocked by the V11 CREATE authority boundary. Changed pointers
// must also remain in range for the physical postimage block count.
{
  const controlBefore = [
    fixedRow([1, 2, 3, 0, 5, 6]),
    fixedRow([1, 2, 3, 1, 5, 6]),
    fixedRow([1, 2, 3, 4, 1, 6]),
    fixedRow([1, 2, 3, 4, 5, 6]),
  ];
  const controlAfter = [...controlBefore];
  controlAfter[1] = fixedRow([1, 2, 3, 2, 5, 6]);
  const elements = elementRows();
  const restraint1 = Array.from({ length: 24 }, (_, index) => `R1-${index}`);
  const restraint2 = Array.from({ length: 24 }, (_, index) => `R2-${index}`);
  assert.throws(
    () => assertCiiV14Writer2FixedFieldAuthority(
      doc([['CONTROL', controlBefore], ['ELEMENTS', elements], ['RESTRANT', restraint1]]),
      doc([['CONTROL', controlAfter], ['ELEMENTS', elements], ['RESTRANT', [...restraint1, ...restraint2]]]),
    ),
    /CII_V14_WRITER2_CARDINALITY_INCREASE_NOT_AUTHORIZED:RESTRANT:1:2/,
  );

  const pointerControlBefore = [...controlBefore];
  pointerControlBefore[1] = fixedRow([1, 2, 3, 2, 5, 6]);
  const pointerControlAfter = [...controlBefore];
  pointerControlAfter[1] = fixedRow([1, 2, 3, 1, 5, 6]);
  const pointerElementsBefore = elementRows();
  pointerElementsBefore[12] = fixedRow([112, 0, 0, 2, 0, 0]);
  const pointerElementsAfter = [...pointerElementsBefore];
  pointerElementsAfter[12] = fixedRow([112, 0, 0, 3, 0, 0]);
  assert.throws(
    () => assertCiiV14Writer2FixedFieldAuthority(
      doc([['CONTROL', pointerControlBefore], ['ELEMENTS', pointerElementsBefore], ['RESTRANT', [...restraint1, ...restraint2]]]),
      doc([['CONTROL', pointerControlAfter], ['ELEMENTS', pointerElementsAfter], ['RESTRANT', restraint1]]),
    ),
    /CII_V14_WRITER2_POINTER_OUT_OF_RANGE:RESTRANT:12:2:2:3:1/,
  );
}

console.log('CII Workspace V14 Writer2 fixed-field authority: PASS');
