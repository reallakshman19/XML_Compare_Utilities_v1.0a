import assert from 'node:assert/strict';
import { createCiiPhysicalFile, ciiPhysicalSectionRows } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { extractCiiWriter1CSifEvidence } from '../tabs/cii-workspace/cii-workspace-writer1c-sif-custody.js';
import { applyCiiWriter2SifDeletePlanContract } from '../tabs/cii-workspace/cii-workspace-writer2-sif-delete.js';
import { applyCiiWriter2SifDeleteRelocation } from '../tabs/cii-workspace/cii-workspace-writer2-sif-delete-write.js';
import { validateCiiWriter2SifDeleteRoundTrip } from '../tabs/cii-workspace/cii-workspace-writer2-sif-delete-validation.js';

const WIDTHS = [15, 13, 13, 13, 13, 13];
function numericRow(values) { return values.map((value, index) => String(value ?? 0).padStart(WIDTHS[index], ' ')).join(''); }
function fixedToken(line, fieldIndex) {
  const start = WIDTHS.slice(0, fieldIndex).reduce((sum, width) => sum + width, 0);
  return String(line ?? '').slice(start, start + WIDTHS[fieldIndex]).trim();
}
function assertSifPointerI13(document, parsedElementIndex, expected) {
  const rows = ciiPhysicalSectionRows(document.physicalFile, 'ELEMENTS');
  const pointerRow = rows[Number(parsedElementIndex) * 15 + 13]?.text;
  assert(pointerRow, `ELEMENT ${parsedElementIndex} SIF pointer row required`);
  const token = fixedToken(pointerRow, 4);
  assert.match(token, /^[+-]?\d+$/, `ELEMENT ${parsedElementIndex} SIF pointer must be lexical I13`);
  assert.equal(Number(token), expected);
}
function elementBlock(from, to, sifPointer) {
  const rows = Array.from({ length: 15 }, () => numericRow([0, 0, 0, 0, 0, 0]));
  rows[0] = numericRow([from, to, 0, 0, 0, 100]);
  rows[13] = numericRow([0, 0, 0, 0, sifPointer, 0]);
  return rows;
}
function sifBlock(pointer) {
  const rows = [];
  for (let row = 0; row < 10; row += 1) {
    const seed = pointer * 100 + row * 10;
    rows.push(numericRow([seed + 1, seed + 2, seed + 3, seed + 4, seed + 5, seed + 6]));
  }
  return rows;
}
function body(pointers = [1, 2, 3]) {
  const control1 = numericRow([pointers.length, 0, 0, 0, 0, 0]);
  const control2 = numericRow([0, 0, 0, 0, 0, 0]);
  const control3 = numericRow([0, 0, 0, 0, Math.max(0, ...pointers), 0]);
  const elements = pointers.flatMap((pointer, index) => elementBlock(index * 10 + 10, index * 10 + 20, pointer));
  const sifs = Array.from({ length: Math.max(0, ...pointers) }, (_, index) => sifBlock(index + 1)).flat();
  return [
    '#$ VERSION', numericRow([5, 11, 1256, 0, 0, 0]),
    '#$ CONTROL', control1, control2, control3, numericRow([0, 0, 0, 0, 0, 0]),
    '#$ ELEMENTS', ...elements,
    '#$ SIF&TEES', ...sifs,
    '#$ REDUCERS', numericRow([0, 0, 0, 0, 0, 0]),
  ].join('\r\n') + '\r\n';
}
function parsed(count = 3) {
  return Object.freeze({ elements: Object.freeze(Array.from({ length: count }, (_, index) => Object.freeze({
    index, from: index * 10 + 10, to: index * 10 + 20,
  }))) });
}
function graph(count = 3) {
  return Object.freeze({ edges: Object.freeze(Array.from({ length: count }, (_, index) => Object.freeze({
    elementId: `E${index + 1}`, parsedElementIndex: index, from: String(index * 10 + 10), to: String(index * 10 + 20),
  }))) });
}
function documentFrom(bytes, parsedModel = parsed()) {
  const physicalFile = createCiiPhysicalFile(bytes);
  const sifWriter1CEvidence = extractCiiWriter1CSifEvidence(physicalFile.text, parsedModel, { physicalFile });
  return Object.freeze({ physicalFile, writer1CByteEligible: physicalFile.writer1CByteEligible, parsed: parsedModel, sifWriter1CEvidence });
}
function operation(elementId) {
  return Object.freeze({
    operationId: `DEL-${elementId}`, family: 'SIF_TEE', property: 'SIF/Tee record presence', action: 'DELETE', status: 'BLOCKED',
    blockers: Object.freeze(['SIF_TEE_DELETE_REQUIRES_WRITER_2']), evidenceAuthority: 'ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD',
    sourceEvidence: Object.freeze({ identity: `SRC-${elementId}`, value: false, authority: 'ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD' }),
    targetEvidence: Object.freeze({ identity: elementId, value: true }), before: true, proposed: false,
    matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}
function transferPlan(elementIds) {
  const raw = Object.freeze({ status: 'BLOCKED', blockers: Object.freeze(['NO_TRANSFERABLE_PREVIEW_OPERATIONS']),
    operations: Object.freeze(elementIds.map(operation)), policy: Object.freeze({ sifTeeMutation: 'BLOCKED_EXCEPT_WRITER_1C_V11_ITEM3_ITEM4' }) });
  const contracted = applyCiiWriter2SifDeletePlanContract(raw);
  return Object.freeze({ ...contracted, status: 'PREVIEW_READY', blockers: Object.freeze([]), transferScope: Object.freeze({ status: 'BOUND' }),
    operations: Object.freeze(contracted.operations.map((item) => Object.freeze({ ...item, scopeDecision: 'APPLY' }))) });
}
function afterDocument(writerResult, parsedModel = parsed()) { return documentFrom(writerResult.bytes, parsedModel); }

{
  const before = documentFrom(new TextEncoder().encode(body())); const targetGraph = graph(); const plan = transferPlan(['E2']);
  assert.equal(before.sifWriter1CEvidence.status, 'QUALIFIED', before.sifWriter1CEvidence.blockers?.join('|'));
  const beforeRows = ciiPhysicalSectionRows(before.physicalFile, ['SIF&TEES', 'SIF']).map((row) => row.text);
  const writer = applyCiiWriter2SifDeleteRelocation({ targetDocument: before, targetGraph, transferPlan: plan });
  assert.equal(writer.status, 'APPLIED');
  assert.equal(writer.blockCountBefore, 3);
  assert.equal(writer.blockCountAfter, 2);
  assert.deepEqual(writer.relocationPlan.oldToNewPointer, { 1: 1, 2: 0, 3: 2 });
  assert.deepEqual(writer.relocationPlan.pointerChanges.map((item) => [item.parsedElementIndex, item.oldPointer, item.newPointer]), [[1, 2, 0], [2, 3, 2]]);
  assert(writer.byteLengthAfter < writer.byteLengthBefore);

  const after = afterDocument(writer);
  assert.equal(after.sifWriter1CEvidence.status, 'QUALIFIED', after.sifWriter1CEvidence.blockers?.join('|'));
  assert.equal(after.sifWriter1CEvidence.controlBlockCount, 2);
  assert.deepEqual(Object.values(after.sifWriter1CEvidence.byParsedElementIndex).map((item) => item.pointer), [1, 0, 2]);
  assertSifPointerI13(after, 0, 1);
  assertSifPointerI13(after, 1, 0);
  assertSifPointerI13(after, 2, 2);
  const afterRows = ciiPhysicalSectionRows(after.physicalFile, ['SIF&TEES', 'SIF']).map((row) => row.text);
  assert.deepEqual(afterRows, [...beforeRows.slice(0, 10), ...beforeRows.slice(20, 30)]);

  const validation = validateCiiWriter2SifDeleteRoundTrip(before, after, targetGraph, plan, writer);
  assert.equal(validation.status, 'PASS');
  assert.equal(validation.blockCountAfter, 2);

  const versionBefore = numericRow([5, 11, 1256, 0, 0, 0]);
  const versionTampered = numericRow([6, 11, 1256, 0, 0, 0]);
  const tamperedBytes = new TextEncoder().encode(writer.byteString.replace(versionBefore, versionTampered));
  const tampered = documentFrom(tamperedBytes);
  assert.throws(() => validateCiiWriter2SifDeleteRoundTrip(before, tampered, targetGraph, plan, writer), /WRITER_2_SIF_EXACT_POSTIMAGE_MISMATCH/);

  const forged = Object.freeze({ ...writer, mutations: Object.freeze(writer.mutations.slice(1)) });
  assert.throws(() => validateCiiWriter2SifDeleteRoundTrip(before, after, targetGraph, plan, forged), /WRITER_2_SIF_MUTATION_TESTIMONY_MISMATCH/);
}

{
  const before = documentFrom(new TextEncoder().encode(body())); const targetGraph = graph(); const plan = transferPlan(['E1', 'E2', 'E3']);
  const writer = applyCiiWriter2SifDeleteRelocation({ targetDocument: before, targetGraph, transferPlan: plan });
  const after = afterDocument(writer);
  assert.equal(writer.blockCountAfter, 0);
  assert.equal(after.sifWriter1CEvidence.controlBlockCount, 0);
  assert.deepEqual(Object.values(after.sifWriter1CEvidence.byParsedElementIndex).map((item) => item.pointer), [0, 0, 0]);
  assertSifPointerI13(after, 0, 0);
  assertSifPointerI13(after, 1, 0);
  assertSifPointerI13(after, 2, 0);
  assert.equal(ciiPhysicalSectionRows(after.physicalFile, ['SIF&TEES', 'SIF']).length, 0);
  assert.equal(validateCiiWriter2SifDeleteRoundTrip(before, after, targetGraph, plan, writer).status, 'PASS');
}

console.log('Writer 2 V11 SIF physical DELETE, compaction, lexical-I13 pointer, exact-postimage and anti-testimony checks passed.');
