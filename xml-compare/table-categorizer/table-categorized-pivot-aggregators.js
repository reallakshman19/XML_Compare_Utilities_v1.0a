export const TABLE_CATEGORIZED_PIVOT_AGGREGATORS_SCHEMA = 'table-categorized-pivot-aggregators/v1';

export function aggregatePivotValues({ aggregate = 'count', values = [], fieldId = '' } = {}) {
  const nonBlank = values.filter((item) => !isBlank(item));
  const diagnostics = [];
  if (aggregate === 'count') return result(nonBlank.length);
  if (aggregate === 'countDistinct') return result(new Set(nonBlank.map(text)).size);
  if (aggregate === 'first') return result(nonBlank.length ? nonBlank[0] : '');
  if (aggregate === 'last') return result(nonBlank.length ? nonBlank[nonBlank.length - 1] : '');
  if (aggregate === 'list') return result(nonBlank.map(text));
  if (aggregate === 'listDistinct') return result([...new Set(nonBlank.map(text))]);
  const numeric = numericValues(nonBlank, fieldId, aggregate, diagnostics);
  if (aggregate === 'sum') return result(numeric.reduce((total, value) => total + value, 0), diagnostics);
  if (aggregate === 'average') return result(numeric.length ? numeric.reduce((total, value) => total + value, 0) / numeric.length : '', diagnostics);
  if (aggregate === 'min') return result(numeric.length ? Math.min(...numeric) : '', diagnostics);
  if (aggregate === 'max') return result(numeric.length ? Math.max(...numeric) : '', diagnostics);
  return result('', [diag('pivot_aggregate_unknown', `Unknown aggregate: ${aggregate}.`, fieldId)]);
}

export function isBlank(value) {
  return value == null || String(value).trim() === '';
}

function numericValues(values, fieldId, aggregate, diagnostics) {
  return values.flatMap((value) => {
    const cleaned = String(value).replace(/[^0-9.+-]/g, '');
    const parsed = cleaned ? Number(cleaned) : NaN;
    if (Number.isFinite(parsed)) return [parsed];
    diagnostics.push(diag('pivot_numeric_value_invalid', `${aggregate} ignored non-numeric value for ${fieldId}: ${value}.`, fieldId));
    return [];
  });
}

function result(value, diagnostics = []) {
  return Object.freeze({ value, diagnostics: Object.freeze(diagnostics) });
}

function text(value) {
  return String(value ?? '').trim();
}

function diag(code, message, ref = '') {
  return Object.freeze({ gate: code, severity: 'WARNING', status: 'PASS', code, message, ref });
}
