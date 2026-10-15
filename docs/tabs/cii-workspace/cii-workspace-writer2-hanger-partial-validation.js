import { stableStringify } from './cii-workspace-contracts.js';
import { CII_SIX_FIELD_WIDTHS, decodeCiiNumericRow } from '../../parser/fixed-field.js';
import { ciiPhysicalFileBytes, ciiPhysicalSectionRows, createCiiPhysicalFile, decodeCiiAsciiByteString } from './cii-workspace-physical-file.js';
import { buildCiiWriter2HangerDeletePlan } from './cii-workspace-writer2-hanger-delete.js';
import { CII_WRITER_2_HANGER_RECORD_BINDING_AUTHORITY } from './cii-workspace-writer2-hanger-record-binding.js';
import { qualifyCiiWriter2HangerTailOrder } from './cii-workspace-writer2-hanger-tail-order.js';
import { CII_HANGER_LAYOUTS } from './cii-workspace-hanger.js';
import { isCiiSha256Hex, sha256CiiByteString } from './cii-workspace-byte-sha256.js';

const WIDTH = 13;
const VALUES_PER_PACKED_ROW = 6;
const PACKED_PREFIX = '  ';
const EXECUTION_ROWS = 4;
const CONTROL_HANGER_FIELD_INDEX = 2;
const SCOPE_MODE = 'EXPLICIT_APPLY_EXCLUDE';
const SCOPE_AUTHORITY = 'USER_EXPLICIT_OPERATION_SCOPE';
const TARGET0_HASH_AUTHORITY = 'SHA256_ORIGINAL_TARGET0_BYTES';
const POSTIMAGE_HASH_AUTHORITY = 'SHA256_WRITER2_POSTIMAGE_BYTES';
const POSTIMAGE_REPRESENTATION_AUTHORITY = 'CII_PHYSICAL_POSTIMAGE_REINTAKE_EQUIVALENCE';
const SINGLE_RECORD_ORDER = 'SINGLE_RECORD_ORDER_EQUIVALENT';
const PACKED_TAIL_AUTHORITY = 'SYNCHRONIZER_PACK_I_ACTIVE_FIELDS_ONLY';
const PACKED_LABELS = Object.freeze(['IHGRNODE', 'IHGRNUM', 'IHGRTABLE', 'IHGRSHORT', 'IHGRCN']);

function text(value) { return String(value ?? '').trim(); }
function markerName(value) {
  const match = String(value ?? '').match(/^\s*#\$\s*(.*?)\s*$/);
  return match ? match[1].trim().toUpperCase() : null;
}
function ceilDiv(value, divisor) { return Math.floor(value / divisor) + (value % divisor ? 1 : 0); }
function sortedUnique(values) {
  return [...new Set((values || []).map(text).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
function sameStrings(left, right) {
  const a = sortedUnique(left); const b = sortedUnique(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
function sameUint8Array(actual, expected) {
  if (!(actual instanceof Uint8Array) || !(expected instanceof Uint8Array) || actual.length !== expected.length) return false;
  for (let index = 0; index < actual.length; index += 1) if (actual[index] !== expected[index]) return false;
  return true;
}
function integerField(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_INTEGER_INVALID');
  const token = String(number);
  if (token.length > WIDTH) throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_INTEGER_OVERFLOW');
  return token.padStart(WIDTH, ' ');
}
function lineEndingBytes(row, code) {
  if (row?.lineEnding === 'CRLF') return '\r\n';
  if (row?.lineEnding === 'LF') return '\n';
  if (row?.lineEnding === 'CR') return '\r';
  throw new Error(`${code}:LINE_ENDING_REQUIRED:${row?.lineNumber ?? 'unknown'}`);
}
function rowBytes(original, row, code) {
  const start = Number(row?.byteStart); const end = Number(row?.byteEnd);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start || end > original.length) {
    throw new Error(`${code}:ROW_SPAN_INVALID:${row?.lineNumber ?? 'unknown'}`);
  }
  lineEndingBytes(row, code); return original.slice(start, end);
}
function sectionEnvelope(document, section) {
  const lines = document?.physicalFile?.lines || []; const wanted = String(section || '').trim().toUpperCase();
  const markerIndex = lines.findIndex((line) => markerName(line.text) === wanted);
  if (markerIndex < 0) throw new Error(`WRITER_2_HANGER_PARTIAL_VALIDATOR_SECTION_NOT_FOUND:${wanted}`);
  let nextIndex = markerIndex + 1;
  while (nextIndex < lines.length && markerName(lines[nextIndex].text) === null) nextIndex += 1;
  if (nextIndex >= lines.length) throw new Error(`WRITER_2_HANGER_PARTIAL_VALIDATOR_NEXT_SECTION_REQUIRED:${wanted}`);
  return { marker: lines[markerIndex], nextMarker: lines[nextIndex], rows: lines.slice(markerIndex + 1, nextIndex) };
}
function exactIds(values, code) {
  if (!Array.isArray(values)) throw new Error(`WRITER_2_HANGER_PARTIAL_VALIDATOR_${code}_ARRAY_REQUIRED`);
  const ids = values.map(text);
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new Error(`WRITER_2_HANGER_PARTIAL_VALIDATOR_${code}_INVALID`);
  return Object.freeze([...ids].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
}
function independentlyAssertScopeSetsDisjoint(appliedIds, excludedIds, code) {
  const excluded = new Set(excludedIds); const overlap = appliedIds.filter((id) => excluded.has(id));
  if (overlap.length) throw new Error(`WRITER_2_HANGER_PARTIAL_VALIDATOR_${code}_APPLY_EXCLUDE_OVERLAP:${overlap.join(',')}`);
}
function independentlyValidateOperationContainers(transferPlan) {
  const operations = transferPlan?.operations;
  const excludedOperations = transferPlan?.excludedOperations;
  if (!Array.isArray(operations)) throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_PLAN_OPERATIONS_ARRAY_REQUIRED');
  if (!Array.isArray(excludedOperations)) throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_PLAN_EXCLUDED_OPERATIONS_ARRAY_REQUIRED');
  const applied = [];
  for (const operation of operations) {
    const id = text(operation?.operationId);
    if (!id) throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_PLAN_OPERATION_ID_REQUIRED');
    if (operation?.action !== 'KEEP') {
      if (operation?.scopeDecision !== 'APPLY') {
        throw new Error(`WRITER_2_HANGER_PARTIAL_VALIDATOR_PLAN_OPERATION_DECISION_MISMATCH:${id}:${text(operation?.scopeDecision) || 'EMPTY'}:APPLY`);
      }
      applied.push(operation);
    } else if (operation?.scopeDecision !== 'KEEP') {
      throw new Error(`WRITER_2_HANGER_PARTIAL_VALIDATOR_PLAN_KEEP_DECISION_MISMATCH:${id}:${text(operation?.scopeDecision) || 'EMPTY'}:KEEP`);
    }
  }
  const excluded = [];
  for (const operation of excludedOperations) {
    const id = text(operation?.operationId);
    if (!id) throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_PLAN_OPERATION_ID_REQUIRED');
    if (operation?.action === 'KEEP') throw new Error(`WRITER_2_HANGER_PARTIAL_VALIDATOR_PLAN_EXCLUDED_KEEP_FORBIDDEN:${id}`);
    if (operation?.scopeDecision !== 'EXCLUDE') {
      throw new Error(`WRITER_2_HANGER_PARTIAL_VALIDATOR_PLAN_EXCLUDED_DECISION_MISMATCH:${id}:${text(operation?.scopeDecision) || 'EMPTY'}:EXCLUDE`);
    }
    excluded.push(operation);
  }
  const appliedIds = exactIds(applied.map((item) => item.operationId), 'PLAN_APPLY');
  const excludedIds = exactIds(excluded.map((item) => item.operationId), 'PLAN_EXCLUDE');
  independentlyAssertScopeSetsDisjoint(appliedIds, excludedIds, 'PLAN');
  exactIds([...operations, ...excludedOperations].map((item) => item.operationId), 'PLAN_ALL');
  return Object.freeze({ appliedIds, excludedIds });
}
function independentlyValidateScope(transferPlan, before) {
  const scope = transferPlan?.transferScope;
  if (scope?.status !== 'BOUND' || scope?.mode !== SCOPE_MODE || scope?.authority !== SCOPE_AUTHORITY || !text(scope.scopeId)) {
    throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_CANONICAL_SCOPE_REQUIRED');
  }
  const planScope = independentlyValidateOperationContainers(transferPlan);
  const appliedIds = planScope.appliedIds;
  const excludedIds = planScope.excludedIds;
  const candidates = Object.freeze([...appliedIds, ...excludedIds].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
  const scopeApplied = exactIds(scope.appliedOperationIds, 'SCOPE_APPLY');
  const scopeExcluded = exactIds(scope.excludedOperationIds, 'SCOPE_EXCLUDE');
  independentlyAssertScopeSetsDisjoint(scopeApplied, scopeExcluded, 'SCOPE');
  const scopeCandidates = exactIds(scope.candidateOperationIds, 'SCOPE_CANDIDATE');
  if (!sameStrings(appliedIds, scopeApplied)
    || !sameStrings(excludedIds, scopeExcluded)
    || !sameStrings(candidates, scopeCandidates)) {
    throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_SCOPE_OPERATION_SET_MISMATCH');
  }
  const sourceSha = text(transferPlan?.sourceDocument?.contentSha256); const targetSha = text(transferPlan?.targetDocument?.contentSha256);
  if (!sourceSha || sourceSha !== text(scope.sourceSha256)) throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_SCOPE_SOURCE_HASH_MISMATCH');
  if (!targetSha || targetSha !== text(scope.targetSha256) || targetSha !== text(before?.contentSha256)) {
    throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_SCOPE_TARGET_HASH_MISMATCH');
  }
  return { scopeId: text(scope.scopeId), appliedIds, excludedIds, candidates, sourceSha, targetSha };
}
function independentlyValidateTarget0HashCustody(before, transferPlan) {
  const physicalFile = before?.physicalFile;
  const original = String(physicalFile?.originalByteString ?? '');
  const declared = text(before?.contentSha256);
  if (!isCiiSha256Hex(declared)) throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_TARGET0_SHA256_FORMAT_REQUIRED');
  if (!original || Number(physicalFile?.byteLength) !== original.length) {
    throw new Error(`WRITER_2_HANGER_PARTIAL_VALIDATOR_TARGET0_BYTE_LENGTH_MISMATCH:${physicalFile?.byteLength ?? 'missing'}:${original.length}`);
  }
  if (before?.byteLength != null && Number(before.byteLength) !== original.length) {
    throw new Error(`WRITER_2_HANGER_PARTIAL_VALIDATOR_TARGET0_DOCUMENT_BYTE_LENGTH_MISMATCH:${before.byteLength}:${original.length}`);
  }
  const actual = sha256CiiByteString(original);
  if (declared !== actual) throw new Error(`WRITER_2_HANGER_PARTIAL_VALIDATOR_TARGET0_SHA256_MISMATCH:${declared}:${actual}`);
  if (text(transferPlan?.targetDocument?.contentSha256) !== actual || text(transferPlan?.transferScope?.targetSha256) !== actual) {
    throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_SCOPE_TARGET0_SHA256_MISMATCH');
  }
  return Object.freeze({ authority: TARGET0_HASH_AUTHORITY, contentSha256: actual, byteLength: original.length });
}
function independentlyValidatePostimageHashCustody(after) {
  const physicalFile = after?.physicalFile;
  const original = String(physicalFile?.originalByteString ?? '');
  const declared = text(after?.contentSha256);
  if (!isCiiSha256Hex(declared)) throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_POSTIMAGE_SHA256_FORMAT_REQUIRED');
  if (!original || Number(physicalFile?.byteLength) !== original.length) {
    throw new Error(`WRITER_2_HANGER_PARTIAL_VALIDATOR_POSTIMAGE_BYTE_LENGTH_MISMATCH:${physicalFile?.byteLength ?? 'missing'}:${original.length}`);
  }
  if (after?.byteLength != null && Number(after.byteLength) !== original.length) {
    throw new Error(`WRITER_2_HANGER_PARTIAL_VALIDATOR_POSTIMAGE_DOCUMENT_BYTE_LENGTH_MISMATCH:${after.byteLength}:${original.length}`);
  }
  const actual = sha256CiiByteString(original);
  if (declared !== actual) throw new Error(`WRITER_2_HANGER_PARTIAL_VALIDATOR_POSTIMAGE_SHA256_MISMATCH:${declared}:${actual}`);
  return Object.freeze({ authority: POSTIMAGE_HASH_AUTHORITY, contentSha256: actual, byteLength: original.length });
}
function independentlyValidatePostimageRepresentationCustody(after, writerResult) {
  const physicalFile = after?.physicalFile;
  const original = String(physicalFile?.originalByteString ?? '');
  if (!original) throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_POSTIMAGE_ORIGINAL_BYTE_STRING_REQUIRED');
  const canonical = createCiiPhysicalFile(ciiPhysicalFileBytes(physicalFile));
  if (canonical.originalByteString !== original) {
    throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_POSTIMAGE_BINARY_STRING_REINTAKE_MISMATCH');
  }
  if (physicalFile?.schema !== canonical.schema
    || physicalFile?.byteAuthority !== canonical.byteAuthority
    || physicalFile?.writer1CByteEligible !== canonical.writer1CByteEligible
    || physicalFile?.textEncodingAuthority !== canonical.textEncodingAuthority
    || Number(physicalFile?.byteLength) !== canonical.byteLength) {
    throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_POSTIMAGE_PHYSICAL_METADATA_MISMATCH');
  }
  if (String(physicalFile?.text ?? '') !== canonical.text) {
    throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_POSTIMAGE_PHYSICAL_TEXT_MISMATCH');
  }
  if (stableStringify(physicalFile?.lines || []) !== stableStringify(canonical.lines)) {
    throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_POSTIMAGE_PHYSICAL_LINES_MISMATCH');
  }
  if (stableStringify(physicalFile?.lineEndings || {}) !== stableStringify(canonical.lineEndings)) {
    throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_POSTIMAGE_PHYSICAL_LINE_ENDINGS_MISMATCH');
  }
  if ((after?.byteAuthority != null && after.byteAuthority !== canonical.byteAuthority)
    || (after?.textEncodingAuthority != null && after.textEncodingAuthority !== canonical.textEncodingAuthority)
    || (after?.textLength != null && Number(after.textLength) !== canonical.text.length)) {
    throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_POSTIMAGE_DOCUMENT_REPRESENTATION_METADATA_MISMATCH');
  }
  const canonicalBytes = ciiPhysicalFileBytes(canonical);
  if (!sameUint8Array(writerResult?.bytes, canonicalBytes)) {
    throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_RESULT_BYTE_ARRAY_MISMATCH');
  }
  if (String(writerResult?.text ?? '') !== canonical.text) {
    throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_RESULT_TEXT_MISMATCH');
  }
  return Object.freeze({
    authority: POSTIMAGE_REPRESENTATION_AUTHORITY,
    byteLength: canonical.byteLength,
    textLength: canonical.text.length,
    textEncodingAuthority: canonical.textEncodingAuthority,
    lineCount: canonical.lines.length,
    lineEndingStyle: canonical.lineEndings.style,
    finalLineTerminated: canonical.lineEndings.finalLineTerminated,
  });
}
function independentlyRetained(countBefore, deletedIndices) {
  const deleted = new Set((deletedIndices || []).map(Number)); const retained = []; const oldToNew = {}; let next = 1;
  for (let index = 1; index <= countBefore; index += 1) {
    if (deleted.has(index)) oldToNew[index] = 0;
    else { retained.push(index); oldToNew[index] = next; next += 1; }
  }
  return { retained: Object.freeze(retained), oldToNew: Object.freeze(oldToNew) };
}
function expectedCounts(before, countAfter) {
  const control = before?.hangerEvidence?.control || {}; const numelt = Number(control.numelt); const numnoz = Number(control.numnoz);
  const countBefore = Number(before?.hangerEvidence?.count);
  if (![numelt, numnoz, countBefore, countAfter].every(Number.isSafeInteger) || numelt < 0 || numnoz < 0 || countBefore <= 1 || countAfter <= 0 || countAfter >= countBefore) {
    throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_CONTROL_COUNTS_INVALID');
  }
  const prefixRows = ceilDiv(numelt, 6) + 4 * numnoz; const packedBefore = ceilDiv(countBefore, 6); const packedAfter = ceilDiv(countAfter, 6);
  const hangerBefore = 2 + 5 * countBefore + 5 * packedBefore; const hangerAfter = 2 + 5 * countAfter + 5 * packedAfter;
  return { countBefore, countAfter, prefixRows, packedBefore, packedAfter,
    rowCountBefore: prefixRows + hangerBefore + EXECUTION_ROWS, rowCountAfter: prefixRows + hangerAfter + EXECUTION_ROWS };
}
function partitionBefore(before, counts) {
  const envelope = sectionEnvelope(before, 'MISCEL_1'); const rows = envelope.rows;
  if (rows.length !== counts.rowCountBefore) throw new Error(`WRITER_2_HANGER_PARTIAL_VALIDATOR_PRE_ROW_COUNT_MISMATCH:${rows.length}:${counts.rowCountBefore}`);
  let cursor = counts.prefixRows; const prefixRows = rows.slice(0, counts.prefixRows); const defaultRows = rows.slice(cursor, cursor + 2); cursor += 2;
  const packed = {}; packed.IHGRNODE = rows.slice(cursor, cursor + counts.packedBefore); cursor += counts.packedBefore;
  const tailRows = rows.slice(cursor, cursor + 4 * counts.countBefore); cursor += 4 * counts.countBefore;
  const freeRows = rows.slice(cursor, cursor + counts.countBefore); cursor += counts.countBefore;
  for (const label of PACKED_LABELS.slice(1)) { packed[label] = rows.slice(cursor, cursor + counts.packedBefore); cursor += counts.packedBefore; }
  const executionRows = rows.slice(cursor, cursor + EXECUTION_ROWS); cursor += EXECUTION_ROWS;
  if (cursor !== rows.length) throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_LAYOUT_CURSOR_MISMATCH');
  return { envelope, prefixRows, defaultRows, packed, tailRows, freeRows, executionRows };
}
function controlReplacement(before, countBefore, countAfter) {
  const rows = ciiPhysicalSectionRows(before?.physicalFile, 'CONTROL', { includeBlank: true }); const row = rows[0];
  if (!row) throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_CONTROL_ROW_REQUIRED');
  const startColumn = CII_SIX_FIELD_WIDTHS.slice(0, CONTROL_HANGER_FIELD_INDEX).reduce((sum, width) => sum + width, 0);
  const start = Number(row.byteStart) + startColumn; const end = start + WIDTH; const original = String(before?.physicalFile?.originalByteString || '');
  const beforeField = original.slice(start, end);
  if (beforeField !== integerField(countBefore)) throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_CONTROL_PREIMAGE_FORMAT_MISMATCH');
  return { kind: 'CONTROL_HANGER_COUNT', byteStart: start, byteEnd: end, beforeField, afterField: integerField(countAfter) };
}
function recordByIndex(binding, index) {
  const record = (binding?.records || []).find((item) => Number(item?.recordIndex) === Number(index));
  if (!record) throw new Error(`WRITER_2_HANGER_PARTIAL_VALIDATOR_RECORD_REQUIRED:${index}`);
  return record;
}
function independentlyQualifyPackedSourceTail(binding, sourceRows, label) {
  const count = Number(binding?.records?.length); const expectedRows = ceilDiv(count, VALUES_PER_PACKED_ROW);
  if (!Number.isSafeInteger(count) || count <= 0 || sourceRows.length !== expectedRows) {
    throw new Error(`WRITER_2_HANGER_PARTIAL_VALIDATOR_PACKED_SOURCE_ROW_COUNT_REQUIRED:${label}:${sourceRows.length}:${expectedRows}`);
  }
  for (let rowIndex = 0; rowIndex < sourceRows.length; rowIndex += 1) {
    const row = sourceRows[rowIndex]; const raw = String(row?.text || '');
    const isLast = rowIndex === sourceRows.length - 1;
    const fieldsInRow = isLast ? (count % VALUES_PER_PACKED_ROW || VALUES_PER_PACKED_ROW) : VALUES_PER_PACKED_ROW;
    const expectedLength = PACKED_PREFIX.length + fieldsInRow * WIDTH;
    decodeCiiAsciiByteString(raw);
    if (raw.slice(0, PACKED_PREFIX.length) !== PACKED_PREFIX || raw.length !== expectedLength) {
      throw new Error(`WRITER_2_HANGER_PARTIAL_VALIDATOR_PACKED_SOURCE_ACTIVE_FIELDS_ONLY_REQUIRED:${label}:${rowIndex + 1}:${raw.length}:${expectedLength}`);
    }
  }
  return { authority: PACKED_TAIL_AUTHORITY, sourceTrailingBytes: 0, postUnusedFieldPolicy: 'OMIT_UNUSED_FIELDS' };
}
function independentPackedRows(binding, retained, label, sourceRows) {
  independentlyQualifyPackedSourceTail(binding, sourceRows, label);
  const rawFields = retained.map((index) => {
    const field = recordByIndex(binding, index)?.packed?.[label];
    if (!field || Number(field.valueIndex) !== index || typeof field.rawField !== 'string' || field.rawField.length !== WIDTH) {
      throw new Error(`WRITER_2_HANGER_PARTIAL_VALIDATOR_PACKED_FIELD_REQUIRED:${label}:${index}`);
    }
    decodeCiiAsciiByteString(field.rawField);
    if (!/^[+-]?\d+$/.test(field.rawField.trim())) throw new Error(`WRITER_2_HANGER_PARTIAL_VALIDATOR_PACKED_TOKEN_REQUIRED:${label}:${index}`);
    return field.rawField;
  });
  const out = [];
  for (let offset = 0, rowIndex = 0; offset < rawFields.length; offset += VALUES_PER_PACKED_ROW, rowIndex += 1) {
    if (!sourceRows[rowIndex]) throw new Error(`WRITER_2_HANGER_PARTIAL_VALIDATOR_PACKED_SOURCE_ROW_REQUIRED:${label}:${rowIndex + 1}`);
    out.push(PACKED_PREFIX + rawFields.slice(offset, offset + VALUES_PER_PACKED_ROW).join('')
      + lineEndingBytes(sourceRows[rowIndex], `WRITER_2_HANGER_PARTIAL_VALIDATOR_${label}`));
  }
  return out;
}
function independentTailRows(binding, retained, physicalTailRows, original) {
  const indices = [];
  for (const recordIndex of retained) {
    const tail = recordByIndex(binding, recordIndex).tail;
    for (const ref of [...(tail?.hgrdatRows || []), tail?.tagRow, tail?.guidRow]) {
      const index = Number(ref?.relativeRowIndex);
      if (!Number.isSafeInteger(index) || index < 1 || index > physicalTailRows.length) {
        throw new Error(`WRITER_2_HANGER_PARTIAL_VALIDATOR_TAIL_ROW_INDEX_REQUIRED:${recordIndex}`);
      }
      indices.push(index);
    }
  }
  indices.sort((a, b) => a - b);
  if (new Set(indices).size !== retained.length * 4) throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_TAIL_ROW_DUPLICATE');
  return { indices, rows: indices.map((index) => rowBytes(original, physicalTailRows[index - 1], 'WRITER_2_HANGER_PARTIAL_VALIDATOR_TAIL')) };
}
function payloadReplacement(before, plan, retained, counts) {
  const original = String(before?.physicalFile?.originalByteString || ''); const groups = partitionBefore(before, counts);
  const binding = plan?.physicalCustody?.recordBinding;
  if (binding?.status !== 'QUALIFIED' || binding?.authority !== CII_WRITER_2_HANGER_RECORD_BINDING_AUTHORITY
    || binding?.semanticAuthority !== 'NONE_POSITIONAL_PHYSICAL_CUSTODY_ONLY') {
    throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_RECORD_BINDING_REQUIRED');
  }
  const after = [];
  for (const row of groups.prefixRows) after.push(rowBytes(original, row, 'WRITER_2_HANGER_PARTIAL_VALIDATOR_PREFIX'));
  for (const row of groups.defaultRows) after.push(rowBytes(original, row, 'WRITER_2_HANGER_PARTIAL_VALIDATOR_DEFAULT'));
  after.push(...independentPackedRows(binding, retained, 'IHGRNODE', groups.packed.IHGRNODE));
  const tail = independentTailRows(binding, retained, groups.tailRows, original); after.push(...tail.rows);
  for (const index of retained) after.push(rowBytes(original, groups.freeRows[index - 1], 'WRITER_2_HANGER_PARTIAL_VALIDATOR_IHGRFREE'));
  for (const label of PACKED_LABELS.slice(1)) after.push(...independentPackedRows(binding, retained, label, groups.packed[label]));
  for (const row of groups.executionRows) after.push(rowBytes(original, row, 'WRITER_2_HANGER_PARTIAL_VALIDATOR_EXECUTION'));
  if (after.length !== counts.rowCountAfter) throw new Error(`WRITER_2_HANGER_PARTIAL_VALIDATOR_POST_ROW_COUNT_DERIVATION_MISMATCH:${after.length}:${counts.rowCountAfter}`);
  return { kind: 'MISCEL_1_HANGER_PARTIAL_COMPACT_PAYLOAD', byteStart: Number(groups.envelope.marker.byteEnd),
    byteEnd: Number(groups.envelope.nextMarker.byteStart), beforeField: original.slice(Number(groups.envelope.marker.byteEnd), Number(groups.envelope.nextMarker.byteStart)),
    afterField: after.join(''), rowCountBefore: counts.rowCountBefore, rowCountAfter: counts.rowCountAfter,
    tailOrder: binding.tailOrder, tailIndices: Object.freeze(tail.indices), packedRowsBefore: counts.packedBefore, packedRowsAfter: counts.packedAfter };
}
function expectedReplacements(before, plan, retained, counts) {
  const rows = [controlReplacement(before, counts.countBefore, counts.countAfter), payloadReplacement(before, plan, retained, counts)]
    .sort((a, b) => a.byteStart - b.byteStart || a.byteEnd - b.byteEnd).filter((item) => item.beforeField !== item.afterField);
  for (let index = 1; index < rows.length; index += 1) if (rows[index].byteStart < rows[index - 1].byteEnd) throw new Error('WRITER_2_HANGER_PARTIAL_VALIDATOR_REPLACEMENT_OVERLAP');
  return rows;
}
function applyExpected(original, replacements) {
  let cursor = 0; let output = '';
  for (const replacement of replacements) {
    if (original.slice(replacement.byteStart, replacement.byteEnd) !== replacement.beforeField) throw new Error(`WRITER_2_HANGER_PARTIAL_VALIDATOR_PREIMAGE_MISMATCH:${replacement.kind}`);
    output += original.slice(cursor, replacement.byteStart) + replacement.afterField; cursor = replacement.byteEnd;
  }
  return output + original.slice(cursor);
}
function mutationTestimony(writerResult) {
  return (writerResult?.mutations || []).map((item) => ({ kind: item.kind, byteStart: Number(item.byteStart), byteEnd: Number(item.byteEnd), beforeField: item.beforeField, afterField: item.afterField }));
}
function expectedTestimony(replacements) {
  return replacements.map((item) => ({ kind: item.kind, byteStart: Number(item.byteStart), byteEnd: Number(item.byteEnd), beforeField: item.beforeField, afterField: item.afterField }));
}
function controlCount(document) {
  const row = ciiPhysicalSectionRows(document?.physicalFile, 'CONTROL')[0]; const values = row ? decodeCiiNumericRow(row.text) : [];
  return Number(values?.[CONTROL_HANGER_FIELD_INDEX]);
}
function sectionOrder(document) { return (document?.physicalFile?.lines || []).map((line) => markerName(line.text)).filter(Boolean); }
function nodeKeys(document) { return Object.keys(document?.parsed?.nodes || {}).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })); }
function afterTailOrder(after, countAfter) {
  const control = after?.hangerEvidence?.control || {}; const prefix = ceilDiv(Number(control.numelt), 6) + 4 * Number(control.numnoz);
  const packedRows = ceilDiv(countAfter, 6); const rows = ciiPhysicalSectionRows(after?.physicalFile, 'MISCEL_1');
  const start = prefix + 2 + packedRows; const tail = rows.slice(start, start + 4 * countAfter); const qualification = qualifyCiiWriter2HangerTailOrder(tail, countAfter);
  if (qualification.status !== 'QUALIFIED') throw new Error(`WRITER_2_HANGER_PARTIAL_VALIDATOR_POST_TAIL_UNQUALIFIED:${(qualification.blockers || []).join('|')}`);
  return qualification.order;
}

export function validateCiiWriter2HangerPartialRoundTrip(before, after, transferPlan, writerResult) {
  const errors = []; let scope = null; let target0HashCustody = null; let postimageHashCustody = null; let postimageRepresentationCustody = null;
  let plan = null; let retainedInfo = null; let counts = null; let replacements = []; let expectedBytes = null;
  try { scope = independentlyValidateScope(transferPlan, before); } catch (error) { errors.push(error.message); }
  try { target0HashCustody = independentlyValidateTarget0HashCustody(before, transferPlan); } catch (error) { errors.push(error.message); }
  try {
    plan = buildCiiWriter2HangerDeletePlan({ targetDocument: before, transferPlan });
    if (!plan.ready || plan?.compaction?.plannerPartialRecordAuthority !== true || plan?.compaction?.partialMultiRecordDelete !== true
      || plan?.compaction?.deleteAll === true || plan?.compaction?.recordBindingAuthority !== CII_WRITER_2_HANGER_RECORD_BINDING_AUTHORITY) {
      errors.push('WRITER_2_HANGER_PARTIAL_VALIDATOR_PLAN_AUTHORITY_NOT_PROVEN');
    }
    retainedInfo = independentlyRetained(Number(plan.countBefore), plan.deletedRecordIndices);
    if (stableStringify(retainedInfo.retained) !== stableStringify(plan.retainedRecordIndices)
      || stableStringify(retainedInfo.oldToNew) !== stableStringify(plan.oldToNewRecordIndex)) {
      errors.push('WRITER_2_HANGER_PARTIAL_VALIDATOR_PLANNER_RECORD_MAP_MISMATCH');
    }
    counts = expectedCounts(before, retainedInfo.retained.length);
    replacements = expectedReplacements(before, plan, retainedInfo.retained, counts);
    expectedBytes = applyExpected(String(before?.physicalFile?.originalByteString || ''), replacements);
  } catch (error) { errors.push(error.message); }

  const actualBytes = String(after?.physicalFile?.originalByteString || '');
  try { postimageHashCustody = independentlyValidatePostimageHashCustody(after); } catch (error) { errors.push(error.message); }
  try { postimageRepresentationCustody = independentlyValidatePostimageRepresentationCustody(after, writerResult); } catch (error) { errors.push(error.message); }
  if (after?.writer1CByteEligible !== true || after?.physicalFile?.writer1CByteEligible !== true) errors.push('WRITER_2_HANGER_PARTIAL_POST_ORIGINAL_BYTE_CUSTODY_NOT_QUALIFIED');
  if (expectedBytes != null && actualBytes !== expectedBytes) errors.push('WRITER_2_HANGER_PARTIAL_EXACT_POSTIMAGE_MISMATCH');
  if (String(writerResult?.byteString ?? '') !== actualBytes) errors.push('WRITER_2_HANGER_PARTIAL_RESULT_BYTES_MISMATCH');
  if (stableStringify(mutationTestimony(writerResult)) !== stableStringify(expectedTestimony(replacements))) errors.push('WRITER_2_HANGER_PARTIAL_MUTATION_TESTIMONY_MISMATCH');
  if (writerResult?.schema !== 'CIIWorkspaceWriter2HangerPartialDeleteResult.v1' || writerResult?.status !== 'APPLIED'
    || writerResult?.writer !== 'WRITER_2' || writerResult?.family !== 'HANGER_PARTIAL_DELETE') errors.push('WRITER_2_HANGER_PARTIAL_RESULT_CONTRACT_MISMATCH');
  if (writerResult?.packedTailAuthority !== PACKED_TAIL_AUTHORITY) errors.push('WRITER_2_HANGER_PARTIAL_PACKED_TAIL_TESTIMONY_MISMATCH');
  if (!target0HashCustody || stableStringify(writerResult?.target0HashCustody || {}) !== stableStringify(target0HashCustody)) {
    errors.push('WRITER_2_HANGER_PARTIAL_TARGET0_HASH_TESTIMONY_MISMATCH');
  }
  if (!postimageHashCustody || stableStringify(writerResult?.postimageHashCustody || {}) !== stableStringify(postimageHashCustody)) {
    errors.push('WRITER_2_HANGER_PARTIAL_POSTIMAGE_HASH_TESTIMONY_MISMATCH');
  }
  if (!postimageRepresentationCustody
    || stableStringify(writerResult?.postimageRepresentationCustody || {}) !== stableStringify(postimageRepresentationCustody)) {
    errors.push('WRITER_2_HANGER_PARTIAL_POSTIMAGE_REPRESENTATION_TESTIMONY_MISMATCH');
  }
  if (counts) {
    if (Number(writerResult?.hangerCountBefore) !== counts.countBefore || Number(writerResult?.hangerCountAfter) !== counts.countAfter) errors.push('WRITER_2_HANGER_PARTIAL_RESULT_COUNT_TESTIMONY_MISMATCH');
    if (Number(writerResult?.packedRowsBefore) !== counts.packedBefore || Number(writerResult?.packedRowsAfter) !== counts.packedAfter) errors.push('WRITER_2_HANGER_PARTIAL_PACKED_ROW_TESTIMONY_MISMATCH');
    if (controlCount(after) !== counts.countAfter) errors.push('WRITER_2_HANGER_PARTIAL_CONTROL_POSTCOUNT_MISMATCH');
    if (ciiPhysicalSectionRows(after?.physicalFile, 'MISCEL_1').length !== counts.rowCountAfter) errors.push('WRITER_2_HANGER_PARTIAL_POST_ROW_COUNT_MISMATCH');
  }
  if (retainedInfo) {
    if (stableStringify(writerResult?.deletedRecordIndices || []) !== stableStringify(plan?.deletedRecordIndices || [])
      || stableStringify(writerResult?.retainedRecordIndices || []) !== stableStringify(retainedInfo.retained)
      || stableStringify(writerResult?.oldToNewRecordIndex || {}) !== stableStringify(retainedInfo.oldToNew)) errors.push('WRITER_2_HANGER_PARTIAL_RECORD_TESTIMONY_MISMATCH');
    const expectedNodes = retainedInfo.retained.map((index) => String(recordByIndex(plan?.physicalCustody?.recordBinding, index)?.node));
    if (after?.hangerEvidence?.status !== 'QUALIFIED' || after?.hangerEvidence?.layout !== CII_HANGER_LAYOUTS.SYNCHRONIZER
      || Number(after?.hangerEvidence?.count) !== retainedInfo.retained.length
      || stableStringify(after?.hangerEvidence?.nodes || []) !== stableStringify(expectedNodes)) errors.push('WRITER_2_HANGER_PARTIAL_POST_HANGER_CUSTODY_MISMATCH');
    try {
      const postOrder = afterTailOrder(after, retainedInfo.retained.length);
      const preOrder = plan?.physicalCustody?.recordBinding?.tailOrder;
      if (writerResult?.tailOrder !== preOrder) errors.push('WRITER_2_HANGER_PARTIAL_TAIL_ORDER_TESTIMONY_MISMATCH');
      if (retainedInfo.retained.length > 1 && postOrder !== preOrder) errors.push('WRITER_2_HANGER_PARTIAL_TAIL_ORDER_CHANGED');
      if (retainedInfo.retained.length === 1 && postOrder !== SINGLE_RECORD_ORDER) errors.push('WRITER_2_HANGER_PARTIAL_SINGLE_RECORD_ORDER_NOT_EQUIVALENT');
    } catch (error) { errors.push(error.message); }
  }
  const beforeLength = String(before?.physicalFile?.originalByteString || '').length;
  if (Number(writerResult?.byteLengthBefore) !== beforeLength || Number(writerResult?.byteLengthAfter) !== actualBytes.length) errors.push('WRITER_2_HANGER_PARTIAL_RESULT_LENGTH_TESTIMONY_MISMATCH');
  if (Number(writerResult?.mutationCount) !== replacements.length) errors.push('WRITER_2_HANGER_PARTIAL_MUTATION_COUNT_TESTIMONY_MISMATCH');
  if (stableStringify(before?.parsed?.elements || []) !== stableStringify(after?.parsed?.elements || [])) errors.push('WRITER_2_HANGER_PARTIAL_ELEMENTS_CHANGED');
  if (stableStringify(nodeKeys(before)) !== stableStringify(nodeKeys(after))) errors.push('WRITER_2_HANGER_PARTIAL_NODE_SET_CHANGED');
  if (stableStringify(sectionOrder(before)) !== stableStringify(sectionOrder(after))) errors.push('WRITER_2_HANGER_PARTIAL_SECTION_ORDER_CHANGED');
  if (!scope || stableStringify(writerResult?.scopeCustody || {}) !== stableStringify({ scopeId: scope.scopeId, sourceSha256: scope.sourceSha,
    targetSha256: scope.targetSha, appliedOperationIds: scope.appliedIds, excludedOperationIds: scope.excludedIds, candidateOperationIds: scope.candidates })) {
    errors.push('WRITER_2_HANGER_PARTIAL_SCOPE_TESTIMONY_MISMATCH');
  }
  if (!writerResult?.deletePlan || !plan || Number(writerResult.deletePlan.countBefore) !== Number(plan.countBefore)
    || Number(writerResult.deletePlan.countAfter) !== Number(plan.countAfter)
    || stableStringify(writerResult.deletePlan.deletedRecordIndices || []) !== stableStringify(plan.deletedRecordIndices || [])) {
    errors.push('WRITER_2_HANGER_PARTIAL_PLAN_TESTIMONY_MISMATCH');
  }
  if (errors.length) throw new Error(`CII_WRITER_2_HANGER_PARTIAL_ROUNDTRIP_FAILED:${[...new Set(errors)].join('|')}`);
  return Object.freeze({ schema: 'CIIWorkspaceWriter2HangerPartialDeleteValidation.v1', status: 'PASS',
    checks: Object.freeze(['INDEPENDENT_BOUND_SCOPE_REBUILD', 'INDEPENDENT_CANONICAL_OPERATION_CONTAINERS', 'INDEPENDENT_APPLY_EXCLUDE_DISJOINTNESS',
      'INDEPENDENT_TARGET0_SHA256', 'INDEPENDENT_POSTIMAGE_SHA256', 'INDEPENDENT_POSTIMAGE_REPRESENTATION', 'WRITER_RESULT_BYTE_TEXT_EQUIVALENCE',
      'INDEPENDENT_PARTIAL_PLAN_REBUILD', 'INDEPENDENT_RECORD_MAP', 'INDEPENDENT_RAW_I13_REPACK', 'PACKED_UNUSED_TAIL_POLICY',
      'INDEPENDENT_TAIL_RETENTION', 'EXACT_FULL_BYTE_POSTIMAGE', 'CONTROL_NOHGRS_POSTCOUNT', 'POST_HANGER_CUSTODY',
      'TAIL_ORDER_STABLE_OR_SINGLE_EQUIVALENT', 'ELEMENTS_STABLE', 'NODE_SET_STABLE', 'SECTION_ORDER_STABLE', 'WRITER_TESTIMONY_MATCH']),
    hangerCountBefore: counts.countBefore, hangerCountAfter: counts.countAfter, expectedMiscelRowsAfter: counts.rowCountAfter });
}

export const _test = Object.freeze({ markerName, ceilDiv, sameUint8Array, integerField, lineEndingBytes, sectionEnvelope, exactIds,
  independentlyAssertScopeSetsDisjoint, independentlyValidateOperationContainers, independentlyValidateScope,
  independentlyValidateTarget0HashCustody, independentlyValidatePostimageHashCustody, independentlyValidatePostimageRepresentationCustody,
  independentlyRetained, expectedCounts, partitionBefore, controlReplacement, independentlyQualifyPackedSourceTail, independentPackedRows,
  independentTailRows, payloadReplacement, expectedReplacements, applyExpected, controlCount, afterTailOrder });
