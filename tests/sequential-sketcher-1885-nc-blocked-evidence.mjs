import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  buildSequentialEvidenceModel,
  indexSequentialEvidence,
} from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  countBy,
  featureCounts,
  probeSequentialBranch,
} from './helpers/sequential-1885-nc-evidence-report.js';

const SOURCE_COMMIT = 'd5fda9c95fda9bba9b6b05171628ba16778a7667';
const SOURCE_URL = `https://raw.githubusercontent.com/reallaksh19/3D_Converters/${SOURCE_COMMIT}/Benchmarks/1885_NC/1885_NC.json`;
const BASELINE_PATH = 'tests/fixtures/sequential-sketcher/1885-nc-baseline.v1.json';
const DELTA_PATH = 'tests/fixtures/sequential-sketcher/1885-nc-outcome-delta.v1.json';
const REPORT_PATH = 'artifacts/sequential-sketcher/1885-nc-blocked-evidence.json';
const ENGINE_OPTIONS = Object.freeze({
  exactToleranceMm: 1,
  autoRepairToleranceMm: 25,
  candidateSearchRadiusMm: 250,
});
const MAX_STEPS_PER_ROOT = 1200;

function writeReport(report) {
  mkdirSync('artifacts/sequential-sketcher', { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function baselineProjection(report) {
  return {
    fixtureRecordCount: report.fixtureRecordCount,
    indexedBranchCount: report.indexedBranchCount,
    indexedComponentCount: report.indexedComponentCount,
    evidenceAudit: report.evidenceAudit,
    branchStateCounts: report.branchStateCounts,
    blockedReasonCounts: report.blockedReasonCounts,
    componentTypeCounts: report.componentTypeCounts,
    referenceStatusCounts: report.referenceStatusCounts,
    featureCounts: report.featureCounts,
    supportProjectionCounts: report.supportProjectionCounts,
    sourceBoundaryCounts: report.sourceBoundaryCounts,
    sScope: report.sScope,
    validation: {
      runtimeErrorCount: report.validation.runtimeErrorCount,
      automaticRepairCount: report.validation.automaticRepairCount,
      sourceCoordinatesMutated: report.validation.sourceCoordinatesMutated,
    },
  };
}

function assertOutcomeDelta(rows, delta) {
  assert.equal(delta.changedRootCount, delta.outcomes.length);
  const actualClassifiedRoots = rows
    .filter((row) => row.boundaryClassificationCount > 0)
    .map((row) => row.branchId)
    .sort();
  const expectedClassifiedRoots = delta.outcomes.map((row) => row.rootBranchId).sort();
  assert.deepEqual(actualClassifiedRoots, expectedClassifiedRoots, 'Every physical-boundary root must have an explained outcome delta');
  for (const expected of delta.outcomes) {
    const actual = rows.find((row) => row.branchId === expected.rootBranchId);
    assert.ok(actual, `Outcome delta branch is missing: ${expected.rootBranchId}`);
    assert.equal(actual.state, expected.afterState, `${expected.rootBranchId} state changed without explanation`);
    assert.equal(actual.blockedReason, expected.afterReason, `${expected.rootBranchId} reason changed without explanation`);
    assert.equal(actual.repairCount, 0, `${expected.rootBranchId} must not introduce a repair`);
    assert.equal(actual.constructionFingerprint, expected.constructionFingerprint);
    const classification = actual.boundaryClassifications.find((row) => row.classificationId === expected.classificationId);
    assert.ok(classification, `${expected.rootBranchId} physical boundary classification is missing`);
    assert.equal(classification.branchId, expected.classifiedBoundaryBranchId);
    assert.equal(classification.boundaryRole, expected.boundaryRole);
    assert.equal(classification.rawReference, expected.rawReference);
    assert.equal(classification.dialect, expected.dialect);
    assert.equal(classification.classification, 'EXTERNAL_PHYSICAL_BOUNDARY_CONFIRMED');
    assert.equal(classification.positionStatus, 'POSITION_CONFIRMED');
    assert.equal(classification.positionGapMm, expected.positionGapMm);
    assert.equal(classification.approvalSource, 'SOURCE_PHYSICAL_BOUNDARY_EVIDENCE');
  }
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
const outcomeDelta = JSON.parse(readFileSync(DELTA_PATH, 'utf8'));
let report = {
  schema: 'Sequential1885NcBlockedEvidence.v1',
  sourceCommit: SOURCE_COMMIT,
  generated: false,
  failure: null,
  branches: [],
};

try {
  const response = await fetch(SOURCE_URL, {
    headers: { 'user-agent': 'sequential-sketcher-blocked-evidence' },
  });
  assert.equal(response.ok, true, `Unable to fetch pinned 1885_NC fixture: ${response.status}`);
  const records = await response.json();
  assert.ok(Array.isArray(records), 'Pinned fixture must be a JSON array');
  const immutableSnapshot = JSON.stringify(records);
  const evidence = buildSequentialEvidenceModel(records);
  const indexes = indexSequentialEvidence(evidence);
  const rows = evidence.branches.map((branch) => probeSequentialBranch(
    branch,
    evidence,
    indexes,
    ENGINE_OPTIONS,
    MAX_STEPS_PER_ROOT,
  ));
  const blockedRows = rows.filter((row) => row.state === 'USER_DECISION_REQUIRED');
  const sRows = rows.filter((row) => row.lineKey);
  const references = rows.flatMap((row) => row.references);
  const boundaryClassifications = rows.flatMap((row) => row.boundaryClassifications);
  const runtimeErrors = rows
    .filter((row) => row.runtimeError)
    .map((row) => ({ branchId: row.branchId, ...row.runtimeError }));
  const supportProjectionErrors = rows
    .filter((row) => row.supportProjectionError)
    .map((row) => ({ branchId: row.branchId, ...row.supportProjectionError }));

  report = {
    schema: 'Sequential1885NcBlockedEvidence.v1',
    sourceCommit: SOURCE_COMMIT,
    generated: true,
    failure: null,
    fixtureRecordCount: records.length,
    indexedBranchCount: evidence.branches.length,
    indexedComponentCount: evidence.components.length,
    evidenceAudit: evidence.audit,
    branchStateCounts: countBy(rows, (row) => row.state),
    blockedReasonCounts: countBy(blockedRows, (row) => row.blockedReason),
    componentTypeCounts: countBy(evidence.components, (component) => component.canonicalType),
    referenceStatusCounts: countBy(references, (reference) => `${reference.status}:${reference.kind}`),
    missingEvidenceClassCounts: countBy(blockedRows, (row) => row.missingEvidenceClass),
    featureCounts: featureCounts(rows),
    supportProjectionCounts: {
      acceptedConstructionCount: rows.filter((row) => row.constructionFingerprint).length,
      resolvedSupportFamilyCount: rows.reduce(
        (sum, row) => sum + (row.supportProjection?.resolvedSupportFamilyCount || 0),
        0,
      ),
      unresolvedSupportFamilyCount: rows.reduce(
        (sum, row) => sum + (row.supportProjection?.unresolvedSupportFamilyCount || 0),
        0,
      ),
      supportProjectionErrorCount: supportProjectionErrors.length,
    },
    sourceBoundaryCounts: {
      classificationCount: boundaryClassifications.length,
      rootCount: rows.filter((row) => row.boundaryClassificationCount > 0).length,
      acceptedRootCount: rows.filter((row) => row.state === 'ROUTE_COMPLETE' && row.boundaryClassificationCount > 0).length,
      blockedAfterBoundaryCount: rows.filter((row) => row.state === 'USER_DECISION_REQUIRED' && row.boundaryClassificationCount > 0).length,
      boundaryRoleCounts: countBy(boundaryClassifications, (row) => row.boundaryRole),
      dialectCounts: countBy(boundaryClassifications, (row) => row.dialect),
    },
    sScope: {
      lineKeys: [...new Set(sRows.map((row) => row.lineKey))].sort(),
      branchCount: sRows.length,
      branchStateCounts: countBy(sRows, (row) => row.state),
      blockedReasonCounts: countBy(
        sRows.filter((row) => row.blockedReason),
        (row) => row.blockedReason,
      ),
      featureCounts: featureCounts(sRows),
    },
    validation: {
      runtimeErrorCount: runtimeErrors.length,
      automaticRepairCount: rows.reduce((sum, row) => sum + row.repairCount, 0),
      sourceCoordinatesMutated: JSON.stringify(records) !== immutableSnapshot,
      supportProjectionErrorCount: supportProjectionErrors.length,
    },
    runtimeErrors,
    supportProjectionErrors,
    branches: rows,
  };
  writeReport(report);

  const expected = {
    fixtureRecordCount: baseline.fixtureRecordCount,
    indexedBranchCount: baseline.indexedBranchCount,
    indexedComponentCount: baseline.indexedComponentCount,
    evidenceAudit: baseline.evidenceAudit,
    branchStateCounts: baseline.branchStateCounts,
    blockedReasonCounts: baseline.blockedReasonCounts,
    componentTypeCounts: baseline.componentTypeCounts,
    referenceStatusCounts: baseline.referenceStatusCounts,
    featureCounts: baseline.featureCounts,
    supportProjectionCounts: baseline.supportProjectionCounts,
    sourceBoundaryCounts: baseline.sourceBoundaryCounts,
    sScope: baseline.sScope,
    validation: baseline.validation,
  };
  assert.deepEqual(
    baselineProjection(report),
    expected,
    'Pinned fixture baseline changed without an explained baseline update',
  );
  assertOutcomeDelta(rows, outcomeDelta);
  assert.equal(
    report.validation.supportProjectionErrorCount,
    0,
    'Accepted construction support projection must not fail',
  );
  console.log(JSON.stringify({
    schema: report.schema,
    branchStateCounts: report.branchStateCounts,
    blockedReasonCounts: report.blockedReasonCounts,
    missingEvidenceClassCounts: report.missingEvidenceClassCounts,
    supportProjectionCounts: report.supportProjectionCounts,
    sourceBoundaryCounts: report.sourceBoundaryCounts,
    validation: report.validation,
  }, null, 2));
} catch (error) {
  report = {
    ...report,
    generated: false,
    failure: { name: error.name, message: error.message, stack: error.stack },
  };
  writeReport(report);
  throw error;
}
