import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseSupportReportClashXml } from '../tabs/support-steel-relationship-builder/support-report-clash-safety.js';
import { buildSupportReportBundle } from '../tabs/support-steel-relationship-builder/support-report-engine.js';
import {
  buildSupportReportTypicalityComparison,
  SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL,
} from '../tabs/support-steel-relationship-builder/support-report-typicality-projection.js';
import { extractStructuralFamilyFeatures } from '../tabs/support-steel-relationship-builder/support-report-typicality.js';

const samples = Object.freeze({
  '11168': 'benchmarks/11168.xml',
  '14168': 'benchmarks/14168.xml',
  '12120': 'benchmarks/SupportreportXML-PS-12120.xml',
  '12154-mixed': 'benchmarks/SupportreportXML-PS-068_PS-12154.xml',
});

const parsed = Object.fromEntries(Object.entries(samples).map(([id, path]) => {
  const evidence = parseSupportReportClashXml(readFileSync(path, 'utf8'));
  const report = buildSupportReportBundle({ clashEvidence: evidence });
  return [id, { evidence, report }];
}));

function signal(comparison, code) {
  return comparison?.signals?.find((item) => item.reasonCode === code) || null;
}

function familySummary(id, evidence) {
  return extractStructuralFamilyFeatures(evidence).map((family) => ({
    sample: id,
    familyId: family.familyId,
    locationCount: family.locationCount,
    numericPrimarySupportMemberCount: family.numericPrimarySupportMemberCount,
    memberMultiplicitySpectrum: family.memberMultiplicitySpectrum,
    normalizedPipeClassPopulation: family.normalizedPipeClassPopulation,
    rawClashPointCount: family.rawClashPointCount,
    envelopeSpanMm: family.geometryEnvelopeMm?.span || null,
    pairDistanceCount: family.pairDistanceSpectrumMm.length,
  }));
}

function compare(leftId, rightId, label) {
  const left = parsed[leftId];
  const right = parsed[rightId];
  const audit = buildSupportReportTypicalityComparison(left.evidence, right.evidence, {
    leftReportBundle: left.report,
    rightReportBundle: right.report,
    profile: SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL,
  });
  return {
    label,
    left: leftId,
    right: rightId,
    profileId: audit.profileId,
    structuralMatches: audit.structuralMatches.map((item) => ({
      leftFamilyId: item.leftFamilyId,
      rightFamilyId: item.rightFamilyId,
      result: item.result,
      reasonCode: item.reasonCode,
    })),
    matches: audit.matches.map((item) => ({
      leftFamilyId: item.leftFamilyId,
      rightFamilyId: item.rightFamilyId,
      result: item.result,
      reasonCode: item.reasonCode,
      locationAssignmentResult: item.locationAssignmentResult || null,
      locationCorrespondenceStatus: item.locationCorrespondenceStatus || null,
      locationMatchingMode: item.locationMatchingMode || null,
    })),
    familyComparisons: audit.familyComparisons.map((item) => ({
      leftFamilyId: item.leftFamilyId,
      rightFamilyId: item.rightFamilyId,
      result: item.result,
      reasonCode: item.reasonCode,
      geometryCostMm: item.geometryCostMm,
      locationCount: signal(item, 'STRUCT_LOCATION_COUNT_EQUAL')?.result || null,
      memberMultiplicity: signal(item, 'STRUCT_MEMBER_MULTIPLICITY_EQUAL')?.result || null,
      pipeClassPopulation: signal(item, 'STRUCT_PIPE_CLASS_POPULATION_EQUAL')?.result || null,
      rawPointCount: signal(item, 'STRUCT_RAW_CLASH_POINT_COUNT_EQUAL')?.result || null,
      envelopeResidualMm: signal(item, 'STRUCT_GEOMETRY_ENVELOPE_WITHIN_TOLERANCE')?.residual ?? null,
      pairDistanceResidualMm: signal(item, 'STRUCT_PAIR_DISTANCE_WITHIN_TOLERANCE')?.residual || null,
    })),
    locationAssignments: audit.locationAssignments.map((item) => ({
      leftFamilyId: item.leftFamilyId,
      rightFamilyId: item.rightFamilyId,
      result: item.result,
      correspondenceStatus: item.correspondenceStatus,
      matchingMode: item.matchingMode,
      selectedCount: item.selectedAssignments.length,
      unmatchedLeftCount: item.unmatchedLeftLocationIds.length,
      unmatchedRightCount: item.unmatchedRightLocationIds.length,
      ambiguousCount: item.ambiguousLocationIds.length,
      totalAssignmentCost: item.totalAssignmentCost,
      dimensionalEvidence: item.dimensionalEvidence,
    })),
  };
}

const observedCases = [
  compare('11168', '14168', 'KNOWN_POSITIVE'),
  compare('14168', '11168', 'KNOWN_POSITIVE_REVERSE'),
  compare('11168', '12120', 'KNOWN_NEGATIVE'),
  compare('14168', '12120', 'OBSERVATION'),
  compare('11168', '12154-mixed', 'OBSERVATION'),
  compare('14168', '12154-mixed', 'OBSERVATION'),
  compare('12120', '12154-mixed', 'OBSERVATION'),
  compare('11168', '11168', 'SELF_CONTROL'),
  compare('12120', '12120', 'SELF_CONTROL'),
  compare('12154-mixed', '12154-mixed', 'SELF_CONTROL_MULTI_FAMILY'),
];

const calibrationMatrix = Object.freeze({
  schema: 'SupportReportTypicalityCalibration.v1',
  profileId: SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL.profileId,
  familyInventory: Object.entries(parsed).flatMap(([id, item]) => familySummary(id, item.evidence)),
  cases: observedCases,
});

test('known positive and negative XML benchmark controls retain expected classification', () => {
  const positive = observedCases.find((item) => item.label === 'KNOWN_POSITIVE');
  const positiveReverse = observedCases.find((item) => item.label === 'KNOWN_POSITIVE_REVERSE');
  const negative = observedCases.find((item) => item.label === 'KNOWN_NEGATIVE');
  assert.equal(positive.structuralMatches[0].result, 'TYPICAL');
  assert.equal(positiveReverse.structuralMatches[0].result, 'TYPICAL');
  assert.equal(positive.matches[0].result, 'REVIEW');
  assert.equal(positive.matches[0].reasonCode, 'TYPICAL_CONSENSUS_AXIS_REVIEW');
  assert.equal(positiveReverse.matches[0].result, 'REVIEW');
  assert.equal(positiveReverse.matches[0].reasonCode, 'TYPICAL_CONSENSUS_AXIS_REVIEW');
  assert.equal(negative.matches[0].result, 'NO_MATCH');
});

test('self controls never lose their own canonical family as a valid structural comparison', () => {
  for (const entry of observedCases.filter((item) => item.label.startsWith('SELF_CONTROL'))) {
    for (const family of entry.familyComparisons.filter((item) => item.leftFamilyId === item.rightFamilyId)) {
      assert.equal(family.result, 'TYPICAL');
      assert.equal(family.envelopeResidualMm, 0);
      assert.deepEqual(family.pairDistanceResidualMm, { median: 0, p95: 0, max: 0 });
    }
  }
});

test('raw member-family tokens do not become zero-location typicality candidates', () => {
  const mixed = calibrationMatrix.familyInventory.filter((item) => item.sample === '12154-mixed');
  assert.deepEqual(mixed.map((item) => item.familyId), ['PS-068', 'PS-12154']);
  assert.ok(mixed.every((item) => item.locationCount > 0));
});

test('emit compact calibration matrix for current repository benchmark inventory', () => {
  console.log(`TYPICALITY_CALIBRATION_MATRIX_V1=${JSON.stringify(calibrationMatrix)}`);
  assert.equal(calibrationMatrix.profileId, 'PS_TYPICAL_V1_PROVISIONAL');
  assert.equal(calibrationMatrix.familyInventory.length, 5);
});
