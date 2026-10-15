import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge } from '../tabs/cii-workspace/cii-workspace-source-set.js';
import { ciiAutomaticBaseSelection } from '../tabs/cii-workspace/cii-workspace-base-loop-selection.js';
import { createCiiCommonAnalysisCache } from '../tabs/cii-workspace/cii-workspace-multisource-preview.js';
import {
  CII_MS_REVIEW_ONLY_WRITE_BLOCKER,
  createCiiMultiSourceReviewOnlyPreviewFromPreparedSession,
} from '../tabs/cii-workspace/cii-workspace-multisource-review-only.js';
import { _test as routerTest } from '../tabs/cii-workspace/cii-workspace-multisource-review-only-router.js';

const cryptoRef = globalThis.crypto || webcrypto;
const benchmark = (name) => fileURLToPath(new URL(`../Benchmark/${name}`, import.meta.url));
const sourceNames = ['S1.CII', 'S2.CII'];
const sourceBytes = sourceNames.map((name) => readFileSync(benchmark(name)));
const targetBytes = readFileSync(benchmark('T.CII'));
const sources = sourceNames.map((fileName, index) => ({
  sourceId: `S${index + 1}`,
  fileName,
  bytes: sourceBytes[index],
}));

function fileLike(name, bytes) {
  return Object.freeze({
    name,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  });
}
function recorder() {
  const events = [];
  return {
    instrumentation: {
      record(event) { events.push(String(event)); },
    },
    count(event) { return events.filter((item) => item === event).length; },
  };
}
function counts(trace) {
  return {
    sourceNormalize: trace.count('SOURCE_NORMALIZE'),
    sourceIntake: trace.count('SOURCE_INTAKE'),
    sourceTopology: trace.count('SOURCE_TOPOLOGY'),
    targetNormalize: trace.count('TARGET_NORMALIZE'),
    targetIntake: trace.count('TARGET_INTAKE'),
    targetTopology: trace.count('TARGET_TOPOLOGY'),
    commonAnalysis: trace.count('CII_COMMON_ANALYSIS'),
    writer2Projection: trace.count('CII_WRITER_PROJECTION_2'),
    writer1CProjection: trace.count('CII_WRITER_PROJECTION_1C'),
    cacheHit: trace.count('CII_COMMON_ANALYSIS_CACHE_HIT'),
    cacheMiss: trace.count('CII_COMMON_ANALYSIS_CACHE_MISS'),
  };
}
function baseLoops(inspection) {
  const result = {};
  for (const member of inspection.memberInspections || []) {
    const choice = ciiAutomaticBaseSelection(member.inspection?.baseAnchorSuggestions || []);
    assert.equal(choice.status, 'READY', `${member.sourceId} automatic base must be READY`);
    result[member.sourceId] = choice.baseLoops;
  }
  return result;
}
async function run(preparedSession, input, cache, trace) {
  return createCiiMultiSourceReviewOnlyPreviewFromPreparedSession(preparedSession, input, {
    cryptoRef,
    commonAnalysisCache: cache,
    instrumentation: trace.instrumentation,
  });
}

const genericClassification = await routerTest.classifyMultiSourceFiles(
  [fileLike('generic-A.CII', sourceBytes[0]), fileLike('generic-B.CII', sourceBytes[1])],
  fileLike('generic-target.CII', targetBytes),
  cryptoRef,
);
assert.equal(genericClassification.retained, false, 'two-source custody must remain on generic REVIEW_ONLY routing');

const prepared = await prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge({
  sources,
  targetBytes,
  targetFileName: 'T.CII',
}, { cryptoRef });
const baseLoopsBySource = baseLoops(prepared.inspection);
const cache = createCiiCommonAnalysisCache();

const firstTrace = recorder();
const first = await run(prepared.preparedSession, { baseLoopsBySource }, cache, firstTrace);
assert.deepEqual(counts(firstTrace), {
  sourceNormalize: 0, sourceIntake: 0, sourceTopology: 0,
  targetNormalize: 0, targetIntake: 0, targetTopology: 0,
  commonAnalysis: 2, writer2Projection: 2, writer1CProjection: 0,
  cacheHit: 0, cacheMiss: 2,
});
assert.equal(first.mode, 'REVIEW_ONLY');
assert.equal(first.transferPlan.mutationAuthority, 'BLOCKED');
assert.deepEqual(first.transferPlan.operations, []);
assert.deepEqual(first.transferPlan.blockers, [CII_MS_REVIEW_ONLY_WRITE_BLOCKER]);
assert.equal(first.writerReadiness.ready, false);

const repeatTrace = recorder();
await run(prepared.preparedSession, { baseLoopsBySource }, cache, repeatTrace);
assert.deepEqual(counts(repeatTrace), {
  sourceNormalize: 0, sourceIntake: 0, sourceTopology: 0,
  targetNormalize: 0, targetIntake: 0, targetTopology: 0,
  commonAnalysis: 0, writer2Projection: 2, writer1CProjection: 0,
  cacheHit: 2, cacheMiss: 0,
});

const reviewCandidate = first.compareReview.rows.find(
  (row) => row.sourceId === 'S1' && row.identityBound && ['HIGH', 'MEDIUM'].includes(row.confidence),
);
assert(reviewCandidate?.correspondenceId);
const reviewTrace = recorder();
await run(prepared.preparedSession, {
  baseLoopsBySource,
  reviewBySource: {
    S1: {
      reviewedCorrespondenceIds: [reviewCandidate.correspondenceId],
      lockedCorrespondenceIds: [],
      rejectedCorrespondenceIds: [],
    },
  },
}, cache, reviewTrace);
assert.deepEqual(counts(reviewTrace), {
  sourceNormalize: 0, sourceIntake: 0, sourceTopology: 0,
  targetNormalize: 0, targetIntake: 0, targetTopology: 0,
  commonAnalysis: 0, writer2Projection: 2, writer1CProjection: 0,
  cacheHit: 2, cacheMiss: 0,
});

const changedS1 = baseLoopsBySource.S1.map((loop, index) =>
  index === 0 ? { ...loop, baseId: `${loop.baseId}-ROUTER-REFRESH` } : loop);
const changeTrace = recorder();
await run(prepared.preparedSession, {
  baseLoopsBySource: { ...baseLoopsBySource, S1: changedS1 },
}, cache, changeTrace);
assert.deepEqual(counts(changeTrace), {
  sourceNormalize: 0, sourceIntake: 0, sourceTopology: 0,
  targetNormalize: 0, targetIntake: 0, targetTopology: 0,
  commonAnalysis: 1, writer2Projection: 2, writer1CProjection: 0,
  cacheHit: 1, cacheMiss: 1,
});

const routerSource = readFileSync(
  fileURLToPath(new URL('../tabs/cii-workspace/cii-workspace-multisource-review-only-router.js', import.meta.url)),
  'utf8',
);
assert(routerSource.split('\n').length < 300);
assert(routerSource.includes('prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge'));
assert(routerSource.includes('createCiiCommonAnalysisCache()'));
assert(routerSource.includes('createCiiMultiSourceReviewOnlyPreviewFromPreparedSession(state.preparedSession'));
assert(routerSource.includes('commonAnalysisCache: state.commonAnalysisCache'));
assert(!routerSource.includes('createCiiMultiSourceReviewOnlyPreviewWithVersionBridge'));
assert(routerSource.includes('mountCiiWriter2MultiSourceShell'), 'retained exact route must remain delegated');
assert(routerSource.includes('if (classified.retained) { state = null; bypassRetainedInspect = true; inspectButton.click(); return; }'));
assert(routerSource.includes('resetGeneric(); retainedDestroy?.();'), 'destroy must drop generic prepared/cache state');
assert(!routerSource.includes('applyCiiWorkspaceTargetWriter2'), 'generic route must remain zero-write');

console.log('CII generic review-only router prepared-session/cache wiring checks: PASS');
