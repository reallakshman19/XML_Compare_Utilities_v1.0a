import {
  COLUMN_CONTRACT_BLANK_POLICIES,
  COLUMN_CONTRACT_DUPLICATE_POLICIES,
  COLUMN_CONTRACT_EMIT_DEFAULTS,
  COLUMN_CONTRACT_ROLES,
  COLUMN_CONTRACT_TYPES,
  TABLE_CATEGORIZED_COLUMN_CONTRACT_SCHEMA,
  createColumnContractFromSource,
  validateColumnContract,
} from './table-categorized-column-contract.js';

export const TABLE_CATEGORIZED_COLUMN_CONTRACT_UI_SCHEMA = 'ColumnContractUi.v1';

const esc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

export function renderColumnContractBuilderHtml({ source = {}, contract = null, selectedColumnId = '', columnsConfirmed = false } = {}) {
  const safeContract = contract || createColumnContractFromSource(source);
  const selected = selectedColumnForContract(safeContract, selectedColumnId);
  const diagnostics = validateColumnContract(safeContract, source);
  const blockers = diagnostics.filter((item) => item.severity === 'BLOCKER').length;
  const warnings = diagnostics.filter((item) => item.severity === 'WARNING').length;
  const enabled = (safeContract.columns || []).filter((column) => column.enabled !== false).length;
  return `<div class="table-categorized-column-contract-builder" data-table-categorized-column-contract="${TABLE_CATEGORIZED_COLUMN_CONTRACT_SCHEMA}" data-table-categorized-column-contract-ui="${TABLE_CATEGORIZED_COLUMN_CONTRACT_UI_SCHEMA}">
    <div class="table-categorized-shell-side-card">
      <h4>Column Contract Builder</h4>
      <p>Review detected columns, rename fields, set roles/types, add derived fields, and confirm the clean field contract used by Structure Recipe Builder.</p>
      <div class="table-categorized-column-contract-summary">
        <span><b>Source:</b> ${esc(safeContract.sourceId || source.sourceId || 'S1')}</span>
        <span><b>Rows:</b> ${esc((source.rows || []).length)}</span>
        <span><b>Columns:</b> ${esc((safeContract.columns || []).length)}</span>
        <span><b>Enabled:</b> ${esc(enabled)}</span>
        <span><b>Diagnostics:</b> ${esc(blockers)} blocker(s), ${esc(warnings)} warning(s)</span>
      </div>
      <div class="table-categorized-column-contract-toolbar">
        <label>Search columns<input data-column-contract-search value=""></label>
        <label>Show<select data-column-contract-filter><option value="all">All fields</option><option value="enabled">Enabled only</option><option value="issues">With issues</option><option value="derived">Derived only</option></select></label>
        <button type="button" data-table-categorized-action="reset-column-contract">Reset detection</button>
        <button type="button" data-table-categorized-action="autosuggest-column-contract">Auto-suggest roles</button>
      </div>
      ${renderColumnGrid(safeContract, diagnostics)}
    </div>
    <div class="table-categorized-shell-side-card" data-column-contract-selected-panel>
      ${renderSelectedColumnPanel(selected, safeContract, source)}
    </div>
    <div class="table-categorized-shell-side-card">
      <h4>Derived Columns</h4>
      ${renderDerivedColumns(safeContract)}
    </div>
    <div class="table-categorized-shell-side-card" data-column-contract-diagnostics>
      <h4>Column Validation</h4>
      ${renderDiagnostics(diagnostics)}
    </div>
    <div class="table-categorized-column-contract-footer">
      <button type="button" class="is-primary" data-table-categorized-action="confirm-column-contract" ${(source.rows || []).length && blockers === 0 ? '' : 'disabled'}>Confirm Column Contract</button>
      <span>Status: ${columnsConfirmed ? 'Column contract confirmed.' : blockers ? `${blockers} blocker(s) must be fixed before confirming.` : 'Review editable fields and confirm.'}</span>
    </div>
  </div>`;
}

export function selectedColumnForContract(contract = {}, selectedColumnId = '') {
  const columns = contract.columns || [];
  return columns.find((column) => column.columnId === selectedColumnId) || columns[0] || null;
}

function renderColumnGrid(contract = {}, diagnostics = []) {
  const columns = contract.columns || [];
  if (!columns.length) return '<p>No columns detected yet. Read a table first.</p>';
  return `<div class="table-categorized-column-contract-grid" data-column-contract-grid="true"><table><thead><tr><th>Use</th><th>Source Header</th><th>Field Name</th><th>Label</th><th>Type</th><th>Role</th><th>Unit</th><th>Emit</th><th>Issues</th></tr></thead><tbody>${columns.map((column) => renderColumnRow(column, diagnostics)).join('')}</tbody></table></div>`;
}

function renderColumnRow(column = {}, diagnostics = []) {
  const issues = diagnostics.filter((item) => item.details?.columnId === column.columnId);
  return `<tr data-column-contract-column-id="${esc(column.columnId)}" class="${issues.some((item) => item.severity === 'BLOCKER') ? 'has-blocker' : issues.length ? 'has-warning' : ''}"><td><input type="checkbox" data-column-contract-field="enabled" data-column-id="${esc(column.columnId)}" ${column.enabled !== false ? 'checked' : ''}></td><td><button type="button" data-table-categorized-action="select-column-contract-column" data-column-id="${esc(column.columnId)}">${esc(column.originalHeader)}</button><br><small>${esc(column.sourceColumnId)} / ${esc(column.kind)}</small></td><td><input data-column-contract-field="fieldName" data-column-id="${esc(column.columnId)}" value="${esc(column.fieldName)}"></td><td><input data-column-contract-field="label" data-column-id="${esc(column.columnId)}" value="${esc(column.label)}"></td><td><select data-column-contract-field="type" data-column-id="${esc(column.columnId)}">${optionList(COLUMN_CONTRACT_TYPES, column.type)}</select></td><td><select data-column-contract-field="role" data-column-id="${esc(column.columnId)}">${optionList(COLUMN_CONTRACT_ROLES, column.role)}</select></td><td><input data-column-contract-field="unit" data-column-id="${esc(column.columnId)}" value="${esc(column.unit)}"></td><td><select data-column-contract-field="emitDefault" data-column-id="${esc(column.columnId)}">${optionList(COLUMN_CONTRACT_EMIT_DEFAULTS, column.emitDefault)}</select></td><td>${issues.length ? issues.map((item) => `<span class="table-categorized-status is-${esc(item.severity.toLowerCase())}">${esc(item.code)}</span>`).join(' ') : 'OK'}</td></tr>`;
}

function renderSelectedColumnPanel(column = null, contract = {}, source = {}) {
  if (!column) return '<h4>Selected Column</h4><p>No column selected.</p>';
  const samples = column.sampleValues?.length ? column.sampleValues : sampleValuesFor(source, column);
  return `<h4>Selected Column</h4><p><b>${esc(column.label || column.fieldName)}</b></p><label>Field name<input data-column-contract-field="fieldName" data-column-id="${esc(column.columnId)}" value="${esc(column.fieldName)}"></label><label>Label<input data-column-contract-field="label" data-column-id="${esc(column.columnId)}" value="${esc(column.label)}"></label><label>Type<select data-column-contract-field="type" data-column-id="${esc(column.columnId)}">${optionList(COLUMN_CONTRACT_TYPES, column.type)}</select></label><label>Role<select data-column-contract-field="role" data-column-id="${esc(column.columnId)}">${optionList(COLUMN_CONTRACT_ROLES, column.role)}</select></label><label>Unit<input data-column-contract-field="unit" data-column-id="${esc(column.columnId)}" value="${esc(column.unit)}"></label><label>Blank policy<select data-column-contract-field="blankPolicy" data-column-id="${esc(column.columnId)}">${optionList(COLUMN_CONTRACT_BLANK_POLICIES, column.blankPolicy)}</select></label><label>Duplicate policy<select data-column-contract-field="duplicatePolicy" data-column-id="${esc(column.columnId)}">${optionList(COLUMN_CONTRACT_DUPLICATE_POLICIES, column.duplicatePolicy)}</select></label><label>Emit as<select data-column-contract-field="emitDefault" data-column-id="${esc(column.columnId)}">${optionList(COLUMN_CONTRACT_EMIT_DEFAULTS, column.emitDefault)}</select></label><p><b>Source:</b> ${esc(column.originalHeader)} / ${esc(column.sourceColumnId)}</p><p><b>Samples:</b> ${samples.map(esc).join(', ') || 'none'}</p><p><b>Used by:</b> ${contract.confirmed ? 'Confirmed FieldCatalog' : 'Pending ColumnContract'}</p>`;
}

function renderDerivedColumns(contract = {}) {
  const rules = contract.derivedColumns || [];
  if (!rules.length) return '<p>No derived columns yet.</p><button type="button" data-table-categorized-action="add-derived-column">+ Add derived column</button>';
  return `<table data-column-contract-derived-grid="true"><thead><tr><th>Enabled</th><th>Field</th><th>Source</th><th>Operation</th><th>Find</th><th>Replace</th></tr></thead><tbody>${rules.map((rule) => `<tr data-derived-rule-id="${esc(rule.ruleId)}"><td><input type="checkbox" data-derived-contract-field="enabled" data-derived-rule-id="${esc(rule.ruleId)}" ${rule.enabled !== false ? 'checked' : ''}></td><td><input data-derived-contract-field="fieldName" data-derived-rule-id="${esc(rule.ruleId)}" value="${esc(rule.fieldName)}"></td><td><input data-derived-contract-field="sourceColumn" data-derived-rule-id="${esc(rule.ruleId)}" value="${esc(rule.sourceColumn)}"></td><td>${esc(rule.operation)}</td><td>${esc(rule.find)}</td><td>${esc(rule.replaceWith)}</td></tr>`).join('')}</tbody></table><button type="button" data-table-categorized-action="add-derived-column">+ Add derived column</button>`;
}

function renderDiagnostics(diagnostics = []) {
  if (!diagnostics.length) return '<p>No blockers or warnings. Column contract is ready to confirm.</p>';
  return `<ul>${diagnostics.slice(0, 20).map((item) => `<li><b>${esc(item.severity)}</b> ${esc(item.code)} — ${esc(item.message)}</li>`).join('')}</ul>`;
}

function optionList(options = [], selected = '') {
  return options.map((value) => `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(value)}</option>`).join('');
}

function sampleValuesFor(source = {}, column = {}) {
  const values = (source.rows || []).map((row) => row.rawByColumnId?.[column.sourceColumnId] ?? row.rawByHeader?.[column.originalHeader] ?? '').filter(Boolean);
  return [...new Set(values)].slice(0, 5);
}
