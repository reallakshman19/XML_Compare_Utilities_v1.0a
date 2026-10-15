import { ciiPhysicalFileBytes } from './cii-workspace-physical-file.js';
import { buildWriter1CNodeNamePlan } from './cii-workspace-writer1c-nodename.js';
import { buildWriter1CSifPlan } from './cii-workspace-writer1c-sif.js';

function asciiFromBytes(bytes, start, end) {
  let out = '';
  for (let index = start; index < end; index += 1) out += String.fromCharCode(bytes[index]);
  return out;
}

function writeAscii(bytes, start, value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code > 0x7f) throw new Error('CII_WRITER_1C_NON_ASCII');
    bytes[start + index] = code;
  }
}
function overlaps(left, right) { return left.byteStart < right.byteEnd && right.byteStart < left.byteEnd; }
function buildCompositePlan(transferPlan, targetDocument) {
  const nodeName = buildWriter1CNodeNamePlan({ transferPlan, targetDocument, allowEmpty: true });
  const sif = buildWriter1CSifPlan({ transferPlan, targetDocument, allowEmpty: true });
  const blockers = [...nodeName.blockers, ...sif.blockers];
  const mutations = [...nodeName.mutations, ...sif.mutations].sort((a, b) => a.byteStart - b.byteStart || a.byteEnd - b.byteEnd);
  for (let index = 1; index < mutations.length; index += 1) {
    if (overlaps(mutations[index - 1], mutations[index])) {
      blockers.push(`WRITER_1C_CROSS_FAMILY_SPAN_OVERLAP:${mutations[index - 1].spanKey}:${mutations[index].spanKey}`);
    }
  }
  if (!mutations.length) blockers.push('WRITER_1C_NO_MUTATIONS');
  return Object.freeze({
    schema: 'CIIWorkspaceWriter1CCompositePlan.v1', status: blockers.length ? 'BLOCKED' : 'READY', ready: blockers.length === 0,
    mutationCount: mutations.length, mutations: Object.freeze(mutations), blockers: Object.freeze([...new Set(blockers)]),
    familyCounts: Object.freeze({ nodeName: nodeName.mutationCount, sifTee: sif.mutationCount }),
  });
}

export function ciiWriter1CReadiness(transferPlan, targetDocument) {
  const plan = buildCompositePlan(transferPlan, targetDocument);
  return Object.freeze({
    schema: 'CIIWorkspaceWriter1CReadiness.v1',
    status: plan.ready ? 'READY' : 'BLOCKED', ready: plan.ready,
    mutationCount: plan.mutationCount, blockers: plan.blockers, familyCounts: plan.familyCounts,
  });
}

export function applyCiiTargetWriter1C({ targetDocument, transferPlan }) {
  const plan = buildCompositePlan(transferPlan, targetDocument);
  if (!plan.ready) throw new Error(`CII_WRITER_1C_BLOCKED:${plan.blockers.join('|')}`);
  const original = ciiPhysicalFileBytes(targetDocument.physicalFile); const bytes = new Uint8Array(original);
  const mutations = [];
  for (const mutation of plan.mutations) {
    const actual = asciiFromBytes(bytes, mutation.byteStart, mutation.byteEnd);
    if (actual !== mutation.beforeField) {
      throw new Error(`CII_WRITER_1C_PREIMAGE_MISMATCH:${(mutation.operationIds || []).join(',')}:${mutation.spanKey}`);
    }
    if (mutation.afterField.length !== mutation.width) throw new Error(`CII_WRITER_1C_LAYOUT_DRIFT:${mutation.spanKey}`);
    writeAscii(bytes, mutation.byteStart, mutation.afterField);
    mutations.push(Object.freeze({
      lineNumber: mutation.lineNumber,
      startColumn: mutation.startColumn + 1,
      endColumn: mutation.endColumn,
      absoluteByteStart: mutation.byteStart,
      absoluteByteEnd: mutation.byteEnd,
      beforeField: mutation.beforeField,
      afterField: mutation.afterField,
      operationIds: mutation.operationIds,
      section: mutation.section,
      recordIdentity: mutation.section === 'SIF&TEES'
        ? `SIF_TEE_POINTER:${mutation.pointer}:SLOT:${mutation.slot}`
        : `NODENAME_ROW:${mutation.owners?.[0]?.rowIndex ?? 'unknown'}`,
      fieldIdentity: mutation.fieldIdentity,
      targetNodeIds: mutation.targetNodeIds || Object.freeze([]),
      ownerBindings: mutation.ownerBindings || mutation.owners || Object.freeze([]),
      ...(mutation.section === 'SIF&TEES' ? {
        pointer: mutation.pointer, slot: mutation.slot, item: mutation.item, fieldKey: mutation.fieldKey,
        before: mutation.before, proposed: mutation.proposed, sifContext: mutation.sifContext,
      } : {}),
    }));
  }
  if (bytes.length !== original.length) throw new Error('CII_WRITER_1C_BYTE_LENGTH_CHANGED');
  const text = new TextDecoder('utf-8').decode(bytes);
  return Object.freeze({
    schema: 'CIIWorkspaceWriter1CResult.v1', writerVersion: '1C',
    bytes, text, byteLength: bytes.length,
    mutationCount: mutations.length, mutations: Object.freeze(mutations), familyCounts: plan.familyCounts,
  });
}

export const _test = Object.freeze({ buildCompositePlan });
