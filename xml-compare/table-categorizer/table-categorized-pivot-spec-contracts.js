export const TABLE_CATEGORIZED_PIVOT_SPEC_SCHEMA = 'PivotSpec.v1';
export const PIVOT_AGGREGATES = Object.freeze(['count', 'countDistinct', 'sum', 'min', 'max', 'average', 'first', 'last', 'list', 'listDistinct']);
export const NUMERIC_AGGREGATES = Object.freeze(['sum', 'min', 'max', 'average']);

export function normalizePivotSpec(input = {}) {
  const spec = input && typeof input === 'object' ? input : {};
  return deepFreeze({
    schema: TABLE_CATEGORIZED_PIVOT_SPEC_SCHEMA,
    filters: normalizeFieldRefs(spec.filters),
    rows: normalizeFieldRefs(spec.rows),
    columns: normalizeFieldRefs(spec.columns),
    values: normalizeValues(spec.values),
    ...(spec.layout && typeof spec.layout === 'object' ? { layout: clone(spec.layout) } : {}),
  });
}

export function validatePivotSpec(spec = {}, fieldCatalog = {}, context = {}) {
  const normalized = normalizePivotSpec(spec);
  const fieldMap = new Map((fieldCatalog.fields || []).map((field) => [field.fieldId, field]));
  const out = [];
  for (const zone of ['filters', 'rows', 'columns']) validateFieldRefs(normalized[zone], fieldMap, out, context, zone);
  if (!normalized.values.length) out.push(blocker('pivot_values_missing', 'Enabled pivot view requires at least one value field.', context.ref));
  for (const value of normalized.values) validateValue(value, fieldMap, out, context);
  return Object.freeze(out);
}

function normalizeFieldRefs(items = []) {
  return Object.freeze((Array.isArray(items) ? items : []).map((item) => typeof item === 'string' ? { fieldId: item } : item).filter(Boolean).map((item) => deepFreeze({ fieldId: clean(item.fieldId), label: clean(item.label) })));
}

function normalizeValues(values = []) {
  return Object.freeze((Array.isArray(values) ? values : []).filter(Boolean).map((item) => deepFreeze({ fieldId: clean(item.fieldId), aggregate: clean(item.aggregate || 'count'), label: clean(item.label || item.fieldId || 'Value') })));
}

function validateFieldRefs(items, fieldMap, out, context, zone) {
  for (const item of items) {
    if (!item.fieldId) out.push(blocker('pivot_field_id_missing', `${zone} entry is missing fieldId.`, context.ref));
    else if (!fieldMap.has(item.fieldId)) out.push(blocker('pivot_field_unknown', `${zone} references unknown fieldId: ${item.fieldId}.`, item.fieldId));
  }
}

function validateValue(value, fieldMap, out, context) {
  if (!value.fieldId) out.push(blocker('pivot_value_field_missing', 'Pivot value is missing fieldId.', context.ref));
  const field = fieldMap.get(value.fieldId);
  if (value.fieldId && !field) out.push(blocker('pivot_field_unknown', `Pivot value references unknown fieldId: ${value.fieldId}.`, value.fieldId));
  if (!PIVOT_AGGREGATES.includes(value.aggregate)) out.push(blocker('pivot_aggregate_invalid', `Invalid pivot aggregate: ${value.aggregate}.`, value.aggregate));
  if (field && NUMERIC_AGGREGATES.includes(value.aggregate) && field.type !== 'number') out.push(blocker('pivot_numeric_aggregate_requires_number', `${value.aggregate} requires a number field: ${value.fieldId}.`, value.fieldId));
  if (!value.label) out.push(blocker('pivot_value_label_missing', 'Pivot value is missing label.', value.fieldId || context.ref));
}

function clean(value) { return String(value ?? '').trim(); }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function deepFreeze(value) { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(deepFreeze); } return value; }
function blocker(code, message, ref = '') { return Object.freeze({ gate: code, severity: 'BLOCKER', status: 'FAIL', code, message, ref }); }
