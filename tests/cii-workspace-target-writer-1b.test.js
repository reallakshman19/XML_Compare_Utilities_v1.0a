import assert from 'assert';
import { CII_SIX_FIELD_WIDTHS, decodeFixedFields, parseFortranNumber } from '../parser/fixed-field.js';
import { formatCiiWriterSig6 } from '../tabs/cii-workspace/cii-workspace-target-writer.js';
import { applyCiiTargetWriter1B, ciiWriter1BReadiness } from '../tabs/cii-workspace/cii-workspace-target-writer-1b.js';

function row(values) {
  return values.map((value, index) => formatCiiWriterSig6(value).padStart(CII_SIX_FIELD_WIDTHS[index], ' ')).join('');
}
function field(text, rowIndex, fieldIndex) {
  const rows = text.split(/\r?\n/); const marker = rows.indexOf('#$ ELEMENTS');
  return parseFortranNumber(decodeFixedFields(rows[marker + 1 + rowIndex], CII_SIX_FIELD_WIDTHS)[fieldIndex]);
}
function operation(id, family, property, before, proposed) {
  return Object.freeze({ operationId: id, family, property, action: 'COPY', status: 'PREVIEW_READY', before, proposed,
    matchAuthority: Object.freeze({ correspondenceId: 'c1', status: 'REVIEWED' }) });
}

const block = [
  row([10, 20, 100, 0, 0, 114.3]),
  row([6.02, 25, 3, 100, 110, 120]),
  row([130, 140, 150, 160, 170, 180]),
  row([10, 20, 30, 40, 50, 60]),
  row([70, 80, 90, 0, 0, 0]),
  row([0.001, 0.002, 0, 0, 0, 5]),
  ...Array.from({ length: 9 }, () => row([0, 0, 0, 0, 0, 0])),
];
const targetText = ['#$ ELEMENTS', ...block, '#$ RIGID', '#$ RESTRANT', '#$ END', ''].join('\n');
const targetGraph = Object.freeze({ edges: Object.freeze([Object.freeze({
  elementId: 'E1:10->20', parsedElementIndex: 0, from: '10', to: '20',
})]) });
const correspondence = Object.freeze({ elementRows: Object.freeze([Object.freeze({
  correspondenceId: 'c1', targetElementIds: Object.freeze(['E1:10->20']),
})]), nodeRows: Object.freeze([]), componentRows: Object.freeze([]) });
const transferPlan = Object.freeze({ status: 'PREVIEW_READY', blockers: Object.freeze([]), operations: Object.freeze([
  operation('od', 'PIPE_SIZE', 'OD', 114.3, 168.3),
  operation('t9', 'PROCESS', 'T9', 180, 245),
  operation('p8', 'PROCESS', 'P8', 80, 123),
  operation('fluid', 'PROCESS', 'Fluid density', 0.002, 0.0045),
  operation('hydro', 'PROCESS', 'Hydro pressure', 5, 8.5),
]) });

const readiness = ciiWriter1BReadiness(transferPlan);
assert.strictEqual(readiness.ready, true, readiness.blockers.join(', '));
const applied = applyCiiTargetWriter1B({ targetText, targetGraph, correspondence, transferPlan });
assert.strictEqual(applied.status, 'APPLIED');
assert.strictEqual(applied.mutationCount, 5);
assert.strictEqual(applied.text.length, targetText.length, 'Writer 1B must preserve physical text length');
assert.strictEqual(field(applied.text, 0, 5), 168.3, 'OD fixed field must change only at ELEMENT header field 6');
assert.strictEqual(field(applied.text, 2, 5), 245, 'T9 must map to row 3 field 6');
assert.strictEqual(field(applied.text, 4, 1), 123, 'P8 must map to row 5 field 2');
assert.strictEqual(field(applied.text, 5, 1), 0.0045, 'fluid density must map to row 6 field 2');
assert.strictEqual(field(applied.text, 5, 5), 8.5, 'hydro pressure must map to row 6 field 6');
assert.strictEqual(field(applied.text, 0, 0), 10);
assert.strictEqual(field(applied.text, 0, 1), 20);
assert.strictEqual(field(applied.text, 0, 2), 100);

const unapproved = Object.freeze({ ...transferPlan, operations: Object.freeze([Object.freeze({ ...transferPlan.operations[0], matchAuthority: Object.freeze({ correspondenceId: 'c1', status: 'PENDING' }) })]) });
assert.strictEqual(ciiWriter1BReadiness(unapproved).ready, false, 'unapproved Writer 1B mutation must fail closed');

console.log('CII Writer 1B extended ELEMENT fixed-field checks passed.');
