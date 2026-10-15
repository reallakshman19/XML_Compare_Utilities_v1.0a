import { CII_SIX_FIELD_WIDTHS, decodeFixedFields, parseFortranNumber } from '../../parser/fixed-field.js';
import { applyCiiTargetWriter1A, formatCiiWriterSig6 } from './cii-workspace-target-writer.js';

const ELEMENT_BLOCK_ROWS = 15;
const RESTRAINT_BLOCK_ROWS = 24;
const RESTRAINT_SLOT_ROWS = 4;
const APPROVED = new Set(['REVIEWED', 'LOCKED']);

const ELEMENT_1B_FIELDS = Object.freeze({
  'PIPE_SIZE|OD': Object.freeze({ rowOffset: 0, fieldIndex: 5, field: 'OD' }),
  'PROCESS|Insulation thickness': Object.freeze({ rowOffset: 1, fieldIndex: 1, field: 'Insulation thickness' }),
  'PROCESS|Corrosion allowance': Object.freeze({ rowOffset: 1, fieldIndex: 2, field: 'Corrosion allowance' }),
  'PROCESS|T3': Object.freeze({ rowOffset: 1, fieldIndex: 5, field: 'T3' }),
  'PROCESS|T4': Object.freeze({ rowOffset: 2, fieldIndex: 0, field: 'T4' }),
  'PROCESS|T5': Object.freeze({ rowOffset: 2, fieldIndex: 1, field: 'T5' }),
  'PROCESS|T6': Object.freeze({ rowOffset: 2, fieldIndex: 2, field: 'T6' }),
  'PROCESS|T7': Object.freeze({ rowOffset: 2, fieldIndex: 3, field: 'T7' }),
  'PROCESS|T8': Object.freeze({ rowOffset: 2, fieldIndex: 4, field: 'T8' }),
  'PROCESS|T9': Object.freeze({ rowOffset: 2, fieldIndex: 5, field: 'T9' }),
  'PROCESS|P2': Object.freeze({ rowOffset: 3, fieldIndex: 1, field: 'P2' }),
  'PROCESS|P3': Object.freeze({ rowOffset: 3, fieldIndex: 2, field: 'P3' }),
  'PROCESS|P4': Object.freeze({ rowOffset: 3, fieldIndex: 3, field: 'P4' }),
  'PROCESS|P5': Object.freeze({ rowOffset: 3, fieldIndex: 4, field: 'P5' }),
  'PROCESS|P6': Object.freeze({ rowOffset: 3, fieldIndex: 5, field: 'P6' }),
  'PROCESS|P7': Object.freeze({ rowOffset: 4, fieldIndex: 0, field: 'P7' }),
  'PROCESS|P8': Object.freeze({ rowOffset: 4, fieldIndex: 1, field: 'P8' }),
  'PROCESS|P9': Object.freeze({ rowOffset: 4, fieldIndex: 2, field: 'P9' }),
  'PROCESS|Insulation density': Object.freeze({ rowOffset: 5, fieldIndex: 0, field: 'Insulation density' }),
  'PROCESS|Fluid density': Object.freeze({ rowOffset: 5, fieldIndex: 1, field: 'Fluid density' }),
  'PROCESS|Hydro pressure': Object.freeze({ rowOffset: 5, fieldIndex: 5, field: 'Hydro pressure' }),
});
const BASE_ELEMENT_KEYS = new Set(['WALL|Wall thickness', 'PROCESS|P1', 'PROCESS|T1', 'PROCESS|T2']);

function key(operation) { return `${operation?.family || ''}|${operation?.property || ''}`; }
function noMutation(operation) { return operation?.action === 'KEEP' && ['PREVIEW_READY', 'PROTECTED'].includes(operation?.status); }
function baseMutation(operation) {
  if (BASE_ELEMENT_KEYS.has(key(operation))) return true;
  if (operation?.family === 'WEIGHT_RIGID' && operation?.property === 'Rigid weight') return true;
  return operation?.family === 'RESTRAINT' && operation?.property === 'Qualified restraint record pairing';
}
function extendedMutation(operation) { return Boolean(ELEMENT_1B_FIELDS[key(operation)]); }
function slotMutation(operation) { return operation?.family === 'RESTRAINT' && operation?.property === 'Qualified restraint slot mutation'; }

export function ciiWriter1BReadiness(plan) {
  const blockers = [...(plan?.blockers || [])]; let mutationCount = 0;
  if (plan?.status !== 'PREVIEW_READY') blockers.push('WRITER_1B_TRANSFER_PLAN_NOT_PREVIEW_READY');
  for (const operation of plan?.operations || []) {
    if (noMutation(operation)) continue;
    if (!APPROVED.has(operation?.matchAuthority?.status)) blockers.push(`WRITER_1B_APPROVAL_REQUIRED:${operation?.operationId || 'unknown'}`);
    const supportedAction = (baseMutation(operation) || extendedMutation(operation))
      ? operation.action === 'COPY'
      : slotMutation(operation) && ['CREATE', 'DELETE'].includes(operation.action);
    if (operation?.status !== 'PREVIEW_READY' || !supportedAction) {
      blockers.push(`WRITER_1B_UNSUPPORTED_OPERATION:${operation?.family || 'UNKNOWN'}:${operation?.property || 'UNKNOWN'}:${operation?.action || 'UNKNOWN'}:${operation?.status || 'UNKNOWN'}`);
      continue;
    }
    mutationCount += 1;
  }
  if (!mutationCount) blockers.push('WRITER_1B_NO_MUTATIONS');
  return Object.freeze({ schema: 'CIIWorkspaceWriter1BReadiness.v1', status: blockers.length ? 'BLOCKED' : 'READY', ready: blockers.length === 0,
    mutationCount, blockers: Object.freeze([...new Set(blockers)]) });
}

function physicalLines(text) {
  const matches = String(text ?? '').match(/[^\r\n]*(?:\r\n|\n|\r|$)/g) || [];
  return matches.filter((raw) => raw !== '').map((raw) => {
    const ending = raw.endsWith('\r\n') ? '\r\n' : raw.endsWith('\n') ? '\n' : raw.endsWith('\r') ? '\r' : '';
    return { body: ending ? raw.slice(0, -ending.length) : raw, ending };
  });
}
function sectionRefs(lines, wanted) {
  const marker = new RegExp(`^\\s*#\\$\\s*${wanted}\\s*$`, 'i'); const start = lines.findIndex((line) => marker.test(line.body));
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
function span(fieldIndex) {
  const start = CII_SIX_FIELD_WIDTHS.slice(0, fieldIndex).reduce((sum, width) => sum + width, 0);
  return { start, end: start + CII_SIX_FIELD_WIDTHS[fieldIndex], width: CII_SIX_FIELD_WIDTHS[fieldIndex] };
}
function numeric(body, fieldIndex) {
  const value = parseFortranNumber(decodeFixedFields(body, CII_SIX_FIELD_WIDTHS)[fieldIndex]);
  if (!Number.isFinite(value)) throw new Error('CII_WRITER_TARGET_FIELD_INVALID');
  return value;
}
function sameNumber(a, b) {
  const left = Number(a); const right = Number(b);
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= Math.max(1e-9, Math.abs(right) * 1e-12);
}
function patch(lines, lineIndex, fieldIndex, before, proposed, context, claims) {
  if (sameNumber(before, proposed)) return null;
  const line = lines[lineIndex]; const fieldSpan = span(fieldIndex);
  if (!line || line.body.length < fieldSpan.end) throw new Error(`CII_WRITER_FIXED_FIELD_ROW_TOO_SHORT:${context.operationId}`);
  const actual = numeric(line.body, fieldIndex);
  if (!sameNumber(actual, before)) throw new Error(`CII_WRITER_TARGET_VALUE_MISMATCH:${context.operationId}:${context.field}`);
  const token = formatCiiWriterSig6(proposed);
  if (token.length > fieldSpan.width) throw new Error(`CII_WRITER_FIELD_OVERFLOW:${context.operationId}:${context.field}`);
  const claim = `${lineIndex}:${fieldSpan.start}:${fieldSpan.end}`;
  if (claims.has(claim)) throw new Error(`CII_WRITER_DUPLICATE_FIELD_MUTATION:${context.operationId}:${context.field}`);
  claims.add(claim);
  const replacement = token.padStart(fieldSpan.width, ' '); const beforeField = line.body.slice(fieldSpan.start, fieldSpan.end);
  line.body = `${line.body.slice(0, fieldSpan.start)}${replacement}${line.body.slice(fieldSpan.end)}`;
  return Object.freeze({ lineNumber: lineIndex + 1, startColumn: fieldSpan.start + 1, endColumn: fieldSpan.end,
    beforeField, afterField: replacement, before: actual, proposed: Number(proposed), ...context });
}
function rowMap(correspondence) {
  return new Map([...(correspondence?.nodeRows || []), ...(correspondence?.elementRows || []), ...(correspondence?.componentRows || [])]
    .map((row) => [row.correspondenceId, row]));
}
function targetEdge(operation, correspondenceRows, edges) {
  const row = correspondenceRows.get(operation.matchAuthority?.correspondenceId);
  if (!row) throw new Error(`CII_WRITER_CORRESPONDENCE_NOT_FOUND:${operation.operationId}`);
  const ids = Array.isArray(row.targetElementIds) ? row.targetElementIds : row.targetElementId ? [row.targetElementId] : [];
  if (ids.length !== 1) throw new Error(`CII_WRITER_TARGET_ELEMENT_CARDINALITY:${operation.operationId}`);
  const edge = edges.get(String(ids[0]));
  if (!edge) throw new Error(`CII_WRITER_TARGET_ELEMENT_NOT_FOUND:${ids[0]}`);
  return edge;
}
function patchExtendedElement(lines, blocks, edge, operation, claims) {
  const spec = ELEMENT_1B_FIELDS[key(operation)]; const block = blocks[Number(edge.parsedElementIndex)];
  if (!block || block.from !== String(edge.from) || block.to !== String(edge.to)) throw new Error(`CII_WRITER_ELEMENT_BLOCK_IDENTITY_MISMATCH:${edge.elementId}`);
  const ref = block.refs[spec.rowOffset];
  return patch(lines, ref.index, spec.fieldIndex, operation.before, operation.proposed,
    { operationId: operation.operationId, section: 'ELEMENTS', elementId: edge.elementId, field: spec.field }, claims);
}
function restraintRefs(lines, pointer, slot) {
  const rows = sectionRefs(lines, 'RESTRANT'); const base = (Number(pointer) - 1) * RESTRAINT_BLOCK_ROWS + (Number(slot) - 1) * RESTRAINT_SLOT_ROWS;
  if (base < 0 || base + 1 >= rows.length) throw new Error(`CII_WRITER_RESTRAINT_SLOT_OUT_OF_RANGE:${pointer}:${slot}`);
  return { line1: rows[base], line2: rows[base + 1] };
}
function syntheticExistingPairOperation(operation) {
  const pairs = operation?.proposed?.existingPairs || [];
  if (!pairs.some((pair) => pair.changed)) return null;
  return Object.freeze({ ...operation, action: 'COPY', property: 'Qualified restraint record pairing', proposed: Object.freeze({
    status: 'QUALIFIED', authority: 'WRITER_1B_SUBSET_PAIRING', pairs: Object.freeze(pairs), blockers: Object.freeze([]),
  }) });
}
function basePlan(plan) {
  const operations = [];
  for (const operation of plan?.operations || []) {
    if (noMutation(operation) || baseMutation(operation)) operations.push(operation);
    if (slotMutation(operation)) {
      const synthetic = syntheticExistingPairOperation(operation); if (synthetic) operations.push(synthetic);
    }
  }
  return Object.freeze({ ...plan, operations: Object.freeze(operations), status: 'PREVIEW_READY', blockers: Object.freeze([]) });
}
function slotValues(plan) {
  if (plan.mode === 'CREATE') {
    const p = plan.proposedSlot;
    return { before1: plan.beforeSlot.line1, before2: plan.beforeSlot.line2,
      proposed1: [p.node, p.typeCode, p.stiffness, p.gap, p.friction, p.connectingNode],
      proposed2: [p.directionCosines.x, p.directionCosines.y, p.directionCosines.z] };
  }
  return { before1: plan.beforeSlot.line1, before2: plan.beforeSlot.line2, proposed1: plan.proposedSlot.line1, proposed2: plan.proposedSlot.line2 };
}
function patchSlot(lines, operation, claims) {
  const plan = operation.proposed;
  if (plan?.status !== 'QUALIFIED' || !['CREATE', 'CLEAR'].includes(plan.mode)) throw new Error(`CII_WRITER_1B_RESTRAINT_SLOT_PLAN_REQUIRED:${operation.operationId}`);
  const refs = restraintRefs(lines, plan.pointer, plan.slot); const values = slotValues(plan); const out = [];
  const fields1 = ['Restraint node', 'Restraint typeCode', 'Restraint stiffness', 'Restraint gap', 'Restraint friction', 'Restraint connectingNode'];
  const fields2 = ['Restraint direction X', 'Restraint direction Y', 'Restraint direction Z'];
  for (let index = 0; index < 6; index += 1) {
    const mutation = patch(lines, refs.line1.index, index, values.before1[index], values.proposed1[index],
      { operationId: operation.operationId, section: 'RESTRANT', pointer: plan.pointer, slot: plan.slot, field: fields1[index], slotMode: plan.mode }, claims);
    if (mutation) out.push(mutation);
  }
  for (let index = 0; index < 3; index += 1) {
    const mutation = patch(lines, refs.line2.index, index, values.before2[index], values.proposed2[index],
      { operationId: operation.operationId, section: 'RESTRANT', pointer: plan.pointer, slot: plan.slot, field: fields2[index], slotMode: plan.mode }, claims);
    if (mutation) out.push(mutation);
  }
  if (!out.length) throw new Error(`CII_WRITER_1B_RESTRAINT_SLOT_NO_FIELD_CHANGES:${operation.operationId}`);
  return out;
}

export function applyCiiTargetWriter1B({ targetText, targetGraph, correspondence, transferPlan }) {
  const readiness = ciiWriter1BReadiness(transferPlan);
  if (!readiness.ready) throw new Error(`CII_WRITER_1B_BLOCKED:${readiness.blockers.join('|')}`);
  const original = String(targetText ?? ''); let working = original; const mutations = [];
  const base = (transferPlan.operations || []).filter((operation) => baseMutation(operation)).length
    + (transferPlan.operations || []).filter((operation) => slotMutation(operation) && syntheticExistingPairOperation(operation)).length;
  if (base > 0) {
    const result = applyCiiTargetWriter1A({ targetText: working, targetGraph, correspondence, transferPlan: basePlan(transferPlan) });
    working = result.text; mutations.push(...result.mutations);
  }
  const lines = physicalLines(working); const blocks = elementBlocks(lines); const correspondenceRows = rowMap(correspondence);
  const edges = new Map((targetGraph?.edges || []).map((edge) => [String(edge.elementId), edge])); const claims = new Set();
  for (const operation of transferPlan.operations || []) {
    if (noMutation(operation) || baseMutation(operation)) continue;
    if (extendedMutation(operation)) {
      const mutation = patchExtendedElement(lines, blocks, targetEdge(operation, correspondenceRows, edges), operation, claims);
      if (mutation) mutations.push(mutation);
    } else if (slotMutation(operation)) mutations.push(...patchSlot(lines, operation, claims));
  }
  const text = lines.map((line) => `${line.body}${line.ending}`).join('');
  if (text.length !== original.length) throw new Error('CII_WRITER_1B_CARDINALITY_OR_WIDTH_CHANGED');
  return Object.freeze({ schema: 'CIIWorkspaceWriter1BResult.v1', status: 'APPLIED', text, mutationCount: mutations.length,
    mutations: Object.freeze(mutations), readiness,
    negativeAssurance: Object.freeze({ textLengthUnchanged: true, sectionCardinalityChanged: false, pointerOwnershipChanged: false }) });
}
