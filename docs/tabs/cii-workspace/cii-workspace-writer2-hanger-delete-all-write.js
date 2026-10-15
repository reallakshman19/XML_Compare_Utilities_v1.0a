import { buildCiiWriter2HangerDeletePlan } from './cii-workspace-writer2-hanger-delete.js';

const FIELD_WIDTH = 13;
const EXECUTION_ROWS = 4;

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
function rawSectionEnvelope(physicalFile, section) {
  const lines = physicalFile?.lines || [];
  const wanted = String(section || '').trim().toUpperCase();
  const markerIndex = lines.findIndex((line) => markerName(line.text) === wanted);
  if (markerIndex < 0) throw new Error(`CII_WRITER_2_HANGER_SECTION_NOT_FOUND:${wanted}`);
  let nextIndex = markerIndex + 1;
  while (nextIndex < lines.length && markerName(lines[nextIndex].text) === null) nextIndex += 1;
  if (nextIndex >= lines.length) throw new Error(`CII_WRITER_2_HANGER_SECTION_NEXT_MARKER_REQUIRED:${wanted}`);
  return Object.freeze({
    markerIndex, nextIndex, marker: lines[markerIndex], nextMarker: lines[nextIndex],
    rows: Object.freeze(lines.slice(markerIndex + 1, nextIndex)),
  });
}
function controlReplacement(targetDocument, deletePlan) {
  const original = String(targetDocument?.physicalFile?.originalByteString ?? '');
  const custody = deletePlan?.physicalCustody?.control || {};
  const byteStart = Number(custody.byteStart); const byteEnd = Number(custody.byteEnd);
  if (!Number.isSafeInteger(byteStart) || !Number.isSafeInteger(byteEnd) || byteEnd - byteStart !== FIELD_WIDTH) {
    throw new Error('CII_WRITER_2_HANGER_CONTROL_SPAN_INVALID');
  }
  if (Number(deletePlan.controlCountBefore) !== Number(deletePlan.countBefore)) {
    throw new Error('CII_WRITER_2_HANGER_CONTROL_PLAN_PRECOUNT_MISMATCH');
  }
  const beforeField = original.slice(byteStart, byteEnd);
  const expectedBefore = integerField(deletePlan.controlCountBefore, FIELD_WIDTH, 'CII_WRITER_2_HANGER_CONTROL_BEFORE');
  if (custody.beforeField != null && beforeField !== custody.beforeField) {
    throw new Error('CII_WRITER_2_HANGER_CONTROL_CUSTODY_PREIMAGE_MISMATCH');
  }
  if (beforeField !== expectedBefore) throw new Error('CII_WRITER_2_HANGER_CONTROL_PREIMAGE_FORMAT_MISMATCH');
  return Object.freeze({
    kind: 'CONTROL_HANGER_COUNT', byteStart, byteEnd, beforeField,
    afterField: integerField(0, FIELD_WIDTH, 'CII_WRITER_2_HANGER_CONTROL_AFTER'),
    expectedNumericBefore: Number(deletePlan.controlCountBefore), expectedNumericAfter: 0,
  });
}
function payloadReplacement(targetDocument, deletePlan) {
  const physicalFile = targetDocument?.physicalFile;
  const envelope = rawSectionEnvelope(physicalFile, 'MISCEL_1');
  const original = String(physicalFile?.originalByteString ?? '');
  const expectedRows = Number(deletePlan?.physicalCustody?.expectedRowCount);
  if (!Number.isSafeInteger(expectedRows) || envelope.rows.length !== expectedRows) {
    throw new Error(`CII_WRITER_2_HANGER_MISCEL_RAW_ROW_COUNT_MISMATCH:${envelope.rows.length}:${expectedRows}`);
  }
  const prefixCount = Number(deletePlan?.physicalCustody?.rrmatRows || 0) + Number(deletePlan?.physicalCustody?.nozzleRows || 0);
  if (!Number.isSafeInteger(prefixCount) || prefixCount < 0 || prefixCount + EXECUTION_ROWS > envelope.rows.length) {
    throw new Error('CII_WRITER_2_HANGER_MISCEL_PREFIX_SUFFIX_COUNT_INVALID');
  }
  const retainedRows = [
    ...envelope.rows.slice(0, prefixCount),
    ...envelope.rows.slice(envelope.rows.length - EXECUTION_ROWS),
  ];
  const expectedAfterRows = Number(deletePlan?.compaction?.expectedMiscelRowsAfter);
  if (retainedRows.length !== expectedAfterRows) {
    throw new Error(`CII_WRITER_2_HANGER_MISCEL_POST_ROW_COUNT_MISMATCH:${retainedRows.length}:${expectedAfterRows}`);
  }
  const retained = [];
  for (const row of retainedRows) {
    if (row.lineEnding === 'NONE') throw new Error(`CII_WRITER_2_HANGER_RETAINED_ROW_LINE_ENDING_REQUIRED:${row.lineNumber}`);
    retained.push(original.slice(Number(row.byteStart), Number(row.byteEnd)));
  }
  const byteStart = Number(envelope.marker.byteEnd); const byteEnd = Number(envelope.nextMarker.byteStart);
  const beforeField = original.slice(byteStart, byteEnd);
  const plannedBefore = String(deletePlan?.physicalCustody?.miscelPayload?.beforeField ?? '');
  if (plannedBefore && plannedBefore !== beforeField) throw new Error('CII_WRITER_2_HANGER_MISCEL_PLAN_PREIMAGE_MISMATCH');
  return Object.freeze({
    kind: 'MISCEL_1_HANGER_DELETE_ALL_PAYLOAD', byteStart, byteEnd, beforeField, afterField: retained.join(''),
    rowCountBefore: envelope.rows.length, rowCountAfter: retainedRows.length,
    retainedPrefixRowCount: prefixCount, retainedExecutionRowCount: EXECUTION_ROWS,
  });
}
function assertDisjoint(replacements) {
  const sorted = [...replacements].sort((a, b) => a.byteStart - b.byteStart || a.byteEnd - b.byteEnd);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].byteStart < sorted[index - 1].byteEnd) {
      throw new Error(`CII_WRITER_2_HANGER_REPLACEMENT_OVERLAP:${sorted[index - 1].kind}:${sorted[index].kind}`);
    }
  }
  return sorted;
}
function applyReplacements(original, replacements) {
  let cursor = 0; let output = '';
  for (const replacement of replacements) {
    if (original.slice(replacement.byteStart, replacement.byteEnd) !== replacement.beforeField) {
      throw new Error(`CII_WRITER_2_HANGER_STALE_PREIMAGE:${replacement.kind}:${replacement.byteStart}`);
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

export function applyCiiWriter2HangerDeleteAll({ targetDocument, transferPlan }) {
  const deletePlan = buildCiiWriter2HangerDeletePlan({ targetDocument, transferPlan });
  if (!deletePlan.ready) throw new Error(`CII_WRITER_2_HANGER_DELETE_ALL_BLOCKED:${deletePlan.blockers.join('|')}`);
  if (deletePlan?.compaction?.deleteAll !== true || Number(deletePlan.countAfter) !== 0) {
    throw new Error('CII_WRITER_2_HANGER_DELETE_ALL_SCOPE_REQUIRED');
  }
  if (deletePlan.createAuthority?.ready !== false) throw new Error('CII_WRITER_2_HANGER_CREATE_AUTHORITY_MUST_REMAIN_BLOCKED');
  const original = String(targetDocument?.physicalFile?.originalByteString ?? '');
  if (!original || targetDocument?.writer1CByteEligible !== true) throw new Error('CII_WRITER_2_HANGER_ORIGINAL_BYTE_AUTHORITY_REQUIRED');
  const replacements = assertDisjoint([
    controlReplacement(targetDocument, deletePlan), payloadReplacement(targetDocument, deletePlan),
  ]).filter((item) => item.beforeField !== item.afterField);
  const byteString = applyReplacements(original, replacements); const bytes = byteStringToBytes(byteString);
  return Object.freeze({
    schema: 'CIIWorkspaceWriter2HangerDeleteAllResult.v1', status: 'APPLIED', writer: 'WRITER_2', family: 'HANGER_DELETE_ALL',
    byteString, bytes, text: new TextDecoder('utf-8').decode(bytes),
    byteLengthBefore: original.length, byteLengthAfter: byteString.length,
    hangerCountBefore: deletePlan.countBefore, hangerCountAfter: 0,
    mutationCount: replacements.length, mutations: Object.freeze(replacements), deletePlan,
  });
}

export const _test = Object.freeze({ markerName, integerField, rawSectionEnvelope, controlReplacement,
  payloadReplacement, assertDisjoint, applyReplacements });
