import assert from 'assert';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createCiiWorkspacePreview } from '../tabs/cii-workspace/cii-workspace-core.js';

async function read(relative) { return readFile(new URL(relative, import.meta.url), 'utf8'); }
function nodeRow(result, sourceNode) {
  return (result.correspondence?.nodeRows || []).find((row) => String(row.sourceNodeId) === String(sourceNode)) || null;
}
function edgeRow(result, sourceFrom, sourceTo) {
  const token = `:${sourceFrom}->${sourceTo}`;
  return (result.correspondence?.elementRows || []).find((row) => String(row.sourceElementId || '').includes(token)) || null;
}
function onlyTarget(row) { return row?.targetElementIds?.length === 1 ? String(row.targetElementIds[0]) : ''; }
function assertNode(result, sourceNode, targetNode) {
  const row = nodeRow(result, sourceNode);
  assert(row, `Missing node correspondence for SOURCE ${sourceNode}`);
  assert.strictEqual(String(row.targetNodeId), String(targetNode), `Unexpected target for SOURCE node ${sourceNode}`);
  return row;
}
function assertEdge(result, sourceFrom, sourceTo, targetFrom, targetTo) {
  const row = edgeRow(result, sourceFrom, sourceTo);
  assert(row, `Missing element correspondence ${sourceFrom}->${sourceTo}`);
  assert(onlyTarget(row).includes(`:${targetFrom}->${targetTo}`), `Unexpected target for ${sourceFrom}->${sourceTo}: ${onlyTarget(row)}`);
  return row;
}
function reviewRow(result, correspondenceId) {
  return (result.compareReview?.rows || []).find((row) => row.correspondenceId === correspondenceId) || null;
}
function changedDelta(result, correspondenceId, property) {
  return (result.engineeringDeltas?.changedRows || []).find((row) => row.correspondenceId === correspondenceId && row.property === property) || null;
}
function anyDelta(result, property) {
  return (result.engineeringDeltas?.rows || []).find((row) => row.property === property) || null;
}

const [sourceText, target1Text, target2Text] = await Promise.all([
  read('../Benchmark/CIICompare/BM_CII_SOURCE.CII'),
  read('../Benchmark/CIICompare/BM_CII_TARGET1.CII'),
  read('../Benchmark/CIICompare/BM_CII_TARGET2.CII'),
]);

async function preview(targetText, targetFileName, targetAnchor) {
  return createCiiWorkspacePreview({
    sourceText,
    sourceFileName: 'BM_CII_SOURCE.CII',
    targetText,
    targetFileName,
    anchorPairs: [{ sourceNodeId: '10', targetNodeId: String(targetAnchor) }],
  }, {
    cryptoRef: webcrypto,
    spatialToleranceMm: 100,
    diameterToleranceRatio: 0.10,
    wallToleranceRatio: 0.10,
    identityWeight: 50,
    diameterWeight: 30,
    wallWeight: 30,
    winnerGap: 8,
  });
}

const target1 = await preview(target1Text, 'BM_CII_TARGET1.CII', '20010');
const target2 = await preview(target2Text, 'BM_CII_TARGET2.CII', '10010');

for (const result of [target1, target2]) {
  assert.strictEqual(result.audit?.mutationAuthority?.stage06, 'WRITER_1A_BLOCKED');
  assert.strictEqual(result.audit?.mutationAuthority?.modifiedTargetCiiExport, 'BLOCKED');
  assert.strictEqual(result.writerReadiness?.ready, false, 'unreviewed preview must not gain mutation authority');
  assert.strictEqual(result.artifacts?.modifiedTargetCii, null);
  assert.strictEqual(result.sourceDocument.auxiliaryEvidence.conflicts.length, 0);
  assert.strictEqual(result.targetDocument.auxiliaryEvidence.conflicts.length, 0);
  assert.strictEqual(result.sourceDocument.hangerEvidence.conflicts.length, 0);
  assert.strictEqual(result.targetDocument.hangerEvidence.conflicts.length, 0);
  assert.strictEqual(result.sourceDocument.summary.hangerCount, 1);
  assert.strictEqual(result.targetDocument.summary.hangerCount, 0);
}

for (const [source, target] of [['10','20010'], ['35','20035'], ['70','20070'], ['113','20113'], ['116','20116'], ['130','20130'], ['205','20205']]) {
  assertNode(target1, source, target);
}
const target1SifBranch = assertEdge(target1, '70', '250', '20070', '20250');
assertEdge(target1, '200', '205', '20200', '20205');
assertEdge(target1, '205', '210', '20205', '20210');
for (const tuple of [
  ['250','255','20250','20255'], ['255','260','20255','20260'], ['260','270','20260','20270'],
]) assertEdge(target1, ...tuple);

const target1Moved205 = reviewRow(target1, edgeRow(target1, '200', '205').correspondenceId);
assert(target1Moved205);
assert.strictEqual(target1Moved205.methodA?.pass, false, '205 spatial evidence must fail at 100 mm');
assert.strictEqual(target1Moved205.methodB?.pass, true, '205 network identity must survive relocation');
assert.strictEqual(target1Moved205.confidence, 'MEDIUM');

const node205t1 = nodeRow(target1, '205');
const hangerT1 = changedDelta(target1, node205t1.correspondenceId, 'Hanger presence');
assert(hangerT1, 'TARGET1 node205 must report source hanger removal downstream of identity');
assert.strictEqual(hangerT1.sourceValue, true);
assert.strictEqual(hangerT1.targetValue, false);
assert.strictEqual(hangerT1.semanticChange, 'REMOVED_IN_TARGET');
const hangerCountT1 = changedDelta(target1, node205t1.correspondenceId, 'Hanger record count at node');
assert.strictEqual(hangerCountT1?.sourceValue, 1);
assert.strictEqual(hangerCountT1?.targetValue, 0);
assert.strictEqual(hangerCountT1?.delta, -1);

for (const tuple of [['250','255'], ['255','260'], ['260','270']]) {
  const row = edgeRow(target1, ...tuple); const review = reviewRow(target1, row.correspondenceId);
  assert(review);
  assert.strictEqual(review.methodB?.pass, true);
  assert.strictEqual(review.od?.pass, false);
  assert.strictEqual(review.wall?.pass, false);
  assert.strictEqual(review.confidence, 'MEDIUM');
}

const node130t1 = nodeRow(target1, '130');
assert.deepStrictEqual(changedDelta(target1, node130t1.correspondenceId, 'Restraint code set')?.sourceValue, [15]);
assert.deepStrictEqual(changedDelta(target1, node130t1.correspondenceId, 'Restraint code set')?.targetValue, [9]);
assert.deepStrictEqual(changedDelta(target1, node130t1.correspondenceId, 'Restraint friction values')?.sourceValue, [0]);
assert.deepStrictEqual(changedDelta(target1, node130t1.correspondenceId, 'Restraint friction values')?.targetValue, [0.3]);

const sifT1 = changedDelta(target1, target1SifBranch.correspondenceId, 'SIF/Tee raw code (field 2)');
assert(sifT1, 'TARGET1 70->250 / 20070->20250 correspondence must expose pointer-bound SIF/Tee raw-code change');
assert.strictEqual(sifT1.sourceValue, 3);
assert.strictEqual(sifT1.targetValue, 5);

const rigidWeightT1 = anyDelta(target1, 'Rigid weight');
assert(rigidWeightT1, 'TARGET1 should carry pointer-bound rigid-weight evidence');
if (String(rigidWeightT1.sourceIdentity).includes('RIGID')) {
  assert(!(rigidWeightT1.sourceValue === 111.2 && rigidWeightT1.targetValue !== 111.2));
}

for (const [source, target] of [['10','10010'], ['35','10035'], ['70','10070'], ['113','10113'], ['116','10116'], ['130','10130'], ['205','10205']]) {
  assertNode(target2, source, target);
}
const target2SifBranch = assertEdge(target2, '70', '250', '10070', '10250');
assertEdge(target2, '200', '205', '10200', '10205');
assertEdge(target2, '205', '210', '10205', '10210');
for (const tuple of [
  ['250','255','10250','10255'], ['255','260','10255','10260'], ['260','270','10260','10270'],
]) assertEdge(target2, ...tuple);

const node205t2 = nodeRow(target2, '205');
const hangerT2 = changedDelta(target2, node205t2.correspondenceId, 'Hanger presence');
assert(hangerT2, 'TARGET2 node205 must independently report source hanger removal under frozen policy');
assert.strictEqual(hangerT2.sourceValue, true);
assert.strictEqual(hangerT2.targetValue, false);
assert.strictEqual(hangerT2.semanticChange, 'REMOVED_IN_TARGET');
const hangerCountT2 = changedDelta(target2, node205t2.correspondenceId, 'Hanger record count at node');
assert.strictEqual(hangerCountT2?.sourceValue, 1);
assert.strictEqual(hangerCountT2?.targetValue, 0);
assert.strictEqual(hangerCountT2?.delta, -1);

for (const tuple of [['250','255'], ['255','260'], ['260','270']]) {
  const row = edgeRow(target2, ...tuple); const review = reviewRow(target2, row.correspondenceId);
  assert(review);
  assert.strictEqual(review.methodB?.pass, true, 'TARGET2 redistributed gang must retain M2 identity');
  assert.strictEqual(review.od?.pass, false);
  assert.strictEqual(review.wall?.pass, false);
  assert.strictEqual(review.confidence, 'MEDIUM');
}

const node130t2 = nodeRow(target2, '130');
assert.deepStrictEqual(changedDelta(target2, node130t2.correspondenceId, 'Restraint code set')?.sourceValue, [15]);
assert.deepStrictEqual(changedDelta(target2, node130t2.correspondenceId, 'Restraint code set')?.targetValue, [9]);
assert.strictEqual(changedDelta(target2, node130t2.correspondenceId, 'Restraint friction values'), null);
const t2FrictionEvidence = (target2.engineeringDeltas?.rows || []).find((row) => row.correspondenceId === node130t2.correspondenceId && row.property === 'Restraint friction values');
assert.deepStrictEqual(t2FrictionEvidence?.sourceValue, [0]);
assert.deepStrictEqual(t2FrictionEvidence?.targetValue, [0]);

const sifT2 = changedDelta(target2, target2SifBranch.correspondenceId, 'SIF/Tee raw code (field 2)');
assert(sifT2, 'TARGET2 70->250 / 10070->10250 correspondence must expose pointer-bound SIF/Tee raw-code change');
assert.strictEqual(sifT2.sourceValue, 3);
assert.strictEqual(sifT2.targetValue, 5);

console.log('CII full SOURCE/TARGET1/TARGET2 benchmark acceptance checks passed.');
