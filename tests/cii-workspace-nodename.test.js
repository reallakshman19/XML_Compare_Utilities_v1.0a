import assert from 'assert';
import { extractCiiNodeNameEvidence } from '../tabs/cii-workspace/cii-workspace-nodename.js';

function nameRow(fromName, toName) {
  return `  ${String(fromName).padEnd(26)}${String(toName).padEnd(25)}`;
}

function elementBlock(element, pointer) {
  const rows = Array.from({ length: 15 }, () => '0');
  rows[0] = `${element.from} ${element.to} 0 0 1000 273`;
  rows[13] = `0 0 0 0 0 ${pointer}`;
  return rows.join('\n');
}

function fixture(elements, pointers, nameRows) {
  return [
    '#$ ELEMENTS',
    ...elements.map((element, index) => elementBlock(element, pointers[index])),
    '#$ NODENAME',
    ...nameRows,
    '#$ BEND',
  ].join('\n');
}

const parsed = {
  nodes: { 100: {}, 200: {}, 300: {} },
  elements: [{ from: 100, to: 200 }, { from: 200, to: 300 }],
};

const normal = extractCiiNodeNameEvidence(
  fixture(parsed.elements, [1, 2], [nameRow('PUMP-N1', 'MID-A'), nameRow('MID-A', 'END-300')]),
  parsed,
);
assert.deepStrictEqual(normal.names, { 100: 'PUMP-N1', 200: 'MID-A', 300: 'END-300' });
assert.strictEqual(normal.conflicts.length, 0);
assert.strictEqual(normal.mappedElementCount, 2);

const conflict = extractCiiNodeNameEvidence(
  fixture(parsed.elements, [1, 2], [nameRow('PUMP-N1', 'MID-A'), nameRow('WRONG-MID', 'END-300')]),
  parsed,
);
assert.strictEqual(conflict.names['200'], undefined);
assert(conflict.conflicts.some((item) => item.code === 'NODENAME_CONFLICT' && item.nodeId === '200'));

const outOfRange = extractCiiNodeNameEvidence(
  fixture(parsed.elements, [7, 0], [nameRow('PUMP-N1', 'MID-A')]),
  parsed,
);
assert.deepStrictEqual(outOfRange.names, {});
assert(outOfRange.conflicts.some((item) => item.code === 'NODENAME_POINTER_OUT_OF_RANGE'));

// If the protected parser skips the first raw element, the surviving parsed element
// must bind to its FROM/TO raw block rather than inheriting block 0's NODENAME pointer.
const skippedFirst = extractCiiNodeNameEvidence(
  fixture(parsed.elements, [1, 2], [nameRow('SKIPPED-FROM', 'SKIPPED-TO'), nameRow('SURVIVOR', 'END-300')]),
  { nodes: { 200: {}, 300: {} }, elements: [{ from: 200, to: 300 }] },
);
assert.deepStrictEqual(skippedFirst.names, { 200: 'SURVIVOR', 300: 'END-300' });
assert.strictEqual(skippedFirst.mappedElementCount, 1);
assert.strictEqual(skippedFirst.rawElementBlockCount, 2);

const missingPointerRow = extractCiiNodeNameEvidence(
  '#$ ELEMENTS\n100 200 0 0 1000 273\n#$ NODENAME\n' + nameRow('A', 'B'),
  { nodes: { 100: {}, 200: {} }, elements: [{ from: 100, to: 200 }] },
);
assert(missingPointerRow.conflicts.some((item) => item.code === 'NODENAME_POINTER_UNREADABLE'));

console.log('CII Workspace NODENAME identity-bound evidence checks passed.');
