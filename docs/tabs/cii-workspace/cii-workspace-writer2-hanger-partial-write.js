import { buildCiiWriter2HangerDeletePlan } from './cii-workspace-writer2-hanger-delete.js';
import { CII_WRITER_2_HANGER_RECORD_BINDING_AUTHORITY } from './cii-workspace-writer2-hanger-record-binding.js';
import { createCiiPhysicalFile, decodeCiiAsciiByteString } from './cii-workspace-physical-file.js';
import { isCiiSha256Hex, sha256CiiByteString } from './cii-workspace-byte-sha256.js';

const FIELD_WIDTH = 13;
const VALUES_PER_PACKED_ROW = 6;
const PACKED_PREFIX = '  ';
const EXECUTION_ROWS = 4;
const SCOPE_MODE = 'EXPLICIT_APPLY_EXCLUDE';
const SCOPE_AUTHORITY = 'USER_EXPLICIT_OPERATION_SCOPE';
const TARGET0_HASH_AUTHORITY = 'SHA256_ORIGINAL_TARGET0_BYTES';
const POSTIMAGE_HASH_AUTHORITY = 'SHA256_WRITER2_POSTIMAGE_BYTES';
const POSTIMAGE_REPRESENTATION_AUTHORITY = 'CII_PHYSICAL_POSTIMAGE_REINTAKE_EQUIVALENCE';
const PACKED_LABELS = Object.freeze(['IHGRNODE', 'IHGRNUM', 'IHGRTABLE', 'IHGRSHORT', 'IHGRCN']);
export const CII_WRITER_2_HANGER_PACKED_TAIL_AUTHORITY = 'SYNCHRONIZER_PACK_I_ACTIVE_FIELDS_ONLY';

function text(value) { return String(value ?? '').trim(); }
function markerName(value) {
  const match = String(value ?? '').match(/^\s*#\$\s*(.*?)\s*$/);
  return match ? match[1].trim().toUpperCase() : null;
}
function sortedUnique(values) {
  return [...new Set((values || []).map(text).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
function sameStrings(left, right) {
  const a = sortedUnique(left); const b = sortedUnique(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
function operationId(operation) { return text(operation?.operationId); }
function isMutable(operation) { return operation?.action !== 'KEEP'; }
function integerField(value, code) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`${code}:INVALID_INTEGER`);
  const token = String(number);
  if (token.length > FIELD_WIDTH) throw new Error(`${code}:OVERFLOW:${token.length}>${FIELD_WIDTH}`);
  return token.padStart(FIELD_WIDTH, ' ');
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
  lineEndingBytes(row, code);
  return original.slice(start, end);
}
function rawSectionEnvelope(physicalFile, section) {
  const lines = physicalFile?.lines || []; const wanted = String(section || '').trim().toUpperCase();
  const markerIndex = lines.findIndex((line) => markerName(line.text) === wanted);
  if (markerIndex < 0) throw new Error(`CII_WRITER_2_HANGER_PARTIAL_SECTION_NOT_FOUND:${wanted}`);
  let nextIndex = markerIndex + 1;
  while (nextIndex < lines.length && markerName(lines[nextIndex].text) === null) nextIndex += 1;
  if (nextIndex >= lines.length) throw new Error(`CII_WRITER_2_HANGER_PARTIAL_NEXT_SECTION_REQUIRED:${wanted}`);
  return Object.freeze({ marker: lines[markerIndex], nextMarker: lines[nextIndex], rows: Object.freeze(lines.slice(markerIndex + 1, nextIndex)) });
}
function exactScopeIds(values, code) {
  if (!Array.isArray(values)) throw new Error(`CII_WRITER_2_HANGER_PARTIAL_${code}_ARRAY_REQUIRED`);
  const ids = values.map(text);
  if (ids.some((id) => !id)) throw new Error(`CII_WRITER_2_HANGER_PARTIAL_${code}_ID_REQUIRED`);
  if (new Set(ids).size !== ids.length) throw new Error(`CII_WRITER_2_HANGER_PARTIAL_${code}_DUPLICATE_ID`);
  return Object.freeze([...ids].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
}
function assertScopeSetsDisjoint(appliedIds, excludedIds, code) {
  const excluded = new Set(excludedIds); const overlap = appliedIds.filter((id) => excluded.has(id));
  if (overlap.length) throw new Error(`CII_WRITER_2_HANGER_PARTIAL_${code}_APPLY_EXCLUDE_OVERLAP:${overlap.join(',')}`);
}
function assertCanonicalOperationContainers(transferPlan) {
  const operations = transferPlan?.operations;
  const excludedOperations = transferPlan?.excludedOperations;
  if (!Array.isArray(operations)) throw new Error('CII_WRITER_2_HANGER_PARTIAL_PLAN_OPERATIONS_ARRAY_REQUIRED');
  if (!Array.isArray(excludedOperations)) throw new Error('CII_WRITER_2_HANGER_PARTIAL_PLAN_EXCLUDED_OPERATIONS_ARRAY_REQUIRED');
  const applied = [];
  for (const operation of operations) {
    const id = operationId(operation);
    if (!id) throw new Error('CII_WRITER_2_HANGER_PARTIAL_PLAN_OPERATION_ID_REQUIRED');
    if (isMutable(operation)) {
      if (operation?.scopeDecision !== 'APPLY') {
        throw new Error(`CII_WRITER_2_HANGER_PARTIAL_PLAN_OPERATION_DECISION_MISMATCH:${id}:${text(operation?.scopeDecision) || 'EMPTY'}:APPLY`);
      }
      applied.push(operation);
    } else if (operation?.scopeDecision !== 'KEEP') {
      throw new Error(`CII_WRITER_2_HANGER_PARTIAL_PLAN_KEEP_DECISION_MISMATCH:${id}:${text(operation?.scopeDecision) || 'EMPTY'}:KEEP`);
    }
  }
  const excluded = [];
  for (const operation of excludedOperations) {
    const id = operationId(operation);
    if (!id) throw new Error('CII_WRITER_2_HANGER_PARTIAL_PLAN_OPERATION_ID_REQUIRED');
    if (!isMutable(operation)) throw new Error(`CII_WRITER_2_HANGER_PARTIAL_PLAN_EXCLUDED_KEEP_FORBIDDEN:${id}`);
    if (operation?.scopeDecision !== 'EXCLUDE') {
      throw new Error(`CII_WRITER_2_HANGER_PARTIAL_PLAN_EXCLUDED_DECISION_MISMATCH:${id}:${text(operation?.scopeDecision) || 'EMPTY'}:EXCLUDE`);
    }
    excluded.push(operation);
  }
  const appliedIds = exactScopeIds(applied.map(operationId), 'PLAN_APPLY');
  const excludedIds = exactScopeIds(excluded.map(operationId), 'PLAN_EXCLUDE');
  assertScopeSetsDisjoint(appliedIds, excludedIds, 'PLAN');
  exactScopeIds([...operations, ...excludedOperations].map(operationId), 'PLAN_ALL');
  return Object.freeze({ appliedIds, excludedIds });
}
function assertBoundScopeCustody(transferPlan, targetDocument) {
  const scope = transferPlan?.transferScope;
  if (scope?.status !== 'BOUND' || scope?.mode !== SCOPE_MODE || scope?.authority !== SCOPE_AUTHORITY || !text(scope?.scopeId)) {
    throw new Error('CII_WRITER_2_HANGER_PARTIAL_CANONICAL_BOUND_SCOPE_REQUIRED');
  }
  const planScope = assertCanonicalOperationContainers(transferPlan);
  const appliedIds = planScope.appliedIds;
  const excludedIds = planScope.excludedIds;
  const candidateIds = Object.freeze([...appliedIds, ...excludedIds].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
  const scopeApplied = exactScopeIds(scope.appliedOperationIds, 'SCOPE_APPLY');
  const scopeExcluded = exactScopeIds(scope.excludedOperationIds, 'SCOPE_EXCLUDE');
  assertScopeSetsDisjoint(scopeApplied, scopeExcluded, 'SCOPE');
  const scopeCandidates = exactScopeIds(scope.candidateOperationIds, 'SCOPE_CANDIDATE');
  if (!sameStrings(appliedIds, scopeApplied)) throw new Error('CII_WRITER_2_HANGER_PARTIAL_SCOPE_APPLY_SET_MISMATCH');
  if (!sameStrings(excludedIds, scopeExcluded)) throw new Error('CII_WRITER_2_HANGER_PARTIAL_SCOPE_EXCLUDE_SET_MISMATCH');
  if (!sameStrings(candidateIds, scopeCandidates)) throw new Error('CII_WRITER_2_HANGER_PARTIAL_SCOPE_CANDIDATE_SET_MISMATCH');
  const sourceSha = text(transferPlan?.sourceDocument?.contentSha256);
  const targetSha = text(transferPlan?.targetDocument?.contentSha256);
  if (!sourceSha || sourceSha !== text(scope.sourceSha256)) throw new Error('CII_WRITER_2_HANGER_PARTIAL_SCOPE_SOURCE_HASH_MISMATCH');
  if (!targetSha || targetSha !== text(scope.targetSha256) || targetSha !== text(targetDocument?.contentSha256)) {
    throw new Error('CII_WRITER_2_HANGER_PARTIAL_SCOPE_TARGET_HASH_MISMATCH');
  }
  return Object.freeze({ scopeId: text(scope.scopeId), sourceSha256: sourceSha, targetSha256: targetSha,
    appliedOperationIds: appliedIds, excludedOperationIds: excludedIds, candidateOperationIds: candidateIds });
}
function assertTarget0HashCustody(targetDocument, scopeCustody) {
  const physicalFile = targetDocument?.physicalFile;
  const original = String(physicalFile?.originalByteString ?? '');
  const declared = text(targetDocument?.contentSha256);
  if (!isCiiSha256Hex(declared)) throw new Error('CII_WRITER_2_HANGER_PARTIAL_TARGET0_SHA256_FORMAT_REQUIRED');
  if (!original || Number(physicalFile?.byteLength) !== original.length) {
    throw new Error(`CII_WRITER_2_HANGER_PARTIAL_TARGET0_BYTE_LENGTH_MISMATCH:${physicalFile?.byteLength ?? 'missing'}:${original.length}`);
  }
  if (targetDocument?.byteLength != null && Number(targetDocument.byteLength) !== original.length) {
    throw new Error(`CII_WRITER_2_HANGER_PARTIAL_TARGET0_DOCUMENT_BYTE_LENGTH_MISMATCH:${targetDocument.byteLength}:${original.length}`);
  }
  const actual = sha256CiiByteString(original);
  if (declared !== actual) throw new Error(`CII_WRITER_2_HANGER_PARTIAL_TARGET0_SHA256_MISMATCH:${declared}:${actual}`);
  if (text(scopeCustody?.targetSha256) !== actual) throw new Error('CII_WRITER_2_HANGER_PARTIAL_SCOPE_TARGET0_SHA256_MISMATCH');
  return Object.freeze({ authority: TARGET0_HASH_AUTHORITY, contentSha256: actual, byteLength: original.length });
}
function assertPartialPlan(plan) {
  if (!plan?.ready) throw new Error(`CII_WRITER_2_HANGER_PARTIAL_BLOCKED:${(plan?.blockers || []).join('|')}`);
  const before = Number(plan.countBefore); const after = Number(plan.countAfter);
  if (!Number.isSafeInteger(before) || !Number.isSafeInteger(after) || before <= 1 || after <= 0 || after >= before) {
    throw new Error(`CII_WRITER_2_HANGER_PARTIAL_COUNT_SCOPE_REQUIRED:${before}:${after}`);
  }
  if (plan?.compaction?.partialMultiRecordDelete !== true || plan?.compaction?.deleteAll === true) {
    throw new Error('CII_WRITER_2_HANGER_PARTIAL_SCOPE_REQUIRED');
  }
  if (plan?.compaction?.plannerPartialRecordAuthority !== true || plan?.compaction?.partialRecordCompactionAuthorized !== true) {
    throw new Error('CII_WRITER_2_HANGER_PARTIAL_PLANNER_AUTHORITY_REQUIRED');
  }
  if (plan?.compaction?.recordBindingAuthority !== CII_WRITER_2_HANGER_RECORD_BINDING_AUTHORITY
    || plan?.physicalCustody?.recordBinding?.status !== 'QUALIFIED'
    || plan?.physicalCustody?.recordBinding?.authority !== CII_WRITER_2_HANGER_RECORD_BINDING_AUTHORITY) {
    throw new Error('CII_WRITER_2_HANGER_PARTIAL_RECORD_BINDING_AUTHORITY_REQUIRED');
  }
  if (plan?.physicalCustody?.recordBinding?.semanticAuthority !== 'NONE_POSITIONAL_PHYSICAL_CUSTODY_ONLY') {
    throw new Error('CII_WRITER_2_HANGER_PARTIAL_SEMANTIC_AUTHORITY_MUST_REMAIN_NONE');
  }
  if (plan?.createAuthority?.ready !== false) throw new Error('CII_WRITER_2_HANGER_CREATE_AUTHORITY_MUST_REMAIN_BLOCKED');
}
function partitionRows(envelope, plan) {
  const custody = plan.physicalCustody; const rows = envelope.rows;
  if (rows.length !== Number(custody.expectedRowCount)) {
    throw new Error(`CII_WRITER_2_HANGER_PARTIAL_MISCEL_RAW_ROW_COUNT_MISMATCH:${rows.length}:${custody.expectedRowCount}`);
  }
  const prefixCount = Number(custody.rrmatRows || 0) + Number(custody.nozzleRows || 0);
  const packedRows = Number(custody.packedRows); const count = Number(plan.countBefore); let cursor = prefixCount;
  const prefixRows = rows.slice(0, prefixCount);
  const defaultRows = rows.slice(cursor, cursor + 2); cursor += 2;
  const packed = {};
  packed.IHGRNODE = rows.slice(cursor, cursor + packedRows); cursor += packedRows;
  const tailRows = rows.slice(cursor, cursor + 4 * count); cursor += 4 * count;
  const ihgrfreeRows = rows.slice(cursor, cursor + count); cursor += count;
  for (const label of PACKED_LABELS.slice(1)) { packed[label] = rows.slice(cursor, cursor + packedRows); cursor += packedRows; }
  const executionRows = rows.slice(cursor, cursor + EXECUTION_ROWS); cursor += EXECUTION_ROWS;
  if (cursor !== rows.length || defaultRows.length !== 2 || executionRows.length !== EXECUTION_ROWS) {
    throw new Error(`CII_WRITER_2_HANGER_PARTIAL_MISCEL_LAYOUT_CURSOR_MISMATCH:${cursor}:${rows.length}`);
  }
  return Object.freeze({ prefixRows: Object.freeze(prefixRows), defaultRows: Object.freeze(defaultRows),
    packed: Object.freeze(Object.fromEntries(Object.entries(packed).map(([key, value]) => [key, Object.freeze(value)]))),
    tailRows: Object.freeze(tailRows), ihgrfreeRows: Object.freeze(ihgrfreeRows), executionRows: Object.freeze(executionRows) });
}
function retainedPackedFields(plan, label) {
  const expected = [...(plan.retainedRecordIndices || [])].map(Number);
  const fields = [...(plan?.compaction?.retainedPackedFields?.[label] || [])];
  const indices = fields.map((field) => Number(field?.valueIndex));
  if (fields.length !== expected.length || indices.some((value, index) => value !== expected[index])) {
    throw new Error(`CII_WRITER_2_HANGER_PARTIAL_PACKED_RECORD_ORDER_MISMATCH:${label}`);
  }
  for (const field of fields) {
    if (typeof field.rawField !== 'string' || field.rawField.length !== FIELD_WIDTH || Number(field.width) !== FIELD_WIDTH) {
      throw new Error(`CII_WRITER_2_HANGER_PARTIAL_PACKED_RAW_FIELD_WIDTH_REQUIRED:${label}:${field?.valueIndex}`);
    }
    decodeCiiAsciiByteString(field.rawField);
    if (!/^[+-]?\d+$/.test(field.rawField.trim())) {
      throw new Error(`CII_WRITER_2_HANGER_PARTIAL_PACKED_INTEGER_TOKEN_REQUIRED:${label}:${field?.valueIndex}`);
    }
  }
  return fields;
}
function assertPackedSourceTailQualified(sourceRows, count, label) {
  const numericCount = Number(count); const expectedRows = Math.ceil(numericCount / VALUES_PER_PACKED_ROW);
  if (!Number.isSafeInteger(numericCount) || numericCount <= 0 || sourceRows.length !== expectedRows) {
    throw new Error(`CII_WRITER_2_HANGER_PARTIAL_PACKED_SOURCE_ROW_COUNT_REQUIRED:${label}:${sourceRows.length}:${expectedRows}`);
  }
  for (let rowIndex = 0; rowIndex < sourceRows.length; rowIndex += 1) {
    const row = sourceRows[rowIndex]; const raw = String(row?.text || '');
    const isLast = rowIndex === sourceRows.length - 1;
    const fieldsInRow = isLast ? (numericCount % VALUES_PER_PACKED_ROW || VALUES_PER_PACKED_ROW) : VALUES_PER_PACKED_ROW;
    const expectedLength = PACKED_PREFIX.length + fieldsInRow * FIELD_WIDTH;
    decodeCiiAsciiByteString(raw);
    if (raw.slice(0, PACKED_PREFIX.length) !== PACKED_PREFIX || raw.length !== expectedLength) {
      throw new Error(`CII_WRITER_2_HANGER_PARTIAL_PACKED_SOURCE_ACTIVE_FIELDS_ONLY_REQUIRED:${label}:${rowIndex + 1}:${raw.length}:${expectedLength}`);
    }
  }
  return Object.freeze({ authority: CII_WRITER_2_HANGER_PACKED_TAIL_AUTHORITY,
    sourceTrailingBytes: 0, postUnusedFieldPolicy: 'OMIT_UNUSED_FIELDS' });
}
function repackPackedRows(plan, label, sourceRows) {
  const fields = retainedPackedFields(plan, label); const afterRows = Number(plan?.compaction?.packedRowsAfter);
  assertPackedSourceTailQualified(sourceRows, Number(plan.countBefore), label);
  if (!Number.isSafeInteger(afterRows) || afterRows !== Math.ceil(fields.length / VALUES_PER_PACKED_ROW) || sourceRows.length < afterRows) {
    throw new Error(`CII_WRITER_2_HANGER_PARTIAL_PACKED_ROW_COUNT_INVALID:${label}:${sourceRows.length}:${afterRows}`);
  }
  const rows = [];
  for (let offset = 0, rowIndex = 0; offset < fields.length; offset += VALUES_PER_PACKED_ROW, rowIndex += 1) {
    rows.push(PACKED_PREFIX + fields.slice(offset, offset + VALUES_PER_PACKED_ROW).map((field) => field.rawField).join('')
      + lineEndingBytes(sourceRows[rowIndex], `CII_WRITER_2_HANGER_PARTIAL_${label}`));
  }
  return Object.freeze(rows);
}
function controlReplacement(targetDocument, plan) {
  const original = String(targetDocument?.physicalFile?.originalByteString ?? ''); const custody = plan.physicalCustody.control || {};
  const start = Number(custody.byteStart); const end = Number(custody.byteEnd);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end - start !== FIELD_WIDTH) throw new Error('CII_WRITER_2_HANGER_PARTIAL_CONTROL_SPAN_INVALID');
  const beforeField = original.slice(start, end); const expectedBefore = integerField(plan.countBefore, 'CII_WRITER_2_HANGER_PARTIAL_CONTROL_BEFORE');
  if (beforeField !== custody.beforeField || beforeField !== expectedBefore || Number(plan.controlCountBefore) !== Number(plan.countBefore)) {
    throw new Error('CII_WRITER_2_HANGER_PARTIAL_CONTROL_PREIMAGE_MISMATCH');
  }
  return Object.freeze({ kind: 'CONTROL_HANGER_COUNT', byteStart: start, byteEnd: end, beforeField,
    afterField: integerField(plan.countAfter, 'CII_WRITER_2_HANGER_PARTIAL_CONTROL_AFTER'),
    expectedNumericBefore: Number(plan.countBefore), expectedNumericAfter: Number(plan.countAfter) });
}
function payloadReplacement(targetDocument, plan) {
  const physicalFile = targetDocument?.physicalFile; const original = String(physicalFile?.originalByteString ?? '');
  const envelope = rawSectionEnvelope(physicalFile, 'MISCEL_1'); const groups = partitionRows(envelope, plan);
  const after = [];
  for (const row of groups.prefixRows) after.push(rowBytes(original, row, 'CII_WRITER_2_HANGER_PARTIAL_PREFIX'));
  for (const row of groups.defaultRows) after.push(rowBytes(original, row, 'CII_WRITER_2_HANGER_PARTIAL_DEFAULT'));
  after.push(...repackPackedRows(plan, 'IHGRNODE', groups.packed.IHGRNODE));
  const tailIndices = [...(plan?.compaction?.retainedHgrdatTagGuidRowIndices || [])].map(Number);
  if (tailIndices.length !== Number(plan.countAfter) * 4) throw new Error('CII_WRITER_2_HANGER_PARTIAL_TAIL_RETAINED_ROW_COUNT_MISMATCH');
  for (const index of tailIndices) {
    const row = groups.tailRows[index - 1]; if (!row) throw new Error(`CII_WRITER_2_HANGER_PARTIAL_TAIL_ROW_REQUIRED:${index}`);
    after.push(rowBytes(original, row, 'CII_WRITER_2_HANGER_PARTIAL_TAIL'));
  }
  const freeIndices = [...(plan?.compaction?.retainedIhgrfreeRecordIndices || [])].map(Number);
  const retained = [...(plan.retainedRecordIndices || [])].map(Number);
  if (freeIndices.length !== retained.length || freeIndices.some((value, index) => value !== retained[index])) {
    throw new Error('CII_WRITER_2_HANGER_PARTIAL_IHGRFREE_RECORD_ORDER_MISMATCH');
  }
  for (const index of freeIndices) {
    const row = groups.ihgrfreeRows[index - 1]; if (!row) throw new Error(`CII_WRITER_2_HANGER_PARTIAL_IHGRFREE_ROW_REQUIRED:${index}`);
    after.push(rowBytes(original, row, 'CII_WRITER_2_HANGER_PARTIAL_IHGRFREE'));
  }
  for (const label of PACKED_LABELS.slice(1)) after.push(...repackPackedRows(plan, label, groups.packed[label]));
  for (const row of groups.executionRows) after.push(rowBytes(original, row, 'CII_WRITER_2_HANGER_PARTIAL_EXECUTION'));
  if (after.length !== Number(plan?.compaction?.expectedMiscelRowsAfter)) {
    throw new Error(`CII_WRITER_2_HANGER_PARTIAL_MISCEL_POST_ROW_COUNT_MISMATCH:${after.length}:${plan?.compaction?.expectedMiscelRowsAfter}`);
  }
  const start = Number(envelope.marker.byteEnd); const end = Number(envelope.nextMarker.byteStart); const beforeField = original.slice(start, end);
  if (beforeField !== String(plan?.physicalCustody?.miscelPayload?.beforeField ?? '')) throw new Error('CII_WRITER_2_HANGER_PARTIAL_MISCEL_PLAN_PREIMAGE_MISMATCH');
  return Object.freeze({ kind: 'MISCEL_1_HANGER_PARTIAL_COMPACT_PAYLOAD', byteStart: start, byteEnd: end, beforeField,
    afterField: after.join(''), rowCountBefore: envelope.rows.length, rowCountAfter: after.length,
    tailOrder: plan?.physicalCustody?.recordBinding?.tailOrder, packedRowsBefore: Number(plan?.compaction?.packedRowsBefore),
    packedRowsAfter: Number(plan?.compaction?.packedRowsAfter) });
}
function assertDisjoint(replacements) {
  const sorted = [...replacements].sort((a, b) => a.byteStart - b.byteStart || a.byteEnd - b.byteEnd);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].byteStart < sorted[index - 1].byteEnd) throw new Error(`CII_WRITER_2_HANGER_PARTIAL_REPLACEMENT_OVERLAP:${sorted[index - 1].kind}:${sorted[index].kind}`);
  }
  return sorted;
}
function applyReplacements(original, replacements) {
  let cursor = 0; let output = '';
  for (const replacement of replacements) {
    if (original.slice(replacement.byteStart, replacement.byteEnd) !== replacement.beforeField) {
      throw new Error(`CII_WRITER_2_HANGER_PARTIAL_STALE_PREIMAGE:${replacement.kind}:${replacement.byteStart}`);
    }
    output += original.slice(cursor, replacement.byteStart) + replacement.afterField; cursor = replacement.byteEnd;
  }
  return output + original.slice(cursor);
}
function byteStringToBytes(value) {
  const textValue = String(value ?? ''); const out = new Uint8Array(textValue.length);
  for (let index = 0; index < textValue.length; index += 1) out[index] = textValue.charCodeAt(index) & 0xff;
  return out;
}

export function applyCiiWriter2HangerPartialDelete({ targetDocument, transferPlan }) {
  const scopeCustody = assertBoundScopeCustody(transferPlan, targetDocument);
  const target0HashCustody = assertTarget0HashCustody(targetDocument, scopeCustody);
  const plan = buildCiiWriter2HangerDeletePlan({ targetDocument, transferPlan }); assertPartialPlan(plan);
  const original = String(targetDocument?.physicalFile?.originalByteString ?? '');
  if (!original || targetDocument?.writer1CByteEligible !== true || targetDocument?.physicalFile?.writer1CByteEligible !== true) {
    throw new Error('CII_WRITER_2_HANGER_PARTIAL_ORIGINAL_BYTE_AUTHORITY_REQUIRED');
  }
  const replacements = assertDisjoint([controlReplacement(targetDocument, plan), payloadReplacement(targetDocument, plan)])
    .filter((item) => item.beforeField !== item.afterField);
  const byteString = applyReplacements(original, replacements); const bytes = byteStringToBytes(byteString);
  const canonicalPostimage = createCiiPhysicalFile(bytes);
  if (canonicalPostimage.originalByteString !== byteString) {
    throw new Error('CII_WRITER_2_HANGER_PARTIAL_POSTIMAGE_BINARY_STRING_MISMATCH');
  }
  const postimageHashCustody = Object.freeze({ authority: POSTIMAGE_HASH_AUTHORITY,
    contentSha256: sha256CiiByteString(byteString), byteLength: byteString.length });
  const postimageRepresentationCustody = Object.freeze({
    authority: POSTIMAGE_REPRESENTATION_AUTHORITY,
    byteLength: canonicalPostimage.byteLength,
    textLength: canonicalPostimage.text.length,
    textEncodingAuthority: canonicalPostimage.textEncodingAuthority,
    lineCount: canonicalPostimage.lines.length,
    lineEndingStyle: canonicalPostimage.lineEndings.style,
    finalLineTerminated: canonicalPostimage.lineEndings.finalLineTerminated,
  });
  return Object.freeze({
    schema: 'CIIWorkspaceWriter2HangerPartialDeleteResult.v1', status: 'APPLIED', writer: 'WRITER_2', family: 'HANGER_PARTIAL_DELETE',
    byteString, bytes, text: canonicalPostimage.text, byteLengthBefore: original.length, byteLengthAfter: byteString.length,
    hangerCountBefore: Number(plan.countBefore), hangerCountAfter: Number(plan.countAfter),
    deletedRecordIndices: Object.freeze([...(plan.deletedRecordIndices || [])]), retainedRecordIndices: Object.freeze([...(plan.retainedRecordIndices || [])]),
    oldToNewRecordIndex: Object.freeze({ ...(plan.oldToNewRecordIndex || {}) }), tailOrder: plan?.physicalCustody?.recordBinding?.tailOrder,
    packedRowsBefore: Number(plan?.compaction?.packedRowsBefore), packedRowsAfter: Number(plan?.compaction?.packedRowsAfter),
    packedTailAuthority: CII_WRITER_2_HANGER_PACKED_TAIL_AUTHORITY, target0HashCustody, postimageHashCustody, postimageRepresentationCustody,
    mutationCount: replacements.length, mutations: Object.freeze(replacements), scopeCustody, deletePlan: plan,
  });
}

export const _test = Object.freeze({ markerName, integerField, lineEndingBytes, rawSectionEnvelope, exactScopeIds, assertScopeSetsDisjoint,
  assertCanonicalOperationContainers, assertBoundScopeCustody, assertTarget0HashCustody, assertPartialPlan, partitionRows, retainedPackedFields,
  assertPackedSourceTailQualified, repackPackedRows, controlReplacement, payloadReplacement, assertDisjoint, applyReplacements });
