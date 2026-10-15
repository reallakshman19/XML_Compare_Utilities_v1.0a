import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildSupportReportBundle, _test as engineTest } from '../tabs/support-steel-relationship-builder/support-report-engine.js';
import {
  buildSupportReportPrincipalAxisModel,
  buildSupportReportTraversalGeometryIndex,
  deriveSupportReportLocationNominalBoreMm,
  _test as locationTest,
} from '../tabs/support-steel-relationship-builder/support-report-location-grouping.js';
import { setSupportPrimaryOrphanRecoveryRuntimeConfig } from '../tabs/support-steel-relationship-builder/support-primary-orphan-recovery.js';

const line10 = 'ASIM-1885-10"-S8810101-91261M7-HC-01';
const MAINTAINABILITY_TOKEN = '20260929-support-primary-maintainability-1';
const ORPHAN_SPLIT_TOKEN = '20260929-support-primary-orphan-split-1';
const COUNT_PROJECTION_TOKEN = '20260929-support-primary-count-projection-1';

function evidence(point, memberId) {
  return {
    secondarySupportFamilyId: 'PS-11167',
    primarySupportMemberId: memberId,
    fullLineTag: line10,
    branchNode: 'B4',
    clashPointGlobalMm: point,
  };
}

function group(id, point, memberIds, evidenceRows) {
  return {
    groupId: id,
    secondarySupportFamilyId: 'PS-11167',
    fullLineTag: line10,
    branchNodes: ['B4'],
    primarySupportMemberIds: memberIds,
    representativeClashPointGlobalMm: point,
    locationNominalBoreMm: 250,
    evidenceRows,
    primaryPaths: [],
    secondaryPaths: [],
    clashCount: evidenceRows.length,
    locationIndex: 0,
    locationCountOnPipe: 1,
    locationMergeToleranceMm: 50,
    locationGroupingBasis: ['SINGLE_EVIDENCE_POINT'],
    multipleLocationsOnPipe: false,
    totalSupportPointsOnSecondary: 0,
  };
}

test('production-named bore-axis exports are the same geometry authority used by location grouping', () => {
  const points = [
    { x: -500, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 500, y: 0, z: 0 },
  ];
  assert.deepEqual(buildSupportReportPrincipalAxisModel(points), locationTest.principalAxisModel(points));
  assert.equal(deriveSupportReportLocationNominalBoreMm(line10), locationTest.derivedNominalBoreMm(line10));
  assert.equal(deriveSupportReportLocationNominalBoreMm(line10), 250);
  const rows = points.map((point, index) => evidence(point, `/PS-11167.${index + 1}`));
  assert.deepEqual(
    [...buildSupportReportTraversalGeometryIndex(rows).entries()],
    [...locationTest.buildTraversalGeometryIndex(rows).entries()],
  );
});

test('explicit orphan config on the report build overrides compatibility runtime state', () => {
  const anchorRows = [
    evidence({ x: -500, y: 0, z: 0 }, '/PS-11167.1'),
    evidence({ x: 500, y: 0, z: 0 }, '/PS-11167.2'),
  ];
  const orphanRow = evidence({ x: 0, y: 200, z: 0 }, '/PS-11167.11');
  const groups = [
    group('A', { x: 0, y: 0, z: 0 }, ['/PS-11167.1', '/PS-11167.2'], anchorRows),
    group('B', orphanRow.clashPointGlobalMm, ['/PS-11167.11'], [orphanRow]),
  ];

  setSupportPrimaryOrphanRecoveryRuntimeConfig({ lateralMultiplier: 2 });
  const report = buildSupportReportBundle({
    clashEvidence: { schema: 'SyntheticClashEvidence.v1', rows: [], groups },
    orphanRecoveryConfig: { lateralMultiplier: 1 },
  });
  assert.equal(report.primarySupportOrphanRecoveryConfig.lateralMultiplier, 1);
  assert.equal(report.primarySupportFamilySummaries[0].totalSupportPointsOnSecondary, 2);
});

test('TOTAL SUPPORT POINTS provenance carries effective assembly count basis', () => {
  const provenance = engineTest.alignPrimarySupportCountProvenance({
    totalSupportPointsOnSecondary: Object.freeze({ sourceClass: 'CLASH_GROUP_DERIVATION' }),
  }, {
    totalSupportPointsOnSecondary: 1,
    primarySupportAssemblyCountBasis: 'GEOMETRY_ORPHAN_RECOVERY',
    primarySupportOrphanRecoveryStatus: 'ORPHAN_RECOVERED_GEOMETRY',
  });
  assert.equal(provenance.totalSupportPointsOnSecondary.sourceClass, 'DETERMINISTIC_PRIMARY_SUPPORT_ASSEMBLY_COUNT');
  assert.equal(provenance.totalSupportPointsOnSecondary.confidenceClass, 'DETERMINISTIC');
  assert.equal(provenance.totalSupportPointsOnSecondary.countBasis, 'GEOMETRY_ORPHAN_RECOVERY');
  assert.equal(provenance.totalSupportPointsOnSecondary.orphanRecoveryStatus, 'ORPHAN_RECOVERED_GEOMETRY');
});

test('browser cache route advances through addon, engine, count and split orphan modules', async () => {
  const bootstrap = await readFile(new URL('../tabs/support-steel-relationship-builder/support-steel-relationship-bootstrap.js', import.meta.url), 'utf8');
  const addon = await readFile(new URL('../tabs/support-steel-relationship-builder/support-report-addon.js', import.meta.url), 'utf8');
  const engine = await readFile(new URL('../tabs/support-steel-relationship-builder/support-report-engine.js', import.meta.url), 'utf8');
  const counting = await readFile(new URL('../tabs/support-steel-relationship-builder/support-primary-counting.js', import.meta.url), 'utf8');
  const orphanRecovery = await readFile(new URL('../tabs/support-steel-relationship-builder/support-primary-orphan-recovery.js', import.meta.url), 'utf8');
  const orphanUi = await readFile(new URL('../tabs/support-steel-relationship-builder/support-primary-orphan-ui-addon.js', import.meta.url), 'utf8');

  assert.match(bootstrap, new RegExp(`support-report-addon\\.js[^'\"]*maintainability=${MAINTAINABILITY_TOKEN}`));
  assert.match(bootstrap, new RegExp(`support-primary-orphan-ui-addon\\.js\\?v=${MAINTAINABILITY_TOKEN}`));
  assert.match(addon, new RegExp(`support-report-engine\\.js[^'\"]*maintainability=${MAINTAINABILITY_TOKEN}`));
  assert.match(addon, new RegExp(`support-primary-orphan-ui-addon\\.js\\?v=${MAINTAINABILITY_TOKEN}`));
  assert.match(engine, new RegExp(`support-primary-counting\\.js\\?v=${MAINTAINABILITY_TOKEN}`));
  assert.match(counting, new RegExp(`support-primary-orphan-recovery\\.js\\?v=${ORPHAN_SPLIT_TOKEN}`));
  assert.match(counting, new RegExp(`support-primary-count-projection\\.js\\?v=${COUNT_PROJECTION_TOKEN}`));
  assert.match(orphanRecovery, new RegExp(`support-primary-orphan-geometry\\.js\\?v=${ORPHAN_SPLIT_TOKEN}`));
  assert.match(orphanRecovery, new RegExp(`support-primary-orphan-candidates\\.js\\?v=${ORPHAN_SPLIT_TOKEN}`));
  assert.match(orphanUi, new RegExp(`support-primary-orphan-recovery\\.js\\?v=${ORPHAN_SPLIT_TOKEN}`));

  assert.match(addon, /const orphanRecoveryConfig = readOrphanRecoveryConfig\(popup\);/);
  assert.match(addon, /primaryRelationshipBundle,\s*orphanRecoveryConfig,/s);
  assert.match(addon, /clashEvidence: referenceEvidence,\s*primaryRelationshipBundle: referencePrimaryRelationshipBundle,\s*orphanRecoveryConfig,/s);
});