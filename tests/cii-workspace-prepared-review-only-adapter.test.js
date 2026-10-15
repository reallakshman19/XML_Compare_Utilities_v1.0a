import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge } from '../tabs/cii-workspace/cii-workspace-source-set.js';
import { ciiAutomaticBaseSelection } from '../tabs/cii-workspace/cii-workspace-base-loop-selection.js';
import { createCiiCommonAnalysisCache } from '../tabs/cii-workspace/cii-workspace-multisource-preview.js';
import {
  createPreparedReviewOnlyMemberPreviews,
} from '../tabs/cii-workspace/cii-workspace-multisource-review-only-prepared.js';

const cryptoRef = globalThis.crypto || webcrypto;
const benchmark = (name) => fileURLToPath(new URL(`../Benchmark/${name}`, import.meta.url));
const sources = ['S1.CII', 'S2.CII', 'S3.CII'].map((fileName, index) => ({
  sourceId: `S${index + 1}`,
  fileName,
  bytes: readFileSync(benchmark(fileName)),
}));
const targetBytes = readFileSync(benchmark('T.CII'));

function recorder() {
  const events = [];
  return {
    events,
    instrumentation: {
      record(event, value) {
        events.push({ event: String(event), value: Number.isFinite(Number(value)) ? Number(value) : null });
      },
    },
    count(event) { return events.filter((row) => row.event === event).length; },
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
    cacheReset: trace.count('CII_COMMON_ANALYSIS_CACHE_RESET'),
  };
}
function autoBaseLoops(inspection) {
  const result = {};
  for (const member of inspection.memberInspections || []) {
    const choice = ciiAutomaticBaseSelection(member.inspection?.baseAnchorSuggestions || []);
    assert.equal(choice.status, 'READY', `${member.sourceId} automatic base must be READY`);
    result[member.sourceId] = choice.baseLoops;
  }
  return result;
}
async function run(preparedSession, input, cache, trace) {
  return createPreparedReviewOnlyMemberPreviews(preparedSession, input, {
    cryptoRef,
    commonAnalysisCache: cache,
    instrumentation: trace.instrumentation,
  });
}

const prepared = await prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge({
  sources,
  targetBytes,
  targetFileName: 'T.CII',
}, { cryptoRef });
const baseLoopsBySource = autoBaseLoops(prepared.inspection);
const input = { baseLoopsBySource };
const cache = createCiiCommonAnalysisCache();

const firstTrace = recorder();
const first = await run(prepared.preparedSession, input, cache, firstTrace);
assert.deepEqual(counts(firstTrace), {
  sourceNormalize: 0, sourceIntake: 0, sourceTopology: 0,
  targetNormalize: 0, targetIntake: 0, targetTopology: 0,
  commonAnalysis: 3,
  writer2Projection: 3,
  writer1CProjection: 0,
  cacheHit: 0,
  cacheMiss: 3,
  cacheReset: 0,
});
assert.equal(first.memberPreviews.length, 3);
assert.deepEqual(first.sources.map((row) => row.sourceId), ['S1', 'S2', 'S3']);
assert.equal(Object.hasOwn(first, 'transferPlan'), false, 'adapter must not expose aggregate write authority');
assert.equal(Object.hasOwn(first, 'writerReadiness'), false, 'adapter must not expose aggregate writer authority');
assert.equal(cache.entries.size, 3);

for (const member of first.memberPreviews) {
  assert(member.preview.correspondence);
  assert(member.preview.engineeringDeltas);
  assert(member.preview.compareReview);
  assert(member.preview.versionBridge?.source?.originalSha256);
  assert(member.preview.versionBridge?.target?.originalSha256);
}

const repeatTrace = recorder();
const repeat = await run(prepared.preparedSession, input, cache, repeatTrace);
assert.deepEqual(counts(repeatTrace), {
  sourceNormalize: 0, sourceIntake: 0, sourceTopology: 0,
  targetNormalize: 0, targetIntake: 0, targetTopology: 0,
  commonAnalysis: 0,
  writer2Projection: 3,
  writer1CProjection: 0,
  cacheHit: 3,
  cacheMiss: 0,
  cacheReset: 0,
});
assert.equal(cache.entries.size, 3);
for (let index = 0; index < 3; index += 1) {
  assert.deepEqual(repeat.memberPreviews[index].preview.correspondence, first.memberPreviews[index].preview.correspondence);
}

const reviewCandidate = first.memberPreviews[0].preview.compareReview.rows.find(
  (row) => row.identityBound && ['HIGH', 'MEDIUM'].includes(row.confidence),
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
  commonAnalysis: 0,
  writer2Projection: 3,
  writer1CProjection: 0,
  cacheHit: 3,
  cacheMiss: 0,
  cacheReset: 0,
});

// Change only S1 base identity: exactly one common analysis is replaced.
const changedS1 = baseLoopsBySource.S1.map((loop, index) =>
  index === 0 ? { ...loop, baseId: `${loop.baseId}-REVIEW-CACHE-REFRESH` } : loop);
const changedTrace = recorder();
await run(prepared.preparedSession, {
  baseLoopsBySource: { ...baseLoopsBySource, S1: changedS1 },
}, cache, changedTrace);
assert.deepEqual(counts(changedTrace), {
  sourceNormalize: 0, sourceIntake: 0, sourceTopology: 0,
  targetNormalize: 0, targetIntake: 0, targetTopology: 0,
  commonAnalysis: 1,
  writer2Projection: 3,
  writer1CProjection: 0,
  cacheHit: 2,
  cacheMiss: 1,
  cacheReset: 0,
});
assert.equal(cache.entries.size, 3);

// Stale session identity forces whole-cache reset before lookup.
cache.sessionIdentity = 'stale-session';
const resetTrace = recorder();
await run(prepared.preparedSession, input, cache, resetTrace);
assert.deepEqual(counts(resetTrace), {
  sourceNormalize: 0, sourceIntake: 0, sourceTopology: 0,
  targetNormalize: 0, targetIntake: 0, targetTopology: 0,
  commonAnalysis: 3,
  writer2Projection: 3,
  writer1CProjection: 0,
  cacheHit: 0,
  cacheMiss: 3,
  cacheReset: 1,
});
assert.equal(cache.entries.size, 3);

await assert.rejects(
  () => createPreparedReviewOnlyMemberPreviews(prepared.preparedSession, input, {
    cryptoRef,
    commonAnalysisCache: { schema: 'wrong', entries: new Map() },
  }),
  /COMMON_ANALYSIS_CACHE_REQUIRED/,
);

const badSession = { ...prepared.preparedSession, status: 'INVALID' };
await assert.rejects(
  () => createPreparedReviewOnlyMemberPreviews(badSession, input, { cryptoRef }),
  /PREPARED_SESSION_REQUIRED/,
);

const moduleSource = readFileSync(
  fileURLToPath(new URL('../tabs/cii-workspace/cii-workspace-multisource-review-only-prepared.js', import.meta.url)),
  'utf8',
);
assert(!moduleSource.includes('assertCiiMsBm001Authority'));
assert(!moduleSource.includes('createCiiWriter2SourceSetPreview'));
assert(!moduleSource.includes('writerVersion: \'1C\''));

console.log('CII prepared review-only member adapter cache/custody checks: PASS');
