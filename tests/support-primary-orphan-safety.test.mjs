import assert from 'node:assert/strict';
import test from 'node:test';

import { applySupportPrimaryAssemblyCounts } from '../tabs/support-steel-relationship-builder/support-primary-counting.js';
import { _test as orphanTest } from '../tabs/support-steel-relationship-builder/support-primary-orphan-recovery.js';
import { _test as locationTest } from '../tabs/support-steel-relationship-builder/support-report-location-grouping.js';

const line = 'ASIM-1885-10"-S8810101-91261M7-HC-01';

function group(id, memberId, point, options = {}) {
  const familyId = options.familyId || 'PS-11167';
  const branch = options.branch || 'B4';
  return {
    groupId: id,
    secondarySupportFamilyId: familyId,
    fullLineTag: line,
    branchNodes: [branch],
    primarySupportMemberIds: [memberId],
    representativeClashPointGlobalMm: point,
    locationNominalBoreMm: 250,
    evidenceRows: [{
      secondarySupportFamilyId: familyId,
      primarySupportMemberId: memberId,
      fullLineTag: line,
      branchNode: branch,
      clashPointGlobalMm: point,
    }],
  };
}

test('pipe-level orphan axis rejects trusted two-point models so the candidate pair cannot define its own axis', () => {
  const twoPoint = locationTest.principalAxisModel([
    { x: 0, y: 0, z: 0 },
    { x: 100, y: 0, z: 0 },
  ]);
  assert.equal(twoPoint.trusted, true);
  assert.equal(twoPoint.pointCount, 2);
  assert.equal(orphanTest.trustedPipeModel(twoPoint), null);

  const threePoint = locationTest.principalAxisModel([
    { x: 0, y: 0, z: 0 },
    { x: 100, y: 0, z: 0 },
    { x: 200, y: 0, z: 0 },
  ]);
  assert.equal(threePoint.trusted, true);
  assert.equal(threePoint.pointCount, 3);
  assert.equal(orphanTest.trustedPipeModel(threePoint), threePoint);
});

test('no-explicit fallback preserves non-recoverable legacy groups while deduplicating only recovered geometry groups', () => {
  const concrete = group('G1', '/PS-11167.1', { x: 0, y: 0, z: 0 });
  const symbolic = group('G2', '/PS-11167/DATUM', { x: 1000, y: 1000, z: 0 });
  const counted = applySupportPrimaryAssemblyCounts({
    locationGroups: [concrete, symbolic],
    relationshipBundle: null,
    orphanRecoveryConfig: {},
  });
  assert.equal(counted.reconciliation.assignments.find((row) => row.groupId === 'G2').status, 'SYMBOLIC_ONLY');
  assert.equal(counted.familySummaries[0].legacyGeometryCount, 2);
  assert.equal(counted.familySummaries[0].totalSupportPointsOnSecondary, 2);
  assert.equal(counted.familySummaries[0].legacyFallbackOccurrenceIds.length, 2);
});

test('provisional geometry recovery cannot collapse known different traversals even with a trusted pipe-wide axis', () => {
  const groups = [
    group('G1', '/PS-12877.1', { x: 0, y: 0, z: 0 }, { familyId: 'PS-12877', branch: 'B1' }),
    group('G2', '/PS-12877.2', { x: 0, y: 50, z: 0 }, { familyId: 'PS-12877', branch: 'B2' }),
    group('G3', '/PS-12877.3', { x: 5000, y: 0, z: 0 }, { familyId: 'PS-12877', branch: 'B3' }),
  ];
  const counted = applySupportPrimaryAssemblyCounts({
    locationGroups: groups,
    relationshipBundle: null,
    orphanRecoveryConfig: {},
  });
  const g1 = counted.groups.find((row) => row.groupId === 'G1');
  const g2 = counted.groups.find((row) => row.groupId === 'G2');
  assert.equal(counted.familySummaries[0].legacyGeometryCount, 3);
  assert.equal(counted.familySummaries[0].totalSupportPointsOnSecondary, 3);
  assert.equal(g1.primarySupportOrphanRecoveryStatus, 'ORPHAN_UNRESOLVED');
  assert.equal(g2.primarySupportOrphanRecoveryStatus, 'ORPHAN_UNRESOLVED');
  assert.equal(g1.primarySupportOrphanRecoveryBasis, 'DIFFERENT_TRAVERSAL_GEOMETRY_RECOVERY_WITHHELD');
  assert.equal(g2.primarySupportOrphanRecoveryBasis, 'DIFFERENT_TRAVERSAL_GEOMETRY_RECOVERY_WITHHELD');
  assert.equal(counted.orphanRecovery.summary.crossTraversalGeometryWithheldCount, 2);
  assert.equal(counted.summary.orphanCrossTraversalGeometryWithheldCount, 2);
  assert.equal(counted.diagnostics.filter((row) => row.code === 'ORPHAN_CROSS_TRAVERSAL_GEOMETRY_WITHHELD').length, 2);
});
