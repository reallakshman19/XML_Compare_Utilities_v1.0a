export const TABLE_CATEGORIZED_FIELD_CATALOG_SCHEMA = 'FieldCatalog.v1';

const BOOLEAN_VALUES = new Set(['true', 'false', 'yes', 'no', 'y', 'n', '1', '0']);
const NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:\s*[A-Za-z%]+)?$/;
const UNIT_PATTERN = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)\s*([A-Za-z%]+)$/;
const KEY_HINT = /(^|[_\s-])(id|key|ps\s*no|line\s*no|node|from_node|to_node)($|[_\s-])/i;
const GROUP_HINT = /(type|class|rating|status|category|family|system|area|zone)/i;

export function buildFieldCatalog(input = []) {
  const sources = Array.isArray(input) ? input : [input].filter(Boolean);
  const fields = sources.flatMap((source) => sourceFields(source));
  return Object.freeze({
    schema: TABLE_CATEGORIZED_FIELD_CATALOG_SCHEMA,
    sourceIds: Object.freeze(sources.map((source) => source.sourceId).filter(Boolean)),
    fields: Object.freeze(fields),
    diagnostics: Object.freeze(fields.flatMap((field) => field.diagnostics || [])),
  });
}

export function fieldIdFor(sourceId = '', columnId = '') {
  return `${safeId(sourceId || 'S1')}.${safeId(columnId || 'column')}`;
}

export function inferFieldType(values = []) {
  const nonBlank = values.map((value) => String(value ?? '').trim()).filter(Boolean);
  if (!nonBlank.length) return Object.freeze({ type: 'text', unit: '', diagnostics: [diag('WARNING', 'field_values_empty', 'Field has no non-blank values.')] });
  if (nonBlank.every((value) => BOOLEAN_VALUES.has(value.toLowerCase()))) return Object.freeze({ type: 'boolean', unit: '', diagnostics: [] });
  const numeric = nonBlank.every((value) => NUMBER_PATTERN.test(value));
  if (numeric) return Object.freeze({ type: 'number', unit: commonUnit(nonBlank), diagnostics: [] });
  const someNumeric = nonBlank.some((value) => NUMBER_PATTERN.test(value));
  return Object.freeze({ type: 'text', unit: '', diagnostics: someNumeric ? [diag('INFO', 'field_mixed_numeric_text', 'Mixed numeric/text values kept as text.')] : [] });
}

export function inferFieldRole({ header = '', type = 'text', uniqueCount = 0, rowCount = 0, index = 0 } = {}) {
  if (index === 0 && type === 'text' && uniqueCount > 0 && uniqueCount === rowCount) return 'key';
  if (KEY_HINT.test(header) && type !== 'number') return 'key';
  if (type === 'number') return 'measure';
  if (type === 'text' && GROUP_HINT.test(header)) return 'group';
  if (type === 'text' && rowCount > 1 && uniqueCount > 0 && uniqueCount <= Math.max(8, Math.ceil(rowCount * 0.2))) return 'group';
  return 'attribute';
}

export function resolverForField({ type = 'text', sourceId = '', columnId = '' } = {}) {
  const op = type === 'number' ? 'numberParser' : type === 'boolean' ? 'booleanParser' : 'trim';
  return Object.freeze({ op, sourceId, column: columnId });
}

function sourceFields(source = {}) {
  const headers = source.headers || [];
  const columnIds = source.columnIds || headers;
  const rulesByColumn = new Map((source.transformRules || []).map((rule) => [rule.newColumn, rule]));
  return headers.map((header, index) => createField(source, header, columnIds[index] || header, index, rulesByColumn.get(header)));
}

function createField(source, header, columnId, index, rule) {
  const values = (source.rows || []).map((row) => readValue(row, header, columnId, index));
  const nonBlank = values.map((value) => String(value ?? '').trim()).filter(Boolean);
  const typeInfo = inferFieldType(values);
  const sampleValues = [...new Set(nonBlank)].slice(0, 5);
  const uniqueCount = new Set(nonBlank).size;
  const blankCount = values.length - nonBlank.length;
  const baseDiagnostics = blankCount > Math.max(0, values.length / 2) ? [diag('WARNING', 'field_blank_heavy', 'Field has many blank values.')] : [];
  const role = inferFieldRole({ header, type: typeInfo.type, uniqueCount, rowCount: values.length, index });
  return Object.freeze({
    fieldId: fieldIdFor(source.sourceId, columnId),
    sourceId: source.sourceId || 'S1',
    columnId,
    header,
    label: labelFor(header),
    kind: rule ? 'derived' : 'source',
    type: typeInfo.type,
    role,
    unit: typeInfo.unit,
    sampleValues: Object.freeze(sampleValues),
    uniqueCount,
    blankCount,
    rowCount: values.length,
    resolver: resolverForField({ type: typeInfo.type, sourceId: source.sourceId || 'S1', columnId }),
    sourceColumn: rule?.sourceColumn || '',
    transformRuleId: rule?.ruleId || '',
    diagnostics: Object.freeze([...baseDiagnostics, ...typeInfo.diagnostics].map((item) => ({ ...item, fieldId: fieldIdFor(source.sourceId, columnId) }))),
  });
}

function readValue(row = {}, header = '', columnId = '', index = 0) {
  if (row.rawByColumnId && columnId in row.rawByColumnId) return row.rawByColumnId[columnId];
  if (row.rawByHeader && header in row.rawByHeader) return row.rawByHeader[header];
  return (row.rawCells || [])[index] ?? '';
}

function commonUnit(values) {
  const units = values.map((value) => String(value).trim().match(UNIT_PATTERN)?.[1] || '').filter(Boolean);
  return units.length && units.every((unit) => unit === units[0]) ? units[0] : '';
}

function safeId(value) {
  return String(value || '').trim().replace(/[^A-Za-z0-9_.-]+/g, '_') || 'field';
}

function labelFor(header) {
  return String(header || '').replaceAll('_', ' ').trim() || 'Field';
}

function diag(severity, code, message) {
  return Object.freeze({ severity, code, message });
}
