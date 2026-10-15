import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { buildBmW202ExpectedPostimage } from '../Benchmark/CIICompare/Writer2/cii-writer2-benchmark-sif-oracle.js';
import { decodeCiiNumericRow } from '../parser/fixed-field.js';
import { applyCiiWorkspaceTargetWriter2 } from '../tabs/cii-workspace/cii-workspace-core.js';
import { intakeCiiWorkspaceDocument } from '../tabs/cii-workspace/cii-workspace-intake.js';
import { ciiPhysicalSectionRows } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { applyCiiWriter2Composite } from '../tabs/cii-workspace/cii-workspace-writer2-composite.js';
import { validateCiiWriter2CompositeRoundTrip } from '../tabs/cii-workspace/cii-workspace-writer2-composite-validation.js';
import { CII_WRITER_2_SIF_DELETE_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-sif-delete.js';
import { validateCiiWriter2SifDeleteRoundTrip } from '../tabs/cii-workspace/cii-workspace-writer2-sif-delete-validation.js';

const SOURCE_SHA = '2'.repeat(64);
const ELEMENT_ROWS = 15;
const SIF_POINTER_ROW = 13;
const SIF_POINTER_FIELD = 4;
const FIELD_WIDTHS = [15, 13, 13, 13, 13, 13];

function gitBlobSha1(bytes) {
  const buffer = Buffer.from(bytes);
  return createHash('sha1')
    .update(Buffer.from(`blob ${buffer.byteLength}\0`, 'utf8'))
    .update(buffer)
    .digest('hex');
}

function connectivity(document) {
  return document.parsed.elements.map((element) => [Number(element.index), String(element.from), String(element.to)]);
}

function fixedToken(line, fieldIndex) {
  const start = FIELD_WIDTHS.slice(0, fieldIndex).reduce((sum, width) => sum + width, 0);
  return String(line ?? '').slice(start, start + FIELD_WIDTHS[fieldIndex]).trim();
}

function assertSifPointerI13(document, parsedElementIndex, expected) {
  const rows = ciiPhysicalSectionRows(document.physicalFile, 'ELEMENTS');
  const pointerRow = rows[Number(parsedElementIndex) * ELEMENT_ROWS + SIF_POINTER_ROW]?.text;
  assert(pointerRow, `BM-W2-02 ELEMENT ${parsedElementIndex} SIF pointer row required`);
  const token = fixedToken(pointerRow, SIF_POINTER_FIELD);
  assert.match(token, /^[+-]?\d+$/, `BM-W2-02 ELEMENT ${parsedElementIndex} SIF pointer must be lexical I13`);
  assert.equal(Number(token), expected);
}

function frozenEdge(graph, from, to) {
  const matches = (graph?.edges || []).filter((edge) => String(edge.from) === String(from) && String(edge.to) === String(to));
  assert.equal(matches.length, 1, `BM-W2-02 frozen edge ${from}->${to} must be unique`);
  return matches[0];
}

function operation(edge) {
  return Object.freeze({
    operationId: `BM-W2-02-SIF-DELETE-${edge.elementId}`,
    family: 'SIF_TEE',
    property: 'SIF/Tee record presence',
    action: 'DELETE',
    status: 'PREVIEW_READY',
    scopeDecision: 'APPLY',
    policyAuthority: CII_WRITER_2_SIF_DELETE_POLICY,
    evidenceAuthority: 'ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD',
    blockers: Object.freeze([]),
    sourceEvidence: Object.freeze({
      identity: `BM-W2-02-SOURCE-${edge.elementId}`,
      value: false,
      authority: 'ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD',
    }),
    targetEvidence: Object.freeze({ identity: String(edge.elementId), value: true }),
    before: true,
    proposed: false,
    matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}

function boundPlan(targetDocument, mutation) {
  const id = mutation.operationId;
  return Object.freeze({
    status: 'PREVIEW_READY',
    blockers: Object.freeze([]),
    mutationAuthority: 'WRITER_2_COMPOSITE_CONDITIONAL',
    sourceDocument: Object.freeze({ fileName: 'BM-W2-02-INDEPENDENT-EXPECTED-SOURCE', contentSha256: SOURCE_SHA }),
    targetDocument: Object.freeze({ fileName: targetDocument.fileName, contentSha256: targetDocument.contentSha256 }),
    operations: Object.freeze([mutation]),
    excludedOperations: Object.freeze([]),
    policy: Object.freeze({ mixedCardinalityMutation: 'ONE_ORIGINAL_PREIMAGE_COMPOSITE' }),
    transferScope: Object.freeze({
      schema: 'CIIWorkspaceTransferScope.v1',
      mode: 'EXPLICIT_APPLY_EXCLUDE',
      status: 'BOUND',
      authority: 'USER_EXPLICIT_OPERATION_SCOPE',
      scopeId: `BM-W2-02:${id}`,
      sourceSha256: SOURCE_SHA,
      targetSha256: targetDocument.contentSha256,
      candidateOperationIds: Object.freeze([id]),
      appliedOperationIds: Object.freeze([id]),
      excludedOperationIds: Object.freeze([]),
      appliedOperationCount: 1,
      excludedOperationCount: 0,
    }),
  });
}

const [fixture, manifestText] = await Promise.all([
  readFile(new URL('../Benchmark/CIICompare/BM_CII_SOURCE.CII', import.meta.url)),
  readFile(new URL('../Benchmark/CIICompare/Writer2/CII_WRITER2_BENCHMARKS.json', import.meta.url), 'utf8'),
]);
const manifest = JSON.parse(manifestText);
const benchmarkCase = manifest.cases.find((item) => item.id === 'BM-W2-02');
assert(benchmarkCase, 'BM-W2-02 manifest case required');
assert.equal(gitBlobSha1(fixture), manifest.source.gitBlob, 'BM-W2-02 retained benchmark source Git blob drift');

const before = await intakeCiiWorkspaceDocument(new Uint8Array(fixture), 'BM_CII_SOURCE.CII', {
  side: 'TARGET',
  cryptoRef: webcrypto,
});
assert.equal(before.summary?.neutralVersionMajor, manifest.source.neutralVersionMajor);
assert.equal(before.parsed?.elements?.length, manifest.source.elementCount);
assert.equal(before.sifWriter1CEvidence?.status, 'QUALIFIED', before.sifWriter1CEvidence?.blockers?.join('|'));
assert.equal(before.sifWriter1CEvidence?.controlBlockCount, benchmarkCase.expected.blockCountBefore);
assert.equal(before.sifWriter1CEvidence?.sectionRowCount, benchmarkCase.expected.rowsBefore);
assert.equal(before.sifWriter1CEvidence?.blockRows, benchmarkCase.expected.rowsPerBlock);

const graph = adaptCiiDocumentToTopologyGraph(before);
const candidate = benchmarkCase.candidate;
const edge = frozenEdge(graph, candidate.ownerFrom, candidate.ownerTo);
const binding = before.sifWriter1CEvidence?.byParsedElementIndex?.[String(edge.parsedElementIndex)];
assert(binding, 'BM-W2-02 frozen SIF owner binding required');
assert.equal(Number(binding.pointer), candidate.pointer);
const owners = before.sifWriter1CEvidence?.byPointer?.[String(candidate.pointer)]?.owners || [];
assert.equal(owners.length, candidate.expectedOwnerCount, 'BM-W2-02 frozen pointer owner-count drift');
assert.equal(String(owners[0].from), candidate.ownerFrom);
assert.equal(String(owners[0].to), candidate.ownerTo);
const record = before.auxiliaryEvidence?.sifTee?.byPointer?.[String(candidate.pointer)];
assert(record, 'BM-W2-02 frozen raw SIF record required');
assert.equal(String(record.node), candidate.recordNode);
assert.equal(Number(record.rawCode), candidate.sourceRawCode);

const oracle = buildBmW202ExpectedPostimage(new Uint8Array(fixture), benchmarkCase);
assert.equal(oracle.custody.pointer, candidate.pointer);
assert.equal(oracle.custody.ownerCount, candidate.expectedOwnerCount);
assert.equal(oracle.custody.recordNode, candidate.recordNode);
assert.equal(oracle.custody.rawCode, candidate.sourceRawCode);
assert.equal(oracle.counts.sifBefore, benchmarkCase.expected.blockCountBefore);
assert.equal(oracle.counts.sifAfter, benchmarkCase.expected.blockCountAfter);
assert.equal(oracle.counts.sifRowsBefore, benchmarkCase.expected.rowsBefore);
assert.equal(oracle.counts.sifRowsAfter, benchmarkCase.expected.rowsAfter);

const transferPlan = boundPlan(before, operation(edge));
const lowLevel = applyCiiWriter2Composite({ targetDocument: before, targetGraph: graph, transferPlan });
assert.equal(lowLevel.status, 'APPLIED');
assert.equal(lowLevel.familyMutationCounts.sifDeleteOperations, 1);
assert.equal(lowLevel.familyMutationCounts.nodeNameOperations, 0);
assert.deepEqual(lowLevel.components.sifDelete.relocationPlan.deletedPointers, [candidate.pointer]);
assert.equal(
  Buffer.from(lowLevel.bytes).equals(Buffer.from(oracle.bytes)),
  true,
  'Writer2 BM-W2-02 postimage must exactly equal the independent structural oracle',
);

const preview = Object.freeze({
  writerVersion: '2',
  targetDocument: before,
  transferPlan,
  correspondence: Object.freeze({ status: 'READY', authority: 'CONTROLLED_RETAINED_REAL_BM_W2_02' }),
});
const applied = await applyCiiWorkspaceTargetWriter2(preview, new Uint8Array(fixture), { cryptoRef: webcrypto });
assert.equal(applied.status, 'PASS');
assert.equal(applied.writer, 'WRITER_2');
assert.equal(applied.validation?.status, 'PASS');
assert.equal(applied.validation?.unexpectedSemanticDeltaCount, 0);
assert.equal(applied.byteString, oracle.byteString, 'public Writer2 output must equal the independent BM-W2-02 oracle');
assert.equal(applied.byteString, lowLevel.byteString, 'public and low-level BM-W2-02 outputs must agree exactly');

const after = await intakeCiiWorkspaceDocument(oracle.bytes, 'BM_W2_02_EXPECTED_V11.CII', {
  side: 'TARGET',
  cryptoRef: webcrypto,
});
assert.deepEqual(connectivity(after), connectivity(before), 'BM-W2-02 must not alter topology');
assert.equal(after.sifWriter1CEvidence?.controlBlockCount, benchmarkCase.expected.blockCountAfter);
assert.equal(after.sifWriter1CEvidence?.sectionRowCount, benchmarkCase.expected.rowsAfter);
assert.equal(ciiPhysicalSectionRows(after.physicalFile, ['SIF&TEES', 'SIF']).length, benchmarkCase.expected.rowsAfter);

for (const change of oracle.pointerChanges) {
  const post = after.sifWriter1CEvidence?.byParsedElementIndex?.[String(change.blockIndex)];
  assert(post, `BM-W2-02 post binding ${change.blockIndex} required`);
  assert.equal(Number(post.pointer), change.after);
  assertSifPointerI13(after, change.blockIndex, change.after);
}
assert.equal(Number(after.sifWriter1CEvidence?.byParsedElementIndex?.[String(edge.parsedElementIndex)]?.pointer), 0);

assert.equal(
  validateCiiWriter2SifDeleteRoundTrip(before, after, graph, transferPlan, lowLevel.components.sifDelete).status,
  'PASS',
);
assert.equal(validateCiiWriter2CompositeRoundTrip(before, after, graph, transferPlan, lowLevel).status, 'PASS');

const controlAfter = ciiPhysicalSectionRows(after.physicalFile, 'CONTROL')[2]?.text;
assert(controlAfter, 'BM-W2-02 CONTROL row3 required');
const controlValues = decodeCiiNumericRow(controlAfter);
assert.equal(Number(controlValues[4]), benchmarkCase.expected.blockCountAfter);
assert.match(fixedToken(controlAfter, 4), /^[+-]?\d+$/, 'BM-W2-02 CONTROL SIF count must remain lexical I13');

const headerToken = 'Data generated by CAESAR II/CADWorx/PIPE interface';
const tamperIndex = oracle.byteString.indexOf(headerToken);
assert(tamperIndex >= 0, 'BM-W2-02 benchmark header token required for anti-drift falsifier');
const tamperedString = `${oracle.byteString.slice(0, tamperIndex)}X${oracle.byteString.slice(tamperIndex + 1)}`;
const tampered = await intakeCiiWorkspaceDocument(new TextEncoder().encode(tamperedString), 'BM_W2_02_TAMPERED.CII', {
  side: 'TARGET',
  cryptoRef: webcrypto,
});
assert.throws(
  () => validateCiiWriter2CompositeRoundTrip(before, tampered, graph, transferPlan, lowLevel),
  /EXACT_COMPOSITE_POSTIMAGE_MISMATCH/,
  'one unrelated byte outside the BM-W2-02 transaction must fail independent complete-postimage validation',
);

await assert.rejects(
  () => applyCiiWorkspaceTargetWriter2(preview, oracle.bytes, { cryptoRef: webcrypto }),
  /CII_WRITER_2_STALE_TARGET_HASH/,
  'replaying the frozen BM-W2-02 preview against its own postimage must fail stale-target custody',
);

console.log('CII Writer2 BM-W2-02 retained-real V11 SIF DELETE benchmark passed.');
