import { SUPPORT_REVISION_CIVIL_COLUMNS } from '../../xml-compare/table-categorizer/presets/support-revision/support-revision-profile.js';

export const SUPPORT_REVISION_SCHEMA_VALIDATOR = 'support-revision-schema-validator/v1';

const REQUIRED_EXACT = Object.freeze([
  'PIPE',
  'PIPING PRIMARY SUPPORT',
  'SUPPORT TYPE',
  'PIPING PRIMARY SUPPORT REFERENCE',
]);

export function validateSupportRevisionSource(source = {}) {
  const headers = new Set(source.headers || []);
  const diagnostics = [];
  for (const column of REQUIRED_EXACT) {
    if (!headers.has(column)) diagnostics.push(blocker('support_revision_required_column_missing', `Missing required column: ${column}.`, column));
  }
  if (!SUPPORT_REVISION_CIVIL_COLUMNS.some((column) => headers.has(column))) {
    diagnostics.push(blocker(
      'support_revision_secondary_support_column_missing',
      `Missing secondary-support column. Expected one of: ${SUPPORT_REVISION_CIVIL_COLUMNS.join(', ')}.`,
      'CIVILSECONDARYSUPPORT',
    ));
  }
  return Object.freeze(diagnostics);
}

export function inferRevisionValue(source = {}) {
  const revisionColumn = (source.columnIds || []).find((id, index) => String(source.headers?.[index] || '').trim() === 'REVISION');
  if (!revisionColumn) return Object.freeze({ value: '', values: Object.freeze([]), deterministic: false });
  const values = [...new Set((source.rows || []).map((row) => String(row.rawByColumnId?.[revisionColumn] ?? '').trim()).filter(Boolean))];
  return Object.freeze({ value: values.length === 1 ? values[0] : '', values: Object.freeze(values), deterministic: values.length === 1 });
}

function blocker(code, message, ref) {
  return Object.freeze({ gate: code, severity: 'BLOCKER', status: 'FAIL', code, message, ref });
}

export const _test = Object.freeze({ REQUIRED_EXACT });
