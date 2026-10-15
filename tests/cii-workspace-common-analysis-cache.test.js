import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge } from '../tabs/cii-workspace/cii-workspace-source-set.js';
import { ciiAutomaticBaseSelection } from '../tabs/cii-workspace/cii-workspace-base-loop-selection.js';
import {
  createCiiCommonAnalysisCache,
  createCiiWriter2SourceSetPreviewFromPreparedSession,
} from '../tabs/cii-workspace/cii-workspace-multisource-preview.js';

const cryptoRef = globalThis.crypto || webcrypto;
const benchmark = (name) => fileURLToPath(new URL(`../Benchmark/${name}`, import.meta.url));
const sourceNames = ['S1.CII', 'S2.CII', 'S3.CII'];
const sources = sourceNames.map((fileName, index) => ({
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
function cacheKeys(cache) {
  return [...cache.entries.keys()].sort();
}
async function preparedRun(preparedSession, input, cache, trace) {
  return createCiiWriter2SourceSetPreviewFromPreparedSession(
    preparedSession,
    input,
    { cryptoRef, commonAnalysisCache: cache, instrumentation: trace.instrumentation },
  );
}

const prepared = await prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge({
  sources,
  targetBytes,
  targetFileName: 'T.CII',
}, { cryptoRef });
const baseLoopsBySource = autoBaseLoops(prepared.inspection);
const authorityInput = { baseLoopsBySource };
const cache = createCiiCommonAnalysisCache();

// First prepared Compare: one common analysis per member, zero model reconstruction.
const firstTrace = recorder();
const first = await preparedRun(prepared.preparedSession, authorityInput, cache, firstTrace);
assert.deepEqual(counts(firstTrace), {
  sourceNormalize: 0, sourceIntake: 0, sourceTopology: 0,
  targetNormalize: 0, targetIntake: 0, targetTopology: 0,
  commonAnalysis: 3,
  writer2Projection: 3,
  writer1CProjection: 3,
  cacheHit: 0,
  cacheMiss: 3,
  cacheReset: 0,
});
assert.equal(cache.entries.size, 3);
assert.deepEqual(cacheKeys(cache), ['S1', 'S2', 'S3']);
assert(cache.sessionIdentity);

// Identical repeat: all common analyses are reused, projections still run.
const repeatTrace = recorder();
const repeat = await preparedRun(prepared.preparedSession, authorityInput, cache, repeatTrace);
assert.deepEqual(counts(repeatTrace), {
  sourceNormalize: 0, sourceIntake: 0, sourceTopology: 0,
  targetNormalize: 0, targetIntake: 0, targetTopology: 0,
  commonAnalysis: 0,
  writer2Projection: 3,
  writer1CProjection: 3,
  cacheHit: 3,
  cacheMiss: 0,
  cacheReset: 0,
});
assert.equal(cache.entries.size, 3);
assert.deepEqual(repeat.correspondence, first.correspondence);
assert.deepEqual(repeat.engineeringDeltas, first.engineeringDeltas);
assert.deepEqual(repeat.transferPlan, first.transferPlan);
assert.deepEqual(repeat.writerReadiness, first.writerReadiness);

// Review-only rebind: authority key remains stable and common analysis is reused.
const s1Member = first.memberPreviews.find((member) => member.sourceId === 'S1');
const reviewCandidate = s1Member?.preview?.compareReview?.rows?.find(
  (row) => row.identityBound && ['HIGH', 'MEDIUM'].includes(row.confidence),
);
assert(reviewCandidate?.correspondenceId, 'retained S1 must expose a reviewable identity-bound row');
const reviewInput = {
  baseLoopsBySource,
  reviewBySource: {
    S1: {
      reviewedCorrespondenceIds: [reviewCandidate.correspondenceId],
      lockedCorrespondenceIds: [],
      rejectedCorrespondenceIds: [],
    },
  },
};
const reviewTrace = recorder();
await preparedRun(prepared.preparedSession, reviewInput, cache, reviewTrace);
assert.deepEqual(counts(reviewTrace), {
  sourceNormalize: 0, sourceIntake: 0, sourceTopology: 0,
  targetNormalize: 0, targetIntake: 0, targetTopology: 0,
  commonAnalysis: 0,
  writer2Projection: 3,
  writer1CProjection: 3,
  cacheHit: 3,
  cacheMiss: 0,
  cacheReset: 0,
});
assert.equal(cache.entries.size, 3);

// Change only S1 explicit base identity. One member is replaced; history does not accumulate.
const changedS1 = baseLoopsBySource.S1.map((loop, index) =>
  index === 0 ? { ...loop, baseId: `${loop.baseId}-CACHE-REFRESH` } : loop);
const changedAuthority = {
  baseLoopsBySource: {
    ...baseLoopsBySource,
    S1: changedS1,
  },
};
const changedTrace = recorder();
await preparedRun(prepared.preparedSession, changedAuthority, cache, changedTrace);
assert.deepEqual(counts(changedTrace), {
  sourceNormalize: 0, sourceIntake: 0, sourceTopology: 0,
  targetNormalize: 0, targetIntake: 0, targetTopology: 0,
  commonAnalysis: 1,
  writer2Projection: 3,
  writer1CProjection: 3,
  cacheHit: 2,
  cacheMiss: 1,
  cacheReset: 0,
});
assert.equal(cache.entries.size, 3, 'changed authority must replace S1 entry, not append history');
assert.deepEqual(cacheKeys(cache), ['S1', 'S2', 'S3']);

// Simulate a different prepared-session custody identity. The next call must clear
// every old member entry before lookup and rebuild all three.
cache.sessionIdentity = 'stale-prepared-session-identity';
const resetTrace = recorder();
await preparedRun(prepared.preparedSession, authorityInput, cache, resetTrace);
assert.deepEqual(counts(resetTrace), {
  sourceNormalize: 0, sourceIntake: 0, sourceTopology: 0,
  targetNormalize: 0, targetIntake: 0, targetTopology: 0,
  commonAnalysis: 3,
  writer2Projection: 3,
  writer1CProjection: 3,
  cacheHit: 0,
  cacheMiss: 3,
  cacheReset: 1,
});
assert.equal(cache.entries.size, 3);

// Malformed external cache objects fail closed.
await assert.rejects(
  () => createCiiWriter2SourceSetPreviewFromPreparedSession(
    prepared.preparedSession,
    authorityInput,
    { cryptoRef, commonAnalysisCache: { schema: 'wrong', entries: new Map() } },
  ),
  /CII_COMMON_ANALYSIS_CACHE_REQUIRED/,
);

console.log('CII bounded ephemeral common-analysis cache checks: PASS');
