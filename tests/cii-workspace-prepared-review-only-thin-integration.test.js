import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createCiiMultiSourceReviewOnlyPreviewFromPreparedSession,
  createCiiMultiSourceReviewOnlyPreviewWithVersionBridge,
  CII_MS_REVIEW_ONLY_WRITE_BLOCKER,
} from '../tabs/cii-workspace/cii-workspace-multisource-review-only.js';
import { prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge } from '../tabs/cii-workspace/cii-workspace-source-set.js';
import { ciiAutomaticBaseSelection } from '../tabs/cii-workspace/cii-workspace-base-loop-selection.js';
import { createCiiCommonAnalysisCache } from '../tabs/cii-workspace/cii-workspace-multisource-preview.js';

const cryptoRef = globalThis.crypto || webcrypto;
const benchmark = (name) => fileURLToPath(new URL(`../Benchmark/${name}`, import.meta.url));
const sources = ['S1.CII', 'S2.CII', 'S3.CII'].map((fileName, index) => ({
  sourceId: `S${index + 1}`,
  fileName,
  bytes: readFileSync(benchmark(fileName)),
}));
const targetBytes = readFileSync(benchmark('T.CII'));

function automaticLoops(inspection) {
  const result = {};
  for (const member of inspection.memberInspections || []) {
    const choice = ciiAutomaticBaseSelection(member.inspection?.baseAnchorSuggestions || []);
    assert.equal(choice.status, 'READY', `${member.sourceId} automatic base must be READY`);
    result[member.sourceId] = choice.baseLoops;
  }
  return result;
}
function semanticSurface(result) {
  return {
    schema: result.schema,
    mode: result.mode,
    writerVersion: result.writerVersion,
    sourceSet: result.sourceSet,
    sourceSetSha256: result.sourceSetSha256,
    targetAuthority: result.targetAuthority,
    correspondence: result.correspondence,
    review: result.review,
    engineeringDeltas: result.engineeringDeltas,
    compareReview: result.compareReview,
    transferPlan: result.transferPlan,
    writerReadiness: result.writerReadiness,
    versionBridge: result.versionBridge,
    audit: result.audit,
  };
}
function recorder() {
  const events = [];
  return {
    events,
    instrumentation: {
      record(event) { events.push(String(event)); },
    },
    count(event) { return events.filter((item) => item === event).length; },
  };
}

const prepared = await prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge({
  sources,
  targetBytes,
  targetFileName: 'T.CII',
}, { cryptoRef });
const baseLoopsBySource = automaticLoops(prepared.inspection);

const legacy = await createCiiMultiSourceReviewOnlyPreviewWithVersionBridge({
  sources,
  targetBytes,
  targetFileName: 'T.CII',
  baseLoopsBySource,
}, { cryptoRef });

const trace = recorder();
const cache = createCiiCommonAnalysisCache();
const preparedResult = await createCiiMultiSourceReviewOnlyPreviewFromPreparedSession(
  prepared.preparedSession,
  { baseLoopsBySource },
  { cryptoRef, commonAnalysisCache: cache, instrumentation: trace.instrumentation },
);

assert.deepEqual(
  semanticSurface(preparedResult),
  semanticSurface(legacy),
  'prepared review-only entrypoint must preserve legacy review-only aggregation semantics',
);

assert.equal(trace.count('SOURCE_NORMALIZE'), 0);
assert.equal(trace.count('SOURCE_INTAKE'), 0);
assert.equal(trace.count('SOURCE_TOPOLOGY'), 0);
assert.equal(trace.count('TARGET_NORMALIZE'), 0);
assert.equal(trace.count('TARGET_INTAKE'), 0);
assert.equal(trace.count('TARGET_TOPOLOGY'), 0);
assert.equal(trace.count('CII_COMMON_ANALYSIS'), 3);
assert.equal(trace.count('CII_COMMON_ANALYSIS_CACHE_MISS'), 3);
assert.equal(trace.count('CII_WRITER_PROJECTION_2'), 3);
assert.equal(trace.count('CII_WRITER_PROJECTION_1C'), 0);

assert.equal(preparedResult.mode, 'REVIEW_ONLY');
assert.equal(preparedResult.transferPlan.mutationAuthority, 'BLOCKED');
assert.deepEqual(preparedResult.transferPlan.operations, []);
assert.deepEqual(preparedResult.transferPlan.blockers, [CII_MS_REVIEW_ONLY_WRITE_BLOCKER]);
assert.equal(preparedResult.writerReadiness.ready, false);
assert.deepEqual(preparedResult.writerReadiness.blockers, [CII_MS_REVIEW_ONLY_WRITE_BLOCKER]);

const moduleSource = readFileSync(
  fileURLToPath(new URL('../tabs/cii-workspace/cii-workspace-multisource-review-only.js', import.meta.url)),
  'utf8',
);
assert(moduleSource.split('\n').length < 300, 'review-only core must remain below 300 lines');
assert(moduleSource.includes('createPreparedReviewOnlyMemberPreviews'));
assert(!moduleSource.includes('assertCiiMsBm001Authority'));
assert(!moduleSource.includes('writerVersion: \'1C\''));
assert(!moduleSource.includes('createCiiWriter2SourceSetPreview'));

console.log('CII prepared review-only thin integration parity checks: PASS');
