import { decodeCiiNumericRow } from '../../parser/fixed-field.js';
import {
  ciiPhysicalByteString, ciiPhysicalSectionRows, createCiiPhysicalFile, decodeCiiAsciiByteString,
} from './cii-workspace-physical-file.js';

const ELEMENT_BLOCK_ROWS = 15;
const SIF_BLOCK_ROWS = 10;
const SIF_POINTER_ROW = 13;
const SIF_POINTER_FIELD_INDEX = 4;
const FIELD_WIDTHS = Object.freeze([15, 13, 13, 13, 13, 13]);
const SIF_FIELD_SPECS = Object.freeze({
  ii: Object.freeze({ fieldIndex: 2, item: 3, fieldIdentity: 'SIF_TEE_IN_PLANE_II' }),
  io: Object.freeze({ fieldIndex: 3, item: 4, fieldIdentity: 'SIF_TEE_OUT_PLANE_IO' }),
});

function fieldColumns(fieldIndex) {
  const start = FIELD_WIDTHS.slice(0, fieldIndex).reduce((sum, width) => sum + width, 0);
  return Object.freeze({ start, end: start + FIELD_WIDTHS[fieldIndex], width: FIELD_WIDTHS[fieldIndex] });
}
function integer(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}
function elementEnds(row) {
  const values = decodeCiiNumericRow(row);
  const from = Number(values?.[0]); const to = Number(values?.[1]);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Object.freeze({ from: String(Math.round(from)), to: String(Math.round(to)) });
}
function physicalSpan(line, fieldIndex, fieldIdentity, physicalFile) {
  const columns = fieldColumns(fieldIndex);
  if (!line) return Object.freeze({ qualified: false, fieldIdentity, fieldIndex, ...columns, reason: 'LINE_MISSING' });
  const byteStart = Number(line.byteStart) + columns.start; const byteEnd = Number(line.byteStart) + columns.end;
  if (Number(line.bodyByteEnd) - Number(line.byteStart) < columns.end) {
    return Object.freeze({
      qualified: false, fieldIdentity, fieldIndex, lineNumber: line.lineNumber, ...columns,
      byteStart, byteEnd, reason: 'ROW_TOO_SHORT',
    });
  }
  try {
    const rawField = decodeCiiAsciiByteString(ciiPhysicalByteString(physicalFile, byteStart, byteEnd));
    const text = rawField.trim();
    const numericValue = text ? Number(text.replace(/[dD]/g, 'E')) : null;
    return Object.freeze({
      qualified: numericValue == null || Number.isFinite(numericValue),
      fieldIdentity, fieldIndex, lineNumber: line.lineNumber, ...columns,
      byteStart, byteEnd, rawField, value: text,
      numericValue: Number.isFinite(numericValue) ? numericValue : null,
      ...(text && !Number.isFinite(numericValue) ? { reason: 'NON_NUMERIC_FIXED_FIELD' } : {}),
    });
  } catch (error) {
    return Object.freeze({
      qualified: false, fieldIdentity, fieldIndex, lineNumber: line.lineNumber, ...columns,
      byteStart, byteEnd, reason: error?.message || String(error),
    });
  }
}
function neutralVersion(physicalFile, blockers) {
  const rows = ciiPhysicalSectionRows(physicalFile, 'VERSION');
  if (!rows.length) { blockers.push('WRITER_1C_SIF_VERSION_SECTION_REQUIRED'); return Object.freeze({ major: null, row: null }); }
  const values = decodeCiiNumericRow(rows[0].text);
  const major = Number(values?.[1]);
  if (!Number.isFinite(major)) blockers.push('WRITER_1C_SIF_NEUTRAL_VERSION_UNREADABLE');
  else if (Math.abs(major - 11) > 1e-9) blockers.push(`WRITER_1C_SIF_NEUTRAL_VERSION_11_REQUIRED:${major}`);
  return Object.freeze({ major: Number.isFinite(major) ? major : null, row: rows[0].text, lineNumber: rows[0].lineNumber });
}
function controlSifCount(physicalFile, blockers) {
  const rows = ciiPhysicalSectionRows(physicalFile, 'CONTROL');
  if (rows.length < 3) { blockers.push('WRITER_1C_SIF_CONTROL_THREE_ROWS_REQUIRED'); return null; }
  const values = decodeCiiNumericRow(rows[2].text);
  const count = integer(values?.[4]);
  if (count == null) blockers.push('WRITER_1C_SIF_CONTROL_COUNT_UNREADABLE');
  return count;
}
function elementDescriptors(physicalFile, blockers) {
  const rows = ciiPhysicalSectionRows(physicalFile, 'ELEMENTS'); const blocks = [];
  if (rows.length % ELEMENT_BLOCK_ROWS !== 0) blockers.push('WRITER_1C_SIF_ELEMENT_BLOCK_ROW_COUNT_NOT_MULTIPLE_OF_15');
  for (let offset = 0, blockIndex = 0; offset + ELEMENT_BLOCK_ROWS <= rows.length; offset += ELEMENT_BLOCK_ROWS, blockIndex += 1) {
    const ends = elementEnds(rows[offset]?.text);
    if (!ends) { blockers.push(`WRITER_1C_SIF_ELEMENT_HEADER_INVALID:${blockIndex}`); continue; }
    const pointerLine = rows[offset + SIF_POINTER_ROW]; const values = decodeCiiNumericRow(pointerLine?.text);
    const pointer = integer(values?.[SIF_POINTER_FIELD_INDEX]);
    const pointerField = physicalSpan(pointerLine, SIF_POINTER_FIELD_INDEX, 'ELEMENT_SIF_TEE_POINTER', physicalFile);
    if (pointer == null) blockers.push(`WRITER_1C_SIF_POINTER_UNREADABLE:${blockIndex}`);
    if (!pointerField.qualified) blockers.push(`WRITER_1C_SIF_POINTER_FIXED_LAYOUT_UNQUALIFIED:${blockIndex}`);
    blocks.push(Object.freeze({ blockIndex, ...ends, pointer, pointerField }));
  }
  return Object.freeze({ rows, blocks: Object.freeze(blocks) });
}
function exactElementBindings(parsed, descriptors, controlCount, blockers) {
  const elements = Array.isArray(parsed?.elements) ? parsed.elements : [];
  const byParsedElementIndex = {}; const pointerOwners = new Map(); const used = new Set();
  if (descriptors.blocks.length !== elements.length) blockers.push('WRITER_1C_SIF_ELEMENT_BLOCK_COUNT_MISMATCH');
  for (const element of elements) {
    const parsedElementIndex = Number(element.index); const from = String(Math.round(Number(element.from))); const to = String(Math.round(Number(element.to)));
    const descriptor = descriptors.blocks.find((item) => item.blockIndex === parsedElementIndex);
    if (!Number.isSafeInteger(parsedElementIndex) || !descriptor || descriptor.from !== from || descriptor.to !== to || used.has(parsedElementIndex)) {
      blockers.push(`WRITER_1C_SIF_ELEMENT_PHYSICAL_BINDING_EXACT_REQUIRED:${Number.isSafeInteger(parsedElementIndex) ? parsedElementIndex : 'INVALID'}`);
      continue;
    }
    used.add(parsedElementIndex);
    const pointer = descriptor.pointer;
    if (pointer == null) continue;
    if (pointer > 0 && Number.isSafeInteger(controlCount) && pointer > controlCount) blockers.push(`WRITER_1C_SIF_POINTER_OUT_OF_RANGE:${parsedElementIndex}:${pointer}`);
    const binding = Object.freeze({
      parsedElementIndex, blockIndex: descriptor.blockIndex, from, to, pointer,
      pointerField: descriptor.pointerField, bindingAuthority: 'EXACT_PARSED_INDEX_AND_ENDPOINTS',
    });
    byParsedElementIndex[String(parsedElementIndex)] = binding;
    if (pointer > 0) {
      if (!pointerOwners.has(pointer)) pointerOwners.set(pointer, []);
      pointerOwners.get(pointer).push(binding);
    }
  }
  return { byParsedElementIndex, pointerOwners };
}
function slotEvidence(recordRows, slot, physicalFile, blockers, pointer) {
  const relativeRow = slot === 1 ? 0 : 5; const row = recordRows[relativeRow];
  const values = decodeCiiNumericRow(row?.text);
  if (!Array.isArray(values) || values.length < 4) blockers.push(`WRITER_1C_SIF_SLOT_ROW_UNREADABLE:${pointer}:${slot}`);
  const node = Number(values?.[0]); const type = Number(values?.[1]);
  if (!Number.isFinite(node) || !Number.isFinite(type)) blockers.push(`WRITER_1C_SIF_SLOT_IDENTITY_UNREADABLE:${pointer}:${slot}`);
  const fields = {};
  for (const [key, spec] of Object.entries(SIF_FIELD_SPECS)) {
    const span = physicalSpan(row, spec.fieldIndex, spec.fieldIdentity, physicalFile);
    if (!span.qualified) blockers.push(`WRITER_1C_SIF_FIELD_LAYOUT_UNQUALIFIED:${pointer}:${slot}:${spec.item}`);
    fields[key] = Object.freeze({ ...span, item: spec.item, slot, relativeRow });
  }
  return Object.freeze({
    slot, relativeRow,
    node: Number.isFinite(node) ? String(Math.round(node)) : null,
    type: Number.isFinite(type) ? Number(type) : null,
    ii: fields.ii, io: fields.io,
  });
}
function freezeBlock(pointer, recordRows, slots, owners) {
  return Object.freeze({
    pointer, rowStart: (pointer - 1) * SIF_BLOCK_ROWS, rowEndExclusive: pointer * SIF_BLOCK_ROWS,
    rowLineNumbers: Object.freeze(recordRows.map((row) => row.lineNumber)),
    slots: Object.freeze(slots), owners: Object.freeze(owners),
  });
}
function addSpanOwners(bySpan, field, owners, slot) {
  if (!field?.qualified) return;
  const spanKey = `${field.byteStart}:${field.byteEnd}`;
  const existing = bySpan.get(spanKey) || {
    spanKey, section: 'SIF&TEES', fieldIdentity: field.fieldIdentity, fieldKey: field.fieldIdentity.endsWith('_II') ? 'ii' : 'io',
    pointer: null, slot: slot.slot, item: field.item,
    lineNumber: field.lineNumber, startColumn: field.start, endColumn: field.end, width: field.width,
    byteStart: field.byteStart, byteEnd: field.byteEnd, rawField: field.rawField,
    value: field.value, numericValue: field.numericValue, owners: [],
  };
  if (existing.pointer == null && owners.length) existing.pointer = owners[0].pointer;
  for (const owner of owners) existing.owners.push(Object.freeze({
    parsedElementIndex: owner.parsedElementIndex, blockIndex: owner.blockIndex,
    from: owner.from, to: owner.to, pointer: owner.pointer,
    slot: slot.slot, item: field.item, node: slot.node, type: slot.type,
  }));
  bySpan.set(spanKey, existing);
}

export function extractCiiWriter1CSifEvidence(rawText, parsed = {}, options = {}) {
  const physicalFile = options.physicalFile || createCiiPhysicalFile(rawText);
  const semanticBlockers = [];
  const version = neutralVersion(physicalFile, semanticBlockers);
  const controlCount = controlSifCount(physicalFile, semanticBlockers);
  const descriptors = elementDescriptors(physicalFile, semanticBlockers);
  const bindings = exactElementBindings(parsed, descriptors, controlCount, semanticBlockers);
  const sifRows = ciiPhysicalSectionRows(physicalFile, ['SIF&TEES', 'SIF']);
  if (!Number.isSafeInteger(controlCount)) semanticBlockers.push('WRITER_1C_SIF_CONTROL_COUNT_REQUIRED');
  else if (sifRows.length !== controlCount * SIF_BLOCK_ROWS) {
    semanticBlockers.push(`WRITER_1C_SIF_CONTROL_CARDINALITY_MISMATCH:${controlCount}:${sifRows.length}`);
  }
  if (sifRows.length % SIF_BLOCK_ROWS !== 0) semanticBlockers.push('WRITER_1C_SIF_SECTION_ROW_COUNT_NOT_MULTIPLE_OF_10');

  const byPointer = {}; const bySpan = new Map();
  const blockCount = Number.isSafeInteger(controlCount) ? controlCount : Math.floor(sifRows.length / SIF_BLOCK_ROWS);
  for (let pointer = 1; pointer <= blockCount; pointer += 1) {
    const start = (pointer - 1) * SIF_BLOCK_ROWS; const recordRows = sifRows.slice(start, start + SIF_BLOCK_ROWS);
    if (recordRows.length !== SIF_BLOCK_ROWS) { semanticBlockers.push(`WRITER_1C_SIF_BLOCK_TRUNCATED:${pointer}`); continue; }
    const slots = Object.freeze({
      1: slotEvidence(recordRows, 1, physicalFile, semanticBlockers, pointer),
      2: slotEvidence(recordRows, 2, physicalFile, semanticBlockers, pointer),
    });
    const owners = bindings.pointerOwners.get(pointer) || [];
    byPointer[String(pointer)] = freezeBlock(pointer, recordRows, slots, owners);
    addSpanOwners(bySpan, slots[1].ii, owners, slots[1]); addSpanOwners(bySpan, slots[1].io, owners, slots[1]);
    addSpanOwners(bySpan, slots[2].ii, owners, slots[2]); addSpanOwners(bySpan, slots[2].io, owners, slots[2]);
  }
  for (const pointer of bindings.pointerOwners.keys()) {
    if (!byPointer[String(pointer)]) semanticBlockers.push(`WRITER_1C_SIF_POINTER_BLOCK_MISSING:${pointer}`);
  }
  const spanObject = Object.fromEntries([...bySpan.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([key, value]) => [key, Object.freeze({ ...value, owners: Object.freeze(value.owners) })]));
  const uniqueSemanticBlockers = [...new Set(semanticBlockers)];
  const writerBlockers = [...uniqueSemanticBlockers];
  if (physicalFile.writer1CByteEligible !== true) writerBlockers.push('WRITER_1C_SIF_ORIGINAL_BYTE_CUSTODY_REQUIRED');
  return Object.freeze({
    schema: 'CIIWorkspaceWriter1CSifPhysicalCustody.v1',
    semanticStatus: uniqueSemanticBlockers.length ? 'BLOCKED' : 'QUALIFIED',
    status: writerBlockers.length ? 'BLOCKED' : 'QUALIFIED',
    neutralVersion: version, blockRows: SIF_BLOCK_ROWS, controlBlockCount: controlCount, sectionRowCount: sifRows.length,
    byteAuthority: physicalFile.byteAuthority, writer1CByteEligible: physicalFile.writer1CByteEligible,
    byParsedElementIndex: Object.freeze(bindings.byParsedElementIndex), byPointer: Object.freeze(byPointer), bySpan: Object.freeze(spanObject),
    semanticBlockers: Object.freeze(uniqueSemanticBlockers), blockers: Object.freeze([...new Set(writerBlockers)]),
  });
}

export const CII_WRITER_1C_SIF_FIELD_SPECS = SIF_FIELD_SPECS;
