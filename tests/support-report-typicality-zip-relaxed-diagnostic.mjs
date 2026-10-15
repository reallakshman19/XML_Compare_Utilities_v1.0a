import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseSupportReportClashXml } from '../tabs/support-steel-relationship-builder/support-report-clash-safety.js';
import { buildSupportReportBundle } from '../tabs/support-steel-relationship-builder/support-report-engine.js';
import {
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

function familyKey(id) {
  const match = String(id || '').match(/^([A-Z]+)-(\d+)$/u);
  return match ? `${match[1]}:${match[2].slice(-3)}` : '';
}

const leftEvidence = parseSupportReportClashXml(readFileSync(firstXml(leftRoot), 'utf8'));
const rightEvidence = parseSupportReportClashXml(readFileSync(firstXml(rightRoot), 'utf8'));
const leftReport = buildSupportReportBundle({ clashEvidence: leftEvidence });
const rightReport = buildSupportReportBundle({ clashEvidence: rightEvidence });
const leftFamilies = extractStructuralFamilyFeatures(leftEvidence);
const rightFamilies = extractStructuralFamilyFeatures(rightEvidence);
const rightByKey = new Map();
for (const family of rightFamilies) {
  const key = familyKey(family.familyId);
  if (!key) continue;
  if (!rightByKey.has(key)) rightByKey.set(key, []);
  rightByKey.get(key).push(family);
}

const candidates = [];
for (const left of leftFamilies) {
  const key = familyKey(left.familyId);
  for (const right of rightByKey.get(key) || []) {
    const comparison = compareStructuralFamilyFeatures(left, right, SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL);
    const signal = (code) => comparison.signals.find((item) => item.reasonCode === code);
    const row = {
      leftFamilyId: left.familyId,
      rightFamilyId: right.familyId,
      leftPipeClasses: left.normalizedPipeClassPopulation,
      rightPipeClasses: right.normalizedPipeClassPopulation,
      locationCount: signal('STRUCT_LOCATION_COUNT_EQUAL')?.result,
      memberMultiplicity: signal('STRUCT_MEMBER_MULTIPLICITY_EQUAL')?.result,
      pipeClassPopulation: signal('STRUCT_PIPE_CLASS_POPULATION_EQUAL')?.result,
      rawPointCount: signal('STRUCT_RAW_CLASH_POINT_COUNT_EQUAL')?.result,
      envelope: signal('STRUCT_GEOMETRY_ENVELOPE_WITHIN_TOLERANCE')?.result,
      envelopeResidualMm: signal('STRUCT_GEOMETRY_ENVELOPE_WITHIN_TOLERANCE')?.residual ?? null,
      pairDistance: signal('STRUCT_PAIR_DISTANCE_WITHIN_TOLERANCE')?.result,
      pairDistanceResidualMm: signal('STRUCT_PAIR_DISTANCE_WITHIN_TOLERANCE')?.residual || null,
      geometryCostMm: comparison.geometryCostMm,
    };
    row.nonPipeExactPassCount = [row.locationCount, row.memberMultiplicity, row.rawPointCount]
      .filter((value) => value === 'PASS').length;
    row.geometryPassCount = [row.envelope, row.pairDistance].filter((value) => value === 'PASS').length;
    candidates.push(row);
  }
}

candidates.sort((a, b) => b.nonPipeExactPassCount - a.nonPipeExactPassCount
  || b.geometryPassCount - a.geometryPassCount
  || (Number(a.geometryCostMm) || 1e15) - (Number(b.geometryCostMm) || 1e15)
  || a.leftFamilyId.localeCompare(b.leftFamilyId));

const relaxedProfile = {
  ...SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL,
  profileId: `${SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL.profileId}__DIAGNOSTIC_PIPE_GATE_OFF`,
  pipingLocation: {
    ...SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL.pipingLocation,
    requireCompatiblePipeClass: false,
  },
};

function summarizeAssignment(candidate) {
  const assignment = buildTypicalityLocationAssignment(leftEvidence, rightEvidence, {
    leftFamilyId: candidate.leftFamilyId,
    rightFamilyId: candidate.rightFamilyId,
    parentAuditId: `RELAXED-${candidate.leftFamilyId}--${candidate.rightFamilyId}`,
    leftReportBundle: leftReport,
    rightReportBundle: rightReport,
    profile: relaxedProfile,
  });
  const selected = assignment.selectedAssignments || [];
  return {
    ...candidate,
    relaxedAssignment: {
      result: assignment.result,
      correspondenceStatus: assignment.correspondenceStatus,
      matchingMode: assignment.matchingMode,
      selectedCount: selected.length,
      unmatchedLeftCount: assignment.unmatchedLeftLocationIds.length,
      unmatchedRightCount: assignment.unmatchedRightLocationIds.length,
      ambiguousCount: assignment.ambiguousLocationIds.length,
      arrangementExactCount: selected.filter((p) => p.arrangementResult === 'EXACT').length,
      arrangementTopologyOnlyCount: selected.filter((p) => p.arrangementResult === 'TOPOLOGY_ONLY').length,
      arrangementPartialCount: selected.filter((p) => p.arrangementResult === 'PARTIAL').length,
      supportTypeExactCount: selected.filter((p) => p.supportTypeComparison?.result === 'EXACT').length,
      supportTypePartialCount: selected.filter((p) => p.supportTypeComparison?.result === 'PARTIAL').length,
      supportTypeUnavailableCount: selected.filter((p) => p.supportTypeComparison?.result === 'UNAVAILABLE').length,
      memberOrdinalExactCount: selected.filter((p) => p.signals?.memberOrdinalPattern?.result === 'EXACT').length,
      firstPassing3dCount: selected.filter((p) => p.signals?.structuredSequence?.firstPassingDimension === '3D').length,
      firstPassing2dCount: selected.filter((p) => p.signals?.structuredSequence?.firstPassingDimension === '2D').length,
      firstPassing1dCount: selected.filter((p) => p.signals?.structuredSequence?.firstPassingDimension === '1D').length,
      dimensionalEvidence: assignment.dimensionalEvidence,
      selectedPairs: selected.map((p) => ({
        leftLocationId: p.leftLocationId,
        rightLocationId: p.rightLocationId,
        arrangementResult: p.arrangementResult,
        supportTypeResult: p.supportTypeComparison?.result || 'UNAVAILABLE',
        memberOrdinalResult: p.signals?.memberOrdinalPattern?.result || 'UNAVAILABLE',
        memberOrdinalSimilarity: p.signals?.memberOrdinalPattern?.similarity ?? null,
        firstPassingDimension: p.signals?.structuredSequence?.firstPassingDimension || null,
        geometryResidual: p.signals?.geometry?.residual || null,
        pipeClassLeft: p.signals?.pipeClass?.left || '',
        pipeClassRight: p.signals?.pipeClass?.right || '',
      })),
    },
  };
}

const top = candidates.slice(0, 30).map(summarizeAssignment);
console.log(`ZIP_RELAXED_PIPE_DIAGNOSTICS=${JSON.stringify({
  profileId: relaxedProfile.profileId,
  sameTrailing3CandidateCount: candidates.length,
  top,
})}`);
