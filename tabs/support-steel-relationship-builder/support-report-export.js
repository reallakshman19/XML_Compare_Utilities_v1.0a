import {
  supportReportColumns,
  supportReportColumnHeader,
  supportReportColumnValue,
} from './support-report-contract.js?v=20260910-support-report-typicality-columns-1';

export function supportReportToCsv(bundle, options = {}) {
  const columns = supportReportColumns(bundle, options);
  const includeOrdinalRow = options.includeOrdinalRow !== false;
  const headerLabels = columns.map((column) => supportReportColumnHeader(column, options));
  const lines = [];
  if (includeOrdinalRow) lines.push(columns.map((_, index) => csvCell(index + 1)).join(','));
  lines.push(headerLabels.map(csvCell).join(','));
  for (const row of bundle?.rows || []) {
    lines.push(columns.map((column) => csvCell(supportReportColumnValue(row, column))).join(','));
  }
  return lines.join('\n');
}

export function supportReportToTsv(bundle, options = {}) {
  const columns = supportReportColumns(bundle, options);
  const includeOrdinalRow = options.includeOrdinalRow !== false;
  const lines = [];
  if (includeOrdinalRow) lines.push(columns.map((_, index) => index + 1).join('\t'));
  lines.push(columns.map((column) => tsvCell(supportReportColumnHeader(column, options))).join('\t'));
  for (const row of bundle?.rows || []) {
    lines.push(columns.map((column) => tsvCell(supportReportColumnValue(row, column))).join('\t'));
  }
  return lines.join('\n');
}

export function supportReportBundleToJson(bundle) {
  return JSON.stringify(bundle, null, 2);
}

function spreadsheetSafeText(value) {
  const text = String(value ?? '');
  return typeof value === 'string' && /^[=+\-@]/.test(text) ? `'${text}` : text;
}
function csvCell(value) {
  const text = spreadsheetSafeText(value);
  return `"${text.replace(/"/g, '""')}"`;
}
function tsvCell(value) {
  const sanitized = typeof value === 'string'
    ? value.replace(/[\t\r\n]+/g, ' ').trim()
    : value;
  return spreadsheetSafeText(sanitized);
}
