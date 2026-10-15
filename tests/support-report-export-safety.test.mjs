import assert from 'node:assert/strict';
import test from 'node:test';
import {
  supportReportBundleToJson,
  supportReportToCsv,
  supportReportToTsv,
} from '../tabs/support-steel-relationship-builder/support-report-export.js';

function bundle() {
  return {
    rows: [{
      previousName: '@previous',
      scope: '+scope',
      civilSecondarySupport: 'PS-007(REF)',
      pipe: 'ASIM-1885-PL-10"-S8810105-HOT-01',
      size: 250,
      pipingPrimarySupport: '/PS-007.7',
      supportType: 'SHOE-250',
      pipingPrimarySupportReference: '=67127059/28670',
      eastWest: 'E 798423mm',
      northSouth: 'S 1125028mm',
      bopElevation: 'U 100100.45mm',
      totalSupportPointsOnSecondary: 5,
      remarks: '-formula-shaped-text',
      primarySupportDescription: 'Pipe shoe',
      primarySupportZone: 'ASIM-1885-CU-PL-S',
      primarySupportSite: 'ASIM-1885-CU-PL',
      pipeSchedule: 'PIPE Sch 100',
      pipeInsulationType: 'HC',
      pipeInsulationThickness: '80mm',
      stressSystemNumber: 'QSP-SYS-01',
      nodeNumber: '280',
      revision: '5',
    }],
  };
}

test('CSV and TSV neutralize formula-leading text without mutating canonical JSON', () => {
  const report = bundle();
  const csv = supportReportToCsv(report, { includeOrdinalRow: false });
  const tsv = supportReportToTsv(report, { includeOrdinalRow: false });
  const json = supportReportBundleToJson(report);

  assert.match(csv, /"'@previous"/);
  assert.match(csv, /"'\+scope"/);
  assert.match(csv, /"'=67127059\/28670"/);
  assert.match(csv, /"'-formula-shaped-text"/);
  assert.match(tsv, /'@previous/);
  assert.match(tsv, /'\+scope/);
  assert.match(tsv, /'=67127059\/28670/);
  assert.match(tsv, /'-formula-shaped-text/);

  assert.match(json, /"pipingPrimarySupportReference": "=67127059\/28670"/);
  assert.doesNotMatch(json, /"pipingPrimarySupportReference": "'=67127059\/28670"/);
  assert.match(json, /"scope": "\+scope"/);
  assert.match(json, /"remarks": "-formula-shaped-text"/);
});

test('numeric values remain numeric-looking text rather than formula-escaped', () => {
  const report = { rows: [{ ...bundle().rows[0], totalSupportPointsOnSecondary: -5 }] };
  const csv = supportReportToCsv(report, { includeOrdinalRow: false });
  const tsv = supportReportToTsv(report, { includeOrdinalRow: false });
  assert.match(csv, /"-5"/);
  assert.doesNotMatch(csv, /"'-5"/);
  assert.match(tsv, /\t-5\t/);
  assert.doesNotMatch(tsv, /\t'-5\t/);
});
