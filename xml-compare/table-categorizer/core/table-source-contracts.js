import { categorizedDiagnostic } from './categorized-diagnostics.js';

export const TABLE_SOURCE_CONTRACT_SCHEMA = 'table-categorizer-table-source-contract/v1';

export function validateTableSourceContract(source = {}) {
  const diagnostics = [];
  if (!String(source.sourceId || '').trim()) {
    diagnostics.push(categorizedDiagnostic('BLOCKER', 'source_id_missing', 'sourceId is required.'));
  }
  if (!Array.isArray(source.headers) || !source.headers.length) {
    diagnostics.push(categorizedDiagnostic('BLOCKER', 'source_headers_missing', 'At least one source header is required.'));
  }
  if (!Array.isArray(source.rows)) {
    diagnostics.push(categorizedDiagnostic('BLOCKER', 'source_rows_missing', 'rows must be an array.'));
  }
  for (const row of source.rows || []) {
    if (!row.rowId) diagnostics.push(categorizedDiagnostic('ERROR', 'source_row_id_missing', 'Every row needs a rowId.'));
    if (!row.rawByHeader || typeof row.rawByHeader !== 'object') {
      diagnostics.push(categorizedDiagnostic('ERROR', 'source_row_fields_missing', 'Every row needs rawByHeader fields.', row.rowId));
    }
  }
  return result(diagnostics);
}

function result(diagnostics) {
  return Object.freeze({ ok: !diagnostics.some((item) => item.severity === 'BLOCKER' || item.severity === 'ERROR'), diagnostics: Object.freeze(diagnostics) });
}
