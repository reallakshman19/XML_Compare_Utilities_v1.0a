import { deriveSupportReportLocationNominalBoreMm } from './support-report-location-grouping.js?v=20260915-support-primary-hardening-1';
import { normalizePipeClass } from './support-report-typicality.js?v=20260911-support-report-typicality-member-count-1';

export const SUPPORT_REPORT_RELATIONSHIP_TOPOLOGY_SCHEMA = 'SupportReportRelationshipTopologyAudit.v1';
export const SUPPORT_REPORT_RELATIONSHIP_TOPOLOGY_PROFILE = 'RELATIONSHIP_TOPOLOGY_V1';

const HARD_SIGNAL_CODES = Object.freeze([
  'REL_EFFECTIVE_ASSEMBLY_COUNT_EQUAL',
  'REL_EXPLICIT_ASSEMBLY_COUNT_EQUAL',
  'REL_ASSEMBLY_MEMBER_COUNT_SPECTRUM_EQUAL',
  'REL_PIPE_CLASS_POPULATION_EQUAL',
  'REL_NOMINAL_BORE_POPULATION_EQUAL',
]);

export function buildSupportReportRelationshipTopologyAudit(leftReportBundle, rightReportBundle) {
  const leftFamilies = extractRelationshipTopologyFamilyFeatures(leftReportBundle);
  const rightFamilies = extractRelationshipTopologyFamilyFeatures(rightReportBundle);
  const familyComparisons = [];
  for (const left of leftFamilies) {
    for (const right of rightFamilies) familyComparisons.push(compareRelationshipTopologyFamilies(left, right));
  }
  const matches = leftFamilies.map((left) => selectRelationshipTopologyMatch(
    left.familyId,
    familyComparisons.filter((item) => item.leftFamilyId === left.familyId),
  ));
  return Object.freeze({
    schema: SUPPORT_REPORT_RELATIONSHIP_TOPOLOGY_SCHEMA,
    profileId: SUPPORT_REPORT_RELATIONSHIP_TOPOLOGY_PROFILE,
    leftFamilyCount: leftFamilies.length,
    rightFamilyCount: rightFamilies.length,
    leftFamilies,
    rightFamilies,
    familyComparisons: Object.freeze(familyComparisons),
    matches: Object.freeze(matches),
  });
}

export function extractRelationshipTopologyFamilyFeatures(reportBundle = {}) {
  const summaries = new Map((reportBundle?.primarySupportFamilySummaries || []).map((summary) => [
    token(summary?.familyId), summary,
  ]).filter(([familyId]) => familyId));
  const rowsByFamily = new Map();
  for (const row of reportBundle?.rows || []) {
    const familyId = token(row?.civilSecondarySupport);
    if (!familyId) continue;
    if (!rowsByFamily.has(familyId)) rowsByFamily.set(familyId, []);
    rowsByFamily.get(familyId).push(row);
  }
  const familyIds = unique([...summaries.keys(), ...rowsByFamily.keys()]).sort();
  return Object.freeze(familyIds.map((familyId) => relationshipTopologyFamilyFeatures(
    familyId,
    summaries.get(familyId) || null,
    rowsByFamily.get(familyId) || [],
  )));
}

export function compareRelationshipTopologyFamilies(left, right) {
  const availability = comparisonAvailability(left, right);
  if (availability.result === 'UNAVAILABLE') return freezeComparison(left, right, {
    result: 'UNAVAILABLE',
    reasonCode: 'REL_TOPOLOGY_UNAVAILABLE',
    availability,
    signals: [],
  });
  if (availability.result === 'REVIEW') return freezeComparison(left, right, {
    result: 'REVIEW',
    reasonCode: 'REL_TOPOLOGY_REVIEW_PARTIAL_AUTHORITY',
    availability,
    signals: [],
  });

  const signals = Object.freeze([
    exactSignal('REL_EFFECTIVE_ASSEMBLY_COUNT_EQUAL', left.effectiveAssemblyCount, right.effectiveAssemblyCount),
    exactSignal('REL_EXPLICIT_ASSEMBLY_COUNT_EQUAL', left.explicitAssemblyCount, right.explicitAssemblyCount),
    exactSignal('REL_ASSEMBLY_MEMBER_COUNT_SPECTRUM_EQUAL', left.assemblyMemberCountSpectrum, right.assemblyMemberCountSpectrum),
    populationSignal('REL_PIPE_CLASS_POPULATION_EQUAL', left.normalizedPipeClassPopulation, right.normalizedPipeClassPopulation),
    populationSignal('REL_NOMINAL_BORE_POPULATION_EQUAL', left.nominalBorePopulationMm, right.nominalBorePopulationMm),
  ]);
  const hard = signals.filter((item) => HARD_SIGNAL_CODES.includes(item.reasonCode));
  const unavailable = hard.filter((item) => item.result === 'UNAVAILABLE');
  if (unavailable.length) return freezeComparison(left, right, {
    result: 'REVIEW',
    reasonCode: 'REL_TOPOLOGY_REVIEW_REQUIRED_SIGNAL_UNAVAILABLE',
    availability,
    signals,
  });
  const failed = hard.filter((item) => item.result === 'FAIL');
  return freezeComparison(left, right, {
    result: failed.length ? 'NO_MATCH' : 'MATCH',
    reasonCode: failed.length ? 'REL_TOPOLOGY_MISMATCH' : 'REL_TOPOLOGY_MATCH',
    availability,
    signals,
  });
}

export function selectRelationshipTopologyMatch(leftFamilyId, comparisons = []) {
  const matches = comparisons.filter((item) => item.result === 'MATCH').sort(comparisonRank);
  if (matches.length === 1) return Object.freeze({
    leftFamilyId,
    rightFamilyId: matches[0].rightFamilyId,
    auditId: matches[0].auditId,
    result: 'MATCH',
    reasonCode: 'REL_TOPOLOGY_MATCH',
    confidence: 'HIGH',
    candidateFamilyIds: Object.freeze([matches[0].rightFamilyId]),
  });
  if (matches.length > 1) return Object.freeze({
    leftFamilyId,
    rightFamilyId: '',
    auditId: '',
    result: 'REVIEW',
    reasonCode: 'REL_TOPOLOGY_AMBIGUOUS_MATCHES',
    confidence: 'LOW',
    candidateFamilyIds: Object.freeze(matches.map((item) => item.rightFamilyId)),
    candidateAuditIds: Object.freeze(matches.map((item) => item.auditId)),
  });

  const reviews = comparisons.filter((item) => item.result === 'REVIEW').sort(comparisonRank);
  if (reviews.length) return Object.freeze({
    leftFamilyId,
    rightFamilyId: reviews.length === 1 ? reviews[0].rightFamilyId : '',
    auditId: reviews.length === 1 ? reviews[0].auditId : '',
    result: 'REVIEW',
    reasonCode: reviews.length === 1 ? reviews[0].reasonCode : 'REL_TOPOLOGY_REVIEW_MULTIPLE_CANDIDATES',
    confidence: 'LOW',
    candidateFamilyIds: Object.freeze(reviews.map((item) => item.rightFamilyId)),
    candidateAuditIds: Object.freeze(reviews.map((item) => item.auditId)),
  });

  const rejected = comparisons.filter((item) => item.result === 'NO_MATCH').sort(comparisonRank);
  if (rejected.length) {
    const best = rejected[0];
    return Object.freeze({
      leftFamilyId,
      rightFamilyId: '',
      auditId: best.auditId,
      result: 'NO_MATCH',
      reasonCode: 'REL_TOPOLOGY_NO_MATCH',
      confidence: 'HIGH',
      bestCandidateFamilyId: best.rightFamilyId,
      bestCandidateAuditId: best.auditId,
      failedReasonCodes: Object.freeze(best.failedReasonCodes),
      candidateFamilyIds: Object.freeze([]),
    });
  }

  return Object.freeze({
    leftFamilyId,
    rightFamilyId: '',
    auditId: '',
    result: 'UNAVAILABLE',
    reasonCode: 'REL_TOPOLOGY_UNAVAILABLE',
    confidence: 'UNAVAILABLE',
    candidateFamilyIds: Object.freeze([]),
  });
}

function relationshipTopologyFamilyFeatures(familyId, summary, rows) {
  const explicitAssemblyIds = Object.freeze([...(summary?.explicitAssemblyIds || [])].filter(Boolean).sort());
  const geometryOnlyGroupIds = Object.freeze([...(summary?.geometryOnlyGroupIds || [])].filter(Boolean).sort());
  const ambiguityCount = Number(summary?.ambiguityCount || 0);
  const explicitRelationshipFamilyAvailable = Boolean(summary?.explicitRelationshipFamilyAvailable);
  const authorityStatus = !explicitRelationshipFamilyAvailable
    ? 'UNAVAILABLE'
    : ambiguityCount > 0 || geometryOnlyGroupIds.length > 0
      ? 'EXPLICIT_PARTIAL'
      : 'EXPLICIT_COMPLETE';
  const effectiveAssemblyCount = finiteCount(summary?.totalSupportPointsOnSecondary, rows[0]?.totalSupportPointsOnSecondary);
  const assemblyMemberCountSpectrum = explicitAssemblyIds.map(explicitAssemblyConcreteMemberCount).sort((a, b) => a - b);
  const normalizedPipeClassPopulation = rows.map((row) => normalizePipeClass(row?.pipe)).filter(Boolean).sort();
  const nominalBorePopulationMm = rows.map((row) => nominalBoreMm(row)).filter(positive).sort((a, b) => a - b);
  return Object.freeze({
    familyId,
    authorityStatus,
    explicitRelationshipFamilyAvailable,
    effectiveAssemblyCount,
    explicitAssemblyCount: explicitAssemblyIds.length,
    explicitAssemblyIds,
    assemblyMemberCountSpectrum: Object.freeze(assemblyMemberCountSpectrum),
    geometryOnlyGroupIds,
    ambiguityCount,
    normalizedPipeClassPopulation: Object.freeze(normalizedPipeClassPopulation),
    nominalBorePopulationMm: Object.freeze(nominalBorePopulationMm),
    sourceRowCount: rows.length,
    orphanRecoveredGroupCount: (summary?.orphanRecoveredGroupIds || []).length,
    orphanAmbiguousGroupCount: (summary?.orphanAmbiguousGroupIds || []).length,
    orphanUnresolvedGroupCount: (summary?.orphanUnresolvedGroupIds || []).length,
  });
}

function comparisonAvailability(left, right) {
  if (left?.authorityStatus === 'UNAVAILABLE' || right?.authorityStatus === 'UNAVAILABLE') return Object.freeze({
    result: 'UNAVAILABLE',
    left: left?.authorityStatus || 'UNAVAILABLE',
    right: right?.authorityStatus || 'UNAVAILABLE',
  });
  if (left?.authorityStatus !== 'EXPLICIT_COMPLETE' || right?.authorityStatus !== 'EXPLICIT_COMPLETE') return Object.freeze({
    result: 'REVIEW',
    left: left?.authorityStatus || 'UNAVAILABLE',
    right: right?.authorityStatus || 'UNAVAILABLE',
  });
  return Object.freeze({ result: 'AVAILABLE', left: left.authorityStatus, right: right.authorityStatus });
}

function freezeComparison(left, right, input) {
  const failedReasonCodes = (input.signals || []).filter((item) => item.result === 'FAIL').map((item) => item.reasonCode);
  const unavailableReasonCodes = (input.signals || []).filter((item) => item.result === 'UNAVAILABLE').map((item) => item.reasonCode);
  return Object.freeze({
    auditId: relationshipAuditId(left?.familyId, right?.familyId),
    leftFamilyId: left?.familyId || '',
    rightFamilyId: right?.familyId || '',
    result: input.result,
    reasonCode: input.reasonCode,
    profileId: SUPPORT_REPORT_RELATIONSHIP_TOPOLOGY_PROFILE,
    availability: input.availability,
    failedReasonCodes: Object.freeze(failedReasonCodes),
    unavailableReasonCodes: Object.freeze(unavailableReasonCodes),
    mismatchCount: failedReasonCodes.length,
    signals: Object.freeze([...(input.signals || [])]),
  });
}

function exactSignal(reasonCode, left, right) {
  return Object.freeze({
    reasonCode,
    left,
    right,
    result: stable(left) === stable(right) ? 'PASS' : 'FAIL',
    comparison: 'EXACT',
  });
}

function populationSignal(reasonCode, left, right) {
  if (!left?.length || !right?.length) return Object.freeze({
    reasonCode,
    left: Object.freeze([...(left || [])]),
    right: Object.freeze([...(right || [])]),
    result: 'UNAVAILABLE',
    comparison: 'MULTISET_EXACT',
  });
  return exactSignal(reasonCode, left, right);
}

function explicitAssemblyConcreteMemberCount(assemblyId) {
  const members = clean(assemblyId).match(/::M-([^:]+)$/u)?.[1] || '';
  if (!members) return 0;
  return members.split('+').map((value) => value.trim()).filter(Boolean).length;
}

function nominalBoreMm(row) {
  const direct = Number(row?.size);
  if (positive(direct)) return rounded(direct);
  const derived = Number(deriveSupportReportLocationNominalBoreMm(row?.pipe));
  return positive(derived) ? rounded(derived) : null;
}

function finiteCount(primary, fallback) {
  const value = Number(primary);
  if (Number.isFinite(value) && value >= 0) return value;
  const alternate = Number(fallback);
  return Number.isFinite(alternate) && alternate >= 0 ? alternate : 0;
}

function comparisonRank(left, right) {
  return left.mismatchCount - right.mismatchCount
    || left.unavailableReasonCodes.length - right.unavailableReasonCodes.length
    || left.rightFamilyId.localeCompare(right.rightFamilyId);
}

function relationshipAuditId(leftFamilyId, rightFamilyId) {
  return `RELTOP-${token(leftFamilyId) || 'UNRESOLVED'}--${token(rightFamilyId) || 'UNRESOLVED'}`;
}

function rounded(value) { return Math.round(Number(value) * 1000) / 1000; }
function positive(value) { return Number.isFinite(Number(value)) && Number(value) > 0; }
function clean(value) { return value == null ? '' : String(value).trim(); }
function token(value) { return clean(value).replace(/^\/+/, '').replace(/\(REF\)$/iu, '').toUpperCase(); }
function unique(values) { return [...new Set((values || []).filter(Boolean))]; }
function stable(value) { return JSON.stringify(value); }

export const _test = Object.freeze({
  comparisonAvailability,
  explicitAssemblyConcreteMemberCount,
  nominalBoreMm,
  relationshipTopologyFamilyFeatures,
});