import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSupportPrimaryRelationshipBundle } from '../tabs/support-steel-relationship-builder/support-primary-relationship.js';
import { buildSupportReportBundle } from '../tabs/support-steel-relationship-builder/support-report-engine.js?issue=1222-count';

function locationGroup(groupId, familyId, memberIds, index = 0) {
  const line = `ASIM-1835-2\"-P8810320-31441C4-HT-0${index + 1}`;
  const point = { x: 202000 + index * 100, y: 1104000, z: 100500 };
  return Object.freeze({
    groupId,
    secondarySupportFamilyId: familyId,
    fullLineTag: line,
    scope: 'ASIM',
    branchNodes: [`${line}/B1`],
    primarySupportMemberIds: memberIds,
    clashPointsGlobalMm: [point],
    representativeClashPointGlobalMm: point,
    primaryPaths: [['/ASIM-1835-CU-PI', '/ASIM-1835-CU-PI-P', `/${line}`, `${line}/B1`, memberIds[0]]],
    secondaryPaths: [['/ASIM-1835-CU-SU', `/${familyId}`]],
    evidenceRows: [],
    clashCount: 1,
    locationIndex: 0,
    locationCountOnPipe: 1,
    locationMergeToleranceMm: 50,
    locationGroupingBasis: ['SINGLE_EVIDENCE_POINT'],
    multipleLocationsOnPipe: false,
    totalSupportPointsOnSecondary: 0,
  });
}

function primaryBundle(pairs) {
  return buildSupportPrimaryRelationshipBundle({
    relationshipRows: pairs.map(([supportA, supportB], index) => ({
      edgeType: 'SupportChain', supportA, supportB,
      clashName: `Relationship-${index + 1}`,
      relationshipEvidenceId: `REL-${index + 1}`,
      relationshipBasis: ['EXPLICIT_SUPPORT_CLASH'],
    })),
  });
}

test('Support Report uses explicit assembly identity for total count and remark semantics', () => {
  const groups = [
    locationGroup('G1', 'PS-11167', ['/PS-11167.2'], 0),
    locationGroup('G2', 'PS-11167', ['/PS-11167.11'], 1),
    locationGroup('G3', 'PS-11167', ['/PS-11167.1'], 2),
    locationGroup('G4', 'PS-11167', ['/PS-11167.3'], 3),
    locationGroup('G5', 'PS-11167', ['/PS-11167.4'], 4),
    locationGroup('G6', 'PS-11167', ['/PS-11167.5'], 5),
    locationGroup('G7', 'PS-11167', ['/PS-11167.6'], 6),
  ];
  const report = buildSupportReportBundle({
    clashEvidence: { schema: 'SyntheticClashEvidence.v1', rows: [], groups },
    primaryRelationshipBundle: primaryBundle([['/PS-11167.2', '/PS-11167.11']]),
  });

  assert.equal(report.primarySupportEvidenceMode, 'CLASH_XML_PLUS_PRIMARY_RELATIONSHIP_BUNDLE');
  assert.equal(report.primarySupportFamilySummaries[0].totalSupportPointsOnSecondary, 6);
  assert.ok(report.rows.every((row) => row.totalSupportPointsOnSecondary === 6));
  assert.ok(report.rows.every((row) => row.remarks.includes('Multiple primary support')));
  const explicitRows = report.rows.filter((row) => ['/PS-11167.2', '/PS-11167.11'].includes(row.pipingPrimarySupport));
  assert.equal(explicitRows.length, 2);
  assert.ok(explicitRows.every((row) => row.evidence.primarySupportAssemblyId === 'PSA::PS-11167::M-2+11'));
  assert.ok(explicitRows.every((row) => row.evidence.primarySupportAssemblyCountBasis === 'EXPLICIT_ASSEMBLY_PLUS_GEOMETRY'));
  assert.ok(explicitRows.every((row) => row.evidence.jsonTrace.primarySupportAssemblyId === 'PSA::PS-11167::M-2+11'));
});

test('Support Report preserves legacy family count when optional primary relationship evidence is absent', () => {
  const groups = [0, 1, 2, 3].map((index) => locationGroup(`G${index + 1}`, 'PS-12877', [`/PS-12877.${index + 1}`], index));
  const report = buildSupportReportBundle({
    clashEvidence: { schema: 'SyntheticClashEvidence.v1', rows: [], groups },
  });

  assert.equal(report.primarySupportEvidenceMode, 'CLASH_XML_GEOMETRY_FALLBACK');
  assert.ok(report.rows.every((row) => row.totalSupportPointsOnSecondary === 4));
  assert.ok(report.rows.every((row) => row.evidence.primarySupportAssemblyCountBasis === 'LEGACY_GEOMETRY_GROUP_COUNT'));
  assert.ok(report.rows.every((row) => row.remarks.includes('Multiple primary support')));
  assert.ok(report.rows.every((row) => row.evidence.multipleLocationsOnPipe === false));
});
