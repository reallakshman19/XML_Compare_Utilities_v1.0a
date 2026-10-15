import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { buildBmW201ExpectedPostimage } from '../Benchmark/CIICompare/Writer2/cii-writer2-benchmark-nodename-oracle.js';
import { applyCiiWorkspaceTargetWriter2 } from '../tabs/cii-workspace/cii-workspace-core.js';
import { intakeCiiWorkspaceDocument } from '../tabs/cii-workspace/cii-workspace-intake.js';
import { ciiPhysicalSectionRows, createCiiPhysicalFile } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { CII_WRITER_2_NODENAME_RELOCATION_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-nodename-relocation.js';
import { applyCiiWriter2NodeNameRelocation } from '../tabs/cii-workspace/cii-workspace-writer2-nodename-write.js';
import { validateCiiWriter2NodeNameRoundTrip } from '../tabs/cii-workspace/cii-workspace-writer2-nodename-validation.js';

const SOURCE_GIT_BLOB = 'e41cd05603b56837cbb6e31b9d4074ef6106fe9b';
const SOURCE_SHA = '5151515151515151515151515151515151515151515151515151515151515151';
const CANDIDATE_NODE = '10';
const CANDIDATE_ELEMENT_INDEX = 0;
const CANDIDATE_FROM = '10';
const CANDIDATE_TO = '20';
const NEW_NAME = 'BM-N10';
const POINTER_FIELD_START = 67;
const POINTER_FIELD_END = 80;
const I13_RX = /^[+-]?\d+$/;

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

function operation() {
  return Object.freeze({
    operationId: 'BM-W2-01-NODENAME-CREATE-N10',
    family: 'NODE_NAME',
    property: 'Node name / to-name',
    action: 'CREATE',
    status: 'PREVIEW_READY',
    scopeDecision: 'APPLY',
    policyAuthority: CII_WRITER_2_NODENAME_RELOCATION_POLICY,
    evidenceAuthority: 'CII_NODENAME_FIXED_LAYOUT',
    blockers: Object.freeze([]),
    sourceEvidence: Object.freeze({ identity: 'BM-W2-01-CONTROLLED-SOURCE-N10', value: NEW_NAME, authority: 'CII_NODENAME_FIXED_LAYOUT' }),
    targetEvidence: Object.freeze({ identity: CANDIDATE_NODE, value: '' }),
    before: '',
    proposed: NEW_NAME,
    matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}

function transferPlan(targetDocument) {
  const op = operation();
  return Object.freeze({
    status: 'PREVIEW_READY',
    blockers: Object.freeze([]),
    mutationAuthority: 'WRITER_2_COMPOSITE_CONDITIONAL',
    sourceDocument: Object.freeze({ fileName: 'BM_W2_01_CONTROLLED_SOURCE', contentSha256: SOURCE_SHA }),
    targetDocument: Object.freeze({ fileName: targetDocument.fileName, contentSha256: targetDocument.contentSha256 }),
    operations: Object.freeze([op]),
    excludedOperations: Object.freeze([]),
    transferScope: Object.freeze({
      schema: 'CIIWorkspaceTransferScope.v1',
      mode: 'EXPLICIT_APPLY_EXCLUDE',
      status: 'BOUND',
      authority: 'USER_EXPLICIT_OPERATION_SCOPE',
      scopeId: 'BM-W2-01-NODENAME-CREATE',
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

function connectivity(document) {
  return document.parsed.elements.map((element) => [Number(element.index), String(element.from), String(element.to)]);
}

function rawElementNodeNamePointer(byteString, parsedElementIndex) {
  const physical = createCiiPhysicalFile(bytes(byteString));
  const rows = ciiPhysicalSectionRows(physical, 'ELEMENTS');
  const row = rows[parsedElementIndex * 15 + 13];
  assert(row, `ELEMENT pointer row required for parsed element ${parsedElementIndex}`);
  return String(row.text).slice(POINTER_FIELD_START, POINTER_FIELD_END);
}

const fixture = new Uint8Array(await readFile(new URL('../Benchmark/CIICompare/BM_CII_SOURCE.CII', import.meta.url)));
assert.equal(gitBlobSha1(fixture), SOURCE_GIT_BLOB, 'BM-W2-01 frozen source Git blob drifted');

const oracle = buildBmW201ExpectedPostimage(fixture, {
  node: CANDIDATE_NODE,
  elementIndex: CANDIDATE_ELEMENT_INDEX,
  ownerFrom: CANDIDATE_FROM,
  ownerTo: CANDIDATE_TO,
  ownerEnd: 'FROM',
  name: NEW_NAME,
});
assert.equal(oracle.status, 'PASS');
assert.deepEqual(oracle.before, { nonam: 4, nodenameRows: 4, pointer: 0, elementCount: 40 });
assert.equal(oracle.after.nonam, 5);
assert.equal(oracle.after.nodenameRows, 5);
assert.equal(oracle.after.pointer, 5);
assert.equal(oracle.after.pointerLexicalI13, true);
assert.equal(oracle.after.name, NEW_NAME);
assert.equal(oracle.after.elementCount, 40);

const before = await intakeCiiWorkspaceDocument(fixture, 'BM_CII_SOURCE.CII', { side: 'TARGET', cryptoRef: webcrypto });
const graph = adaptCiiDocumentToTopologyGraph(before);
assert.equal(before.writer1CByteEligible, true);
assert.equal(before.summary?.neutralVersionMajor, 11);
assert.equal(before.parsed?.elements?.length, 40);
assert.equal(before.nodeNameEvidence?.physicalCustody?.status, 'QUALIFIED');
assert.equal(before.nodeNameEvidence?.physicalCustody?.rowCount, 4);
assert.equal(String(before.nodeNames?.[CANDIDATE_NODE] || '').trim(), '');

const binding = before.nodeNameEvidence.physicalCustody.byElementIndex?.[String(CANDIDATE_ELEMENT_INDEX)];
assert(binding, 'BM-W2-01 exact element binding required');
assert.equal(binding.bindingAuthority, 'EXACT_PARSED_INDEX_AND_ENDPOINTS');
assert.equal(String(binding.from), CANDIDATE_FROM);
assert.equal(String(binding.to), CANDIDATE_TO);
assert.equal(Number(binding.pointer), 0);
assert.equal(binding.pointerField?.qualified, true);
assert.equal(Number(binding.pointerField?.width), 13);
const node10Spans = Object.values(before.nodeNameEvidence.physicalCustody.bySpan || {})
  .flatMap((span) => span?.owners || [])
  .filter((owner) => String(owner.nodeId) === CANDIDATE_NODE);
assert.equal(node10Spans.length, 0, 'node 10 must not already own a physical NODENAME field');

const plan = transferPlan(before);
const lowLevel = applyCiiWriter2NodeNameRelocation({ targetDocument: before, transferPlan: plan });
assert.equal(lowLevel.status, 'APPLIED');
assert.equal(lowLevel.relocationPlan.status, 'READY');
assert.equal(lowLevel.relocationPlan.rowCountBefore, 4);
assert.equal(lowLevel.relocationPlan.rowCountAfter, 5);
assert.equal(lowLevel.relocationPlan.controlCountBefore, 4);
assert.equal(lowLevel.relocationPlan.controlCountAfter, 5);
assert.equal(lowLevel.relocationPlan.appendedRows.length, 1);
assert.equal(lowLevel.relocationPlan.appendedRows[0].newPointer, 5);
assert.equal(lowLevel.relocationPlan.appendedRows[0].parsedElementIndex, CANDIDATE_ELEMENT_INDEX);
assert.equal(lowLevel.relocationPlan.appendedRows[0].fromName, NEW_NAME);
assert.equal(lowLevel.relocationPlan.appendedRows[0].toName, '');

const lowLevelPointerRaw = rawElementNodeNamePointer(lowLevel.byteString, CANDIDATE_ELEMENT_INDEX);
assert.match(
  lowLevelPointerRaw.trim(),
  I13_RX,
  `BM-W2-01 ELEMENT NODENAME pointer must be lexical I13, got ${JSON.stringify(lowLevelPointerRaw)}`,
);
assert.equal(lowLevelPointerRaw, oracle.after.pointerRaw, 'Writer2 pointer bytes must equal independent oracle I13 bytes');
assert.equal(lowLevel.byteString, oracle.byteString, 'low-level Writer2 output must equal independent BM-W2-01 postimage');

const lowAfter = await intakeCiiWorkspaceDocument(lowLevel.bytes, 'BM_W2_01_LOWLEVEL.CII', { side: 'TARGET', cryptoRef: webcrypto });
assert.equal(validateCiiWriter2NodeNameRoundTrip(before, lowAfter, plan, lowLevel).status, 'PASS');
assert.equal(lowAfter.nodeNames?.[CANDIDATE_NODE], NEW_NAME);
assert.equal(lowAfter.nodeNameEvidence?.physicalCustody?.rowCount, 5);
assert.deepEqual(connectivity(lowAfter), connectivity(before));

const preview = Object.freeze({
  writerVersion: '2',
  targetDocument: before,
  transferPlan: plan,
  correspondence: Object.freeze({ status: 'READY', authority: 'BM_W2_01_RETAINED_REAL_QUALIFICATION' }),
});
const publicResult = await applyCiiWorkspaceTargetWriter2(preview, fixture, { cryptoRef: webcrypto });
assert.equal(publicResult.status, 'PASS');
assert.equal(publicResult.writer, 'WRITER_2');
assert.equal(publicResult.validation?.status, 'PASS');
assert.equal(publicResult.byteString, oracle.byteString, 'public Writer2 output must equal independent BM-W2-01 postimage');
assert.equal(publicResult.byteString, lowLevel.byteString, 'public and low-level Writer2 outputs must be identical');

const after = await intakeCiiWorkspaceDocument(bytes(publicResult.byteString), publicResult.fileName, { side: 'TARGET', cryptoRef: webcrypto });
assert.equal(after.nodeNames?.[CANDIDATE_NODE], NEW_NAME);
assert.equal(after.nodeNameEvidence?.physicalCustody?.rowCount, 5);
assert.deepEqual(connectivity(after), connectivity(before));

await assert.rejects(
  () => applyCiiWorkspaceTargetWriter2(preview, bytes(publicResult.byteString), { cryptoRef: webcrypto }),
  /CII_WRITER_2_STALE_TARGET_HASH/,
  'replaying the bound BM-W2-01 preview against its postimage must fail stale-target custody',
);

const headerToken = 'Data generated by CAESAR II/CADWorx/PIPE interface';
const tamperIndex = lowLevel.byteString.indexOf(headerToken);
assert(tamperIndex >= 0, 'BM-W2-01 unrelated-byte falsifier header token required');
const tamperedString = `${lowLevel.byteString.slice(0, tamperIndex)}X${lowLevel.byteString.slice(tamperIndex + 1)}`;
const tampered = await intakeCiiWorkspaceDocument(bytes(tamperedString), 'BM_W2_01_TAMPERED.CII', { side: 'TARGET', cryptoRef: webcrypto });
assert.throws(
  () => validateCiiWriter2NodeNameRoundTrip(before, tampered, plan, lowLevel),
  /WRITER_2_EXACT_POSTIMAGE_MISMATCH/,
  'one unrelated byte outside BM-W2-01 authorized coordinates must fail independent round-trip validation',
);

console.log('BM-W2-01 retained-real NODENAME CREATE qualification passed.');
