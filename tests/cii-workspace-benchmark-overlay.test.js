import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import {
  buildCiiSourceTargetBenchmarkOverlay,
  ciiSourceTargetBenchmarkOverlayToCsv,
  ciiSourceTargetBenchmarkOverlayToJson,
  deriveCiiNodeNameBenchmarkDelta,
  deriveCiiNodeNameBenchmarkDeltaFromCii,
} from '../tabs/cii-workspace/cii-workspace-benchmark-overlay.js';
import { deriveExpectedNodeNameDelta } from './cii-workspace-multisource-texpected-oracle.js';

function document(fileName, nodeNames) {
  return { fileName, contentSha256: `${fileName}-sha`, nodeNames };
}

const before = document('T.CII', { 101: 'A', 102: 'B' });
const expected = document('TEXPECTED.CII', { 101: 'A2', 102: 'B', 103: 'C' });
const benchmark = deriveCiiNodeNameBenchmarkDelta(before, expected);
assert.deepEqual(benchmark.rows, [
  { nodeId: '101', action: 'REPLACE', writerAction: 'COPY', oldValue: 'A', newValue: 'A2' },
  { nodeId: '103', action: 'CREATE', writerAction: 'CREATE', oldValue: '', newValue: 'C' },
]);
assert.equal(benchmark.lowerBoundOnly, true);

const audit = {
  rows: [
    {
      rowKey: 'S1:1', sourceId: 'S1', sourceNodeId: '1', sourceNodeName: 'A2',
      state: 'BOUND', identityBound: true, targetNodeId: '101', targetNodeName: 'A',
      qualifiedNodeNameChange: true, writerActions: ['COPY'],
    },
    {
      rowKey: 'S1:2', sourceId: 'S1', sourceNodeId: '2', sourceNodeName: 'C',
      state: 'BOUND', identityBound: true, targetNodeId: '103', targetNodeName: '',
      qualifiedNodeNameChange: false, writerActions: [],
    },
    {
      rowKey: 'S2:9', sourceId: 'S2', sourceNodeId: '9', sourceNodeName: 'EXTRA',
      state: 'BOUND', identityBound: true, targetNodeId: '999', targetNodeName: 'OLD',
      qualifiedNodeNameChange: true, writerActions: ['COPY'],
    },
  ],
};
const overlay = buildCiiSourceTargetBenchmarkOverlay(audit, benchmark);
assert.equal(overlay.summary.expectedCount, 2);
assert.equal(overlay.summary.correspondenceRecoveredCount, 2);
assert.equal(overlay.summary.mutationRecoveredCount, 1);
assert.equal(overlay.summary.missingCount, 1);
assert.equal(overlay.summary.additionalQualifiedCount, 1);
assert.equal(overlay.rows.find((row) => row.nodeId === '101').status, 'RECOVERED');
assert.equal(overlay.rows.find((row) => row.nodeId === '103').status, 'BOUND_NO_MUTATION');
assert.equal(overlay.additionalQualifiedRows[0].status, 'ADDITIONAL_QUALIFIED_NOT_IN_PARTIAL_BENCHMARK');
assert.equal(overlay.censusAnnotations.find((row) => row.rowKey === 'S2:9').status, 'ADDITIONAL_QUALIFIED_NOT_IN_PARTIAL_BENCHMARK');

const csv = ciiSourceTargetBenchmarkOverlayToCsv(overlay);
assert.match(csv, /KNOWN_POSITIVE/);
assert.match(csv, /ADDITIONAL_QUALIFIED/);
assert.match(csv, /BOUND_NO_MUTATION/);
const json = ciiSourceTargetBenchmarkOverlayToJson(overlay);
assert.match(json, /CIIWorkspaceSourceTargetBenchmarkOverlay\.v1/);
assert.match(json, /"lowerBoundOnly":true/);

// Retained-real cross-check: production derivation must agree row-for-row with the
// pre-existing independent T -> TEXPECTED oracle. No retained answer set is
// embedded here; both sides derive their result from the supplied fixture bytes.
const beforePath = new URL('../Benchmark/T.CII', import.meta.url);
const expectedPath = new URL('../Benchmark/TEXPECTED-PARTIALLLYDONE.CII', import.meta.url);
const beforeBytes = readFileSync(beforePath);
const expectedBytes = readFileSync(expectedPath);
const productionRetained = await deriveCiiNodeNameBenchmarkDeltaFromCii(beforeBytes, expectedBytes, {
  beforeFileName: 'T.CII', expectedFileName: 'TEXPECTED-PARTIALLLYDONE.CII', cryptoRef: webcrypto,
});
const independentRetained = deriveExpectedNodeNameDelta(
  readFileSync(beforePath, 'latin1'),
  readFileSync(expectedPath, 'latin1'),
);
const productionRows = productionRetained.rows.map(({ nodeId, action, oldValue, newValue }) => ({ nodeId, action, oldValue, newValue }));
const independentRows = independentRetained.rows.map(({ nodeId, action, oldValue, newValue }) => ({ nodeId, action, oldValue, newValue }));
assert.deepEqual(productionRows, independentRows, 'production benchmark derivation must match the independent retained oracle');
assert(productionRows.length > 0, 'retained benchmark must derive at least one known-positive delta');

console.log('CII benchmark overlay dynamic derivation checks: PASS');
