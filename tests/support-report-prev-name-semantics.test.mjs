import assert from 'node:assert/strict';
import test from 'node:test';
import {
  supportReportPreviousName,
  supportReportPreviousNameAliases,
  supportReportPreviousNameEvidence,
} from '../tabs/support-steel-relationship-builder/support-report-field-normalization.js?issue=1210';
import {
  buildSupportReportJsonTrace,
  resolveSupportReportObservedMembers,
} from '../tabs/support-steel-relationship-builder/support-report-json-trace.js?issue=1210';
import { buildSupportReportBundle } from '../tabs/support-steel-relationship-builder/support-report-engine.js?issue=1210';
import {
  supportReportTraceRows,
  supportReportTraceSummary,
} from '../tabs/support-steel-relationship-builder/support-report-trace-export.js?issue=1210';

const LINE = 'ASIM-1885-8"-S8810103-91261M7-HC-01';
const BRANCH = `/${LINE}/B1`;

function member(memberId, previousName) {
  return {
    memberId,
    semanticRole: 'OTHER_FAMILY_MEMBER',
    attributes: { 'PREV-NAME': previousName, CMPSUPTYPE: 'GUIDE' },
    positionGlobal: { x: 445580.151, y: -1163935.927, z: 3209.55 },
    sourcePath: ['/ASIM-1885-CU-PI', '/ASIM-1885-CU-PI-D', `/${LINE}`, BRANCH, memberId],
    sourceParentBranch: BRANCH,
    lineContext: { fullLineTag: LINE, branchNode: BRANCH },
  };
}

function group(observedMemberIds, familyId = 'PS-12034') {
  return Object.freeze({
    groupId: `${familyId}::${LINE}`,
    secondarySupportFamilyId: familyId,
    fullLineTag: LINE,
    scope: 'ASIM',
    branchNodes: [BRANCH],
    primarySupportMemberIds: observedMemberIds,
    clashPointsGlobalMm: [{ x: 445580, y: -1163936, z: 101680 }],
    representativeClashPointGlobalMm: { x: 445580, y: -1163936, z: 101680 },
    primaryPaths: [['/ASIM-1885-CU-PI', '/ASIM-1885-CU-PI-D', `/${LINE}`, BRANCH]],
    secondaryPaths: [['/ASIM-1885-CU-SU', `/${familyId}`]],
    evidenceRows: [{}], clashCount: 1, totalSupportPointsOnSecondary: 1,
    locationIndex: 0, locationCountOnPipe: 1, locationMergeToleranceMm: 50,
    locationGroupingBasis: ['SINGLE_CLASH_POINT'], multipleLocationsOnPipe: false,
  });
}

function relationshipBundle(familyId, members) {
  return {
    schema: 'SupportSteelRelationshipBundle.v1',
    supportFamilies: [{ familyId, members }],
    supportCarrierResolution: { carrierObjects: [] },
  };
}

function clashEvidence(value) {
  return { schema: 'SupportReportClashEvidence.v1', rows: [{}], groups: [value], diagnostics: [] };
}

test('DBREF-form PREV-NAME is rejected while a mixed legitimate support alias is preserved', () => {
  const value = member('/PS-12034.9', '=1006649732/51434; /PS-12034.8');
  const evidence = supportReportPreviousNameEvidence(value);
  assert.equal(supportReportPreviousName(value), '/PS-12034.8');
  assert.deepEqual(supportReportPreviousNameAliases(value), ['/PS-12034.8']);
  assert.deepEqual(evidence.rejectedDbrefTokens, ['=1006649732/51434']);
  assert.deepEqual(evidence.reportableTokens, ['/PS-12034.8']);
});

test('legacy and Copy-of previous support names remain reportable', () => {
  const value = member('/PS-12034.9', 'PS02689.1; Copy-of-PS-12636.2');
  assert.equal(supportReportPreviousName(value), 'PS02689.1, Copy-of-PS-12636.2');
  assert.deepEqual(supportReportPreviousNameAliases(value), ['PS02689.1', 'Copy-of-PS-12636.2']);
});

test('canonical report leaves DBREF-only PREV NAME blank and exposes the rejected source in trace', () => {
  const native = member('/PS-12034.9', '=1006649732/51434');
  const report = buildSupportReportBundle({
    clashEvidence: clashEvidence(group(['/PS-12034.9'])),
    relationshipBundle: relationshipBundle('PS-12034', [native]),
  });
  const row = report.rows[0];
  assert.equal(row.previousName, '');
  assert.equal(row.evidence.fieldProvenance.previousName.sourceClass, 'UNRESOLVED');
  assert.equal(row.evidence.jsonTrace.members[0].attributeEvidence.previousName, '');
  assert.equal(row.evidence.jsonTrace.members[0].attributeEvidence.previousNameRaw, '=1006649732/51434');
  assert.equal(row.evidence.jsonTrace.members[0].attributeEvidence.previousNameRejectedDbref, '=1006649732/51434');
  const trace = supportReportTraceRows(report)[0];
  assert.equal(trace['PREV NAME'], '');
  assert.equal(trace['REJECTED PREV NAME DBREF'], '=1006649732/51434');
  assert.equal(supportReportTraceSummary(report).rejectedPreviousNameDbrefCount, 1);
});

test('mixed PREV-NAME keeps only reportable alias in report while retaining DBREF evidence', () => {
  const native = member('/PS-12034.9', '=1006649732/51434; /PS-12034.8');
  const report = buildSupportReportBundle({
    clashEvidence: clashEvidence(group(['/PS-12034.9'])),
    relationshipBundle: relationshipBundle('PS-12034', [native]),
  });
  assert.equal(report.rows[0].previousName, '/PS-12034.8');
  assert.equal(report.rows[0].evidence.fieldProvenance.previousName.sourceClass, 'AUTHORITATIVE_NATIVE_MEMBER_ATTRIBUTE');
  const trace = supportReportTraceRows(report)[0];
  assert.equal(trace['PREV NAME'], '/PS-12034.8');
  assert.equal(trace['REJECTED PREV NAME DBREF'], '=1006649732/51434');
});

test('explicit /SL PREV-NAME remains rename authority while a DBREF token is never an alias', () => {
  const renamed = member('/PS-068.2', '/SL-147.1; =1006649732/99999');
  const family = relationshipBundle('PS-068', [renamed]);
  const mismatchGroup = group(['/SL-147.1'], 'PS-068');
  const alias = resolveSupportReportObservedMembers(family, ['/SL-147.1'], mismatchGroup).matches[0];
  assert.equal(alias.matchBasis, 'PREVIOUS_NAME_ALIAS');
  assert.equal(alias.member.memberId, '/PS-068.2');
  const dbref = resolveSupportReportObservedMembers(family, ['=1006649732/99999'], mismatchGroup).matches[0];
  assert.equal(dbref.matchBasis, 'UNRESOLVED');

  const trace = buildSupportReportJsonTrace({ group: mismatchGroup, observedMatches: [alias], nativeMembers: [renamed] });
  assert.equal(trace.schema, 'SupportReportJsonTrace.v3');
  assert.equal(trace.members[0].attributeEvidence.previousName, '/SL-147.1');
  assert.equal(trace.members[0].attributeEvidence.previousNameRejectedDbref, '=1006649732/99999');
});
