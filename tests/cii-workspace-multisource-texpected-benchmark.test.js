import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  compareOutsideWriter2NodeNameAuthority,
  deriveExactNameRelocations,
  deriveExpectedNodeNameDelta,
} from './cii-workspace-multisource-texpected-oracle.js';
import { expectedStructuralTransferKeys } from './cii-workspace-multisource-partial-texpected-oracle.js';

const targetPath = fileURLToPath(new URL('../Benchmark/T.CII', import.meta.url));
const expectedPath = fileURLToPath(new URL('../Benchmark/TEXPECTED-PARTIALLLYDONE.CII', import.meta.url));
const targetText = readFileSync(targetPath, 'latin1');
const expectedText = readFileSync(expectedPath, 'latin1');
const delta = deriveExpectedNodeNameDelta(targetText, expectedText);
const structuralKeys = expectedStructuralTransferKeys(delta.rows);
const partialNameRelocations = deriveExactNameRelocations(delta.rows);
const foreignFixtureDelta = compareOutsideWriter2NodeNameAuthority(targetText, expectedText);
const foreignSections = [...new Set(foreignFixtureDelta.differences.map((row) => row.section).filter(Boolean))].sort();
const byAction = Object.fromEntries(['CREATE', 'DELETE', 'REPLACE'].map((action) => [
  action, delta.rows.filter((row) => row.action === action).length,
]));
const keySha256 = createHash('sha256').update(`${structuralKeys.join('\n')}\n`, 'utf8').digest('hex');
const ownerCheckpointPairs = [
  ['8870', '9040'],
  ['10350', '10190'],
  ['1005', '925'],
];
const checkpointEvidence = ownerCheckpointPairs.map(([fromNodeId, toNodeId]) => ({
  fromNodeId,
  toNodeId,
  fromBefore: delta.before.names.get(fromNodeId) || '',
  fromPartialExpected: delta.expected.names.get(fromNodeId) || '',
  toBefore: delta.before.names.get(toNodeId) || '',
  toPartialExpected: delta.expected.names.get(toNodeId) || '',
  partialNameRelocation: partialNameRelocations.find((row) => row.fromNodeId === fromNodeId && row.toNodeId === toNodeId) || null,
}));

assert.equal(delta.before.conflicts.length, 0, 'TARGET0 NODENAME ownership must be independently conflict-free');
assert.equal(delta.expected.conflicts.length, 0, 'partial TEXPECTED NODENAME ownership must be independently conflict-free');
assert.equal(delta.before.controlNodeNameCount, delta.before.physicalNodeNameRowCount,
  'TARGET0 CONTROL.NONAM must equal physical NODENAME row count');
assert.equal(delta.expected.controlNodeNameCount, delta.expected.physicalNodeNameRowCount,
  'partial TEXPECTED CONTROL.NONAM must equal physical NODENAME row count');
assert(byAction.REPLACE > 0,
  'the frozen partial TEXPECTED fixture must retain its known same-cardinality payload edits as non-Writer2 evidence');
assert.equal(structuralKeys.length, byAction.CREATE + byAction.DELETE,
  'Writer2 structural Transfer authority is exactly CREATE/DELETE cardinality and excludes all REPLACE rows');
assert(structuralKeys.length > 0, 'T to partial TEXPECTED must derive a non-empty structural cardinality transfer set');
assert.equal(new Set(structuralKeys).size, structuralKeys.length, 'independent structural Transfer keys must be unique');

console.log(JSON.stringify({
  benchmark: 'T.CII -> TEXPECTED-PARTIALLLYDONE.CII (partial structural oracle)',
  controlNodeNameCountBefore: delta.before.controlNodeNameCount,
  controlNodeNameCountPartialExpected: delta.expected.controlNodeNameCount,
  physicalNodeNameRowsBefore: delta.before.physicalNodeNameRowCount,
  physicalNodeNameRowsPartialExpected: delta.expected.physicalNodeNameRowCount,
  observedNodeNameDeltaCount: delta.rows.length,
  writer2StructuralTransferApplyRowCount: structuralKeys.length,
  nonWriter2SameCardinalityReplaceCount: byAction.REPLACE,
  byAction,
  uniquePartialNameRelocationCount: partialNameRelocations.length,
  expectedStructuralTransferKeySha256: keySha256,
  ownerCheckpointEvidence: checkpointEvidence,
  retainedExpectedHasForeignTargetDelta: foreignFixtureDelta.status !== 'READY',
  retainedExpectedForeignDifferenceCount: foreignFixtureDelta.differences.length,
  retainedExpectedForeignSections: foreignSections,
  structuralAuthority: 'TEXPECTED CONTROL/NODENAME cardinality, ELEMENT pointer placement, action/target only',
  rawNameAuthority: 'S1/S2/S3 exact NODENAME plus exact BM-001 source-alias/target pairing when represented',
}, null, 2));

console.log('CII retained-real partial TEXPECTED structural benchmark oracle checks passed.');