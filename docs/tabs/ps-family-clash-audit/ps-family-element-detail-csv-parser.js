import {
  extractFamilyRoot,
  findField,
  makeDisplayName,
  makeExactMemberKey,
  normalizeHeader,
  parseDelimitedRows,
  parseNumber,
  parsePipeTag,
  parsePosition,
  rowsToObjects,
} from './ps-family-token-utils.js';
import { PS_FAMILY_ELEMENT_DETAIL_SCHEMA } from './ps-family-clash-audit-contract.js';

const NAME_HEADERS = Object.freeze(['name of the element', 'item name', 'element name', 'name']);
const POSITION_HEADERS = Object.freeze(['position']);

function headerMatches(header, candidates) {
  const normalized = normalizeHeader(header).toLowerCase();
  return candidates.some((candidate) => normalized === candidate || normalized.includes(candidate));
}

function hasHeader(text, candidates) {
  const parsedRows = parseDelimitedRows(text);
  const headers = parsedRows[0] || [];
  return headers.some((header) => headerMatches(header, candidates));
}

function addHeaderDiagnostics(csvText, diagnostics) {
  const text = String(csvText || '');
  if (!text.trim()) {
    diagnostics.push({ level: 'WARN', code: 'EMPTY_ELEMENT_DETAIL_CSV', message: 'Element Detail CSV input is empty.' });
    return;
  }
  if (!hasHeader(text, NAME_HEADERS)) diagnostics.push({ level: 'ERROR', code: 'DETAIL_NAME_HEADER_MISSING', message: 'Element Detail CSV has no recognizable element name column.' });
  if (!hasHeader(text, POSITION_HEADERS)) diagnostics.push({ level: 'WARN', code: 'POSITION_HEADER_MISSING', message: 'Element Detail CSV has no recognizable Position column.' });
}

export function parsePsFamilyElementDetailCsv(csvText, options = {}) {
  const objects = rowsToObjects(csvText);
  const rows = [];
  const diagnostics = [];
  addHeaderDiagnostics(csvText, diagnostics);

  objects.forEach((object) => {
    const rawName = findField(object, NAME_HEADERS);
    if (!String(rawName || '').trim()) {
      diagnostics.push({ level: 'WARN', code: 'DETAIL_NAME_MISSING', message: `Row ${object.__rowIndex} has no element name.` });
      return;
    }
    const pipe = findField(object, ['pipe']);
    const positionText = findField(object, POSITION_HEADERS);
    const position = parsePosition(positionText);
    if (positionText && !position) diagnostics.push({ level: 'WARN', code: 'POSITION_PARSE_FAILED', message: `Position could not be parsed for ${makeDisplayName(rawName)}.` });
    const pipeInfo = pipe ? parsePipeTag(pipe) : null;
    rows.push({
      schema: PS_FAMILY_ELEMENT_DETAIL_SCHEMA,
      rowIndex: object.__rowIndex,
      rawName,
      displayName: makeDisplayName(rawName),
      exactMemberKey: makeExactMemberKey(rawName),
      sourceFamily: extractFamilyRoot(rawName, options),
      p1bore: parseNumber(findField(object, ['p1bore', 'bore'])),
      pipe,
      pipeInfo,
      lineFamily: pipeInfo?.lineFamily || '',
      supportText: findField(object, ['rtext of detailing text', 'rtext', 'detailing text']),
      supportGap: findField(object, ['support gap', 'gap']),
      reference: findField(object, ['reference of the element', 'reference']),
      positionText,
      position,
      isometricNotes: findField(object, ['isometric notes', 'notes']),
      posFamilyId: '',
    });
  });

  if (!rows.length) diagnostics.push({ level: 'INFO', code: 'NO_ELEMENT_DETAILS', message: 'No element detail rows were parsed.' });
  return { rows, diagnostics };
}
