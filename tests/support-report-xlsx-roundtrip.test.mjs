import assert from 'node:assert/strict';
import test from 'node:test';
import {
  supportReportSpreadsheetMatrix,
  supportReportToXlsxBytes,
  _test as xlsxTest,
} from '../tabs/support-steel-relationship-builder/support-report-xlsx.js';
import { createOoxmlXlsxAdapter, readSimpleXlsx } from './helpers/simple-ooxml-xlsx.mjs';

function reportRow() {
  return {
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
  };
}

async function roundTrip(options = {}) {
  let requestedUrl = '';
  const adapter = createOoxmlXlsxAdapter();
  const bytes = await supportReportToXlsxBytes({ rows: [reportRow()] }, {
    ...options,
    importModule: async (url) => {
      requestedUrl = url;
      return { default: adapter };
    },
  });
  return { requestedUrl, bytes, workbook: readSimpleXlsx(bytes) };
}

test('Support Report XLSX round-trip preserves Owner 21-column workbook layout', async () => {
  const { requestedUrl, bytes, workbook } = await roundTrip();
  assert.equal(requestedUrl, xlsxTest.XLSX_MODULE_URL);
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  assert.equal(workbook.sheetName, 'Support Report');
  assert.equal(workbook.ref, 'A1:U3');
  assert.equal(workbook.autoFilter, 'A2:U3');
  assert.deepEqual(workbook.matrix[0], Array.from({ length: 21 }, (_, index) => index + 1));
  assert.equal(workbook.matrix[1].length, 21);
  assert.equal(workbook.matrix[1][0], 'SCOPE');
  assert.equal(workbook.matrix[1][7], '');
  assert.equal(workbook.matrix[1][20], 'REMARKS');
  assert.equal(workbook.matrix[2][7], '/PS-007.6, /PS-007.4, /PS-007.7');
  assert.equal(workbook.matrix[2][9], '=1006649755/3651, =1006657947/901, =1006649755/3652');
  assert.equal(workbook.matrix[2][15], 5);
  assert.equal(workbook.formulaCount, 0, 'formula-like reference text must remain literal text');
});

test('matrix and XLSX read-back are value-equivalent for every exported cell', async () => {
  const expected = supportReportSpreadsheetMatrix({ rows: [reportRow()] });
  const { workbook } = await roundTrip();
  assert.deepEqual(workbook.matrix, expected);
});

test('XLSX without ordinal row moves header and autofilter to row 1', async () => {
  const { workbook } = await roundTrip({ includeOrdinalRow: false, sheetName: 'ASIM' });
  assert.equal(workbook.sheetName, 'ASIM');
  assert.equal(workbook.ref, 'A1:U2');
  assert.equal(workbook.autoFilter, 'A1:U2');
  assert.equal(workbook.matrix[0][0], 'SCOPE');
  assert.equal(workbook.matrix[1][15], 5);
});

test('round-trip package contains only the minimal expected workbook parts', async () => {
  const { workbook } = await roundTrip();
  assert.deepEqual(workbook.entries, [
    '[Content_Types].xml',
    '_rels/.rels',
    'xl/_rels/workbook.xml.rels',
    'xl/workbook.xml',
    'xl/worksheets/sheet1.xml',
  ]);
});
