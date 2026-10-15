import assert from 'assert';
import { applyCiiTargetWriter1A, ciiWriter1AReadiness, formatCiiWriterSig6 } from '../tabs/cii-workspace/cii-workspace-target-writer.js';

const widths = [15, 13, 13, 13, 13, 13];
function row(values) {
  return values.map((value, index) => String(value).padStart(widths[index], ' ')).join('');
}
function six(...values) { return row([...values, 0, 0, 0, 0, 0, 0].slice(0, 6)); }

const elementRows = Array.from({ length: 15 }, () => six(0, 0, 0, 0, 0, 0));
elementRows[0] = row(['10.00000', '20.00000', '100.000', '0.000000', '0.000000', '114.30000']);
elementRows[1] = row(['4.50000', '10.0000', '1.00000', '300.000', '350.000', '0.000000']);
elementRows[3] = row(['20.0000', '0.000000', '0.000000', '0.000000', '0.000000', '0.000000']);
const targetText = [
  '#$ VERSION',
  '5.00000 11.0000 1256',
  '#$ ELEMENTS',
  ...elementRows,
  '#$ RIGID',
  row(['111.200', '0.000000', '0.000000', '0.000000', '0.000000', '0.000000']),
  '#$ UNITS',
  'metric',
  '',
].join('\r\n');

const elementRow = {
  correspondenceId: 'element:10-20', kind: 'ELEMENT', sourceElementId: 'S1', targetElementIds: ['T1'], status: 'HIGH',
};
const componentRow = {
  correspondenceId: 'component:10-20-rigid', kind: 'COMPONENT', componentKind: 'RIGID',
  sourceElementId: 'S1', targetElementIds: ['T1'], status: 'HIGH',
};
const correspondence = { nodeRows: [], elementRows: [elementRow], componentRows: [componentRow] };
const targetGraph = {
  edges: [{
    elementId: 'T1', parsedElementIndex: 0, from: '10', to: '20',
    rigidEvidence: { pointer: 1, weight: 111.2 },
  }],
};
function op(id, rowId, family, property, before, proposed) {
  return {
    operationId: id, family, property, action: 'COPY', status: 'PREVIEW_READY', before, proposed,
    matchAuthority: { correspondenceId: rowId, status: 'REVIEWED' },
  };
}
const transferPlan = {
  schema: 'CIIWorkspaceTransferPlan.v1', status: 'PREVIEW_READY', blockers: [],
  operations: [
    op('wt', elementRow.correspondenceId, 'WALL', 'Wall thickness', 4.5, 3.9),
    op('t1', elementRow.correspondenceId, 'PROCESS', 'T1', 300, 325),
    op('t2', elementRow.correspondenceId, 'PROCESS', 'T2', 350, 375),
    op('p1', elementRow.correspondenceId, 'PROCESS', 'P1', 20, 15),
    op('rigid', componentRow.correspondenceId, 'WEIGHT_RIGID', 'Rigid weight', 111.2, 125.5),
    { operationId: 'od-keep', family: 'PIPE_SIZE', property: 'OD', action: 'KEEP', status: 'PROTECTED', before: 114.3, proposed: 114.3, matchAuthority: { correspondenceId: elementRow.correspondenceId, status: 'REVIEWED' } },
  ],
};

const readiness = ciiWriter1AReadiness(transferPlan);
assert.strictEqual(readiness.status, 'READY');
assert.strictEqual(readiness.mutationCount, 5);

const result = applyCiiTargetWriter1A({ targetText, targetGraph, correspondence, transferPlan });
assert.strictEqual(result.status, 'APPLIED');
assert.strictEqual(result.mutationCount, 5);
assert.strictEqual(result.text.length, targetText.length, 'Writer 1A must preserve exact file length');
assert.strictEqual(result.negativeAssurance.sectionCardinalityChanged, false);
assert.strictEqual(result.negativeAssurance.pointerOwnershipChanged, false);
assert(result.text.includes('       3.90000'));
assert(result.text.includes('      325.000'));
assert(result.text.includes('      375.000'));
assert(result.text.includes('        15.0000'));
assert(result.text.includes('       125.500'));
const beforeHeader = targetText.split(/\r\n/)[3];
const afterHeader = result.text.split(/\r\n/)[3];
assert.strictEqual(afterHeader, beforeHeader, 'FROM/TO/DX/DY/DZ/OD header row must remain byte-identical');

const unsupported = {
  ...transferPlan,
  operations: [
    ...transferPlan.operations,
    op('sif', elementRow.correspondenceId, 'SIF_TEE', 'SIF/Tee raw code (field 2)', 5, 3),
  ],
};
assert.strictEqual(ciiWriter1AReadiness(unsupported).status, 'BLOCKED');
assert.throws(
  () => applyCiiTargetWriter1A({ targetText, targetGraph, correspondence, transferPlan: unsupported }),
  /WRITER_1A_UNSUPPORTED_OPERATION:SIF_TEE/,
);

const staleBefore = {
  ...transferPlan,
  operations: transferPlan.operations.map((item) => item.operationId === 'wt' ? { ...item, before: 99 } : item),
};
assert.throws(
  () => applyCiiTargetWriter1A({ targetText, targetGraph, correspondence, transferPlan: staleBefore }),
  /CII_WRITER_TARGET_VALUE_MISMATCH/,
);

assert.strictEqual(formatCiiWriterSig6(0), '0.000000');
assert.strictEqual(formatCiiWriterSig6(0.0039), '0.003900');
assert.strictEqual(formatCiiWriterSig6(3.9), '3.90000');
assert.strictEqual(formatCiiWriterSig6(300), '300.000');
assert.strictEqual(formatCiiWriterSig6(210164), '210164.0');
assert.strictEqual(formatCiiWriterSig6(1e-7), '1.000000E-07');

console.log('CII Writer 1A fixed-field mutation checks passed.');
