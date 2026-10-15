import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge } from '../tabs/cii-workspace/cii-workspace-source-set.js';
import { ciiAutomaticBaseSelection } from '../tabs/cii-workspace/cii-workspace-base-loop-selection.js';
import {
  createCiiWriter2SourceSetPreviewFromPreparedSession,
  createCiiWriter2SourceSetPreviewWithVersionBridge,
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
function construction(trace) {
  return {
    targetNormalize: trace.count('TARGET_NORMALIZE'),
    targetIntake: trace.count('TARGET_INTAKE'),
    targetTopology: trace.count('TARGET_TOPOLOGY'),
    sourceNormalize: trace.count('SOURCE_NORMALIZE'),
    sourceIntake: trace.count('SOURCE_INTAKE'),
    sourceTopology: trace.count('SOURCE_TOPOLOGY'),
    commonAnalysis: trace.count('CII_COMMON_ANALYSIS'),
    writer2Projection: trace.count('CII_WRITER_PROJECTION_2'),
    writer1CProjection: trace.count('CII_WRITER_PROJECTION_1C'),
  };
}
function autoBaseLoops(inspection) {
  const loops = {};
  for (const member of inspection.memberInspections || []) {
    const choice = ciiAutomaticBaseSelection(member.inspection?.baseAnchorSuggestions || []);
    assert.equal(choice.status, 'READY', `${member.sourceId} automatic base must be READY: ${choice.reason}`);
    loops[member.sourceId] = choice.baseLoops;
  }
  return loops;
}
function memberCorrespondenceIdentity(preview) {
  return Object.fromEntries((preview.memberPreviews || []).map((member) => [
    member.sourceId,
    {
      writer2: member.preview.correspondence.correspondenceIdentity,
      writer1C: member.replacementPreview.correspondence.correspondenceIdentity,
      sameObjectWithinPreparedPath: member.preview.correspondence === member.replacementPreview.correspondence,
    },
  ]));
}

const inspectTrace = recorder();
const prepared = await prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge({
  sources,
  targetBytes,
  targetFileName: 'T.CII',
}, {
  cryptoRef,
  instrumentation: inspectTrace.instrumentation,
});

assert.deepEqual(construction(inspectTrace), {
  targetNormalize: 1,
  targetIntake: 1,
  targetTopology: 1,
  sourceNormalize: 3,
  sourceIntake: 3,
  sourceTopology: 3,
  commonAnalysis: 0,
  writer2Projection: 0,
  writer1CProjection: 0,
});

const baseLoopsBySource = autoBaseLoops(prepared.inspection);
const authorityInput = { baseLoopsBySource };

const preparedTrace = recorder();
const preparedPreview = await createCiiWriter2SourceSetPreviewFromPreparedSession(
  prepared.preparedSession,
  authorityInput,
  { cryptoRef, instrumentation: preparedTrace.instrumentation },
);

assert.deepEqual(construction(preparedTrace), {
  targetNormalize: 0,
  targetIntake: 0,
  targetTopology: 0,
  sourceNormalize: 0,
  sourceIntake: 0,
  sourceTopology: 0,
  commonAnalysis: 3,
  writer2Projection: 3,
  writer1CProjection: 3,
});

for (const member of preparedPreview.memberPreviews) {
  assert.strictEqual(
    member.preview.correspondence,
    member.replacementPreview.correspondence,
    `${member.sourceId} Writer2/Writer1C must project the same common correspondence object`,
  );
}

// Legacy raw-byte path remains available and serves as the semantic parity oracle.
const legacyTrace = recorder();
const legacyPreview = await createCiiWriter2SourceSetPreviewWithVersionBridge({
  sources,
  targetBytes,
  targetFileName: 'T.CII',
  baseLoopsBySource,
}, {
  cryptoRef,
  instrumentation: legacyTrace.instrumentation,
});

assert.deepEqual(construction(legacyTrace), {
  targetNormalize: 6,
  targetIntake: 6,
  targetTopology: 6,
  sourceNormalize: 6,
  sourceIntake: 6,
  sourceTopology: 6,
  commonAnalysis: 6,
  writer2Projection: 3,
  writer1CProjection: 3,
});

assert.deepEqual(preparedPreview.sourceSet, legacyPreview.sourceSet, 'prepared path must preserve public raw-custody source-set envelope');
assert.deepEqual(preparedPreview.correspondence, legacyPreview.correspondence, 'combined correspondence parity');
assert.deepEqual(preparedPreview.review, legacyPreview.review, 'review ledger parity');
assert.deepEqual(preparedPreview.engineeringDeltas, legacyPreview.engineeringDeltas, 'engineering delta parity');
assert.deepEqual(preparedPreview.compareReview, legacyPreview.compareReview, 'compare-review parity');
assert.deepEqual(preparedPreview.transferPlan, legacyPreview.transferPlan, 'mixed Writer1C/Writer2 transfer parity');
assert.deepEqual(preparedPreview.writerReadiness, legacyPreview.writerReadiness, 'Writer readiness parity');
assert.deepEqual(preparedPreview.versionBridge, legacyPreview.versionBridge, 'version-bridge parity');

const preparedIds = memberCorrespondenceIdentity(preparedPreview);
const legacyIds = memberCorrespondenceIdentity(legacyPreview);
for (const sourceId of ['S1', 'S2', 'S3']) {
  assert.equal(preparedIds[sourceId].writer2, legacyIds[sourceId].writer2, `${sourceId} Writer2 correspondence identity parity`);
  assert.equal(preparedIds[sourceId].writer1C, legacyIds[sourceId].writer1C, `${sourceId} Writer1C correspondence identity parity`);
  assert.equal(preparedIds[sourceId].sameObjectWithinPreparedPath, true);
}

assert.equal(preparedPreview.correspondence.status, legacyPreview.correspondence.status);
assert.equal(preparedPreview.correspondence.conflicts.length, legacyPreview.correspondence.conflicts.length);

console.log('CII prepared Writer2 multisource one-common-analysis parity checks: PASS');
