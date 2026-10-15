import { buildFieldCatalog } from './table-categorized-field-catalog.js';

export const TABLE_CATEGORIZED_COLUMN_CONTRACT_SCHEMA = 'ColumnContract.v1';

export const COLUMN_CONTRACT_TYPES = Object.freeze(['text', 'number', 'boolean', 'date', 'unit-number', 'coordinate', 'enum', 'xml-name', 'id']);
export const COLUMN_CONTRACT_ROLES = Object.freeze(['key', 'group', 'attribute', 'measure', 'coord-x', 'coord-y', 'coord-z', 'xml-tag', 'xml-attribute', 'display', 'join-key', 'ignore']);
export const COLUMN_CONTRACT_BLANK_POLICIES = Object.freeze(['allow', 'warn', 'block']);
export const COLUMN_CONTRACT_DUPLICATE_POLICIES = Object.freeze(['allow', 'warn', 'block']);
export const COLUMN_CONTRACT_EMIT_DEFAULTS = Object.freeze(['child-element', 'attribute', 'text', 'none']);

const TYPE_SET = new Set(COLUMN_CONTRACT_TYPES);
const ROLE_SET = new Set(COLUMN_CONTRACT_ROLES);
const BLANK_POLICY_SET = new Set(COLUMN_CONTRACT_BLANK_POLICIES);
const DUPLICATE_POLICY_SET = new Set(COLUMN_CONTRACT_DUPLICATE_POLICIES);
const EMIT_DEFAULT_SET = new Set(COLUMN_CONTRACT_EMIT_DEFAULTS);
const FIELD_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const XML_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:\s*[A-Za-z%]+)?$/;

const clean = (value) => String(value ?? '').trim();
const freeze = (value) => Object.freeze(value);
const diag = (severity, code, message, details = {}) => freeze({ severity, code, message, details: freeze({ ...details }) });
const safeFieldName = (value, fallback = 'field') => clean(value).replace(/[^A-Za-z0-9_]+/g, '_').replace(/^([^A-Za-z_])/, '_$1') || fallback;

export function createColumnContractFromSource(source = {}, patch = {}) {
  const catalog = buildFieldCatalog([source]);
  const byColumnId = new Map((patch.columns || []).map((column) => [column.columnId || column.sourceColumnId || column.originalHeader, column]));
  const byHeader = new Map((patch.columns || []).map((column) => [column.originalHeader || column.sourceColumnId || column.columnId, column]));
  const columns = catalog.fields.map((field, index) => createContractColumn(field, index, byColumnId.get(field.columnId) || byHeader.get(field.header) || {}));
  const derivedColumns = (source.transformRules || []).map((rule, index) => normalizeDerivedColumnRule(rule, index));
  const contract = freeze({
    schema: TABLE_CATEGORIZED_COLUMN_CONTRACT_SCHEMA,
    sourceId: source.sourceId || patch.sourceId || 'S1',
    sourceName: source.sourceName || patch.sourceName || '',
    confirmed: Boolean(patch.confirmed),
    columns: freeze(columns),
    derivedColumns: freeze(derivedColumns),
    diagnostics: freeze([]),
  });
  return freeze({ ...contract, diagnostics: freeze(validateColumnContract(contract, source)) });
}

export function updateColumnContractField(contract = {}, columnId = '', patch = {}) {
  return freeze({
    ...contract,
    confirmed: false,
    columns: freeze((contract.columns || []).map((column) => column.columnId === columnId ? normalizeContractColumn({ ...column, ...patch }) : column)),
  });
}

export function updateColumnContractDerivedRule(contract = {}, ruleId = '', patch = {}) {
  return freeze({
    ...contract,
    confirmed: false,
    derivedColumns: freeze((contract.derivedColumns || []).map((rule) => rule.ruleId === ruleId ? normalizeDerivedColumnRule({ ...rule, ...patch }) : rule)),
  });
}

export function validateColumnContract(contract = {}, source = {}) {
  const diagnostics = [];
  if (contract.schema !== TABLE_CATEGORIZED_COLUMN_CONTRACT_SCHEMA) diagnostics.push(diag('BLOCKER', 'column_contract_schema_invalid', 'Column contract schema is invalid.', { schema: contract.schema }));
  const headers = new Set(source.headers || []);
  const columnIds = new Set(source.columnIds || []);
  const enabled = (contract.columns || []).filter((column) => column.enabled !== false);
  const names = new Map();
  for (const column of enabled) {
    if (!column.fieldName || !FIELD_NAME_PATTERN.test(column.fieldName)) diagnostics.push(diag('BLOCKER', 'column_field_name_invalid', `Invalid field name: ${column.fieldName || '(blank)'}`, { columnId: column.columnId, fieldName: column.fieldName }));
    if (names.has(column.fieldName)) diagnostics.push(diag('BLOCKER', 'column_field_name_duplicate', `Duplicate field name: ${column.fieldName}`, { columnId: column.columnId, firstColumnId: names.get(column.fieldName), fieldName: column.fieldName }));
    else names.set(column.fieldName, column.columnId);
    if (!TYPE_SET.has(column.type)) diagnostics.push(diag('BLOCKER', 'column_type_invalid', `Invalid column type: ${column.type}`, { columnId: column.columnId, type: column.type }));
    if (!ROLE_SET.has(column.role)) diagnostics.push(diag('BLOCKER', 'column_role_invalid', `Invalid column role: ${column.role}`, { columnId: column.columnId, role: column.role }));
    if (!BLANK_POLICY_SET.has(column.blankPolicy)) diagnostics.push(diag('BLOCKER', 'column_blank_policy_invalid', `Invalid blank policy: ${column.blankPolicy}`, { columnId: column.columnId, blankPolicy: column.blankPolicy }));
    if (!DUPLICATE_POLICY_SET.has(column.duplicatePolicy)) diagnostics.push(diag('BLOCKER', 'column_duplicate_policy_invalid', `Invalid duplicate policy: ${column.duplicatePolicy}`, { columnId: column.columnId, duplicatePolicy: column.duplicatePolicy }));
    if (!EMIT_DEFAULT_SET.has(column.emitDefault)) diagnostics.push(diag('BLOCKER', 'column_emit_default_invalid', `Invalid emit default: ${column.emitDefault}`, { columnId: column.columnId, emitDefault: column.emitDefault }));
    if (!headers.has(column.originalHeader) && !columnIds.has(column.sourceColumnId)) diagnostics.push(diag('BLOCKER', 'column_source_missing', `Source column is missing: ${column.originalHeader || column.sourceColumnId}`, { columnId: column.columnId, originalHeader: column.originalHeader, sourceColumnId: column.sourceColumnId }));
    if ((column.role === 'xml-tag' || column.role === 'xml-attribute') && !XML_NAME_PATTERN.test(column.fieldName || '')) diagnostics.push(diag('BLOCKER', 'column_xml_name_invalid', `XML-facing field name is invalid: ${column.fieldName}`, { columnId: column.columnId, fieldName: column.fieldName, role: column.role }));
    const stats = columnStats(source, column);
    if (column.blankPolicy === 'block' && stats.blankCount > 0) diagnostics.push(diag('BLOCKER', 'column_blank_policy_blocked', `Field has blank values: ${column.fieldName}`, { columnId: column.columnId, blankCount: stats.blankCount }));
    else if (column.blankPolicy === 'warn' && stats.blankCount > 0) diagnostics.push(diag('WARNING', 'column_blank_values', `Field has blank values: ${column.fieldName}`, { columnId: column.columnId, blankCount: stats.blankCount }));
    if ((column.role === 'key' || column.role === 'join-key') && column.duplicatePolicy === 'block' && stats.duplicateCount > 0) diagnostics.push(diag('BLOCKER', 'column_duplicate_key_blocked', `Key field has duplicate values: ${column.fieldName}`, { columnId: column.columnId, duplicateCount: stats.duplicateCount }));
    else if ((column.role === 'key' || column.role === 'join-key') && stats.duplicateCount > 0) diagnostics.push(diag('WARNING', 'column_duplicate_key_values', `Key field has duplicate values: ${column.fieldName}`, { columnId: column.columnId, duplicateCount: stats.duplicateCount }));
    if ((column.type === 'number' || column.type === 'unit-number' || column.type === 'coordinate') && stats.nonNumericCount > 0) diagnostics.push(diag('BLOCKER', 'column_number_parse_failed', `Numeric field has non-numeric values: ${column.fieldName}`, { columnId: column.columnId, nonNumericCount: stats.nonNumericCount }));
  }
  for (const rule of contract.derivedColumns || []) {
    if (!rule.enabled) continue;
    if (!rule.fieldName || !FIELD_NAME_PATTERN.test(rule.fieldName)) diagnostics.push(diag('BLOCKER', 'derived_column_name_invalid', `Invalid derived column name: ${rule.fieldName || '(blank)'}`, { ruleId: rule.ruleId, fieldName: rule.fieldName }));
    if (!headers.has(rule.sourceColumn) && !columnIds.has(rule.sourceColumn)) diagnostics.push(diag('BLOCKER', 'derived_column_source_missing', `Derived column source is missing: ${rule.sourceColumn}`, { ruleId: rule.ruleId, sourceColumn: rule.sourceColumn, fieldName: rule.fieldName }));
  }
  return freeze(diagnostics);
}

export function confirmColumnContract(contract = {}, source = {}) {
  const diagnostics = validateColumnContract(contract, source);
  return freeze({ ...contract, confirmed: !diagnostics.some((d) => d.severity === 'BLOCKER'), diagnostics });
}

export function createConfirmedFieldCatalog(source = {}, contract = createColumnContractFromSource(source)) {
  const catalog = buildFieldCatalog([source]);
  const fieldsByColumnId = new Map(catalog.fields.map((field) => [field.columnId, field]));
  const fieldsByHeader = new Map(catalog.fields.map((field) => [field.header, field]));
  const fields = (contract.columns || []).filter((column) => column.enabled !== false).map((column) => {
    const base = fieldsByColumnId.get(column.sourceColumnId) || fieldsByHeader.get(column.originalHeader) || {};
    return freeze({
      ...base,
      fieldId: `${contract.sourceId || base.sourceId || 'S1'}.${column.fieldName}`,
      columnId: column.sourceColumnId || base.columnId,
      header: column.originalHeader || base.header,
      label: column.label || column.fieldName,
      type: column.type,
      role: column.role === 'ignore' ? 'attribute' : column.role,
      unit: column.unit,
      resolver: { ...(base.resolver || {}), sourceId: contract.sourceId || base.sourceId || 'S1', column: column.sourceColumnId || base.columnId },
      columnContract: freeze({ fieldName: column.fieldName, enabled: column.enabled, role: column.role, emitDefault: column.emitDefault }),
    });
  });
  return freeze({ schema: catalog.schema, sourceIds: freeze([contract.sourceId || source.sourceId || 'S1']), fields: freeze(fields), diagnostics: freeze(validateColumnContract(contract, source)) });
}

function createContractColumn(field, index, patch = {}) {
  const inferredType = field.unit && field.type === 'number' ? 'unit-number' : field.type;
  return normalizeContractColumn({
    columnId: field.columnId || field.header || `column_${index + 1}`,
    sourceColumnId: field.columnId || field.header || `column_${index + 1}`,
    originalHeader: field.header || field.columnId || `Column ${index + 1}`,
    fieldName: safeFieldName(patch.fieldName || field.header || field.columnId || `field_${index + 1}`, `field_${index + 1}`),
    label: patch.label || field.label || field.header || field.columnId || `Field ${index + 1}`,
    enabled: patch.enabled !== false,
    type: TYPE_SET.has(patch.type) ? patch.type : TYPE_SET.has(inferredType) ? inferredType : 'text',
    role: ROLE_SET.has(patch.role) ? patch.role : mapInferredRole(field.role),
    unit: patch.unit ?? field.unit ?? '',
    kind: field.kind || 'source',
    sourceColumn: field.sourceColumn || '',
    transformRuleId: field.transformRuleId || '',
    sampleValues: field.sampleValues || [],
    uniqueCount: field.uniqueCount || 0,
    blankCount: field.blankCount || 0,
    rowCount: field.rowCount || 0,
    blankPolicy: patch.blankPolicy || (field.blankCount ? 'warn' : 'allow'),
    duplicatePolicy: patch.duplicatePolicy || (field.role === 'key' ? 'warn' : 'allow'),
    emitDefault: patch.emitDefault || defaultEmitForRole(field.role),
    ...patch,
  });
}

function normalizeContractColumn(column = {}) {
  return freeze({
    columnId: clean(column.columnId || column.sourceColumnId || column.originalHeader),
    sourceColumnId: clean(column.sourceColumnId || column.columnId || column.originalHeader),
    originalHeader: clean(column.originalHeader || column.sourceColumnId || column.columnId),
    fieldName: clean(column.fieldName),
    label: clean(column.label || column.fieldName),
    enabled: column.enabled !== false,
    type: TYPE_SET.has(column.type) ? column.type : 'text',
    role: ROLE_SET.has(column.role) ? column.role : 'attribute',
    unit: clean(column.unit),
    kind: clean(column.kind || 'source'),
    sourceColumn: clean(column.sourceColumn),
    transformRuleId: clean(column.transformRuleId),
    sampleValues: freeze([...(column.sampleValues || [])]),
    uniqueCount: Number(column.uniqueCount || 0),
    blankCount: Number(column.blankCount || 0),
    rowCount: Number(column.rowCount || 0),
    blankPolicy: BLANK_POLICY_SET.has(column.blankPolicy) ? column.blankPolicy : 'allow',
    duplicatePolicy: DUPLICATE_POLICY_SET.has(column.duplicatePolicy) ? column.duplicatePolicy : 'allow',
    emitDefault: EMIT_DEFAULT_SET.has(column.emitDefault) ? column.emitDefault : 'child-element',
  });
}

function normalizeDerivedColumnRule(rule = {}, index = 0) {
  const fieldName = safeFieldName(rule.fieldName || rule.newColumn || `derived_${index + 1}`, `derived_${index + 1}`);
  return freeze({
    ruleId: clean(rule.ruleId) || `derived_${index + 1}`,
    enabled: rule.enabled !== false,
    fieldName,
    label: clean(rule.label || rule.newColumn || fieldName),
    sourceColumn: clean(rule.sourceColumn),
    operation: clean(rule.operation || 'trim'),
    find: String(rule.find ?? ''),
    replaceWith: String(rule.replaceWith ?? ''),
    type: TYPE_SET.has(rule.type) ? rule.type : 'text',
    role: ROLE_SET.has(rule.role) ? rule.role : 'attribute',
  });
}

function mapInferredRole(role = '') {
  if (role === 'measure') return 'measure';
  if (role === 'group') return 'group';
  if (role === 'key') return 'key';
  return 'attribute';
}

function defaultEmitForRole(role = '') {
  if (role === 'key') return 'attribute';
  if (role === 'ignore') return 'none';
  return 'child-element';
}

function columnStats(source = {}, column = {}) {
  const values = (source.rows || []).map((row) => readValue(row, column));
  const nonBlank = values.map((value) => clean(value)).filter(Boolean);
  const counts = new Map();
  for (const value of nonBlank) counts.set(value, (counts.get(value) || 0) + 1);
  const duplicateCount = [...counts.values()].filter((count) => count > 1).reduce((sum, count) => sum + count - 1, 0);
  const nonNumericCount = nonBlank.filter((value) => !NUMBER_PATTERN.test(value)).length;
  return freeze({ blankCount: values.length - nonBlank.length, duplicateCount, nonNumericCount });
}

function readValue(row = {}, column = {}) {
  if (row.rawByColumnId && column.sourceColumnId in row.rawByColumnId) return row.rawByColumnId[column.sourceColumnId];
  if (row.rawByHeader && column.originalHeader in row.rawByHeader) return row.rawByHeader[column.originalHeader];
  if (row.rawByHeader && column.sourceColumnId in row.rawByHeader) return row.rawByHeader[column.sourceColumnId];
  return '';
}
