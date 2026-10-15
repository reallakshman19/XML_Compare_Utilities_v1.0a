import assert from 'node:assert/strict';
import test from 'node:test';
import {
  projectSupportReportFieldProvenance,
  projectSupportReportFields,
  SUPPORT_REPORT_FIELD_SOURCE_CLASSES,
} from '../tabs/support-steel-relationship-builder/support-report-field-projection.js';

const baseGroup = {
  scope: 'ASIM',
  secondarySupportFamilyId: 'PS-12154',
  fullLineTag: 'ASIM-1885-2"-D8810003-11441T3-PP-01',
  totalSupportPointsOnSecondary: 6,
  primaryPaths: [[
    '/ASIM-1885-CU-PI',
    '/ASIM-1885-CU-PI-D',
    '/ASIM-1885-2"-D8810003-11441T3-PP-01',
    '/ASIM-1885-2"-D8810003-11441T3-PP-01/B4',
    '/PS-12154.2',
  ]],
};

function project({ group = baseGroup, members = [], carriers = [] } = {}) {
  return projectSupportReportFields({
    group,
    reportMembers: members,
    carrierRows: carriers,
    coordinatePoint: null,
  });
}

test('staged JSON BORE takes precedence over ABORE and line-tag regex', () => {
  const fields = project({
    carriers: [{ carrierObjectId: '/PIPE', attributes: { BORE: '80', ABORE: '50' } }],
  });
  assert.equal(fields.size, 80);
});

test('line-tag nominal size remains fallback only when staged bore evidence is absent', () => {
  assert.equal(project().size, 50);
});

test('CU-PI clash hierarchy populates PS-12154 Site and Zone', () => {
  const fields = project();
  assert.equal(fields.primarySupportSite, 'ASIM-1885-CU-PI');
  assert.equal(fields.primarySupportZone, 'ASIM-1885-CU-PI-D');
});

test('native staged sourcePath outranks clash path for Site and Zone', () => {
  const members = [{
    memberId: '/PS-12154.2',
    sourcePath: ['/ASIM-1885-CU-PI', '/ASIM-1885-CU-PI-D', '/PS-12154.2'],
    attributes: {},
  }];
  const group = { ...baseGroup, primaryPaths: [['/ASIM-1885-CU-PL', '/ASIM-1885-CU-PL-S']] };
  const fields = project({ group, members });
  assert.equal(fields.primarySupportSite, 'ASIM-1885-CU-PI');
  assert.equal(fields.primarySupportZone, 'ASIM-1885-CU-PI-D');
  const evidence = projectSupportReportFieldProvenance({
    group,
    reportMembers: members,
    carrierRows: [],
    selectedNativeMemberCount: 1,
  });
  assert.equal(evidence.primarySupportSite.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.NATIVE_MEMBER_PATH);
  assert.equal(evidence.primarySupportZone.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.NATIVE_MEMBER_PATH);
});

test('conflicting staged Site/Zone evidence stays blank and fail-visible', () => {
  const members = [
    { memberId: '/PS-12154.2', sourcePath: ['/ASIM-1885-CU-PI', '/ASIM-1885-CU-PI-D'], attributes: {} },
    { memberId: '/PS-12154.5', sourcePath: ['/ASIM-1885-CU-PI', '/ASIM-1885-CU-PI-P'], attributes: {} },
  ];
  const fields = project({ members });
  assert.equal(fields.primarySupportSite, 'ASIM-1885-CU-PI');
  assert.equal(fields.primarySupportZone, '');
  const evidence = projectSupportReportFieldProvenance({
    group: baseGroup,
    reportMembers: members,
    carrierRows: [],
    selectedNativeMemberCount: 2,
  });
  assert.equal(evidence.primarySupportZone.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.SOURCE_CONFLICT);
  assert.equal(evidence.primarySupportZone.valueStatus, 'CONFLICT');
});

test('explicit BORE on one staged carrier outranks alternate ABORE evidence elsewhere', () => {
  const carriers = [
    { carrierObjectId: '/PIPE-A', attributes: { BORE: '80', ABORE: '50' } },
    { carrierObjectId: '/PIPE-B', attributes: { ABORE: '50' } },
  ];
  const fields = project({ carriers });
  assert.equal(fields.size, 80);
  const evidence = projectSupportReportFieldProvenance({
    group: baseGroup,
    reportMembers: [],
    carrierRows: carriers,
  });
  assert.equal(evidence.size.sourceClass, SUPPORT_REPORT_FIELD_SOURCE_CLASSES.CARRIER_ATTRIBUTE);
  assert.deepEqual(evidence.size.sourceIds, ['/PIPE-A']);
});
