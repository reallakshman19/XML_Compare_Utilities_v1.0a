import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { buildBmW203ExpectedPostimage } from '../Benchmark/CIICompare/Writer2/cii-writer2-benchmark-hanger-oracle.js';
import { applyCiiWorkspaceTargetWriter2 } from '../tabs/cii-workspace/cii-workspace-core.js';
import { intakeCiiWorkspaceDocument } from '../tabs/cii-workspace/cii-workspace-intake.js';
import { ciiPhysicalSectionRows } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { CII_HANGER_LAYOUTS } from '../tabs/cii-workspace/cii-workspace-hanger.js';
import { CII_WRITER_2_HANGER_DELETE_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-hanger-delete.js';
import { applyCiiWriter2HangerDeleteAll } from '../tabs/cii-workspace/cii-workspace-writer2-hanger-delete-all-write.js';
import { validateCiiWriter2HangerDeleteAllRoundTrip } from '../tabs/cii-workspace/cii-workspace-writer2-hanger-delete-all-validation.js';

const SOURCE_GIT_BLOB = 'e41cd05603b56837cbb6e31b9d4074ef6106fe9b';
const SOURCE_SHA = '5353535353535353535353535353535353535353535353535353535353535353';
const HANGER_NODE = '205';

function gitBlobSha1(bytes) {
  const buffer = Buffer.from(bytes);
  return createHash('sha1')
    .update(Buffer.from(`blob ${buffer.byteLength}\0`, 'utf8'))
    .update(buffer)
    .digest('hex');
}

function bytes(value) {
  const input = String(value ?? '');
  const out = new Uint8Array(input.length);
  for (let index = 0; index < input.length; index += 1) out[index] = input.charCodeAt(index) & 0xff;
  return out;
}

function connectivity(document) {
  return document.parsed.elements.map((element) => [Number(element.index), String(element.from), String(element.to)]);
}

function operation() {
  return Object.freeze({
    operationId: `BM-W2-03-HANGER-DELETE-${HANGER_NODE}`,
    family: 'HANGER',
    property: 'Hanger presence',
    action: 'DELETE',
    status: 'PREVIEW_READY',
    scopeDecision: 'APPLY',
    policyAuthority: CII_WRITER_2_HANGER_DELETE_POLICY,
    evidenceAuthority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE',
    blockers: Object.freeze([]),
    sourceEvidence: Object.freeze({ identity: `BM-W2-03-CONTROLLED-SOURCE-${HANGER_NODE}`, value: false, authority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE' }),
    targetEvidence: Object.freeze({ identity: HANGER_NODE, value: true }),
    before: true,
    proposed: false,
    matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}

function transferPlan(targetDocument) {
  const op = operation();
  return Object.freeze({
    status: 'PREVIEW_READY',
    blockers: Object.freeze([]),
    mutationAuthority: 'WRITER_2_COMPOSITE_CARDINALITY_CONDITIONAL',
    sourceDocument: Object.freeze({ fileName: 'BM_W2_03_CONTROLLED_SOURCE', contentSha256: SOURCE_SHA }),
    targetDocument: Object.freeze({ fileName: targetDocument.fileName, contentSha256: targetDocument.contentSha256 }),
    operations: Object.freeze([op]),
    excludedOperations: Object.freeze([]),
    transferScope: Object.freeze({
      schema: 'CIIWorkspaceTransferScope.v1',
      mode: 'EXPLICIT_APPLY_EXCLUDE',
      status: 'BOUND',
      authority: 'USER_EXPLICIT_OPERATION_SCOPE',
      scopeId: 'BM-W2-03-HANGER-DELETE-ALL',
      sourceSha256: SOURCE_SHA,
      targetSha256: targetDocument.contentSha256,
      candidateOperationIds: Object.freeze([op.operationId]),
      appliedOperationIds: Object.freeze([op.operationId]),
      excludedOperationIds: Object.freeze([]),
      appliedOperationCount: 1,
      excludedOperationCount: 0,
    }),
  });
}

const fixture = new Uint8Array(await readFile(new URL('../Benchmark/CIICompare/BM_CII_SOURCE.CII', import.meta.url)));
assert.equal(gitBlobSha1(fixture), SOURCE_GIT_BLOB, 'BM-W2-03 frozen source Git blob drifted');

const oracle = buildBmW203ExpectedPostimage(fixture, { node: Number(HANGER_NODE) });
assert.equal(oracle.status, 'PASS');
assert.deepEqual(oracle.before, { hangerCount: 1, nodes: [HANGER_NODE], miscelRows: 23, prefixRows: 7, executionRows: 4 });
assert.equal(oracle.after.hangerCount, 0);
assert.deepEqual(oracle.after.nodes, []);
assert.equal(oracle.after.miscelRows, 11);
assert.match(oracle.after.controlRaw.trim(), /^[+-]?\d+$/);
assert.equal(Number(oracle.after.controlRaw.trim()), 0);

const before = await intakeCiiWorkspaceDocument(fixture, 'BM_CII_SOURCE.CII', { side: 'TARGET', cryptoRef: webcrypto });
const graph = adaptCiiDocumentToTopologyGraph(before);
assert.equal(before.writer1CByteEligible, true);
assert.equal(before.summary?.neutralVersionMajor, 11);
assert.equal(before.parsed?.elements?.length, 40);
assert.equal(before.hangerEvidence?.status, 'QUALIFIED');
assert.equal(before.hangerEvidence?.layout, CII_HANGER_LAYOUTS.SYNCHRONIZER);
assert.equal(before.hangerEvidence?.count, 1);
assert.deepEqual(before.hangerEvidence?.nodes, [HANGER_NODE]);
assert.equal(ciiPhysicalSectionRows(before.physicalFile, 'MISCEL_1').length, 23);

const plan = transferPlan(before);
const lowLevel = applyCiiWriter2HangerDeleteAll({ targetDocument: before, transferPlan: plan });
assert.equal(lowLevel.status, 'APPLIED');
assert.equal(lowLevel.family, 'HANGER_DELETE_ALL');
assert.equal(lowLevel.hangerCountBefore, 1);
assert.equal(lowLevel.hangerCountAfter, 0);
assert.equal(lowLevel.deletePlan?.compaction?.deleteAll, true);
assert.equal(lowLevel.deletePlan?.compaction?.expectedMiscelRowsAfter, 11);
assert.equal(lowLevel.byteString, oracle.byteString, 'low-level HANGER DELETE-ALL output must equal independent BM-W2-03 postimage');

const lowAfter = await intakeCiiWorkspaceDocument(lowLevel.bytes, 'BM_W2_03_LOWLEVEL.CII', { side: 'TARGET', cryptoRef: webcrypto });
assert.equal(validateCiiWriter2HangerDeleteAllRoundTrip(before, lowAfter, plan, lowLevel).status, 'PASS');
assert.equal(lowAfter.hangerEvidence?.status, 'QUALIFIED');
assert.equal(lowAfter.hangerEvidence?.count, 0);
assert.equal(lowAfter.hangerEvidence?.layout, CII_HANGER_LAYOUTS.NONE);
assert.deepEqual(lowAfter.hangerEvidence?.nodes, []);
assert.equal(ciiPhysicalSectionRows(lowAfter.physicalFile, 'MISCEL_1').length, 11);
assert.deepEqual(connectivity(lowAfter), connectivity(before));

const preview = Object.freeze({
  writerVersion: '2',
  targetDocument: before,
  transferPlan: plan,
  correspondence: Object.freeze({ status: 'READY', authority: 'BM_W2_03_RETAINED_REAL_QUALIFICATION' }),
});
const publicResult = await applyCiiWorkspaceTargetWriter2(preview, fixture, { cryptoRef: webcrypto });
assert.equal(publicResult.status, 'PASS');
assert.equal(publicResult.writer, 'WRITER_2');
assert.equal(publicResult.validation?.status, 'PASS');
assert.equal(publicResult.byteString, oracle.byteString, 'public Writer2 output must equal independent BM-W2-03 postimage');
assert.equal(publicResult.byteString, lowLevel.byteString, 'public and low-level HANGER outputs must be identical');

const after = await intakeCiiWorkspaceDocument(bytes(publicResult.byteString), publicResult.fileName, { side: 'TARGET', cryptoRef: webcrypto });
assert.equal(after.hangerEvidence?.count, 0);
assert.equal(after.hangerEvidence?.layout, CII_HANGER_LAYOUTS.NONE);
assert.deepEqual(after.hangerEvidence?.nodes, []);
assert.equal(ciiPhysicalSectionRows(after.physicalFile, 'MISCEL_1').length, 11);
assert.deepEqual(connectivity(after), connectivity(before));

await assert.rejects(
  () => applyCiiWorkspaceTargetWriter2(preview, bytes(publicResult.byteString), { cryptoRef: webcrypto }),
  /CII_WRITER_2_STALE_TARGET_HASH/,
  'replaying the bound BM-W2-03 preview against its postimage must fail stale-target custody',
);

const headerToken = 'Data generated by CAESAR II/CADWorx/PIPE interface';
const tamperIndex = lowLevel.byteString.indexOf(headerToken);
assert(tamperIndex >= 0, 'BM-W2-03 unrelated-byte falsifier header token required');
const tamperedString = `${lowLevel.byteString.slice(0, tamperIndex)}X${lowLevel.byteString.slice(tamperIndex + 1)}`;
const tampered = await intakeCiiWorkspaceDocument(bytes(tamperedString), 'BM_W2_03_TAMPERED.CII', { side: 'TARGET', cryptoRef: webcrypto });
assert.throws(
  () => validateCiiWriter2HangerDeleteAllRoundTrip(before, tampered, plan, lowLevel),
  /WRITER_2_HANGER_EXACT_POSTIMAGE_MISMATCH/,
  'one unrelated byte outside BM-W2-03 authorized coordinates must fail independent HANGER round-trip validation',
);

console.log('BM-W2-03 retained-real HANGER DELETE-ALL qualification passed.');
