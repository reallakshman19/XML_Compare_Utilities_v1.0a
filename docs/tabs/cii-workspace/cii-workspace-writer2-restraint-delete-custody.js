import { decodeCiiNumericRow } from '../../parser/fixed-field.js';
import { deepFreeze } from './cii-workspace-contracts.js';
import {
  ciiPhysicalByteString, ciiPhysicalSectionRows, decodeCiiAsciiByteString,
} from './cii-workspace-physical-file.js';

export const CII_WRITER_2_RESTRAINT_POINTER_CUSTODY_AUTHORITY =
  'EXACT_PARSED_INDEX_ENDPOINTS_AND_PHYSICAL_RESTRAINT_POINTER_I13';

const ELEMENT_BLOCK_ROWS = 15;
const POINTER_ROW = 12;
const POINTER_FIELD_INDEX = 3;
const FIELD_WIDTHS = Object.freeze([15, 13, 13, 13, 13, 13]);
const I13_RX = /^[+-]?\d+$/;

function fieldColumns(fieldIndex) {
  const start = FIELD_WIDTHS.slice(0, fieldIndex).reduce((sum, width) => sum + width, 0);
  return Object.freeze({ start, end: start + FIELD_WIDTHS[fieldIndex], width: FIELD_WIDTHS[fieldIndex] });
}
function integer(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}
function elementEnds(row) {
  const values = decodeCiiNumericRow(row?.text ?? row);
  const from = Number(values?.[0]); const to = Number(values?.[1]);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Object.freeze({ from: String(Math.round(from)), to: String(Math.round(to)) });
}
function physicalPointerField(line, physicalFile) {
  const columns = fieldColumns(POINTER_FIELD_INDEX);
  if (!line || Number(line.bodyByteEnd) - Number(line.byteStart) < columns.end) {
    return deepFreeze({ qualified: false, ...columns, reason: 'ROW_TOO_SHORT' });
  }
  const byteStart = Number(line.byteStart) + columns.start;
  const byteEnd = Number(line.byteStart) + columns.end;
  try {
    const rawField = decodeCiiAsciiByteString(ciiPhysicalByteString(physicalFile, byteStart, byteEnd));
    const text = rawField.trim();
    const lexicalI13 = I13_RX.test(text);
    const pointer = lexicalI13 ? integer(Number(text)) : null;
    return deepFreeze({
      qualified: pointer != null,
      fieldIdentity: 'ELEMENT_RESTRAINT_POINTER', fieldIndex: POINTER_FIELD_INDEX,
      lineNumber: line.lineNumber, ...columns, byteStart, byteEnd, rawField, pointer,
      ...(pointer == null ? { reason: lexicalI13 ? 'INVALID_NONNEGATIVE_I13_POINTER_FIELD' : 'NON_LEXICAL_I13_POINTER_FIELD' } : {}),
    });
  } catch (error) {
    return deepFreeze({ qualified: false, ...columns, reason: error?.message || String(error) });
  }
}
function semanticEntry(targetDocument, parsedElementIndex) {
  return targetDocument?.auxiliaryEvidence?.elements?.[String(parsedElementIndex)]
    ?? targetDocument?.auxiliaryEvidence?.elements?.[parsedElementIndex]
    ?? null;
}

export function buildCiiWriter2RestraintPointerCustody(targetDocument) {
  const blockers = [];
  const physicalFile = targetDocument?.physicalFile;
  const parsed = Array.isArray(targetDocument?.parsed?.elements) ? targetDocument.parsed.elements : [];
  if (!physicalFile || physicalFile.writer1CByteEligible !== true) {
    blockers.push('WRITER_2_RESTRAINT_EXACT_ELEMENT_ORIGINAL_BYTE_CUSTODY_REQUIRED');
  }
  const rows = physicalFile ? ciiPhysicalSectionRows(physicalFile, 'ELEMENTS') : [];
  if (rows.length % ELEMENT_BLOCK_ROWS !== 0) blockers.push('WRITER_2_RESTRAINT_ELEMENT_BLOCK_ROW_COUNT_NOT_MULTIPLE_OF_15');
  const blockCount = Math.floor(rows.length / ELEMENT_BLOCK_ROWS);
  if (blockCount !== parsed.length) blockers.push('WRITER_2_RESTRAINT_PARSED_PHYSICAL_ELEMENT_COUNT_MISMATCH');

  const byParsedElementIndex = {}; const ownersByPointer = new Map(); const used = new Set();
  for (const element of parsed) {
    const parsedElementIndex = Number(element?.index);
    const from = String(Math.round(Number(element?.from)));
    const to = String(Math.round(Number(element?.to)));
    if (!Number.isSafeInteger(parsedElementIndex) || parsedElementIndex < 0 || parsedElementIndex >= blockCount || used.has(parsedElementIndex)) {
      blockers.push(`WRITER_2_RESTRAINT_EXACT_PARSED_ELEMENT_INDEX_REQUIRED:${Number.isSafeInteger(parsedElementIndex) ? parsedElementIndex : 'INVALID'}`);
      continue;
    }
    used.add(parsedElementIndex);
    const offset = parsedElementIndex * ELEMENT_BLOCK_ROWS;
    const ends = elementEnds(rows[offset]);
    if (!ends || ends.from !== from || ends.to !== to) {
      blockers.push(`WRITER_2_RESTRAINT_EXACT_ELEMENT_ENDPOINT_BINDING_REQUIRED:${parsedElementIndex}`);
      continue;
    }
    const pointerLine = rows[offset + POINTER_ROW];
    const values = decodeCiiNumericRow(pointerLine?.text || '');
    const pointer = integer(values?.[POINTER_FIELD_INDEX]);
    const pointerField = physicalPointerField(pointerLine, physicalFile);
    if (pointer == null || !pointerField.qualified || pointerField.pointer !== pointer) {
      blockers.push(`WRITER_2_RESTRAINT_EXACT_POINTER_FIELD_REQUIRED:${parsedElementIndex}`);
      continue;
    }
    const semantic = semanticEntry(targetDocument, parsedElementIndex);
    if (!semantic || Number(semantic?.parsedElementIndex) !== parsedElementIndex
      || String(semantic?.from) !== from || String(semantic?.to) !== to
      || Number(semantic?.pointers?.restraint || 0) !== pointer) {
      blockers.push(`WRITER_2_RESTRAINT_AUXILIARY_POINTER_CROSSCHECK_REQUIRED:${parsedElementIndex}`);
      continue;
    }
    const binding = deepFreeze({
      authority: CII_WRITER_2_RESTRAINT_POINTER_CUSTODY_AUTHORITY,
      parsedElementIndex, blockIndex: parsedElementIndex, from, to, pointer, pointerField,
    });
    byParsedElementIndex[String(parsedElementIndex)] = binding;
    if (pointer > 0) {
      if (!ownersByPointer.has(pointer)) ownersByPointer.set(pointer, []);
      ownersByPointer.get(pointer).push(binding);
    }
  }

  const owners = Object.fromEntries([...ownersByPointer.entries()].sort(([a], [b]) => a - b)
    .map(([pointer, values]) => [String(pointer), Object.freeze([...values].sort((a, b) => a.parsedElementIndex - b.parsedElementIndex))]));
  const uniqueBlockers = Object.freeze([...new Set(blockers)]);
  return deepFreeze({
    schema: 'CIIWorkspaceWriter2RestraintPointerCustody.v1',
    status: uniqueBlockers.length ? 'BLOCKED' : 'QUALIFIED',
    authority: CII_WRITER_2_RESTRAINT_POINTER_CUSTODY_AUTHORITY,
    elementBlockRows: ELEMENT_BLOCK_ROWS,
    physicalElementBlockCount: blockCount,
    parsedElementCount: parsed.length,
    byParsedElementIndex: deepFreeze(byParsedElementIndex),
    ownersByPointer: deepFreeze(owners),
    blockers: uniqueBlockers,
  });
}

export const _test = Object.freeze({ fieldColumns, elementEnds, physicalPointerField });
