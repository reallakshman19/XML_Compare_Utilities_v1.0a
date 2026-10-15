import { stableStringify } from './cii-workspace-contracts.js';
import { createCiiPhysicalFile } from './cii-workspace-physical-file.js';
import { isCiiSha256Hex, sha256CiiByteString } from './cii-workspace-byte-sha256.js';
import { buildCiiWriter2RestraintDeleteCompactionPlan } from './cii-workspace-writer2-restraint-delete-compaction-plan.js';

const FIELD_WIDTHS = Object.freeze([15, 13, 13, 13, 13, 13]);
const FIELD_WIDTH = 13;
const CONTROL_COUNT_ROW_INDEX = 1;
const CONTROL_COUNT_FIELD_INDEX = 3;
const BLOCK_ROWS = 24;
const TARGET0_HASH_AUTHORITY = 'SHA256_ORIGINAL_TARGET0_BYTES';
const POSTIMAGE_HASH_AUTHORITY = 'SHA256_WRITER2_POSTIMAGE_BYTES';
const POSTIMAGE_REPRESENTATION_AUTHORITY = 'CII_PHYSICAL_POSTIMAGE_REINTAKE_EQUIVALENCE';
const PHYSICAL_WRITE_AUTHORITY = 'CII_WRITER_2_RESTRAINT_BLOCK_DELETE_PHYSICAL_WRITE';

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
    if (code > 0xff) throw new Error(`CII_WRITER_2_RESTRAINT_VALIDATOR_NON_BYTE_CODE_UNIT:${index}:${code}`);
    out[index] = code;
  }
  return out;
}
function rawSectionEnvelope(physicalFile, section) {
  const lines = physicalFile?.lines || []; const wanted = String(section || '').trim().toUpperCase();
  const markerIndex = lines.findIndex((line) => markerName(line.text) === wanted);
  if (markerIndex < 0) throw new Error(`CII_WRITER_2_RESTRAINT_VALIDATOR_SECTION_NOT_FOUND:${wanted}`);
  let nextIndex = markerIndex + 1;
  while (nextIndex < lines.length && markerName(lines[nextIndex].text) === null) nextIndex += 1;
  if (nextIndex >= lines.length) throw new Error(`CII_WRITER_2_RESTRAINT_VALIDATOR_NEXT_SECTION_REQUIRED:${wanted}`);
  const rows = lines.slice(markerIndex + 1, nextIndex);
  if (rows.some((row) => !String(row.text ?? '').trim())) throw new Error(`CII_WRITER_2_RESTRAINT_VALIDATOR_BLANK_SECTION_ROW_UNQUALIFIED:${wanted}`);
  return Object.freeze({ marker: lines[markerIndex], nextMarker: lines[nextIndex], rows: Object.freeze(rows) });
}
function independentControlReplacement(before, plan) {
  const lines = before?.physicalFile?.lines || [];
  const markerIndex = lines.findIndex((line) => markerName(line.text) === 'CONTROL');
  const row = markerIndex >= 0 ? lines[markerIndex + 1 + CONTROL_COUNT_ROW_INDEX] : null;
  if (!row) throw new Error('CII_WRITER_2_RESTRAINT_VALIDATOR_CONTROL_ROW2_REQUIRED');
  const startColumn = FIELD_WIDTHS.slice(0, CONTROL_COUNT_FIELD_INDEX).reduce((sum, width) => sum + width, 0);
  const byteStart = Number(row.byteStart) + startColumn; const byteEnd = byteStart + FIELD_WIDTH;
  const original = String(before?.physicalFile?.originalByteString ?? '');
  const beforeField = original.slice(byteStart, byteEnd);
  const expectedBefore = integerField(plan.controlCountBefore, 'CII_WRITER_2_RESTRAINT_VALIDATOR_CONTROL_BEFORE');
  if (beforeField !== expectedBefore) throw new Error('CII_WRITER_2_RESTRAINT_VALIDATOR_CONTROL_PREIMAGE_MISMATCH');
  return Object.freeze({ kind: 'CONTROL_RESTRAINT_BLOCK_COUNT', byteStart, byteEnd, beforeField,
    afterField: integerField(plan.controlCountAfter, 'CII_WRITER_2_RESTRAINT_VALIDATOR_CONTROL_AFTER'),
    oldCount: Number(plan.controlCountBefore), newCount: Number(plan.controlCountAfter) });
}
function independentPointerReplacements(before, plan) {
  const original = String(before?.physicalFile?.originalByteString ?? '');
  return Object.freeze((plan.pointerChanges || []).map((change) => {
    const field = change?.pointerField || {}; const byteStart = Number(field.byteStart); const byteEnd = Number(field.byteEnd);
    if (!Number.isSafeInteger(byteStart) || !Number.isSafeInteger(byteEnd) || byteEnd - byteStart !== FIELD_WIDTH) {
      throw new Error(`CII_WRITER_2_RESTRAINT_VALIDATOR_POINTER_SPAN_INVALID:${change?.parsedElementIndex}`);
    }
    const beforeField = original.slice(byteStart, byteEnd);
    if (typeof field.rawField !== 'string' || beforeField !== field.rawField || Number(field.pointer) !== Number(change.oldPointer)) {
      throw new Error(`CII_WRITER_2_RESTRAINT_VALIDATOR_POINTER_PREIMAGE_MISMATCH:${change?.parsedElementIndex}`);
    }
    return Object.freeze({ kind: 'ELEMENT_RESTRAINT_POINTER', byteStart, byteEnd, beforeField,
      afterField: integerField(change.newPointer, `CII_WRITER_2_RESTRAINT_VALIDATOR_POINTER_AFTER:${change.parsedElementIndex}`),
      parsedElementIndex: Number(change.parsedElementIndex), oldPointer: Number(change.oldPointer), newPointer: Number(change.newPointer) });
  }));
}
function independentRestraintReplacement(before, plan) {
  const envelope = rawSectionEnvelope(before?.physicalFile, 'RESTRANT');
  const original = String(before?.physicalFile?.originalByteString ?? '');
  if (envelope.rows.length !== Number(plan.blockCountBefore) * BLOCK_ROWS) {
    throw new Error('CII_WRITER_2_RESTRAINT_VALIDATOR_RESTRAINT_ROW_COUNT_MISMATCH');
  }
  const retained = [];
  for (const pointer of plan.retainedPointers || []) {
    const start = (Number(pointer) - 1) * BLOCK_ROWS;
    const block = envelope.rows.slice(start, start + BLOCK_ROWS);
    if (block.length !== BLOCK_ROWS) throw new Error(`CII_WRITER_2_RESTRAINT_VALIDATOR_BLOCK_TRUNCATED:${pointer}`);
    for (const row of block) {
      if (row.lineEnding === 'NONE') throw new Error(`CII_WRITER_2_RESTRAINT_VALIDATOR_ROW_LINE_ENDING_REQUIRED:${pointer}:${row.lineNumber}`);
      retained.push(original.slice(Number(row.byteStart), Number(row.byteEnd)));
    }
  }
  const byteStart = Number(envelope.marker.byteEnd); const byteEnd = Number(envelope.nextMarker.byteStart);
  return Object.freeze({ kind: 'RESTRAINT_SECTION_PAYLOAD', byteStart, byteEnd,
    beforeField: original.slice(byteStart, byteEnd), afterField: retained.join(''),
    blockCountBefore: Number(plan.blockCountBefore), blockCountAfter: Number(plan.blockCountAfter),
    deletedPointers: Object.freeze([...(plan.deletedPointers || [])]), retainedPointers: Object.freeze([...(plan.retainedPointers || [])]) });
}
function independentDisjoint(replacements) {
  const sorted = [...replacements].sort((a, b) => a.byteStart - b.byteStart || a.byteEnd - b.byteEnd);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].byteStart < sorted[index - 1].byteEnd) {
      throw new Error(`CII_WRITER_2_RESTRAINT_VALIDATOR_REPLACEMENT_OVERLAP:${sorted[index - 1].kind}:${sorted[index].kind}`);
    }
  }
  return Object.freeze(sorted);
}
function independentApply(original, replacements) {
  let cursor = 0; let output = '';
  for (const replacement of replacements) {
    if (original.slice(replacement.byteStart, replacement.byteEnd) !== replacement.beforeField) {
      throw new Error(`CII_WRITER_2_RESTRAINT_VALIDATOR_STALE_PREIMAGE:${replacement.kind}:${replacement.byteStart}`);
    }
    output += original.slice(cursor, replacement.byteStart);
    output += replacement.afterField;
    cursor = replacement.byteEnd;
  }
  return output + original.slice(cursor);
}
function representationCustody(physicalFile) {
  return Object.freeze({ authority: POSTIMAGE_REPRESENTATION_AUTHORITY,
    byteLength: Number(physicalFile.byteLength), textLength: String(physicalFile.text ?? '').length,
    textEncodingAuthority: physicalFile.textEncodingAuthority, lineCount: (physicalFile.lines || []).length,
    lineEndingStyle: physicalFile.lineEndings?.style || null,
    finalLineTerminated: physicalFile.lineEndings?.finalLineTerminated === true });
}
function exactBytesEqual(left, right) {
  if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array) || left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return false;
  return true;
}
function assertAfterPhysicalEquivalent(after, expectedPhysical) {
  const actual = after?.physicalFile;
  if (!actual) throw new Error('CII_WRITER_2_RESTRAINT_VALIDATOR_AFTER_PHYSICAL_FILE_REQUIRED');
  const fields = ['schema', 'byteAuthority', 'writer1CByteEligible', 'textEncodingAuthority', 'byteLength', 'originalByteString', 'text'];
  for (const field of fields) {
    if (stableStringify(actual?.[field]) !== stableStringify(expectedPhysical?.[field])) {
      throw new Error(`CII_WRITER_2_RESTRAINT_VALIDATOR_AFTER_PHYSICAL_MISMATCH:${field}`);
    }
  }
  if (stableStringify(actual.lines) !== stableStringify(expectedPhysical.lines)
    || stableStringify(actual.lineEndings) !== stableStringify(expectedPhysical.lineEndings)) {
    throw new Error('CII_WRITER_2_RESTRAINT_VALIDATOR_AFTER_PHYSICAL_LINE_CUSTODY_MISMATCH');
  }
}

export function validateCiiWriter2RestraintDeleteCompaction({ before, after, transferPlan, writerResult }) {
  const original = String(before?.physicalFile?.originalByteString ?? '');
  const beforeDeclared = String(before?.contentSha256 ?? '').trim();
  if (!isCiiSha256Hex(beforeDeclared) || sha256CiiByteString(original) !== beforeDeclared) {
    throw new Error('CII_WRITER_2_RESTRAINT_VALIDATOR_TARGET0_SHA256_MISMATCH');
  }
  const plan = buildCiiWriter2RestraintDeleteCompactionPlan({ targetDocument: before, transferPlan });
  if (!plan?.ready) throw new Error(`CII_WRITER_2_RESTRAINT_VALIDATOR_PLAN_BLOCKED:${(plan?.blockers || []).join('|')}`);
  const replacements = independentDisjoint([
    independentControlReplacement(before, plan), ...independentPointerReplacements(before, plan), independentRestraintReplacement(before, plan),
  ]).filter((item) => item.beforeField !== item.afterField);
  const expectedByteString = independentApply(original, replacements);

  // Primary oracle: exact complete final bytes before Writer testimony is trusted.
  const actualAfterByteString = String(after?.physicalFile?.originalByteString ?? '');
  if (actualAfterByteString !== expectedByteString) throw new Error('CII_WRITER_2_RESTRAINT_VALIDATOR_FINAL_BYTE_MISMATCH');
  const expectedBytes = byteStringToBytes(expectedByteString);
  const expectedPhysical = createCiiPhysicalFile(expectedBytes);
  assertAfterPhysicalEquivalent(after, expectedPhysical);
  const expectedAfterSha = sha256CiiByteString(expectedByteString);
  if (!isCiiSha256Hex(after?.contentSha256) || String(after.contentSha256) !== expectedAfterSha) {
    throw new Error('CII_WRITER_2_RESTRAINT_VALIDATOR_POSTIMAGE_SHA256_MISMATCH');
  }
  if (after?.byteLength != null && Number(after.byteLength) !== expectedByteString.length) {
    throw new Error('CII_WRITER_2_RESTRAINT_VALIDATOR_POSTIMAGE_DOCUMENT_BYTE_LENGTH_MISMATCH');
  }

  if (writerResult?.schema !== 'CIIWorkspaceWriter2RestraintDeleteResult.v1'
    || writerResult?.status !== 'APPLIED' || writerResult?.authority !== PHYSICAL_WRITE_AUTHORITY) {
    throw new Error('CII_WRITER_2_RESTRAINT_VALIDATOR_WRITER_RESULT_AUTHORITY_MISMATCH');
  }
  if (writerResult.byteString !== expectedByteString || !exactBytesEqual(writerResult.bytes, expectedBytes)
    || writerResult.text !== expectedPhysical.text) {
    throw new Error('CII_WRITER_2_RESTRAINT_VALIDATOR_WRITER_REPRESENTATION_MISMATCH');
  }
  if (stableStringify(writerResult.relocationPlan) !== stableStringify(plan)) {
    throw new Error('CII_WRITER_2_RESTRAINT_VALIDATOR_WRITER_PLAN_TESTIMONY_MISMATCH');
  }
  if (Number(writerResult.mutationCount) !== replacements.length
    || stableStringify(writerResult.mutations) !== stableStringify(replacements)) {
    throw new Error('CII_WRITER_2_RESTRAINT_VALIDATOR_WRITER_MUTATION_LEDGER_MISMATCH');
  }
  const expectedTarget0HashCustody = Object.freeze({ authority: TARGET0_HASH_AUTHORITY, contentSha256: beforeDeclared, byteLength: original.length });
  if (stableStringify(writerResult.target0HashCustody) !== stableStringify(expectedTarget0HashCustody)) {
    throw new Error('CII_WRITER_2_RESTRAINT_VALIDATOR_WRITER_TARGET0_HASH_TESTIMONY_MISMATCH');
  }
  const expectedPostimageHashCustody = Object.freeze({ authority: POSTIMAGE_HASH_AUTHORITY, contentSha256: expectedAfterSha, byteLength: expectedByteString.length });
  if (stableStringify(writerResult.postimageHashCustody) !== stableStringify(expectedPostimageHashCustody)) {
    throw new Error('CII_WRITER_2_RESTRAINT_VALIDATOR_WRITER_POSTIMAGE_HASH_TESTIMONY_MISMATCH');
  }
  const expectedRepresentationCustody = representationCustody(expectedPhysical);
  if (stableStringify(writerResult.postimageRepresentationCustody) !== stableStringify(expectedRepresentationCustody)) {
    throw new Error('CII_WRITER_2_RESTRAINT_VALIDATOR_WRITER_POSTIMAGE_REPRESENTATION_TESTIMONY_MISMATCH');
  }
  return Object.freeze({
    schema: 'CIIWorkspaceWriter2RestraintDeleteValidation.v1', status: 'PASS',
    checklist: Object.freeze([
      'INDEPENDENT_TARGET0_SHA256', 'INDEPENDENT_W2_10_PLAN', 'INDEPENDENT_CONTROL_COUNT_REWRITE',
      'INDEPENDENT_ELEMENT_POINTER_REWRITES', 'INDEPENDENT_RESTRAINT_SECTION_COMPACTION', 'EXACT_COMPLETE_FINAL_BYTES',
      'INDEPENDENT_POSTIMAGE_SHA256', 'INDEPENDENT_POSTIMAGE_PHYSICAL_REINTAKE', 'WRITER_PLAN_TESTIMONY',
      'WRITER_MUTATION_LEDGER', 'WRITER_TARGET0_HASH_TESTIMONY', 'WRITER_POSTIMAGE_HASH_TESTIMONY',
      'WRITER_POSTIMAGE_REPRESENTATION_TESTIMONY',
    ]),
    expectedByteLength: expectedByteString.length, expectedSha256: expectedAfterSha,
    blockCountBefore: Number(plan.blockCountBefore), blockCountAfter: Number(plan.blockCountAfter),
    deletedPointers: Object.freeze([...(plan.deletedPointers || [])]),
  });
}

export const _test = Object.freeze({ markerName, integerField, byteStringToBytes, rawSectionEnvelope,
  independentControlReplacement, independentPointerReplacements, independentRestraintReplacement,
  independentDisjoint, independentApply, representationCustody, exactBytesEqual, assertAfterPhysicalEquivalent });