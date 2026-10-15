import assert from 'assert';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { applyCiiWorkspaceTargetWriter1A, createCiiWorkspacePreview } from '../tabs/cii-workspace/cii-workspace-core.js';
import { updateCiiReviewDecisions } from '../tabs/cii-workspace/cii-workspace-review.js';

async function text(relative) { return readFile(new URL(relative, import.meta.url), 'utf8'); }
function nodeRow(result, sourceNode) {
  return (result.correspondence?.nodeRows || []).find((row) => String(row.sourceNodeId) === String(sourceNode)) || null;
}
function operation(result, correspondenceId, property) {
  return (result.transferPlan?.operations || []).find((item) => item.matchAuthority?.correspondenceId === correspondenceId && item.property === property) || null;
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

async function restraintWriterCase(targetText, targetFileName, targetAnchor, expectedTargetNode, expectedPointer, expectedBeforeFriction) {
  const baseInput = {
    sourceText,
    sourceFileName: 'BM_CII_SOURCE.CII',
    targetText,
    targetFileName,
    anchorPairs: [{ sourceNodeId: '10', targetNodeId: String(targetAnchor) }],
  };
  const first = await createCiiWorkspacePreview(baseInput, policy);
  assert.strictEqual(first.writerVersion, '1A');
  const n130 = nodeRow(first, '130');
  assert(n130, 'benchmark must establish SOURCE node130 correspondence');
  assert.strictEqual(String(n130.targetNodeId), String(expectedTargetNode));

  const review = updateCiiReviewDecisions(first.review, {
    reviewedCorrespondenceIds: [n130.correspondenceId],
    lockedCorrespondenceIds: [],
    rejectedCorrespondenceIds: [],
  });
  const approved = await createCiiWorkspacePreview({ ...baseInput, review }, policy);

  const pairing = operation(approved, n130.correspondenceId, 'Qualified restraint record pairing');
  assert(pairing, 'approved node130 must expose executable restraint pairing');
  assert.strictEqual(pairing.action, 'COPY');
  assert.strictEqual(pairing.status, 'PREVIEW_READY');
  assert.strictEqual(pairing.policyAuthority, 'CII_WRITER_1A_CARDINALITY_PRESERVING_RESTRAINT_SLOT');
  assert.strictEqual(pairing.proposed.status, 'QUALIFIED');
  assert.strictEqual(pairing.proposed.authority, 'SINGLETON_EQUAL_CARDINALITY');
  assert.strictEqual(pairing.proposed.sourceCount, 1);
  assert.strictEqual(pairing.proposed.targetCount, 1);
  assert.strictEqual(pairing.proposed.pairs.length, 1);

  const pair = pairing.proposed.pairs[0];
  assert.strictEqual(pair.source.pointer, 5, 'SOURCE node130 restraint is bound to RESTRANT block 5');
  assert.strictEqual(pair.target.pointer, expectedPointer, 'TARGET pointer must remain target-native and independently qualified');
  assert.strictEqual(pair.before.pointer, expectedPointer);
  assert.strictEqual(pair.proposed.pointer, expectedPointer);
  assert.strictEqual(pair.before.slot, pair.proposed.slot, 'Writer 1A must not move target restraint slots');
  assert.strictEqual(String(pair.proposed.node), String(expectedTargetNode), 'Writer 1A must not copy SOURCE node numbering into target restraint records');
  assert.strictEqual(pair.before.typeCode, 9);
  assert.strictEqual(pair.proposed.typeCode, 15);
  assert.strictEqual(pair.before.friction, expectedBeforeFriction);
  assert.strictEqual(pair.proposed.friction, 0);

  for (const aggregateProperty of ['Restraint code set', 'Restraint friction values', 'Restraint stiffness values', 'Restraint direction-cosine set', 'Qualified restraint numeric record set']) {
    const aggregate = operation(approved, n130.correspondenceId, aggregateProperty);
    if (!aggregate) continue;
    assert.strictEqual(aggregate.action, 'KEEP', `${aggregateProperty} must remain evidence-only`);
    assert.strictEqual(aggregate.status, 'PROTECTED');
    assert.strictEqual(aggregate.policyAuthority, 'CII_RESTRAINT_AGGREGATE_EVIDENCE_ONLY');
  }

  assert.strictEqual(approved.writerReadiness.ready, true, `node130-only Writer 1A plan should be executable: ${approved.writerReadiness.blockers?.join(', ')}`);
  const applied = await applyCiiWorkspaceTargetWriter1A(approved, targetText, policy);
  assert.strictEqual(applied.status, 'PASS');
  assert.strictEqual(applied.validation.status, 'PASS');
  assert.strictEqual(applied.validation.unexpectedSemanticDeltaCount, 0);
  assert.notStrictEqual(applied.modifiedTargetSha256, applied.sourceTargetSha256);
  assert(applied.mutations.length >= 1);
  assert(applied.mutations.every((item) => item.section === 'RESTRANT'), 'node130-only benchmark must mutate only qualified RESTRANT fields');
  assert(applied.mutations.some((item) => item.field === 'Restraint typeCode' && item.proposed === 15));
  if (expectedBeforeFriction !== 0) {
    assert(applied.mutations.some((item) => item.field === 'Restraint friction' && item.before === expectedBeforeFriction && item.proposed === 0));
  } else {
    assert(!applied.mutations.some((item) => item.field === 'Restraint friction'), 'unchanged TARGET2 friction must not be rewritten');
  }

  await assert.rejects(
    () => applyCiiWorkspaceTargetWriter1A(approved, `${targetText}\n`, policy),
    /CII_WRITER_1A_STALE_TARGET_HASH/,
    'reviewed target bytes must be immutable between approval and Writer 1A apply',
  );
}

await restraintWriterCase(target1Text, 'BM_CII_TARGET1.CII', '20010', '20130', 5, 0.3);
await restraintWriterCase(target2Text, 'BM_CII_TARGET2.CII', '10010', '10130', 6, 0);
console.log('CII real TARGET1/TARGET2 Writer 1A restraint round-trip checks passed.');
