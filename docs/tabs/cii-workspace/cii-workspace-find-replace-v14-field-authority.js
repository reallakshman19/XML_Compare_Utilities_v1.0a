import { CII_SIX_FIELD_WIDTHS, decodeFixedFields, parseFortranNumber } from '../../parser/fixed-field.js';

const NUMERIC_FIELD_WIDTH = 13;
const NUMERIC_ROW_WIDTHS = Object.freeze(CII_SIX_FIELD_WIDTHS.map((_, index) => (
  CII_SIX_FIELD_WIDTHS.slice(0, index + 1).reduce((sum, width) => sum + width, 0)
)));
const ELEMENT_NUMERIC_FIELD_COUNTS = Object.freeze([6, 6, 6, 6, 6, 6, 6, 6, 5]);
// Retained-real v14 row shapes. `null` marks a length-prefixed text row.
// Unlisted families still require one of the canonical fixed numeric widths;
// U4 can tighten their row-position schemas when retained-real specimens exist.
const AUX_NUMERIC_FIELD_COUNTS = Object.freeze({
  BEND: Object.freeze([6, 6, 2]),
  RIGID: Object.freeze([2]),
  RESTRANT: Object.freeze(Array.from({ length: 6 }, () => [6, 3, null, null]).flat()),
  'SIF&TEES': Object.freeze(Array(14).fill(6)),
  REDUCERS: Object.freeze([5, 5]),
});
const LENGTH_TEXT_PREFIX = 13;

function blocked(blocker) {
  return Object.freeze({ status: 'BLOCKED', blockers: Object.freeze([blocker]), spans: Object.freeze([]) });
}

function fieldSpan(ref, startColumn, endColumn, metadata) {
  return Object.freeze({
    start: ref.start + startColumn,
    end: ref.start + endColumn,
    lineIndex: ref.lineIndex,
    fieldWidth: endColumn - startColumn,
    ...metadata,
  });
}

function numericColumn(fieldIndex) {
  return fieldIndex === 0 ? 2 : 15 + (fieldIndex - 1) * NUMERIC_FIELD_WIDTH;
}

function numericRowFieldCount(body) {
  const index = NUMERIC_ROW_WIDTHS.indexOf(String(body ?? '').length);
  return index < 0 ? null : index + 1;
}

function numericRowSpans(ref, metadata = {}, protectedFields = new Set(), expectedFieldCount = null) {
  const fieldCount = numericRowFieldCount(ref.body);
  if (fieldCount == null || (expectedFieldCount != null && fieldCount < expectedFieldCount)) return null;
  const decoded = decodeFixedFields(ref.body, CII_SIX_FIELD_WIDTHS).slice(0, fieldCount);
  if (expectedFieldCount != null && fieldCount > expectedFieldCount) {
    const padding = decoded.slice(expectedFieldCount);
    const invalidPadding = padding.some((field) => {
      if (!field.trim()) return false;
      const value = parseFortranNumber(field);
      return !Number.isFinite(value) || Math.abs(value) > 1e-12;
    });
    if (invalidPadding) return null;
  }
  const fields = expectedFieldCount == null ? decoded : decoded.slice(0, expectedFieldCount);
  const nonBlank = fields.map((field, index) => ({ field, index })).filter(({ field }) => field.trim());
  if (!nonBlank.length) return null;
  if (nonBlank.some(({ field }) => !Number.isFinite(parseFortranNumber(field)))) return null;

  const spans = [];
  for (const { field, index } of nonBlank) {
    if (protectedFields.has(index)) continue;
    const startColumn = numericColumn(index);
    spans.push(fieldSpan(ref, startColumn, startColumn + NUMERIC_FIELD_WIDTH, {
      ...metadata,
      fieldKind: 'NUMERIC',
      fieldIndex: index,
      fieldIdentity: `${metadata.fieldPrefix || metadata.section || 'ROW'}_F${index + 1}`,
      semanticValue: field.trim(),
    }));
  }
  return Object.freeze(spans);
}

function lengthTextSpan(ref, metadata = {}) {
  if (ref.body.length < LENGTH_TEXT_PREFIX) return null;
  if (!/^\s{7}$/.test(ref.body.slice(0, 7)) || ref.body[12] !== ' ') return null;
  const token = ref.body.slice(7, 12).trim();
  if (!/^\d+$/.test(token)) return null;
  const length = Number(token);
  if (!Number.isSafeInteger(length) || length < 0 || length > ref.body.length - LENGTH_TEXT_PREFIX) {
    return blocked(`LENGTH_TEXT_DECLARATION_INVALID:${metadata.fieldPrefix || metadata.section || 'TEXT'}:${length}:${ref.body.length}`);
  }
  const value = ref.body.slice(LENGTH_TEXT_PREFIX, LENGTH_TEXT_PREFIX + length);
  if ([...value].some((char) => char.charCodeAt(0) > 0x7f)) {
    return blocked(`TEXT_FIELD_NON_ASCII:${metadata.fieldPrefix || metadata.section || 'TEXT'}`);
  }
  const spans = length === 0 ? [] : [fieldSpan(ref, LENGTH_TEXT_PREFIX, LENGTH_TEXT_PREFIX + length, {
    ...metadata,
    fieldKind: 'TEXT',
    fieldIndex: 0,
    fieldIdentity: metadata.fieldPrefix || `${metadata.section || 'TEXT'}_TEXT`,
    semanticValue: value,
  })];
  return Object.freeze({ status: 'PASS', blockers: Object.freeze([]), spans: Object.freeze(spans) });
}

function fixedA40Span(ref, metadata = {}) {
  if (ref.body.length < 42 || ref.body.slice(0, 2) !== '  ' || ref.body.slice(42).trim()) return null;
  const raw = ref.body.slice(2, 42);
  if ([...raw].some((char) => char.charCodeAt(0) > 0x7f)) {
    return blocked(`TEXT_FIELD_NON_ASCII:${metadata.fieldPrefix || metadata.section || 'A40'}`);
  }
  const semanticLength = raw.trimEnd().length;
  const spans = semanticLength === 0 ? [] : [fieldSpan(ref, 2, 2 + semanticLength, {
    ...metadata,
    fieldKind: 'TEXT',
    fieldIndex: 0,
    fieldIdentity: metadata.fieldPrefix || `${metadata.section || 'TEXT'}_A40`,
    semanticValue: raw.slice(0, semanticLength),
  })];
  return Object.freeze({ status: 'PASS', blockers: Object.freeze([]), spans: Object.freeze(spans) });
}

function validatePointerRow(ref, rowIndex) {
  const expectedFieldCount = rowIndex === 14 ? 3 : 6;
  const fieldCount = numericRowFieldCount(ref.body);
  if (fieldCount == null || fieldCount < expectedFieldCount) {
    return `ELEMENT_POINTER_ROW_WIDTH_INVALID:${rowIndex}:${ref.body.length}:${NUMERIC_ROW_WIDTHS[expectedFieldCount - 1]}`;
  }
  const decoded = decodeFixedFields(ref.body, CII_SIX_FIELD_WIDTHS).slice(0, fieldCount);
  if (fieldCount > expectedFieldCount) {
    const invalidPadding = decoded.slice(expectedFieldCount).some((field) => {
      if (!field.trim()) return false;
      const value = parseFortranNumber(field);
      return !Number.isFinite(value) || Math.abs(value) > 1e-12;
    });
    if (invalidPadding) return `ELEMENT_POINTER_PADDING_INVALID:${rowIndex}`;
  }
  const fields = decoded.slice(0, expectedFieldCount);
  for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 1) {
    if (!fields[fieldIndex].trim()) continue;
    const value = parseFortranNumber(fields[fieldIndex]);
    if (!Number.isFinite(value) || value < 0 || Math.abs(value - Math.round(value)) > 1e-9) {
      return `ELEMENT_POINTER_FIELD_INVALID:${rowIndex}:${fieldIndex}`;
    }
  }
  return null;
}

function requireNumeric(ref, metadata, protectedFields = new Set(), expectedFieldCount = null) {
  const spans = numericRowSpans(ref, metadata, protectedFields, expectedFieldCount);
  return spans ? { status: 'PASS', blockers: [], spans } : blocked(`NUMERIC_FIELD_ROW_INVALID:${metadata.fieldPrefix}`);
}

export function elementMutableFieldSpans(elementBlock) {
  if (!elementBlock?.refs || elementBlock.refs.length !== 15) return blocked('ELEMENT_FIELD_BLOCK_15_ROWS_REQUIRED');
  const spans = [];
  for (let rowIndex = 0; rowIndex <= 8; rowIndex += 1) {
    const protectedFields = rowIndex === 0 ? new Set([0, 1]) : new Set();
    const parsed = requireNumeric(elementBlock.refs[rowIndex], {
      section: 'ELEMENTS', rowIndex, elementIndex: elementBlock.index, fieldPrefix: `ELEMENT_R${rowIndex + 1}`,
    }, protectedFields, ELEMENT_NUMERIC_FIELD_COUNTS[rowIndex]);
    if (parsed.status !== 'PASS') return parsed;
    spans.push(...parsed.spans);
  }
  for (const [rowIndex, fieldPrefix] of [[9, 'ELEMENT_NAME'], [10, 'ELEMENT_LINE_NUMBER']]) {
    const parsed = lengthTextSpan(elementBlock.refs[rowIndex], {
      section: 'ELEMENTS', rowIndex, elementIndex: elementBlock.index, fieldPrefix,
    });
    if (!parsed || parsed.status !== 'PASS') return parsed || blocked(`ELEMENT_TEXT_ROW_INVALID:${rowIndex}`);
    spans.push(...parsed.spans);
  }
  const color = requireNumeric(elementBlock.refs[11], {
    section: 'ELEMENTS', rowIndex: 11, elementIndex: elementBlock.index, fieldPrefix: 'ELEMENT_LINE_COLOR_VISIBILITY',
  }, new Set(), 2);
  if (color.status !== 'PASS') return color;
  spans.push(...color.spans);
  for (let rowIndex = 12; rowIndex <= 14; rowIndex += 1) {
    const blocker = validatePointerRow(elementBlock.refs[rowIndex], rowIndex);
    if (blocker) return blocked(blocker);
  }
  return Object.freeze({ status: 'PASS', blockers: Object.freeze([]), spans: Object.freeze(spans) });
}

function parseAuxiliaryRow(block, ref, rowIndex) {
  if (!ref.body.trim()) return block === 'FLANGES'
    ? { status: 'PASS', blockers: [], spans: [] }
    : blocked(`AUX_FIELD_ROW_BLANK_UNEXPECTED:${block}:${rowIndex}`);
  const expectedFieldCount = AUX_NUMERIC_FIELD_COUNTS[block]?.[rowIndex] ?? null;
  const numeric = expectedFieldCount === null && AUX_NUMERIC_FIELD_COUNTS[block]
    ? null
    : numericRowSpans(ref, {
      section: block, rowIndex, fieldPrefix: `${block}_R${rowIndex + 1}`,
    }, new Set(), expectedFieldCount);
  if (numeric) return { status: 'PASS', blockers: [], spans: numeric };
  const lengthText = lengthTextSpan(ref, {
    section: block, rowIndex, fieldPrefix: `${block}_R${rowIndex + 1}_TEXT`,
  });
  if (lengthText) return lengthText;
  if (block === 'FLANGES') {
    const fixedText = fixedA40Span(ref, {
      section: block, rowIndex, fieldPrefix: `${block}_R${rowIndex + 1}_CLASS`,
    });
    if (fixedText) return fixedText;
  }
  return blocked(`AUX_FIELD_ROW_SCHEMA_UNRECOGNIZED:${block}:${rowIndex}`);
}

export function auxiliaryMutableFieldSpans(block, refs) {
  const spans = [];
  for (let rowIndex = 0; rowIndex < (refs || []).length; rowIndex += 1) {
    const parsed = parseAuxiliaryRow(block, refs[rowIndex], rowIndex);
    if (parsed.status !== 'PASS') return parsed;
    spans.push(...parsed.spans);
  }
  return Object.freeze({ status: 'PASS', blockers: Object.freeze([]), spans: Object.freeze(spans) });
}

export const _test = Object.freeze({ numericColumn, numericRowFieldCount, numericRowSpans, lengthTextSpan, fixedA40Span, validatePointerRow });
