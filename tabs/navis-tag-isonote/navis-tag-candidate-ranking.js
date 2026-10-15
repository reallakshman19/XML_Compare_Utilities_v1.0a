import { text } from './navis-tag-isonote-contracts.js';

export const NAVIS_CANDIDATE_SCORE_MODEL = 'TOLERANCE_NORMALIZED_V2';

export function verticalResidual(deltaEl, odMm, useOdHalf) {
  const hypotheses = [{ basis: 'CENTERLINE', residual: Math.abs(deltaEl) }];
  if (useOdHalf && Number.isFinite(Number(odMm))) {
    const half = Number(odMm) / 2;
    hypotheses.push({ basis: 'OD_HALF_ABOVE', residual: Math.abs(deltaEl - half) });
    hypotheses.push({ basis: 'OD_HALF_BELOW', residual: Math.abs(deltaEl + half) });
  }
  return hypotheses.sort((a, b) => a.residual - b.residual)[0];
}

function toleranceRatio(value, tolerance) {
  const denominator = Math.max(Number(tolerance) || 0, 0.000001);
  return Math.abs(Number(value) || 0) / denominator;
}
function clamp01(value) { return Math.max(0, Math.min(1, Number(value) || 0)); }
function fixed(value) { return Number(Number(value).toFixed(6)); }

export function candidateScore(candidate, config) {
  const ratios = {
    e: toleranceRatio(candidate.deltaEMm, config.eastingToleranceMm),
    n: toleranceRatio(candidate.deltaNMm, config.northingToleranceMm),
    el: toleranceRatio(candidate.verticalResidualMm, config.elevationToleranceMm),
  };
  const rms = Math.sqrt(([ratios.e, ratios.n, ratios.el].reduce((sum, value) => sum + (clamp01(value) ** 2), 0)) / 3);
  let score = 20 + (60 * (1 - clamp01(rms)));
  const reasons = ['ALL_AXES_WITHIN_TOLERANCE', `NORMALIZED_GEOMETRY_RMS_${rms.toFixed(6)}`];
  if (candidate.commentBody) { score += 10; reasons.push('COMMENT_BODY_PRESENT'); }
  if (candidate.positionSource === 'RLTAG_POS3D') { score += 5; reasons.push('DIRECT_RLTAG_POS3D'); }
  if (candidate.diagnostics.length) { score -= 10; reasons.push('TAG_DIAGNOSTIC_PENALTY'); }
  else { score += 5; reasons.push('NO_TAG_DIAGNOSTICS'); }
  if (candidate.verticalBasis !== 'CENTERLINE') reasons.push(candidate.verticalBasis);
  if (!Number.isFinite(candidate.odMm)) reasons.push('OD_UNAVAILABLE');
  return { score: fixed(Math.max(0, Math.min(100, score))), reasons, ratios, rms: fixed(rms) };
}

export function axisFailures(deltaE, deltaN, vertical, config) {
  const failedAxes = [];
  if (Math.abs(deltaE) > config.eastingToleranceMm) failedAxes.push('E');
  if (Math.abs(deltaN) > config.northingToleranceMm) failedAxes.push('N');
  if (vertical.residual > config.elevationToleranceMm) failedAxes.push('EL');
  return failedAxes;
}

export function candidateFromTag(trace, supportPosition, tag, config) {
  const deltaE = tag.position.x - supportPosition.x;
  const deltaN = tag.position.y - supportPosition.y;
  const deltaEl = tag.position.z - supportPosition.z;
  const vertical = verticalResidual(deltaEl, trace.odMm, config.useOdHalfAlternatives);
  const failedAxes = axisFailures(deltaE, deltaN, vertical, config);
  const ratios = {
    e: toleranceRatio(deltaE, config.eastingToleranceMm),
    n: toleranceRatio(deltaN, config.northingToleranceMm),
    el: toleranceRatio(vertical.residual, config.elevationToleranceMm),
  };
  const candidate = {
    evidenceId: tag.evidenceId, viewName: tag.viewName, viewGuid: tag.viewGuid, tagId: tag.tagId,
    commentId: tag.commentId, commentBody: tag.commentBody, commentUser: tag.commentUser,
    commentStatus: tag.commentStatus, commentDate: tag.commentDate, tagPosition: tag.position,
    positionSource: tag.positionSource, deltaEMm: deltaE, deltaNMm: deltaN, deltaElMm: deltaEl,
    horizontalDistanceMm: Math.hypot(deltaE, deltaN), spatialDistanceMm: Math.hypot(deltaE, deltaN, vertical.residual),
    verticalBasis: vertical.basis, verticalResidualMm: vertical.residual, odMm: trace.odMm,
    odSource: trace.odSource || 'NONE', boreNominalMm: trace.boreNominalMm,
    diagnostics: [...(tag.diagnostics || [])], failedAxes, withinTolerance: failedAxes.length === 0,
    rejectionReasons: failedAxes.map((axis) => `${axis}_OUTSIDE_TOLERANCE`),
    normalizedResidualE: fixed(ratios.e), normalizedResidualN: fixed(ratios.n), normalizedResidualEL: fixed(ratios.el),
    normalizedToleranceDistance: Math.max(ratios.e, ratios.n, ratios.el),
    scoringModel: NAVIS_CANDIDATE_SCORE_MODEL, score: 0, confidenceReasons: [], normalizedGeometryRms: null,
  };
  if (candidate.withinTolerance) {
    const scoring = candidateScore(candidate, config);
    candidate.score = scoring.score;
    candidate.confidenceReasons = scoring.reasons;
    candidate.normalizedGeometryRms = scoring.rms;
  } else candidate.confidenceReasons = [...candidate.rejectionReasons];
  return candidate;
}

export function evaluateCandidates(trace, supportPosition, navisTags, config) {
  const accepted = [];
  const rejected = [];
  for (const tag of navisTags) {
    if (!tag.position || !tag.commentBody) continue;
    const candidate = candidateFromTag(trace, supportPosition, tag, config);
    (candidate.withinTolerance ? accepted : rejected).push(candidate);
  }
  accepted.sort((a, b) => b.score - a.score || a.normalizedGeometryRms - b.normalizedGeometryRms || a.horizontalDistanceMm - b.horizontalDistanceMm || a.verticalResidualMm - b.verticalResidualMm || a.evidenceId.localeCompare(b.evidenceId));
  rejected.sort((a, b) => a.normalizedToleranceDistance - b.normalizedToleranceDistance || a.spatialDistanceMm - b.spatialDistanceMm || a.evidenceId.localeCompare(b.evidenceId));
  return { candidates: accepted, nearestRejected: rejected[0] || null };
}

function confidence(score) { if (score >= 85) return 'HIGH'; if (score >= 65) return 'MEDIUM'; if (score >= 40) return 'LOW'; return 'UNRESOLVED'; }
function decisionMeta(candidates, config, distinctCommentCount = 0) {
  const top = candidates[0] || null;
  const runnerUp = candidates[1] || null;
  return {
    scoringModel: NAVIS_CANDIDATE_SCORE_MODEL,
    topCandidateTagId: top?.tagId || '', topCandidateScore: top?.score ?? null,
    topCandidateAnchorBasis: top?.anchorBasisLabel || '',
    runnerUpTagId: runnerUp?.tagId || '', runnerUpScore: runnerUp?.score ?? null,
    runnerUpCandidateAnchorBasis: runnerUp?.anchorBasisLabel || '',
    scoreGap: runnerUp ? fixed(top.score - runnerUp.score) : null,
    requiredScoreGap: config.ambiguityScoreGap, distinctCommentCount,
  };
}
export function unresolvedDecision(nearestRejected, config) {
  const tagLabel = nearestRejected?.tagId || nearestRejected?.evidenceId || '';
  const failed = nearestRejected?.failedAxes?.join('_') || '';
  return {
    status: 'UNRESOLVED', selected: null, nearestRejected,
    ambiguity: nearestRejected ? `NEAREST_TAG_${tagLabel}_OUTSIDE_${failed}_TOLERANCE` : 'NO_PROXIMITY_CANDIDATE',
    decisionReason: nearestRejected ? 'NO_IN_TOLERANCE_CANDIDATE' : 'NO_PROXIMITY_CANDIDATE',
    confidence: 'UNRESOLVED', score: 0,
    confidenceReasons: nearestRejected ? [`NEAREST_TAG_${tagLabel}`, ...(nearestRejected.rejectionReasons || [])] : [],
    ...decisionMeta([], config),
  };
}
export function decision(candidates, config, nearestRejected = null) {
  if (!candidates.length) return unresolvedDecision(nearestRejected, config);
  const uniqueText = new Map();
  candidates.forEach((candidate) => {
    const key = text(candidate.commentBody).toUpperCase().replace(/\s+/g, ' ');
    if (!uniqueText.has(key)) uniqueText.set(key, candidate);
  });
  const selected = candidates[0];
  const meta = decisionMeta(candidates, config, uniqueText.size);
  const modelReason = `SCORE_MODEL_${NAVIS_CANDIDATE_SCORE_MODEL}`;
  if (uniqueText.size === 1) return {
    status: 'RESOLVED', selected, nearestRejected, decisionReason: candidates.length > 1 ? 'DUPLICATE_SAME_TEXT' : 'UNIQUE_CANDIDATE',
    ambiguity: candidates.length > 1 ? 'DUPLICATE_SAME_TEXT' : '', confidence: confidence(selected.score), score: selected.score,
    confidenceReasons: [...selected.confidenceReasons, modelReason, candidates.length > 1 ? 'DUPLICATE_TEXT_DEDUPLICATED' : 'UNIQUE_CANDIDATE'], ...meta,
  };
  if ((meta.scoreGap ?? 0) >= config.ambiguityScoreGap) return {
    status: 'RESOLVED', selected, nearestRejected, decisionReason: 'RUNNER_UP_REJECTED_BY_SCORE_GAP',
    ambiguity: 'RUNNER_UP_REJECTED_BY_SCORE_GAP', confidence: confidence(selected.score), score: selected.score,
    confidenceReasons: [...selected.confidenceReasons, modelReason, `RUNNER_UP_GAP_${meta.scoreGap}`], ...meta,
  };
  return {
    status: 'AMBIGUOUS', selected: null, nearestRejected, decisionReason: 'CONFLICTING_NEARBY_COMMENTS',
    ambiguity: 'CONFLICTING_NEARBY_COMMENTS', confidence: 'AMBIGUOUS', score: selected.score,
    confidenceReasons: [modelReason, 'MULTIPLE_DIFFERENT_COMMENTS', `TOP_SCORE_GAP_${meta.scoreGap ?? 0}`], ...meta,
  };
}
