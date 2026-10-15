import assert from 'node:assert/strict';
import test from 'node:test';

import { applySupportPrimaryAssemblyCounts } from '../tabs/support-steel-relationship-builder/support-primary-counting.js';
import {
  normalizeSupportPrimaryOrphanRecoveryConfig,
  resolveSupportPrimaryOrphans,
  SUPPORT_PRIMARY_ORPHAN_RECOVERY_DEFAULTS,
} from '../tabs/support-steel-relationship-builder/support-primary-orphan-recovery.js';
import { SUPPORT_PRIMARY_RELATIONSHIP_SCHEMA } from '../tabs/support-steel-relationship-builder/support-primary-relationship.js';
import { reconcileSupportPrimaryAssemblies } from '../tabs/support-steel-relationship-builder/support-primary-reconciliation.js';

const line10 = 'ASIM-1885-10"-S8810101-91261M7-HC-01';

function evidence(point, memberId, branchNode = 'B4', line = line10) {
  return {
    secondarySupportFamilyId: 'PS-11167',
    primarySupportMemberId: memberId,
    fullLineTag: line,
    branchNode,
    clashPointGlobalMm: point,
  };
}

function group(id, point, members, rows, options = {}) {
  return {
    groupId: id,
    secondarySupportFamilyId: options.familyId || 'PS-11167',
    fullLineTag: options.line || line10,
    branchNodes: options.branchNodes || ['B4'],
    primarySupportMemberIds: members,
    representativeClashPointGlobalMm: point,
    locationNominalBoreMm: options.boreMm ?? 250,
    evidenceRows: rows,
    totalSupportPointsOnSecondary: options.total ?? 0,
  };
}

function axisAnchorGroup(id = 'A', branchNode = 'B4') {
  const rows = [
    evidence({ x: -500, y: 0, z: 0 }, '/PS-11167.1', branchNode),
    evidence({ x: 500, y: 0, z: 0 }, '/PS-11167.2', branchNode),
  ];
  return group(id, { x: 0, y: 0, z: 0 }, ['/PS-11167.1', '/PS-11167.2'], rows, { branchNodes: [branchNode] });
}

function orphanGroup(id = 'B', y = 200, branchNode = 'B4', memberId = '/PS-11167.11') {
  const row = evidence({ x: 0, y, z: 0 }, memberId, branchNode);
  return group(id, row.clashPointGlobalMm, [memberId], [row], { branchNodes: [branchNode] });
}

test('orphan recovery defaults are conservative and unique-target is fixed on', () => {
  assert.deepEqual(normalizeSupportPrimaryOrphanRecoveryConfig({}), SUPPORT_PRIMARY_ORPHAN_RECOVERY_DEFAULTS);
  const overridden = normalizeSupportPrimaryOrphanRecoveryConfig({
    enabled: false,
    axialMultiplier: 1.5,
    lateralMultiplier: 3,
    requireSameFamily: false,
    requireSamePipe: false,
    requireSameBore: false,
    requireUniqueTarget: false,
  });
  assert.equal(overridden.enabled, false);
  assert.equal(overridden.axialMultiplier, 1.5);
  assert.equal(overridden.lateralMultiplier, 3);
  assert.equal(overridden.requireSameFamily, false);
  assert.equal(overridden.requireSamePipe, false);
  assert.equal(overridden.requireSameBore, false);
  assert.equal(overridden.requireUniqueTarget, true);
});

test('unique provisional pair outside base lateral but inside 2x recovery deduplicates family count', () => {
  const anchor = axisAnchorGroup();
  const orphan = orphanGroup();
  const counted = applySupportPrimaryAssemblyCounts({
    locationGroups: [anchor, orphan],
    relationshipBundle: null,
    orphanRecoveryConfig: {},
  });
  assert.equal(counted.familySummaries[0].legacyGeometryCount, 2);
  assert.equal(counted.familySummaries[0].totalSupportPointsOnSecondary, 1);
  assert.equal(counted.familySummaries[0].countBasis, 'GEOMETRY_ORPHAN_RECOVERY');
  assert.equal(counted.orphanRecovery.summary.recoveredGeometryCount, 2);
  assert.equal(counted.groups[0].primarySupportAssemblyId, counted.groups[1].primarySupportAssemblyId);
  assert.equal(counted.groups[1].primarySupportOrphanRecoveryLateralMm, 200);
  assert.equal(counted.groups[1].primarySupportOrphanRecoveryBaseLateralToleranceMm, 150);
  assert.equal(counted.groups[1].primarySupportOrphanRecoveryLateralToleranceMm, 300);
});

test('disabled orphan recovery preserves exact geometry group count', () => {
  const counted = applySupportPrimaryAssemblyCounts({
    locationGroups: [axisAnchorGroup(), orphanGroup()],
    relationshipBundle: null,
    orphanRecoveryConfig: { enabled: false },
  });
  assert.equal(counted.familySummaries[0].totalSupportPointsOnSecondary, 2);
  assert.equal(counted.familySummaries[0].countBasis, 'LEGACY_GEOMETRY_GROUP_COUNT');
  assert.equal(counted.orphanRecovery.summary.disabledCount, 2);
});

test('one orphan with two qualifying target identities stays ambiguous and unmerged', () => {
  const anchorRows = [];
  for (let x = -500; x <= 500; x += 125) anchorRows.push(evidence({ x, y: 0, z: 0 }, '/PS-11167.1'));
  const anchor = group('A', { x: 0, y: 0, z: 0 }, ['/PS-11167.1'], anchorRows);
  const orphan = orphanGroup('O', 160, 'B4', '/PS-11167.11');
  const other = orphanGroup('C', 320, 'B4', '/PS-11167.12');
  const counted = applySupportPrimaryAssemblyCounts({
    locationGroups: [anchor, orphan, other],
    relationshipBundle: null,
    orphanRecoveryConfig: {},
  });
  const resolution = counted.orphanRecovery.resolutions.find((row) => row.groupId === 'O');
  assert.equal(resolution.recoveryStatus, 'ORPHAN_AMBIGUOUS');
  assert.equal(resolution.candidateTargetIds.length, 2);
  assert.equal(counted.familySummaries[0].totalSupportPointsOnSecondary, 3);
  assert.ok(counted.diagnostics.some((row) => row.code === 'ORPHAN_AMBIGUOUS'));
});

test('raw cross-branch geometry recovery is diagnosable but final count authority withholds it', () => {
  const anchor = axisAnchorGroup('A', 'B4');
  const orphan = orphanGroup('B', 200, 'B5');
  const locationGroups = [anchor, orphan];
  const reconciliation = reconcileSupportPrimaryAssemblies({ locationGroups, relationshipBundle: null });
  const rawRecovery = resolveSupportPrimaryOrphans({ locationGroups, reconciliation, config: {} });
  assert.equal(rawRecovery.summary.recoveredGeometryCount, 2);
  assert.equal(rawRecovery.resolutions.find((row) => row.groupId === 'B').branchRelationship, 'DIFFERENT_TRAVERSAL');

  const counted = applySupportPrimaryAssemblyCounts({
    locationGroups,
    relationshipBundle: null,
    orphanRecoveryConfig: {},
  });
  assert.equal(counted.familySummaries[0].totalSupportPointsOnSecondary, 2);
  assert.equal(counted.groups.find((row) => row.groupId === 'B').primarySupportOrphanRecoveryStatus, 'ORPHAN_UNRESOLVED');
  assert.equal(counted.groups.find((row) => row.groupId === 'B').primarySupportOrphanRecoveryBasis, 'DIFFERENT_TRAVERSAL_GEOMETRY_RECOVERY_WITHHELD');
  assert.equal(counted.orphanRecovery.summary.crossTraversalGeometryWithheldCount, 2);

  const guardedOff = resolveSupportPrimaryOrphans({
    locationGroups,
    reconciliation,
    config: { requireSameBore: false },
  });
  assert.equal(guardedOff.summary.recoveredGeometryCount, 0);
});

test('geometry-only orphan can recover to one explicit assembly without changing explicit topology', () => {
  const anchor = group('A', { x: 0, y: 0, z: 0 }, ['/PS-11167.1'], [
    evidence({ x: -500, y: 0, z: 0 }, '/PS-11167.1'),
    evidence({ x: 500, y: 0, z: 0 }, '/PS-11167.1'),
  ]);
  const orphan = orphanGroup('B', 200, 'B4', '/PS-11167.11');
  const relationshipBundle = {
    schema: SUPPORT_PRIMARY_RELATIONSHIP_SCHEMA,
    families: [{
      familyId: 'PS-11167',
      assemblies: [{
        assemblyId: 'PSA::PS-11167::M-1',
        countable: true,
        memberIds: ['/PS-11167.1'],
      }],
    }],
  };
  const counted = applySupportPrimaryAssemblyCounts({
    locationGroups: [anchor, orphan],
    relationshipBundle,
    orphanRecoveryConfig: {},
  });
  assert.equal(counted.familySummaries[0].totalSupportPointsOnSecondary, 1);
  assert.equal(counted.groups.find((row) => row.groupId === 'A').primarySupportAssemblyStatus, 'EXPLICIT_ASSEMBLY');
  assert.equal(counted.groups.find((row) => row.groupId === 'B').primarySupportAssemblyId, 'PSA::PS-11167::M-1');
  assert.equal(counted.groups.find((row) => row.groupId === 'B').primarySupportOrphanRecoveryStatus, 'ORPHAN_RECOVERED_EXPLICIT');
});

test('distinct explicit assembly IDs are immutable and a geometry orphan between them is ambiguous', () => {
  const a = group('A', { x: 0, y: 0, z: 0 }, ['/PS-11167.1'], [
    evidence({ x: -1000, y: 0, z: 0 }, '/PS-11167.1'),
    evidence({ x: 1000, y: 0, z: 0 }, '/PS-11167.1'),
  ]);
  const b = orphanGroup('B', 320, 'B4', '/PS-11167.2');
  const orphan = orphanGroup('O', 160, 'B4', '/PS-11167.99');
  const relationshipBundle = {
    schema: SUPPORT_PRIMARY_RELATIONSHIP_SCHEMA,
    families: [{
      familyId: 'PS-11167',
      assemblies: [
        { assemblyId: 'PSA::PS-11167::M-1', countable: true, memberIds: ['/PS-11167.1'] },
        { assemblyId: 'PSA::PS-11167::M-2', countable: true, memberIds: ['/PS-11167.2'] },
      ],
    }],
  };
  const reconciliation = reconcileSupportPrimaryAssemblies({ locationGroups: [a, b, orphan], relationshipBundle });
  const recovery = resolveSupportPrimaryOrphans({ locationGroups: [a, b, orphan], reconciliation, config: {} });
  assert.equal(recovery.resolutions.find((row) => row.groupId === 'A').recoveryStatus, 'NOT_APPLICABLE');
  assert.equal(recovery.resolutions.find((row) => row.groupId === 'B').recoveryStatus, 'NOT_APPLICABLE');
  assert.equal(recovery.resolutions.find((row) => row.groupId === 'O').recoveryStatus, 'ORPHAN_AMBIGUOUS');
});
