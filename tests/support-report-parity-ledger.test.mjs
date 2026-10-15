import assert from 'node:assert/strict';
import test from 'node:test';
import { SUPPORT_REPORT_COLUMNS } from '../tabs/support-steel-relationship-builder/support-report-contract.js';
import {
  buildSupportReportParityLedger,
  normalizeSupportReportGoldenOracle,
  SUPPORT_REPORT_PARITY_STATUS,
  supportReportParityRowKey,
} from './helpers/support-report-parity-ledger.mjs';

function resolvedProvenance() {
  return {
    sourceClass: 'AUTHORITATIVE_TEST_SOURCE',
    confidenceClass: 'AUTHORITATIVE',
    valueStatus: 'RESOLVED',
    sourceIds: ['/TEST'],
  };
}

function unresolvedProvenance() {
  return {
    sourceClass: 'UNRESOLVED',
    confidenceClass: 'UNRESOLVED',
    valueStatus: 'UNRESOLVED',
    sourceIds: [],
  };
}

function row(index, overrides = {}, provenanceOverrides = {}) {
  const values = Object.fromEntries(SUPPORT_REPORT_COLUMNS.map((column) => [column.key, `R${index}:${column.key}`]));
  values.civilSecondarySupport = index < 5 ? 'PS-007(REF)' : 'SL-097(REF)';
  values.pipe = `ASIM-1885-PL-${index + 1}-LINE`;
  Object.assign(values, overrides);
  return {
    ...values,
    evidence: {
      fieldProvenance: Object.fromEntries(SUPPORT_REPORT_COLUMNS.map((column) => [
        column.key,
        provenanceOverrides[column.key] || resolvedProvenance(),
      ])),
    },
  };
}

function oracleRows(actualRows) {
  return actualRows.map((actual) => SUPPORT_REPORT_COLUMNS.map((column) => actual[column.key] ?? ''));
}

test('parity ledger produces an exact 10 x 21 = 210-cell PASS domain', () => {
  const actualRows = Array.from({ length: 10 }, (_, index) => row(index));
  const oracle = { rows: oracleRows(actualRows) };
  const result = buildSupportReportParityLedger({ report: { rows: actualRows }, oracle });
  assert.equal(result.summary.expectedRowCount, 10);
  assert.equal(result.summary.actualRowCount, 10);
  assert.equal(result.summary.columnCount, 21);
  assert.equal(result.summary.comparedCellCount, 210);
  assert.equal(result.summary.passCount, 210);
  assert.equal(result.summary.failCount, 0);
  assert.equal(result.summary.unresolvedInputCount, 0);
  assert.equal(result.summary.passCount + result.summary.failCount + result.summary.unresolvedInputCount, 210);
});

test('blank equality is unresolved when provenance says the actual source is unresolved', () => {
  const actual = row(0, { pipeSchedule: '', remarks: '' }, { pipeSchedule: unresolvedProvenance() });
  const expected = SUPPORT_REPORT_COLUMNS.map((column) => actual[column.key] ?? '');
  const result = buildSupportReportParityLedger({ report: { rows: [actual] }, oracle: { rows: [expected] } });
  const schedule = result.ledger.find((cell) => cell.column === 'pipeSchedule');
  const remarks = result.ledger.find((cell) => cell.column === 'remarks');
  assert.equal(schedule.status, SUPPORT_REPORT_PARITY_STATUS.UNRESOLVED_INPUT);
  assert.equal(remarks.status, SUPPORT_REPORT_PARITY_STATUS.PASS);
});

test('different resolved values are FAIL and preserve expected/actual/provenance', () => {
  const actual = row(0, { supportType: 'REST-250' });
  const expectedObject = { ...actual, supportType: 'SHOE-250' };
  const expected = SUPPORT_REPORT_COLUMNS.map((column) => expectedObject[column.key] ?? '');
  const result = buildSupportReportParityLedger({ report: { rows: [actual] }, oracle: { rows: [expected] } });
  const supportType = result.ledger.find((cell) => cell.column === 'supportType');
  assert.equal(supportType.status, SUPPORT_REPORT_PARITY_STATUS.FAIL);
  assert.equal(supportType.expected, 'SHOE-250');
  assert.equal(supportType.actual, 'REST-250');
  assert.equal(supportType.provenance.confidenceClass, 'AUTHORITATIVE');
});

test('missing expected-row actuals become 21 unresolved cells and extra actual rows are diagnostic only', () => {
  const expectedRow = row(0);
  const extraActual = row(1);
  const result = buildSupportReportParityLedger({
    report: { rows: [extraActual] },
    oracle: { rows: [SUPPORT_REPORT_COLUMNS.map((column) => expectedRow[column.key] ?? '')] },
  });
  assert.equal(result.summary.comparedCellCount, 21);
  assert.equal(result.summary.unresolvedInputCount, 21);
  assert.equal(result.summary.missingActualRowCount, 1);
  assert.equal(result.summary.extraActualRowCount, 1);
  assert.ok(result.ledger.every((cell) => cell.provenance.sourceClass === 'MISSING_ACTUAL_ROW'));
  assert.deepEqual(result.diagnostics.map((item) => item.code), ['MISSING_ACTUAL_ROW', 'EXTRA_ACTUAL_ROW']);
});

test('duplicate expected or actual row keys fail visible rather than selecting one', () => {
  const actual = row(0);
  const expected = SUPPORT_REPORT_COLUMNS.map((column) => actual[column.key] ?? '');
  assert.throws(() => buildSupportReportParityLedger({
    report: { rows: [actual] },
    oracle: { rows: [expected, expected] },
  }), /expected row key is duplicated/i);
  assert.throws(() => buildSupportReportParityLedger({
    report: { rows: [actual, { ...actual }] },
    oracle: { rows: [expected] },
  }), /actual row key is duplicated/i);
});

test('row identity canonicalizes family REF syntax and pipe case but requires both fields', () => {
  assert.equal(
    supportReportParityRowKey({ civilSecondarySupport: '/ps-007(ref)', pipe: 'asim-line-a' }),
    'PS-007::ASIM-LINE-A',
  );
  assert.throws(() => supportReportParityRowKey({ civilSecondarySupport: 'PS-007(REF)' }), /requires civilSecondarySupport and pipe/);
});

test('golden array rows are normalized by the supplied canonical column contract', () => {
  const actual = row(0);
  const arrayRow = SUPPORT_REPORT_COLUMNS.map((column) => actual[column.key] ?? '');
  const normalized = normalizeSupportReportGoldenOracle({ rows: [arrayRow] });
  assert.equal(normalized[0].scope, actual.scope);
  assert.equal(normalized[0].civilSecondarySupport, 'PS-007(REF)');
  assert.equal(normalized[0].pipe, actual.pipe);
  assert.equal(normalized[0].remarks, actual.remarks);
});
