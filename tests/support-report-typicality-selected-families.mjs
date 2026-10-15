import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseSupportReportClashXml } from '../tabs/support-steel-relationship-builder/support-report-clash-safety.js';
import { buildSupportReportBundle } from '../tabs/support-steel-relationship-builder/support-report-engine.js';
import {
  buildCanonicalTypicalityLocations,
  buildTypicalityLocationAssignment,
} from '../tabs/support-steel-relationship-builder/support-report-typicality-location.js';
import {
  compareStructuralFamilyFeatures,
  extractStructuralFamilyFeatures,
} from '../tabs/support-steel-relationship-builder/support-report-typicality.js';
import {
  SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL,
} from '../tabs/support-steel-relationship-builder/support-report-typicality-projection.js';

const [leftRoot, rightRoot] = process.argv.slice(2);
if (!leftRoot || !rightRoot) throw new Error('left/right extracted ZIP directories required');

const requested = [
  ['PS-10076', 'PS-12076'],
  ['PS-10669', 'PS-12669'],
  ['PS-10146', 'PS-12146'],
  ['PS-10231', 'PS-12231'],
];

function firstXml(root) {
  const found = [];
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (/\.xml$/iu.test(name)) found.push(full);
    }
  }
  walk(root);
  found.sort();
  if (!found.length) throw new Error(`No XML in ${root}`);
  return found[0];
}

const leftEvidence = parseSupportReportClashXml(readFileSync(firstXml(leftRoot), 'utf8'));
const rightEvidence = parseSupportReportClashXml(readFileSync(firstXml(rightRoot), 'utf8'));
const leftReport = buildSupportReportBundle({ clashEvidence: leftEvidence });
const rightReport = buildSupportReportBundle({ clashEvidence: rightEvidence });
const leftFamilies = new Map(extractStructuralFamilyFeatures(leftEvidence).map((f) => [f.familyId, f]));
const rightFamilies = new Map(extractStructuralFamilyFeatures(rightEvidence).map((f) => [f.familyId, f]));
const leftLocations = buildCanonicalTypicalityLocations(leftEvidence, leftReport);
const rightLocations = buildCanonicalTypicalityLocations(rightEvidence, rightReport);

const relaxedProfile = {
  ...SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL,
  profileId: `${SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL.profileId}__DIAGNOSTIC_PIPE_GATE_OFF`,
  pipingLocation: {
    ...SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL.pipingLocation,
    requireCompatiblePipeClass: false,
  },
};

function structuralSignal(cmp, code) {
  const x = cmp.signals.find((s) => s.reasonCode === code);
  if (!x) return null;
  return { result: x.result, left: x.left ?? null, right: x.right ?? null, residual: x.residual ?? null };
}

function familySnapshot(f) {
  if (!f) return null;
  return {
    familyId: f.familyId,
    locationCount: f.locationCount,
    numericPrimarySupportMemberCount: f.numericPrimarySupportMemberCount,
    memberMultiplicitySpectrum: f.memberMultiplicitySpectrum,
    normalizedPipeClassPopulation: f.normalizedPipeClassPopulation,
    rawClashPointCount: f.rawClashPointCount,
    envelopeMinMm: f.geometryEnvelopeMm?.min || null,
    envelopeMaxMm: f.geometryEnvelopeMm?.max || null,
    envelopeSpanMm: f.geometryEnvelopeMm?.span || null,
    pairDistanceCount: f.pairDistanceSpectrumMm?.length || 0,
  };
}

function locationSnapshot(loc) {
  return {
    locationId: loc.locationId,
    fullLineTag: loc.fullLineTag,
    normalizedPipeClass: loc.normalizedPipeClass,
    primarySupportMemberIds: loc.primarySupportMemberIds,
    memberMultiplicity: loc.memberMultiplicity,
    representativePointGlobalMm: loc.representativePointGlobalMm,
    localPointMm: loc.localPointMm,
    distanceFingerprintMm: loc.distanceFingerprintMm,
    supportTypesRaw: loc.supportTypesRaw,
    previousNamesRaw: loc.previousNamesRaw,
    clashEvidenceCount: loc.clashEvidenceIds.length,
  };
}

function assignmentSnapshot(a) {
  return {
    result: a.result,
    correspondenceStatus: a.correspondenceStatus,
    matchingMode: a.matchingMode,
    totalAssignmentCost: a.totalAssignmentCost,
    selectedCount: a.selectedAssignments.length,
    unmatchedLeft: a.unmatchedLeftLocationIds,
    unmatchedRight: a.unmatchedRightLocationIds,
    ambiguous: a.ambiguousLocationIds,
    dimensionalEvidence: a.dimensionalEvidence,
    selectedPairs: a.selectedAssignments.map((p) => ({
      leftLocationId: p.leftLocationId,
      rightLocationId: p.rightLocationId,
      arrangementResult: p.arrangementResult,
      eligible: p.eligible,
      assignmentCost3d: p.assignmentCost,
      assignmentCost2d: p.assignmentCost2d,
      assignmentCost1d: p.assignmentCost1d,
      pipeClass: p.signals.pipeClass,
      memberMultiplicity: p.signals.memberMultiplicity,
      geometry: p.signals.geometry,
      firstPassingDimension: p.signals.structuredSequence?.firstPassingDimension || null,
      sequenceStages: p.signals.structuredSequence?.stages || [],
      memberOrdinalPattern: p.signals.memberOrdinalPattern,
      previousNamePattern: p.signals.previousNamePattern,
      supportTypeComparison: p.supportTypeComparison,
    })),
  };
}

const output = [];
for (const [leftFamilyId, rightFamilyId] of requested) {
  const lf = leftFamilies.get(leftFamilyId);
  const rf = rightFamilies.get(rightFamilyId);
  if (!lf || !rf) {
    output.push({ leftFamilyId, rightFamilyId, error: `Missing family: left=${Boolean(lf)} right=${Boolean(rf)}` });
    continue;
  }
  const cmp = compareStructuralFamilyFeatures(lf, rf, SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL);
  const current = buildTypicalityLocationAssignment(leftEvidence, rightEvidence, {
    leftFamilyId, rightFamilyId, parentAuditId: `SELECTED-${leftFamilyId}-${rightFamilyId}`,
    leftReportBundle: leftReport, rightReportBundle: rightReport,
    profile: SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL,
  });
  const relaxed = buildTypicalityLocationAssignment(leftEvidence, rightEvidence, {
    leftFamilyId, rightFamilyId, parentAuditId: `SELECTED-RELAXED-${leftFamilyId}-${rightFamilyId}`,
    leftReportBundle: leftReport, rightReportBundle: rightReport, profile: relaxedProfile,
  });
  output.push({
    leftFamilyId,
    rightFamilyId,
    leftFamily: familySnapshot(lf),
    rightFamily: familySnapshot(rf),
    structuralComparison: {
      result: cmp.result,
      reasonCode: cmp.reasonCode,
      geometryCostMm: cmp.geometryCostMm,
      locationCount: structuralSignal(cmp, 'STRUCT_LOCATION_COUNT_EQUAL'),
      memberMultiplicity: structuralSignal(cmp, 'STRUCT_MEMBER_MULTIPLICITY_EQUAL'),
      pipeClassPopulation: structuralSignal(cmp, 'STRUCT_PIPE_CLASS_POPULATION_EQUAL'),
      rawPointCount: structuralSignal(cmp, 'STRUCT_RAW_CLASH_POINT_COUNT_EQUAL'),
      envelope: structuralSignal(cmp, 'STRUCT_GEOMETRY_ENVELOPE_WITHIN_TOLERANCE'),
      pairDistance: structuralSignal(cmp, 'STRUCT_PAIR_DISTANCE_WITHIN_TOLERANCE'),
    },
    leftLocations: leftLocations.filter((x) => x.familyId === leftFamilyId).map(locationSnapshot),
    rightLocations: rightLocations.filter((x) => x.familyId === rightFamilyId).map(locationSnapshot),
    currentAssignment: assignmentSnapshot(current),
    pipeGateRelaxedDiagnostic: assignmentSnapshot(relaxed),
  });
}

console.log(`ZIP_SELECTED_FAMILIES=${JSON.stringify(output)}`);