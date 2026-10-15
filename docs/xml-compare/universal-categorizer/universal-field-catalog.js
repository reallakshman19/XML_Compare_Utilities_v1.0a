export const UNIVERSAL_FIELD_CATALOG_SCHEMA = 'universal-field-catalog/v1-shadow';

const freeze = (value) => Object.freeze(value);
const arr = (value) => Array.isArray(value) ? value : [];
const text = (value, fallback = '') => String(value ?? fallback).trim();

export function normalizeUniversalFieldName(value) {
  return text(value);
}

export function parseUniversalKeyFields(expression) {
  const raw = text(expression);
  if (!raw) return freeze([]);
  return freeze(raw.split('+').map(normalizeUniversalFieldName).filter(Boolean));
}

export function collectUniversalRowColumns(rows = []) {
  const names = [];
  for (const row of arr(rows)) {
    if (!row || typeof row !== 'object') continue;
    for (const key of Object.keys(row)) {
      const normalized = normalizeUniversalFieldName(key);
      if (normalized && !names.includes(normalized)) names.push(normalized);
    }
  }
  return freeze(names);
}

export function createUniversalFieldCatalog(input = {}) {
  const rows = arr(input.rows || input.previewRows || input.records);
  const declaredColumns = uniqueText([...(arr(input.columns)), ...(arr(input.declaredColumns))]);
  const inferredColumns = collectUniversalRowColumns(rows);
  const columns = uniqueText([...declaredColumns, ...inferredColumns]);
  const requiredColumns = uniqueText(arr(input.requiredColumns));
  const optionalColumns = uniqueText(arr(input.optionalColumns));
  const presentRequiredColumns = freeze(requiredColumns.filter((column) => columns.includes(column)));
  const missingRequiredColumns = freeze(requiredColumns.filter((column) => !columns.includes(column)));
  const diagnostics = freeze(missingRequiredColumns.map((column) => freeze({
    severity: 'error',
    code: 'UXC_SOURCE_REQUIRED_COLUMN_MISSING',
    sourceId: text(input.sourceId),
    column,
    message: `Required column "${column}" is missing from source "${text(input.sourceId, 'unknown')}".`,
  })));

  return freeze({
    schema: UNIVERSAL_FIELD_CATALOG_SCHEMA,
    sourceId: text(input.sourceId),
    columns,
    requiredColumns,
    optionalColumns,
    presentRequiredColumns,
    missingRequiredColumns,
    rowCount: rows.length,
    diagnostics,
  });
}

export function getUniversalRowKey(row = {}, expression = '') {
  const fields = parseUniversalKeyFields(expression);
  if (!fields.length) return '';
  return fields.map((field) => text(row?.[field])).join('+');
}

export function hasUniversalRowKey(row = {}, expression = '') {
  const fields = parseUniversalKeyFields(expression);
  if (!fields.length) return false;
  return fields.every((field) => text(row?.[field]) !== '');
}

export function uniqueText(values = []) {
  const out = [];
  for (const value of arr(values)) {
    const normalized = normalizeUniversalFieldName(value);
    if (normalized && !out.includes(normalized)) out.push(normalized);
  }
  return freeze(out);
}

export const _test = freeze({ text, arr, uniqueText });
