import { stableStringify } from './cii-workspace-contracts.js';
import { CII_SIX_FIELD_WIDTHS, decodeCiiNumericRow } from '../../parser/fixed-field.js';
import { ciiPhysicalSectionRows } from './cii-workspace-physical-file.js';
import { buildCiiWriter2HangerDeletePlan } from './cii-workspace-writer2-hanger-delete.js';
import { CII_HANGER_LAYOUTS } from './cii-workspace-hanger.js';

const CONTROL_PAYLOAD_ROW_INDEX = 0;
const CONTROL_HANGER_FIELD_INDEX = 2;
const WIDTH = 13;
const EXECUTION_ROWS = 4;

function markerName(value) {
  const match = String(value ?? '').match(/^\s*#\$\s*(.*?)\s*$/);
  return match ? match[1].trim().toUpperCase() : null;
}
function integerField(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error('WRITER_2_HANGER_VALIDATOR_INTEGER_INVALID');
  const token = String(number);
  if (token.length > WIDTH) throw new Error('WRITER_2_HANGER_VALIDATOR_INTEGER_OVERFLOW');
  return token.padStart(WIDTH, ' ');
}
function ceilDiv(value, divisor) { return Math.floor(value / divisor) + (value % divisor ? 1 : 0); }
function sectionEnvelope(document, section) {
  const lines = document?.physicalFile?.lines || []; const wanted = String(section || '').trim().toUpperCase();
  const markerIndex = lines.findIndex((line) => markerName(line.text) === wanted);
  if (markerIndex < 0) throw new Error(`WRITER_2_HANGER_VALIDATOR_SECTION_NOT_FOUND:${wanted}`);
  let nextIndex = markerIndex + 1;
  while (nextIndex < lines.length && markerName(lines[nextIndex].text) === null) nextIndex += 1;
  if (nextIndex >= lines.length) throw new Error(`WRITER_2_HANGER_VALIDATOR_NEXT_SECTION_REQUIRED:${wanted}`);
  return { marker: lines[markerIndex], nextMarker: lines[nextIndex], rows: lines.slice(markerIndex + 1, nextIndex) };
}
function controlReplacement(before, plan) {
  const lines = before?.physicalFile?.lines || [];
  const markerIndex = lines.findIndex((line) => markerName(line.text) === 'CONTROL');
  const row = markerIndex >= 0 ? lines[markerIndex + 1 + CONTROL_PAYLOAD_ROW_INDEX] : null;
  if (!row) throw new Error('WRITER_2_HANGER_VALIDATOR_CONTROL_ROW1_REQUIRED');
  const startColumn = CII_SIX_FIELD_WIDTHS.slice(0, CONTROL_HANGER_FIELD_INDEX).reduce((sum, width) => sum + width, 0);
  const byteStart = Number(row.byteStart) + startColumn; const byteEnd = byteStart + WIDTH;
  const original = String(before?.physicalFile?.originalByteString || '');
  const beforeField = original.slice(byteStart, byteEnd);
  if (beforeField !== integerField(plan.controlCountBefore)) throw new Error('WRITER_2_HANGER_VALIDATOR_CONTROL_PREIMAGE_FORMAT_MISMATCH');
  return { kind: 'CONTROL_HANGER_COUNT', byteStart, byteEnd, beforeField, afterField: integerField(0) };
}
function expectedPhysicalCounts(before) {
  const control = before?.hangerEvidence?.control || {};
  const numelt = Number(control.numelt); const numnoz = Number(control.numnoz); const count = Number(before?.hangerEvidence?.count);
  if (![numelt, numnoz, count].every(Number.isSafeInteger) || numelt < 0 || numnoz < 0 || count <= 0) {
    throw new Error('WRITER_2_HANGER_VALIDATOR_CONTROL_COUNTS_INVALID');
  }
  const prefixRows = ceilDiv(numelt, 6) + 4 * numnoz;
  const hangerRows = 2 + 5 * count + 5 * ceilDiv(count, 6);
  return { count, prefixRows, hangerRows, rowCountBefore: prefixRows + hangerRows + EXECUTION_ROWS,
    rowCountAfter: prefixRows + EXECUTION_ROWS };
}
function payloadReplacement(before, plan) {
  const envelope = sectionEnvelope(before, 'MISCEL_1'); const original = String(before?.physicalFile?.originalByteString || '');
  const counts = expectedPhysicalCounts(before);
  if (Number(plan.countBefore) !== counts.count || Number(plan.countAfter) !== 0 || plan?.compaction?.deleteAll !== true) {
    throw new Error('WRITER_2_HANGER_VALIDATOR_DELETE_ALL_PLAN_REQUIRED');
  }
  if (envelope.rows.length !== counts.rowCountBefore) {
    throw new Error(`WRITER_2_HANGER_VALIDATOR_PRE_ROW_COUNT_MISMATCH:${envelope.rows.length}:${counts.rowCountBefore}`);
  }
  const retainedRows = [
    ...envelope.rows.slice(0, counts.prefixRows),
    ...envelope.rows.slice(envelope.rows.length - EXECUTION_ROWS),
  ];
  if (retainedRows.length !== counts.rowCountAfter) throw new Error('WRITER_2_HANGER_VALIDATOR_POST_ROW_COUNT_DERIVATION_MISMATCH');
  const retained = [];
  for (const row of retainedRows) {
    if (row.lineEnding === 'NONE') throw new Error(`WRITER_2_HANGER_VALIDATOR_RETAINED_ROW_ENDING_REQUIRED:${row.lineNumber}`);
    retained.push(original.slice(Number(row.byteStart), Number(row.byteEnd)));
  }
  return {
    kind: 'MISCEL_1_HANGER_DELETE_ALL_PAYLOAD', byteStart: Number(envelope.marker.byteEnd), byteEnd: Number(envelope.nextMarker.byteStart),
    beforeField: original.slice(Number(envelope.marker.byteEnd), Number(envelope.nextMarker.byteStart)), afterField: retained.join(''),
    rowCountBefore: counts.rowCountBefore, rowCountAfter: counts.rowCountAfter,
  };
}
function expectedReplacements(before, plan) {
  const rows = [controlReplacement(before, plan), payloadReplacement(before, plan)]
    .sort((a, b) => a.byteStart - b.byteStart || a.byteEnd - b.byteEnd)
    .filter((item) => item.beforeField !== item.afterField);
  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index].byteStart < rows[index - 1].byteEnd) throw new Error('WRITER_2_HANGER_VALIDATOR_REPLACEMENT_OVERLAP');
  }
  return rows;
}
function applyExpected(original, replacements) {
  let cursor = 0; let output = '';
  for (const replacement of replacements) {
    if (original.slice(replacement.byteStart, replacement.byteEnd) !== replacement.beforeField) {
      throw new Error(`WRITER_2_HANGER_VALIDATOR_PREIMAGE_MISMATCH:${replacement.kind}`);
    }
    output += original.slice(cursor, replacement.byteStart) + replacement.afterField;
    cursor = replacement.byteEnd;
  }
  return output + original.slice(cursor);
}
function controlCount(document) {
  const row = ciiPhysicalSectionRows(document?.physicalFile, 'CONTROL')[CONTROL_PAYLOAD_ROW_INDEX];
  const values = row ? decodeCiiNumericRow(row.text) : [];
  return Number(values?.[CONTROL_HANGER_FIELD_INDEX]);
}
function connectivity(document) {
  return (document?.parsed?.elements || []).map((item) => ({ index: Number(item.index), from: String(item.from), to: String(item.to) }));
}
function sectionOrder(document) {
  return (document?.physicalFile?.lines || []).map((line) => markerName(line.text)).filter(Boolean);
}
function mutationTestimony(writerResult) {
  return (writerResult?.mutations || []).map((item) => ({
    kind: item.kind, byteStart: Number(item.byteStart), byteEnd: Number(item.byteEnd),
    beforeField: item.beforeField, afterField: item.afterField,
  }));
}
function expectedTestimony(replacements) {
  return replacements.map((item) => ({
    kind: item.kind, byteStart: Number(item.byteStart), byteEnd: Number(item.byteEnd),
    beforeField: item.beforeField, afterField: item.afterField,
  }));
}
function planTestimony(plan) {
  return {
    countBefore: Number(plan?.countBefore), countAfter: Number(plan?.countAfter),
    deletedRecordIndices: [...(plan?.deletedRecordIndices || [])], deletedNodes: [...(plan?.deletedNodes || [])],
    deleteAll: plan?.compaction?.deleteAll === true, partialMultiRecordDelete: plan?.compaction?.partialMultiRecordDelete === true,
    expectedMiscelRowsAfter: Number(plan?.compaction?.expectedMiscelRowsAfter),
  };
}

export function validateCiiWriter2HangerDeleteAllRoundTrip(before, after, transferPlan, writerResult) {
  const errors = [];
  const plan = buildCiiWriter2HangerDeletePlan({ targetDocument: before, transferPlan });
  if (!plan.ready) errors.push(...plan.blockers.map((item) => `INDEPENDENT_HANGER_DELETE_PLAN_BLOCKED:${item}`));
  if (plan?.compaction?.deleteAll !== true || Number(plan.countAfter) !== 0) errors.push('WRITER_2_HANGER_DELETE_ALL_SCOPE_NOT_PROVEN');
  if (plan.createAuthority?.ready !== false) errors.push('WRITER_2_HANGER_CREATE_AUTHORITY_UNEXPECTEDLY_READY');
  const replacements = plan.ready && plan?.compaction?.deleteAll === true ? expectedReplacements(before, plan) : [];
  const expectedBytes = plan.ready && plan?.compaction?.deleteAll === true
    ? applyExpected(String(before?.physicalFile?.originalByteString || ''), replacements) : null;
  const actualBytes = String(after?.physicalFile?.originalByteString || '');
  if (after?.writer1CByteEligible !== true) errors.push('WRITER_2_HANGER_POST_ORIGINAL_BYTE_CUSTODY_NOT_QUALIFIED');
  if (expectedBytes != null && actualBytes !== expectedBytes) errors.push('WRITER_2_HANGER_EXACT_POSTIMAGE_MISMATCH');
  if (String(writerResult?.byteString ?? '') !== actualBytes) errors.push('WRITER_2_HANGER_RESULT_BYTES_MISMATCH');
  if (stableStringify(mutationTestimony(writerResult)) !== stableStringify(expectedTestimony(replacements))) {
    errors.push('WRITER_2_HANGER_MUTATION_TESTIMONY_MISMATCH');
  }
  if (writerResult?.schema !== 'CIIWorkspaceWriter2HangerDeleteAllResult.v1' || writerResult?.status !== 'APPLIED'
    || writerResult?.writer !== 'WRITER_2' || writerResult?.family !== 'HANGER_DELETE_ALL') {
    errors.push('WRITER_2_HANGER_RESULT_CONTRACT_MISMATCH');
  }
  if (Number(writerResult?.mutationCount) !== replacements.length) errors.push('WRITER_2_HANGER_MUTATION_COUNT_TESTIMONY_MISMATCH');
  if (Number(writerResult?.hangerCountBefore) !== Number(plan.countBefore) || Number(writerResult?.hangerCountAfter) !== 0) {
    errors.push('WRITER_2_HANGER_RESULT_COUNT_TESTIMONY_MISMATCH');
  }
  const beforeLength = String(before?.physicalFile?.originalByteString || '').length;
  if (Number(writerResult?.byteLengthBefore) !== beforeLength || Number(writerResult?.byteLengthAfter) !== actualBytes.length) {
    errors.push('WRITER_2_HANGER_RESULT_LENGTH_TESTIMONY_MISMATCH');
  }
  if (controlCount(after) !== 0) errors.push('WRITER_2_HANGER_CONTROL_POSTCOUNT_MISMATCH');
  const expectedAfterRows = expectedPhysicalCounts(before).rowCountAfter;
  if (ciiPhysicalSectionRows(after?.physicalFile, 'MISCEL_1').length !== expectedAfterRows) errors.push('WRITER_2_HANGER_POST_ROW_COUNT_MISMATCH');
  if (after?.hangerEvidence?.status !== 'QUALIFIED' || Number(after?.hangerEvidence?.count) !== 0
    || after?.hangerEvidence?.layout !== CII_HANGER_LAYOUTS.NONE || (after?.hangerEvidence?.nodes || []).length !== 0) {
    errors.push('WRITER_2_HANGER_POST_HANGER_CUSTODY_MISMATCH');
  }
  if (stableStringify(connectivity(before)) !== stableStringify(connectivity(after))) errors.push('WRITER_2_HANGER_CONNECTIVITY_CHANGED');
  if (stableStringify(sectionOrder(before)) !== stableStringify(sectionOrder(after))) errors.push('WRITER_2_HANGER_SECTION_ORDER_CHANGED');
  if (!writerResult?.deletePlan || stableStringify(planTestimony(writerResult.deletePlan)) !== stableStringify(planTestimony(plan))) {
    errors.push('WRITER_2_HANGER_PLAN_TESTIMONY_MISMATCH');
  }
  if (errors.length) throw new Error(`CII_WRITER_2_HANGER_DELETE_ALL_ROUNDTRIP_FAILED:${[...new Set(errors)].join('|')}`);
  return Object.freeze({
    schema: 'CIIWorkspaceWriter2HangerDeleteAllValidation.v1', status: 'PASS',
    checks: Object.freeze(['INDEPENDENT_DELETE_ALL_PLAN_REBUILD', 'EXACT_FULL_BYTE_POSTIMAGE', 'CONTROL_NOHGRS_ZERO',
      'MISCEL_1_PREFIX_SUFFIX_BYTE_PRESERVATION', 'HANGER_POST_CUSTODY_ZERO', 'CONNECTIVITY_STABLE', 'SECTION_ORDER_STABLE',
      'WRITER_TESTIMONY_MATCH', 'CREATE_AUTHORITY_REMAINS_BLOCKED']),
    hangerCountBefore: plan.countBefore, hangerCountAfter: 0, expectedMiscelRowsAfter: expectedAfterRows,
  });
}

export const _test = Object.freeze({ markerName, integerField, ceilDiv, sectionEnvelope, controlReplacement,
  expectedPhysicalCounts, payloadReplacement, expectedReplacements, applyExpected, controlCount });
