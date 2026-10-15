import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { buildBmW204ExpectedPostimage } from '../Benchmark/CIICompare/Writer2/cii-writer2-benchmark-oracle.js';
import { decodeCiiNumericRow } from '../parser/fixed-field.js';
import { applyCiiWorkspaceTargetWriter2 } from '../tabs/cii-workspace/cii-workspace-core.js';
import { intakeCiiWorkspaceDocument } from '../tabs/cii-workspace/cii-workspace-intake.js';
import { ciiPhysicalSectionRows } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { applyCiiWriter2CompositeWithRestraintDelete } from '../tabs/cii-workspace/cii-workspace-writer2-composite-restraint.js';
import { validateCiiWriter2ProductRoundTrip } from '../tabs/cii-workspace/cii-workspace-writer2-product-validation.js';

const SOURCE_SHA = '4'.repeat(64);
const BLOCK_ROWS = 24;
const SLOT_ROWS = 4;
const SLOTS = 6;

function gitBlobSha1(bytes) {
  const buffer = Buffer.from(bytes);
  return createHash('sha1')
    .update(Buffer.from(`blob ${buffer.byteLength}\0`, 'utf8'))
    .update(buffer)
    .digest('hex');
}

function prefixedText(row) {
  const match = String(row ?? '').match(/^\s*(\d+)\s?(.*)$/);
  if (!match) return null;
  return String(match[2] || '').slice(0, Number(match[1]));
}

function slotState(rows, pointer, slot) {
  const base = (pointer - 1) * BLOCK_ROWS + (slot - 1) * SLOT_ROWS;
  if (base < 0 || base + 3 >= rows.length) return null;
  const first = decodeCiiNumericRow(rows[base].text);
  const second = decodeCiiNumericRow(rows[base + 1].text);
  if (!Array.isArray(first) || first.length < 6 || !Array.isArray(second) || second.length < 3) return null;
  const line1 = first.slice(0, 6).map(Number);
  const line2 = second.slice(0, 3).map(Number);
  if (![...line1, ...line2].every(Number.isFinite)) return null;
  const tag = prefixedText(rows[base + 2].text);
  const guid = prefixedText(rows[base + 3].text);
  if (tag == null || guid == null) return null;
  return Object.freeze({
    pointer,
    slot,
    line1: Object.freeze(line1),
    line2: Object.freeze(line2),
    tag,
    guid,
    occupied: !(Math.abs(line1[0]) <= 1e-12 && Math.abs(line1[1]) <= 1e-12),
  });
}

function ownersForPointer(document, pointer) {
  return Object.values(document?.auxiliaryEvidence?.elements || {})
    .filter((item) => Number(item?.pointers?.restraint || 0) === pointer)
    .sort((a, b) => Number(a.parsedElementIndex) - Number(b.parsedElementIndex));
}

function connectivity(document) {
  return document.parsed.elements.map((element) => [Number(element.index), String(element.from), String(element.to)]);
}

function textRows(document, section) {
  return ciiPhysicalSectionRows(document.physicalFile, section).map((row) => row.text);
}

function fixedI13Token(line, fieldIndex) {
  const start = fieldIndex === 0 ? 0 : 15 + (fieldIndex - 1) * 13;
  const width = fieldIndex === 0 ? 15 : 13;
  return line.slice(start, start + width).trim();
}

function deleteOperation(candidate, beforeSlot) {
  const mutation = Object.freeze({
    schema: 'CIIWorkspaceRestraintSlotMutation.v1',
    status: 'QUALIFIED',
    mode: 'CLEAR',
    authority: 'PROTECTED_WRITER_EXISTING_24_ROW_BLOCK_EMPTY_SLOT_TEMPLATE',
    pointer: candidate.pointer,
    slot: candidate.slot,
    targetNode: candidate.node,
    beforeSlot,
  });
  return Object.freeze({
    operationId: `BM-W2-04-RESTRAINT-DELETE-P${candidate.pointer}-S${candidate.slot}`,
    family: 'RESTRAINT',
    property: 'Qualified restraint slot mutation',
    action: 'DELETE',
    status: 'PREVIEW_READY',
    scopeDecision: 'APPLY',
    policyAuthority: 'CII_WRITER_1B_EXISTING_BLOCK_FIXED_SLOT',
    matchAuthority: Object.freeze({ status: 'REVIEWED' }),
    sourceEvidence: Object.freeze({ value: mutation }),
    proposed: mutation,
  });
}

function boundPlan(targetDocument, operation) {
  const id = operation.operationId;
  return Object.freeze({
    status: 'PREVIEW_READY',
    blockers: Object.freeze([]),
    sourceDocument: Object.freeze({
      fileName: 'BM-W2-04-INDEPENDENT-EXPECTED-SOURCE',
      contentSha256: SOURCE_SHA,
    }),
    targetDocument: Object.freeze({
      fileName: targetDocument.fileName,
      contentSha256: targetDocument.contentSha256,
    }),
    operations: Object.freeze([operation]),
    excludedOperations: Object.freeze([]),
    transferScope: Object.freeze({
      schema: 'CIIWorkspaceTransferScope.v1',
      mode: 'EXPLICIT_APPLY_EXCLUDE',
      status: 'BOUND',
      authority: 'USER_EXPLICIT_OPERATION_SCOPE',
      scopeId: `BM-W2-04:${id}`,
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

function findAuxOwner(document, from, to) {
  return Object.values(document?.auxiliaryEvidence?.elements || {})
    .filter((item) => String(item?.from) === String(from) && String(item?.to) === String(to));
}

const [fixture, manifestText] = await Promise.all([
  readFile(new URL('../Benchmark/CIICompare/BM_CII_SOURCE.CII', import.meta.url)),
  readFile(new URL('../Benchmark/CIICompare/Writer2/CII_WRITER2_BENCHMARKS.json', import.meta.url), 'utf8'),
]);
const manifest = JSON.parse(manifestText);
const benchmarkCase = manifest.cases.find((item) => item.id === 'BM-W2-04');
assert(benchmarkCase, 'BM-W2-04 manifest case required');
assert.equal(gitBlobSha1(fixture), manifest.source.gitBlob, 'retained benchmark source Git blob drift');

const before = await intakeCiiWorkspaceDocument(new Uint8Array(fixture), 'BM_CII_SOURCE.CII', {
  side: 'TARGET',
  cryptoRef: webcrypto,
});
assert.equal(before.summary?.neutralVersionMajor, manifest.source.neutralVersionMajor);
assert.equal(before.parsed?.elements?.length, manifest.source.elementCount);
assert.equal(before.writer1CByteEligible, true, 'retained source must keep exact-byte custody');

const graph = adaptCiiDocumentToTopologyGraph(before);
const candidate = benchmarkCase.candidate;
const restraintRows = ciiPhysicalSectionRows(before.physicalFile, 'RESTRANT');
assert.equal(restraintRows.length, benchmarkCase.expected.rowsBefore);
assert.equal(restraintRows.length % BLOCK_ROWS, 0);

const beforeSlot = slotState(restraintRows, candidate.pointer, candidate.slot);
assert(beforeSlot, 'BM-W2-04 frozen restraint slot must decode');
assert.equal(beforeSlot.occupied, true);
assert.equal(String(Math.round(beforeSlot.line1[0])), candidate.node);
assert.equal(beforeSlot.tag, '');
assert.equal(beforeSlot.guid, '');

const occupiedInBlock = Array.from({ length: SLOTS }, (_, index) => slotState(restraintRows, candidate.pointer, index + 1))
  .filter((item) => item?.occupied);
assert.equal(occupiedInBlock.length, candidate.expectedOccupiedSlotCount, 'BM-W2-04 occupied-slot fixture drift');

const owners = ownersForPointer(before, candidate.pointer);
assert.equal(owners.length, candidate.expectedOwnerCount, 'BM-W2-04 pointer owner-count drift');
assert.equal(String(owners[0].from), candidate.ownerFrom);
assert.equal(String(owners[0].to), candidate.ownerTo);
const nodeRecords = before.auxiliaryEvidence?.restraints?.byNode?.[candidate.node] || [];
assert.equal(nodeRecords.length, candidate.expectedNodeRecordCount, 'BM-W2-04 node record-count drift');

const oracle = buildBmW204ExpectedPostimage(new Uint8Array(fixture), benchmarkCase);
assert.equal(oracle.custody.pointer, candidate.pointer);
assert.equal(oracle.custody.slot, candidate.slot);
assert.equal(oracle.custody.node, candidate.node);
assert.equal(oracle.custody.ownerFrom, candidate.ownerFrom);
assert.equal(oracle.custody.ownerTo, candidate.ownerTo);
assert.equal(oracle.counts.restraintBefore, benchmarkCase.expected.blockCountBefore);
assert.equal(oracle.counts.restraintAfter, benchmarkCase.expected.blockCountAfter);
assert.equal(oracle.counts.restraintRowsBefore, benchmarkCase.expected.rowsBefore);
assert.equal(oracle.counts.restraintRowsAfter, benchmarkCase.expected.rowsAfter);
assert.equal(oracle.counts.nodeNameBefore, benchmarkCase.expected.controlNodeNameCountBefore);
assert.equal(oracle.counts.nodeNameAfter, benchmarkCase.expected.controlNodeNameCountAfter);

const operation = deleteOperation(candidate, beforeSlot);
const transferPlan = boundPlan(before, operation);
const lowLevel = applyCiiWriter2CompositeWithRestraintDelete({
  targetDocument: before,
  targetGraph: graph,
  transferPlan,
});
assert.equal(lowLevel.status, 'APPLIED');
assert.deepEqual(lowLevel.components.restraintDelete.relocationPlan.deletedPointers, [candidate.pointer]);
assert.equal(
  Buffer.from(lowLevel.bytes).equals(Buffer.from(oracle.bytes)),
  true,
  'Writer2 BM-W2-04 postimage must exactly equal the independent structural oracle',
);

const preview = Object.freeze({
  writerVersion: '2',
  targetDocument: before,
  transferPlan,
  correspondence: Object.freeze({
    status: 'READY',
    authority: 'CONTROLLED_RETAINED_REAL_BM_W2_04',
  }),
});
const applied = await applyCiiWorkspaceTargetWriter2(preview, new Uint8Array(fixture), { cryptoRef: webcrypto });
assert.equal(applied.status, 'PASS');
assert.equal(applied.writer, 'WRITER_2');
assert.equal(applied.validation?.status, 'PASS');
assert.equal(applied.byteString, oracle.byteString, 'public Writer2 output must equal the independent BM-W2-04 oracle');
assert.equal(applied.byteString, lowLevel.byteString, 'public and low-level Writer2 outputs must agree exactly');

const after = await intakeCiiWorkspaceDocument(oracle.bytes, 'BM_W2_04_EXPECTED_V11.CII', {
  side: 'TARGET',
  cryptoRef: webcrypto,
});
assert.equal(validateCiiWriter2ProductRoundTrip(before, after, graph, transferPlan, lowLevel).status, 'PASS');
assert.deepEqual(connectivity(after), connectivity(before), 'BM-W2-04 must not alter topology');
assert.equal(ciiPhysicalSectionRows(after.physicalFile, 'RESTRANT').length, benchmarkCase.expected.rowsAfter);
assert.equal(after.parsed?.elements?.length, benchmarkCase.expected.elementCountAfter);

const beforeControl = textRows(before, 'CONTROL');
const afterControl = textRows(after, 'CONTROL');
assert.equal(afterControl[0], beforeControl[0], 'CONTROL row1 including NONAM must remain byte-identical');
assert.notEqual(afterControl[1], beforeControl[1], 'CONTROL row2 RESTRAINT count must change');
for (let index = 2; index < beforeControl.length; index += 1) {
  assert.equal(afterControl[index], beforeControl[index], `unrelated CONTROL row ${index + 1} must remain unchanged`);
}
const afterControlValues = decodeCiiNumericRow(afterControl[1]);
assert.equal(Number(afterControlValues[3]), benchmarkCase.expected.blockCountAfter);
assert.match(fixedI13Token(afterControl[1], 3), /^[+-]?\d+$/, 'CONTROL RESTRAINT count must remain lexical I13');

for (const change of oracle.pointerChanges) {
  const postOwners = findAuxOwner(after, change.from, change.to);
  assert.equal(postOwners.length, 1, `postimage owner ${change.from}->${change.to} must remain unique`);
  assert.equal(Number(postOwners[0].pointers.restraint || 0), change.after);
  const element = after.parsed.elements.find((item) => String(item.from) === change.from && String(item.to) === change.to);
  assert(element, `postimage element ${change.from}->${change.to} required`);
  const elementRows = ciiPhysicalSectionRows(after.physicalFile, 'ELEMENTS');
  const pointerRow = elementRows[Number(element.index) * 15 + 12]?.text;
  assert(pointerRow, `postimage pointer row ${change.from}->${change.to} required`);
  assert.match(fixedI13Token(pointerRow, 3), /^[+-]?\d+$/, `ELEMENT restraint pointer ${change.from}->${change.to} must remain lexical I13`);
}

const headerToken = 'Data generated by CAESAR II/CADWorx/PIPE interface';
const tamperIndex = oracle.byteString.indexOf(headerToken);
assert(tamperIndex >= 0, 'benchmark header token required for anti-drift falsifier');
const tamperedString = `${oracle.byteString.slice(0, tamperIndex)}X${oracle.byteString.slice(tamperIndex + 1)}`;
const tampered = await intakeCiiWorkspaceDocument(new TextEncoder().encode(tamperedString), 'BM_W2_04_TAMPERED.CII', {
  side: 'TARGET',
  cryptoRef: webcrypto,
});
assert.throws(
  () => validateCiiWriter2ProductRoundTrip(before, tampered, graph, transferPlan, lowLevel),
  /EXACT_COMPLETE_POSTIMAGE_MISMATCH/,
  'one unrelated byte outside the BM-W2-04 transaction must fail independent complete-postimage validation',
);

await assert.rejects(
  () => applyCiiWorkspaceTargetWriter2(preview, oracle.bytes, { cryptoRef: webcrypto }),
  /CII_WRITER_2_STALE_TARGET_HASH/,
  'replaying the frozen BM-W2-04 preview against its own postimage must fail stale-target custody',
);

console.log('CII Writer2 BM-W2-04 retained-real V11 RESTRAINT benchmark passed.');
