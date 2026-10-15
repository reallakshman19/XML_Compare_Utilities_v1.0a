import assert from 'node:assert/strict';
import {
  compareOutsideWriter2NodeNameAuthority,
  comparePostimageAllowingOnlySuffix,
  compareWriter2NodeNameSemantics,
  deriveExactNameRelocations,
  deriveExpectedNodeNameDelta,
  evaluateWriter2BenchmarkPostimage,
  expectedTransferKeys,
  parseIndependentNodeNameState,
} from './cii-workspace-multisource-texpected-oracle.js';

function field(value) { return String(value ?? '').padStart(13, ' '); }
function six(values = []) { return `  ${Array.from({ length: 6 }, (_, index) => field(values[index] ?? 0)).join('')}`; }
function elementBlock(from, to, pointer) {
  const rows = Array.from({ length: 15 }, () => six());
  rows[0] = six([from, to, 0, 0, 0, 0]);
  rows[13] = six([0, 0, 0, 0, 0, pointer]);
  return rows;
}
function nodeNameRow(fromName = '', toName = '') {
  return `  ${fromName.padEnd(26, ' ')}${toName.padEnd(25, ' ')}`;
}
function fixture({ firstPointer, secondPointer, fromName, allowValue = 3 }) {
  return [
    '#$ CONTROL ',
    six([2, 0, 0, 1, 0, 0]), six(), six(), field(0),
    '#$ ELEMENTS',
    ...elementBlock(10, 20, firstPointer),
    ...elementBlock(30, 40, secondPointer),
    '#$ NODENAME',
    nodeNameRow(fromName),
    '#$ ALLOWBLS',
    six([1, 0, 0, 0, 9999, 0]),
    six([allowValue, 0, 0, 0, 0, 0]),
    '#$ END',
  ].join('\r\n');
}

const beforeText = fixture({ firstPointer: 1, secondPointer: 0, fromName: 'SL-106.3' });
const expectedText = fixture({ firstPointer: 0, secondPointer: 1, fromName: 'SL-106.3' });
const before = parseIndependentNodeNameState(beforeText);
assert.equal(before.controlNodeNameCount, 1);
assert.equal(before.physicalNodeNameRowCount, 1);
assert.equal(before.names.get('10'), 'SL-106.3');
assert.equal(before.conflicts.length, 0);

const delta = deriveExpectedNodeNameDelta(beforeText, expectedText);
assert.deepEqual(delta.rows, [
  { nodeId: '10', action: 'DELETE', oldValue: 'SL-106.3', newValue: '' },
  { nodeId: '30', action: 'CREATE', oldValue: '', newValue: 'SL-106.3' },
]);
assert.deepEqual(expectedTransferKeys(delta.rows), [
  'CREATE|30|SL-106.3',
  'DELETE|10|SL-106.3',
]);
assert.deepEqual(deriveExactNameRelocations(delta.rows), [
  { name: 'SL-106.3', fromNodeId: '10', toNodeId: '30' },
]);

const suffixOnlyActual = fixture({ firstPointer: 0, secondPointer: 1, fromName: 'SL-106' });
const suffixCompare = comparePostimageAllowingOnlySuffix(suffixOnlyActual, expectedText);
assert.equal(suffixCompare.nonSuffix.length, 0, 'canonical stem-only mismatch may be classified only as the explicit suffix defect');
assert.equal(suffixCompare.suffixOnly.length, 1);
assert.equal(suffixCompare.suffixOnly[0].actual, 'SL-106');
assert.equal(suffixCompare.suffixOnly[0].expected, 'SL-106.3');

const wrongPointer = fixture({ firstPointer: 1, secondPointer: 0, fromName: 'SL-106' });
const structuralCompare = comparePostimageAllowingOnlySuffix(wrongPointer, expectedText);
assert(structuralCompare.nonSuffix.length > 0, 'wrong ELEMENT pointer/correspondence must never be hidden by suffix-only tolerance');

const wrongSibling = fixture({ firstPointer: 0, secondPointer: 1, fromName: 'SL-106.4' });
const siblingCompare = comparePostimageAllowingOnlySuffix(wrongSibling, expectedText);
assert(siblingCompare.nonSuffix.length > 0, 'wrong dotted sibling is a real benchmark failure, not suffix-only');

// Benchmark fidelity and target preservation are separate, simultaneous gates.
const exactSemantic = compareWriter2NodeNameSemantics(expectedText, expectedText);
assert.equal(exactSemantic.nonSuffix.length, 0);
assert.equal(exactSemantic.suffixOnly.length, 0);
assert.equal(compareOutsideWriter2NodeNameAuthority(beforeText, expectedText).status, 'READY',
  'moving a NODENAME pointer/value is inside Writer2 authority and must not count as unrelated target mutation');
assert.equal(evaluateWriter2BenchmarkPostimage(beforeText, expectedText, expectedText).status, 'READY');

const scopedSuffix = evaluateWriter2BenchmarkPostimage(beforeText, suffixOnlyActual, expectedText, { allowSuffixOnly: true });
assert.equal(scopedSuffix.status, 'READY', 'suffix-only diagnostic mode may pass only when all non-suffix semantics and preservation gates pass');
assert.equal(scopedSuffix.benchmark.suffixOnly.length, 1);
assert.equal(scopedSuffix.benchmark.nonSuffix.length, 0);
assert.equal(scopedSuffix.preservation.status, 'READY');

const foreignActual = fixture({ firstPointer: 0, secondPointer: 1, fromName: 'SL-106.3', allowValue: 53 });
assert.equal(compareWriter2NodeNameSemantics(foreignActual, expectedText).nonSuffix.length, 0,
  'an unrelated section mutation must not masquerade as a NODENAME benchmark mismatch');
const foreignPreservation = compareOutsideWriter2NodeNameAuthority(beforeText, foreignActual);
assert.equal(foreignPreservation.status, 'BLOCKED', 'unrelated target semantics must remain byte-stable outside Writer2 authority');
assert(foreignPreservation.differences.some((row) => row.section === 'ALLOWBLS'));
assert.equal(evaluateWriter2BenchmarkPostimage(beforeText, foreignActual, expectedText).status, 'BLOCKED');

const mixedDomainExpected = fixture({ firstPointer: 0, secondPointer: 1, fromName: 'SL-106.3', allowValue: 53 });
const mixedDomainAcceptance = evaluateWriter2BenchmarkPostimage(beforeText, expectedText, mixedDomainExpected);
assert.equal(mixedDomainAcceptance.status, 'READY',
  'foreign edits present in an expected fixture must not authorize Writer2 to mutate unrelated target sections');
assert.equal(mixedDomainAcceptance.benchmark.nonSuffix.length, 0);
assert.equal(mixedDomainAcceptance.preservation.status, 'READY');

console.log('CII independent TEXPECTED oracle unit checks passed.');
