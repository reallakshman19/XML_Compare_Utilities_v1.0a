import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSupportReportBundle } from '../tabs/support-steel-relationship-builder/support-report-engine.js?v=20260910-support-report-json-trace-18';

const line = 'ASIM-1885-PL-8"-S8810104-HOT-01';
const branch = `/${line}/B2`;
const group = Object.freeze({
  groupId: `PS-068::${line}`,
  secondarySupportFamilyId: 'PS-068',
  fullLineTag: line,
  scope: 'ASIM',
  branchNodes: [branch],
  primarySupportMemberIds: ['/SL-147.1'],
  clashPointsGlobalMm: [{ x: 524569, y: -1124043, z: 99650 }],
  representativeClashPointGlobalMm: { x: 524569, y: -1124043, z: 99650 },
  primaryPaths: [['/ASIM-1885-CU-PL', '/ASIM-1885-CU-PL-S', `/${line}`, branch, '/SL-147.1']],
  secondaryPaths: [['/ASIM-1835-CU-SU', '/PS-068']],
  evidenceRows: [{}], clashCount: 1, totalSupportPointsOnSecondary: 5,
  locationIndex: 0, locationCountOnPipe: 1, locationMergeToleranceMm: 50, multipleLocationsOnPipe: false,
});

function member(memberId, attributes, fullLineTag = line) {
  return {
    memberId, semanticRole: 'OTHER_FAMILY_MEMBER', attributes,
    positionGlobal: { x: 524570, y: -1124042, z: 99651 },
    sourcePath: ['objects', 7, 'children', 2],
    sourceParentBranch: branch,
    lineContext: { fullLineTag, branchNode: branch },
  };
}
function bundle(families) {
  return { schema: 'SupportSteelRelationshipBundle.v1', supportFamilies: families, supportCarrierResolution: { carrierObjects: [] } };
}
function clashEvidence() {
  return { schema: 'SupportReportClashEvidence.v1', rows: [{}], groups: [group], diagnostics: [] };
}

test('direct staged PS/SL identity enriches a cross-family observed member and preserves mismatch evidence', () => {
  const staged = member('/SL-147.1', {
    CMPSUPTYPE: 'REST', REF: '=123/45', DTXR: 'Pipe Rest XRT01', INSU: '40mm',
  });
  const report = buildSupportReportBundle({
    clashEvidence: clashEvidence(),
    relationshipBundle: bundle([{ familyId: 'PS-068', members: [] }, { familyId: 'SL-147', members: [staged] }]),
  });
  const row = report.rows[0];
  assert.equal(row.pipingPrimarySupport, '/SL-147.1');
  assert.equal(row.supportType, 'REST');
  assert.equal(row.pipingPrimarySupportReference, '=123/45');
  assert.equal(row.primarySupportDescription, 'Pipe Rest XRT01');
  assert.equal(row.pipeInsulationThickness, '40mm');
  assert.match(row.remarks, /family mismatch/i);
  assert.equal(row.evidence.jsonTrace.members[0].matchBasis, 'DIRECT_MEMBER_ID');
  assert.equal(row.evidence.jsonTrace.members[0].positionBasis, 'NATIVE_MEMBER_POSITION');
  assert.equal(row.evidence.jsonTrace.members[0].attributeEvidence.supportType, 'REST');
});

test('explicit PREV-NAME alias resolves the renamed current support without inventing an identity', () => {
  const staged = member('/PS-068.5', {
    'PREV-NAME': '/SL-147.1', CMPSUPTYPE: 'GUIDE', REF: '=777/88', DTXR: 'Pipe Guide', INSU: '25mm',
  });
  const report = buildSupportReportBundle({
    clashEvidence: clashEvidence(),
    relationshipBundle: bundle([{ familyId: 'PS-068', members: [staged] }]),
  });
  const row = report.rows[0];
  assert.equal(row.pipingPrimarySupport, '/PS-068.5');
  assert.equal(row.previousName, '/SL-147.1');
  assert.equal(row.supportType, 'GUIDE');
  assert.equal(row.remarks, 'Primary support renamed from /SL-147.1');
  const trace = row.evidence.jsonTrace.members.find((item) => item.observedMemberId === '/SL-147.1');
  assert.equal(trace.resolvedMemberId, '/PS-068.5');
  assert.equal(trace.matchBasis, 'PREVIOUS_NAME_ALIAS');
});

test('direct identity with contradictory explicit line context cannot silently enrich the row', () => {
  const staged = member('/SL-147.1', { CMPSUPTYPE: 'REST' }, 'ASIM-1885-OTHER-LINE');
  const report = buildSupportReportBundle({
    clashEvidence: clashEvidence(),
    relationshipBundle: bundle([{ familyId: 'PS-068', members: [] }, { familyId: 'SL-147', members: [staged] }]),
  });
  const row = report.rows[0];
  assert.equal(row.supportType, '');
  assert.equal(row.evidence.selectedNativeMemberIds.length, 0);
  assert.equal(row.evidence.jsonTrace.members[0].matchBasis, 'DIRECT_MEMBER_ID_LINE_CONFLICT');
});
