import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseSupportReportClashXml } from '../tabs/support-steel-relationship-builder/support-report-clash-safety.js';
import { buildSupportReportBundle } from '../tabs/support-steel-relationship-builder/support-report-engine.js';
import { SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL } from '../tabs/support-steel-relationship-builder/support-report-typicality-projection.js';
import { buildTypicalityLocationAssignment } from '../tabs/support-steel-relationship-builder/support-report-typicality-location.js';

const [leftRoot, rightRoot, benchmarkJson] = process.argv.slice(2);
if (!leftRoot || !rightRoot || !benchmarkJson) {
  throw new Error('Usage: node support-report-typicality-ambiguity-diagnostic.mjs <leftDir> <rightDir> <benchmarkJson>');
}

const MAX_CANDIDATES_TO_EVALUATE = 3;

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

function loadFirst(root) {
  const path = xmlFiles(root)[0];
  if (!path) throw new Error(`No XML payload found under ${root}`);
  const evidence = parseSupportReportClashXml(readFileSync(path, 'utf8'));
  return { evidence, report: buildSupportReportBundle({ clashEvidence: evidence }) };
}

function candidateSummary(left, right, familyComparisons, match, rightFamilyId) {
  const structural = familyComparisons.find((item) =>
    item.leftFamilyId === match.leftFamilyId && item.rightFamilyId === rightFamilyId);
  const assignment = buildTypicalityLocationAssignment(left.evidence, right.evidence, {
    leftFamilyId: match.leftFamilyId,
    rightFamilyId,
    parentAuditId: structural?.auditId || `AMB-${match.leftFamilyId}--${rightFamilyId}`,
    leftReportBundle: left.report,
    rightReportBundle: right.report,
    profile: SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL,
  });
  const selected = assignment.selectedAssignments || [];
  const complete = assignment.unmatchedLeftLocationIds.length === 0
    && assignment.unmatchedRightLocationIds.length === 0;
  const materiallyUnambiguous = assignment.correspondenceStatus !== 'AMBIGUOUS_MATERIAL';
  const arrangementComplete = ['EXACT', 'TOPOLOGY_ONLY'].includes(assignment.result);
  const decisive = complete && materiallyUnambiguous && arrangementComplete;
  return {
    rightFamilyId,
    familyNameClass: structural?.familyNameEvidence?.class || 'NONE',
    familyNameRank: structural?.familyNameEvidence?.rank || 0,
    structuralGeometryCostMm: structural?.geometryCostMm ?? null,
    assignmentResult: assignment.result,
    correspondenceStatus: assignment.correspondenceStatus,
    matchingMode: assignment.matchingMode,
    selectedCount: selected.length,
    unmatchedLeftCount: assignment.unmatchedLeftLocationIds.length,
    unmatchedRightCount: assignment.unmatchedRightLocationIds.length,
    ambiguousCount: assignment.ambiguousLocationIds.length,
    partialPairCount: selected.filter((item) => item.arrangementResult === 'PARTIAL').length,
    geometryFailCount: selected.filter((item) => item.signals?.geometry?.result === 'FAIL').length,
    noPassingDimensionCount: selected.filter((item) => item.signals?.structuredSequence?.firstPassingDimension == null).length,
    memberOrdinalExactCount: selected.filter((item) => item.signals?.memberOrdinalPattern?.result === 'EXACT').length,
    totalAssignmentCost: assignment.totalAssignmentCost,
    decisive,
  };
}

function histogram(values) {
  const counts = new Map();
  for (const value of values) counts.set(String(value), (counts.get(String(value)) || 0) + 1);
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

const benchmark = JSON.parse(readFileSync(benchmarkJson, 'utf8'));
const comparison = benchmark.comparisons?.[0];
if (!comparison) throw new Error('Benchmark JSON contains no comparison');
const leftInventory = new Map((benchmark.leftInventory?.[0]?.familyInventory || [])
  .map((item) => [item.familyId, item]));
const ambiguous = (comparison.familyMatches || []).filter((match) => match.result === 'AMBIGUOUS');
const evaluable = [];
const skippedSingleLocation = [];
const skippedLargeCandidateSet = [];
for (const match of ambiguous) {
  const locationCount = Number(leftInventory.get(match.leftFamilyId)?.locationCount || 0);
  const candidateCount = match.candidateFamilyIds?.length || 0;
  if (locationCount <= 1) {
    skippedSingleLocation.push({ leftFamilyId: match.leftFamilyId, locationCount, candidateCount });
  } else if (candidateCount > MAX_CANDIDATES_TO_EVALUATE) {
    skippedLargeCandidateSet.push({ leftFamilyId: match.leftFamilyId, locationCount, candidateCount });
  } else {
    evaluable.push({ match, locationCount, candidateCount });
  }
}

const left = loadFirst(leftRoot);
const right = loadFirst(rightRoot);
const cases = evaluable.map(({ match, locationCount, candidateCount }) => {
  const candidates = (match.candidateFamilyIds || []).map((rightFamilyId) =>
    candidateSummary(left, right, comparison.familyComparisons || [], match, rightFamilyId));
  const decisive = candidates.filter((item) => item.decisive);
  return {
    leftFamilyId: match.leftFamilyId,
    reasonCode: match.reasonCode,
    locationCount,
    candidateCount,
    decisiveCandidateCount: decisive.length,
    uniqueDecisiveRightFamilyId: decisive.length === 1 ? decisive[0].rightFamilyId : '',
    candidates,
  };
});

const result = {
  schema: 'SupportReportTypicalityAmbiguityDiagnostic.v2',
  policy: {
    maxCandidatesToEvaluate: MAX_CANDIDATES_TO_EVALUATE,
    requireMultipleLocations: true,
    decisiveDefinition: 'complete assignment + not AMBIGUOUS_MATERIAL + EXACT/TOPOLOGY_ONLY arrangement',
    productionMatcherChanged: false,
  },
  ambiguousFamilyCount: ambiguous.length,
  evaluatedCaseCount: cases.length,
  evaluatedCandidateAssignmentCount: cases.reduce((sum, item) => sum + item.candidateCount, 0),
  skippedSingleLocationCount: skippedSingleLocation.length,
  skippedLargeCandidateSetCount: skippedLargeCandidateSet.length,
  allAmbiguousCandidateCountHistogram: histogram(ambiguous.map((item) => item.candidateFamilyIds?.length || 0)),
  evaluatedCandidateCountHistogram: histogram(cases.map((item) => item.candidateCount)),
  decisiveCandidateCountHistogram: histogram(cases.map((item) => item.decisiveCandidateCount)),
  uniquelyResolvableByCompleteLocationAssignmentCount: cases.filter((item) => item.decisiveCandidateCount === 1).length,
  unresolvedWithNoDecisiveCandidateCount: cases.filter((item) => item.decisiveCandidateCount === 0).length,
  unresolvedWithMultipleDecisiveCandidatesCount: cases.filter((item) => item.decisiveCandidateCount > 1).length,
  skippedSingleLocation: skippedSingleLocation.slice(0, 20),
  skippedLargeCandidateSet: skippedLargeCandidateSet.slice(0, 20),
  uniquelyResolvableCases: cases.filter((item) => item.decisiveCandidateCount === 1),
  representativeUnresolvedCases: cases.filter((item) => item.decisiveCandidateCount !== 1).slice(0, 20),
};

console.log(`ZIP_AMBIGUITY_ASSIGNMENT_DIAGNOSTICS=${JSON.stringify(result)}`);