import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { webcrypto } from 'crypto';
import { fileURLToPath } from 'url';

import { intakeCiiWorkspaceDocument } from '../tabs/cii-workspace/cii-workspace-intake.js';
import {
  assertCiiCompareOracle,
  preflightCiiCompareOracle,
} from './helpers/cii-compare-benchmark-oracle.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const benchmarkDir = path.join(__dirname, '..', 'Benchmark', 'CIICompare');
const oracle = JSON.parse(fs.readFileSync(path.join(benchmarkDir, 'CII_COMPARE_EXPECTED.json'), 'utf8'));

async function loadModel(fileName, side) {
  const rawText = fs.readFileSync(path.join(benchmarkDir, fileName), 'utf8');
  const document = await intakeCiiWorkspaceDocument(rawText, fileName, { side, cryptoRef: webcrypto });
  assert.strictEqual(document.format, 'NEUTRAL');
  return document.parsed;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hasError(result, code, predicate = () => true) {
  return result.errors.some((error) => error.code === code && predicate(error));
}

const models = {
  source: await loadModel(oracle.source, 'SOURCE'),
  target1: await loadModel(oracle.targets.target1.file, 'TARGET'),
  target2: await loadModel(oracle.targets.target2.file, 'TARGET'),
};

const result = assertCiiCompareOracle(oracle, models);
assert.strictEqual(result.status, 'PASS');
assert.strictEqual(result.checked.nodeMappings, 7);
assert.strictEqual(result.checked.gangMappings, 2);
assert.strictEqual(oracle.numberingHints.target1.authority, 'NON_AUTHORITATIVE_HINT');
assert.strictEqual(oracle.numberingHints.target2.authority, 'NON_AUTHORITATIVE_HINT');
assert.strictEqual(oracle.oracleRules.deriveTargetsFromOffset, false);
assert(oracle.quarantinedExpectations.every((item) => item.status === 'QUARANTINED'));

// A historical note that points to source node 50 must not be admitted merely
// because a numbering offset could manufacture target node 20050.
const missingSource = clone(oracle);
missingSource.nodeMappings[0].sourceNode = '50';
let invalid = preflightCiiCompareOracle(missingSource, models);
assert.strictEqual(invalid.status, 'FAIL');
assert(hasError(invalid, 'ORACLE_NODE_NOT_FOUND', (error) => error.side === 'SOURCE' && error.nodeId === '50'));

// `10 -> 20000` is not a valid locked node pair. The +20000 value remains a
// non-authoritative numbering hint only; an explicit nonexistent target fails.
const offsetAsNode = clone(oracle);
offsetAsNode.nodeMappings[0].target1Node = '20000';
invalid = preflightCiiCompareOracle(offsetAsNode, models);
assert(hasError(invalid, 'ORACLE_NODE_NOT_FOUND', (error) => error.side === 'TARGET1' && error.nodeId === '20000'));

// The oracle may not derive a missing TARGET2 node from its +10000 hint.
const missingExplicitTarget = clone(oracle);
delete missingExplicitTarget.nodeMappings[0].target2Node;
invalid = preflightCiiCompareOracle(missingExplicitTarget, models);
assert(hasError(invalid, 'ORACLE_NODE_ID_MISSING', (error) => error.side === 'TARGET2'));

// One target node cannot be authoritative for two independent source-node cases.
const duplicateCustody = clone(oracle);
duplicateCustody.nodeMappings.push({
  id: 'DUPLICATE-TARGET', sourceNode: '20', target1Node: '20010', target2Node: '10020', purpose: 'negative-test',
});
invalid = preflightCiiCompareOracle(duplicateCustody, models);
assert(hasError(invalid, 'ORACLE_DUPLICATE_TARGET_CUSTODY', (error) => error.targetKey === 'target1Node' && error.targetNode === '20010'));

// A gang is an actual connected path, not an arbitrary ordered node list.
const brokenGang = clone(oracle);
brokenGang.gangMappings[1].sourceNodes = ['250', '260'];
brokenGang.gangMappings[1].target1Nodes = ['20250', '20260'];
brokenGang.gangMappings[1].target2Nodes = ['10250', '10260'];
invalid = preflightCiiCompareOracle(brokenGang, models);
assert(hasError(invalid, 'ORACLE_GANG_EDGE_NOT_FOUND', (error) => error.side === 'SOURCE' && error.from === '250' && error.to === '260'));

console.log('CII Compare benchmark oracle preflight checks passed.');
