import assert from 'node:assert/strict';
import test from 'node:test';
import {
  projectSupportReportFieldProvenance,
  projectSupportReportFields,
  SUPPORT_REPORT_FIELD_SOURCE_CLASSES,
  supportReportCarrierAttributeConflicts,
} from '../tabs/support-steel-relationship-builder/support-report-field-projection.js';

const group = Object.freeze({
  scope: 'ASIM',
  secondarySupportFamilyId: 'PS-007',
  fullLineTag: 'ASIM-1885-PL-10"-S8810105-HOT-01',
  totalSupportPointsOnSecondary: 5,
  primaryPaths: [['/ASIM-1885-CU-PL', '/ASIM-1885-CU-PL-S']],
});
const member = Object.freeze({
  memberId: '/PS-007.7',
  semanticRole: 'OTHER_FAMILY_MEMBER',
  sourcePath: ['/ASIM-1885-CU-PL', '/ASIM-1885-CU-PL-S', '/PS-007.7'],
  attributes: Object.freeze({ CMPSUPTYPE: 'SHOE-250', PREV_NAME: 'PS05503' }),
});

function project(attributes) {
  return projectSupportReportFields({
    group,
    reportMembers: [member],
    carrierRows: [{ carrierObjectId: '/PIPE-10', attributes }],
    coordinatePoint: { x: 798423, y: -1125028, z: 100100.45 },
  });
}

test('native carrier attributes project revision and combined insulation without inference', () => {
  const fields = project({
    ABORE: '250',
    PIPE_SCHEDULE: 'PIPE Sch 100',
    PIPE_INSULATION_TYPE: 'HC',
    PIPE_INSULATION_THICKNESS: '80mm',
    STRESS_SYSTEM_NUMBER: 'QSP-SYS-01',
    NODE_NO: '280',
    REVISION: '5',
  });
  assert.equal(fields.previousName, 'PS05503');
  assert.equal(fields.supportType, 'SHOE-250');
  assert.equal(fields.pipeInsulationTypeAndThickness, 'HC 80mm');
  assert.equal(fields.stressSystemNumber, 'QSP-SYS-01');
  assert.equal(fields.nodeNumber, '280');
  assert.equal(fields.revision, '5');
});

test('missing revision stays blank rather than synthesized', () => {
  const fields = project({ PIPE_INSULATION_TYPE: 'HC', PIPE_INSULATION_THICKNESS: '80mm' });
  assert.equal(fields.revision, '');
});

test('semantic role does not synthesize SUPPORT TYPE when native type is missing', () => {
  const classifiedMember = {
    ...member,
    semanticRole: 'PIPE_SHOE',
    attributes: { PREV_NAME: 'PS05503' },
  };
  const fields = projectSupportReportFields({
    group,
    reportMembers: [classifiedMember],
    carrierRows: [],
    coordinatePoint: null,
  });
  assert.equal(fields.supportType, '');
});

test('carrier attribute consensus ignores blanks and preserves one known value', () => {
  const carriers = [
    { carrierObjectId: '/PIPE-A', attributes: { PIPE_SCHEDULE: 'PIPE Sch 100' } },
    { carrierObjectId: '/PIPE-B', attributes: { PIPE_SCHEDULE: 'PIPE Sch 100' } },
    { carrierObjectId: '/PIPE-C', attributes: {} },
  ];
  const fields = projectSupportReportFields({ group, reportMembers: [member], carrierRows: carriers, coordinatePoint: null });
  assert.equal(fields.pipeSchedule, 'PIPE Sch 100');
  assert.deepEqual(supportReportCarrierAttributeConflicts(carriers), []);
});

test('conflicting carrier schedule is blank and reported with carrier values', () => {
  const carriers = [
    { carrierObjectId: '/PIPE-B', attributes: { PIPE_SCHEDULE: 'PIPE Sch 120' } },
    { carrierObjectId: '/PIPE-A', attributes: { PIPE_SCHEDULE: 'PIPE Sch 100' } },
  ];
  const fields = projectSupportReportFields({ group, reportMembers: [member], carrierRows: carriers, coordinatePoint: null });
  assert.equal(fields.pipeSchedule, '');
  const conflicts = supportReportCarrierAttributeConflicts(carriers);
  assert.deepEqual(conflicts.map((item) => item.field), ['pipeSchedule']);
  assert.deepEqual(conflicts[0].values, ['PIPE Sch 100', 'PIPE Sch 120']);
  assert.deepEqual(conflicts[0].carrierValues, [
    { carrierObjectId: '/PIPE-A', value: 'PIPE Sch 100' },
    { carrierObjectId: '/PIPE-B', value: 'PIPE Sch 120' },
  ]);
});

test('conflicting native size stays blank and is not replaced by line-tag derivation', () => {
  const carriers = [
    { carrierObjectId: '/PIPE-A', attributes: { ABORE: '250' } },
    { carrierObjectId: '/PIPE-B', attributes: { ABORE: '300' } },
  ];
  const fields = projectSupportReportFields({ group, reportMembers: [member], carrierRows: carriers, coordinatePoint: null });
  assert.equal(fields.size, '');
  assert.deepEqual(supportReportCarrierAttributeConflicts(carriers).map((item) => item.field), ['size']);
});

test('field provenance distinguishes native membership, carrier attributes and native coordinates', () => {
  const carriers = [{
    carrierObjectId: '/PIPE-10',
    attributes: { ABORE: '250', PIPE_SCHEDULE: 'PIPE Sch 100', PIPE_INSULATION_TYPE: 'HC' },
  }];
  const evidence = projectSupportReportFieldProvenance({
    group,
    reportMembers: [member],
    carrierRows: carriers,
    coordinateSource: 'NATIVE_MEMBER_POSITION',
    selectedNativeMemberCount: 1,
  });
  assert.equal(evidence.pipingPrimarySupport.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.NATIVE_MEMBERSHIP);
  assert.equal(evidence.supportType.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.NATIVE_MEMBER_ATTRIBUTE);
  assert.equal(evidence.size.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.CARRIER_ATTRIBUTE);
  assert.equal(evidence.pipeSchedule.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.CARRIER_ATTRIBUTE);
  assert.equal(evidence.eastWest.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.NATIVE_MEMBER_POSITION);
  assert.equal(evidence.primarySupportZone.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.NATIVE_MEMBER_PATH);
  assert.equal(evidence.revision.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.UNRESOLVED);
  assert.equal(evidence.size.confidenceClass, 'AUTHORITATIVE');
  assert.deepEqual(evidence.size.sourceIds, ['/PIPE-10']);
});

test('XML-only provenance labels clash fallbacks and deterministic line-size derivation', () => {
  const clashMember = { memberId: '/PS-007.7', attributes: {}, sourcePath: [] };
  const evidence = projectSupportReportFieldProvenance({
    group,
    reportMembers: [clashMember],
    carrierRows: [],
    coordinateSource: 'CLASH_POINT_FALLBACK',
    selectedNativeMemberCount: 0,
  });
  assert.equal(evidence.pipingPrimarySupport.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.CLASH_MEMBER_FALLBACK);
  assert.equal(evidence.size.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.LINE_TAG_DERIVATION);
  assert.equal(evidence.eastWest.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.CLASH_POINT_FALLBACK);
  assert.equal(evidence.pipeSchedule.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.UNRESOLVED);
  assert.equal(evidence.pipeSchedule.valueStatus, 'UNRESOLVED');
  assert.equal(evidence.eastWest.confidenceClass, 'FALLBACK');
});

test('field provenance exposes authoritative conflicts without pseudo-confidence', () => {
  const carriers = [
    { carrierObjectId: '/PIPE-A', attributes: { ABORE: '250', PIPE_SCHEDULE: 'PIPE Sch 100' } },
    { carrierObjectId: '/PIPE-B', attributes: { ABORE: '300', PIPE_SCHEDULE: 'PIPE Sch 120' } },
  ];
  const evidence = projectSupportReportFieldProvenance({
    group,
    reportMembers: [member],
    carrierRows: carriers,
    coordinateSource: 'UNRESOLVED',
    selectedNativeMemberCount: 1,
  });
  assert.equal(evidence.size.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.SOURCE_CONFLICT);
  assert.equal(evidence.size.confidenceClass, 'CONFLICT');
  assert.deepEqual(evidence.size.sourceIds, ['/PIPE-A', '/PIPE-B']);
  assert.deepEqual(evidence.size.values, [250, 300]);
  assert.equal(evidence.pipeSchedule.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.SOURCE_CONFLICT);
  assert.equal(evidence.eastWest.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.UNRESOLVED);
});

test('blank native remarks preserve membership structure without claiming an attribute value', () => {
  const evidence = projectSupportReportFieldProvenance({
    group,
    reportMembers: [{ ...member, attributes: {} }],
    carrierRows: [],
    coordinateSource: 'UNRESOLVED',
    selectedNativeMemberCount: 1,
  });
  assert.equal(evidence.remarks.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.NATIVE_MEMBER_LIST_STRUCTURE);
  assert.equal(evidence.remarks.valueStatus, 'STRUCTURE_ONLY');
  assert.equal(evidence.supportType.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.UNRESOLVED);
});
