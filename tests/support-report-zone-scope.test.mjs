import assert from 'node:assert/strict';
import test from 'node:test';

import {
  discoverSupportReportZones,
  normalizeSupportReportZoneScope,
  scopeSupportRelationshipRows,
  scopeSupportReportRows,
} from '../tabs/support-steel-relationship-builder/support-report-zone-scope.js';

const primaryZone = '/ASIM-1835-CU-PI-P';
const secondaryZone = '/ASIM-1835-CU-SU';

function rawReportRow(id, pZone = primaryZone, sZone = secondaryZone) {
  return {
    id,
    primaryPath: [
      '/ASIM-1835-CU-PI',
      pZone,
      '/ASIM-1835-2"-P8810320-31441C4-HT-01',
      '/B4',
      `/PS-11167.${id}`,
    ],
    secondaryPath: [
      sZone,
      '/PS-11167',
    ],
  };
}

function groupedReportRow(id, pZone = primaryZone, sZone = secondaryZone) {
  const raw = rawReportRow(id, pZone, sZone);
  return {
    id,
    primaryPaths: [raw.primaryPath],
    secondaryPaths: [raw.secondaryPath],
  };
}

test('discovers exact parent zones from raw Support Report rows', () => {
  const discovered = discoverSupportReportZones([rawReportRow(1), rawReportRow(2)]);
  assert.ok(discovered.primaryZones.some((row) => row.zoneId === primaryZone && row.evidenceRowCount === 2));
  assert.ok(discovered.secondaryZones.some((row) => row.zoneId === secondaryZone && row.evidenceRowCount === 2));
  assert.equal(discovered.primaryZones.some((row) => row.zoneId.includes('P8810320')), false);
});

test('grouped plural paths remain supported for downstream audit callers', () => {
  const discovered = discoverSupportReportZones([groupedReportRow(1)]);
  assert.ok(discovered.primaryZones.some((row) => row.zoneId === primaryZone));
  assert.ok(discovered.secondaryZones.some((row) => row.zoneId === secondaryZone));
});

test('empty zone selection preserves every raw report row', () => {
  const rows = [rawReportRow(1), rawReportRow(2, '/ASIM-1835-CU-PI-D')];
  assert.deepEqual(scopeSupportReportRows(rows, {}), rows);
  assert.equal(normalizeSupportReportZoneScope({}).active, false);
});

test('raw report row zone gates are exact and conjunctive across enabled sides', () => {
  const rows = [
    rawReportRow(1),
    rawReportRow(2, '/ASIM-1835-CU-PI-D'),
    rawReportRow(3, primaryZone, '/ASIM-1835-CU-SU-OTHER'),
    rawReportRow(4, '/ASIM-1835-CU-PI-P-EXTRA'),
  ];
  const scoped = scopeSupportReportRows(rows, {
    primaryZoneIds: [primaryZone],
    secondaryZoneIds: [secondaryZone],
  });
  assert.deepEqual(scoped.map((row) => row.id), [1]);
});

test('relationship rows use exact source-path ancestry and any selected scoped zone', () => {
  const rows = [
    { clashName: 'keep-primary', objectA: { path: [primaryZone, '/PS-11167.2'] }, objectB: { path: [primaryZone, '/PS-11167.11'] } },
    { clashName: 'keep-secondary', objectA: { path: [secondaryZone, '/PS-11236.4'] }, objectB: { path: [secondaryZone, '/PS-11236.5'] } },
    { clashName: 'reject-similar', objectA: { path: [`${primaryZone}-EXTRA`, '/PS-999.1'] }, objectB: { path: [`${primaryZone}-EXTRA`, '/PS-999.2'] } },
  ];
  const scoped = scopeSupportRelationshipRows(rows, {
    primaryZoneIds: [primaryZone],
    secondaryZoneIds: [secondaryZone],
  });
  assert.deepEqual(scoped.map((row) => row.clashName), ['keep-primary', 'keep-secondary']);
});
