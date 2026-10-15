import {
  SUPPORT_REPORT_COLUMNS,
  supportReportColumnValue,
} from '../../tabs/support-steel-relationship-builder/support-report-contract.js';

export const SUPPORT_REPORT_PARITY_STATUS = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  UNRESOLVED_INPUT: 'UNRESOLVED_INPUT',
});

export function buildSupportReportParityLedger({ report, oracle, columns = SUPPORT_REPORT_COLUMNS } = {}) {
  const columnDefs = normalizeColumns(columns);
  const expectedRows = normalizeOracleRows(oracle, columnDefs);
  const actualRows = Array.isArray(report?.rows) ? report.rows : [];
  const expectedIndex = indexRows(expectedRows, 'expected');
  const actualIndex = indexRows(actualRows, 'actual');
  const diagnostics = [];
  const ledger = [];

  for (const [rowKey, expectedRow] of expectedIndex) {
    const actualRow = actualIndex.get(rowKey) || null;
    if (!actualRow) diagnostics.push(diagnostic('MISSING_ACTUAL_ROW', rowKey));
    for (const column of columnDefs) {
      ledger.push(compareCell({ rowKey, column, expectedRow, actualRow }));
    }
  }

  for (const rowKey of actualIndex.keys()) {
    if (!expectedIndex.has(rowKey)) diagnostics.push(diagnostic('EXTRA_ACTUAL_ROW', rowKey));
  }

  const statusCounts = ledger.reduce((counts, cell) => {
    counts[cell.status] = (counts[cell.status] || 0) + 1;
    return counts;
  }, {});
  const summary = Object.freeze({
    expectedRowCount: expectedRows.length,
    actualRowCount: actualRows.length,
    columnCount: columnDefs.length,
    comparedCellCount: ledger.length,
    passCount: statusCounts[SUPPORT_REPORT_PARITY_STATUS.PASS] || 0,
    failCount: statusCounts[SUPPORT_REPORT_PARITY_STATUS.FAIL] || 0,
    unresolvedInputCount: statusCounts[SUPPORT_REPORT_PARITY_STATUS.UNRESOLVED_INPUT] || 0,
    missingActualRowCount: diagnostics.filter((item) => item.code === 'MISSING_ACTUAL_ROW').length,
    extraActualRowCount: diagnostics.filter((item) => item.code === 'EXTRA_ACTUAL_ROW').length,
  });
  if (summary.passCount + summary.failCount + summary.unresolvedInputCount !== summary.comparedCellCount) {
    throw new Error('Support Report parity ledger status counts do not reconcile to the compared cell count.');
  }

  return Object.freeze({
    schema: 'SupportReportParityLedger.v1',
    summary,
    ledger: Object.freeze(ledger),
    diagnostics: Object.freeze(diagnostics),
  });
}

export function normalizeSupportReportGoldenOracle(oracle, columns = SUPPORT_REPORT_COLUMNS) {
  return Object.freeze(normalizeOracleRows(oracle, normalizeColumns(columns)));
}

export function supportReportParityRowKey(row) {
  const family = canonicalFamily(row?.civilSecondarySupport);
  const pipe = canonicalText(row?.pipe);
  if (!family || !pipe) throw new Error('Support Report parity row identity requires civilSecondarySupport and pipe.');
  return `${family}::${pipe}`;
}

function compareCell({ rowKey, column, expectedRow, actualRow }) {
  const expected = cellText(expectedRow?.[column.key]);
  if (!actualRow) return parityCell({
    rowKey, column, expected, actual: '', provenance: missingRowProvenance(),
    status: SUPPORT_REPORT_PARITY_STATUS.UNRESOLVED_INPUT,
  });
  const actualRaw = supportReportColumnValue(actualRow, column);
  const actual = cellText(actualRaw);
  const provenance = actualRow?.evidence?.fieldProvenance?.[column.key] || null;
  const status = unresolvedProvenance(provenance)
    ? SUPPORT_REPORT_PARITY_STATUS.UNRESOLVED_INPUT
    : expected === actual ? SUPPORT_REPORT_PARITY_STATUS.PASS : SUPPORT_REPORT_PARITY_STATUS.FAIL;
  return parityCell({ rowKey, column, expected, actual, provenance, status });
}

function parityCell({ rowKey, column, expected, actual, provenance, status }) {
  return Object.freeze({
    rowKey,
    column: column.key,
    columnLabel: column.label,
    expected,
    actual,
    provenance: provenance ? Object.freeze({ ...provenance }) : null,
    status,
  });
}

function normalizeOracleRows(oracle, columns) {
  const rows = Array.isArray(oracle?.rows) ? oracle.rows : [];
  return rows.map((row, rowIndex) => {
    if (!Array.isArray(row)) return Object.freeze({ ...row });
    if (row.length !== columns.length) {
      throw new Error(`Support Report golden row ${rowIndex + 1} has ${row.length} cells; expected ${columns.length}.`);
    }
    return Object.freeze(Object.fromEntries(columns.map((column, columnIndex) => [column.key, row[columnIndex]])));
  });
}

function normalizeColumns(columns) {
  if (!Array.isArray(columns) || !columns.length) throw new Error('Support Report parity requires a non-empty column contract.');
  const seen = new Set();
  return columns.map((column, index) => {
    const key = String(column?.key || '').trim();
    if (!key) throw new Error(`Support Report parity column ${index + 1} has no key.`);
    if (seen.has(key)) throw new Error(`Support Report parity column key is duplicated: ${key}`);
    seen.add(key);
    return Object.freeze({ key, label: String(column?.label || key) });
  });
}

function indexRows(rows, label) {
  const index = new Map();
  for (const row of rows) {
    const rowKey = supportReportParityRowKey(row);
    if (index.has(rowKey)) throw new Error(`Support Report parity ${label} row key is duplicated: ${rowKey}`);
    index.set(rowKey, row);
  }
  return index;
}

function unresolvedProvenance(provenance) {
  const confidence = canonicalText(provenance?.confidenceClass);
  const valueStatus = canonicalText(provenance?.valueStatus);
  return confidence === 'UNRESOLVED' || confidence === 'CONFLICT'
    || valueStatus === 'UNRESOLVED' || valueStatus === 'CONFLICT';
}

function canonicalFamily(value) {
  return canonicalText(value).replace(/^\/+/, '').replace(/\(REF\)$/u, '');
}
function canonicalText(value) { return String(value ?? '').trim().toUpperCase(); }
function cellText(value) { return value == null ? '' : String(value); }
function missingRowProvenance() {
  return Object.freeze({
    sourceClass: 'MISSING_ACTUAL_ROW',
    confidenceClass: 'UNRESOLVED',
    valueStatus: 'UNRESOLVED',
    sourceIds: Object.freeze([]),
  });
}
function diagnostic(code, rowKey) { return Object.freeze({ code, rowKey }); }

export const _test = Object.freeze({
  unresolvedProvenance,
  normalizeColumns,
  normalizeOracleRows,
  cellText,
});
