import {
  extractFamilyRoot,
  findField,
  makeDisplayName,
  makeExactMemberKey,
  normalizeHeader,
  parseDelimitedRows,
  rowsToObjects,
} from './ps-family-token-utils.js';
import { PS_FAMILY_REGISTER_MEMBER_SCHEMA } from './ps-family-clash-audit-contract.js';

const NAME_HEADERS = Object.freeze(['item name', 'name of the element', 'element name', 'name']);

function headerMatches(header, candidates) {
  const normalized = normalizeHeader(header).toLowerCase();
  return candidates.some((candidate) => normalized === candidate || normalized.includes(candidate));
}

function hasHeader(text, candidates) {
  const rows = parseDelimitedRows(text);
  const headers = rows[0] || [];
  return headers.some((header) => headerMatches(header, candidates));
}

function addHeaderDiagnostics(csvText, diagnostics) {
  const text = String(csvText || '');
  if (!text.trim()) {
    diagnostics.push({ level: 'ERROR', code: 'EMPTY_EXPECTED_CSV', message: 'Expected PS CSV input is empty.' });
    return;
  }
  if (!hasHeader(text, NAME_HEADERS)) diagnostics.push({ level: 'ERROR', code: 'EXPECTED_NAME_HEADER_MISSING', message: 'Expected PS CSV has no recognizable Item Name column.' });
}

export function parsePsFamilyRegisterCsv(csvText, options = {}) {
  const objects = rowsToObjects(csvText);
  const rows = [];
  const diagnostics = [];
  const seen = new Map();
  addHeaderDiagnostics(csvText, diagnostics);

  objects.forEach((object) => {
    const rawItemName = findField(object, NAME_HEADERS);
    if (!String(rawItemName || '').trim()) {
      diagnostics.push({ level: 'WARN', code: 'EXPECTED_MEMBER_NAME_MISSING', message: `Row ${object.__rowIndex} has no Item Name.` });
      return;
    }
    const exactMemberKey = makeExactMemberKey(rawItemName);
    const row = {
      schema: PS_FAMILY_REGISTER_MEMBER_SCHEMA,
      rowIndex: object.__rowIndex,
      rawItemName,
      displayName: makeDisplayName(rawItemName),
      exactMemberKey,
      familyRoot: extractFamilyRoot(rawItemName, options),
      pdmsDesc: findField(object, ['pdms desc', 'description']),
    };
    if (seen.has(exactMemberKey)) diagnostics.push({ level: 'WARN', code: 'DUPLICATE_EXPECTED_MEMBER', message: `${row.displayName} appears more than once in expected CSV.` });
    seen.set(exactMemberKey, row);
    rows.push(row);
  });

  if (!rows.length) diagnostics.push({ level: 'WARN', code: 'NO_EXPECTED_MEMBERS', message: 'No expected PS members were parsed from the CSV.' });
  return { rows, diagnostics };
}
