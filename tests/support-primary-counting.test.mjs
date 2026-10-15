import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSupportPrimaryRelationshipBundle } from '../tabs/support-steel-relationship-builder/support-primary-relationship.js';
import { applySupportPrimaryAssemblyCounts } from '../tabs/support-steel-relationship-builder/support-primary-counting.js';

function group(groupId, familyId, memberIds, total = 0) {
  return {
    groupId,
    secondarySupportFamilyId: familyId,
    fullLineTag: 'ASIM-1835-2"-P8810320-31441C4-HT-01',
    branchNodes: [`${groupId}/B1`],
    primarySupportMemberIds: memberIds,
    representativeClashPointGlobalMm: { x: groupId.length * 10, y: 200, z: 300 },
    totalSupportPointsOnSecondary: total,
  };
}

function bundle(pairs) {
  return buildSupportPrimaryRelationshipBundle({
    relationshipRows: pairs.map(([supportA, supportB], index) => ({
      edgeType: 'SupportChain', supportA, supportB,
      clashName: `R-${index + 1}`,
      relationshipEvidenceId: `REL-${index + 1}`,
      relationshipBasis: ['EXPLICIT_SUPPORT_CLASH'],
    })),
  });
}

test('no explicit relationship evidence preserves legacy geometry count exactly', () => {
  const groups = [
    group('G1', 'PS-12060', ['/PS-12060.1']),
    group('G2', 'PS-12877', ['/PS-12877.1']),
    group('G3', 'PS-12877', ['/PS-12877.2']),
    group('G4', 'PS-12877', ['/PS-12877.3']),
    group('G5', 'PS-12877', ['/PS-12877.4']),
  ];
  const result = applySupportPrimaryAssemblyCounts({ locationGroups: groups });
  assert.equal(result.familySummaries.find((row) => row.familyId === 'PS-12060').totalSupportPointsOnSecondary, 1);
  assert.equal(result.familySummaries.find((row) => row.familyId === 'PS-12877').totalSupportPointsOnSecondary, 4);
  assert.ok(result.groups.filter((row) => row.secondarySupportFamilyId === 'PS-12877')
    .every((row) => row.totalSupportPointsOnSecondary === 4));
  assert.ok(result.groups.every((row) => row.primarySupportAssemblyCountBasis === 'LEGACY_GEOMETRY_GROUP_COUNT'));
});

test('PS-11167 explicit .2/.11 component deduplicates two geometry groups', () => {
  const locationGroups = [
    group('G1', 'PS-11167', ['/PS-11167.2']),
    group('G2', 'PS-11167', ['/PS-11167.11']),
    group('G3', 'PS-11167', ['/PS-11167.1']),
    group('G4', 'PS-11167', ['/PS-11167.3']),
    group('G5', 'PS-11167', ['/PS-11167.4']),
    group('G6', 'PS-11167', ['/PS-11167.5']),
    group('G7', 'PS-11167', ['/PS-11167.6']),
  ];
  const result = applySupportPrimaryAssemblyCounts({
    locationGroups,
    relationshipBundle: bundle([['/PS-11167.2', '/PS-11167.11']]),
  });
  const family = result.familySummaries[0];
  assert.equal(family.legacyGeometryCount, 7);
  assert.equal(family.totalSupportPointsOnSecondary, 6);
  assert.equal(family.countBasis, 'EXPLICIT_ASSEMBLY_PLUS_GEOMETRY');
  assert.ok(result.groups.every((row) => row.totalSupportPointsOnSecondary === 6));
  assert.equal(result.groups[0].primarySupportAssemblyId, 'PSA::PS-11167::M-2+11');
  assert.equal(result.groups[1].primarySupportAssemblyId, 'PSA::PS-11167::M-2+11');
});

test('unobserved explicit assembly contributes and DATUM does not inflate PS-11236 count', () => {
  const locationGroups = [
    group('G1', 'PS-11236', ['/PS-11236.9']),
    group('G2', 'PS-11236', ['/PS-11236.8']),
    group('G3', 'PS-11236', ['/PS-11236.2', '/PS-11236.3']),
  ];
  const relationshipBundle = bundle([
    ['/PS-11236.2', '/PS-11236.3'],
    ['/PS-11236.4', '/PS-11236.5'],
    ['/PS-11236.5', '/PS-11236/DATUM'],
  ]);
  const result = applySupportPrimaryAssemblyCounts({ locationGroups, relationshipBundle });
  const family = result.familySummaries[0];
  assert.equal(family.totalSupportPointsOnSecondary, 4);
  assert.deepEqual(family.explicitAssemblyIds, ['PSA::PS-11236::M-2+3', 'PSA::PS-11236::M-4+5']);
  assert.equal(family.geometryOnlyGroupIds.length, 2);
  assert.ok(result.groups.every((row) => row.totalSupportPointsOnSecondary === 4));
});

test('partial/conflict evidence cannot lower the legacy geometry count', () => {
  const locationGroups = [
    group('G1', 'PS-500', ['/PS-500.1', '/PS-500.99']),
    group('G2', 'PS-500', ['/PS-500.2']),
  ];
  const result = applySupportPrimaryAssemblyCounts({
    locationGroups,
    relationshipBundle: bundle([['/PS-500.1', '/PS-500.2']]),
  });
  const family = result.familySummaries[0];
  assert.equal(family.legacyGeometryCount, 2);
  assert.equal(family.totalSupportPointsOnSecondary, 2);
  assert.equal(family.countBasis, 'EXPLICIT_ASSEMBLY_PLUS_GEOMETRY_AMBIGUITY_FLOOR');
  assert.equal(family.ambiguityCount, 1);
  assert.equal(family.diagnostics[0].code, 'PRIMARY_ASSEMBLY_COUNT_AMBIGUITY_FLOOR');
});

test('unsupported relationship schema has no count authority', () => {
  const locationGroups = [group('G1', 'PS-600', ['/PS-600.1']), group('G2', 'PS-600', ['/PS-600.2'])];
  const result = applySupportPrimaryAssemblyCounts({
    locationGroups,
    relationshipBundle: { schema: 'Wrong.v1', families: [{ familyId: 'PS-600', assemblies: [{ assemblyId: 'BAD', countable: true }] }] },
  });
  assert.equal(result.familySummaries[0].totalSupportPointsOnSecondary, 2);
  assert.equal(result.familySummaries[0].countBasis, 'LEGACY_GEOMETRY_GROUP_COUNT');
});
