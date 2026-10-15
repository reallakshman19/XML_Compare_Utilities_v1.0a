import { buildCiiWriter2SifDeleteRelocationPlan } from './cii-workspace-writer2-sif-delete.js';

const SIF_MARKERS = new Set(['SIF&TEES', 'SIF']);
const SIF_BLOCK_ROWS = 10;
const CONTROL_COUNT_FIELD_INDEX = 4;
const CONTROL_PAYLOAD_ROW_INDEX = 2;
const FIELD_WIDTHS = Object.freeze([15, 13, 13, 13, 13, 13]);
const FIELD_WIDTH = 13;

function markerName(text) {
  const match = String(text ?? '').match(/^\s*#\$\s*(.*?)\s*$/);
  return match ? match[1].trim().toUpperCase() : null;
}
function integerField(value, width, code) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`${code}:INVALID_INTEGER`);
  const token = String(number);
  if (token.length > width) throw new Error(`${code}:OVERFLOW:${token.length}>${width}`);
  return token.padStart(width, ' ');
}
function rawSectionEnvelope(physicalFile) {
  const lines = physicalFile?.lines || [];
  const markerIndex = lines.findIndex((line) => SIF_MARKERS.has(markerName(line.text)));
  if (markerIndex < 0) throw new Error('CII_WRITER_2_SIF_SECTION_NOT_FOUND');
  let nextIndex = markerIndex + 1;
  while (nextIndex < lines.length && markerName(lines[nextIndex].text) === null) nextIndex += 1;
  if (nextIndex >= lines.length) throw new Error('CII_WRITER_2_SIF_SECTION_NEXT_MARKER_REQUIRED');
  return Object.freeze({
    markerIndex, nextIndex, marker: lines[markerIndex], nextMarker: lines[nextIndex],
    rows: Object.freeze(lines.slice(markerIndex + 1, nextIndex)),
  });
}
function controlReplacement(targetDocument, relocationPlan) {
  const lines = targetDocument?.physicalFile?.lines || [];
  const markerIndex = lines.findIndex((line) => markerName(line.text) === 'CONTROL');
  const row = markerIndex >= 0 ? lines[markerIndex + 1 + CONTROL_PAYLOAD_ROW_INDEX] : null;
  if (!row) throw new Error('CII_WRITER_2_SIF_CONTROL_ROW3_REQUIRED');
  const startColumn = FIELD_WIDTHS.slice(0, CONTROL_COUNT_FIELD_INDEX).reduce((sum, width) => sum + width, 0);
  const byteStart = Number(row.byteStart) + startColumn; const byteEnd = byteStart + FIELD_WIDTH;
  const original = String(targetDocument?.physicalFile?.originalByteString ?? '');
  const beforeField = original.slice(byteStart, byteEnd);
  const expectedBefore = integerField(relocationPlan.controlCountBefore, FIELD_WIDTH, 'CII_WRITER_2_SIF_CONTROL_BEFORE');
  if (Number(relocationPlan.controlCountBefore) !== Number(relocationPlan.blockCountBefore)) {
    throw new Error('CII_WRITER_2_SIF_CONTROL_PLAN_PRECOUNT_MISMATCH');
  }
  if (beforeField !== expectedBefore) throw new Error('CII_WRITER_2_SIF_CONTROL_PREIMAGE_FORMAT_MISMATCH');
  return Object.freeze({
    kind: 'CONTROL_SIF_TEE_COUNT', byteStart, byteEnd, beforeField,
    afterField: integerField(relocationPlan.controlCountAfter, FIELD_WIDTH, 'CII_WRITER_2_SIF_CONTROL_AFTER'),
    expectedNumericBefore: Number(relocationPlan.controlCountBefore), expectedFormattedBefore: expectedBefore,
  });
}
function pointerReplacements(targetDocument, relocationPlan) {
  const original = String(targetDocument?.physicalFile?.originalByteString ?? '');
  return Object.freeze((relocationPlan.pointerChanges || []).map((change) => {
    const field = change.pointerField || {}; const byteStart = Number(field.byteStart); const byteEnd = Number(field.byteEnd);
    if (!Number.isSafeInteger(byteStart) || !Number.isSafeInteger(byteEnd) || byteEnd - byteStart !== FIELD_WIDTH) {
      throw new Error(`CII_WRITER_2_SIF_POINTER_SPAN_INVALID:${change.parsedElementIndex}`);
    }
    const beforeField = original.slice(byteStart, byteEnd);
    if (field.rawField != null && beforeField !== field.rawField) {
      throw new Error(`CII_WRITER_2_SIF_POINTER_PREIMAGE_MISMATCH:${change.parsedElementIndex}`);
    }
    return Object.freeze({
      kind: 'ELEMENT_SIF_TEE_POINTER', byteStart, byteEnd, beforeField,
      afterField: integerField(change.newPointer, FIELD_WIDTH, `CII_WRITER_2_SIF_POINTER_AFTER:${change.parsedElementIndex}`),
      parsedElementIndex: Number(change.parsedElementIndex), oldPointer: Number(change.oldPointer), newPointer: Number(change.newPointer),
    });
  }));
}
function sifPayloadReplacement(targetDocument, relocationPlan) {
  const envelope = rawSectionEnvelope(targetDocument?.physicalFile);
  const original = String(targetDocument?.physicalFile?.originalByteString ?? '');
  const expectedRows = Number(relocationPlan.blockCountBefore) * SIF_BLOCK_ROWS;
  if (envelope.rows.length !== expectedRows) {
    throw new Error(`CII_WRITER_2_SIF_RAW_ROW_COUNT_MISMATCH:${envelope.rows.length}:${expectedRows}`);
  }
  const retained = [];
  for (const pointer of relocationPlan.retainedPointers || []) {
    const start = (Number(pointer) - 1) * SIF_BLOCK_ROWS;
    const blockRows = envelope.rows.slice(start, start + SIF_BLOCK_ROWS);
    if (blockRows.length !== SIF_BLOCK_ROWS) throw new Error(`CII_WRITER_2_SIF_BLOCK_TRUNCATED:${pointer}`);
    for (const row of blockRows) {
      if (row.lineEnding === 'NONE') throw new Error(`CII_WRITER_2_SIF_ROW_LINE_ENDING_REQUIRED:${pointer}:${row.lineNumber}`);
      retained.push(original.slice(Number(row.byteStart), Number(row.byteEnd)));
    }
  }
  return Object.freeze({
    kind: 'SIF_TEE_SECTION_PAYLOAD', byteStart: Number(envelope.marker.byteEnd), byteEnd: Number(envelope.nextMarker.byteStart),
    beforeField: original.slice(Number(envelope.marker.byteEnd), Number(envelope.nextMarker.byteStart)), afterField: retained.join(''),
    blockCountBefore: Number(relocationPlan.blockCountBefore), blockCountAfter: Number(relocationPlan.blockCountAfter),
    deletedPointers: Object.freeze([...(relocationPlan.deletedPointers || [])]),
  });
}
function assertDisjoint(replacements) {
  const sorted = [...replacements].sort((a, b) => a.byteStart - b.byteStart || a.byteEnd - b.byteEnd);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].byteStart < sorted[index - 1].byteEnd) {
      throw new Error(`CII_WRITER_2_SIF_REPLACEMENT_OVERLAP:${sorted[index - 1].kind}:${sorted[index].kind}`);
    }
  }
  return sorted;
}
function applyReplacements(original, replacements) {
  let cursor = 0; let output = '';
  for (const replacement of replacements) {
    if (original.slice(replacement.byteStart, replacement.byteEnd) !== replacement.beforeField) {
      throw new Error(`CII_WRITER_2_SIF_STALE_PREIMAGE:${replacement.kind}:${replacement.byteStart}`);
    }
    output += original.slice(cursor, replacement.byteStart);
    output += replacement.afterField;
    cursor = replacement.byteEnd;
  }
  return output + original.slice(cursor);
}
function byteStringToBytes(value) {
  const text = String(value ?? ''); const out = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) out[index] = text.charCodeAt(index) & 0xff;
  return out;
}

export function applyCiiWriter2SifDeleteRelocation({ targetDocument, targetGraph, transferPlan }) {
  const relocationPlan = buildCiiWriter2SifDeleteRelocationPlan({ targetDocument, targetGraph, transferPlan });
  if (!relocationPlan.ready) throw new Error(`CII_WRITER_2_SIF_DELETE_RELOCATION_BLOCKED:${relocationPlan.blockers.join('|')}`);
  const original = String(targetDocument?.physicalFile?.originalByteString ?? '');
  if (!original || targetDocument?.writer1CByteEligible !== true) throw new Error('CII_WRITER_2_SIF_ORIGINAL_BYTE_AUTHORITY_REQUIRED');
  if (relocationPlan.createAuthority?.ready !== false) throw new Error('CII_WRITER_2_SIF_CREATE_AUTHORITY_MUST_REMAIN_BLOCKED');
  const replacements = assertDisjoint([
    controlReplacement(targetDocument, relocationPlan), ...pointerReplacements(targetDocument, relocationPlan),
    sifPayloadReplacement(targetDocument, relocationPlan),
  ]).filter((item) => item.beforeField !== item.afterField);
  const byteString = applyReplacements(original, replacements); const bytes = byteStringToBytes(byteString);
  return Object.freeze({
    schema: 'CIIWorkspaceWriter2SifDeleteResult.v1', status: 'APPLIED', writer: 'WRITER_2', family: 'SIF_TEE_DELETE',
    byteString, bytes, text: new TextDecoder('utf-8').decode(bytes),
    byteLengthBefore: original.length, byteLengthAfter: byteString.length,
    blockCountBefore: relocationPlan.blockCountBefore, blockCountAfter: relocationPlan.blockCountAfter,
    mutationCount: replacements.length, mutations: Object.freeze(replacements), relocationPlan,
  });
}

export const _test = Object.freeze({ markerName, integerField, rawSectionEnvelope, controlReplacement,
  pointerReplacements, sifPayloadReplacement, assertDisjoint, applyReplacements });
