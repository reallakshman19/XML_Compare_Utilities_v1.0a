import { stableStringify } from './cii-workspace-contracts.js';
import { CII_SIX_FIELD_WIDTHS, decodeCiiNumericRow } from '../../parser/fixed-field.js';
import { ciiPhysicalSectionRows } from './cii-workspace-physical-file.js';
import { buildCiiWriter2NodeNameRelocationPlan } from './cii-workspace-writer2-nodename-relocation.js';

const CONTROL_NONAM_INDEX = 3;
const WIDTH = 13;

function text(value) { return String(value ?? '').trim(); }
function markerName(value) {
  const match = String(value ?? '').match(/^\s*#\$\s*(.*?)\s*$/);
  return match ? match[1].trim().toUpperCase() : null;
}
function lineEnding(kind) {
  if (kind === 'CRLF') return '\r\n'; if (kind === 'LF') return '\n'; if (kind === 'CR') return '\r'; if (kind === 'NONE') return '';
  throw new Error(`WRITER_2_VALIDATOR_LINE_ENDING_UNSUPPORTED:${kind || 'EMPTY'}`);
}
function integerField(value) {
  const number = Number(value); if (!Number.isSafeInteger(number) || number < 0) throw new Error('WRITER_2_VALIDATOR_INTEGER_INVALID');
  const token = String(number); if (token.length > WIDTH) throw new Error('WRITER_2_VALIDATOR_INTEGER_OVERFLOW'); return token.padStart(WIDTH, ' ');
}
function exponential(value) {
  const [mantissa, rawExponent] = Number(value).toExponential(6).toUpperCase().split('E'); const exponent = Number(rawExponent);
  return `${mantissa}E${exponent < 0 ? '-' : '+'}${String(Math.abs(exponent)).padStart(2, '0')}`;
}
function independentSig6(value) {
  const number = Number(value); if (!Number.isFinite(number)) throw new Error('WRITER_2_VALIDATOR_NUMERIC_INVALID');
  const absolute = Math.abs(number); if (absolute < 1e-12) return '0.000000';
  if (absolute >= 1e9 || absolute < 1e-6) return exponential(number); if (absolute < 1.0) return number.toFixed(6);
  const integerDigits = String(Math.trunc(absolute)).length; return number.toFixed(Math.max(1, 6 - integerDigits));
}
function numericField(value) {
  const token = independentSig6(value); if (token.length > WIDTH) throw new Error('WRITER_2_VALIDATOR_NUMERIC_OVERFLOW'); return token.padStart(WIDTH, ' ');
}
function sectionEnvelope(document, wanted) {
  const lines = document?.physicalFile?.lines || []; const markerIndex = lines.findIndex((line) => markerName(line.text) === wanted);
  if (markerIndex < 0) throw new Error(`WRITER_2_VALIDATOR_SECTION_NOT_FOUND:${wanted}`);
  let nextIndex = markerIndex + 1; while (nextIndex < lines.length && markerName(lines[nextIndex].text) === null) nextIndex += 1;
  if (nextIndex >= lines.length) throw new Error(`WRITER_2_VALIDATOR_NEXT_SECTION_REQUIRED:${wanted}`);
  return { marker: lines[markerIndex], nextMarker: lines[nextIndex], rows: lines.slice(markerIndex + 1, nextIndex) };
}
function controlReplacement(before, plan) {
  const lines = before?.physicalFile?.lines || []; const markerIndex = lines.findIndex((line) => markerName(line.text) === 'CONTROL'); const row = lines[markerIndex + 1];
  if (!row) throw new Error('WRITER_2_VALIDATOR_CONTROL_ROW_REQUIRED');
  const startColumn = CII_SIX_FIELD_WIDTHS.slice(0, CONTROL_NONAM_INDEX).reduce((sum, width) => sum + width, 0);
  const byteStart = row.byteStart + startColumn; const byteEnd = byteStart + WIDTH; const bytes = before.physicalFile.originalByteString;
  const beforeField = bytes.slice(byteStart, byteEnd);
  if (beforeField !== integerField(plan.controlCountBefore)) throw new Error('WRITER_2_VALIDATOR_CONTROL_PREIMAGE_FORMAT_MISMATCH');
  return { kind: 'CONTROL_NONAM', byteStart, byteEnd, beforeField, afterField: integerField(plan.controlCountAfter) };
}
function pointerReplacements(before, plan) {
  const bytes = String(before?.physicalFile?.originalByteString || '');
  return (plan.pointerChanges || []).map((change) => ({
    kind: 'ELEMENT_NODENAME_POINTER', parsedElementIndex: Number(change.parsedElementIndex),
    byteStart: Number(change.pointerField?.byteStart), byteEnd: Number(change.pointerField?.byteEnd),
    beforeField: bytes.slice(Number(change.pointerField?.byteStart), Number(change.pointerField?.byteEnd)), afterField: integerField(change.newPointer),
  }));
}
function nodenameReplacement(before, plan) {
  const envelope = sectionEnvelope(before, 'NODENAME');
  if (envelope.rows.some((row) => !String(row.text || '').trim())) throw new Error('WRITER_2_VALIDATOR_BLANK_NODENAME_ROW_UNSUPPORTED');
  if (envelope.rows.some((row) => String(row.text || '').length !== 53)) throw new Error('WRITER_2_VALIDATOR_NODENAME_ROW_WIDTH_NOT_53');
  if (envelope.rows.length !== plan.rowCountBefore) throw new Error('WRITER_2_VALIDATOR_PRE_ROW_COUNT_MISMATCH');
  const appendEnding = envelope.rows.length ? envelope.rows[envelope.rows.length - 1].lineEnding : envelope.marker.lineEnding;
  const afterField = plan.finalRows.map((row) => {
    const ending = row.oldPointer == null ? appendEnding : envelope.rows[Number(row.oldPointer) - 1]?.lineEnding;
    if (!ending || ending === 'NONE') throw new Error(`WRITER_2_VALIDATOR_NODENAME_ENDING_REQUIRED:${row.oldPointer ?? 'NEW'}`);
    return `${String(row.rowText)}${lineEnding(ending)}`;
  }).join('');
  const bytes = before.physicalFile.originalByteString;
  return { kind: 'NODENAME_SECTION_PAYLOAD', byteStart: envelope.marker.byteEnd, byteEnd: envelope.nextMarker.byteStart,
    beforeField: bytes.slice(envelope.marker.byteEnd, envelope.nextMarker.byteStart), afterField };
}
function expectedReplacements(before, plan) {
  const rows = [controlReplacement(before, plan), ...pointerReplacements(before, plan), nodenameReplacement(before, plan)]
    .sort((a, b) => a.byteStart - b.byteStart || a.byteEnd - b.byteEnd);
  for (let index = 1; index < rows.length; index += 1) if (rows[index].byteStart < rows[index - 1].byteEnd) throw new Error('WRITER_2_VALIDATOR_REPLACEMENT_OVERLAP');
  return rows.filter((item) => item.beforeField !== item.afterField);
}

function applyExpected(original, replacements) {
  let cursor = 0; let output = '';
  for (const replacement of replacements) {
    if (original.slice(replacement.byteStart, replacement.byteEnd) !== replacement.beforeField) throw new Error(`WRITER_2_VALIDATOR_PREIMAGE_MISMATCH:${replacement.kind}`);
    output += original.slice(cursor, replacement.byteStart) + replacement.afterField; cursor = replacement.byteEnd;
  }
  return output + original.slice(cursor);
}
function operationNode(operation) { return text(operation?.targetEvidence?.identity || operation?.targetEvidence?.nodeId); }
function expectedNodeNames(before, transferPlan) {
  const expected = { ...(before?.nodeNames || {}) };
  for (const operation of transferPlan?.operations || []) {
    if (operation?.scopeDecision !== 'APPLY' || operation?.family !== 'NODE_NAME' || operation?.property !== 'Node name / to-name') continue;
    const nodeId = operationNode(operation); if (!nodeId) continue;
    if (operation.action === 'CREATE') expected[nodeId] = text(operation.proposed);
    if (operation.action === 'DELETE') delete expected[nodeId];
  }
  return expected;
}
function controlCount(document) {
  const row = ciiPhysicalSectionRows(document?.physicalFile, 'CONTROL')[0]; const values = row ? decodeCiiNumericRow(row.text) : [];
  return Number(values?.[CONTROL_NONAM_INDEX]);
}
function pointerSnapshot(document) {
  return Object.values(document?.nodeNameEvidence?.physicalCustody?.byElementIndex || {}).map((item) => ({
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
  return (writerResult?.mutations || []).map((item) => ({ kind: item.kind, byteStart: Number(item.byteStart), byteEnd: Number(item.byteEnd), afterField: item.afterField,
    ...(item.parsedElementIndex != null ? { parsedElementIndex: Number(item.parsedElementIndex) } : {}) }));
}
function expectedTestimony(replacements) {
  return replacements.map((item) => ({ kind: item.kind, byteStart: Number(item.byteStart), byteEnd: Number(item.byteEnd), afterField: item.afterField,
    ...(item.parsedElementIndex != null ? { parsedElementIndex: Number(item.parsedElementIndex) } : {}) }));
}

export function validateCiiWriter2NodeNameRoundTrip(before, after, transferPlan, writerResult) {
  const errors = []; const plan = buildCiiWriter2NodeNameRelocationPlan({ targetDocument: before, transferPlan });
  if (!plan.ready) errors.push(...plan.blockers.map((item) => `INDEPENDENT_RELOCATION_BLOCKED:${item}`));
  const replacements = plan.ready ? expectedReplacements(before, plan) : [];
  const expectedBytes = plan.ready ? applyExpected(String(before?.physicalFile?.originalByteString || ''), replacements) : null;
  const actualBytes = String(after?.physicalFile?.originalByteString || '');
  if (after?.writer1CByteEligible !== true || after?.nodeNameEvidence?.physicalCustody?.status !== 'QUALIFIED') errors.push('WRITER_2_POST_PHYSICAL_CUSTODY_NOT_QUALIFIED');
  if (expectedBytes != null && actualBytes !== expectedBytes) errors.push('WRITER_2_EXACT_POSTIMAGE_MISMATCH');
  if (writerResult?.byteString != null && String(writerResult.byteString) !== actualBytes) errors.push('WRITER_2_RESULT_BYTES_MISMATCH');
  if (stableStringify(mutationTestimony(writerResult)) !== stableStringify(expectedTestimony(replacements))) errors.push('WRITER_2_MUTATION_TESTIMONY_MISMATCH');
  if (controlCount(after) !== Number(plan.controlCountAfter)) errors.push('WRITER_2_CONTROL_NONAM_POSTCOUNT_MISMATCH');
  if (ciiPhysicalSectionRows(after?.physicalFile, 'NODENAME').length !== Number(plan.rowCountAfter)) errors.push('WRITER_2_NODENAME_POST_ROW_COUNT_MISMATCH');
  if (stableStringify(pointerSnapshot(after)) !== stableStringify(expectedPointers(before, plan))) errors.push('WRITER_2_POINTER_RELOCATION_POSTIMAGE_MISMATCH');
  if (stableStringify(after?.nodeNames || {}) !== stableStringify(expectedNodeNames(before, transferPlan))) errors.push('WRITER_2_NODENAME_SEMANTIC_POSTIMAGE_MISMATCH');
  if (stableStringify(connectivity(before)) !== stableStringify(connectivity(after))) errors.push('WRITER_2_CONNECTIVITY_CHANGED');
  if (stableStringify(sectionOrder(before)) !== stableStringify(sectionOrder(after))) errors.push('WRITER_2_SECTION_ORDER_CHANGED');
  if (writerResult?.relocationPlan && stableStringify({ oldToNewPointer: writerResult.relocationPlan.oldToNewPointer, rowCountAfter: writerResult.relocationPlan.rowCountAfter,
    pointerChanges: writerResult.relocationPlan.pointerChanges?.map((item) => [item.parsedElementIndex, item.oldPointer, item.newPointer]) })
    !== stableStringify({ oldToNewPointer: plan.oldToNewPointer, rowCountAfter: plan.rowCountAfter,
      pointerChanges: plan.pointerChanges?.map((item) => [item.parsedElementIndex, item.oldPointer, item.newPointer]) })) errors.push('WRITER_2_RELOCATION_TESTIMONY_MISMATCH');
  if (errors.length) throw new Error(`CII_WRITER_2_NODENAME_ROUNDTRIP_FAILED:${[...new Set(errors)].join('|')}`);
  return Object.freeze({
    schema: 'CIIWorkspaceWriter2NodeNameValidation.v1', status: 'PASS',
    checks: Object.freeze(['INDEPENDENT_RELOCATION_REBUILD', 'EXACT_FULL_BYTE_POSTIMAGE', 'CONTROL_NONAM_POSTCOUNT', 'NODENAME_ROW_COUNT',
      'ELEMENT_POINTER_RELOCATION', 'NODENAME_SEMANTIC_POSTIMAGE', 'CONNECTIVITY_STABLE', 'SECTION_ORDER_STABLE', 'WRITER_TESTIMONY_MATCH']),
    rowCountBefore: plan.rowCountBefore, rowCountAfter: plan.rowCountAfter, pointerChangeCount: plan.pointerChanges.length,
  });
}

export const _test = Object.freeze({ markerName, integerField, numericField, sectionEnvelope, applyExpected, expectedNodeNames });
