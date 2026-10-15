import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSupportReportBundle } from '../tabs/support-steel-relationship-builder/support-report-engine.js?issue=1196';
import {
  buildSupportReportJsonTrace,
} from '../tabs/support-steel-relationship-builder/support-report-json-trace.js?issue=1196';
import {
  projectSupportReportFields,
} from '../tabs/support-steel-relationship-builder/support-report-field-projection.js?issue=1196';

const line = 'ASIM-1885-2"-D8810242-11441T3-PP-01';
const branch = `/${line}/B4`;

function member(memberId, positionGlobal, attributes = {}) {
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
function group(primarySupportMemberIds) {
  return Object.freeze({
    groupId: `PS-12005::${line}::L1`,
    secondarySupportFamilyId: 'PS-12005',
    fullLineTag: line,
    scope: 'ASIM',
    branchNodes: [branch],
    primarySupportMemberIds,
    clashPointsGlobalMm: [{ x: 605290, y: -1107599, z: 101680 }],
    representativeClashPointGlobalMm: { x: 605290, y: -1107599, z: 101680 },
    primaryPaths: [['/ASIM-1885-CU-PI', '/ASIM-1885-CU-PI-D', `/${line}`, branch, ...primarySupportMemberIds]],
    secondaryPaths: [['/ASIM-1835-CU-SU', '/PS-12005']],
    evidenceRows: [{}], clashCount: 1, totalSupportPointsOnSecondary: 1,
    locationIndex: 0, locationCountOnPipe: 1, locationMergeToleranceMm: 50, multipleLocationsOnPipe: false,
  });
}
function bundle(members) {
  return {
    schema: 'SupportSteelRelationshipBundle.v1',
    supportFamilies: [{ familyId: 'PS-12005', members }],
    supportCarrierResolution: { carrierObjects: [] },
  };
}
function evidence(primarySupportMemberIds) {
  return { schema: 'SupportReportClashEvidence.v1', rows: [{}], groups: [group(primarySupportMemberIds)], diagnostics: [] };
}

test('JSON trace groups members sharing the same native POS into one deterministic cluster', () => {
  const point = { x: 605290.006, y: -1107598.597, z: 1704.863 };
  const one = member('/PS-12005.1', point, { CMPSUPTYPE: 'PG-50' });
  const two = member('/PS-12005.2', point, { CMPSUPTYPE: 'REST-50' });
  const trace = buildSupportReportJsonTrace({
    group: group(['/PS-12005.1', '/PS-12005.2']),
    observedMatches: [
      { observedMemberId: '/PS-12005.1', member: one, matchBasis: 'DIRECT_MEMBER_ID' },
      { observedMemberId: '/PS-12005.2', member: two, matchBasis: 'DIRECT_MEMBER_ID' },
    ],
    nativeMembers: [one, two],
  });
  assert.equal(trace.posClusters.length, 1);
  assert.match(trace.posClusters[0].posClusterId, /^POS:/);
  assert.deepEqual(trace.posClusters[0].resolvedMemberIds, ['/PS-12005.1', '/PS-12005.2']);
  assert.deepEqual(trace.posClusters[0].observedMemberIds, ['/PS-12005.1', '/PS-12005.2']);
  assert.deepEqual(trace.posClusters[0].positionGlobal, point);
  assert.equal(trace.posClusters[0].members.length, 2);
});

test('report coordinates stay on Navisworks location while native POS remains trace evidence', () => {
  const native = member('/PS-12005.1', { x: 605290.006, y: -1107598.597, z: 1704.863 }, {
    CMPSUPTYPE: 'PG-50', REF: '=1006649732/52813', DTXR: 'GUIDE',
  });
  const report = buildSupportReportBundle({
    clashEvidence: evidence(['/PS-12005', '/PS-12005.1']),
    relationshipBundle: bundle([native]),
  });
  const row = report.rows[0];
  assert.equal(row.eastWest, 'E 605290 mm');
  assert.equal(row.northSouth, 'S 1107599 mm');
  assert.equal(row.bopElevation, 'U 101680 mm');
  assert.equal(row.pipingPrimarySupport, '/PS-12005.1');
  assert.equal(row.evidence.fieldProvenance.eastWest.sourceClass, 'CLASH_POINT_FALLBACK');
  assert.equal(row.evidence.nativeCoordinateAvailable, true);
  const bases = row.evidence.jsonTrace.members.map((item) => item.matchBasis);
  assert.deepEqual(bases, ['UNRESOLVED', 'DIRECT_MEMBER_ID']);
  assert.equal(row.evidence.jsonTrace.posClusters.length, 2);
  assert.ok(row.evidence.jsonTrace.posClusters.some((item) => item.posClusterId === 'UNRESOLVED_POS'));
  assert.ok(row.evidence.jsonTrace.posClusters.some((item) => item.posClusterId.startsWith('POS:')));
});

test('family-only clash token stays evidence-only and is not fabricated as primary support', () => {
  const report = buildSupportReportBundle({ clashEvidence: evidence(['/PS-12005']), relationshipBundle: bundle([]) });
  const row = report.rows[0];
  assert.equal(row.pipingPrimarySupport, '');
  assert.deepEqual(row.evidence.selectedNativeMemberIds, []);
  assert.deepEqual(row.evidence.jsonTrace.members.map((item) => item.matchBasis), ['UNRESOLVED']);
  assert.equal(row.evidence.jsonTrace.posClusters[0].posClusterId, 'UNRESOLVED_POS');
});

test('PREV NAME suppresses no-op aliases and SIZE normalizes staged BORE with nominal fallback', () => {
  const baseGroup = group(['/PS-12005.1']);
  const sameName = member('/PS-12005.1', null, { 'PREV-NAME': '/PS-12005.1' });
  const renamed = member('/PS-12005.2', null, { 'PREV-NAME': '/Copy-of-PS-12636.2' });
  const boreFields = projectSupportReportFields({
    group: baseGroup,
    reportMembers: [sameName],
    carrierRows: [{ carrierObjectId: '/PIPE', attributes: { BORE: '50mm', ABORE: '999' } }],
    coordinatePoint: null,
  });
  assert.equal(boreFields.previousName, '');
  assert.equal(boreFields.size, 50);
  const renamedFields = projectSupportReportFields({ group: baseGroup, reportMembers: [renamed], carrierRows: [], coordinatePoint: null });
  assert.equal(renamedFields.previousName, '/Copy-of-PS-12636.2');
  assert.equal(renamedFields.size, 50);
});
