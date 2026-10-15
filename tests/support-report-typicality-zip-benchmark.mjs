import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { parseSupportReportClashXml } from '../tabs/support-steel-relationship-builder/support-report-clash-safety.js';
import { buildSupportReportBundle } from '../tabs/support-steel-relationship-builder/support-report-engine.js';
import {
  buildSupportReportTypicalityComparison,
  SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL,
} from '../tabs/support-steel-relationship-builder/support-report-typicality-projection.js';
import {
  buildTypicalityLocationAssignment,
} from '../tabs/support-steel-relationship-builder/support-report-typicality-location.js';
import { extractStructuralFamilyFeatures } from '../tabs/support-steel-relationship-builder/support-report-typicality.js';

const [leftRoot, rightRoot, outputPath = '/tmp/typicality-zip-benchmark.json'] = process.argv.slice(2);
if (!leftRoot || !rightRoot) {
  throw new Error('Usage: node support-report-typicality-zip-benchmark.mjs <leftDir> <rightDir> [outputJson]');
}

function xmlFiles(root) {
  const out = [];
  function walk(path) {
    for (const name of readdirSync(path)) {
      const full = join(path, name);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (/\.xml$/iu.test(name)) out.push(full);
    }
  }
  walk(root);
  return out.sort();
}

function signal(comparison, code) {
  return comparison?.signals?.find((item) => item.reasonCode === code) || null;
}

function loadXml(path, root) {
  const evidence = parseSupportReportClashXml(readFileSync(path, 'utf8'));
  const report = buildSupportReportBundle({ clashEvidence: evidence });
  const families = extractStructuralFamilyFeatures(evidence);
  return {
    path,
    name: relative(root, path),
    evidence,
    report,
    familyInventory: families.map((family) => ({
      familyId: family.familyId,
      locationCount: family.locationCount,
      numericPrimarySupportMemberCount: family.numericPrimarySupportMemberCount,
      memberMultiplicitySpectrum: family.memberMultiplicitySpectrum,
      normalizedPipeClassPopulation: family.normalizedPipeClassPopulation,
      rawClashPointCount: family.rawClashPointCount,
      envelopeSpanMm: family.geometryEnvelopeMm?.span || null,
      pairDistanceCount: family.pairDistanceSpectrumMm.length,
    })),
  };
}

function familyDigits(id) {
  const match = String(id || '').match(/^([A-Z]+)-(\d+)$/u);
  return match ? { prefix: match[1], digits: match[2], trailing3: match[2].slice(-3) } : null;
}

function selectedPairSummary(pair) {
  const sequence = pair?.signals?.structuredSequence || {};
  return {
    leftLocationId: pair.leftLocationId,
    rightLocationId: pair.rightLocationId,
    arrangementResult: pair.arrangementResult,
    assignmentCost3d: pair.assignmentCost,
    assignmentCost2d: pair.assignmentCost2d ?? null,
    assignmentCost1d: pair.assignmentCost1d ?? null,
    firstPassingDimension: sequence.firstPassingDimension || null,
    supportTypeResult: pair.supportTypeComparison?.result || 'UNAVAILABLE',
    memberOrdinalResult: pair.signals?.memberOrdinalPattern?.result || 'UNAVAILABLE',
    memberOrdinalSimilarity: pair.signals?.memberOrdinalPattern?.similarity ?? null,
    prevNameClass: pair.signals?.previousNamePattern?.class || 'UNAVAILABLE',
    prevNameSimilarity: pair.signals?.previousNamePattern?.similarity ?? null,
    pipeClassReasonCode: pair.signals?.pipeClass?.reasonCode || '',
    geometryResidual: pair.signals?.geometry?.residual || null,
  };
}

function summarizeComparison(left, right) {
  const audit = buildSupportReportTypicalityComparison(left.evidence, right.evidence, {
    leftReportBundle: left.report,
    rightReportBundle: right.report,
    profile: SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL,
  });
  const assignmentByFamily = new Map((audit.locationAssignments || []).map((item) => [
    `${item.leftFamilyId}\u0000${item.rightFamilyId}`,
    item,
  ]));
  return {
    leftXml: left.name,
    rightXml: right.name,
    profileId: audit.profileId,
    familyMatches: (audit.matches || []).map((match) => {
      const assignment = assignmentByFamily.get(`${match.leftFamilyId}\u0000${match.rightFamilyId}`) || null;
      return {
        leftFamilyId: match.leftFamilyId,
        rightFamilyId: match.rightFamilyId || '',
        result: match.result,
        reasonCode: match.reasonCode,
        candidateFamilyIds: match.candidateFamilyIds || [],
        candidateAuditIds: match.candidateAuditIds || [],
        bestCandidateFamilyId: match.bestCandidateFamilyId || '',
        bestCandidateAuditId: match.bestCandidateAuditId || '',
        failedReasonCodes: match.failedReasonCodes || [],
        familyNameEvidence: match.familyNameEvidence || match.bestCandidateFamilyNameEvidence || null,
        locationAssignmentResult: match.locationAssignmentResult || assignment?.result || null,
        correspondenceStatus: match.locationCorrespondenceStatus || assignment?.correspondenceStatus || null,
        matchingMode: match.locationMatchingMode || assignment?.matchingMode || null,
        selectedCount: assignment?.selectedAssignments?.length || 0,
        unmatchedLeftCount: assignment?.unmatchedLeftLocationIds?.length || 0,
        unmatchedRightCount: assignment?.unmatchedRightLocationIds?.length || 0,
        ambiguousCount: assignment?.ambiguousLocationIds?.length || 0,
        totalAssignmentCost: assignment?.totalAssignmentCost ?? null,
        dimensionalEvidence: assignment?.dimensionalEvidence || null,
        selectedPairs: (assignment?.selectedAssignments || []).map(selectedPairSummary),
      };
    }),
    familyComparisons: (audit.familyComparisons || []).map((comparison) => {
      const uniqueMemberCountSignal = signal(comparison, 'STRUCT_UNIQUE_PRIMARY_MEMBER_COUNT_EQUAL');
      const summary = {
        leftFamilyId: comparison.leftFamilyId,
        rightFamilyId: comparison.rightFamilyId,
        result: comparison.result,
        reasonCode: comparison.reasonCode,
        geometryCostMm: comparison.geometryCostMm,
        locationCount: signal(comparison, 'STRUCT_LOCATION_COUNT_EQUAL')?.result || null,
        uniqueMemberCount: uniqueMemberCountSignal?.result || null,
        uniqueMemberCountLeft: uniqueMemberCountSignal?.left ?? null,
        uniqueMemberCountRight: uniqueMemberCountSignal?.right ?? null,
        memberMultiplicity: signal(comparison, 'STRUCT_MEMBER_MULTIPLICITY_EQUAL')?.result || null,
        pipeClassPopulation: signal(comparison, 'STRUCT_PIPE_CLASS_POPULATION_EQUAL')?.result || null,
        rawPointCount: signal(comparison, 'STRUCT_RAW_CLASH_POINT_COUNT_EQUAL')?.result || null,
        envelope: signal(comparison, 'STRUCT_GEOMETRY_ENVELOPE_WITHIN_TOLERANCE')?.result || null,
        envelopeResidualMm: signal(comparison, 'STRUCT_GEOMETRY_ENVELOPE_WITHIN_TOLERANCE')?.residual ?? null,
        pairDistance: signal(comparison, 'STRUCT_PAIR_DISTANCE_WITHIN_TOLERANCE')?.result || null,
        pairDistanceResidualMm: signal(comparison, 'STRUCT_PAIR_DISTANCE_WITHIN_TOLERANCE')?.residual || null,
      };
      summary.requiredTopologyPassCount = [summary.locationCount, summary.uniqueMemberCount,
        summary.memberMultiplicity, summary.pipeClassPopulation].filter((value) => value === 'PASS').length;
      summary.requiredSignalPassCount = [summary.locationCount, summary.uniqueMemberCount,
        summary.memberMultiplicity, summary.pipeClassPopulation, summary.envelope, summary.pairDistance]
        .filter((value) => value === 'PASS').length;
      summary.auditOnlyPassCount = [summary.rawPointCount].filter((value) => value === 'PASS').length;
      summary.exactTopologyPassCount = summary.requiredTopologyPassCount + summary.auditOnlyPassCount;
      summary.allSignalPassCount = summary.requiredSignalPassCount + summary.auditOnlyPassCount;
      const l = familyDigits(summary.leftFamilyId);
      const r = familyDigits(summary.rightFamilyId);
      summary.sameTrailing3 = Boolean(l && r && l.prefix === r.prefix && l.trailing3 === r.trailing3);
      return summary;
    }),
  };
}

function locationDiagnostic(left, right, familyComparison) {
  const assignment = buildTypicalityLocationAssignment(left.evidence, right.evidence, {
    leftFamilyId: familyComparison.leftFamilyId,
    rightFamilyId: familyComparison.rightFamilyId,
    parentAuditId: `ZIP-${familyComparison.leftFamilyId}--${familyComparison.rightFamilyId}`,
    leftReportBundle: left.report,
    rightReportBundle: right.report,
    profile: SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL,
  });
  const selected = assignment.selectedAssignments || [];
  const supportTypeExact = selected.filter((pair) => pair.supportTypeComparison?.result === 'EXACT').length;
  const supportTypePartial = selected.filter((pair) => pair.supportTypeComparison?.result === 'PARTIAL').length;
  const supportTypeUnavailable = selected.filter((pair) => pair.supportTypeComparison?.result === 'UNAVAILABLE').length;
  const memberExact = selected.filter((pair) => pair.signals?.memberOrdinalPattern?.result === 'EXACT').length;
  const dimensions = Object.fromEntries(['3D', '2D', '1D'].map((dimension) => [dimension,
    selected.filter((pair) => pair.signals?.structuredSequence?.firstPassingDimension === dimension).length]));
  const noPassingDimension = selected.filter((pair) => pair.signals?.structuredSequence?.firstPassingDimension == null).length;
  return {
    ...familyComparison,
    locationAssignment: {
      result: assignment.result,
      correspondenceStatus: assignment.correspondenceStatus,
      matchingMode: assignment.matchingMode,
      selectedCount: selected.length,
      unmatchedLeftCount: assignment.unmatchedLeftLocationIds.length,
      unmatchedRightCount: assignment.unmatchedRightLocationIds.length,
      ambiguousCount: assignment.ambiguousLocationIds.length,
      supportTypeExact,
      supportTypePartial,
      supportTypeUnavailable,
      memberOrdinalExact: memberExact,
      firstPassingDimensions: dimensions,
      noPassingDimension,
      dimensionalEvidence: assignment.dimensionalEvidence,
    },
  };
}

function histogram(values) {
  const counts = new Map();
  for (const value of values) counts.set(String(value || 'UNSPECIFIED'), (counts.get(String(value || 'UNSPECIFIED')) || 0) + 1);
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

const leftFiles = xmlFiles(leftRoot).map((path) => loadXml(path, leftRoot));
const rightFiles = xmlFiles(rightRoot).map((path) => loadXml(path, rightRoot));
if (!leftFiles.length || !rightFiles.length) {
  throw new Error(`No XML payloads found: left=${leftFiles.length}, right=${rightFiles.length}`);
}

const comparisons = [];
for (const left of leftFiles) {
  for (const right of rightFiles) comparisons.push(summarizeComparison(left, right));
}

const firstLeft = leftFiles[0];
const firstRight = rightFiles[0];
const allFamilyComparisons = comparisons.flatMap((comparison) => comparison.familyComparisons);
const allFamilyMatches = comparisons.flatMap((comparison) => comparison.familyMatches);
const rank = (a, b) => b.requiredTopologyPassCount - a.requiredTopologyPassCount
  || b.requiredSignalPassCount - a.requiredSignalPassCount
  || (Number(a.geometryCostMm) || Number.MAX_SAFE_INTEGER) - (Number(b.geometryCostMm) || Number.MAX_SAFE_INTEGER)
  || a.leftFamilyId.localeCompare(b.leftFamilyId)
  || a.rightFamilyId.localeCompare(b.rightFamilyId);
const topNear = [...allFamilyComparisons].sort(rank).slice(0, 30);
const sameTrailing3 = allFamilyComparisons.filter((item) => item.sameTrailing3).sort(rank);
const diagnosticSeed = [...new Map([...sameTrailing3.slice(0, 30), ...topNear]
  .map((item) => [`${item.leftFamilyId}\u0000${item.rightFamilyId}`, item])).values()].slice(0, 40);
const locationDiagnostics = diagnosticSeed.map((item) => locationDiagnostic(firstLeft, firstRight, item));

const passHistogram = Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7].map((count) => [count,
  allFamilyComparisons.filter((item) => item.allSignalPassCount === count).length]));
const topologyHistogram = Object.fromEntries([0, 1, 2, 3, 4, 5].map((count) => [count,
  allFamilyComparisons.filter((item) => item.exactTopologyPassCount === count).length]));
const requiredSignalPassHistogram = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((count) => [count,
  allFamilyComparisons.filter((item) => item.requiredSignalPassCount === count).length]));
const requiredTopologyPassHistogram = Object.fromEntries([0, 1, 2, 3, 4].map((count) => [count,
  allFamilyComparisons.filter((item) => item.requiredTopologyPassCount === count).length]));
const finalMatchResultHistogram = Object.fromEntries(['TYPICAL', 'REVIEW', 'AMBIGUOUS', 'NO_MATCH'].map((resultName) => [
  resultName,
  allFamilyMatches.filter((item) => item.result === resultName).length,
]));
const finalReasonCodeHistogram = histogram(allFamilyMatches.map((item) => item.reasonCode));
const reviewMatches = allFamilyMatches.filter((item) => item.result === 'REVIEW');
const ambiguousMatches = allFamilyMatches.filter((item) => item.result === 'AMBIGUOUS');
const ambiguityReasonHistogram = histogram(ambiguousMatches.map((item) => item.reasonCode));
const ambiguousCandidateCountHistogram = histogram(ambiguousMatches.map((item) => item.candidateFamilyIds?.length || 0));

const result = {
  schema: 'SupportReportTypicalityZipBenchmark.v2',
  profileId: SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL.profileId,
  leftArchive: basename(leftRoot),
  rightArchive: basename(rightRoot),
  leftXmlCount: leftFiles.length,
  rightXmlCount: rightFiles.length,
  leftInventory: leftFiles.map(({ name, familyInventory }) => ({ name, familyInventory })),
  rightInventory: rightFiles.map(({ name, familyInventory }) => ({ name, familyInventory })),
  comparisons,
  diagnostics: {
    familyComparisonCount: allFamilyComparisons.length,
    acceptedStructuralCount: allFamilyComparisons.filter((item) => item.result === 'TYPICAL').length,
    finalFamilyDecisionCount: allFamilyMatches.length,
    finalMatchResultHistogram,
    finalReasonCodeHistogram,
    finalResolvedCounterpartCount: allFamilyMatches.filter((item) => item.rightFamilyId).length,
    sameTrailing3CandidateCount: sameTrailing3.length,
    requiredSignalPassHistogram,
    requiredTopologyPassHistogram,
    allSignalPassHistogram: passHistogram,
    exactTopologyPassHistogram: topologyHistogram,
    ambiguityReasonHistogram,
    ambiguousCandidateCountHistogram,
    ambiguousMatches,
    reviewMatches,
    topNearCandidates: topNear,
    topSameTrailing3Candidates: sameTrailing3.slice(0, 40),
    locationDiagnostics,
  },
};

writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(`ZIP_BENCHMARK_DIAGNOSTICS=${JSON.stringify({
  schema: result.schema,
  profileId: result.profileId,
  leftXmlCount: result.leftXmlCount,
  rightXmlCount: result.rightXmlCount,
  leftFamilyCount: result.leftInventory.reduce((sum, x) => sum + x.familyInventory.length, 0),
  rightFamilyCount: result.rightInventory.reduce((sum, x) => sum + x.familyInventory.length, 0),
  familyComparisonCount: result.diagnostics.familyComparisonCount,
  acceptedStructuralCount: result.diagnostics.acceptedStructuralCount,
  finalFamilyDecisionCount: result.diagnostics.finalFamilyDecisionCount,
  finalMatchResultHistogram: result.diagnostics.finalMatchResultHistogram,
  finalReasonCodeHistogram: result.diagnostics.finalReasonCodeHistogram,
  finalResolvedCounterpartCount: result.diagnostics.finalResolvedCounterpartCount,
  sameTrailing3CandidateCount: result.diagnostics.sameTrailing3CandidateCount,
  requiredSignalPassHistogram: result.diagnostics.requiredSignalPassHistogram,
  requiredTopologyPassHistogram: result.diagnostics.requiredTopologyPassHistogram,
  allSignalPassHistogram: result.diagnostics.allSignalPassHistogram,
  exactTopologyPassHistogram: result.diagnostics.exactTopologyPassHistogram,
  ambiguityReasonHistogram: result.diagnostics.ambiguityReasonHistogram,
  ambiguousCandidateCountHistogram: result.diagnostics.ambiguousCandidateCountHistogram,
  ambiguousMatches: result.diagnostics.ambiguousMatches.slice(0, 20),
  reviewMatches: result.diagnostics.reviewMatches.slice(0, 20),
  topNearCandidates: result.diagnostics.topNearCandidates.slice(0, 20),
  topSameTrailing3Candidates: result.diagnostics.topSameTrailing3Candidates.slice(0, 20),
  locationDiagnostics: result.diagnostics.locationDiagnostics.slice(0, 25),
})}`);