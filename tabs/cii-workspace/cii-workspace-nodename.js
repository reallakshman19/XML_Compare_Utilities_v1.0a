import { decodeCiiNumericRow } from '../../parser/fixed-field.js';
import {
  ciiPhysicalByteString, ciiPhysicalSectionRows, createCiiPhysicalFile, decodeCiiAsciiByteString,
} from './cii-workspace-physical-file.js';

const ELEMENT_BLOCK_ROWS = 15;
const NODENAME_POINTER_ROW = 13;
const NODENAME_FROM_START = 2;
const NODENAME_TO_START = 28;
const NODENAME_ROW_END = 53;
const POINTER_FIELD_START = 67;
const POINTER_FIELD_END = 80;

function integerPointer(row) {
  const values = decodeCiiNumericRow(row);
  const pointer = Number(values?.[5]);
  return Number.isSafeInteger(pointer) && pointer >= 0 ? pointer : null;
}

function elementEnds(row) {
  const values = decodeCiiNumericRow(row);
  const from = Number(values?.[0]); const to = Number(values?.[1]);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return { from: String(Math.round(from)), to: String(Math.round(to)) };
}

function rawElementDescriptors(physicalFile, physicalBlockers) {
  const rows = ciiPhysicalSectionRows(physicalFile, 'ELEMENTS'); const blocks = [];
  if (rows.length % ELEMENT_BLOCK_ROWS !== 0) physicalBlockers.push('NODENAME_ELEMENT_BLOCK_ROW_COUNT_NOT_MULTIPLE_OF_15');
  for (let offset = 0, blockIndex = 0; offset + ELEMENT_BLOCK_ROWS <= rows.length; offset += ELEMENT_BLOCK_ROWS, blockIndex += 1) {
    const header = rows[offset]; const ends = elementEnds(header?.text);
    if (!ends) {
      physicalBlockers.push(`NODENAME_ELEMENT_CANONICAL_HEADER_INVALID:${blockIndex}`);
      continue;
    }
    const pointerLine = rows[offset + NODENAME_POINTER_ROW];
    blocks.push(Object.freeze({
      blockIndex, ...ends, pointer: integerPointer(pointerLine?.text), pointerLine,
      pointerField: physicalSpan(pointerLine, POINTER_FIELD_START, POINTER_FIELD_END, 'ELEMENT_NODENAME_POINTER', physicalFile),
    }));
  }
  return { rows, blocks };
}

function matchDescriptor(element, descriptors, used) {
  const from = String(Math.round(Number(element.from))); const to = String(Math.round(Number(element.to)));
  const parsedIndex = Number(element.index);
  const exactIndex = descriptors.findIndex((item, position) => !used.has(position)
    && Number.isSafeInteger(parsedIndex) && item.blockIndex === parsedIndex && item.from === from && item.to === to);
  if (exactIndex >= 0) {
    used.add(exactIndex);
    return Object.freeze({ descriptor: descriptors[exactIndex], authority: 'EXACT_PARSED_INDEX_AND_ENDPOINTS' });
  }

  const fallback = descriptors.map((item, position) => ({ item, position }))
    .filter(({ item, position }) => !used.has(position) && item.from === from && item.to === to);
  if (fallback.length === 1) {
    used.add(fallback[0].position);
    return Object.freeze({ descriptor: fallback[0].item, authority: 'ENDPOINT_FALLBACK_READ_ONLY' });
  }
  if (fallback.length > 1) {
    return Object.freeze({
      descriptor: null, authority: 'AMBIGUOUS_ENDPOINT_FALLBACK',
      candidateBlockIndexes: Object.freeze(fallback.map(({ item }) => item.blockIndex)),
    });
  }
  return Object.freeze({ descriptor: null, authority: 'UNRESOLVED' });
}

function physicalSpan(line, startColumn, endColumn, fieldIdentity, physicalFile) {
  if (!line) return Object.freeze({ qualified: false, fieldIdentity, reason: 'LINE_MISSING' });
  const width = endColumn - startColumn; const start = line.byteStart + startColumn; const end = line.byteStart + endColumn;
  if (line.bodyByteEnd - line.byteStart < endColumn) {
    return Object.freeze({ qualified: false, fieldIdentity, lineNumber: line.lineNumber, startColumn, endColumn, width, reason: 'ROW_TOO_SHORT' });
  }
  try {
    const rawField = decodeCiiAsciiByteString(ciiPhysicalByteString(physicalFile, start, end));
    return Object.freeze({
      qualified: true, fieldIdentity, lineNumber: line.lineNumber, startColumn, endColumn, width,
      byteStart: start, byteEnd: end, rawField, value: rawField.trim(),
    });
  } catch (error) {
    return Object.freeze({
      qualified: false, fieldIdentity, lineNumber: line.lineNumber, startColumn, endColumn, width,
      byteStart: start, byteEnd: end, reason: error?.message || String(error),
    });
  }
}

function parseNamePair(row) {
  const padded = String(row ?? '').padEnd(NODENAME_ROW_END, ' ');
  return {
    fromName: padded.slice(NODENAME_FROM_START, NODENAME_TO_START).trim(),
    toName: padded.slice(NODENAME_TO_START, NODENAME_ROW_END).trim(),
  };
}

function addConflict(conflicts, code, details = {}) { conflicts.push(Object.freeze({ code, ...details })); }

function assignName(state, nodeId, name, evidence) {
  if (!name) return;
  const key = String(nodeId);
  if (!state.known.has(key)) { addConflict(state.conflicts, 'NODENAME_UNKNOWN_NODE', { nodeId: key, ...evidence }); return; }
  if (state.blocked.has(key)) return;
  const previous = state.names.get(key);
  if (previous && previous !== name) {
    state.names.delete(key); state.blocked.add(key);
    addConflict(state.conflicts, 'NODENAME_CONFLICT', { nodeId: key, previous, proposed: name, ...evidence }); return;
  }
  state.names.set(key, name);
}

function addPhysicalOwner(bySpan, field, owner) {
  if (!field?.qualified) return;
  const key = `${field.byteStart}:${field.byteEnd}`;
  const existing = bySpan.get(key) || { ...field, section: 'NODENAME', owners: [] };
  existing.owners.push(Object.freeze(owner)); bySpan.set(key, existing);
}

function freezePhysicalCustody(physicalFile, blockers, byElementIndex, bySpan, rowCount) {
  const spans = Object.fromEntries([...bySpan.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([key, value]) => [key, Object.freeze({ ...value, owners: Object.freeze(value.owners) })]));
  return Object.freeze({
    schema: 'CIIWorkspaceNodeNamePhysicalCustody.v1',
    status: physicalFile.writer1CByteEligible && blockers.length === 0 ? 'QUALIFIED' : 'BLOCKED',
    byteAuthority: physicalFile.byteAuthority, writer1CByteEligible: physicalFile.writer1CByteEligible,
    rowCount, blockers: Object.freeze([...new Set(blockers)]),
    byElementIndex: Object.freeze(byElementIndex), bySpan: Object.freeze(spans),
  });
}

export function extractCiiNodeNameEvidence(rawText, parsed = {}, options = {}) {
  const physicalFile = options.physicalFile || createCiiPhysicalFile(rawText);
  const elements = Array.isArray(parsed.elements) ? parsed.elements : [];
  const rows = ciiPhysicalSectionRows(physicalFile, 'NODENAME'); const physicalBlockers = [];
  if (!physicalFile.writer1CByteEligible) physicalBlockers.push('NODENAME_ORIGINAL_BYTE_CUSTODY_REQUIRED');
  const descriptors = rawElementDescriptors(physicalFile, physicalBlockers); const used = new Set();
  if (descriptors.blocks.length !== elements.length) physicalBlockers.push('NODENAME_ELEMENT_BLOCK_COUNT_MISMATCH');
  const state = { known: new Set(Object.keys(parsed.nodes || {}).map(String)), names: new Map(), blocked: new Set(), conflicts: [] };
  const byElementIndex = {}; const bySpan = new Map(); let mappedElementCount = 0;
  elements.forEach((element, elementIndex) => {
    const binding = matchDescriptor(element, descriptors.blocks, used); const descriptor = binding.descriptor;
    if (!descriptor) {
      const code = binding.authority === 'AMBIGUOUS_ENDPOINT_FALLBACK'
        ? 'NODENAME_ELEMENT_BLOCK_AMBIGUOUS' : 'NODENAME_ELEMENT_BLOCK_NOT_FOUND';
      addConflict(state.conflicts, code, {
        elementIndex, parsedElementIndex: element.index, from: element.from, to: element.to,
        ...(binding.candidateBlockIndexes ? { candidateBlockIndexes: binding.candidateBlockIndexes } : {}),
      });
      return;
    }
    if (binding.authority !== 'EXACT_PARSED_INDEX_AND_ENDPOINTS') {
      physicalBlockers.push(`NODENAME_ELEMENT_PHYSICAL_BINDING_EXACT_REQUIRED:${elementIndex}`);
    }
    const { pointer, blockIndex } = descriptor;
    if (pointer === null) { addConflict(state.conflicts, 'NODENAME_POINTER_UNREADABLE', { elementIndex, blockIndex }); return; }
    if (!descriptor.pointerField.qualified) physicalBlockers.push('NODENAME_POINTER_FIXED_LAYOUT_UNQUALIFIED');
    if (pointer === 0) {
      byElementIndex[elementIndex] = Object.freeze({
        elementIndex, parsedElementIndex: Number(element.index), bindingAuthority: binding.authority,
        blockIndex, from: descriptor.from, to: descriptor.to, pointer, pointerField: descriptor.pointerField, rowIndex: null,
      });
      return;
    }
    if (pointer > rows.length) { addConflict(state.conflicts, 'NODENAME_POINTER_OUT_OF_RANGE', { elementIndex, blockIndex, pointer, rowCount: rows.length }); return; }
    mappedElementCount += 1;
    const rowIndex = pointer - 1; const row = rows[rowIndex]; const pair = parseNamePair(row.text);
    const fromField = physicalSpan(row, NODENAME_FROM_START, NODENAME_TO_START, 'NODENAME_FROM', physicalFile);
    const toField = physicalSpan(row, NODENAME_TO_START, NODENAME_ROW_END, 'NODENAME_TO', physicalFile);
    if (!fromField.qualified || !toField.qualified) physicalBlockers.push('NODENAME_FIXED_LAYOUT_UNQUALIFIED');
    byElementIndex[elementIndex] = Object.freeze({
      elementIndex, parsedElementIndex: Number(element.index), bindingAuthority: binding.authority,
      blockIndex, from: descriptor.from, to: descriptor.to, pointer, pointerField: descriptor.pointerField,
      rowIndex, rowLineNumber: row.lineNumber, fromField, toField,
    });
    addPhysicalOwner(bySpan, fromField, {
      elementIndex, parsedElementIndex: Number(element.index), bindingAuthority: binding.authority,
      blockIndex, pointer, rowIndex, end: 'FROM', nodeId: String(element.from),
    });
    addPhysicalOwner(bySpan, toField, {
      elementIndex, parsedElementIndex: Number(element.index), bindingAuthority: binding.authority,
      blockIndex, pointer, rowIndex, end: 'TO', nodeId: String(element.to),
    });
    assignName(state, element.from, pair.fromName, { elementIndex, blockIndex, pointer, end: 'FROM' });
    assignName(state, element.to, pair.toName, { elementIndex, blockIndex, pointer, end: 'TO' });
  });
  const names = Object.fromEntries([...state.names.entries()].sort((a, b) => Number(a[0]) - Number(b[0])));
  const custodyBlockers = [...physicalBlockers,
    ...state.conflicts.map((item) => `NODENAME_CUSTODY_CONFLICT:${item.code}`)];
  return Object.freeze({
    schema: 'CIIWorkspaceNodeNameEvidence.v1', rowCount: rows.length, rawElementBlockCount: descriptors.blocks.length,
    mappedElementCount, names: Object.freeze(names), conflicts: Object.freeze(state.conflicts),
    physicalCustody: freezePhysicalCustody(physicalFile, custodyBlockers, byElementIndex, bySpan, rows.length),
  });
}
