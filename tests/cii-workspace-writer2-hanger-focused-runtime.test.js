import assert from 'node:assert/strict';
import { createCiiPhysicalFile, ciiPhysicalSectionRows } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { buildCiiHangerEvidence, CII_HANGER_LAYOUTS } from '../tabs/cii-workspace/cii-workspace-hanger.js';
import { applyCiiWriter2HangerDeletePlanContract } from '../tabs/cii-workspace/cii-workspace-writer2-hanger-delete.js';
import { applyCiiWriter2HangerDeleteAll } from '../tabs/cii-workspace/cii-workspace-writer2-hanger-delete-all-write.js';

const WIDTHS = [15, 13, 13, 13, 13, 13];
function numericRow(values) {
  return values.map((value, index) => String(value ?? '').padStart(WIDTHS[index] || 13, ' ')).join('');
}
function packedIntegerRow(values) {
  return `  ${values.map((value) => String(value).padStart(13, ' ')).join('')}`;
}
function stringCard(value) {
  const text = String(value ?? '');
  return `${' '.repeat(7)}${String(text.length).padStart(5, ' ')} ${text}`;
}

const node = 20;
const control = [
  numericRow([1, 0, 1, 0, 0, 0]),
  numericRow([0, 0, 0, 0, 0, 0]),
  numericRow([0, 0, 0, 0, 0, 0]),
  numericRow([0]),
];
const rrmat = numericRow([106]);
const defaults = [numericRow([1, 25, 0, 9999, 1, 1]), packedIntegerRow([1, 0, 1, 1, 1])];
const ihgrNode = packedIntegerRow([node]);
const tail = [
  numericRow([100, 25, 0, 0, 0, 0]),
  numericRow([0, 9999, 0, 0, 0]),
  stringCard(`H${node}`),
  stringCard(''),
];
const ihgrfree = packedIntegerRow([node, 0, 1, 0]);
const packed = [packedIntegerRow([10]), packedIntegerRow([20]), packedIntegerRow([30]), packedIntegerRow([40])];
const execution = [
  numericRow([0, 0, 0, 2, 0, 1]),
  numericRow([0, 0, 21, 21, 0, 0]),
  numericRow([0, 0, 0, 0, 0, 3]),
  numericRow([3]),
];
const body = [
  '#$ CONTROL', ...control,
  '#$ MISCEL_1', rrmat, ...defaults, ihgrNode, ...tail, ihgrfree, ...packed, ...execution,
  '#$ UNITS', 'UNITS-CUSTODY',
].join('\r\n') + '\r\n';

const physicalFile = createCiiPhysicalFile(new TextEncoder().encode(body));
const parsed = Object.freeze({
  elements: Object.freeze([Object.freeze({ index: 0, from: 10, to: 20 })]),
  nodes: Object.freeze({ '10': Object.freeze({}), '20': Object.freeze({}) }),
});
const hangerEvidence = buildCiiHangerEvidence(physicalFile.text, parsed);
assert.equal(hangerEvidence.status, 'QUALIFIED');
assert.equal(hangerEvidence.layout, CII_HANGER_LAYOUTS.SYNCHRONIZER);
assert.equal(hangerEvidence.count, 1);
assert.deepEqual(hangerEvidence.nodes, ['20']);
assert.equal(ciiPhysicalSectionRows(physicalFile, 'MISCEL_1').length, 17);

const targetDocument = Object.freeze({ physicalFile, writer1CByteEligible: true, hangerEvidence, parsed });
const operation = Object.freeze({
  operationId: 'FOCUSED-HANGER-DELETE-20',
  family: 'HANGER',
  property: 'Hanger presence',
  action: 'DELETE',
  status: 'PREVIEW_READY',
  blockers: Object.freeze([]),
  evidenceAuthority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE',
  sourceEvidence: Object.freeze({ identity: 'SRC-20', value: false, authority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE' }),
  targetEvidence: Object.freeze({ identity: '20', value: true }),
  before: true,
  proposed: false,
  matchAuthority: Object.freeze({ status: 'REVIEWED' }),
});
const rawPlan = Object.freeze({
  status: 'BLOCKED',
  blockers: Object.freeze(['NO_TRANSFERABLE_PREVIEW_OPERATIONS']),
  operations: Object.freeze([operation]),
  policy: Object.freeze({ hangerMutation: 'BLOCKED' }),
});
const contracted = applyCiiWriter2HangerDeletePlanContract(rawPlan);
assert.equal(contracted.status, 'PREVIEW_READY');
const transferPlan = Object.freeze({
  ...contracted,
  status: 'PREVIEW_READY',
  blockers: Object.freeze([]),
  operations: Object.freeze(contracted.operations.map((item) => Object.freeze({ ...item, scopeDecision: 'APPLY' }))),
  transferScope: Object.freeze({ status: 'BOUND' }),
});

const result = applyCiiWriter2HangerDeleteAll({ targetDocument, transferPlan });
assert.equal(result.status, 'APPLIED');
assert.equal(result.family, 'HANGER_DELETE_ALL');
assert.equal(result.hangerCountBefore, 1);
assert.equal(result.hangerCountAfter, 0);
assert.deepEqual(result.mutations.map((item) => item.kind), ['CONTROL_HANGER_COUNT', 'MISCEL_1_HANGER_DELETE_ALL_PAYLOAD']);
assert.equal(result.mutations[0].afterField.trim(), '0');

const afterPhysical = createCiiPhysicalFile(result.bytes);
assert.equal(ciiPhysicalSectionRows(afterPhysical, 'MISCEL_1').length, 5);
const afterEvidence = buildCiiHangerEvidence(afterPhysical.text, parsed);
assert.equal(afterEvidence.status, 'QUALIFIED');
assert.equal(afterEvidence.count, 0);
assert.equal(afterEvidence.layout, CII_HANGER_LAYOUTS.NONE);
assert.deepEqual(afterEvidence.nodes, []);
const afterRows = ciiPhysicalSectionRows(afterPhysical, 'MISCEL_1').map((row) => row.text);
assert.deepEqual(afterRows, [rrmat, ...execution]);

console.log('Writer2 HANGER focused runtime delete-all canonical custody: PASS');
