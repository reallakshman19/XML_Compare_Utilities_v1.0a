import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  CII_WORKSPACE_COMMON_ANALYSIS_SCHEMA,
  createCiiWorkspaceCommonAnalysis,
  createCiiWorkspacePreview,
  projectCiiWorkspacePreviewFromCommonAnalysis,
} from '../tabs/cii-workspace/cii-workspace-core.js';

const cryptoRef = globalThis.crypto || webcrypto;
const [sourceText, targetText] = await Promise.all([
  readFile(new URL('../Benchmark/CIICompare/BM_CII_SOURCE.CII', import.meta.url), 'utf8'),
  readFile(new URL('../Benchmark/CIICompare/BM_CII_TARGET1.CII', import.meta.url), 'utf8'),
]);

const input = {
  sourceText,
  sourceFileName: 'BM_CII_SOURCE.CII',
  targetText,
  targetFileName: 'BM_CII_TARGET1.CII',
  anchorPairs: [{ sourceNodeId: '10', targetNodeId: '20010' }],
};

const policy = {
  cryptoRef,
  spatialToleranceMm: 100,
  diameterToleranceRatio: 0.10,
  wallToleranceRatio: 0.10,
  identityWeight: 50,
  diameterWeight: 30,
  wallWeight: 30,
  winnerGap: 8,
};

function recorder() {
  const events = [];
  return {
    events,
    instrumentation: { record(event) { events.push(String(event)); } },
    count(event) { return events.filter((item) => item === event).length; },
  };
}

const trace = recorder();
const common = await createCiiWorkspaceCommonAnalysis(input, { ...policy, instrumentation: trace.instrumentation });
assert.equal(common.schema, CII_WORKSPACE_COMMON_ANALYSIS_SCHEMA);
assert.equal(trace.count('CII_COMMON_ANALYSIS'), 1);
assert(common.sourceDocument);
assert(common.targetDocument);
assert(common.sourceGraph);
assert(common.targetGraph);
assert(common.correspondence);
assert(common.baseEngineeringDeltas);

const writer2 = projectCiiWorkspacePreviewFromCommonAnalysis(common, input, {
  ...policy,
  writerVersion: '2',
  instrumentation: trace.instrumentation,
});
const writer1C = projectCiiWorkspacePreviewFromCommonAnalysis(common, input, {
  ...policy,
  writerVersion: '1C',
  allowNodeNameOverwrite: true,
  instrumentation: trace.instrumentation,
});

assert.strictEqual(writer2.correspondence, common.correspondence, 'Writer2 projection must reuse common correspondence object');
assert.strictEqual(writer1C.correspondence, common.correspondence, 'Writer1C projection must reuse common correspondence object');
assert.strictEqual(writer2.correspondence, writer1C.correspondence, 'Writer2 and Writer1C projections must share one correspondence');
assert.equal(writer2.writerVersion, '2');
assert.equal(writer1C.writerVersion, '1C');
assert.equal(trace.count('CII_COMMON_ANALYSIS'), 1, 'two writer projections must not rerun common analysis');
assert.equal(trace.count('CII_WRITER_PROJECTION_2'), 1);
assert.equal(trace.count('CII_WRITER_PROJECTION_1C'), 1);

// Legacy API remains a compatibility wrapper with the same public result.
const legacy2 = await createCiiWorkspacePreview(input, { ...policy, writerVersion: '2' });
const legacy1C = await createCiiWorkspacePreview(input, { ...policy, writerVersion: '1C', allowNodeNameOverwrite: true });
assert.deepEqual(writer2, legacy2, 'legacy Writer2 preview must equal direct common-analysis projection');
assert.deepEqual(writer1C, legacy1C, 'legacy Writer1C preview must equal direct common-analysis projection');

// Review reprojection must not mutate or recompute common analysis.
const accepted = writer2.compareReview.rows
  .filter((row) => row.identityBound && ['HIGH', 'MEDIUM'].includes(row.confidence))
  .map((row) => row.correspondenceId);
const reviewInput = {
  ...input,
  review: {
    reviewedCorrespondenceIds: accepted,
    lockedCorrespondenceIds: [],
    rejectedCorrespondenceIds: [],
  },
};
const reviewed2 = projectCiiWorkspacePreviewFromCommonAnalysis(common, reviewInput, {
  ...policy,
  writerVersion: '2',
  instrumentation: trace.instrumentation,
});
assert.strictEqual(reviewed2.correspondence, common.correspondence);
assert.equal(trace.count('CII_COMMON_ANALYSIS'), 1, 'review reprojection must not rerun common analysis');
assert.equal(trace.count('CII_WRITER_PROJECTION_2'), 2);

// Existing writer versions remain projectable from the same common analysis.
for (const version of ['1A', '1B']) {
  const projected = projectCiiWorkspacePreviewFromCommonAnalysis(common, input, { ...policy, writerVersion: version });
  assert.equal(projected.writerVersion, version);
  assert.strictEqual(projected.correspondence, common.correspondence);
}

// Invalid material must fail closed rather than silently reconstructing.
assert.throws(
  () => projectCiiWorkspacePreviewFromCommonAnalysis({}, input, { ...policy, writerVersion: '2' }),
  /CII_WORKSPACE_COMMON_ANALYSIS_REQUIRED/,
);

console.log('CII common-analysis / writer-projection split checks: PASS');
