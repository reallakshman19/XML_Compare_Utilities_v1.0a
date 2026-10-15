import assert from 'node:assert/strict';
import { createCiiPhysicalFile } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { CII_WRITER_2_NODENAME_RELOCATION_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-nodename-relocation.js';
import { applyCiiWriter2NodeNameRelocation } from '../tabs/cii-workspace/cii-workspace-writer2-nodename-write.js';

const WIDTHS = [15, 13, 13, 13, 13, 13];
const POINTER_ROW = 13;
const POINTER_FIELD = 5;

function numericRow(values) {
  return WIDTHS.map((width, index) => String(values[index] ?? 0).padStart(width, ' ')).join('');
}
function nameRow(fromName = '', toName = '') {
  return `  ${String(fromName).padEnd(26, ' ')}${String(toName).padEnd(25, ' ')}`;
}
function elementBlock(from, to, pointer) {
  const rows = Array.from({ length: 15 }, () => numericRow([0, 0, 0, 0, 0, 0]));
  rows[0] = numericRow([from, to, 0, 0, 0, 100]);
  rows[13] = numericRow([0, 0, 0, 0, 0, pointer]);
  return rows;
}
function fieldStart(fieldIndex) {
  return WIDTHS.slice(0, fieldIndex).reduce((sum, width) => sum + width, 0);
}

const rows = [
  '#$ CONTROL',
  numericRow([1, 0, 0, 4, 0, 0]),
  numericRow([0, 0, 0, 0, 0, 0]),
  numericRow([0, 0, 0, 0, 0, 0]),
  numericRow([0, 0, 0, 0, 0, 0]),
  '#$ ELEMENTS',
  ...elementBlock(10, 20, 0),
  '#$ NODENAME',
  nameRow('A100', ''),
  nameRow('A200', ''),
  nameRow('A300', ''),
  nameRow('A400', ''),
  '#$ BEND',
  'UNCHANGED',
];
const bytes = new TextEncoder().encode(`${rows.join('\r\n')}\r\n`);
const physicalFile = createCiiPhysicalFile(bytes);
const elementsMarker = physicalFile.lines.findIndex((line) => /^#\$\s+ELEMENTS\s*$/.test(line.text));
assert(elementsMarker >= 0);
const pointerLine = physicalFile.lines[elementsMarker + 1 + POINTER_ROW];
const pointerStart = pointerLine.byteStart + fieldStart(POINTER_FIELD);
const pointerEnd = pointerStart + WIDTHS[POINTER_FIELD];
const rawPointer = physicalFile.originalByteString.slice(pointerStart, pointerEnd);
assert.equal(rawPointer.trim(), '0');

const targetDocument = Object.freeze({
  physicalFile,
  writer1CByteEligible: true,
  nodeNames: Object.freeze({}),
  nodeNameEvidence: Object.freeze({
    physicalCustody: Object.freeze({
      status: 'QUALIFIED',
      rowCount: 4,
      bySpan: Object.freeze({}),
      byElementIndex: Object.freeze({
        '0': Object.freeze({
          bindingAuthority: 'EXACT_PARSED_INDEX_AND_ENDPOINTS',
          parsedElementIndex: 0,
          blockIndex: 0,
          from: '10',
          to: '20',
          pointer: 0,
          pointerField: Object.freeze({
            qualified: true,
            width: 13,
            byteStart: pointerStart,
            byteEnd: pointerEnd,
            rawField: rawPointer,
          }),
        }),
      }),
    }),
  }),
});
const operation = Object.freeze({
  operationId: 'FOCUSED-NODENAME-CREATE-10',
  family: 'NODE_NAME',
  property: 'Node name / to-name',
  action: 'CREATE',
  status: 'PREVIEW_READY',
  scopeDecision: 'APPLY',
  policyAuthority: CII_WRITER_2_NODENAME_RELOCATION_POLICY,
  targetEvidence: Object.freeze({ identity: '10' }),
  before: '',
  proposed: 'BM-N10',
  matchAuthority: Object.freeze({ status: 'REVIEWED' }),
});
const transferPlan = Object.freeze({
  status: 'PREVIEW_READY',
  blockers: Object.freeze([]),
  operations: Object.freeze([operation]),
  transferScope: Object.freeze({ status: 'BOUND' }),
});

const result = applyCiiWriter2NodeNameRelocation({ targetDocument, transferPlan });
assert.equal(result.status, 'APPLIED');
assert.equal(result.relocationPlan.controlCountBefore, 4);
assert.equal(result.relocationPlan.controlCountAfter, 5);
assert.equal(result.relocationPlan.pointerChanges.length, 1);
assert.equal(result.relocationPlan.pointerChanges[0].oldPointer, 0);
assert.equal(result.relocationPlan.pointerChanges[0].newPointer, 5);

const pointerMutation = result.mutations.find((item) => item.kind === 'ELEMENT_NODENAME_POINTER');
assert(pointerMutation, 'ELEMENT NODENAME pointer mutation required');
assert.equal(pointerMutation.beforeField, rawPointer);
assert.equal(pointerMutation.afterField.length, 13);
assert.match(pointerMutation.afterField.trim(), /^[+-]?\d+$/);
assert.equal(pointerMutation.afterField.trim(), '5');

const controlMutation = result.mutations.find((item) => item.kind === 'CONTROL_NONAM');
assert(controlMutation, 'CONTROL.NONAM mutation required');
assert.equal(controlMutation.afterField.trim(), '5');

console.log('Writer2 NODENAME focused runtime writes pointer 0->5 as lexical I13: PASS');
