import { buildCiiWriter2NodeNameRelocationPlan } from './cii-workspace-writer2-nodename-relocation.js';

const NODENAME_MARKER = 'NODENAME';
const CONTROL_FIELD_WIDTH = 13;
const POINTER_FIELD_WIDTH = 13;

function markerName(text) {
  const match = String(text ?? '').match(/^\s*#\$\s*(.*?)\s*$/);
  return match ? match[1].trim().toUpperCase() : null;
}
function ascii(value, code) {
  const text = String(value ?? '');
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) > 0x7f) throw new Error(`${code}:NON_ASCII`);
  }
  return text;
}
function integerField(value, width, code) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`${code}:INVALID_INTEGER`);
  const token = String(number);
  if (token.length > width) throw new Error(`${code}:OVERFLOW:${token.length}>${width}`);
  return token.padStart(width, ' ');
}
function rawSectionEnvelope(physicalFile, wanted) {
  const lines = physicalFile?.lines || [];
  const markerIndex = lines.findIndex((line) => markerName(line.text) === wanted);
  if (markerIndex < 0) throw new Error(`CII_WRITER_2_SECTION_NOT_FOUND:${wanted}`);
  let nextIndex = markerIndex + 1;
  while (nextIndex < lines.length && markerName(lines[nextIndex].text) === null) nextIndex += 1;
  if (nextIndex >= lines.length) throw new Error(`CII_WRITER_2_SECTION_NEXT_MARKER_REQUIRED:${wanted}`);
  return Object.freeze({ markerIndex, nextIndex, marker: lines[markerIndex], nextMarker: lines[nextIndex], rows: lines.slice(markerIndex + 1, nextIndex) });
}
function lineEndingText(kind) {
  if (kind === 'CRLF') return '\r\n';
  if (kind === 'LF') return '\n';
  if (kind === 'CR') return '\r';
  if (kind === 'NONE') return '';
  throw new Error(`CII_WRITER_2_LINE_ENDING_UNSUPPORTED:${kind || 'EMPTY'}`);
}
function nodenamePayloadReplacement(targetDocument, relocationPlan) {
  const envelope = rawSectionEnvelope(targetDocument?.physicalFile, NODENAME_MARKER);
  if (envelope.rows.some((row) => !String(row.text || '').trim())) throw new Error('CII_WRITER_2_NODENAME_BLANK_PHYSICAL_ROWS_UNSUPPORTED');
  if (envelope.rows.some((row) => String(row.text || '').length !== 53)) throw new Error('CII_WRITER_2_NODENAME_ROW_WIDTH_NOT_53');
  if (envelope.rows.length !== Number(relocationPlan.rowCountBefore)) {
    throw new Error(`CII_WRITER_2_NODENAME_RAW_ROW_COUNT_MISMATCH:${envelope.rows.length}:${relocationPlan.rowCountBefore}`);
  }
  const appendEnding = envelope.rows.length ? envelope.rows[envelope.rows.length - 1].lineEnding : envelope.marker.lineEnding;
  if (relocationPlan.finalRows.length && appendEnding === 'NONE') throw new Error('CII_WRITER_2_NODENAME_APPEND_LINE_ENDING_REQUIRED');
  const body = relocationPlan.finalRows.map((row) => {
    const ending = row.oldPointer == null ? appendEnding : envelope.rows[Number(row.oldPointer) - 1]?.lineEnding;
    if (!ending || ending === 'NONE') throw new Error(`CII_WRITER_2_NODENAME_ROW_LINE_ENDING_REQUIRED:${row.oldPointer ?? 'NEW'}`);
    return `${ascii(row.rowText, 'CII_WRITER_2_NODENAME_ROW')}${lineEndingText(ending)}`;
  }).join('');
  return Object.freeze({
    kind: 'NODENAME_SECTION_PAYLOAD', byteStart: Number(envelope.marker.byteEnd), byteEnd: Number(envelope.nextMarker.byteStart),
    beforeField: String(targetDocument.physicalFile.originalByteString).slice(envelope.marker.byteEnd, envelope.nextMarker.byteStart), afterField: body,
    rowCountBefore: relocationPlan.rowCountBefore, rowCountAfter: relocationPlan.rowCountAfter,
  });
}
function controlReplacement(targetDocument, relocationPlan) {
  const lines = targetDocument?.physicalFile?.lines || [];
  const markerIndex = lines.findIndex((line) => markerName(line.text) === 'CONTROL');
  const row = markerIndex >= 0 ? lines[markerIndex + 1] : null;
  if (!row) throw new Error('CII_WRITER_2_CONTROL_ROW_REQUIRED');
  const startColumn = 15 + 13 + 13;
  const byteStart = Number(row.byteStart) + startColumn; const byteEnd = byteStart + CONTROL_FIELD_WIDTH;
  const bytes = String(targetDocument.physicalFile.originalByteString);
  const beforeField = bytes.slice(byteStart, byteEnd);
  const expectedBefore = integerField(relocationPlan.controlCountBefore, CONTROL_FIELD_WIDTH, 'CII_WRITER_2_CONTROL_BEFORE');
  if (Number(relocationPlan.controlCountBefore) !== Number(relocationPlan.rowCountBefore)) throw new Error('CII_WRITER_2_CONTROL_PLAN_PRECOUNT_MISMATCH');
  if (beforeField !== expectedBefore) throw new Error('CII_WRITER_2_CONTROL_PREIMAGE_FORMAT_MISMATCH');
  return Object.freeze({
    kind: 'CONTROL_NONAM', byteStart, byteEnd, beforeField,
    afterField: integerField(relocationPlan.controlCountAfter, CONTROL_FIELD_WIDTH, 'CII_WRITER_2_CONTROL_AFTER'),
    expectedNumericBefore: Number(relocationPlan.controlCountBefore), expectedFormattedBefore: expectedBefore,
  });
}
function pointerReplacements(targetDocument, relocationPlan) {
  const bytes = String(targetDocument?.physicalFile?.originalByteString ?? '');
  return Object.freeze((relocationPlan.pointerChanges || []).map((change) => {
    const field = change.pointerField || {}; const byteStart = Number(field.byteStart); const byteEnd = Number(field.byteEnd);
    if (!Number.isSafeInteger(byteStart) || !Number.isSafeInteger(byteEnd) || byteEnd - byteStart !== POINTER_FIELD_WIDTH) {
      throw new Error(`CII_WRITER_2_POINTER_SPAN_INVALID:${change.parsedElementIndex}`);
    }
    const beforeField = bytes.slice(byteStart, byteEnd);
    if (field.rawField != null && beforeField !== field.rawField) throw new Error(`CII_WRITER_2_POINTER_PREIMAGE_MISMATCH:${change.parsedElementIndex}`);
    return Object.freeze({
      kind: 'ELEMENT_NODENAME_POINTER', byteStart, byteEnd, beforeField,
      afterField: integerField(change.newPointer, POINTER_FIELD_WIDTH, `CII_WRITER_2_POINTER_AFTER:${change.parsedElementIndex}`),
      parsedElementIndex: change.parsedElementIndex, oldPointer: change.oldPointer, newPointer: change.newPointer,
    });
  }));
}
function assertDisjoint(replacements) {
  const sorted = [...replacements].sort((a, b) => a.byteStart - b.byteStart || a.byteEnd - b.byteEnd);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].byteStart < sorted[index - 1].byteEnd) {
      throw new Error(`CII_WRITER_2_REPLACEMENT_OVERLAP:${sorted[index - 1].kind}:${sorted[index].kind}`);
    }
  }
  return sorted;
}
function applyReplacements(original, replacements) {
  let cursor = 0; let output = '';
  for (const replacement of replacements) {
    if (original.slice(replacement.byteStart, replacement.byteEnd) !== replacement.beforeField) {
      throw new Error(`CII_WRITER_2_STALE_PREIMAGE:${replacement.kind}:${replacement.byteStart}`);
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

export function applyCiiWriter2NodeNameRelocation({ targetDocument, transferPlan }) {
  const relocationPlan = buildCiiWriter2NodeNameRelocationPlan({ targetDocument, transferPlan });
  if (!relocationPlan.ready) throw new Error(`CII_WRITER_2_NODENAME_RELOCATION_BLOCKED:${relocationPlan.blockers.join('|')}`);
  const original = String(targetDocument?.physicalFile?.originalByteString ?? '');
  if (!original || targetDocument?.writer1CByteEligible !== true) throw new Error('CII_WRITER_2_ORIGINAL_BYTE_AUTHORITY_REQUIRED');
  const replacements = assertDisjoint([
    controlReplacement(targetDocument, relocationPlan), ...pointerReplacements(targetDocument, relocationPlan),
    nodenamePayloadReplacement(targetDocument, relocationPlan),
  ]).filter((item) => item.beforeField !== item.afterField);
  const byteString = applyReplacements(original, replacements); const bytes = byteStringToBytes(byteString);
  return Object.freeze({
    schema: 'CIIWorkspaceWriter2NodeNameResult.v1', status: 'APPLIED', writer: 'WRITER_2',
    byteString, bytes, text: new TextDecoder('utf-8').decode(bytes), byteLengthBefore: original.length, byteLengthAfter: byteString.length,
    rowCountBefore: relocationPlan.rowCountBefore, rowCountAfter: relocationPlan.rowCountAfter,
    mutationCount: replacements.length, mutations: Object.freeze(replacements), relocationPlan,
  });
}

export const _test = Object.freeze({ markerName, rawSectionEnvelope, lineEndingText, applyReplacements, integerField });
