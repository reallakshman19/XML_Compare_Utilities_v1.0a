import { ciiPhysicalFileBytes } from './cii-workspace-physical-file.js';
import { applyCiiTargetWriter1B, ciiWriter1BReadiness } from './cii-workspace-target-writer-1b.js';
import { applyCiiTargetWriter1C, ciiWriter1CReadiness } from './cii-workspace-target-writer-1c.js';

const NODE_POLICY = 'CII_WRITER_1C_NODENAME_EXISTING_ROW_FIELD';
const SIF_POLICIES = new Set([
  'CII_WRITER_1C_SIF_IN_PLANE_EXISTING_BLOCK',
  'CII_WRITER_1C_SIF_OUT_PLANE_EXISTING_BLOCK',
]);

function operationId(operation) { return String(operation?.operationId || 'unknown'); }
function noMutation(operation) {
  return operation?.action === 'KEEP' && ['PREVIEW_READY', 'PROTECTED'].includes(operation?.status);
}
function writer1CMutation(operation) {
  if (operation?.family === 'NODE_NAME' && operation?.property === 'Node name / to-name'
    && operation?.action === 'COPY' && operation?.policyAuthority === NODE_POLICY) return true;
  return operation?.family === 'SIF_TEE' && operation?.action === 'COPY' && SIF_POLICIES.has(operation?.policyAuthority);
}
function lowerWriterAuthority(operation) {
  const authority = String(operation?.policyAuthority || '');
  if (authority.startsWith('CII_WRITER_1A_')) return 'WRITER_1A';
  if (authority.startsWith('CII_WRITER_1B_')) return 'WRITER_1B';
  return null;
}
function subsetPlan(plan, operations) {
  return Object.freeze({ ...plan, operations: Object.freeze(operations) });
}
function splitPlan(plan) {
  const keep = []; const lower = []; const writer1C = [];
  for (const operation of plan?.operations || []) {
    if (noMutation(operation)) keep.push(operation);
    else if (writer1CMutation(operation)) writer1C.push(operation);
    else lower.push(operation);
  }
  return Object.freeze({
    lowerOperations: Object.freeze(lower), writer1COperations: Object.freeze(writer1C),
    lowerPlan: subsetPlan(plan, [...keep, ...lower]),
    writer1CPlan: subsetPlan(plan, [...keep, ...writer1C]),
  });
}
function asciiFromBytes(bytes, start, end) {
  let out = '';
  for (let index = start; index < end; index += 1) out += String.fromCharCode(bytes[index]);
  return out;
}
function writeAscii(bytes, start, value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code > 0x7f) throw new Error('CII_WRITER_COMPOSITE_NON_ASCII');
    bytes[start + index] = code;
  }
}
function exactOriginalField(original, byteStart, byteEnd, expected, code) {
  if (!Number.isSafeInteger(byteStart) || !Number.isSafeInteger(byteEnd) || byteStart < 0 || byteEnd <= byteStart || byteEnd > original.length) {
    throw new Error(`${code}:SPAN_INVALID:${byteStart}:${byteEnd}`);
  }
  const actual = asciiFromBytes(original, byteStart, byteEnd);
  if (actual !== expected) throw new Error(`${code}:ORIGINAL_PREIMAGE_MISMATCH:${byteStart}:${byteEnd}`);
  return actual;
}
function normalizeLowerMutation(mutation, targetDocument, original, operation) {
  const sourceWriter = lowerWriterAuthority(operation);
  if (!sourceWriter) throw new Error(`CII_WRITER_COMPOSITE_LOWER_POLICY_AUTHORITY_REQUIRED:${mutation?.operationId || 'unknown'}`);
  const lineIndex = Number(mutation?.lineNumber) - 1;
  const line = targetDocument?.physicalFile?.lines?.[lineIndex];
  const startColumn = Number(mutation?.startColumn) - 1; const endColumn = Number(mutation?.endColumn);
  if (!line || !Number.isSafeInteger(startColumn) || !Number.isSafeInteger(endColumn) || startColumn < 0 || endColumn <= startColumn) {
    throw new Error(`CII_WRITER_COMPOSITE_LOWER_LINE_CUSTODY_INVALID:${mutation?.operationId || 'unknown'}`);
  }
  const byteStart = Number(line.byteStart) + startColumn; const byteEnd = Number(line.byteStart) + endColumn;
  const width = byteEnd - byteStart;
  if (width !== String(mutation.beforeField ?? '').length || width !== String(mutation.afterField ?? '').length) {
    throw new Error(`CII_WRITER_COMPOSITE_LOWER_WIDTH_MISMATCH:${mutation?.operationId || 'unknown'}`);
  }
  exactOriginalField(original, byteStart, byteEnd, mutation.beforeField, 'CII_WRITER_COMPOSITE_LOWER');
  return Object.freeze({
    spanKey: `${byteStart}:${byteEnd}`, absoluteByteStart: byteStart, absoluteByteEnd: byteEnd, width,
    beforeField: mutation.beforeField, afterField: mutation.afterField,
    operationIds: Object.freeze([String(mutation.operationId || 'unknown')]), sourceWriters: Object.freeze([sourceWriter]),
    section: mutation.section, fieldIdentity: mutation.field || null, policyAuthority: operation.policyAuthority,
    lowerMutation: mutation,
  });
}
function normalizeWriter1CMutation(mutation, original) {
  const byteStart = Number(mutation?.absoluteByteStart); const byteEnd = Number(mutation?.absoluteByteEnd); const width = byteEnd - byteStart;
  if (width !== String(mutation.beforeField ?? '').length || width !== String(mutation.afterField ?? '').length) {
    throw new Error(`CII_WRITER_COMPOSITE_1C_WIDTH_MISMATCH:${(mutation?.operationIds || []).join(',')}`);
  }
  exactOriginalField(original, byteStart, byteEnd, mutation.beforeField, 'CII_WRITER_COMPOSITE_1C');
  return Object.freeze({
    spanKey: `${byteStart}:${byteEnd}`, absoluteByteStart: byteStart, absoluteByteEnd: byteEnd, width,
    beforeField: mutation.beforeField, afterField: mutation.afterField,
    operationIds: Object.freeze([...(mutation.operationIds || [])].map(String)), sourceWriters: Object.freeze(['WRITER_1C']),
    section: mutation.section, fieldIdentity: mutation.fieldIdentity || null, writer1CMutation: mutation,
  });
}
function canonicalizeClaims(claims) {
  const grouped = new Map();
  for (const claim of claims) {
    if (!grouped.has(claim.spanKey)) grouped.set(claim.spanKey, []);
    grouped.get(claim.spanKey).push(claim);
  }
  const out = [];
  for (const [spanKey, group] of grouped) {
    const sourceWriters = new Set(group.flatMap((item) => item.sourceWriters));
    if (sourceWriters.size > 1) throw new Error(`CII_WRITER_COMPOSITE_CROSS_FAMILY_SAME_SPAN:${spanKey}`);
    const before = new Set(group.map((item) => item.beforeField)); const after = new Set(group.map((item) => item.afterField));
    if (before.size !== 1 || after.size !== 1) throw new Error(`CII_WRITER_COMPOSITE_SAME_SPAN_CONFLICT:${spanKey}`);
    const first = group[0];
    out.push(Object.freeze({
      spanKey, absoluteByteStart: first.absoluteByteStart, absoluteByteEnd: first.absoluteByteEnd, width: first.width,
      beforeField: first.beforeField, afterField: first.afterField,
      operationIds: Object.freeze([...new Set(group.flatMap((item) => item.operationIds))].sort()),
      sourceWriters: Object.freeze([...sourceWriters].sort()), claims: Object.freeze(group),
    }));
  }
  out.sort((a, b) => a.absoluteByteStart - b.absoluteByteStart || a.absoluteByteEnd - b.absoluteByteEnd);
  for (let index = 1; index < out.length; index += 1) {
    const left = out[index - 1]; const right = out[index];
    if (left.absoluteByteStart < right.absoluteByteEnd && right.absoluteByteStart < left.absoluteByteEnd) {
      throw new Error(`CII_WRITER_COMPOSITE_CROSS_FAMILY_SPAN_OVERLAP:${left.spanKey}:${right.spanKey}`);
    }
  }
  return Object.freeze(out);
}
function writerOperationCounts(split) {
  const counts = { writer1A: 0, writer1B: 0, writer1C: split.writer1COperations.length };
  for (const operation of split.lowerOperations) {
    const writer = lowerWriterAuthority(operation);
    if (writer === 'WRITER_1A') counts.writer1A += 1;
    if (writer === 'WRITER_1B') counts.writer1B += 1;
  }
  return Object.freeze(counts);
}
function physicalFamilyCounts(mutations) {
  const counts = { writer1A: 0, writer1B: 0, writer1C: 0 };
  for (const mutation of mutations) {
    const writer = mutation.sourceWriters?.[0];
    if (writer === 'WRITER_1A') counts.writer1A += 1;
    if (writer === 'WRITER_1B') counts.writer1B += 1;
    if (writer === 'WRITER_1C') counts.writer1C += 1;
  }
  return Object.freeze(counts);
}

export function ciiWriterCompositeReadiness(transferPlan, targetDocument) {
  const blockers = [...(transferPlan?.blockers || [])];
  if (transferPlan?.status !== 'PREVIEW_READY') blockers.push('WRITER_COMPOSITE_TRANSFER_PLAN_NOT_PREVIEW_READY');
  if (transferPlan?.transferScope?.status !== 'BOUND') blockers.push('WRITER_COMPOSITE_BOUND_TRANSFER_SCOPE_REQUIRED');
  if (targetDocument?.writer1CByteEligible !== true) blockers.push('WRITER_COMPOSITE_ORIGINAL_BYTE_CUSTODY_REQUIRED');
  const split = splitPlan(transferPlan);
  for (const operation of split.lowerOperations) {
    if (!lowerWriterAuthority(operation)) blockers.push(`WRITER_COMPOSITE_LOWER_POLICY_AUTHORITY_REQUIRED:${operationId(operation)}`);
  }
  let lower = null; let writer1C = null;
  if (split.lowerOperations.length) {
    lower = ciiWriter1BReadiness(split.lowerPlan);
    blockers.push(...lower.blockers);
  }
  if (split.writer1COperations.length) {
    writer1C = ciiWriter1CReadiness(split.writer1CPlan, targetDocument);
    blockers.push(...writer1C.blockers);
  }
  const mutationCount = split.lowerOperations.length + split.writer1COperations.length;
  if (!mutationCount) blockers.push('WRITER_COMPOSITE_NO_MUTATIONS');
  return Object.freeze({
    schema: 'CIIWorkspaceWriterCompositeReadiness.v1', status: blockers.length ? 'BLOCKED' : 'READY', ready: blockers.length === 0,
    mutationCount, mutationOperationCount: mutationCount, familyOperationCounts: writerOperationCounts(split),
    blockers: Object.freeze([...new Set(blockers)]), lowerReadiness: lower, writer1CReadiness: writer1C,
  });
}

export function applyCiiTargetWriterComposite({ targetDocument, targetGraph, correspondence, transferPlan }) {
  const readiness = ciiWriterCompositeReadiness(transferPlan, targetDocument);
  if (!readiness.ready) throw new Error(`CII_WRITER_COMPOSITE_BLOCKED:${readiness.blockers.join('|')}`);
  const split = splitPlan(transferPlan); const original = ciiPhysicalFileBytes(targetDocument.physicalFile); const claims = [];
  let lowerResult = null; let writer1CResult = null;
  if (split.lowerOperations.length) {
    lowerResult = applyCiiTargetWriter1B({
      targetText: targetDocument.physicalFile.text, targetGraph, correspondence, transferPlan: split.lowerPlan,
    });
    const operationMap = new Map(split.lowerOperations.map((operation) => [operationId(operation), operation]));
    for (const mutation of lowerResult.mutations || []) {
      claims.push(normalizeLowerMutation(mutation, targetDocument, original, operationMap.get(String(mutation.operationId))));
    }
  }
  if (split.writer1COperations.length) {
    writer1CResult = applyCiiTargetWriter1C({ targetDocument, transferPlan: split.writer1CPlan });
    for (const mutation of writer1CResult.mutations || []) claims.push(normalizeWriter1CMutation(mutation, original));
  }
  const mutations = canonicalizeClaims(claims);
  if (!mutations.length) throw new Error('CII_WRITER_COMPOSITE_NO_PHYSICAL_MUTATIONS');
  const bytes = new Uint8Array(original);
  for (const mutation of mutations) {
    exactOriginalField(original, mutation.absoluteByteStart, mutation.absoluteByteEnd, mutation.beforeField, 'CII_WRITER_COMPOSITE_FINAL');
    writeAscii(bytes, mutation.absoluteByteStart, mutation.afterField);
  }
  if (bytes.length !== original.length) throw new Error('CII_WRITER_COMPOSITE_BYTE_LENGTH_CHANGED');
  return Object.freeze({
    schema: 'CIIWorkspaceWriterCompositeResult.v1', writerVersion: '1C', status: 'APPLIED',
    bytes, text: new TextDecoder('utf-8').decode(bytes), byteLength: bytes.length,
    mutationCount: mutations.length, mutations, familyCounts: physicalFamilyCounts(mutations),
    components: Object.freeze({
      lower: lowerResult ? Object.freeze({ transferPlan: split.lowerPlan, result: lowerResult }) : null,
      writer1C: writer1CResult ? Object.freeze({ transferPlan: split.writer1CPlan, result: writer1CResult }) : null,
    }), readiness,
  });
}

export const _test = Object.freeze({ splitPlan, canonicalizeClaims, normalizeLowerMutation, normalizeWriter1CMutation, lowerWriterAuthority });
