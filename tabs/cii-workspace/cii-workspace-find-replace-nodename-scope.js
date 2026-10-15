import { CII_SIX_FIELD_WIDTHS, decodeFixedFields, parseFortranNumber } from '../../parser/fixed-field.js';

const NODENAME_POINTER_ROW = 13;
const NODENAME_POINTER_FIELD = 5;
const NODENAME_FROM_START = 2;
const NODENAME_TO_START = 28;
const NODENAME_ROW_END = 53;
const CONTROL_NODENAME_COUNT_FIELD = 3;

function fixedInteger(ref, fieldIndex) {
  if (!ref) return null;
  const fields = decodeFixedFields(ref.body, CII_SIX_FIELD_WIDTHS);
  const value = parseFortranNumber(fields[fieldIndex]);
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return Math.abs(value - rounded) <= 1e-9 && rounded >= 0 ? rounded : null;
}

function nodeNamePointer(block) {
  return fixedInteger(block?.refs?.[NODENAME_POINTER_ROW], NODENAME_POINTER_FIELD);
}

function ownerKey(pointer, end) {
  return `${pointer}:${end}`;
}

function addOwner(owners, pointer, end, nodeId) {
  const key = ownerKey(pointer, end);
  const set = owners.get(key) || new Set();
  set.add(String(nodeId));
  owners.set(key, set);
}

function buildOwnerMap(blocks, rowCount) {
  const owners = new Map();
  const blockers = [];
  for (const block of blocks || []) {
    const pointer = nodeNamePointer(block);
    if (pointer == null) {
      blockers.push(`NODENAME_POINTER_UNREADABLE:${block.index}`);
      continue;
    }
    if (pointer === 0) continue;
    if (pointer > rowCount) {
      blockers.push(`NODENAME_POINTER_OUT_OF_RANGE:${pointer}:${rowCount}:${block.index}`);
      continue;
    }
    addOwner(owners, pointer, 'FROM', block.from);
    addOwner(owners, pointer, 'TO', block.to);
  }
  return { owners, blockers };
}

function controlNodeNameCount(sectionRefs) {
  return fixedInteger(sectionRefs?.[0], CONTROL_NODENAME_COUNT_FIELD);
}

function asciiField(ref, pointer, end, startColumn, endColumn, ownerIds) {
  const width = endColumn - startColumn;
  if (!ref || ref.body.length < endColumn) {
    return { status: 'BLOCKED', blocker: `NODENAME_ROW_TOO_SHORT:${pointer}:${ref?.body?.length ?? 0}:${endColumn}` };
  }
  const rawField = ref.body.slice(startColumn, endColumn);
  if ([...rawField].some((char) => char.charCodeAt(0) > 0x7f)) {
    return { status: 'BLOCKED', blocker: `NODENAME_FIELD_NON_ASCII:${pointer}:${end}` };
  }
  const owners = [...(ownerIds || [])].sort((a, b) => Number(a) - Number(b));
  return {
    status: 'PASS',
    span: Object.freeze({
      start: ref.start + startColumn,
      end: ref.start + endColumn,
      lineIndex: ref.lineIndex,
      section: 'NODENAME',
      pointer,
      rowIndex: pointer - 1,
      fieldIdentity: `NODENAME_${end}`,
      fieldEnd: end,
      fieldWidth: width,
      semanticValue: rawField.trim(),
      ownerNodeIds: Object.freeze(owners),
      ownerAmbiguous: owners.length !== 1,
    }),
  };
}

function nodeNameContext(lines, helpers) {
  const section = helpers.sectionRefs(lines, 'NODENAME', { keepBlank: true });
  if (section.status !== 'PASS') return section;
  const control = helpers.sectionRefs(lines, 'CONTROL');
  if (control.status !== 'PASS') return control;
  const count = controlNodeNameCount(control.refs);
  if (count == null) return { status: 'BLOCKED', blockers: ['NODENAME_CONTROL_COUNT_UNREADABLE'] };
  if (count !== section.refs.length) {
    return { status: 'BLOCKED', blockers: [`NODENAME_CONTROL_COUNT_MISMATCH:${count}:${section.refs.length}`] };
  }
  const elements = helpers.elementBlocks(lines);
  if (elements.status !== 'PASS') return elements;
  const ownership = buildOwnerMap(elements.blocks, section.refs.length);
  if (ownership.blockers.length) return { status: 'BLOCKED', blockers: ownership.blockers };
  return { status: 'PASS', refs: section.refs, count, owners: ownership.owners };
}

function selectedSpans(element, context, pointer) {
  const ref = context.refs[pointer - 1];
  const from = asciiField(
    ref, pointer, 'FROM', NODENAME_FROM_START, NODENAME_TO_START,
    context.owners.get(ownerKey(pointer, 'FROM')),
  );
  if (from.status !== 'PASS') return { status: 'BLOCKED', blockers: [from.blocker] };
  const to = asciiField(
    ref, pointer, 'TO', NODENAME_TO_START, NODENAME_ROW_END,
    context.owners.get(ownerKey(pointer, 'TO')),
  );
  if (to.status !== 'PASS') return { status: 'BLOCKED', blockers: [to.blocker] };
  return { status: 'PASS', spans: Object.freeze([from.span, to.span]) };
}

function allNodeNameSpans(context) {
  const spans = []; const blockers = [];
  for (let pointer = 1; pointer <= context.refs.length; pointer += 1) {
    const ref = context.refs[pointer - 1];
    const from = asciiField(
      ref, pointer, 'FROM', NODENAME_FROM_START, NODENAME_TO_START,
      context.owners.get(ownerKey(pointer, 'FROM')),
    );
    const to = asciiField(
      ref, pointer, 'TO', NODENAME_TO_START, NODENAME_ROW_END,
      context.owners.get(ownerKey(pointer, 'TO')),
    );
    if (from.status !== 'PASS') blockers.push(from.blocker); else spans.push(from.span);
    if (to.status !== 'PASS') blockers.push(to.blocker); else spans.push(to.span);
  }
  return blockers.length
    ? { status: 'BLOCKED', blockers: Object.freeze(blockers), spans: Object.freeze([]) }
    : { status: 'PASS', blockers: Object.freeze([]), spans: Object.freeze(spans) };
}

export function resolveDocumentNodeNameScope(lines, helpers) {
  const context = nodeNameContext(lines, helpers);
  if (context.status !== 'PASS') return context;
  const selected = allNodeNameSpans(context);
  if (selected.status !== 'PASS') return selected;
  return Object.freeze({
    status: 'PASS', scope: 'DOCUMENT', block: 'NODENAME', fieldAware: true,
    authority: 'CII_V14_DOCUMENT_NODENAME_FIXED_FIELDS', spans: selected.spans,
    evidence: Object.freeze({
      rowCount: context.count, mutableFieldCount: selected.spans.length,
      fromWidth: NODENAME_TO_START - NODENAME_FROM_START,
      toWidth: NODENAME_ROW_END - NODENAME_TO_START,
      serializer: 'AUTO_RIGHT_PAD_FIXED_WIDTH',
    }),
    blockers: Object.freeze([]),
  });
}

export function resolveNodeNameScope(lines, operation, helpers) {
  const element = helpers.exactElementBlock(lines, operation);
  if (element.status !== 'PASS') return element;
  const pointer = nodeNamePointer(element.block);
  if (pointer == null) return { status: 'BLOCKED', blockers: [`NODENAME_POINTER_UNREADABLE:${element.block.index}`] };
  if (pointer === 0) {
    return { status: 'BLOCKED', blockers: [`NODENAME_POINTER_REQUIRED:${element.block.from}:${element.block.to}`] };
  }
  const context = nodeNameContext(lines, helpers);
  if (context.status !== 'PASS') return context;
  if (pointer > context.refs.length) {
    return { status: 'BLOCKED', blockers: [`NODENAME_POINTER_OUT_OF_RANGE:${pointer}:${context.refs.length}:${element.block.index}`] };
  }
  const selected = selectedSpans(element.block, context, pointer);
  if (selected.status !== 'PASS') return selected;
  return Object.freeze({
    status: 'PASS',
    scope: 'BLOCK',
    block: 'NODENAME',
    authority: 'CII_V14_ELEMENT_NODENAME_POINTER_FIXED_FIELDS',
    spans: selected.spans,
    evidence: Object.freeze({
      from: element.block.from,
      to: element.block.to,
      elementIndex: element.block.index,
      pointer,
      rowIndex: pointer - 1,
      rowCount: context.count,
      fromWidth: NODENAME_TO_START - NODENAME_FROM_START,
      toWidth: NODENAME_ROW_END - NODENAME_TO_START,
    }),
    blockers: Object.freeze([]),
  });
}

export const _test = Object.freeze({ nodeNamePointer, controlNodeNameCount, buildOwnerMap });
