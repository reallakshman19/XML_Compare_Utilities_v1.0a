import assert from 'node:assert/strict';
import { createCiiPhysicalFile } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { buildCiiWriter2RestraintPointerCustody } from '../tabs/cii-workspace/cii-workspace-writer2-restraint-delete-custody.js';

const WIDTHS = [15, 13, 13, 13, 13, 13];

function row(values) {
  return values.map((value, index) => String(value ?? 0).padStart(WIDTHS[index], ' ')).join('');
}

function fixture(pointerToken) {
  const rows = Array.from({ length: 15 }, () => row([0, 0, 0, 0, 0, 0]));
  rows[0] = row([10, 20, 0, 0, 0, 0]);
  rows[12] = row([0, 0, 0, pointerToken, 0, 0]);
  return new TextEncoder().encode(['#$ ELEMENTS', ...rows, '#$ RESTRANT', row([0, 0, 0, 0, 0, 0])].join('\r\n') + '\r\n');
}

function document(pointerToken) {
  const physicalFile = createCiiPhysicalFile(fixture(pointerToken));
  return Object.freeze({
    physicalFile,
    parsed: Object.freeze({ elements: Object.freeze([Object.freeze({ index: 0, from: 10, to: 20 })]) }),
    auxiliaryEvidence: Object.freeze({
      elements: Object.freeze({
        0: Object.freeze({
          parsedElementIndex: 0,
          from: '10',
          to: '20',
          pointers: Object.freeze({ restraint: 1 }),
        }),
      }),
    }),
  });
}

{
  const custody = buildCiiWriter2RestraintPointerCustody(document('1'));
  assert.equal(custody.status, 'QUALIFIED', custody.blockers.join('|'));
  assert.equal(custody.byParsedElementIndex['0'].pointer, 1);
  assert.equal(custody.byParsedElementIndex['0'].pointerField.rawField.trim(), '1');
}

for (const token of ['1.000000', '1.000000E+00', '1.000000D+00']) {
  const custody = buildCiiWriter2RestraintPointerCustody(document(token));
  assert.equal(
    custody.status,
    'BLOCKED',
    `Writer2 RESTRAINT pointer custody must reject non-lexical-I13 token ${token}`,
  );
  assert.match(
    custody.blockers.join('|'),
    /WRITER_2_RESTRAINT_EXACT_POINTER_FIELD_REQUIRED:0/,
    `non-I13 token ${token} must fail exact pointer-field custody`,
  );
}

console.log('CII Writer2 RESTRAINT pointer lexical-I13 custody falsifier passed.');
