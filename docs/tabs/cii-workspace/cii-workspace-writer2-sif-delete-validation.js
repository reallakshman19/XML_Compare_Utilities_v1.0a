import { stableStringify } from './cii-workspace-contracts.js';
import { CII_SIX_FIELD_WIDTHS, decodeCiiNumericRow } from '../../parser/fixed-field.js';
import { ciiPhysicalSectionRows } from './cii-workspace-physical-file.js';
import { buildCiiWriter2SifDeleteRelocationPlan } from './cii-workspace-writer2-sif-delete.js';

const SIF_MARKERS = new Set(['SIF&TEES', 'SIF']);
const SIF_BLOCK_ROWS = 10;
const CONTROL_COUNT_FIELD_INDEX = 4;
const CONTROL_PAYLOAD_ROW_INDEX = 2;
const WIDTH = 13;

function markerName(value) {
  const match = String(value ?? '').match(/^\s*#\$\s*(.*?)\s*$/);
  return match ? match[1].trim().toUpperCase() : null;
}
function integerField(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error('WRITER_2_SIF_VALIDATOR_INTEGER_INVALID');
  const token = String(number);
  if (token.length > WIDTH) throw new Error('WRITER_2_SIF_VALIDATOR_INTEGER_OVERFLOW');
  return token.padStart(WIDTH, ' ');
}
function sectionEnvelope(document) {
  const lines = document?.physicalFile?.lines || [];
  const markerIndex = lines.findIndex((line) => SIF_MARKERS.has(markerName(line.text)));
  if (markerIndex < 0) throw new Error('WRITER_2_SIF_VALIDATOR_SECTION_NOT_FOUND');
  let nextIndex = markerIndex + 1;
  while (nextIndex < lines.length && markerName(lines[nextIndex].text) === null) nextIndex += 1;
  if (nextIndex >= lines.length) throw new Error('WRITER_2_SIF_VALIDATOR_NEXT_SECTION_REQUIRED');
  return { marker: lines[markerIndex], nextMarker: lines[nextIndex], rows: lines.slice(markerIndex + 1, nextIndex) };
}
function controlReplacement(before, plan) {
  const lines = before?.physicalFile?.lines || [];
  const markerIndex = lines.findIndex((line) => markerName(line.text) === 'CONTROL');
  const row = markerIndex >= 0 ? lines[markerIndex + 1 + CONTROL_PAYLOAD_ROW_INDEX] : null;
  if (!row) throw new Error('WRITER_2_SIF_VALIDATOR_CONTROL_ROW3_REQUIRED');
  const startColumn = CII_SIX_FIELD_WIDTHS.slice(0, CONTROL_COUNT_FIELD_INDEX).reduce((sum, width) => sum + width, 0);
  const byteStart = Number(row.byteStart) + startColumn; const byteEnd = byteStart + WIDTH;
  const original = String(before?.physicalFile?.originalByteString || '');
  const beforeField = original.slice(byteStart, byteEnd);
  if (beforeField !== integerField(plan.controlCountBefore)) throw new Error('WRITER_2_SIF_VALIDATOR_CONTROL_PREIMAGE_FORMAT_MISMATCH');
  return { kind: 'CONTROL_SIF_TEE_COUNT', byteStart, byteEnd, beforeField, afterField: integerField(plan.controlCountAfter) };
}
function pointerReplacements(before, plan) {
  const original = String(before?.physicalFile?.originalByteString || '');
  return (plan.pointerChanges || []).map((change) => {
    const byteStart = Number(change.pointerField?.byteStart); const byteEnd = Number(change.pointerField?.byteEnd);
    if (!Number.isSafeInteger(byteStart) || !Number.isSafeInteger(byteEnd) || byteEnd - byteStart !== WIDTH) {
      throw new Error(`WRITER_2_SIF_VALIDATOR_POINTER_SPAN_INVALID:${change.parsedElementIndex}`);
    }
    return {
      kind: 'ELEMENT_SIF_TEE_POINTER', parsedElementIndex: Number(change.parsedElementIndex),
      byteStart, byteEnd, beforeField: original.slice(byteStart, byteEnd), afterField: integerField(change.newPointer),
    };
  });
}
function sifPayloadReplacement(before, plan) {
  const envelope = sectionEnvelope(before); const original = String(before?.physicalFile?.originalByteString || '');
  if (envelope.rows.length !== Number(plan.blockCountBefore) * SIF_BLOCK_ROWS) {
    throw new Error('WRITER_2_SIF_VALIDATOR_PRE_ROW_COUNT_MISMATCH');
  }
  const retained = [];
  for (const pointer of plan.retainedPointers || []) {
    const start = (Number(pointer) - 1) * SIF_BLOCK_ROWS;
    const rows = envelope.rows.slice(start, start + SIF_BLOCK_ROWS);
    if (rows.length !== SIF_BLOCK_ROWS) throw new Error(`WRITER_2_SIF_VALIDATOR_BLOCK_TRUNCATED:${pointer}`);
    for (const row of rows) {
      if (row.lineEnding === 'NONE') throw new Error(`WRITER_2_SIF_VALIDATOR_ROW_ENDING_REQUIRED:${pointer}:${row.lineNumber}`);
      retained.push(original.slice(Number(row.byteStart), Number(row.byteEnd)));
    }
  }
  return {
    kind: 'SIF_TEE_SECTION_PAYLOAD', byteStart: Number(envelope.marker.byteEnd), byteEnd: Number(envelope.nextMarker.byteStart),
    beforeField: original.slice(Number(envelope.marker.byteEnd), Number(envelope.nextMarker.byteStart)), afterField: retained.join(''),
  };
}
function expectedReplacements(before, plan) {
  const rows = [controlReplacement(before, plan), ...pointerReplacements(before, plan), sifPayloadReplacement(before, plan)]
    .sort((a, b) => a.byteStart - b.byteStart || a.byteEnd - b.byteEnd)
    .filter((item) => item.beforeField !== item.afterField);
  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index].byteStart < rows[index - 1].byteEnd) throw new Error('WRITER_2_SIF_VALIDATOR_REPLACEMENT_OVERLAP');
  }
  return rows;
}
function applyExpected(original, replacements) {
  let cursor = 0; let output = '';
  for (const replacement of replacements) {
    if (original.slice(replacement.byteStart, replacement.byteEnd) !== replacement.beforeField) {
      throw new Error(`WRITER_2_SIF_VALIDATOR_PREIMAGE_MISMATCH:${replacement.kind}`);
    }
    output += original.slice(cursor, replacement.byteStart) + replacement.afterField;
    cursor = replacement.byteEnd;
  }
  return output + original.slice(cursor);
}
function controlCount(document) {
  const row = ciiPhysicalSectionRows(document?.physicalFile, 'CONTROL')[CONTROL_PAYLOAD_ROW_INDEX];
  const values = row ? decodeCiiNumericRow(row.text) : [];
  return Number(values?.[CONTROL_COUNT_FIELD_INDEX]);
}
function pointerSnapshot(document) {
  return Object.values(document?.sifWriter1CEvidence?.byParsedElementIndex || {}).map((item) => ({
    parsedElementIndex: Number(item.parsedElementIndex), from: String(item.from), to: String(item.to), pointer: Number(item.pointer),
  })).sort((a, b) => a.parsedElementIndex - b.parsedElementIndex);
}
function expectedPointers(before, plan) {
  const changes = new Map((plan.pointerChanges || []).map((item) => [Number(item.parsedElementIndex), Number(item.newPointer)]));
  return pointerSnapshot(before).map((item) => ({ ...item, pointer: changes.has(item.parsedElementIndex) ? changes.get(item.parsedElementIndex) : item.pointer }));
}
function connectivity(document) {
  return (document?.parsed?.elements || []).map((item) => ({ index: Number(item.index), from: String(item.from), to: String(item.to) }));
}
function sectionOrder(document) {
  return (document?.physicalFile?.lines || []).map((line) => markerName(line.text)).filter(Boolean);
}
function mutationTestimony(writerResult) {
  return (writerResult?.mutations || []).map((item) => ({
    kind: item.kind, byteStart: Number(item.byteStart), byteEnd: Number(item.byteEnd), afterField: item.afterField,
    ...(item.parsedElementIndex != null ? { parsedElementIndex: Number(item.parsedElementIndex) } : {}),
  }));
}
function expectedTestimony(replacements) {
  return replacements.map((item) => ({
    kind: item.kind, byteStart: Number(item.byteStart), byteEnd: Number(item.byteEnd), afterField: item.afterField,
    ...(item.parsedElementIndex != null ? { parsedElementIndex: Number(item.parsedElementIndex) } : {}),
  }));
}
function relocationTestimony(plan) {
  return {
    deletedPointers: [...(plan?.deletedPointers || [])], oldToNewPointer: plan?.oldToNewPointer || {}, blockCountAfter: Number(plan?.blockCountAfter),
    pointerChanges: (plan?.pointerChanges || []).map((item) => [Number(item.parsedElementIndex), Number(item.oldPointer), Number(item.newPointer)]),
  };
}

export function validateCiiWriter2SifDeleteRoundTrip(before, after, targetGraph, transferPlan, writerResult) {
  const errors = [];
  const plan = buildCiiWriter2SifDeleteRelocationPlan({ targetDocument: before, targetGraph, transferPlan });
  if (!plan.ready) errors.push(...plan.blockers.map((item) => `INDEPENDENT_SIF_RELOCATION_BLOCKED:${item}`));
  if (plan.createAuthority?.ready !== false) errors.push('WRITER_2_SIF_CREATE_AUTHORITY_UNEXPECTEDLY_READY');
  const replacements = plan.ready ? expectedReplacements(before, plan) : [];
  const expectedBytes = plan.ready ? applyExpected(String(before?.physicalFile?.originalByteString || ''), replacements) : null;
  const actualBytes = String(after?.physicalFile?.originalByteString || '');
  if (after?.writer1CByteEligible !== true || after?.sifWriter1CEvidence?.status !== 'QUALIFIED') {
    errors.push('WRITER_2_SIF_POST_PHYSICAL_CUSTODY_NOT_QUALIFIED');
  }
  if (expectedBytes != null && actualBytes !== expectedBytes) errors.push('WRITER_2_SIF_EXACT_POSTIMAGE_MISMATCH');
  if (writerResult?.byteString != null && String(writerResult.byteString) !== actualBytes) errors.push('WRITER_2_SIF_RESULT_BYTES_MISMATCH');
  if (stableStringify(mutationTestimony(writerResult)) !== stableStringify(expectedTestimony(replacements))) {
    errors.push('WRITER_2_SIF_MUTATION_TESTIMONY_MISMATCH');
  }
  if (controlCount(after) !== Number(plan.controlCountAfter)) errors.push('WRITER_2_SIF_CONTROL_POSTCOUNT_MISMATCH');
  if (ciiPhysicalSectionRows(after?.physicalFile, ['SIF&TEES', 'SIF']).length !== Number(plan.blockCountAfter) * SIF_BLOCK_ROWS) {
    errors.push('WRITER_2_SIF_POST_ROW_COUNT_MISMATCH');
  }
  if (stableStringify(pointerSnapshot(after)) !== stableStringify(expectedPointers(before, plan))) {
    errors.push('WRITER_2_SIF_POINTER_RELOCATION_POSTIMAGE_MISMATCH');
  }
  if (stableStringify(connectivity(before)) !== stableStringify(connectivity(after))) errors.push('WRITER_2_SIF_CONNECTIVITY_CHANGED');
  if (stableStringify(sectionOrder(before)) !== stableStringify(sectionOrder(after))) errors.push('WRITER_2_SIF_SECTION_ORDER_CHANGED');
  if (writerResult?.relocationPlan && stableStringify(relocationTestimony(writerResult.relocationPlan)) !== stableStringify(relocationTestimony(plan))) {
    errors.push('WRITER_2_SIF_RELOCATION_TESTIMONY_MISMATCH');
  }
  if (errors.length) throw new Error(`CII_WRITER_2_SIF_DELETE_ROUNDTRIP_FAILED:${[...new Set(errors)].join('|')}`);
  return Object.freeze({
    schema: 'CIIWorkspaceWriter2SifDeleteValidation.v1', status: 'PASS',
    checks: Object.freeze(['INDEPENDENT_SIF_DELETE_RELOCATION_REBUILD', 'EXACT_FULL_BYTE_POSTIMAGE', 'CONTROL_SIF_POSTCOUNT',
      'SIF_TEE_ROW_COUNT', 'ELEMENT_SIF_POINTER_RELOCATION', 'CONNECTIVITY_STABLE', 'SECTION_ORDER_STABLE',
      'WRITER_TESTIMONY_MATCH', 'CREATE_AUTHORITY_REMAINS_BLOCKED', 'LEXICAL_I13_POINTERS']),
    blockCountBefore: plan.blockCountBefore, blockCountAfter: plan.blockCountAfter, pointerChangeCount: plan.pointerChanges.length,
  });
}

export const _test = Object.freeze({ markerName, integerField, sectionEnvelope, controlReplacement,
  pointerReplacements, sifPayloadReplacement, expectedReplacements, applyExpected, controlCount, pointerSnapshot, expectedPointers });
