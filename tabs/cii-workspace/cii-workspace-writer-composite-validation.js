import { deepFreeze, stableStringify } from './cii-workspace-contracts.js';

function sectionOrder(document) {
  return (document?.physicalFile?.lines || [])
    .map((line) => String(line.text || '').match(/^\s*#\$\s*(.*?)\s*$/)?.[1]?.toUpperCase())
    .filter(Boolean);
}
function componentPass(component, validation, label, errors) {
  if (!component) return;
  if (!validation || validation.status !== 'PASS') errors.push(`COMPOSITE_${label}_COMPONENT_VALIDATION_REQUIRED`);
}
function lowerWriterAuthority(operation) {
  const authority = String(operation?.policyAuthority || '');
  if (authority.startsWith('CII_WRITER_1A_')) return 'WRITER_1A';
  if (authority.startsWith('CII_WRITER_1B_')) return 'WRITER_1B';
  return null;
}
function operationMap(plan) {
  return new Map((plan?.operations || []).map((operation) => [String(operation?.operationId || ''), operation]));
}
function lowerClaim(beforeDocument, mutation, operation, errors) {
  const sourceWriter = lowerWriterAuthority(operation);
  if (!sourceWriter) { errors.push(`COMPOSITE_LOWER_POLICY_AUTHORITY_REQUIRED:${mutation?.operationId || 'unknown'}`); return null; }
  const lineIndex = Number(mutation?.lineNumber) - 1; const line = beforeDocument?.physicalFile?.lines?.[lineIndex];
  const startColumn = Number(mutation?.startColumn) - 1; const endColumn = Number(mutation?.endColumn);
  if (!line || !Number.isSafeInteger(startColumn) || !Number.isSafeInteger(endColumn) || startColumn < 0 || endColumn <= startColumn) {
    errors.push(`COMPOSITE_LOWER_SPAN_CUSTODY_INVALID:${mutation?.operationId || 'unknown'}`); return null;
  }
  const start = Number(line.byteStart) + startColumn; const end = Number(line.byteStart) + endColumn;
  return Object.freeze({
    start, end, spanKey: `${start}:${end}`, beforeField: String(mutation?.beforeField ?? ''), afterField: String(mutation?.afterField ?? ''),
    sourceWriter, operationIds: Object.freeze([String(mutation?.operationId || 'unknown')]),
  });
}
function writer1CClaim(mutation, errors) {
  const start = Number(mutation?.absoluteByteStart); const end = Number(mutation?.absoluteByteEnd);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start) {
    errors.push(`COMPOSITE_WRITER1C_SPAN_CUSTODY_INVALID:${(mutation?.operationIds || []).join(',') || 'unknown'}`); return null;
  }
  return Object.freeze({
    start, end, spanKey: `${start}:${end}`, beforeField: String(mutation?.beforeField ?? ''), afterField: String(mutation?.afterField ?? ''),
    sourceWriter: 'WRITER_1C', operationIds: Object.freeze([...(mutation?.operationIds || [])].map(String)),
  });
}
function validateClaimShape(claim, errors) {
  if (!claim) return false;
  const width = claim.end - claim.start;
  if (!Number.isSafeInteger(claim.start) || !Number.isSafeInteger(claim.end) || claim.start < 0 || claim.end <= claim.start) {
    errors.push(`COMPOSITE_AUTHORIZED_SPAN_INVALID:${claim.spanKey}`); return false;
  }
  if (width !== claim.beforeField.length || width !== claim.afterField.length) {
    errors.push(`COMPOSITE_AUTHORIZED_SPAN_WIDTH_MISMATCH:${claim.spanKey}`); return false;
  }
  return true;
}
function canonicalizeIndependentClaims(claims, errors) {
  const grouped = new Map();
  for (const claim of claims.filter((item) => validateClaimShape(item, errors))) {
    if (!grouped.has(claim.spanKey)) grouped.set(claim.spanKey, []);
    grouped.get(claim.spanKey).push(claim);
  }
  const spans = [];
  for (const [spanKey, group] of grouped) {
    const writers = new Set(group.map((item) => item.sourceWriter));
    if (writers.size > 1) { errors.push(`COMPOSITE_CROSS_FAMILY_SAME_SPAN:${spanKey}`); continue; }
    const before = new Set(group.map((item) => item.beforeField)); const after = new Set(group.map((item) => item.afterField));
    if (before.size !== 1 || after.size !== 1) { errors.push(`COMPOSITE_SAME_FAMILY_SPAN_CONFLICT:${spanKey}`); continue; }
    const first = group[0];
    spans.push(Object.freeze({
      start: first.start, end: first.end, spanKey, beforeField: first.beforeField, afterField: first.afterField,
      sourceWriters: Object.freeze([...writers]), operationIds: Object.freeze([...new Set(group.flatMap((item) => item.operationIds))].sort()),
    }));
  }
  spans.sort((a, b) => a.start - b.start || a.end - b.end);
  for (let index = 1; index < spans.length; index += 1) {
    if (spans[index - 1].start < spans[index].end && spans[index].start < spans[index - 1].end) {
      errors.push(`COMPOSITE_AUTHORIZED_SPAN_OVERLAP:${spans[index - 1].spanKey}:${spans[index].spanKey}`);
    }
  }
  return spans;
}
function independentlyAuthorizedSpans(beforeDocument, writerResult, errors) {
  const claims = [];
  const lower = writerResult?.components?.lower;
  if (lower) {
    const operations = operationMap(lower.transferPlan);
    for (const mutation of lower.result?.mutations || []) {
      claims.push(lowerClaim(beforeDocument, mutation, operations.get(String(mutation?.operationId || '')), errors));
    }
  }
  const writer1C = writerResult?.components?.writer1C;
  if (writer1C) for (const mutation of writer1C.result?.mutations || []) claims.push(writer1CClaim(mutation, errors));
  return canonicalizeIndependentClaims(claims, errors);
}
function spanSignature(span) {
  return stableStringify({
    start: Number(span.start ?? span.absoluteByteStart), end: Number(span.end ?? span.absoluteByteEnd),
    beforeField: String(span.beforeField ?? ''), afterField: String(span.afterField ?? ''),
    sourceWriters: [...(span.sourceWriters || [])].map(String).sort(),
  });
}
function writerClaimCheck(writerResult, spans, errors) {
  const expected = spans.map(spanSignature).sort();
  const reported = (writerResult?.mutations || []).map(spanSignature).sort();
  if (stableStringify(expected) !== stableStringify(reported)) errors.push('COMPOSITE_WRITER_REPORTED_UNION_MISMATCH');
}
function actualByteDiff(before, after, spans, errors) {
  if (before.length !== after.length) { errors.push('COMPOSITE_BYTE_LENGTH_CHANGED'); return []; }
  const changed = []; let spanIndex = 0;
  for (let index = 0; index < before.length; index += 1) {
    if (before.charCodeAt(index) === after.charCodeAt(index)) continue;
    changed.push(index);
    while (spanIndex < spans.length && index >= spans[spanIndex].end) spanIndex += 1;
    const span = spans[spanIndex];
    if (!span || index < span.start || index >= span.end) errors.push(`COMPOSITE_UNAUTHORIZED_BYTE_CHANGE:${index}`);
  }
  for (const span of spans) {
    if (before.slice(span.start, span.end) !== span.beforeField) errors.push(`COMPOSITE_BEFORE_FIELD_MISMATCH:${span.spanKey}`);
    if (after.slice(span.start, span.end) !== span.afterField) errors.push(`COMPOSITE_AFTER_FIELD_MISMATCH:${span.spanKey}`);
  }
  return changed;
}

export function validateCiiWriterCompositeRoundTrip(beforeDocument, afterDocument, writerResult, componentValidations = {}) {
  const errors = [];
  if (beforeDocument?.writer1CByteEligible !== true || afterDocument?.writer1CByteEligible !== true) errors.push('COMPOSITE_ORIGINAL_BYTE_CUSTODY_REQUIRED');
  const before = String(beforeDocument?.physicalFile?.originalByteString ?? '');
  const after = String(afterDocument?.physicalFile?.originalByteString ?? '');
  const spans = independentlyAuthorizedSpans(beforeDocument, writerResult, errors);
  writerClaimCheck(writerResult, spans, errors);
  const changed = actualByteDiff(before, after, spans, errors);
  componentPass(writerResult?.components?.lower, componentValidations.lower, 'LOWER_1A_1B', errors);
  componentPass(writerResult?.components?.writer1C, componentValidations.writer1C, 'WRITER_1C', errors);
  if (beforeDocument?.physicalFile?.byteLength !== afterDocument?.physicalFile?.byteLength) errors.push('COMPOSITE_PHYSICAL_BYTE_LENGTH_CHANGED');
  if ((beforeDocument?.physicalFile?.lines || []).length !== (afterDocument?.physicalFile?.lines || []).length) errors.push('COMPOSITE_PHYSICAL_LINE_COUNT_CHANGED');
  if (stableStringify(beforeDocument?.physicalFile?.lineEndings?.sequence) !== stableStringify(afterDocument?.physicalFile?.lineEndings?.sequence)) {
    errors.push('COMPOSITE_LINE_ENDING_SEQUENCE_CHANGED');
  }
  if (stableStringify(sectionOrder(beforeDocument)) !== stableStringify(sectionOrder(afterDocument))) errors.push('COMPOSITE_SECTION_ORDER_CHANGED');
  const resultBytes = writerResult?.bytes instanceof Uint8Array ? writerResult.bytes : null;
  if (!resultBytes || resultBytes.length !== after.length) errors.push('COMPOSITE_RESULT_BYTE_VECTOR_REQUIRED');
  else {
    for (let index = 0; index < resultBytes.length; index += 1) {
      if (resultBytes[index] !== after.charCodeAt(index)) { errors.push(`COMPOSITE_RESULT_REPARSE_BYTE_MISMATCH:${index}`); break; }
    }
  }
  if (errors.length) throw new Error(`CII_WRITER_COMPOSITE_NEGATIVE_ASSURANCE_FAILED:${[...new Set(errors)].join('|')}`);
  return deepFreeze({
    schema: 'CIIWorkspaceWriterCompositeValidation.v2', status: 'PASS',
    authorizedSpanCount: spans.length, changedByteCount: changed.length,
    componentValidations: deepFreeze(componentValidations),
    checks: Object.freeze([
      'LOWER_1A_1B_COMPONENT_VALIDATED_FROM_ORIGINAL_PREIMAGE',
      'WRITER_1C_COMPONENT_VALIDATED_FROM_ORIGINAL_PREIMAGE',
      'AUTHORIZED_UNION_INDEPENDENTLY_RECONSTRUCTED_FROM_COMPONENTS',
      'WRITER_REPORTED_UNION_MATCHES_INDEPENDENT_COMPONENT_UNION',
      'CROSS_FAMILY_AUTHORIZED_SPANS_DISJOINT',
      'FINAL_BYTE_DIFF_SUBSET_OF_AUTHORIZED_UNION',
      'EXACT_AUTHORIZED_PREIMAGE_AND_POSTIMAGE',
      'ONE_ORIGINAL_BYTE_VECTOR_PATCH',
      'BYTE_LINE_ENDING_AND_SECTION_STRUCTURE_UNCHANGED',
      'FINAL_REPARSE_BYTES_MATCH_WRITER_RESULT',
    ]),
  });
}

export const _test = Object.freeze({ lowerWriterAuthority, independentlyAuthorizedSpans, writerClaimCheck });
