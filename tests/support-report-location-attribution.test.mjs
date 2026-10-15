import assert from 'node:assert/strict';
import test from 'node:test';
import {
  groupSupportReportEvidenceByLocation,
  SUPPORT_REPORT_MULTI_LOCATION_REMARK,
} from '../tabs/support-steel-relationship-builder/support-report-location-grouping.js?issue=1206';
import { buildSupportReportBundle } from '../tabs/support-steel-relationship-builder/support-report-engine.js?issue=1206';
import { supportReportTraceRows } from '../tabs/support-steel-relationship-builder/support-report-trace-export.js?issue=1206';

const line = 'ASIM-1885-2"-D8810242-11441T3-PP-01';
const branch = `/${line}/B4`;

function clashRow(memberId, point, overrides = {}) {
  const fullLineTag = overrides.fullLineTag || line;
  const branchNode = overrides.branchNode || `/${fullLineTag}/B4`;
  const secondarySupportFamilyId = overrides.secondarySupportFamilyId || 'PS-12005';
  return {
    secondarySupportFamilyId,
    fullLineTag,
    scope: 'ASIM',
    branchNode,
    primarySupportMemberId: memberId,
    clashPointGlobalMm: point,
    primaryPath: ['/ASIM-1885-CU-PI', '/ASIM-1885-CU-PI-D', `/${fullLineTag}`, branchNode, memberId],
    secondaryPath: ['/ASIM-1885-CU-SU', `/${secondarySupportFamilyId}`],
  };
}

function nativeMember(memberId, positionGlobal = null, attributes = {}) {
  return {
    memberId,
    semanticRole: 'OTHER_FAMILY_MEMBER',
    attributes,
    positionGlobal,
    sourcePath: ['/ASIM-1885-CU-PI', '/ASIM-1885-CU-PI-D', `/${line}`, branch, memberId],
    sourceParentBranch: branch,
    lineContext: { fullLineTag: line, branchNode: branch },
  };
}

function reportGroup(memberId, locationIndex, locationCount, x) {
  const point = { x, y: -1107599, z: 101674 };
  return Object.freeze({
    groupId: `PS-12005::${line}::LOC-${locationIndex + 1}`,
    secondarySupportFamilyId: 'PS-12005',
    fullLineTag: line,
    scope: 'ASIM',
    branchNodes: [branch],
    primarySupportMemberIds: [memberId],
    clashPointsGlobalMm: [point],
    representativeClashPointGlobalMm: point,
    primaryPaths: [['/ASIM-1885-CU-PI', '/ASIM-1885-CU-PI-D', `/${line}`, branch, memberId]],
    secondaryPaths: [['/ASIM-1885-CU-SU', '/PS-12005']],
    evidenceRows: [{}],
    clashCount: 1,
    locationIndex,
    locationCountOnPipe: locationCount,
    locationMergeToleranceMm: 50,
    locationGroupingBasis: ['SINGLE_EVIDENCE_POINT'],
    multipleLocationsOnPipe: locationCount > 1,
    totalSupportPointsOnSecondary: locationCount,
  });
}

function relationshipBundle(members) {
  return {
    schema: 'SupportSteelRelationshipBundle.v1',
    supportFamilies: [{ familyId: 'PS-12005', members }],
    supportCarrierResolution: { carrierObjects: [] },
  };
}

test('same concrete support member joins contact points beyond 50 mm into one physical location', () => {
  const groups = groupSupportReportEvidenceByLocation([
    clashRow('/PS-12005.1', { x: 605291, y: -1107599, z: 101674 }),
    clashRow('/PS-12005.1', { x: 605315, y: -1107679, z: 101674 }),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].locationCountOnPipe, 1);
  assert.equal(groups[0].multipleLocationsOnPipe, false);
  assert.deepEqual(groups[0].primarySupportMemberIds, ['/PS-12005.1']);
  assert.ok(groups[0].locationGroupingBasis.includes('SAME_CONCRETE_MEMBER'));
});

test('same concrete support member remains one physical location across branch labels', () => {
  const groups = groupSupportReportEvidenceByLocation([
    clashRow('/PS-12005.1', { x: 605291, y: -1107599, z: 101674 }, { branchNode: `/${line}/B4` }),
    clashRow('/PS-12005.1', { x: 606291, y: -1107599, z: 101674 }, { branchNode: `/${line}/B5` }),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].locationCountOnPipe, 1);
  assert.deepEqual(groups[0].branchNodes, [`/${line}/B4`, `/${line}/B5`]);
  assert.deepEqual(groups[0].primarySupportMemberIds, ['/PS-12005.1']);
  assert.ok(groups[0].locationGroupingBasis.includes('SAME_CONCRETE_MEMBER'));
});

test('different members use the bore-axis window on the same traversal', () => {
  const far = groupSupportReportEvidenceByLocation([
    clashRow('/PS-12005.1', { x: 0, y: 0, z: 0 }),
    clashRow('/PS-12005.2', { x: 300, y: 0, z: 0 }),
  ]);
  assert.equal(far.length, 2);
  assert.ok(far.every((group) => group.multipleLocationsOnPipe));

  const near = groupSupportReportEvidenceByLocation([
    clashRow('/PS-12005.1', { x: 0, y: 0, z: 0 }),
    clashRow('/PS-12005.2', { x: 80, y: 0, z: 0 }),
  ]);
  assert.equal(near.length, 1);
  assert.deepEqual(near[0].primarySupportMemberIds, ['/PS-12005.1', '/PS-12005.2']);
  assert.ok(near[0].locationGroupingBasis.includes('WITHIN_BORE_AXIS_WINDOW'));
});

test('different pipe traversals remain separate even at coincident coordinates', () => {
  const point = { x: 605291, y: -1107599, z: 101674 };
  const groups = groupSupportReportEvidenceByLocation([
    clashRow('/PS-12005.1', point, { branchNode: `/${line}/B4` }),
    clashRow('/PS-12005.2', point, { branchNode: `/${line}/B5` }),
  ]);
  assert.equal(groups.length, 2);
  assert.ok(groups.every((group) => group.locationCountOnPipe === 2));
});

test('PS-12060 multi-member benchmark geometry resolves to one bore-axis occurrence', () => {
  const fullLineTag = 'ASIM-1885-10"-S8810101-91261M7-HC-01';
  const branchNode = `/${fullLineTag}/B1`;
  const groups = groupSupportReportEvidenceByLocation([
    clashRow('/PS-12060.1', { x: 593503, y: 1120926, z: 102894 }, { secondarySupportFamilyId: 'PS-12060', fullLineTag, branchNode }),
    clashRow('/PS-12060.2', { x: 593439, y: 1120926, z: 102894 }, { secondarySupportFamilyId: 'PS-12060', fullLineTag, branchNode }),
    clashRow('/PS-12060.6', { x: 593553, y: 1120765, z: 102894 }, { secondarySupportFamilyId: 'PS-12060', fullLineTag, branchNode }),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].totalSupportPointsOnSecondary, 1);
  assert.deepEqual(groups[0].primarySupportMemberIds, ['/PS-12060.1', '/PS-12060.2', '/PS-12060.6']);
  assert.ok(groups[0].locationGroupingBasis.includes('WITHIN_BORE_AXIS_WINDOW'));
  assert.equal(groups[0].locationNominalBoreMm, 250);
  assert.equal(groups[0].locationAxialToleranceMm, 1000);
  assert.equal(groups[0].locationLateralToleranceMm, 150);
});

test('multi-location rows receive only staged members attributable to that location', () => {
  const one = nativeMember('/PS-12005.1', { x: 10, y: 20, z: 30 }, { CMPSUPTYPE: 'PG-50' });
  const two = nativeMember('/PS-12005.2', { x: 40, y: 50, z: 60 }, { CMPSUPTYPE: 'REST-50' });
  const report = buildSupportReportBundle({
    clashEvidence: {
      schema: 'SupportReportClashEvidence.v1',
      rows: [{}, {}],
      groups: [reportGroup('/PS-12005.1', 0, 2, 605291), reportGroup('/PS-12005.2', 1, 2, 606000)],
      diagnostics: [],
    },
    relationshipBundle: relationshipBundle([one, two]),
  });
  assert.equal(report.rows.length, 2);
  assert.deepEqual(report.rows.map((row) => row.pipingPrimarySupport), ['/PS-12005.1', '/PS-12005.2']);
  assert.deepEqual(report.rows[0].evidence.selectedNativeMemberIds, ['/PS-12005.1']);
  assert.deepEqual(report.rows[1].evidence.selectedNativeMemberIds, ['/PS-12005.2']);
  assert.ok(report.rows.every((row) => row.remarks === SUPPORT_REPORT_MULTI_LOCATION_REMARK));
  assert.ok(report.rows.every((row) => row.evidence.jsonTrace.memberAttributionBasis === 'MULTI_LOCATION_OBSERVED_MEMBER_ONLY'));

  const trace = supportReportTraceRows(report);
  assert.ok(trace.every((row) => row['MEMBER ATTRIBUTION BASIS'] === 'MULTI_LOCATION_OBSERVED_MEMBER_ONLY'));
  assert.ok(trace.every((row) => row['LOCATION GROUPING BASIS'] === 'SINGLE_EVIDENCE_POINT'));
});

test('single-location pipe retains family-line staged enrichment', () => {
  const one = nativeMember('/PS-12005.1', { x: 10, y: 20, z: 30 });
  const two = nativeMember('/PS-12005.2', { x: 10, y: 20, z: 30 });
  const group = reportGroup('/PS-12005.1', 0, 1, 605291);
  const report = buildSupportReportBundle({
    clashEvidence: { schema: 'SupportReportClashEvidence.v1', rows: [{}], groups: [group], diagnostics: [] },
    relationshipBundle: relationshipBundle([one, two]),
  });
  const row = report.rows[0];
  assert.equal(row.pipingPrimarySupport, '/PS-12005.1, /PS-12005.2');
  assert.deepEqual(row.evidence.selectedNativeMemberIds, ['/PS-12005.1', '/PS-12005.2']);
  assert.equal(row.evidence.jsonTrace.memberAttributionBasis, 'SINGLE_LOCATION_FAMILY_LINE_ENRICHMENT');
  assert.equal(row.remarks.includes(SUPPORT_REPORT_MULTI_LOCATION_REMARK), false);
});