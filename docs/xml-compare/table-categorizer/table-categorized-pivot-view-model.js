import { aggregatePivotValues } from './table-categorized-pivot-aggregators.js';
import { normalizePivotSpec, validatePivotSpec } from './table-categorized-pivot-spec-contracts.js';

export const TABLE_CATEGORIZED_PIVOT_VIEW_MODEL_SCHEMA = 'PivotViewModel.v1';

export function buildPivotViewModel({ graph = null, pivotSpec = null, fieldCatalog = null } = {}) {
  const diagnostics = [...inputDiagnostics(graph, pivotSpec, fieldCatalog)];
  const spec = normalizePivotSpec(pivotSpec || {});
  if (fieldCatalog?.fields) diagnostics.push(...validatePivotSpec(spec, fieldCatalog));
  const fields = fieldMap(fieldCatalog);
  const records = graphRecords(graph, [...fields.values()]).filter((record) => passesFilters(record, pivotSpec?.filters || [], fields));
  const rowGroups = groupRecords(records, spec.rows, fields);
  const columnGroups = groupRecords(records, spec.columns, fields);
  const values = spec.values.map((item) => valueField(item, fields));
  const rows = rowGroups.map((row) => buildRow(row, columnGroups, values));
  const totals = buildTotals(records, rowGroups, columnGroups, values);
  return deepFreeze({ schema: TABLE_CATEGORIZED_PIVOT_VIEW_MODEL_SCHEMA, rowFields: spec.rows, columnFields: spec.columns, valueFields: values, columns: columnGroups.map(columnOut), rows, totals, diagnostics });
}

export function fieldValueFromNode(node = {}, field = {}) {
  const f = node.fields || {};
  if (f[field.header] != null) return f[field.header];
  if (f[field.columnId] != null) return f[field.columnId];
  if (f[field.label] != null) return f[field.label];
  for (const evidence of node.evidence || []) {
    if (evidence.rawByHeader?.[field.header] != null) return evidence.rawByHeader[field.header];
    if (evidence.rawByColumnId?.[field.columnId] != null) return evidence.rawByColumnId[field.columnId];
  }
  if (field.role === 'key' && node.key != null) return node.key;
  return '';
}

function inputDiagnostics(graph, pivotSpec, fieldCatalog) {
  const out = [];
  if (!graph?.nodes) out.push(blocker('pivot_graph_missing', 'Pivot builder requires a CategorizedGraph with nodes.'));
  if (!pivotSpec) out.push(blocker('pivot_spec_missing', 'Pivot builder requires PivotSpec.v1 input.'));
  if (!fieldCatalog?.fields) out.push(blocker('pivot_field_catalog_missing', 'Pivot builder requires FieldCatalog.v1 input.'));
  return out;
}

function fieldMap(fieldCatalog = {}) {
  return new Map((fieldCatalog?.fields || []).map((field) => [field.fieldId, field]));
}

function graphRecords(graph, fields) {
  return (graph?.nodes || []).map((node, index) => ({
    index,
    nodeId: node.id,
    sourceRefs: Object.freeze([...(node.sourceRefs || [])]),
    values: Object.freeze(Object.fromEntries(fields.map((field) => [field.fieldId, fieldValueFromNode(node, field)]))),
  }));
}

function passesFilters(record, filters, fields) {
  return (Array.isArray(filters) ? filters : []).every((filter) => filterPass(record, filter, fields));
}

function filterPass(record, filter, fields) {
  const field = fields.get(filter?.fieldId);
  if (!field) return false;
  const value = text(record.values[field.fieldId]);
  if (Array.isArray(filter.values)) return filter.values.map(text).includes(value);
  if ('equals' in filter) return value === text(filter.equals);
  if ('value' in filter) return value === text(filter.value);
  if ('notEquals' in filter) return value !== text(filter.notEquals);
  if ('contains' in filter) return value.includes(text(filter.contains));
  return value !== '';
}

function groupRecords(records, refs, fields) {
  const map = new Map();
  if (!refs.length) return [{ key: '__all__', label: 'All', values: [], records }];
  for (const record of records) {
    const values = refs.map((ref) => text(record.values[ref.fieldId]));
    const key = values.join('\u001f');
    if (!map.has(key)) map.set(key, { key, label: values.join(' / ') || '(blank)', values, records: [] });
    map.get(key).records.push(record);
  }
  return [...map.values()].map((item) => ({ ...item, fields: refs.map((ref) => fields.get(ref.fieldId)?.label || ref.fieldId) }));
}

function buildRow(row, columnGroups, values) {
  return Object.freeze({ rowKey: row.key, label: row.label, values: Object.freeze(row.values), cells: Object.freeze(columnGroups.map((column) => buildCell(row.records.filter((record) => column.records.includes(record)), column, values))) });
}

function buildCell(records, column, values) {
  const sourceRefs = unique(records.flatMap((record) => record.sourceRefs));
  const cellValues = values.map((value) => aggregateFor(records, value));
  return Object.freeze({ columnKey: column.key, sourceRefs: Object.freeze(sourceRefs), values: Object.freeze(cellValues) });
}

function aggregateFor(records, value) {
  const raw = records.map((record) => record.values[value.fieldId]);
  const result = aggregatePivotValues({ aggregate: value.aggregate, values: raw, fieldId: value.fieldId });
  return Object.freeze({ valueId: value.valueId, fieldId: value.fieldId, aggregate: value.aggregate, value: result.value, diagnostics: result.diagnostics });
}

function buildTotals(records, rowGroups, columnGroups, values) {
  return Object.freeze({
    grand: Object.freeze(values.map((value) => aggregateFor(records, value))),
    rows: Object.freeze(rowGroups.map((row) => ({ rowKey: row.key, values: Object.freeze(values.map((value) => aggregateFor(row.records, value))) }))),
    columns: Object.freeze(columnGroups.map((column) => ({ columnKey: column.key, values: Object.freeze(values.map((value) => aggregateFor(column.records, value))) }))),
  });
}

function valueField(item, fields) {
  const field = fields.get(item.fieldId);
  const aggregate = item.aggregate || 'count';
  return Object.freeze({ valueId: `${item.fieldId}:${aggregate}`, fieldId: item.fieldId, aggregate, label: item.label || field?.label || item.fieldId });
}

function columnOut(column) {
  return Object.freeze({ columnKey: column.key, label: column.label, values: Object.freeze(column.values) });
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function text(value) {
  return String(value ?? '').trim();
}

function deepFreeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(deepFreeze); }
  return value;
}

function blocker(code, message, ref = '') {
  return Object.freeze({ gate: code, severity: 'BLOCKER', status: 'FAIL', code, message, ref });
}
