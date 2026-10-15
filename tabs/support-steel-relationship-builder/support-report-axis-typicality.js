import {
  buildSupportReportTraversalGeometryIndex,
  deriveSupportReportLocationNominalBoreMm,
} from './support-report-location-grouping.js?v=20260915-support-primary-hardening-1';
import { normalizePipeClass } from './support-report-typicality.js?v=20260911-support-report-typicality-member-count-1';

export const SUPPORT_REPORT_AXIS_TYPICALITY_SCHEMA = 'SupportReportAxisTypicalityAudit.v1';
export const SUPPORT_REPORT_AXIS_TYPICALITY_PROFILE_ID = 'AXIS_TYPICALITY_V1';
export const SUPPORT_REPORT_AXIS_TYPICALITY_PROFILE = Object.freeze({
  profileId: SUPPORT_REPORT_AXIS_TYPICALITY_PROFILE_ID,
  axialRatioTolerance: 0.25,
  lateralRatioTolerance: 0.25,
  relativeAxisAngleToleranceDeg: 5,
});

const EPSILON = 1e-9;

export function buildSupportReportAxisTypicalityAudit(leftEvidence, rightEvidence, options = {}) {
  const profile = axisProfile(options.profile);
  const leftFamilies = extractAxisTypicalityFamilyFeatures(leftEvidence);
  const rightFamilies = extractAxisTypicalityFamilyFeatures(rightEvidence);
  const familyComparisons = [];
  for (const left of leftFamilies) {
    for (const right of rightFamilies) familyComparisons.push(compareAxisTypicalityFamilies(left, right, profile));
  }
  const matches = leftFamilies.map((left) => selectAxisTypicalityMatch(
    left.familyId,
    familyComparisons.filter((item) => item.leftFamilyId === left.familyId),
  ));
  return Object.freeze({
    schema: SUPPORT_REPORT_AXIS_TYPICALITY_SCHEMA,
    profileId: profile.profileId,
    profileSnapshot: profile,
    leftFamilyCount: leftFamilies.length,
    rightFamilyCount: rightFamilies.length,
    leftFamilies,
    rightFamilies,
    familyComparisons: Object.freeze(familyComparisons),
    matches: Object.freeze(matches),
  });
}

export function extractAxisTypicalityFamilyFeatures(evidence = {}) {
  const familyIds = unique((evidence?.groups || [])
    .map((group) => token(group?.secondarySupportFamilyId))
    .filter(Boolean)).sort();
  return Object.freeze(familyIds.map((familyId) => axisFamilyFeatures(evidence, familyId)));
}

export function compareAxisTypicalityFamilies(left, right, profile = SUPPORT_REPORT_AXIS_TYPICALITY_PROFILE) {
  const availability = comparisonAvailability(left, right);
  if (availability.result === 'UNAVAILABLE') return freezeComparison(left, right, profile, {
    result: 'UNAVAILABLE',
    reasonCode: 'AXIS_TYPICALITY_UNAVAILABLE',
    availability,
    signals: [],
  });
  if (availability.result === 'REVIEW') return freezeComparison(left, right, profile, {
    result: 'REVIEW',
    reasonCode: 'AXIS_TYPICALITY_REVIEW_PARTIAL_EVIDENCE',
    availability,
    signals: [],
  });

  const topologySignals = Object.freeze([
    exactSignal('AXIS_LOCATION_COUNT_EQUAL', left.sourceLocationCount, right.sourceLocationCount),
    exactSignal('AXIS_TRAVERSAL_COUNT_EQUAL', left.sourceTraversalCount, right.sourceTraversalCount),
    exactSignal('AXIS_LOCATIONS_PER_TRAVERSAL_EQUAL', left.locationsPerTraversalSpectrum, right.locationsPerTraversalSpectrum),
    exactSignal('AXIS_RETURN_MULTIPLICITY_EQUAL', left.returnMultiplicitySpectrum, right.returnMultiplicitySpectrum),
  ]);
  const topologyFailed = topologySignals.filter((item) => item.result === 'FAIL');
  if (topologyFailed.length) return freezeComparison(left, right, profile, {
    result: 'NO_MATCH',
    reasonCode: 'AXIS_TYPICALITY_TOPOLOGY_MISMATCH',
    availability,
    signals: topologySignals,
  });

  const spacing = normalizedSpacingSignal(left.dnNormalizedPairSpectrum, right.dnNormalizedPairSpectrum, profile);
  const angles = angleSpectrumSignal(left.relativeAxisAngleSpectrumDeg, right.relativeAxisAngleSpectrumDeg, profile);
  const geometrySignals = Object.freeze([spacing, angles]);
  const availableGeometry = geometrySignals.filter((item) => item.result !== 'UNAVAILABLE');
  if (!availableGeometry.length) return freezeComparison(left, right, profile, {
    result: 'UNAVAILABLE',
    reasonCode: 'AXIS_TYPICALITY_UNAVAILABLE_INTRINSIC_GEOMETRY',
    availability,
    signals: Object.freeze([...topologySignals, ...geometrySignals]),
  });
  const geometryFailed = availableGeometry.filter((item) => item.result === 'FAIL');
  if (geometryFailed.length) return freezeComparison(left, right, profile, {
    result: 'NO_MATCH',
    reasonCode: 'AXIS_TYPICALITY_GEOMETRY_MISMATCH',
    availability,
    signals: Object.freeze([...topologySignals, ...geometrySignals]),
  });

  const positiveEvidence = positiveMatchEvidenceSignal(left, right);
  if (positiveEvidence.result === 'UNAVAILABLE') return freezeComparison(left, right, profile, {
    result: 'UNAVAILABLE',
    reasonCode: 'AXIS_TYPICALITY_UNAVAILABLE_INSUFFICIENT_POSITIVE_EVIDENCE',
    availability,
    signals: Object.freeze([...topologySignals, ...geometrySignals, positiveEvidence]),
  });

  return freezeComparison(left, right, profile, {
    result: 'MATCH',
    reasonCode: 'AXIS_TYPICALITY_MATCH',
    availability,
    signals: Object.freeze([...topologySignals, ...geometrySignals, positiveEvidence]),
  });
}

export function selectAxisTypicalityMatch(leftFamilyId, comparisons = []) {
  const matches = comparisons.filter((item) => item.result === 'MATCH').sort(comparisonRank);
  const reviews = comparisons.filter((item) => item.result === 'REVIEW').sort(comparisonRank);
  const unavailable = comparisons.filter((item) => item.result === 'UNAVAILABLE').sort(comparisonRank);

  if (matches.length > 1) return Object.freeze({
    leftFamilyId,
    rightFamilyId: '',
    auditId: '',
    result: 'REVIEW',
    reasonCode: 'AXIS_TYPICALITY_AMBIGUOUS_MATCHES',
    confidence: 'LOW',
    candidateFamilyIds: Object.freeze(matches.map((item) => item.rightFamilyId)),
    candidateAuditIds: Object.freeze(matches.map((item) => item.auditId)),
  });
  if (matches.length === 1 && (reviews.length || unavailable.length)) return Object.freeze({
    leftFamilyId,
    rightFamilyId: '',
    auditId: matches[0].auditId,
    result: 'REVIEW',
    reasonCode: 'AXIS_TYPICALITY_REVIEW_UNASSESSED_CANDIDATES',
    confidence: 'LOW',
    candidateFamilyIds: Object.freeze(unique([
      matches[0].rightFamilyId,
      ...reviews.map((item) => item.rightFamilyId),
      ...unavailable.map((item) => item.rightFamilyId),
    ])),
    candidateAuditIds: Object.freeze(unique([
      matches[0].auditId,
      ...reviews.map((item) => item.auditId),
      ...unavailable.map((item) => item.auditId),
    ])),
  });
  if (matches.length === 1) return Object.freeze({
    leftFamilyId,
    rightFamilyId: matches[0].rightFamilyId,
    auditId: matches[0].auditId,
    result: 'MATCH',
    reasonCode: 'AXIS_TYPICALITY_MATCH',
    confidence: 'HIGH',
    candidateFamilyIds: Object.freeze([matches[0].rightFamilyId]),
  });

  if (reviews.length) return Object.freeze({
    leftFamilyId,
    rightFamilyId: reviews.length === 1 ? reviews[0].rightFamilyId : '',
    auditId: reviews.length === 1 ? reviews[0].auditId : '',
    result: 'REVIEW',
    reasonCode: reviews.length === 1 ? reviews[0].reasonCode : 'AXIS_TYPICALITY_REVIEW_MULTIPLE_CANDIDATES',
    confidence: 'LOW',
    candidateFamilyIds: Object.freeze(reviews.map((item) => item.rightFamilyId)),
    candidateAuditIds: Object.freeze(reviews.map((item) => item.auditId)),
  });

  if (unavailable.length) return Object.freeze({
    leftFamilyId,
    rightFamilyId: '',
    auditId: unavailable.length === 1 ? unavailable[0].auditId : '',
    result: 'UNAVAILABLE',
    reasonCode: 'AXIS_TYPICALITY_UNAVAILABLE',
    confidence: 'UNAVAILABLE',
    candidateFamilyIds: Object.freeze([]),
    unavailableCandidateFamilyIds: Object.freeze(unavailable.map((item) => item.rightFamilyId)),
  });

  const rejected = comparisons.filter((item) => item.result === 'NO_MATCH').sort(comparisonRank);
  if (rejected.length) {
    const best = rejected[0];
    return Object.freeze({
      leftFamilyId,
      rightFamilyId: '',
      auditId: best.auditId,
      result: 'NO_MATCH',
      reasonCode: 'AXIS_TYPICALITY_NO_MATCH',
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
    reasonCode: 'AXIS_TYPICALITY_UNAVAILABLE',
    confidence: 'UNAVAILABLE',
    candidateFamilyIds: Object.freeze([]),
  });
}

function axisFamilyFeatures(evidence, familyId) {
  const groups = (evidence?.groups || []).filter((group) => token(group?.secondarySupportFamilyId) === familyId);
  const rows = uniqueRows(groups.flatMap((group) => group?.evidenceRows || []));
  const geometryIndex = buildSupportReportTraversalGeometryIndex(rows);
  const traversalMap = new Map();
  let ambiguousGroupTraversalCount = 0;

  for (const group of groups) {
    const traversal = groupTraversal(group);
    if (!traversal) {
      ambiguousGroupTraversalCount += 1;
      continue;
    }
    if (!traversalMap.has(traversal.key)) traversalMap.set(traversal.key, {
      key: traversal.key,
      fullLineTag: traversal.fullLineTag,
      branchNode: traversal.branchNode,
      groups: [],
    });
    traversalMap.get(traversal.key).groups.push(group);
  }

  const traversals = [...traversalMap.values()].sort((left, right) => left.key.localeCompare(right.key));
  const internalAxes = [];
  const locationsPerTraversalSpectrum = [];
  const dnNormalizedPairSpectrum = [];
  const returnClassCounts = new Map();
  let unavailableTraversalCount = 0;
  let missingBorePairOpportunityCount = 0;

  for (const traversal of traversals) {
    const model = geometryIndex.get(traversal.key) || null;
    const trusted = Boolean(model?.trusted && validAxis(model.axis));
    locationsPerTraversalSpectrum.push(traversal.groups.length);
    const pipeClass = normalizePipeClass(traversal.fullLineTag);
    if (pipeClass) returnClassCounts.set(pipeClass, (returnClassCounts.get(pipeClass) || 0) + 1);
    if (!trusted) {
      unavailableTraversalCount += 1;
      continue;
    }
    internalAxes.push({
      key: traversal.key,
      axis: model.axis,
      basis: model.basis,
      confidenceRatio: finiteOrNull(model.confidenceRatio),
      pointCount: Number(model.pointCount || 0),
    });
    const boreMm = traversalBoreMm(traversal.groups, traversal.fullLineTag);
    const pointGroups = traversal.groups.filter((group) => validPoint(group?.representativeClashPointGlobalMm));
    if (pointGroups.length >= 2 && !positive(boreMm)) missingBorePairOpportunityCount += pairCount(pointGroups.length);
    if (!positive(boreMm)) continue;
    for (let left = 0; left < pointGroups.length; left += 1) {
      for (let right = left + 1; right < pointGroups.length; right += 1) {
        const descriptor = normalizedPairDescriptor(
          pointGroups[left].representativeClashPointGlobalMm,
          pointGroups[right].representativeClashPointGlobalMm,
          model.axis,
          boreMm,
        );
        if (descriptor) dnNormalizedPairSpectrum.push(descriptor);
      }
    }
  }

  const relativeAxisAngleSpectrumDeg = [];
  for (let left = 0; left < internalAxes.length; left += 1) {
    for (let right = left + 1; right < internalAxes.length; right += 1) {
      relativeAxisAngleSpectrumDeg.push(unsignedAxisAngleDeg(internalAxes[left].axis, internalAxes[right].axis));
    }
  }

  dnNormalizedPairSpectrum.sort(pairDescriptorCompare);
  relativeAxisAngleSpectrumDeg.sort((a, b) => a - b);
  locationsPerTraversalSpectrum.sort((a, b) => a - b);
  const returnMultiplicitySpectrum = [...returnClassCounts.values()].sort((a, b) => a - b);
  const informedGeometryCount = dnNormalizedPairSpectrum.length + relativeAxisAngleSpectrumDeg.length;
  const authorityStatus = !internalAxes.length || !informedGeometryCount
    ? 'UNAVAILABLE'
    : ambiguousGroupTraversalCount > 0 || unavailableTraversalCount > 0 || missingBorePairOpportunityCount > 0
      ? 'PARTIAL'
      : 'COMPLETE';

  return Object.freeze({
    familyId,
    authorityStatus,
    sourceLocationCount: groups.length,
    sourceTraversalCount: traversals.length,
    trustedTraversalCount: internalAxes.length,
    unavailableTraversalCount,
    ambiguousGroupTraversalCount,
    missingBorePairOpportunityCount,
    locationsPerTraversalSpectrum: Object.freeze(locationsPerTraversalSpectrum),
    returnMultiplicitySpectrum: Object.freeze(returnMultiplicitySpectrum),
    dnNormalizedPairSpectrum: Object.freeze(dnNormalizedPairSpectrum.map((item) => Object.freeze(item))),
    relativeAxisAngleSpectrumDeg: Object.freeze(relativeAxisAngleSpectrumDeg.map(rounded)),
    normalizedPairCount: dnNormalizedPairSpectrum.length,
    relativeAxisAngleCount: relativeAxisAngleSpectrumDeg.length,
    traversalAxisEvidence: Object.freeze(internalAxes.map((item) => Object.freeze({
      axisBasis: item.basis,
      axisConfidenceRatio: item.confidenceRatio,
      axisPointCount: item.pointCount,
    }))),
  });
}

function comparisonAvailability(left, right) {
  if (left?.authorityStatus === 'UNAVAILABLE' || right?.authorityStatus === 'UNAVAILABLE') return Object.freeze({
    result: 'UNAVAILABLE',
    left: left?.authorityStatus || 'UNAVAILABLE',
    right: right?.authorityStatus || 'UNAVAILABLE',
  });
  if (left?.authorityStatus !== 'COMPLETE' || right?.authorityStatus !== 'COMPLETE') return Object.freeze({
    result: 'REVIEW',
    left: left?.authorityStatus || 'UNAVAILABLE',
    right: right?.authorityStatus || 'UNAVAILABLE',
  });
  return Object.freeze({ result: 'AVAILABLE', left: left.authorityStatus, right: right.authorityStatus });
}

function positiveMatchEvidenceSignal(left, right) {
  const leftAxes = left?.traversalAxisEvidence || [];
  const rightAxes = right?.traversalAxisEvidence || [];
  const independentlySupported = (axes) => axes.length > 0 && axes.every((item) =>
    item?.axisBasis === 'PCA_BRANCH_AXIS' && Number(item?.axisPointCount || 0) >= 3);
  const relativeAngleInformed = Number(left?.relativeAxisAngleCount || 0) > 0
    && Number(right?.relativeAxisAngleCount || 0) > 0;
  const independentPcaSupported = independentlySupported(leftAxes) && independentlySupported(rightAxes);
  const pass = relativeAngleInformed || independentPcaSupported;
  return Object.freeze({
    reasonCode: 'AXIS_POSITIVE_EVIDENCE_SUFFICIENT',
    basis: relativeAngleInformed
      ? 'RELATIVE_AXIS_ANGLE_INFORMED'
      : independentPcaSupported
        ? 'INDEPENDENT_PCA_AXES'
        : 'INSUFFICIENT',
    leftRelativeAxisAngleCount: Number(left?.relativeAxisAngleCount || 0),
    rightRelativeAxisAngleCount: Number(right?.relativeAxisAngleCount || 0),
    left: Object.freeze(leftAxes.map((item) => Object.freeze({
      axisBasis: item.axisBasis,
      axisPointCount: item.axisPointCount,
    }))),
    right: Object.freeze(rightAxes.map((item) => Object.freeze({
      axisBasis: item.axisBasis,
      axisPointCount: item.axisPointCount,
    }))),
    comparison: 'AUTHORITY',
    result: pass ? 'PASS' : 'UNAVAILABLE',
  });
}

function normalizedSpacingSignal(left, right, profile) {
  if (!left.length && !right.length) return unavailableSignal('AXIS_DN_NORMALIZED_SPACING_WITHIN_TOLERANCE', left, right, {
    axialRatioTolerance: profile.axialRatioTolerance,
    lateralRatioTolerance: profile.lateralRatioTolerance,
  });
  if (left.length !== right.length) return Object.freeze({
    reasonCode: 'AXIS_DN_NORMALIZED_SPACING_WITHIN_TOLERANCE',
    leftCount: left.length,
    rightCount: right.length,
    residual: null,
    threshold: Object.freeze({
      axialRatioTolerance: profile.axialRatioTolerance,
      lateralRatioTolerance: profile.lateralRatioTolerance,
    }),
    result: 'FAIL',
  });
  const residuals = left.map((item, index) => Object.freeze({
    axialRatio: Math.abs(item.axialRatio - right[index].axialRatio),
    lateralRatio: Math.abs(item.lateralRatio - right[index].lateralRatio),
  }));
  const maxAxial = Math.max(0, ...residuals.map((item) => item.axialRatio));
  const maxLateral = Math.max(0, ...residuals.map((item) => item.lateralRatio));
  const pass = maxAxial <= profile.axialRatioTolerance && maxLateral <= profile.lateralRatioTolerance;
  return Object.freeze({
    reasonCode: 'AXIS_DN_NORMALIZED_SPACING_WITHIN_TOLERANCE',
    leftCount: left.length,
    rightCount: right.length,
    residual: Object.freeze({ maxAxialRatio: rounded(maxAxial), maxLateralRatio: rounded(maxLateral) }),
    threshold: Object.freeze({
      axialRatioTolerance: profile.axialRatioTolerance,
      lateralRatioTolerance: profile.lateralRatioTolerance,
    }),
    result: pass ? 'PASS' : 'FAIL',
  });
}

function angleSpectrumSignal(left, right, profile) {
  if (!left.length && !right.length) return unavailableSignal('AXIS_RELATIVE_ANGLE_WITHIN_TOLERANCE', left, right,
    profile.relativeAxisAngleToleranceDeg);
  if (left.length !== right.length) return Object.freeze({
    reasonCode: 'AXIS_RELATIVE_ANGLE_WITHIN_TOLERANCE',
    leftCount: left.length,
    rightCount: right.length,
    residual: null,
    threshold: profile.relativeAxisAngleToleranceDeg,
    result: 'FAIL',
  });
  const residuals = left.map((value, index) => Math.abs(value - right[index]));
  const maxResidual = Math.max(0, ...residuals);
  return Object.freeze({
    reasonCode: 'AXIS_RELATIVE_ANGLE_WITHIN_TOLERANCE',
    leftCount: left.length,
    rightCount: right.length,
    residual: rounded(maxResidual),
    threshold: profile.relativeAxisAngleToleranceDeg,
    result: maxResidual <= profile.relativeAxisAngleToleranceDeg ? 'PASS' : 'FAIL',
  });
}

function normalizedPairDescriptor(left, right, axis, boreMm) {
  if (!validPoint(left) || !validPoint(right) || !validAxis(axis) || !positive(boreMm)) return null;
  const dx = right.x - left.x;
  const dy = right.y - left.y;
  const dz = right.z - left.z;
  const signedAxial = dx * axis.x + dy * axis.y + dz * axis.z;
  const axialMm = Math.abs(signedAxial);
  const distanceSquared = dx * dx + dy * dy + dz * dz;
  const lateralMm = Math.sqrt(Math.max(0, distanceSquared - signedAxial * signedAxial));
  return {
    axialRatio: rounded(axialMm / boreMm),
    lateralRatio: rounded(lateralMm / boreMm),
  };
}

function unsignedAxisAngleDeg(left, right) {
  if (!validAxis(left) || !validAxis(right)) return null;
  const dot = Math.abs(left.x * right.x + left.y * right.y + left.z * right.z);
  const clamped = Math.max(-1, Math.min(1, dot));
  return rounded(Math.acos(clamped) * 180 / Math.PI);
}

function groupTraversal(group) {
  const fullLineTag = clean(group?.fullLineTag);
  if (!fullLineTag) return null;
  const branches = unique([
    ...(group?.branchNodes || []),
    ...(group?.evidenceRows || []).map((row) => row?.branchNode),
  ]).map(token).filter(Boolean);
  if (branches.length > 1) return null;
  const branchNode = branches[0] || '';
  return Object.freeze({
    fullLineTag,
    branchNode,
    key: traversalKey(fullLineTag, branchNode),
  });
}

function traversalBoreMm(groups, fullLineTag) {
  const direct = unique((groups || []).map((group) => Number(group?.locationNominalBoreMm)).filter(positive));
  if (direct.length === 1) return direct[0];
  const derived = Number(deriveSupportReportLocationNominalBoreMm(fullLineTag));
  return positive(derived) ? derived : null;
}

function freezeComparison(left, right, profile, input) {
  const signals = Object.freeze([...(input.signals || [])]);
  const failedReasonCodes = signals.filter((item) => item.result === 'FAIL').map((item) => item.reasonCode);
  const unavailableReasonCodes = signals.filter((item) => item.result === 'UNAVAILABLE').map((item) => item.reasonCode);
  return Object.freeze({
    auditId: axisAuditId(left?.familyId, right?.familyId),
    leftFamilyId: left?.familyId || '',
    rightFamilyId: right?.familyId || '',
    result: input.result,
    reasonCode: input.reasonCode,
    profileId: profile.profileId,
    availability: input.availability,
    failedReasonCodes: Object.freeze(failedReasonCodes),
    unavailableReasonCodes: Object.freeze(unavailableReasonCodes),
    mismatchCount: failedReasonCodes.length,
    signals,
  });
}

function axisProfile(override = {}) {
  const input = override?.axisTypicality || override || {};
  return Object.freeze({
    profileId: SUPPORT_REPORT_AXIS_TYPICALITY_PROFILE_ID,
    axialRatioTolerance: nonNegative(input.axialRatioTolerance, SUPPORT_REPORT_AXIS_TYPICALITY_PROFILE.axialRatioTolerance),
    lateralRatioTolerance: nonNegative(input.lateralRatioTolerance, SUPPORT_REPORT_AXIS_TYPICALITY_PROFILE.lateralRatioTolerance),
    relativeAxisAngleToleranceDeg: nonNegative(input.relativeAxisAngleToleranceDeg,
      SUPPORT_REPORT_AXIS_TYPICALITY_PROFILE.relativeAxisAngleToleranceDeg),
  });
}

function exactSignal(reasonCode, left, right) {
  return Object.freeze({ reasonCode, left, right, comparison: 'EXACT', result: stable(left) === stable(right) ? 'PASS' : 'FAIL' });
}
function unavailableSignal(reasonCode, left, right, threshold) {
  return Object.freeze({ reasonCode, leftCount: left.length, rightCount: right.length, residual: null, threshold, result: 'UNAVAILABLE' });
}
function comparisonRank(left, right) {
  return left.mismatchCount - right.mismatchCount
    || left.unavailableReasonCodes.length - right.unavailableReasonCodes.length
    || left.rightFamilyId.localeCompare(right.rightFamilyId);
}
function pairDescriptorCompare(left, right) {
  return left.axialRatio - right.axialRatio || left.lateralRatio - right.lateralRatio;
}
function pairCount(value) { return value > 1 ? (value * (value - 1)) / 2 : 0; }
function traversalKey(fullLineTag, branchNode) { return `${token(fullLineTag)}::${token(branchNode) || 'UNRESOLVED_BRANCH'}`; }
function axisAuditId(leftFamilyId, rightFamilyId) { return `AXISTYP-${token(leftFamilyId) || 'UNRESOLVED'}--${token(rightFamilyId) || 'UNRESOLVED'}`; }
function uniqueRows(rows) {
  const output = [];
  const seen = new Set();
  for (const row of rows || []) {
    if (!row || seen.has(row)) continue;
    seen.add(row);
    output.push(row);
  }
  return output;
}
function validPoint(point) { return Boolean(point && [point.x, point.y, point.z].every(Number.isFinite)); }
function validAxis(axis) { return Boolean(axis && [axis.x, axis.y, axis.z].every(Number.isFinite) && Math.hypot(axis.x, axis.y, axis.z) > EPSILON); }
function finiteOrNull(value) { return Number.isFinite(value) ? rounded(value) : value === Number.POSITIVE_INFINITY ? 'INFINITY' : null; }
function nonNegative(value, fallback) { const number = Number(value); return Number.isFinite(number) && number >= 0 ? number : fallback; }
function positive(value) { return Number.isFinite(Number(value)) && Number(value) > 0; }
function rounded(value) { return Math.round(Number(value) * 1000) / 1000; }
function clean(value) { return value == null ? '' : String(value).trim(); }
function token(value) { return clean(value).replace(/^\/+/, '').replace(/\(REF\)$/iu, '').toUpperCase(); }
function unique(values) { return [...new Set((values || []).filter(Boolean))]; }
function stable(value) { return JSON.stringify(value); }

export const _test = Object.freeze({
  angleSpectrumSignal,
  axisFamilyFeatures,
  comparisonAvailability,
  groupTraversal,
  normalizedPairDescriptor,
  normalizedSpacingSignal,
  positiveMatchEvidenceSignal,
  unsignedAxisAngleDeg,
});
