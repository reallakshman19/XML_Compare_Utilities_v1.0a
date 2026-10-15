import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  CII_PREPARED_SOURCE_SET_SESSION_SCHEMA,
  inspectCiiWorkspaceSourceSetWithVersionBridge,
  prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge,
} from '../tabs/cii-workspace/cii-workspace-source-set.js';
import { createCiiWorkspaceCommonAnalysis } from '../tabs/cii-workspace/cii-workspace-core.js';
import { inspectCiiWorkspaceModelsWithVersionBridge } from '../tabs/cii-workspace/cii-workspace-writer-version-bridge.js';

const cryptoRef = globalThis.crypto || webcrypto;
const fixture = await readFile(new URL('../Benchmark/Pipeline/CII', import.meta.url), 'utf8');
const sources = ['S1', 'S2', 'S3'].map((sourceId) => Object.freeze({
  sourceId,
  fileName: sourceId + '.CII',
  text: fixture,
}));

function recorder() {
  const counts = Object.create(null);
  return {
    counts,
    instrumentation: {
      record(event) {
        counts[event] = (counts[event] || 0) + 1;
      },
    },
  };
}
function count(trace, event) { return trace.counts[event] || 0; }

const trace = recorder();
const prepared = await prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge({
  sources,
  targetText: fixture,
  targetFileName: 'T.CII',
}, { cryptoRef, instrumentation: trace.instrumentation });

assert.equal(prepared.preparedSession.schema, CII_PREPARED_SOURCE_SET_SESSION_SCHEMA);
assert.equal(prepared.preparedSession.status, 'PREPARED');
assert.equal(prepared.preparedSession.authority, 'IMMUTABLE_NORMALIZED_MODEL_CUSTODY');
assert.equal(prepared.preparedSession.sourceSetSha256, prepared.inspection.sourceSet.sourceSetSha256);
assert.equal(prepared.preparedSession.members.length, 3);
assert(Object.isFrozen(prepared.preparedSession));
assert(Object.isFrozen(prepared.preparedSession.members));
assert(Object.isFrozen(prepared.preparedSession.target));
for (const member of prepared.preparedSession.members) assert(Object.isFrozen(member));

assert.equal(count(trace, 'TARGET_NORMALIZE'), 1);
assert.equal(count(trace, 'TARGET_INTAKE'), 1);
assert.equal(count(trace, 'TARGET_TOPOLOGY'), 1);
assert.equal(count(trace, 'SOURCE_NORMALIZE'), 3);
assert.equal(count(trace, 'SOURCE_INTAKE'), 3);
assert.equal(count(trace, 'SOURCE_TOPOLOGY'), 3);

for (let index = 0; index < prepared.preparedSession.members.length; index += 1) {
  const member = prepared.preparedSession.members[index];
  const inspected = prepared.inspection.memberInspections[index].inspection;
  assert.equal(member.sourceId, prepared.inspection.memberInspections[index].sourceId);
  assert.equal(member.originalSha256, inspected.versionBridge.source.originalSha256);
  assert.equal(member.normalizedSha256, inspected.versionBridge.source.normalizedSha256);
  assert.equal(member.sourceDocument.contentSha256, member.normalizedSha256);
  assert(member.sourceGraph);
}
assert.equal(
  prepared.preparedSession.target.targetDocument.contentSha256,
  prepared.preparedSession.target.normalizedSha256,
);
assert.equal(
  prepared.preparedSession.target.normalizedSha256,
  prepared.inspection.versionBridge.target.normalizedSha256,
);

// The legacy public API remains inspection-only.
const legacy = await inspectCiiWorkspaceSourceSetWithVersionBridge({
  sources,
  targetText: fixture,
  targetFileName: 'T.CII',
}, { cryptoRef });
assert.equal(legacy.schema, prepared.inspection.schema);
assert.equal(legacy.status, prepared.inspection.status);
assert.equal(legacy.sourceSet.sourceSetSha256, prepared.inspection.sourceSet.sourceSetSha256);
assert.deepEqual(legacy.baseAnchorSuggestionsBySource, prepared.inspection.baseAnchorSuggestionsBySource);
assert.equal(Object.hasOwn(legacy, 'preparedSession'), false);

// Pair-oriented parity remains exact when the pair API is evaluated under the
// same source-set search/display policy. The historical shared-target test
// omitted baseAnchorDisplayLimit and therefore compares source-set top-5 to
// legacy-pair default top-8.
for (let index = 0; index < sources.length; index += 1) {
  const source = sources[index];
  const pair = await inspectCiiWorkspaceModelsWithVersionBridge({
    sourceText: source.text,
    sourceFileName: source.fileName,
    targetText: fixture,
    targetFileName: 'T.CII',
  }, {
    cryptoRef,
    writerVersion: '2',
    methodAPhysicalCandidateLimit: 10,
    baseAnchorDisplayLimit: 5,
  });
  assert.deepEqual(
    prepared.inspection.memberInspections[index].inspection.source,
    pair.source,
    source.sourceId + ': prepared SOURCE inspection must match pair API',
  );
  assert.deepEqual(
    prepared.inspection.memberInspections[index].inspection.target,
    pair.target,
    source.sourceId + ': prepared TARGET inspection must match pair API',
  );
  assert.deepEqual(
    prepared.inspection.memberInspections[index].inspection.baseAnchorSuggestions,
    pair.baseAnchorSuggestions,
    source.sourceId + ': prepared anchor suggestions must match pair API under identical limits',
  );
}

// Later common analysis can consume retained SOURCE+TARGET models without
// another intake/topology construction.
const member = prepared.preparedSession.members[0];
const reuseTrace = recorder();
const common = await createCiiWorkspaceCommonAnalysis({
  anchorPairs: [{ sourceNodeId: '1', targetNodeId: '1' }],
}, {
  cryptoRef,
  instrumentation: reuseTrace.instrumentation,
}, {
  sourceDocument: member.sourceDocument,
  sourceGraph: member.sourceGraph,
  targetDocument: prepared.preparedSession.target.targetDocument,
  targetGraph: prepared.preparedSession.target.targetGraph,
});

assert(common.sourceDocument === member.sourceDocument);
assert(common.targetDocument === prepared.preparedSession.target.targetDocument);
assert.equal(count(reuseTrace, 'SOURCE_INTAKE'), 0);
assert.equal(count(reuseTrace, 'SOURCE_TOPOLOGY'), 0);
assert.equal(count(reuseTrace, 'TARGET_INTAKE'), 0);
assert.equal(count(reuseTrace, 'TARGET_TOPOLOGY'), 0);
assert.equal(count(reuseTrace, 'CII_COMMON_ANALYSIS'), 1);

console.log('CII prepared source-set session custody + zero-reconstruction reuse checks: PASS');
