import {
  compareSupportTypeMultisets,
  normalizePipeClass,
  supportTypeMultiset,
} from './support-report-typicality.js?v=20260911-support-report-typicality-rca-3';
import {
  buildStructuredSequenceContext,
  compareMemberOrdinalPatterns,
  comparePreviousNamePatterns,
  compareStructuredSequenceCandidate,
  orderedLocationIds,
} from './support-report-typicality-sequence.js?v=20260910-structured-sequence-1';

const INELIGIBLE_COST = 1e12;
const UNMATCHED_COST = 1e9;

export function buildTypicalityLocationAssignmentsForMatches(leftEvidence, rightEvidence, matches = [], options = {}) {
  return Object.freeze((matches || []).filter((match) => ['TYPICAL', 'REVIEW'].includes(match?.result) && match.rightFamilyId)
    .map((match) => buildTypicalityLocationAssignment(leftEvidence, rightEvidence, {
      leftFamilyId: match.leftFamilyId,
      rightFamilyId: match.rightFamilyId,
      parentAuditId: match.auditId,
      leftReportBundle: options.leftReportBundle,
      rightReportBundle: options.rightReportBundle,
      profile: options.profile,
    })));
}

export function buildCanonicalTypicalityLocations(evidence = {}, reportBundle = null) {
  const rows = reportBundle?.rows || [];
  const familyGroups = new Map();
  for (const group of evidence.groups || []) {
    const familyId = token(group.secondarySupportFamilyId);
    if (!familyId) continue;
    if (!familyGroups.has(familyId)) familyGroups.set(familyId, []);
    familyGroups.get(familyId).push(group);
  }
  const output = [];
  for (const [familyId, groups] of familyGroups) {
    const canonicalPoints = groups.map(groupPoint).filter(validPoint);
    const familyRawPoints = (evidence.rawClashes || [])
      .filter((clash) => (clash.familyIds || []).map(token).includes(familyId))
      .map((clash) => clash.clashPointGlobalMm).filter(validPoint);
    const anchor = averagePoint(canonicalPoints) || averagePoint(familyRawPoints);
    const ordered = [...groups].sort(groupCompare);
    const bases = ordered.map((group, index) => locationBase(group, familyId, index, anchor, rows));
    for (const location of bases) {
      output.push(Object.freeze({
        ...location,
        distanceFingerprintMm: Object.freeze(bases
          .filter((other) => other.locationId !== location.locationId)
          .map((other) => pointDistance(location.representativePointGlobalMm, other.representativePointGlobalMm))
          .filter(Number.isFinite).sort((a, b) => a - b)),
      }));
    }
  }
  return Object.freeze(output);
}

export function buildTypicalityLocationAssignment(leftEvidence, rightEvidence, options = {}) {
  const profile = options.profile?.pipingLocation || options.profile || {};
  const sequenceProfile = profile.structuredSequence || {};
  const leftFamilyId = token(options.leftFamilyId);
  const rightFamilyId = token(options.rightFamilyId);
  const left = buildCanonicalTypicalityLocations(leftEvidence, options.leftReportBundle)
    .filter((location) => location.familyId === leftFamilyId);
  const right = buildCanonicalTypicalityLocations(rightEvidence, options.rightReportBundle)
    .filter((location) => location.familyId === rightFamilyId);
  const leftSequence = buildStructuredSequenceContext(left, sequenceProfile);
  const rightSequence = buildStructuredSequenceContext(right, sequenceProfile);
  const candidates = left.flatMap((leftLocation) => right.map((rightLocation) =>
    compareLocationCandidate(leftLocation, rightLocation, profile, leftSequence, rightSequence)));
  const solved = solveCandidateAssignment(left, right, candidates, profile, leftSequence, rightSequence);
  const selected = solved.selected.map((item, index) => Object.freeze({
    ...item,
    auditId: `${options.parentAuditId || familyAuditId(leftFamilyId, rightFamilyId)}-L${String(index + 1).padStart(2, '0')}`,
  }));
  const hasSupportTypes = selected.some((item) => item.supportTypeComparison?.result !== 'UNAVAILABLE');
  const materialAmbiguity = solved.ambiguityClass === 'AMBIGUOUS_MATERIAL';
  const result = materialAmbiguity ? 'AMBIGUOUS'
    : solved.unmatchedLeft.length || solved.unmatchedRight.length || selected.some((item) => item.arrangementResult === 'PARTIAL') ? 'PARTIAL'
      : hasSupportTypes ? 'EXACT' : 'TOPOLOGY_ONLY';
  return Object.freeze({
    parentAuditId: options.parentAuditId || familyAuditId(leftFamilyId, rightFamilyId),
    leftFamilyId,
    rightFamilyId,
    result,
    correspondenceStatus: solved.ambiguityClass || 'DETERMINISTIC',
    matchingMode: solved.matchingMode,
    dimensionalEvidence: Object.freeze({
      leftAvailableDimensions: leftSequence.availableDimensions,
      rightAvailableDimensions: rightSequence.availableDimensions,
      leftLineMaxResidualMm: leftSequence.lineMaxResidualMm,
      rightLineMaxResidualMm: rightSequence.lineMaxResidualMm,
      leftPlaneMaxResidualMm: leftSequence.planeMaxResidualMm,
      rightPlaneMaxResidualMm: rightSequence.planeMaxResidualMm,
    }),
    candidatePairs: Object.freeze(candidates),
    selectedAssignments: Object.freeze(selected),
    unmatchedLeftLocationIds: Object.freeze(solved.unmatchedLeft),
    unmatchedRightLocationIds: Object.freeze(solved.unmatchedRight),
    ambiguousLocationIds: Object.freeze(solved.ambiguous),
    totalAssignmentCost: solved.totalCost,
  });
}

function locationBase(group, familyId, index, anchor, reportRows) {
  const representative = groupPoint(group);
  const reportRow = findReportRow(group, reportRows);
  const supportTypesRaw = rawSupportTypes(reportRow?.supportType);
  const memberIds = unique((group.primarySupportMemberIds || []).map(normalizeMemberId).filter((id) => /\.\d+$/.test(id)));
  return Object.freeze({
    locationId: String(group.locationId || group.groupId || `${familyId}::L${index + 1}`),
    sourceGroupId: String(group.groupId || ''),
    familyId,
    fullLineTag: String(group.fullLineTag || ''),
    normalizedPipeClass: normalizePipeClass(group.fullLineTag),
    primarySupportMemberIds: Object.freeze(memberIds.sort()),
    memberMultiplicity: memberIds.length,
    previousNamesRaw: Object.freeze(rawPreviousNames(reportRow?.previousName)),
    supportTypesRaw: Object.freeze(supportTypesRaw),
    supportTypeMultiset: supportTypeMultiset(supportTypesRaw),
    supportTypeSource: supportTypesRaw.length ? 'REPORT_ROW' : 'UNAVAILABLE',
    representativePointGlobalMm: representative,
    localPointMm: subtractPoint(representative, anchor),
    clashEvidenceIds: Object.freeze(unique((group.evidenceRows || []).map((row) => row.guid).filter(Boolean)).sort()),
  });
}

function compareLocationCandidate(left, right, profile, leftSequence, rightSequence) {
  const pipeExact = Boolean(left.normalizedPipeClass) && left.normalizedPipeClass === right.normalizedPipeClass;
  const memberMultiplicityDelta = Math.abs(left.memberMultiplicity - right.memberMultiplicity);
  const supportAvailable = left.supportTypesRaw.length > 0 && right.supportTypesRaw.length > 0;
  const supportTypeComparison = supportAvailable
    ? compareSupportTypeMultisets(left.supportTypesRaw, right.supportTypesRaw)
    : Object.freeze({ result: 'UNAVAILABLE', reasonCodes: Object.freeze(['SUPPORT_TYPE_UNAVAILABLE']) });
  const supportTypeDelta = supportAvailable ? supportTypeDeltaCount(supportTypeComparison) : 0;
  const geometry = geometryFingerprintComparison(left.distanceFingerprintMm, right.distanceFingerprintMm,
    Number(profile.geometryFingerprintToleranceMm ?? 50));
  const sequenceProfile = profile.structuredSequence || {};
  const structuredSequence = compareStructuredSequenceCandidate(left, right, leftSequence, rightSequence, sequenceProfile);
  const memberOrdinalPattern = compareMemberOrdinalPatterns(left.primarySupportMemberIds, right.primarySupportMemberIds, sequenceProfile);
  const previousNamePattern = comparePreviousNamePatterns(left.previousNamesRaw, right.previousNamesRaw, sequenceProfile);
  const eligible = profile.requireCompatiblePipeClass === false || pipeExact;
  const weights = profile.assignmentWeights || {};
  const evidenceWeights = sequenceProfile.evidenceWeights || {};
  const memberPatternPenalty = similarityPenalty(memberOrdinalPattern.similarity, Number(evidenceWeights.memberOrdinalPattern ?? 0));
  const previousNamePenalty = similarityPenalty(previousNamePattern.similarity, Number(evidenceWeights.prevNamePattern ?? 0));
  const assignmentCost = eligible
    ? (supportTypeDelta * Number(weights.supportTypeMember ?? 100000))
      + (memberMultiplicityDelta * Number(weights.memberMultiplicity ?? 10000))
      + ((Number(geometry.residual?.median) || 0) * Number(weights.geometryMedianMm ?? 1))
      + ((Number(geometry.residual?.max) || 0) * Number(weights.geometryMaxMm ?? 1))
      + memberPatternPenalty
      + previousNamePenalty
    : INELIGIBLE_COST;
  const stage2d = structuredSequence.stages.find((stage) => stage.dimension === '2D');
  const stage1d = structuredSequence.stages.find((stage) => stage.dimension === '1D');
  const refinementWeights = sequenceProfile.refinementWeights || {};
  const assignmentCost2d = eligible
    ? assignmentCost + residualPenalty(stage2d, Number(refinementWeights.geometry2dResidual ?? 0))
    : INELIGIBLE_COST;
  const assignmentCost1d = eligible
    ? assignmentCost2d + residualPenalty(stage1d, Number(refinementWeights.station1dResidual ?? 0))
    : INELIGIBLE_COST;
  const arrangementResult = !eligible ? 'NO_MATCH'
    : supportAvailable && supportTypeComparison.result !== 'EXACT' ? 'PARTIAL'
      : memberMultiplicityDelta > 0 || geometry.result === 'FAIL' ? 'PARTIAL'
        : supportAvailable ? 'EXACT' : 'TOPOLOGY_ONLY';
  return Object.freeze({
    candidateId: candidateId(left.locationId, right.locationId),
    leftLocationId: left.locationId,
    rightLocationId: right.locationId,
    eligible,
    arrangementResult,
    assignmentCost,
    assignmentCost2d,
    assignmentCost1d,
    signals: Object.freeze({
      pipeClass: Object.freeze({ left: left.normalizedPipeClass, right: right.normalizedPipeClass, result: pipeExact ? 'PASS' : 'FAIL', reasonCode: pipeExact ? 'PIPE_CLASS_EXACT' : 'PIPE_CLASS_MISMATCH' }),
      memberMultiplicity: Object.freeze({ left: left.memberMultiplicity, right: right.memberMultiplicity, delta: memberMultiplicityDelta, result: memberMultiplicityDelta === 0 ? 'PASS' : 'FAIL', reasonCode: memberMultiplicityDelta === 0 ? 'PRIMARY_MEMBER_MULTIPLICITY_EXACT' : 'PRIMARY_MEMBER_MULTIPLICITY_CHANGED' }),
      geometry,
      structuredSequence,
      memberOrdinalPattern,
      previousNamePattern,
    }),
    supportTypeComparison,
    sourceEvidence: Object.freeze({
      leftClashIds: left.clashEvidenceIds,
      rightClashIds: right.clashEvidenceIds,
      leftSupportTypeSource: left.supportTypeSource,
      rightSupportTypeSource: right.supportTypeSource,
      leftPreviousNames: left.previousNamesRaw,
      rightPreviousNames: right.previousNamesRaw,
    }),
  });
}

function solveCandidateAssignment(left, right, candidates, profile, leftSequence, rightSequence) {
  const tolerance = Number(profile.ambiguityCostTolerance ?? 0.001);
  const base = solveHungarianStage(left, right, candidates, 'assignmentCost', tolerance, '3D_GLOBAL');
  if (!base.ambiguous.length) return withAmbiguityClass(base, candidates);

  let refined = base;
  if (leftSequence?.supports2d && rightSequence?.supports2d) {
    const planar = solveHungarianStage(left, right, candidates, 'assignmentCost2d', tolerance, '2D_REFINEMENT');
    refined = preferRefinement(refined, planar);
    if (!refined.ambiguous.length) return withAmbiguityClass(refined, candidates);
  }

  const sequenceProfile = profile.structuredSequence || {};
  const allLeftSequenced = orderedLocationIds(leftSequence).length === left.length;
  const allRightSequenced = orderedLocationIds(rightSequence).length === right.length;
  if (refined.ambiguous.length && leftSequence?.supports1d && rightSequence?.supports1d
      && allLeftSequenced && allRightSequenced && sequenceProfile.enforceMonotonic1D !== false) {
    const linear = solveMonotonicSequenceStage(left, right, candidates, sequenceProfile, tolerance, leftSequence, rightSequence);
    refined = preferRefinement(refined, linear, true);
  }
  return withAmbiguityClass(refined, candidates);
}

function solveHungarianStage(left, right, candidates, costField, tolerance, matchingMode) {
  const byId = candidateMap(candidates);
  const matrix = assignmentMatrix(left, right, byId, costField);
  if (!matrix.length) return { selected: [], unmatchedLeft: [], unmatchedRight: [], ambiguous: [], totalCost: 0, matchingMode };
  const optimum = hungarian(matrix);
  const result = decodeMatrixAssignment(left, right, byId, matrix, optimum.assignment);
  const ambiguous = result.selected.filter((candidate) => {
    const row = left.findIndex((item) => item.locationId === candidate.leftLocationId);
    const col = right.findIndex((item) => item.locationId === candidate.rightLocationId);
    const alternate = matrix.map((values) => [...values]);
    alternate[row][col] = INELIGIBLE_COST;
    return hungarian(alternate).cost <= optimum.cost + tolerance;
  }).map((candidate) => candidate.leftLocationId);
  return { ...result, ambiguous, totalCost: optimum.cost, matchingMode };
}

function solveMonotonicSequenceStage(left, right, candidates, sequenceProfile, tolerance, leftSequence, rightSequence) {
  const leftOrder = orderedLocationIds(leftSequence, 'FORWARD');
  const forwardRight = orderedLocationIds(rightSequence, 'FORWARD');
  const directions = [{ direction: 'FORWARD', rightOrder: forwardRight }];
  if (sequenceProfile.evaluateReverse1D !== false) {
    directions.push({ direction: 'REVERSE', rightOrder: orderedLocationIds(rightSequence, 'REVERSE') });
  }
  const solutions = directions.map(({ direction, rightOrder }) => ({
    direction,
    ...monotonicAlignment(leftOrder, rightOrder, candidates, 'assignmentCost1d'),
  })).sort((a, b) => a.totalCost - b.totalCost || a.direction.localeCompare(b.direction));
  const optimum = solutions[0] || { selected: [], unmatchedLeft: [...leftOrder], unmatchedRight: [...forwardRight], totalCost: 0, direction: 'FORWARD' };
  const alternateOrientation = solutions.find((solution, index) => index > 0
    && solution.totalCost <= optimum.totalCost + tolerance
    && mappingSignature(solution.selected) !== mappingSignature(optimum.selected));
  const ambiguous = new Set();
  if (alternateOrientation) {
    for (const leftId of changedLeftMappings(optimum.selected, alternateOrientation.selected)) ambiguous.add(leftId);
  }
  for (const candidate of optimum.selected) {
    const forbidden = candidateKey(candidate.leftLocationId, candidate.rightLocationId);
    const sameDirection = monotonicAlignment(leftOrder,
      optimum.direction === 'REVERSE' ? orderedLocationIds(rightSequence, 'REVERSE') : forwardRight,
      candidates, 'assignmentCost1d', forbidden);
    if (sameDirection.totalCost <= optimum.totalCost + tolerance) ambiguous.add(candidate.leftLocationId);
  }
  return {
    selected: optimum.selected,
    unmatchedLeft: optimum.unmatchedLeft,
    unmatchedRight: optimum.unmatchedRight,
    ambiguous: [...ambiguous].sort(),
    totalCost: optimum.totalCost,
    matchingMode: `1D_SEQUENCE_${optimum.direction}`,
    alternateOrientation: alternateOrientation?.direction || null,
  };
}

function monotonicAlignment(leftOrder, rightOrder, candidates, costField, forbiddenPair = '') {
  const byId = candidateMap(candidates);
  const n = leftOrder.length;
  const m = rightOrder.length;
  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(Infinity));
  const move = Array.from({ length: n + 1 }, () => Array(m + 1).fill(null));
  dp[0][0] = 0;
  for (let i = 1; i <= n; i += 1) { dp[i][0] = i * UNMATCHED_COST; move[i][0] = 'SKIP_LEFT'; }
  for (let j = 1; j <= m; j += 1) { dp[0][j] = j * UNMATCHED_COST; move[0][j] = 'SKIP_RIGHT'; }
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const key = candidateKey(leftOrder[i - 1], rightOrder[j - 1]);
      const candidate = byId.get(key);
      const candidateCost = !candidate?.eligible || key === forbiddenPair ? INELIGIBLE_COST : Number(candidate[costField] ?? INELIGIBLE_COST);
      const choices = [
        { cost: dp[i - 1][j - 1] + candidateCost, move: 'MATCH', priority: 0 },
        { cost: dp[i - 1][j] + UNMATCHED_COST, move: 'SKIP_LEFT', priority: 1 },
        { cost: dp[i][j - 1] + UNMATCHED_COST, move: 'SKIP_RIGHT', priority: 2 },
      ].sort((a, b) => a.cost - b.cost || a.priority - b.priority);
      dp[i][j] = choices[0].cost;
      move[i][j] = choices[0].move;
    }
  }
  const selected = [];
  const unmatchedLeft = [];
  const unmatchedRight = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    const action = move[i][j];
    if (action === 'MATCH') {
      const candidate = byId.get(candidateKey(leftOrder[i - 1], rightOrder[j - 1]));
      if (candidate?.eligible && candidateKey(candidate.leftLocationId, candidate.rightLocationId) !== forbiddenPair) selected.push(candidate);
      else { unmatchedLeft.push(leftOrder[i - 1]); unmatchedRight.push(rightOrder[j - 1]); }
      i -= 1; j -= 1;
    } else if (action === 'SKIP_LEFT') {
      unmatchedLeft.push(leftOrder[i - 1]); i -= 1;
    } else {
      unmatchedRight.push(rightOrder[j - 1]); j -= 1;
    }
  }
  return {
    selected: selected.reverse(),
    unmatchedLeft: unmatchedLeft.reverse(),
    unmatchedRight: unmatchedRight.reverse(),
    totalCost: dp[n][m],
  };
}

function preferRefinement(current, candidate, allowHigherAmbiguity = false) {
  if (!candidate) return current;
  if (!candidate.ambiguous.length && current.ambiguous.length) return candidate;
  if (candidate.ambiguous.length < current.ambiguous.length) return candidate;
  if (allowHigherAmbiguity && candidate.ambiguous.length === current.ambiguous.length && candidate.totalCost < current.totalCost) return candidate;
  return current;
}

function withAmbiguityClass(solution, candidates) {
  if (!solution.ambiguous?.length) return { ...solution, ambiguityClass: null };
  return { ...solution, ambiguityClass: ambiguityMateriality(solution.ambiguous, solution.selected, candidates) };
}

function ambiguityMateriality(ambiguousLeftIds, selected, candidates) {
  for (const leftId of ambiguousLeftIds) {
    const chosen = selected.find((candidate) => candidate.leftLocationId === leftId);
    if (!chosen) return 'AMBIGUOUS_MATERIAL';
    const alternatives = candidates.filter((candidate) => candidate.leftLocationId === leftId
      && candidate.rightLocationId !== chosen.rightLocationId && candidate.eligible);
    if (alternatives.some((candidate) => !engineeringEquivalentCandidate(chosen, candidate))) return 'AMBIGUOUS_MATERIAL';
  }
  return 'AMBIGUOUS_EQUIVALENT';
}

function engineeringEquivalentCandidate(left, right) {
  return left.arrangementResult === right.arrangementResult
    && left.supportTypeComparison?.result === right.supportTypeComparison?.result
    && left.signals?.memberMultiplicity?.delta === right.signals?.memberMultiplicity?.delta
    && left.signals?.pipeClass?.result === right.signals?.pipeClass?.result;
}

function assignmentMatrix(left, right, byId, costField) {
  const size = left.length + right.length;
  if (!size) return [];
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => {
    if (row >= left.length && col >= right.length) return 0;
    if (row >= left.length || col >= right.length) return UNMATCHED_COST;
    return Number(byId.get(candidateKey(left[row].locationId, right[col].locationId))?.[costField] ?? INELIGIBLE_COST);
  }));
}

function decodeMatrixAssignment(left, right, byId, matrix, assignment) {
  const selected = [];
  const usedRight = new Set();
  for (let row = 0; row < left.length; row += 1) {
    const col = assignment[row];
    if (col < 0 || col >= right.length || matrix[row][col] >= UNMATCHED_COST) continue;
    const candidate = byId.get(candidateKey(left[row].locationId, right[col].locationId));
    if (candidate?.eligible) { selected.push(candidate); usedRight.add(col); }
  }
  return {
    selected,
    unmatchedLeft: left.filter((item) => !selected.some((candidate) => candidate.leftLocationId === item.locationId)).map((item) => item.locationId),
    unmatchedRight: right.filter((_, index) => !usedRight.has(index)).map((item) => item.locationId),
  };
}

function hungarian(cost) {
  const n = cost.length;
  const m = cost[0]?.length || 0;
  const u = Array(n + 1).fill(0), v = Array(m + 1).fill(0), p = Array(m + 1).fill(0), way = Array(m + 1).fill(0);
  for (let i = 1; i <= n; i += 1) {
    p[0] = i;
    let j0 = 0;
    const minv = Array(m + 1).fill(Infinity), used = Array(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity, j1 = 0;
      for (let j = 1; j <= m; j += 1) if (!used[j]) {
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j += 1) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }
  const assignment = Array(n).fill(-1);
  for (let j = 1; j <= m; j += 1) if (p[j] > 0) assignment[p[j] - 1] = j - 1;
  return { assignment, cost: -v[0] };
}

function geometryFingerprintComparison(left, right, toleranceMm) {
  if (left.length !== right.length) return Object.freeze({ result: 'FAIL', reasonCode: 'LOCATION_GEOMETRY_FINGERPRINT_COUNT_MISMATCH', residual: null, thresholdMm: toleranceMm });
  if (!left.length) return Object.freeze({ result: 'UNAVAILABLE', reasonCode: 'LOCATION_GEOMETRY_FINGERPRINT_UNAVAILABLE', residual: null, thresholdMm: toleranceMm });
  const residuals = left.map((value, index) => Math.abs(value - right[index])).sort((a, b) => a - b);
  const residual = Object.freeze({ median: quantile(residuals, 0.5), max: residuals[residuals.length - 1] });
  return Object.freeze({ result: residual.max <= toleranceMm ? 'PASS' : 'FAIL', reasonCode: residual.max <= toleranceMm ? 'LOCAL_POSITION_WITHIN_TOLERANCE' : 'LOCAL_POSITION_OUTSIDE_TOLERANCE', residual, thresholdMm: toleranceMm });
}

function findReportRow(group, rows) {
  const exact = rows.find((row) => token(row.rowId) === token(group.locationId || group.groupId));
  if (exact) return exact;
  const candidates = rows.filter((row) => token(row.civilSecondarySupport) === token(group.secondarySupportFamilyId)
    && normalizePipeClass(row.pipe) === normalizePipeClass(group.fullLineTag));
  return candidates.length === 1 ? candidates[0] : null;
}
function groupPoint(group) { return validPoint(group?.representativeClashPointGlobalMm) ? group.representativeClashPointGlobalMm : averagePoint(group?.clashPointsGlobalMm || []); }
function groupCompare(a, b) { return normalizePipeClass(a.fullLineTag).localeCompare(normalizePipeClass(b.fullLineTag)) || String(a.fullLineTag || '').localeCompare(String(b.fullLineTag || '')); }
function subtractPoint(point, anchor) { return validPoint(point) && validPoint(anchor) ? Object.freeze({ x: point.x - anchor.x, y: point.y - anchor.y, z: point.z - anchor.z }) : null; }
function averagePoint(points) { const valid = (points || []).filter(validPoint); return valid.length ? Object.freeze({ x: valid.reduce((s, p) => s + p.x, 0) / valid.length, y: valid.reduce((s, p) => s + p.y, 0) / valid.length, z: valid.reduce((s, p) => s + p.z, 0) / valid.length }) : null; }
function pointDistance(a, b) { return validPoint(a) && validPoint(b) ? Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) : null; }
function normalizeMemberId(value) { const text = String(value || '').trim().replace(/^\/+/, '').toUpperCase(); return text ? `/${text}` : ''; }
function supportTypeDeltaCount(comparison) { return [...(comparison?.missingFromRight || []), ...(comparison?.extraInRight || [])].reduce((sum, item) => sum + (Number(item?.count) || 0), 0); }
function rawSupportTypes(value) { return String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean); }
function rawPreviousNames(value) { return String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean); }
function similarityPenalty(similarity, weight) { return Number.isFinite(similarity) ? Math.max(0, 1 - similarity) * Math.max(0, weight) : 0; }
function residualPenalty(stage, weight) { return Number.isFinite(stage?.residual?.max) ? Math.max(0, stage.residual.max) * Math.max(0, weight) : 0; }
function candidateMap(candidates) { return new Map((candidates || []).map((candidate) => [candidateKey(candidate.leftLocationId, candidate.rightLocationId), candidate])); }
function candidateKey(left, right) { return `${left}\u0000${right}`; }
function mappingSignature(selected) { return [...(selected || [])].map((candidate) => `${candidate.leftLocationId}->${candidate.rightLocationId}`).sort().join('|'); }
function changedLeftMappings(left, right) {
  const a = new Map((left || []).map((candidate) => [candidate.leftLocationId, candidate.rightLocationId]));
  const b = new Map((right || []).map((candidate) => [candidate.leftLocationId, candidate.rightLocationId]));
  return [...new Set([...a.keys(), ...b.keys()])].filter((id) => a.get(id) !== b.get(id));
}
function validPoint(point) { return point && [point.x, point.y, point.z].every(Number.isFinite); }
function quantile(sorted, ratio) { if (!sorted.length) return null; return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))]; }
function candidateId(left, right) { return `PAIR-${left}--${right}`.replace(/[^A-Z0-9-]+/gi, '-'); }
function familyAuditId(left, right) { return `TYP-${left}--${right}`.replace(/[^A-Z0-9-]+/gi, '-'); }
function token(value) { return String(value || '').trim().replace(/^\/+/, '').replace(/\(REF\)$/iu, '').toUpperCase(); }
function unique(values) { return [...new Set(values || [])]; }

export const _test = Object.freeze({
  ambiguityMateriality,
  engineeringEquivalentCandidate,
  geometryFingerprintComparison,
  hungarian,
  monotonicAlignment,
  solveCandidateAssignment,
});
