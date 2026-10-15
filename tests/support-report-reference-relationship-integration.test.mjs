import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSupportReportBundle } from '../tabs/support-steel-relationship-builder/support-report-engine.js?issue=1222-reference-relationship';
import {
  buildReferenceSupportPrimaryRelationshipInput,
  buildSupportPrimaryRelationshipInput,
  SUPPORT_PRIMARY_REFERENCE_SCOPE_BASIS,
} from '../tabs/support-steel-relationship-builder/support-primary-input.js';
import { buildSupportReportRelationshipTopologyAudit } from '../tabs/support-steel-relationship-builder/support-report-relationship-typicality.js';

function object(path, item) {
  return `<clashobject><pathlink>${path.map((node) => `<node>${node}</node>`).join('')}</pathlink><smarttag><name>Item Name</name><value>${item}</value></smarttag></clashobject>`;
}
function relationshipClash(name, area, zone, a, b) {
  const root = `/ASIM-${area}-CU-PI`;
  const pathA = [root, zone, a];
  const pathB = [root, zone, b];
  return `<clashresult name="${name}" distance="0.001"><pos3f x="1" y="2" z="3"/>${object(pathA, a)}${object(pathB, b)}</clashresult>`;
}
function relationshipXml(clashes) {
  return `<exchange><clashtests>${clashes.join('')}</clashtests></exchange>`;
}
function locationGroup(area, familyId, memberId, zone, index) {
  const line = `ASIM-${area}-2\"-P8810320-31441C4-HT-0${index + 1}`;
  const point = { x: 202000 + index * 100, y: 1104000, z: 100500 };
  const branch = `/${line}/B1`;
  return Object.freeze({
    groupId: `${familyId}::G${index + 1}`,
    secondarySupportFamilyId: familyId,
    fullLineTag: line,
    scope: 'ASIM',
    branchNodes: [branch],
    primarySupportMemberIds: [memberId],
    clashPointsGlobalMm: [point],
    representativeClashPointGlobalMm: point,
    primaryPaths: [[`/ASIM-${area}-CU-PI`, zone, `/${line}`, branch, memberId]],
    secondaryPaths: [[`/ASIM-${area}-CU-SU`, `/${familyId}`]],
    evidenceRows: [],
    clashCount: 1,
    locationIndex: index,
    locationCountOnPipe: 1,
    locationMergeToleranceMm: 50,
    locationGroupingBasis: ['SINGLE_EVIDENCE_POINT'],
    multipleLocationsOnPipe: false,
    totalSupportPointsOnSecondary: 0,
  });
}
function evidence(area, familyId, members, zone) {
  const groups = members.map((memberId, index) => locationGroup(area, familyId, memberId, zone, index));
  const rows = groups.map((group) => Object.freeze({
    primaryPath: Object.freeze([...group.primaryPaths[0]]),
    secondaryPath: Object.freeze([...group.secondaryPaths[0]]),
  }));
  return Object.freeze({ schema: 'SyntheticClashEvidence.v1', rows: Object.freeze(rows), groups: Object.freeze(groups) });
}

test('reference-side relationship input makes existing topology matcher informed without changing matcher code', () => {
  const leftZone = '/ASIM-1885-CU-PI-P';
  const rightZone = '/ASIM-1884-CU-PI-P';
  const unrelatedRightZone = '/ASIM-1884-CU-PI-D';
  const leftEvidence = evidence('1885', 'PS-11168', ['/PS-11168.1', '/PS-11168.2'], leftZone);
  const rightEvidence = evidence('1884', 'PS-14168', ['/PS-14168.7', '/PS-14168.8'], rightZone);

  const leftInput = buildSupportPrimaryRelationshipInput(relationshipXml([
    relationshipClash('Left1', '1885', leftZone, '/PS-11168.1', '/PS-11168.2'),
  ]), { zoneScope: { primaryZoneIds: [leftZone] } });

  const rightInput = buildReferenceSupportPrimaryRelationshipInput(relationshipXml([
    relationshipClash('Right1', '1884', rightZone, '/PS-14168.7', '/PS-14168.8'),
    relationshipClash('Right2', '1884', unrelatedRightZone, '/PS-14168.9', '/PS-14168.10'),
  ]), rightEvidence);

  assert.equal(rightInput.scopeBasis, SUPPORT_PRIMARY_REFERENCE_SCOPE_BASIS);
  assert.equal(rightInput.parsedRowCount, 2);
  assert.equal(rightInput.scopedRowCount, 1);
  assert.equal(rightInput.excludedByZoneCount, 1);
  assert.ok(rightInput.zoneScope.primaryZoneIds.includes(rightZone));
  assert.ok(!rightInput.zoneScope.primaryZoneIds.includes(leftZone));

  const leftReport = buildSupportReportBundle({
    clashEvidence: leftEvidence,
    primaryRelationshipBundle: leftInput.bundle,
  });
  const rightReport = buildSupportReportBundle({
    clashEvidence: rightEvidence,
    primaryRelationshipBundle: rightInput.bundle,
  });
  const audit = buildSupportReportRelationshipTopologyAudit(leftReport, rightReport);

  assert.equal(audit.leftFamilies[0].authorityStatus, 'EXPLICIT_COMPLETE');
  assert.equal(audit.rightFamilies[0].authorityStatus, 'EXPLICIT_COMPLETE');
  assert.equal(audit.familyComparisons[0].result, 'MATCH');
  assert.equal(audit.matches[0].result, 'MATCH');
  assert.equal(audit.matches[0].rightFamilyId, 'PS-14168');
});
