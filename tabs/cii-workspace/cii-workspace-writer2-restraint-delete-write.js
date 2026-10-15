import { createCiiPhysicalFile } from './cii-workspace-physical-file.js';
import { isCiiSha256Hex, sha256CiiByteString } from './cii-workspace-byte-sha256.js';
import {
  buildCiiWriter2RestraintDeleteCompactionPlan,
  CII_WRITER_2_RESTRAINT_CREATE_BLOCKER,
} from './cii-workspace-writer2-restraint-delete-compaction-plan.js';

export const CII_WRITER_2_RESTRAINT_DELETE_PHYSICAL_AUTHORITY =
  'CII_WRITER_2_RESTRAINT_BLOCK_DELETE_PHYSICAL_WRITE';
export const CII_WRITER_2_RESTRAINT_TARGET0_HASH_AUTHORITY = 'SHA256_ORIGINAL_TARGET0_BYTES';
export const CII_WRITER_2_RESTRAINT_POSTIMAGE_HASH_AUTHORITY = 'SHA256_WRITER2_POSTIMAGE_BYTES';
export const CII_WRITER_2_RESTRAINT_POSTIMAGE_REPRESENTATION_AUTHORITY =
  'CII_PHYSICAL_POSTIMAGE_REINTAKE_EQUIVALENCE';

const FIELD_WIDTHS = Object.freeze([15, 13, 13, 13, 13, 13]);
const FIELD_WIDTH = 13;
const CONTROL_COUNT_ROW_INDEX = 1;
const CONTROL_COUNT_FIELD_INDEX = 3;
const BLOCK_ROWS = 24;

function markerName(value) {
  const match = String(value ?? '').match(/^\s*#\$\s*(.*?)\s*$/);
  return match ? match[1].trim().toUpperCase() : null;
}
function integerField(value, code) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`${code}:INVALID_INTEGER`);
  const token = String(number);
  if (token.length > FIELD_WIDTH) throw new Error(`${code}:OVERFLOW:${token.length}>${FIELD_WIDTH}`);
  return token.padStart(FIELD_WIDTH, ' ');
}
function byteStringToBytes(value) {
  const text = String(value ?? ''); const out = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code > 0xff) throw new Error(`CII_WRITER_2_RESTRAINT_NON_BYTE_CODE_UNIT:${index}:${code}`);
    out[index] = code;
  }
  return out;
}
function rawSectionEnvelope(physicalFile, section) {
  const lines = physicalFile?.lines || []; const wanted = String(section || '').trim().toUpperCase();
  const markerIndex = lines.findIndex((line) => markerName(line.text) === wanted);
  if (markerIndex < 0) throw new Error(`CII_WRITER_2_RESTRAINT_SECTION_NOT_FOUND:${wanted}`);
  let nextIndex = markerIndex + 1;
  while (nextIndex < lines.length && markerName(lines[nextIndex].text) === null) nextIndex += 1;
  if (nextIndex >= lines.length) throw new Error(`CII_WRITER_2_RESTRAINT_NEXT_SECTION_REQUIRED:${wanted}`);
  const rows = lines.slice(markerIndex + 1, nextIndex);
  if (rows.some((row) => !String(row.text ?? '').trim())) throw new Error(`CII_WRITER_2_RESTRAINT_BLANK_SECTION_ROW_UNQUALIFIED:${wanted}`);
  return Object.freeze({ marker: lines[markerIndex], nextMarker: lines[nextIndex], rows: Object.freeze(rows) });
}
function target0HashCustody(targetDocument) {
  const physicalFile = targetDocument?.physicalFile; const original = String(physicalFile?.originalByteString ?? '');
  const declared = String(targetDocument?.contentSha256 ?? '').trim();
  if (!isCiiSha256Hex(declared)) throw new Error('CII_WRITER_2_RESTRAINT_TARGET0_SHA256_FORMAT_REQUIRED');
  if (!original || Number(physicalFile?.byteLength) !== original.length) throw new Error('CII_WRITER_2_RESTRAINT_TARGET0_BYTE_LENGTH_MISMATCH');
  if (targetDocument?.byteLength != null && Number(targetDocument.byteLength) !== original.length) {
    throw new Error('CII_WRITER_2_RESTRAINT_TARGET0_DOCUMENT_BYTE_LENGTH_MISMATCH');
  }
  const actual = sha256CiiByteString(original);
  if (actual !== declared) throw new Error('CII_WRITER_2_RESTRAINT_TARGET0_SHA256_MISMATCH');
  return Object.freeze({ authority: CII_WRITER_2_RESTRAINT_TARGET0_HASH_AUTHORITY, contentSha256: actual, byteLength: original.length });
}
function controlReplacement(targetDocument, plan) {
  const lines = targetDocument?.physicalFile?.lines || [];
  const markerIndex = lines.findIndex((line) => markerName(line.text) === 'CONTROL');
  const row = markerIndex >= 0 ? lines[markerIndex + 1 + CONTROL_COUNT_ROW_INDEX] : null;
  if (!row) throw new Error('CII_WRITER_2_RESTRAINT_CONTROL_ROW2_REQUIRED');
  const startColumn = FIELD_WIDTHS.slice(0, CONTROL_COUNT_FIELD_INDEX).reduce((sum, width) => sum + width, 0);
  const byteStart = Number(row.byteStart) + startColumn; const byteEnd = byteStart + FIELD_WIDTH;
  const original = String(targetDocument?.physicalFile?.originalByteString ?? '');
  const beforeField = original.slice(byteStart, byteEnd);
  const expectedBefore = integerField(plan.controlCountBefore, 'CII_WRITER_2_RESTRAINT_CONTROL_BEFORE');
  if (Number(plan.controlCountBefore) !== Number(plan.blockCountBefore)) throw new Error('CII_WRITER_2_RESTRAINT_CONTROL_PLAN_PRECOUNT_MISMATCH');
  if (beforeField !== expectedBefore) throw new Error('CII_WRITER_2_RESTRAINT_CONTROL_PREIMAGE_FORMAT_MISMATCH');
  return Object.freeze({
    kind: 'CONTROL_RESTRAINT_BLOCK_COUNT', byteStart, byteEnd, beforeField,
    afterField: integerField(plan.controlCountAfter, 'CII_WRITER_2_RESTRAINT_CONTROL_AFTER'),
    oldCount: Number(plan.controlCountBefore), newCount: Number(plan.controlCountAfter),
  });
}
function pointerReplacements(targetDocument, plan) {
  const original = String(targetDocument?.physicalFile?.originalByteString ?? '');
  return Object.freeze((plan.pointerChanges || []).map((change) => {
    const field = change?.pointerField || {}; const byteStart = Number(field.byteStart); const byteEnd = Number(field.byteEnd);
    if (!Number.isSafeInteger(byteStart) || !Number.isSafeInteger(byteEnd) || byteEnd - byteStart !== FIELD_WIDTH) {
      throw new Error(`CII_WRITER_2_RESTRAINT_POINTER_SPAN_INVALID:${change?.parsedElementIndex}`);
    }
    const beforeField = original.slice(byteStart, byteEnd);
    if (typeof field.rawField !== 'string' || beforeField !== field.rawField) {
      throw new Error(`CII_WRITER_2_RESTRAINT_POINTER_PREIMAGE_MISMATCH:${change?.parsedElementIndex}`);
    }
    if (Number(field.pointer) !== Number(change.oldPointer)) {
      throw new Error(`CII_WRITER_2_RESTRAINT_POINTER_PLAN_PREIMAGE_MISMATCH:${change?.parsedElementIndex}`);
    }
    return Object.freeze({
      kind: 'ELEMENT_RESTRAINT_POINTER', byteStart, byteEnd, beforeField,
      afterField: integerField(change.newPointer, `CII_WRITER_2_RESTRAINT_POINTER_AFTER:${change.parsedElementIndex}`),
      parsedElementIndex: Number(change.parsedElementIndex), oldPointer: Number(change.oldPointer), newPointer: Number(change.newPointer),
    });
  }));
}
function restraintPayloadReplacement(targetDocument, plan) {
  const envelope = rawSectionEnvelope(targetDocument?.physicalFile, 'RESTRANT');
  const original = String(targetDocument?.physicalFile?.originalByteString ?? '');
  const expectedRows = Number(plan.blockCountBefore) * BLOCK_ROWS;
  if (envelope.rows.length !== expectedRows) throw new Error(`CII_WRITER_2_RESTRAINT_RAW_ROW_COUNT_MISMATCH:${envelope.rows.length}:${expectedRows}`);
  const retained = [];
  for (const pointer of plan.retainedPointers || []) {
    const start = (Number(pointer) - 1) * BLOCK_ROWS;
    const block = envelope.rows.slice(start, start + BLOCK_ROWS);
    if (block.length !== BLOCK_ROWS) throw new Error(`CII_WRITER_2_RESTRAINT_BLOCK_TRUNCATED:${pointer}`);
    for (const row of block) {
      if (row.lineEnding === 'NONE') throw new Error(`CII_WRITER_2_RESTRAINT_ROW_LINE_ENDING_REQUIRED:${pointer}:${row.lineNumber}`);
      retained.push(original.slice(Number(row.byteStart), Number(row.byteEnd)));
    }
  }
  const byteStart = Number(envelope.marker.byteEnd); const byteEnd = Number(envelope.nextMarker.byteStart);
  return Object.freeze({
    kind: 'RESTRAINT_SECTION_PAYLOAD', byteStart, byteEnd,
    beforeField: original.slice(byteStart, byteEnd), afterField: retained.join(''),
    blockCountBefore: Number(plan.blockCountBefore), blockCountAfter: Number(plan.blockCountAfter),
    deletedPointers: Object.freeze([...(plan.deletedPointers || [])]), retainedPointers: Object.freeze([...(plan.retainedPointers || [])]),
  });
}
function assertDisjoint(replacements) {
  const sorted = [...replacements].sort((a, b) => a.byteStart - b.byteStart || a.byteEnd - b.byteEnd);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].byteStart < sorted[index - 1].byteEnd) {
      throw new Error(`CII_WRITER_2_RESTRAINT_REPLACEMENT_OVERLAP:${sorted[index - 1].kind}:${sorted[index].kind}`);
    }
  }
  return Object.freeze(sorted);
}
function applyReplacements(original, replacements) {
  let cursor = 0; let output = '';
  for (const replacement of replacements) {
    if (original.slice(replacement.byteStart, replacement.byteEnd) !== replacement.beforeField) {
      throw new Error(`CII_WRITER_2_RESTRAINT_STALE_PREIMAGE:${replacement.kind}:${replacement.byteStart}`);
    }
    output += original.slice(cursor, replacement.byteStart);
    output += replacement.afterField;
    cursor = replacement.byteEnd;
  }
  return output + original.slice(cursor);
}
function representationCustody(physicalFile) {
  return Object.freeze({
    authority: CII_WRITER_2_RESTRAINT_POSTIMAGE_REPRESENTATION_AUTHORITY,
    byteLength: Number(physicalFile.byteLength), textLength: String(physicalFile.text ?? '').length,
    textEncodingAuthority: physicalFile.textEncodingAuthority,
    lineCount: (physicalFile.lines || []).length,
    lineEndingStyle: physicalFile.lineEndings?.style || null,
    finalLineTerminated: physicalFile.lineEndings?.finalLineTerminated === true,
  });
}

export function applyCiiWriter2RestraintDeleteCompaction({ targetDocument, transferPlan }) {
  const target0Custody = target0HashCustody(targetDocument);
  const plan = buildCiiWriter2RestraintDeleteCompactionPlan({ targetDocument, transferPlan });
  if (!plan?.ready) throw new Error(`CII_WRITER_2_RESTRAINT_DELETE_BLOCKED:${(plan?.blockers || []).join('|')}`);
  if (plan?.createAuthority?.ready !== false || plan?.createAuthority?.blocker !== CII_WRITER_2_RESTRAINT_CREATE_BLOCKER) {
    throw new Error('CII_WRITER_2_RESTRAINT_CREATE_AUTHORITY_MUST_REMAIN_BLOCKED');
  }
  const original = String(targetDocument?.physicalFile?.originalByteString ?? '');
  const replacements = Object.freeze(assertDisjoint([
    controlReplacement(targetDocument, plan), ...pointerReplacements(targetDocument, plan), restraintPayloadReplacement(targetDocument, plan),
  ]).filter((item) => item.beforeField !== item.afterField));
  const byteString = applyReplacements(original, replacements);
  const bytes = byteStringToBytes(byteString);
  const canonicalPostimage = createCiiPhysicalFile(bytes);
  if (canonicalPostimage.originalByteString !== byteString) throw new Error('CII_WRITER_2_RESTRAINT_POSTIMAGE_REINTAKE_BYTE_MISMATCH');
  const postimageHashCustody = Object.freeze({
    authority: CII_WRITER_2_RESTRAINT_POSTIMAGE_HASH_AUTHORITY,
    contentSha256: sha256CiiByteString(byteString), byteLength: byteString.length,
  });
  return Object.freeze({
    schema: 'CIIWorkspaceWriter2RestraintDeleteResult.v1', status: 'APPLIED', writer: 'WRITER_2', family: 'RESTRAINT_BLOCK_DELETE',
    authority: CII_WRITER_2_RESTRAINT_DELETE_PHYSICAL_AUTHORITY,
    byteString, bytes, text: canonicalPostimage.text,
    byteLengthBefore: original.length, byteLengthAfter: byteString.length,
    blockCountBefore: Number(plan.blockCountBefore), blockCountAfter: Number(plan.blockCountAfter),
    target0HashCustody: target0Custody, postimageHashCustody, postimageRepresentationCustody: representationCustody(canonicalPostimage),
    mutationCount: replacements.length, mutations: replacements, relocationPlan: plan,
  });
}

export const _test = Object.freeze({
  markerName, integerField, byteStringToBytes, rawSectionEnvelope, target0HashCustody,
  controlReplacement, pointerReplacements, restraintPayloadReplacement, assertDisjoint, applyReplacements, representationCustody,
});