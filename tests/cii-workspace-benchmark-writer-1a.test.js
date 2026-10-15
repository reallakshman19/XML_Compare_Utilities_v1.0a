import assert from 'assert';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { applyCiiWorkspaceTargetWriter1A, createCiiWorkspacePreview } from '../tabs/cii-workspace/cii-workspace-core.js';
import { updateCiiReviewDecisions } from '../tabs/cii-workspace/cii-workspace-review.js';

async function text(relative) { return readFile(new URL(relative, import.meta.url), 'utf8'); }
function edgeRow(result, sourceFrom, sourceTo) {
  const token = `:${sourceFrom}->${sourceTo}`;
  return (result.correspondence?.elementRows || []).find((row) => String(row.sourceElementId || '').includes(token)) || null;
}
function op(plan, correspondenceId, property) {
  return (plan?.operations || []).find((item) => item.matchAuthority?.correspondenceId === correspondenceId && item.property === property) || null;
}

const [sourceText, target1Text, target2Text] = await Promise.all([
  text('../Benchmark/CIICompare/BM_CII_SOURCE.CII'),
  text('../Benchmark/CIICompare/BM_CII_TARGET1.CII'),
  text('../Benchmark/CIICompare/BM_CII_TARGET2.CII'),
]);
const policy = Object.freeze({
  writerVersion: '1A',
  cryptoRef: webcrypto,
  spatialToleranceMm: 100,
  diameterToleranceRatio: 0.10,
  wallToleranceRatio: 0.10,
  identityWeight: 50,
  diameterWeight: 30,
  wallWeight: 30,
  winnerGap: 8,
});

async function writerSlice(targetText, targetFileName, targetAnchor) {
  const baseInput = {
    sourceText,
    sourceFileName: 'BM_CII_SOURCE.CII',
    targetText,
    targetFileName,
    anchorPairs: [{ sourceNodeId: '10', targetNodeId: String(targetAnchor) }],
  };
  const first = await createCiiWorkspacePreview(baseInput, policy);
  assert.strictEqual(first.writerVersion, '1A');
  const sizeEdge = edgeRow(first, '250', '255');
  assert(sizeEdge, 'Benchmark must establish SOURCE 250→255 correspondence without deriving target numbering from an offset.');
  const review = updateCiiReviewDecisions(first.review, {
    reviewedCorrespondenceIds: [sizeEdge.correspondenceId],
    lockedCorrespondenceIds: [],
    rejectedCorrespondenceIds: [],
  });
  const approved = await createCiiWorkspacePreview({ ...baseInput, review }, policy);
  const wall = op(approved.transferPlan, sizeEdge.correspondenceId, 'Wall thickness');
  const od = op(approved.transferPlan, sizeEdge.correspondenceId, 'OD');
  assert(wall, 'Writer benchmark requires a wall-thickness engineering delta.');
  assert.strictEqual(wall.action, 'COPY');
  assert.strictEqual(wall.status, 'PREVIEW_READY');
  assert.strictEqual(wall.policyAuthority, 'CII_WRITER_1A_CARDINALITY_PRESERVING_ELEMENT_FIELD');
  assert(od, 'Writer benchmark must retain OD as explicit protected evidence.');
  assert.strictEqual(od.action, 'KEEP');
  assert.strictEqual(od.status, 'PROTECTED');
  assert.strictEqual(approved.writerReadiness.ready, true, `Writer 1A slice must be independently executable: ${approved.writerReadiness.blockers?.join(', ')}`);

  const applied = await applyCiiWorkspaceTargetWriter1A(approved, targetText, policy);
  assert.strictEqual(applied.status, 'PASS');
  assert(applied.mutationCount >= 1);
  assert.strictEqual(applied.text.length, targetText.length, 'cardinality-preserving writer must preserve file byte/character count for ASCII benchmark');
  assert.strictEqual(applied.validation.status, 'PASS');
  assert.strictEqual(applied.validation.unexpectedSemanticDeltaCount, 0);
  assert.notStrictEqual(applied.modifiedTargetSha256, applied.sourceTargetSha256, 'an approved wall change must alter target content hash');
  assert(applied.mutations.some((item) => item.section === 'ELEMENTS' && item.field === 'WT'));

  await assert.rejects(
    () => applyCiiWorkspaceTargetWriter1A(approved, `${targetText}\n`, policy),
    /CII_WRITER_1A_STALE_TARGET_HASH/,
    'target bytes changed after review must invalidate apply authority',
  );
  return applied;
}

await writerSlice(target1Text, 'BM_CII_TARGET1.CII', '20010');
await writerSlice(target2Text, 'BM_CII_TARGET2.CII', '10010');
console.log('CII real TARGET1/TARGET2 Writer 1A round-trip checks passed.');
