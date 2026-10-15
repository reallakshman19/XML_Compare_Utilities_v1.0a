import { CII_SIX_FIELD_WIDTHS, decodeFixedFields, parseFortranNumber } from '../../parser/fixed-field.js';

const ELEMENT_BLOCK_ROWS = 15;
const RESTRAINT_BLOCK_ROWS = 24;
const RESTRAINT_SLOT_ROWS = 4;
const MUTABLE_ELEMENT_FIELDS = Object.freeze({
  'WALL|Wall thickness': Object.freeze({ rowOffset: 1, fieldIndex: 0, field: 'WT' }),
  'PROCESS|T1': Object.freeze({ rowOffset: 1, fieldIndex: 3, field: 'T1' }),
  'PROCESS|T2': Object.freeze({ rowOffset: 1, fieldIndex: 4, field: 'T2' }),
  'PROCESS|P1': Object.freeze({ rowOffset: 3, fieldIndex: 0, field: 'P1' }),
});
const APPROVED_MATCH_STATES = new Set(['REVIEWED', 'LOCKED']);

function physicalLines(text) {
  const matches = String(text ?? '').match(/[^\r\n]*(?:\r\n|\n|\r|$)/g) || [];
  return matches.filter((raw) => raw !== '').map((raw) => {
    const ending = raw.endsWith('\r\n') ? '\r\n' : raw.endsWith('\n') ? '\n' : raw.endsWith('\r') ? '\r' : '';
    return { body: ending ? raw.slice(0, -ending.length) : raw, ending };
  });
}

function sectionRefs(lines, wanted) {
  const marker = new RegExp(`^\\s*#\\$\\s*${wanted}\\s*$`, 'i');
  const start = lines.findIndex((line) => marker.test(line.body));
  if (start < 0) throw new Error(`CII_WRITER_SECTION_NOT_FOUND:${wanted}`);
  const refs = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\s*#\$\s*/.test(lines[index].body)) break;
    if (lines[index].body.trim()) refs.push({ index, body: lines[index].body });
  }
  return refs;
}

function elementBlocks(lines) {
  const refs = sectionRefs(lines, 'ELEMENTS');
  if (refs.length % ELEMENT_BLOCK_ROWS !== 0) throw new Error('CII_WRITER_ELEMENT_BLOCK_CARDINALITY_INVALID');
  const blocks = [];
  for (let offset = 0; offset < refs.length; offset += ELEMENT_BLOCK_ROWS) {
    const fields = decodeFixedFields(refs[offset].body, CII_SIX_FIELD_WIDTHS);
    const from = parseFortranNumber(fields[0]); const to = parseFortranNumber(fields[1]);
    if (!Number.isFinite(from) || !Number.isFinite(to)) throw new Error('CII_WRITER_ELEMENT_HEADER_INVALID');
    blocks.push({ refs: refs.slice(offset, offset + ELEMENT_BLOCK_ROWS), from: String(Math.round(from)), to: String(Math.round(to)) });
  }
  return blocks;
}

function allCorrespondenceRows(correspondence) {
  return [...(correspondence?.nodeRows || []), ...(correspondence?.elementRows || []), ...(correspondence?.componentRows || [])];
}

function targetElementIds(row) {
  if (Array.isArray(row?.targetElementIds)) return row.targetElementIds.map(String);
  return row?.targetElementId ? [String(row.targetElementId)] : [];
}

function writerOperationKey(operation) {
  return `${operation?.family || ''}|${operation?.property || ''}`;
}

function isWriter1AMutation(operation) {
  if (MUTABLE_ELEMENT_FIELDS[writerOperationKey(operation)]) return true;
  if (operation?.family === 'WEIGHT_RIGID' && operation?.property === 'Rigid weight') return true;
  return operation?.family === 'RESTRAINT' && operation?.property === 'Qualified restraint record pairing';
}

function isNoMutation(operation) {
  return operation?.action === 'KEEP' && ['PREVIEW_READY', 'PROTECTED'].includes(operation?.status);
}

export function ciiWriter1AReadiness(plan) {
  const blockers = [...(plan?.blockers || [])]; let mutationCount = 0;
  if (plan?.status !== 'PREVIEW_READY') blockers.push('WRITER_1A_TRANSFER_PLAN_NOT_PREVIEW_READY');
  for (const operation of plan?.operations || []) {
    if (isNoMutation(operation)) continue;
    if (!APPROVED_MATCH_STATES.has(operation?.matchAuthority?.status)) blockers.push(`WRITER_1A_APPROVAL_REQUIRED:${operation?.operationId || 'unknown'}`);
    if (operation?.action !== 'COPY' || operation?.status !== 'PREVIEW_READY' || !isWriter1AMutation(operation)) {
      blockers.push(`WRITER_1A_UNSUPPORTED_OPERATION:${operation?.family || 'UNKNOWN'}:${operation?.property || 'UNKNOWN'}:${operation?.action || 'UNKNOWN'}:${operation?.status || 'UNKNOWN'}`);
      continue;
    }
    mutationCount += 1;
  }
  if (!mutationCount) blockers.push('WRITER_1A_NO_MUTATIONS');
  return Object.freeze({
    schema: 'CIIWorkspaceWriter1AReadiness.v1',
    status: blockers.length ? 'BLOCKED' : 'READY',
    ready: blockers.length === 0,
    mutationCount,
    blockers: Object.freeze([...new Set(blockers)]),
  });
}

function exponential(value) {
  const [mantissa, rawExponent] = Number(value).toExponential(6).toUpperCase().split('E');
  const exponent = Number(rawExponent);
  const sign = exponent < 0 ? '-' : '+';
  return `${mantissa}E${sign}${String(Math.abs(exponent)).padStart(2, '0')}`;
}

export function formatCiiWriterSig6(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error('CII_WRITER_NONFINITE_VALUE');
  const absolute = Math.abs(number);
  if (absolute < 1e-12) return '0.000000';
  if (absolute >= 1e9 || absolute < 1e-6) return exponential(number);
  if (absolute < 1.0) return number.toFixed(6);
  const integerDigits = String(Math.trunc(absolute)).length;
  return number.toFixed(Math.max(1, 6 - integerDigits));
}

function fieldSpan(fieldIndex, widths = CII_SIX_FIELD_WIDTHS) {
  const start = widths.slice(0, fieldIndex).reduce((sum, width) => sum + width, 0);
  return { start, end: start + widths[fieldIndex], width: widths[fieldIndex] };
}

function numericField(body, fieldIndex) {
  const fields = decodeFixedFields(body, CII_SIX_FIELD_WIDTHS);
  const value = parseFortranNumber(fields[fieldIndex]);
  if (!Number.isFinite(value)) throw new Error('CII_WRITER_TARGET_FIELD_INVALID');
  return value;
}

function sameNumber(left, right) {
  const a = Number(left); const b = Number(right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 1e-12);
}

function patchNumericField(lines, lineIndex, fieldIndex, before, proposed, context, claims) {
  const line = lines[lineIndex]; const span = fieldSpan(fieldIndex);
  if (!line || line.body.length < span.end) throw new Error(`CII_WRITER_FIXED_FIELD_ROW_TOO_SHORT:${context.operationId || context.field || 'unknown'}`);
  const actualBefore = numericField(line.body, fieldIndex);
  if (!sameNumber(actualBefore, before)) throw new Error(`CII_WRITER_TARGET_VALUE_MISMATCH:${context.operationId || context.field || 'unknown'}:${context.field || fieldIndex}`);
  const token = formatCiiWriterSig6(proposed);
  if (token.length > span.width) throw new Error(`CII_WRITER_FIELD_OVERFLOW:${context.operationId || context.field || 'unknown'}:${context.field || fieldIndex}`);
  const claim = `${lineIndex}:${span.start}:${span.end}`;
  if (claims.has(claim)) throw new Error(`CII_WRITER_DUPLICATE_FIELD_MUTATION:${context.operationId || context.field || 'unknown'}:${context.field || fieldIndex}`);
  claims.add(claim);
  const replacement = token.padStart(span.width, ' ');
  const beforeField = line.body.slice(span.start, span.end);
  line.body = `${line.body.slice(0, span.start)}${replacement}${line.body.slice(span.end)}`;
  return Object.freeze({ lineNumber: lineIndex + 1, startColumn: span.start + 1, endColumn: span.end, beforeField, afterField: replacement, before: actualBefore, proposed: Number(proposed), ...context });
}

function patchIfChanged(lines, lineIndex, fieldIndex, before, proposed, context, claims) {
  return sameNumber(before, proposed) ? null : patchNumericField(lines, lineIndex, fieldIndex, before, proposed, context, claims);
}

function operationRow(operation, rowMap) {
  const row = rowMap.get(operation?.matchAuthority?.correspondenceId);
  if (!row) throw new Error(`CII_WRITER_CORRESPONDENCE_NOT_FOUND:${operation?.operationId || 'unknown'}`);
  return row;
}

function targetEdge(operation, row, edgeMap) {
  const ids = targetElementIds(row);
  if (ids.length !== 1) throw new Error(`CII_WRITER_TARGET_ELEMENT_CARDINALITY:${operation?.operationId || 'unknown'}`);
  const edge = edgeMap.get(ids[0]);
  if (!edge) throw new Error(`CII_WRITER_TARGET_ELEMENT_NOT_FOUND:${ids[0]}`);
  return edge;
}

function patchElementOperation(lines, blocks, edge, operation, claims) {
  const spec = MUTABLE_ELEMENT_FIELDS[writerOperationKey(operation)];
  const block = blocks[Number(edge.parsedElementIndex)];
  if (!block) throw new Error(`CII_WRITER_ELEMENT_BLOCK_NOT_FOUND:${edge.elementId}`);
  if (block.from !== String(edge.from) || block.to !== String(edge.to)) throw new Error(`CII_WRITER_ELEMENT_BLOCK_IDENTITY_MISMATCH:${edge.elementId}`);
  const lineRef = block.refs[spec.rowOffset];
  return [patchNumericField(lines, lineRef.index, spec.fieldIndex, operation.before, operation.proposed,
    { operationId: operation.operationId, section: 'ELEMENTS', elementId: edge.elementId, field: spec.field }, claims)];
}

function patchRigidOperation(lines, edge, operation, claims) {
  const pointer = Number(edge?.rigidEvidence?.pointer);
  if (!Number.isSafeInteger(pointer) || pointer < 1) throw new Error(`CII_WRITER_RIGID_POINTER_REQUIRED:${edge?.elementId || 'unknown'}`);
  const rows = sectionRefs(lines, 'RIGID');
  if (pointer > rows.length) throw new Error(`CII_WRITER_RIGID_POINTER_OUT_OF_RANGE:${pointer}`);
  return [patchNumericField(lines, rows[pointer - 1].index, 0, operation.before, operation.proposed,
    { operationId: operation.operationId, section: 'RIGID', elementId: edge.elementId, pointer, field: 'Rigid weight' }, claims)];
}

function restraintSlotRefs(lines, pointer, slot) {
  const rows = sectionRefs(lines, 'RESTRANT');
  const p = Number(pointer); const s = Number(slot);
  if (!Number.isSafeInteger(p) || p < 1) throw new Error(`CII_WRITER_RESTRAINT_POINTER_INVALID:${pointer}`);
  if (!Number.isSafeInteger(s) || s < 1 || s > 6) throw new Error(`CII_WRITER_RESTRAINT_SLOT_INVALID:${slot}`);
  const base = (p - 1) * RESTRAINT_BLOCK_ROWS + (s - 1) * RESTRAINT_SLOT_ROWS;
  if (base + 1 >= rows.length) throw new Error(`CII_WRITER_RESTRAINT_SLOT_OUT_OF_RANGE:${p}:${s}`);
  return { line1: rows[base], line2: rows[base + 1] };
}

function patchRestraintOperation(lines, operation, claims) {
  const pairing = operation.proposed;
  if (pairing?.status !== 'QUALIFIED' || !Array.isArray(pairing?.pairs) || !pairing.pairs.length) {
    throw new Error(`CII_WRITER_RESTRAINT_PAIRING_REQUIRED:${operation.operationId}`);
  }
  const mutations = [];
  for (const pair of pairing.pairs) {
    const before = pair.before || {}; const proposed = pair.proposed || {};
    const pointer = Number(proposed.pointer); const slot = Number(proposed.slot);
    if (pointer !== Number(before.pointer) || slot !== Number(before.slot)) {
      throw new Error(`CII_WRITER_RESTRAINT_TARGET_CUSTODY_MISMATCH:${operation.operationId}:${pointer}:${slot}`);
    }
    const refs = restraintSlotRefs(lines, pointer, slot);
    const actualNode = numericField(lines[refs.line1.index].body, 0);
    if (!sameNumber(actualNode, before.node) || !sameNumber(actualNode, proposed.node)) {
      throw new Error(`CII_WRITER_RESTRAINT_NODE_IDENTITY_MISMATCH:${operation.operationId}:${pointer}:${slot}`);
    }
    const fields = [
      [refs.line1.index, 1, before.typeCode, proposed.typeCode, 'Restraint typeCode'],
      [refs.line1.index, 2, before.stiffness, proposed.stiffness, 'Restraint stiffness'],
      [refs.line1.index, 3, before.gap, proposed.gap, 'Restraint gap'],
      [refs.line1.index, 4, before.friction, proposed.friction, 'Restraint friction'],
      [refs.line1.index, 5, before.connectingNode, proposed.connectingNode, 'Restraint connectingNode'],
      [refs.line2.index, 0, before.directionCosines?.x, proposed.directionCosines?.x, 'Restraint direction X'],
      [refs.line2.index, 1, before.directionCosines?.y, proposed.directionCosines?.y, 'Restraint direction Y'],
      [refs.line2.index, 2, before.directionCosines?.z, proposed.directionCosines?.z, 'Restraint direction Z'],
    ];
    for (const [lineIndex, fieldIndex, oldValue, newValue, field] of fields) {
      const mutation = patchIfChanged(lines, lineIndex, fieldIndex, oldValue, newValue, {
        operationId: operation.operationId,
        section: 'RESTRANT',
        pointer,
        slot,
        node: String(proposed.node),
        field,
      }, claims);
      if (mutation) mutations.push(mutation);
    }
  }
  if (!mutations.length) throw new Error(`CII_WRITER_RESTRAINT_OPERATION_HAS_NO_FIELD_CHANGES:${operation.operationId}`);
  return mutations;
}

export function applyCiiTargetWriter1A({ targetText, targetGraph, correspondence, transferPlan }) {
  const readiness = ciiWriter1AReadiness(transferPlan);
  if (!readiness.ready) throw new Error(`CII_WRITER_1A_BLOCKED:${readiness.blockers.join('|')}`);
  const original = String(targetText ?? ''); const lines = physicalLines(original); const blocks = elementBlocks(lines);
  const rowMap = new Map(allCorrespondenceRows(correspondence).map((row) => [row.correspondenceId, row]));
  const edgeMap = new Map((targetGraph?.edges || []).map((edge) => [String(edge.elementId), edge]));
  const claims = new Set(); const mutations = [];
  for (const operation of transferPlan.operations || []) {
    if (isNoMutation(operation)) continue;
    const row = operationRow(operation, rowMap);
    let operationMutations;
    if (operation.family === 'RESTRAINT') {
      operationMutations = patchRestraintOperation(lines, operation, claims);
    } else {
      const edge = targetEdge(operation, row, edgeMap);
      operationMutations = operation.family === 'WEIGHT_RIGID'
        ? patchRigidOperation(lines, edge, operation, claims)
        : patchElementOperation(lines, blocks, edge, operation, claims);
    }
    mutations.push(...operationMutations);
  }
  const text = lines.map((line) => `${line.body}${line.ending}`).join('');
  if (text.length !== original.length) throw new Error('CII_WRITER_CARDINALITY_OR_WIDTH_CHANGED');
  return Object.freeze({
    schema: 'CIIWorkspaceWriter1AResult.v1', status: 'APPLIED', text,
    mutationCount: mutations.length, mutations: Object.freeze(mutations), readiness,
    negativeAssurance: Object.freeze({ textLengthUnchanged: true, sectionCardinalityChanged: false, pointerOwnershipChanged: false }),
  });
}
