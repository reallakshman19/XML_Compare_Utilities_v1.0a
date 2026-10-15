import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  SUPPORT_REPORT_COLUMNS,
  supportReportColumnHeader,
} from '../tabs/support-steel-relationship-builder/support-report-contract.js';
import { supportReportToCsv } from '../tabs/support-steel-relationship-builder/support-report-export.js';
import {
  createSupportReportWorkbook,
  supportReportSpreadsheetMatrix,
} from '../tabs/support-steel-relationship-builder/support-report-xlsx.js';

const oracle = JSON.parse(readFileSync(
  'tests/fixtures/support-report/support-report-owner-column-contract.json', 'utf8',
));
const row = Object.freeze({
  scope: 'ASIM',
  civilSecondarySupport: 'PS-007(REF)',
  pipe: 'ASIM-1885-PL-10"-S8810105-HOT-01',
  size: '250',
  pipeSchedule: 'PIPE Sch 100',
  pipeInsulationThickness: '120MM',
  pipeInsulationType: 'HC',
  pipingPrimarySupport: '/PS-007.6, /PS-007.4, /PS-007.7',
  supportType: 'MDS/AT05-10-PMP, REST-250, SHOE-250',
  pipingPrimarySupportReference: '=1006649755/3651, =1006657947/901, =1006649755/3652',
  eastWest: 'E 798423mm',
  northSouth: 'S 1125028mm',
  bopElevation: 'U 100100.45mm',
  stressSystemNumber: '',
  nodeNumber: '',
  totalSupportPointsOnSecondary: 5,
  previousName: '/PS-007.6',
  primarySupportDescription: 'WEAR PLATE, Pipe Rest, PIPE SHOE',
  primarySupportZone: 'ASIM-1885-CU-PL-S',
  primarySupportSite: 'ASIM-1885-CU-PL',
  remarks: ', , ',
  revision: 'MUST_NOT_EXPORT',
});

test('canonical Support Report columns match the Owner A:U key order', () => {
  assert.equal(SUPPORT_REPORT_COLUMNS.length, 21);
  assert.deepEqual(SUPPORT_REPORT_COLUMNS.map((column) => column.key), oracle.keys);
  assert.equal(SUPPORT_REPORT_COLUMNS.some((column) => column.key === 'revision'), false);
});

test('XLSX matrix matches Owner ordinal row and exact header cells', () => {
  const matrix = supportReportSpreadsheetMatrix({ rows: [row] });
  assert.deepEqual(matrix[0], oracle.ordinalRow);
  assert.deepEqual(matrix[1], oracle.headers.map((value) => value ?? ''));
  assert.equal(matrix[2].length, 21);
  assert.equal(matrix[2][0], 'ASIM');
  assert.equal(matrix[2][4], 'PIPE Sch 100');
  assert.equal(matrix[2][5], '120MM');
  assert.equal(matrix[2][6], 'HC');
  assert.equal(matrix[2][7], '/PS-007.6, /PS-007.4, /PS-007.7');
  assert.equal(matrix[2][13], '');
  assert.equal(matrix[2][15], 5);
  assert.equal(matrix[2][16], '/PS-007.6');
  assert.equal(matrix[2][20], ', , ');
  assert.equal(matrix[2].includes('MUST_NOT_EXPORT'), false);
});

test('XLSX workbook auto-filter starts on the real header row', () => {
  const captured = {};
  const fakeXlsx = {
    utils: {
      aoa_to_sheet(matrix) { captured.matrix = matrix; return {}; },
      book_new() { return { sheets: [] }; },
      book_append_sheet(workbook, worksheet, name) { workbook.sheets.push({ worksheet, name }); },
    },
    write() { return new Uint8Array(); },
  };
  const workbook = createSupportReportWorkbook({ rows: [row] }, fakeXlsx);
  assert.equal(workbook.sheets[0].worksheet['!autofilter'].ref, 'A2:U3');
  assert.deepEqual(captured.matrix[1], oracle.headers.map((value) => value ?? ''));
});

test('CSV uses the same field order and blanks the primary-support header when requested', () => {
  const csv = supportReportToCsv({ rows: [row] }, {
    includeOrdinalRow: true,
    legacyBlankPrimarySupportHeader: true,
  });
  const [ordinal, header] = csv.split('\n');
  assert.equal(ordinal, oracle.ordinalRow.map((value) => `"${value}"`).join(','));
  const labels = SUPPORT_REPORT_COLUMNS.map((column) => supportReportColumnHeader(column, {
    legacyBlankPrimarySupportHeader: true,
  }));
  assert.equal(header, labels.map((value) => `"${value}"`).join(','));
  assert.equal(labels[7], '');
  assert.equal(labels[9], 'PIPING PRIMARY SUPPORT REFERENCE');
});
