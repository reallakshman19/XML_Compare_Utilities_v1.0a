import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSupportReportBundle } from '../tabs/support-steel-relationship-builder/support-report-engine.js?issue=1222-orphan-audit';
import { SUPPORT_PRIMARY_ORPHAN_RECOVERY_SCHEMA } from '../tabs/support-steel-relationship-builder/support-primary-orphan-recovery.js';

const line = 'ASIM-1885-10"-S8810101-91261M7-HC-01';

function evidence(point, memberId) {
  return Object.freeze({
    secondarySupportFamilyId: 'PS-11167',
    primarySupportMemberId: memberId,
    fullLineTag: line,
    branchNode: 'B4',
    clashPointGlobalMm: point,
  });
}

function group(groupId, point, memberIds, evidenceRows) {
  return Object.freeze({
    groupId,
    secondarySupportFamilyId: 'PS-11167',
    fullLineTag: line,
    scope: 'ASIM',
    branchNodes: ['B4'],
    primarySupportMemberIds: memberIds,
    clashPointsGlobalMm: evidenceRows.map((row) => row.clashPointGlobalMm),
    representativeClashPointGlobalMm: point,
    primaryPaths: [],
    secondaryPaths: [],
    evidenceRows,
    clashCount: evidenceRows.length,
    locationIndex: 0,
    locationCountOnPipe: 1,
    locationMergeToleranceMm: 50,
    locationGroupingBasis: ['SYNTHETIC_PRECLUSTERED'],
    locationNominalBoreMm: 250,
    multipleLocationsOnPipe: false,
    totalSupportPointsOnSecondary: 0,
  });
}

function fixture() {
  const anchorRows = [
    evidence({ x: -500, y: 0, z: 0 }, '/PS-11167.1'),
    evidence({ x: 500, y: 0, z: 0 }, '/PS-11167.2'),
  ];
  const orphanRows = [evidence({ x: 0, y: 200, z: 0 }, '/PS-11167.11')];
  return [
    group('G-ANCHOR', { x: 0, y: 0, z: 0 }, ['/PS-11167.1', '/PS-11167.2'], anchorRows),
    group('G-ORPHAN', { x: 0, y: 200, z: 0 }, ['/PS-11167.11'], orphanRows),
  ];
}

test('Support Report exposes orphan recovery configuration, summary and per-row geometry audit', () => {
  const groups = fixture();
  const report = buildSupportReportBundle({
    clashEvidence: { schema: 'SyntheticClashEvidence.v1', rows: [], groups },
    orphanRecoveryConfig: {},
  });

  assert.equal(report.primarySupportOrphanRecoverySchema, SUPPORT_PRIMARY_ORPHAN_RECOVERY_SCHEMA);
  assert.equal(report.primarySupportOrphanRecoveryConfig.axialMultiplier, 1);
  assert.equal(report.primarySupportOrphanRecoveryConfig.lateralMultiplier, 2);
  assert.equal(report.primarySupportOrphanRecoveryConfig.requireUniqueTarget, true);
  assert.equal(report.primarySupportOrphanRecoverySummary.recoveredGeometryCount, 2);
  assert.equal(report.summary.primarySupportOrphanRecoveredGroupCount, 2);

  const row = report.rows.find((item) => item.rowId === 'G-ORPHAN');
  assert.ok(row);
  assert.equal(row.evidence.primarySupportOrphanRecoveryStatus, 'ORPHAN_RECOVERED_GEOMETRY');
  assert.equal(row.evidence.primarySupportOrphanRecoveryBasis, 'RECIPROCAL_UNIQUE_PROVISIONAL_TARGET');
  assert.equal(row.evidence.primarySupportOrphanRecoveryLateralMm, 200);
  assert.equal(row.evidence.primarySupportOrphanRecoveryBaseLateralToleranceMm, 150);
  assert.equal(row.evidence.primarySupportOrphanRecoveryLateralToleranceMm, 300);
  assert.ok(row.evidence.primarySupportOrphanRecoveryAxisBasis);
  assert.ok(row.evidence.primarySupportOrphanRecoveryTargetGroupIds.includes('G-ANCHOR'));
  assert.equal(row.totalSupportPointsOnSecondary, 1);
});

test('Support Report accepts explicit orphan-recovery disable config without relying on UI runtime state', () => {
  const groups = fixture();
  const report = buildSupportReportBundle({
    clashEvidence: { schema: 'SyntheticClashEvidence.v1', rows: [], groups },
    orphanRecoveryConfig: { enabled: false },
  });

  assert.equal(report.primarySupportOrphanRecoveryConfig.enabled, false);
  assert.equal(report.primarySupportOrphanRecoverySummary.disabledCount, 2);
  assert.equal(report.summary.primarySupportOrphanRecoveredGroupCount, 0);
  assert.ok(report.rows.every((row) => row.totalSupportPointsOnSecondary === 2));
  assert.ok(report.rows.every((row) => row.evidence.primarySupportOrphanRecoveryStatus === 'DISABLED'));
});
