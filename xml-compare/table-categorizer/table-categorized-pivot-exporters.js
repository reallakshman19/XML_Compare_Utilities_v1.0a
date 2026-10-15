export const TABLE_CATEGORIZED_PIVOT_EXPORTERS_SCHEMA = 'table-categorized-pivot-exporters/v1';

export function exportPivotViewModelJson(viewModel = null) {
  const diagnostics = validatePivotViewModel(viewModel);
  if (hasBlockers(diagnostics)) return artifact('', diagnostics, 'application/json');
  return artifact(`${JSON.stringify(stableJsonModel(viewModel), null, 2)}\n`, diagnostics, 'application/json');
}

export function exportPivotViewModelCsv(viewModel = null) {
  const diagnostics = validatePivotViewModel(viewModel);
  if (hasBlockers(diagnostics)) return artifact('', diagnostics, 'text/csv');
  const rows = [csvHeader(viewModel), ...dataRows(viewModel), ...totalRows(viewModel)];
  return artifact(`${rows.map(csvLine).join('\n')}\n`, diagnostics, 'text/csv');
}

export function exportPivotViewModelHtmlPreview(viewModel = null) {
  const diagnostics = validatePivotViewModel(viewModel);
  if (hasBlockers(diagnostics)) return artifact('', diagnostics, 'text/html');
  const header = `<tr>${csvHeader(viewModel).map((item) => `<th>${esc(item)}</th>`).join('')}</tr>`;
  const body = [...dataRows(viewModel), ...totalRows(viewModel)].map((row) => `<tr>${row.map((item) => `<td>${esc(format(item))}</td>`).join('')}</tr>`).join('');
  return artifact(`<table data-pivot-preview-schema="PivotViewModel.v1"><thead>${header}</thead><tbody>${body}</tbody></table>`, diagnostics, 'text/html');
}

export function exportPivotViewModelArtifacts(viewModel = null) {
  return Object.freeze({ json: exportPivotViewModelJson(viewModel), csv: exportPivotViewModelCsv(viewModel), html: exportPivotViewModelHtmlPreview(viewModel) });
}

export function validatePivotViewModel(viewModel = null) {
  const out = [];
  if (!viewModel || typeof viewModel !== 'object') out.push(blocker('pivot_view_model_missing', 'PivotViewModel.v1 input is required.'));
  else {
    if (viewModel.schema !== 'PivotViewModel.v1') out.push(blocker('pivot_view_model_schema_invalid', 'Expected PivotViewModel.v1 schema.'));
    for (const name of ['columns', 'rows', 'valueFields']) if (!Array.isArray(viewModel[name])) out.push(blocker('pivot_view_model_shape_invalid', `${name} must be an array.`, name));
  }
  return Object.freeze(out);
}

function stableJsonModel(vm) {
  return {
    schema: vm.schema,
    rowFields: vm.rowFields || [],
    columnFields: vm.columnFields || [],
    valueFields: vm.valueFields || [],
    columns: (vm.columns || []).map((column) => ({ columnKey: column.columnKey, label: column.label, values: column.values || [] })),
    rows: (vm.rows || []).map(jsonRow),
    totals: jsonTotals(vm.totals || {}),
    diagnostics: vm.diagnostics || [],
  };
}

function jsonRow(row) {
  return { rowKey: row.rowKey, label: row.label, values: row.values || [], cells: (row.cells || []).map(jsonCell) };
}

function jsonCell(cell) {
  return { columnKey: cell.columnKey, sourceRefs: cell.sourceRefs || [], values: cell.values || [] };
}

function jsonTotals(totals) {
  return { grand: totals.grand || [], rows: totals.rows || [], columns: totals.columns || [] };
}

function csvHeader(vm) {
  return ['Row', ...cellHeaders(vm), ...sourceHeaders(vm), ...rowTotalHeaders(vm)];
}

function cellHeaders(vm) {
  return (vm.columns || []).flatMap((column) => (vm.valueFields || []).map((value) => `${column.label} | ${value.label}`));
}

function sourceHeaders(vm) {
  return (vm.columns || []).map((column) => `${column.label} | SourceRefs`);
}

function rowTotalHeaders(vm) {
  return (vm.valueFields || []).map((value) => `Row Total | ${value.label}`);
}

function dataRows(vm) {
  return (vm.rows || []).map((row) => [row.label, ...cellValues(row, vm), ...cellRefs(row), ...rowTotals(row, vm)]);
}

function cellValues(row, vm) {
  return (row.cells || []).flatMap((cell) => (vm.valueFields || []).map((value) => valueFrom(cell.values, value.valueId)));
}

function cellRefs(row) {
  return (row.cells || []).map((cell) => (cell.sourceRefs || []).join(' '));
}

function rowTotals(row, vm) {
  const total = (vm.totals?.rows || []).find((item) => item.rowKey === row.rowKey);
  return (vm.valueFields || []).map((value) => valueFrom(total?.values, value.valueId));
}

function totalRows(vm) {
  return [...columnTotalRows(vm), grandTotalRow(vm)];
}

function columnTotalRows(vm) {
  return (vm.columns || []).map((column) => {
    const total = (vm.totals?.columns || []).find((item) => item.columnKey === column.columnKey);
    const cells = (vm.columns || []).flatMap((current) => (vm.valueFields || []).map((value) => current.columnKey === column.columnKey ? valueFrom(total?.values, value.valueId) : ''));
    return [`Column Total | ${column.label}`, ...cells, ...(vm.columns || []).map(() => ''), ...blankRowTotals(vm)];
  });
}

function grandTotalRow(vm) {
  const cells = (vm.columns || []).flatMap(() => (vm.valueFields || []).map(() => ''));
  const totals = (vm.valueFields || []).map((value) => valueFrom(vm.totals?.grand, value.valueId));
  return ['Grand Total', ...cells, ...(vm.columns || []).map(() => ''), ...totals];
}

function blankRowTotals(vm) {
  return (vm.valueFields || []).map(() => '');
}

function valueFrom(values = [], valueId = '') {
  return (values || []).find((item) => item.valueId === valueId)?.value ?? '';
}

function csvLine(values) {
  return values.map(csvCell).join(',');
}

function csvCell(value) {
  const text = format(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function format(value) {
  if (Array.isArray(value)) return value.join('; ');
  if (value == null) return '';
  return String(value);
}

function artifact(text, diagnostics, mimeType) {
  return Object.freeze({ ok: !hasBlockers(diagnostics), text, mimeType, diagnostics: Object.freeze(diagnostics) });
}

function hasBlockers(diagnostics = []) {
  return diagnostics.some((item) => item.severity === 'BLOCKER');
}

function blocker(code, message, ref = '') {
  return Object.freeze({ gate: code, severity: 'BLOCKER', status: 'FAIL', code, message, ref });
}

function esc(value) {
  return format(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
