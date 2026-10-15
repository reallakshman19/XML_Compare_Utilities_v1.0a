import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  assertBmW200IdentityPostimage,
  buildBmW200ExpectedPostimage,
} from '../Benchmark/CIICompare/Writer2/cii-writer2-benchmark-identity-oracle.js';
import { intakeCiiWorkspaceDocument } from '../tabs/cii-workspace/cii-workspace-intake.js';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import {
  inspectCiiWorkspaceModelsWithVersionBridge,
} from '../tabs/cii-workspace/cii-workspace-writer-version-bridge.js';
import {
  applyCiiWriter2CompositePlanContract,
  ciiWriter2CompositeReadiness,
} from '../tabs/cii-workspace/cii-workspace-writer2-composite-routing.js';

const SOURCE_GIT_BLOB = 'e41cd05603b56837cbb6e31b9d4074ef6106fe9b';

function gitBlobSha1(bytes) {
  const buffer = Buffer.from(bytes);
  return createHash('sha1')
    .update(Buffer.from(`blob ${buffer.byteLength}\0`, 'utf8'))
    .update(buffer)
    .digest('hex');
}

function connectivity(graph) {
  return (graph?.edges || []).map((edge) => [String(edge.elementId), String(edge.from), String(edge.to)]);
}

function zeroMutationPlan(document) {
  return Object.freeze({
    schema: 'CIIWorkspaceTransferPlan.v1',
    direction: 'SOURCE_TO_TARGET',
    status: 'PREVIEW_READY',
    mutationAuthority: 'WRITER_2_COMPOSITE_CONDITIONAL',
    blockers: Object.freeze([]),
    sourceDocument: Object.freeze({ fileName: document.fileName, contentSha256: document.contentSha256 }),
    targetDocument: Object.freeze({ fileName: document.fileName, contentSha256: document.contentSha256 }),
    operations: Object.freeze([]),
    excludedOperations: Object.freeze([]),
    transferScope: Object.freeze({
      schema: 'CIIWorkspaceTransferScope.v1',
      mode: 'EXPLICIT_APPLY_EXCLUDE',
      status: 'BOUND',
      authority: 'USER_EXPLICIT_OPERATION_SCOPE',
      scopeId: 'BM-W2-00-IDENTITY-NO-MUTATION',
      sourceSha256: document.contentSha256,
      targetSha256: document.contentSha256,
      candidateOperationIds: Object.freeze([]),
      appliedOperationIds: Object.freeze([]),
      excludedOperationIds: Object.freeze([]),
      appliedOperationCount: 0,
      excludedOperationCount: 0,
    }),
    summary: Object.freeze({ operationCount: 0, previewReadyCount: 0, blockedCount: 0, protectedCount: 0, byAction: Object.freeze({}) }),
  });
}

const fixture = new Uint8Array(await readFile(new URL('../Benchmark/CIICompare/BM_CII_SOURCE.CII', import.meta.url)));
assert.equal(gitBlobSha1(fixture), SOURCE_GIT_BLOB, 'BM-W2-00 frozen source Git blob drifted');

const oracle = buildBmW200ExpectedPostimage(fixture);
assert.equal(oracle.status, 'PASS');
assert.equal(oracle.caseId, 'BM-W2-00');
assert.equal(oracle.operation, 'NONE');
assert.equal(oracle.authority, 'ORIGINAL_FROZEN_TARGET_BYTES');
assert.equal(oracle.byteLength, fixture.byteLength);
assert.deepEqual(oracle.outputBytes, fixture, 'BM-W2-00 expected postimage must be exact frozen TARGET bytes');
assert.notStrictEqual(oracle.outputBytes, fixture, 'identity oracle must return an independent byte copy');
assert.equal(assertBmW200IdentityPostimage(fixture, oracle.outputBytes).status, 'PASS');

const target = await intakeCiiWorkspaceDocument(fixture, 'BM_CII_SOURCE.CII', { side: 'TARGET', cryptoRef: webcrypto });
assert.equal(target.summary?.neutralVersionMajor, 11);
assert.equal(target.parsed?.elements?.length, 40);
const targetGraph = adaptCiiDocumentToTopologyGraph(target);
const topologyBefore = connectivity(targetGraph);

const bridge = await inspectCiiWorkspaceModelsWithVersionBridge({
  sourceBytes: fixture,
  sourceFileName: 'BM_CII_SOURCE.CII',
  targetBytes: fixture,
  targetFileName: 'BM_CII_SOURCE.CII',
}, { cryptoRef: webcrypto, writerVersion: '2' });
assert.equal(bridge.versionBridge?.mode, 'DIRECT_V11');
assert.equal(bridge.versionBridge?.source?.originalVersion, 11);
assert.equal(bridge.versionBridge?.target?.originalVersion, 11);
assert.equal(bridge.versionBridge?.source?.normalizedVersion, 11);
assert.equal(bridge.versionBridge?.target?.normalizedVersion, 11);
assert.equal(bridge.versionBridge?.source?.exactBaselineRoundTrip, true);
assert.equal(bridge.versionBridge?.target?.exactBaselineRoundTrip, true);
assert.equal(bridge.versionBridge?.source?.originalSha256, bridge.versionBridge?.target?.originalSha256);
assert.equal(bridge.versionBridge?.source?.normalizedSha256, bridge.versionBridge?.target?.normalizedSha256);
assert.equal(bridge.source?.contentSha256, bridge.target?.contentSha256);

const routed = applyCiiWriter2CompositePlanContract(zeroMutationPlan(target));
assert.equal(routed.status, 'BLOCKED');
assert.equal(routed.mutationAuthority, 'BLOCKED');
assert.deepEqual(routed.operations, []);
assert.equal(routed.summary?.writer2CompositeMutationCount, 0);
assert(routed.blockers.includes('NO_WRITER_2_COMPOSITE_TRANSFERABLE_OPERATIONS'));

const readiness = ciiWriter2CompositeReadiness(routed, target, targetGraph);
assert.equal(readiness.ready, false);
assert.equal(readiness.status, 'BLOCKED');
assert.equal(readiness.mutationCount, 0);
assert(readiness.blockers.includes('WRITER_2_COMPOSITE_NO_MUTATIONS'));
assert(readiness.blockers.includes('NO_WRITER_2_COMPOSITE_TRANSFERABLE_OPERATIONS'));

const postimage = await intakeCiiWorkspaceDocument(oracle.outputBytes, 'BM_W2_00_IDENTITY.CII', { side: 'TARGET', cryptoRef: webcrypto });
assert.deepEqual(connectivity(adaptCiiDocumentToTopologyGraph(postimage)), topologyBefore, 'BM-W2-00 topology must remain unchanged');
assert.equal(postimage.contentSha256, target.contentSha256, 'BM-W2-00 postimage hash must remain identical');

const tampered = oracle.outputBytes.slice();
const tamperIndex = Math.min(8, tampered.length - 1);
tampered[tamperIndex] ^= 1;
assert.throws(
  () => assertBmW200IdentityPostimage(fixture, tampered),
  /BM_W2_00_IDENTITY_POSTIMAGE_MISMATCH/,
  'BM-W2-00 must fail on any byte drift',
);

console.log('BM-W2-00 retained-real Writer2 identity/control benchmark passed.');
