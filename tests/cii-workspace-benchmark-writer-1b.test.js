import assert from 'assert';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { applyCiiWorkspaceTargetWriter1B, createCiiWorkspacePreview } from '../tabs/cii-workspace/cii-workspace-core.js';
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
  cryptoRef: webcrypto,
  spatialToleranceMm: 100,
  diameterToleranceRatio: 0.10,
  wallToleranceRatio: 0.10,
  identityWeight: 50,
  diameterWeight: 30,
  wallWeight: 30,
  winnerGap: 8,
});

async function writer1BCase(targetText, targetFileName, targetAnchor) {
  const baseInput = {
    sourceText,
    sourceFileName: 'BM_CII_SOURCE.CII',
    targetText,
    targetFileName,
    anchorPairs: [{ sourceNodeId: '10', targetNodeId: String(targetAnchor) }],
  };
  const first = await createCiiWorkspacePreview(baseInput, policy);
  assert.strictEqual(first.writerVersion, '1B');
  const sizeEdge = edgeRow(first, '250', '255');
  assert(sizeEdge, 'Writer 1B benchmark must establish SOURCE 250→255 without offset-derived identity.');
  const review = updateCiiReviewDecisions(first.review, {
    reviewedCorrespondenceIds: [sizeEdge.correspondenceId], lockedCorrespondenceIds: [], rejectedCorrespondenceIds: [],
  });
  const approved = await createCiiWorkspacePreview({ ...baseInput, review }, policy);
  assert.strictEqual(approved.writerVersion, '1B');
  const wall = op(approved.transferPlan, sizeEdge.correspondenceId, 'Wall thickness');
  assert(wall, 'Writer 1B benchmark requires the known wall-thickness delta.');
  assert.strictEqual(wall.action, 'COPY');
  assert.strictEqual(wall.status, 'PREVIEW_READY');

  const od = op(approved.transferPlan, sizeEdge.correspondenceId, 'OD');
  assert(od, 'OD must remain explicit evidence under Writer 1B.');
  if (od.action === 'COPY') {
    assert.strictEqual(od.status, 'PREVIEW_READY');
    assert.strictEqual(od.policyAuthority, 'CII_WRITER_1B_CONDITIONAL_OD_FIXED_FIELD');
    assert(String(od.evidenceAuthority || '').includes('WRITER_1B_PLAIN_PIPE_NO_REDUCER_TOPOLOGY_CLOSED'));
  } else {
    assert.strictEqual(od.action, 'KEEP');
    assert.strictEqual(od.status, 'PROTECTED');
    assert((od.blockers || []).some((item) => String(item).startsWith('OD_')), 'protected OD must state an explicit eligibility blocker');
  }

  assert.strictEqual(approved.writerReadiness.ready, true, `approved Writer 1B benchmark must be executable: ${approved.writerReadiness.blockers?.join(', ')}`);
  const applied = await applyCiiWorkspaceTargetWriter1B(approved, targetText, policy);
  assert.strictEqual(applied.status, 'PASS');
  assert.strictEqual(applied.writer, 'WRITER_1B');
  assert(applied.mutationCount >= 1);
  assert.strictEqual(applied.text.length, targetText.length);
  assert.strictEqual(applied.validation.status, 'PASS');
  assert.strictEqual(applied.validation.unexpectedSemanticDeltaCount, 0);
  assert(applied.mutations.some((item) => item.section === 'ELEMENTS' && item.field === 'WT'));
  if (od.action === 'COPY') assert(applied.mutations.some((item) => item.section === 'ELEMENTS' && item.field === 'OD'));
  else assert(!applied.mutations.some((item) => item.section === 'ELEMENTS' && item.field === 'OD'));

  await assert.rejects(
    () => applyCiiWorkspaceTargetWriter1B(approved, `${targetText}\n`, policy),
    /CII_WRITER_1B_STALE_TARGET_HASH/,
    'Writer 1B must reject target bytes changed after approval',
  );
}

await writer1BCase(target1Text, 'BM_CII_TARGET1.CII', '20010');
await writer1BCase(target2Text, 'BM_CII_TARGET2.CII', '10010');
console.log('CII real TARGET1/TARGET2 Writer 1B round-trip checks passed.');
