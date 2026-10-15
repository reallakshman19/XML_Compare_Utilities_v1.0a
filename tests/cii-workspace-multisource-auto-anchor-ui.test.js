import assert from 'node:assert/strict';
import { _test as uiTest } from '../tabs/cii-workspace/cii-workspace-multisource-writer2-ui.js';
import { CII_MS_TARGET_SHA256 } from '../tabs/cii-workspace/cii-workspace-multisource-nodename-authority.js';

function networkSuggestion(sourceNodeId, targetNodeId, confidence = 'HIGH', overrides = {}) {
  return {
    sourceNodeId: String(sourceNodeId),
    targetNodeId: String(targetNodeId),
    confidence,
    basisMethod: 'METHOD_B_NETWORK',
    winnerGap: 20,
    score: 90,
    methodB: { status: 'READY' },
    methodBWeight: { total: 80 },
    candidateGeneration: { mutualBest: true },
    ...overrides,
  };
}
function cryptoForHex(hex) {
  const digest = Uint8Array.from(hex.match(/../g) || [], (byte) => Number.parseInt(byte, 16));
  return { subtle: { async digest() { return digest.buffer.slice(digest.byteOffset, digest.byteOffset + digest.byteLength); } } };
}
function fakeFile(name = 'candidate-target.CII') {
  return { name, async arrayBuffer() { return Uint8Array.of(1, 2, 3).buffer; } };
}

const inspection = {
  memberInspections: [
    {
      sourceId: 'S1',
      inspection: { baseAnchorSuggestions: [networkSuggestion(10, 1010)] },
    },
    {
      sourceId: 'S2',
      inspection: {
        baseAnchorSuggestions: [
          networkSuggestion(20, 2020),
          networkSuggestion(21, 2021),
        ],
      },
    },
    {
      sourceId: 'S3',
      inspection: { baseAnchorSuggestions: [networkSuggestion(30, 3030, 'REVIEW')] },
    },
  ],
};

const seed = uiTest.buildAutomaticBaseSeed(inspection);
assert.deepEqual(seed.readySourceIds, ['S1']);
assert.deepEqual(seed.unresolvedSourceIds, ['S2', 'S3']);
assert.deepEqual(seed.selectionKeysBySource.S1, ['10=>1010']);
assert.deepEqual(seed.selectionKeysBySource.S2, []);
assert.deepEqual(seed.selectionKeysBySource.S3, []);
assert.equal(seed.choicesBySource.S1.status, 'READY');
assert.equal(seed.choicesBySource.S2.status, 'AMBIGUOUS');
assert.equal(seed.choicesBySource.S3.status, 'REVIEW_REQUIRED');

const retainedReady = {
  memberInspections: ['S1', 'S2', 'S3'].map((sourceId, index) => ({
    sourceId,
    inspection: { baseAnchorSuggestions: [networkSuggestion(index + 1, 1000 + index + 1, index === 1 ? 'HIGH' : 'MEDIUM')] },
  })),
};
const retainedSeed = uiTest.buildAutomaticBaseSeed(retainedReady);
assert.deepEqual(retainedSeed.readySourceIds, ['S1', 'S2', 'S3']);
assert.deepEqual(retainedSeed.unresolvedSourceIds, []);
assert.deepEqual(retainedSeed.selectionKeysBySource, {
  S1: ['1=>1001'],
  S2: ['2=>1002'],
  S3: ['3=>1003'],
});

const retainedTarget = await uiTest.retainedTargetInput(fakeFile('renamed-retained-target.CII'), cryptoForHex(CII_MS_TARGET_SHA256));
assert.equal(retainedTarget.fileName, 'renamed-retained-target.CII');
assert.equal(retainedTarget.originalSha256, CII_MS_TARGET_SHA256);
assert.deepEqual([...retainedTarget.bytes], [1, 2, 3]);
await assert.rejects(
  uiTest.retainedTargetInput(fakeFile('wrong-target.CII'), cryptoForHex('00'.repeat(32))),
  /requires the exact retained T\.CII target/,
);

console.log('CII Writer2 multi-source Auto Anchor and TARGET intake custody checks: PASS');
