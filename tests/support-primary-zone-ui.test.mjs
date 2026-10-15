import assert from 'node:assert/strict';
import test from 'node:test';

import { _test as addonTest } from '../tabs/support-steel-relationship-builder/support-report-addon.js';

test('Support Report panel exposes current and reference relationship XML plus two-column current zone scope UI', () => {
  const html = addonTest.renderPanel();
  assert.match(html, /Primary Support Relationship XML \(optional\)/);
  assert.match(html, /data-ssr-relationship-file="1"/);
  assert.match(html, /data-ssr-relationship-xml/);
  assert.match(html, /Reference Primary Support Relationship XML \(optional\)/);
  assert.match(html, /data-ssr-reference-relationship-file="1"/);
  assert.match(html, /data-ssr-reference-relationship-xml/);
  assert.match(html, /scoped automatically from exact ancestor zones/i);
  assert.match(html, /current-area zone selections are never reused/i);
  assert.match(html, /Support Report zone scope/);
  assert.match(html, /Primary \/ piping-support zones/);
  assert.match(html, /Secondary \/ support zones/);
  assert.match(html, /data-ssr-zone-select="primary"/);
  assert.match(html, /data-ssr-zone-select="secondary"/);
  assert.match(html, /data-ssr-zone-search="primary"/);
  assert.match(html, /data-ssr-zone-search="secondary"/);
  assert.match(html, /Discover zones from primary XML/);
});

test('zone scope help states empty current selection preserves unrestricted behavior and reference scope is independent', () => {
  const html = addonTest.zoneScopeCard();
  assert.match(html, /Empty selections mean no restriction/);
  assert.match(html, /exact ancestor nodes/i);
  assert.match(html, /Reference relationship scope is derived independently/i);
});

test('input audit attachment preserves current and reference relationship qualification metadata separately', () => {
  const report = addonTest.attachSupportPrimaryInputAudit({ schema: 'SupportReportBundle.v1', rows: [] }, {
    zoneScope: { schema: 'SupportReportZoneScope.v1', active: true, primaryZoneIds: ['/ASIM-1835-CU-PI-P'], secondaryZoneIds: ['/ASIM-1835-CU-SU'] },
    zoneCatalog: { primaryZones: [{ zoneId: '/ASIM-1835-CU-PI-P', evidenceRowCount: 2 }], secondaryZones: [] },
    zoneScopeSummary: { inputRowCount: 3, includedRowCount: 2, excludedRowCount: 1 },
    primaryRelationshipInput: {
      schema: 'SupportPrimaryInput.v1',
      scopeBasis: 'EXPLICIT_ZONE_SCOPE',
      scopeAvailable: true,
      zoneScope: { primaryZoneIds: ['/ASIM-1835-CU-PI-P'], secondaryZoneIds: [] },
      parsedRowCount: 4,
      scopedRowCount: 3,
      excludedByZoneCount: 1,
      parsedDiagnostics: [],
      bundle: { schema: 'SupportPrimaryRelationshipBundle.v1', summary: { explicitEdgeCount: 3 } },
    },
    referenceRelationshipInput: {
      schema: 'SupportPrimaryInput.v1',
      scopeBasis: 'REFERENCE_SUPPORT_REPORT_EXACT_ANCESTRY',
      scopeAvailable: true,
      zoneScope: { primaryZoneIds: ['/ASIM-1884-CU-PI-P'], secondaryZoneIds: ['/ASIM-1884-CU-SU'] },
      zoneCatalog: { primaryZones: [{ zoneId: '/ASIM-1884-CU-PI-P', evidenceRowCount: 5 }], secondaryZones: [] },
      parsedRowCount: 6,
      scopedRowCount: 5,
      excludedByZoneCount: 1,
      parsedDiagnostics: [],
      bundle: { schema: 'SupportPrimaryRelationshipBundle.v1', summary: { explicitEdgeCount: 5 } },
    },
  });
  assert.equal(report.zoneScope.active, true);
  assert.equal(report.zoneScopeSummary.excludedRowCount, 1);
  assert.equal(report.primaryRelationshipInput.side, 'CURRENT');
  assert.equal(report.primaryRelationshipInput.scopedRowCount, 3);
  assert.equal(report.primaryRelationshipInput.bundleSummary.explicitEdgeCount, 3);
  assert.equal(report.referenceRelationshipInput.side, 'REFERENCE');
  assert.equal(report.referenceRelationshipInput.scopeBasis, 'REFERENCE_SUPPORT_REPORT_EXACT_ANCESTRY');
  assert.equal(report.referenceRelationshipInput.scopedRowCount, 5);
  assert.deepEqual(report.referenceRelationshipInput.zoneScope.primaryZoneIds, ['/ASIM-1884-CU-PI-P']);
});

test('reference relationship audit remains absent when no reference input is supplied', () => {
  const report = addonTest.attachSupportPrimaryInputAudit({ schema: 'SupportReportBundle.v1', rows: [] }, {
    zoneCatalog: { primaryZones: [], secondaryZones: [] },
  });
  assert.equal(report.referenceRelationshipInput, null);
});
