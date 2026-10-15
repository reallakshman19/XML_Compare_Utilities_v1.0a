import assert from 'node:assert/strict';
import test from 'node:test';
import {
  projectSupportReportFieldProvenance,
  SUPPORT_REPORT_FIELD_SOURCE_CLASSES,
} from '../tabs/support-steel-relationship-builder/support-report-field-projection.js';

const group = Object.freeze({
  scope: 'ASIM',
  secondarySupportFamilyId: 'PS-007',
  fullLineTag: 'ASIM-1885-PL-10"-S8810105-HOT-01',
  totalSupportPointsOnSecondary: 5,
  primaryPaths: [['/ASIM-1885-CU-PL', '/ASIM-1885-CU-PL-S']],
});
const members = Object.freeze([
  Object.freeze({ memberId: '/PS-007.6', attributes: { CMPSUPTYPE: 'MDS/AT05-10-PMP' }, sourcePath: [] }),
  Object.freeze({ memberId: '/PS-007.7', attributes: { CMPSUPTYPE: 'SHOE-250' }, sourcePath: [] }),
]);

test('native coordinate provenance names only the winning position member', () => {
  const evidence = projectSupportReportFieldProvenance({
    group,
    reportMembers: members,
    carrierRows: [{ carrierObjectId: '/PIPE-10', attributes: { ABORE: '250', PIPE_SCHEDULE: 'PIPE Sch 100' } }],
    coordinateSource: 'NATIVE_MEMBER_POSITION',
    coordinateSourceIds: ['/PS-007.7'],
    selectedNativeMemberCount: members.length,
  });
  assert.equal(evidence.pipingPrimarySupport.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.NATIVE_MEMBERSHIP);
  assert.deepEqual(evidence.pipingPrimarySupport.sourceIds, ['/PS-007.6', '/PS-007.7']);
  assert.equal(evidence.eastWest.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.NATIVE_MEMBER_POSITION);
  assert.deepEqual(evidence.eastWest.sourceIds, ['/PS-007.7']);
  assert.deepEqual(evidence.northSouth.sourceIds, ['/PS-007.7']);
  assert.deepEqual(evidence.bopElevation.sourceIds, ['/PS-007.7']);
  assert.equal(evidence.pipeSchedule.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.CARRIER_ATTRIBUTE);
  assert.deepEqual(evidence.pipeSchedule.sourceIds, ['/PIPE-10']);
});

test('clash coordinate fallback and unresolved fields never claim native source identity', () => {
  const evidence = projectSupportReportFieldProvenance({
    group,
    reportMembers: [{ memberId: '/PS-007.7', attributes: {}, sourcePath: [] }],
    carrierRows: [],
    coordinateSource: 'CLASH_POINT_FALLBACK',
    coordinateSourceIds: [],
    selectedNativeMemberCount: 0,
  });
  assert.equal(evidence.pipingPrimarySupport.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.CLASH_MEMBER_FALLBACK);
  assert.equal(evidence.eastWest.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.CLASH_POINT_FALLBACK);
  assert.deepEqual(evidence.eastWest.sourceIds, []);
  assert.equal(evidence.pipeSchedule.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.UNRESOLVED);
  assert.equal(evidence.pipeSchedule.confidenceClass, 'UNRESOLVED');
});