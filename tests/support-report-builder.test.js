import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSupportReportClashXml } from '../tabs/support-steel-relationship-builder/support-report-clash-evidence.js';
import {
  SUPPORT_REPORT_COLUMNS,
  supportReportColumnValue,
} from '../tabs/support-steel-relationship-builder/support-report-contract.js';
import {
  buildSupportReportBundle,
  _test as supportReportEngineTest,
} from '../tabs/support-steel-relationship-builder/support-report-engine.js';
import { supportReportToCsv } from '../tabs/support-steel-relationship-builder/support-report-export.js';

const LINES = Object.freeze({
  p8: 'ASIM-1885-PL-8"-M8810123-PP-01',
  p6: 'ASIM-1885-PL-6"-W8810002-01',
  p4: 'ASIM-1885-PL-4"-M8810130-PP-01',
  p10: 'ASIM-1885-PL-10"-S8810105-HOT-01',
  p2: 'ASIM-1885-PL-2"-G8010016-01',
});

const CASES = [
  ['PS-007', LINES.p8, 'PS-007.5'], ['SL-097', LINES.p6, 'SL-097.6'],
  ['PS-007', LINES.p4, 'PS-007.1'], ['PS-007', LINES.p6, 'PS-007.2'],
  ['SL-097', LINES.p4, 'SL-097.5'], ['SL-097', LINES.p2, 'SL-097.7'],
  ['SL-097', LINES.p8, 'SL-097.10'], ['PS-007', LINES.p2, 'PS-007.3'],
  ['SL-097', LINES.p2, 'SL-097.7'], ['SL-097', LINES.p8, 'SL-097.10'],
  ['SL-097', LINES.p8, 'SL-097.3'], ['SL-097', LINES.p6, 'SL-097.6'],
  ['SL-097', LINES.p4, 'SL-097.5'], ['SL-097', LINES.p4, 'SL-097.1'],
  ['SL-097', LINES.p6, 'SL-097.2'], ['SL-097', LINES.p10, 'SL-097.13'],
  ['SL-097', LINES.p10, 'SL-097.13'], ['PS-007', LINES.p10, 'PS-007.7'],
  ['SL-097', LINES.p10, 'SL-097.12'], ['SL-097', LINES.p10, 'SL-097.12'],
];

function xmlEscape(value) { return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
function clashXml() {
  const rows = CASES.map(([family, line, member], index) => `<clashresult name="Clash${index + 1}" distance="-0.010"><clashpoint><pos3f x="${family === 'PS-007' ? '798.423' : '794.511'}" y="-1125.028" z="99.900"/></clashpoint><clashobjects><clashobject><pathlink><node>/ASIM-1885-CU-PL</node><node>/ASIM-1885-CU-PL-S</node><node>/${xmlEscape(line)}</node><node>/${xmlEscape(line)}/B1</node><node>/${member}</node></pathlink><smarttags><smarttag><name>Item Name</name><value>/${member}</value></smarttag></smarttags></clashobject><clashobject><pathlink><node>/ASIM-1835-CU-SU</node><node>/${family}</node><node>GENSEC of /${family}</node></pathlink><smarttags><smarttag><name>Item Name</name><value>GENSEC of /${family}</value></smarttag></smarttags></clashobject></clashobjects></clashresult>`).join('');
  return `<exchange units="m"><batchtest><clashtests><clashtest><clashresults>${rows}</clashresults></clashtest></clashtests></batchtest></exchange>`;
}

function member(memberId, fullLineTag, type, point) {
  return {
    memberId,
    semanticRole: 'OTHER_FAMILY_MEMBER',
    lineContext: { fullLineTag, branchNode: `/${fullLineTag}/B1` },
    sourcePath: ['/ASIM-1885-CU-PL', '/ASIM-1885-CU-PL-S', `/${fullLineTag}`, memberId],
    attributes: { CMPSUPTYPE: type },
    positionGlobal: point,
  };
}

const relationshipBundle = {
  schema: 'SupportSteelRelationshipBundle.v1',
  supportFamilies: [{
    familyId: '/PS-007',
    members: [
      member('/PS-007.5', LINES.p8, 'REST-200', { x: 798423, y: -1126285, z: 99900.45 }),
      member('/PS-007.2', LINES.p6, 'REST-150', { x: 798423, y: -1126879, z: 99900.45 }),
      member('/PS-007.1', LINES.p4, 'REST-100', { x: 798423, y: -1125691, z: 99900.45 }),
      member('/PS-007.6', LINES.p10, 'MDS/AT05-10-PMP', { x: 798423, y: -1125028, z: 100100.45 }),
      member('/PS-007.4', LINES.p10, 'REST-250', { x: 798423, y: -1125028, z: 100100.45 }),
      member('/PS-007.7', LINES.p10, 'SHOE-250', { x: 798423, y: -1125028, z: 100100.45 }),
      member('/PS-007.3', LINES.p2, 'REST-50', { x: 798423, y: -1127229, z: 99906.45 }),
    ],
  }],
  supportCarrierResolution: { carrierObjects: [{
    carrierObjectId: '/PIPE-10',
    lineContext: { fullLineTag: LINES.p10 },
    attributes: { ABORE: '250', PIPE_SCHEDULE: 'PIPE Sch 100', PIPE_INSULATION_THICKNESS: '120MM', PIPE_INSULATION_TYPE: 'HC' },
  }] },
};

test('Support Report clash adapter reduces 20 clashes to 10 family/line groups', () => {
  const parsed = parseSupportReportClashXml(clashXml());
  assert.equal(parsed.rowCount, 20);
  assert.equal(parsed.groupCount, 10);
  assert.equal(parsed.groups.filter((row) => row.secondarySupportFamilyId === 'PS-007').length, 5);
  assert.equal(parsed.groups.filter((row) => row.secondarySupportFamilyId === 'SL-097').length, 5);
  assert.equal(parsed.groups.find((row) => row.secondarySupportFamilyId === 'PS-007' && row.fullLineTag === LINES.p10).totalSupportPointsOnSecondary, 5);
  const xmlOnly = buildSupportReportBundle({ clashXmlText: clashXml() });
  assert.ok(xmlOnly.rows.slice(0, 5).every((row) => row.civilSecondarySupport === 'PS-007(REF)'));
});

test('Support Report enrichment recovers native members omitted by clash XML', () => {
  const report = buildSupportReportBundle({ clashXmlText: clashXml(), relationshipBundle });
  assert.equal(report.summary.reportRowCount, 10);
  assert.deepEqual(report.rows.slice(0, 5).map((row) => row.pipe), [LINES.p8, LINES.p6, LINES.p4, LINES.p10, LINES.p2]);
  const ps10 = report.rows.find((row) => row.civilSecondarySupport === 'PS-007(REF)' && row.pipe === LINES.p10);
  assert.equal(ps10.pipingPrimarySupport, '/PS-007.6, /PS-007.4, /PS-007.7');
  assert.equal(ps10.supportType, 'MDS/AT05-10-PMP, REST-250, SHOE-250');
  assert.deepEqual(ps10.evidence.nativeOnlyMemberIds, ['/PS-007.6', '/PS-007.4']);
  assert.equal(ps10.size, '250');
  assert.equal(ps10.eastWest, 'E 798423mm');
  assert.equal(ps10.northSouth, 'S 1125028mm');
  assert.equal(ps10.bopElevation, 'U 100100.45mm');
  assert.equal(ps10.remarks, ', , ');
  assert.equal(supportReportColumnValue(ps10, 'pipeInsulationTypeAndThickness'), 'HC 120MM');
  assert.equal(supportReportColumnValue(ps10, 'revision'), '');
});

test('Support Report carrier branch fallback cannot override explicit full-line custody', () => {
  const lineA = 'ASIM-1885-PL-10"-LINE-A';
  const lineB = 'ASIM-1885-PL-10"-LINE-B';
  const group = { fullLineTag: lineA, branchNodes: [`/${lineA}/B1`] };
  const conflicting = {
    carrierObjectId: '/PIPE-CONFLICT',
    lineContext: { fullLineTag: lineB, branchNode: `/${lineA}/B1` },
  };
  const branchOnly = {
    carrierObjectId: '/PIPE-BRANCH',
    lineContext: { branchNode: `/${lineA}/B1` },
  };
  assert.deepEqual(
    supportReportEngineTest.selectCarriersForGroup([conflicting, branchOnly], group)
      .map((carrier) => carrier.carrierObjectId),
    ['/PIPE-BRANCH'],
  );
  const exact = {
    carrierObjectId: '/PIPE-EXACT',
    lineContext: { fullLineTag: lineA, branchNode: `/${lineA}/B1` },
  };
  assert.deepEqual(
    supportReportEngineTest.selectCarriersForGroup([conflicting, branchOnly, exact], group)
      .map((carrier) => carrier.carrierObjectId),
    ['/PIPE-EXACT'],
  );
});

test('Support Report uses resolved member carrier authority before same-line catalog order', () => {
  const resolvedCarrierId = '/PIPE-RESOLVED';
  const supportFamilies = relationshipBundle.supportFamilies.map((family) => ({
    ...family,
    members: family.members.map((item) => item.memberId === '/PS-007.7'
      ? {
        ...item,
        carrierResolution: {
          resolutionStatus: 'RESOLVED_EXPLICIT_CARRIER',
          physicalCarrierObjectAvailable: true,
          carrierObjectId: resolvedCarrierId,
        },
      }
      : item),
  }));
  const resolvedBundle = {
    ...relationshipBundle,
    supportFamilies,
    supportCarrierResolution: { carrierObjects: [
      {
        carrierObjectId: '/PIPE-UNRELATED-FIRST',
        lineContext: { fullLineTag: LINES.p10 },
        attributes: { PIPE_SCHEDULE: 'WRONG SCHEDULE', ABORE: '999' },
      },
      {
        carrierObjectId: resolvedCarrierId,
        lineContext: { fullLineTag: LINES.p10 },
        attributes: { PIPE_SCHEDULE: 'PIPE Sch 100', ABORE: '250' },
      },
    ] },
  };
  const report = buildSupportReportBundle({ clashXmlText: clashXml(), relationshipBundle: resolvedBundle });
  const ps10 = report.rows.find((row) => row.civilSecondarySupport === 'PS-007(REF)' && row.pipe === LINES.p10);
  assert.equal(ps10.pipeSchedule, 'PIPE Sch 100');
  assert.equal(ps10.size, '250');
  assert.deepEqual(ps10.evidence.resolvedCarrierObjectIds, [resolvedCarrierId]);
  assert.deepEqual(ps10.evidence.carrierObjectIds, [resolvedCarrierId]);
});

test('Support Report does not replace a missing resolved carrier with a line fallback', () => {
  const missingCarrierId = '/PIPE-MISSING';
  const supportFamilies = relationshipBundle.supportFamilies.map((family) => ({
    ...family,
    members: family.members.map((item) => item.memberId === '/PS-007.7'
      ? {
        ...item,
        carrierResolution: {
          resolutionStatus: 'RESOLVED_EXPLICIT_CARRIER',
          physicalCarrierObjectAvailable: true,
          carrierObjectId: missingCarrierId,
        },
      }
      : item),
  }));
  const missingBundle = {
    ...relationshipBundle,
    supportFamilies,
    supportCarrierResolution: { carrierObjects: [{
      carrierObjectId: '/PIPE-FALLBACK',
      lineContext: { fullLineTag: LINES.p10 },
      attributes: { PIPE_SCHEDULE: 'MUST NOT LEAK', ABORE: '999' },
    }] },
  };
  const report = buildSupportReportBundle({ clashXmlText: clashXml(), relationshipBundle: missingBundle });
  const ps10 = report.rows.find((row) => row.civilSecondarySupport === 'PS-007(REF)' && row.pipe === LINES.p10);
  assert.equal(ps10.pipeSchedule, '');
  assert.equal(ps10.size, '250');
  assert.deepEqual(ps10.evidence.resolvedCarrierObjectIds, [missingCarrierId]);
  assert.deepEqual(ps10.evidence.carrierObjectIds, []);
  assert.ok(ps10.diagnostics.some((item) => item.code === 'SUPPORT_REPORT_CARRIER_ENRICHMENT_UNAVAILABLE'
    && item.severity === 'WARN'));
});

test('Support Report blanks conflicting equally authoritative carrier fields and exposes evidence', () => {
  const carrierByMember = new Map([
    ['/PS-007.6', '/PIPE-A'],
    ['/PS-007.7', '/PIPE-B'],
  ]);
  const supportFamilies = relationshipBundle.supportFamilies.map((family) => ({
    ...family,
    members: family.members.map((item) => {
      const carrierObjectId = carrierByMember.get(item.memberId);
      return carrierObjectId ? {
        ...item,
        carrierResolution: {
          resolutionStatus: 'RESOLVED_EXPLICIT_CARRIER',
          physicalCarrierObjectAvailable: true,
          carrierObjectId,
        },
      } : item;
    }),
  }));
  const conflictBundle = {
    ...relationshipBundle,
    supportFamilies,
    supportCarrierResolution: { carrierObjects: [
      {
        carrierObjectId: '/PIPE-A',
        lineContext: { fullLineTag: LINES.p10 },
        attributes: { ABORE: '250', PIPE_SCHEDULE: 'PIPE Sch 100', PIPE_INSULATION_TYPE: 'HC' },
      },
      {
        carrierObjectId: '/PIPE-B',
        lineContext: { fullLineTag: LINES.p10 },
        attributes: { ABORE: '300', PIPE_SCHEDULE: 'PIPE Sch 120', PIPE_INSULATION_TYPE: 'HC' },
      },
    ] },
  };
  const report = buildSupportReportBundle({ clashXmlText: clashXml(), relationshipBundle: conflictBundle });
  const ps10 = report.rows.find((row) => row.civilSecondarySupport === 'PS-007(REF)' && row.pipe === LINES.p10);
  assert.equal(ps10.size, '');
  assert.equal(ps10.pipeSchedule, '');
  assert.equal(ps10.pipeInsulationType, 'HC');
  assert.deepEqual(ps10.evidence.resolvedCarrierObjectIds, ['/PIPE-A', '/PIPE-B']);
  assert.deepEqual(ps10.evidence.carrierObjectIds, ['/PIPE-A', '/PIPE-B']);
  assert.deepEqual(ps10.evidence.carrierAttributeConflicts.map((item) => item.field), ['size', 'pipeSchedule']);
  assert.ok(ps10.diagnostics.some((item) => item.code === 'SUPPORT_REPORT_CARRIER_ATTRIBUTE_CONFLICT'
    && item.severity === 'WARN'));
});

test('Support Report column contract follows the Owner A:U workbook order', () => {
  assert.equal(SUPPORT_REPORT_COLUMNS.length, 21);
  assert.deepEqual(SUPPORT_REPORT_COLUMNS.map((column) => column.key), [
    'scope', 'civilSecondarySupport', 'pipe', 'size', 'pipeSchedule',
    'pipeInsulationThickness', 'pipeInsulationType', 'pipingPrimarySupport', 'supportType',
    'pipingPrimarySupportReference', 'eastWest', 'northSouth', 'bopElevation',
    'stressSystemNumber', 'nodeNumber', 'totalSupportPointsOnSecondary', 'previousName',
    'primarySupportDescription', 'primarySupportZone', 'primarySupportSite', 'remarks',
  ]);
});

test('Support Report CSV preserves Owner order and blanks column-8 primary-support header', () => {
  const report = buildSupportReportBundle({ clashXmlText: clashXml(), relationshipBundle });
  const lines = supportReportToCsv(report, { legacyBlankPrimarySupportHeader: true }).split('\n');
  assert.equal(lines.length, 12);
  assert.equal((lines[0].match(/,/g) || []).length + 1, 21);
  assert.match(lines[1], /^"SCOPE","CIVILSECONDARYSUPPORT","PIPE","SIZE","PIPE SCHEDULE"/);
  const headers = lines[1].split(',');
  assert.equal(headers[7], '""');
  assert.equal(headers[9], '"PIPING PRIMARY SUPPORT REFERENCE"');
  assert.equal(headers[20], '"REMARKS"');
});
