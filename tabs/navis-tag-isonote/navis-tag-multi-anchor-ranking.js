import {
  NAVIS_CANDIDATE_SCORE_MODEL,
  candidateFromTag,
  unresolvedDecision,
} from './navis-tag-candidate-ranking.js';
import { coordinateProfileOptions, parseCoordinate } from './navis-tag-isonote-contracts.js';

export const NAVIS_ANCHOR_LOOP_POLICY = 'INDEPENDENT_ANCHOR_LOOPS_V1';

function text(value) { return String(value ?? '').trim(); }
function number(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function fixed(value, digits = 6) {
  const parsed = number(value);
  return parsed == null ? null : Number(parsed.toFixed(digits));
}
function sameNumber(left, right, tolerance = 1e-9) {
  const a = number(left);
  const b = number(right);
  return a != null && b != null && Math.abs(a - b) <= tolerance;
}
function normalizedComment(value) { return text(value).toUpperCase().replace(/\s+/g, ' '); }
function confidence(score) {
  if (score >= 85) return 'HIGH';
  if (score >= 65) return 'MEDIUM';
  if (score >= 40) return 'LOW';
  return 'UNRESOLVED';
}

export function anchorBasisLabel(anchor = {}) {
  const tagId = text(anchor.resolvedTagId || anchor.tagId);
  const support = text(anchor.resolvedSupportIdentity || anchor.supportIdentity).replace(/^\/+/, '');
  return tagId && support ? `Tag ${tagId} ↔ /${support}` : '';
}

export function positionUnderAnchor(tag, anchor, config = {}) {
  if (!tag?.rawPosition || !anchor?.valid) return null;
  const effective = {
    ...config,
    navisEastingDatumMm: anchor.deltaEMm,
    navisNorthingDatumMm: anchor.deltaNMm,
    navisElevationDatumMm: anchor.deltaElMm,
  };
  return parseCoordinate(tag.rawPosition, tag.units, coordinateProfileOptions(effective, 'navis'));
}

function candidateKey(candidate = {}) {
  return `${text(candidate.anchorBasisId)}|${text(candidate.evidenceId)}`;
}

function compareAccepted(left, right) {
  return (left.normalizedGeometryRms - right.normalizedGeometryRms)
    || (left.spatialDistanceMm - right.spatialDistanceMm)
    || (left.verticalResidualMm - right.verticalResidualMm)
    || (left.horizontalDistanceMm - right.horizontalDistanceMm)
    || left.evidenceId.localeCompare(right.evidenceId);
}

function compareRejected(left, right) {
  return (left.normalizedToleranceDistance - right.normalizedToleranceDistance)
    || (left.spatialDistanceMm - right.spatialDistanceMm)
    || (left.verticalResidualMm - right.verticalResidualMm)
    || left.evidenceId.localeCompare(right.evidenceId);
}

function withAnchorLoop(candidate, anchor, rank, candidateCount, inToleranceCount, kind) {
  const label = anchorBasisLabel(anchor);
  return {
    ...candidate,
    candidateKey: `${anchor.anchorId}|${candidate.evidenceId}`,
    anchorBasisId: anchor.anchorId,
    anchorBasisLabel: label,
    anchorBasisTagId: anchor.resolvedTagId,
    anchorBasisSupportIdentity: anchor.resolvedSupportIdentity,
    anchorTransformDeltaEMm: anchor.deltaEMm,
    anchorTransformDeltaNMm: anchor.deltaNMm,
    anchorTransformDeltaElMm: anchor.deltaElMm,
    anchorLoopPolicy: NAVIS_ANCHOR_LOOP_POLICY,
    anchorLoopId: anchor.anchorId,
    anchorLoopLabel: label,
    anchorLoopRank: rank,
    anchorLoopCandidateCount: candidateCount,
    anchorLoopInToleranceCandidateCount: inToleranceCount,
    anchorLoopWinner: rank === 1,
    anchorLoopCandidateKind: kind,
    anchorSelectionReason: kind === 'IN_TOLERANCE'
      ? (rank === 1 ? 'ANCHOR_LOOP_CLOSEST_IN_TOLERANCE' : 'ANCHOR_LOOP_IN_TOLERANCE_RUNNER_UP')
      : 'ANCHOR_LOOP_NEAREST_REJECTED',
  };
}

function evaluateAnchorLoop(trace, supportPosition, navisTags, anchor, config) {
  const accepted = [];
  const rejected = [];
  for (const tag of navisTags || []) {
    if (!tag.rawPosition || !tag.commentBody) continue;
    const position = positionUnderAnchor(tag, anchor, config);
    if (!position) continue;
    const transformedTag = {
      ...tag,
      position,
      datumOffsetMm: position.datumOffsetMm,
      transformBasis: anchorBasisLabel(anchor),
    };
    const candidate = candidateFromTag(trace, supportPosition, transformedTag, config);
    (candidate.withinTolerance ? accepted : rejected).push(candidate);
  }
  accepted.sort(compareAccepted);
  rejected.sort(compareRejected);
  const acceptedRows = accepted.map((candidate, index) => withAnchorLoop(
    candidate,
    anchor,
    index + 1,
    accepted.length,
    accepted.length,
    'IN_TOLERANCE',
  ));
  const nearestRejected = rejected[0]
    ? withAnchorLoop(rejected[0], anchor, 1, rejected.length, accepted.length, 'NEAREST_REJECTED')
    : null;
  return {
    anchorId: anchor.anchorId,
    anchorBasisLabel: anchorBasisLabel(anchor),
    accepted: acceptedRows,
    winner: acceptedRows[0] || null,
    nearestRejected,
    ledger: acceptedRows.length ? acceptedRows : nearestRejected ? [nearestRejected] : [],
  };
}

function equivalentGeometry(left, right) {
  return sameNumber(left?.horizontalDistanceMm, right?.horizontalDistanceMm)
    && sameNumber(left?.verticalResidualMm, right?.verticalResidualMm)
    && sameNumber(left?.spatialDistanceMm, right?.spatialDistanceMm);
}

function crossLoopSummary(candidates) {
  return candidates.map((candidate) => ({
    candidateKey: candidate.candidateKey,
    anchorBasisId: candidate.anchorBasisId,
    anchorBasisLabel: candidate.anchorBasisLabel,
    tagId: candidate.tagId,
    commentBody: candidate.commentBody,
    normalizedGeometryRms: candidate.normalizedGeometryRms,
    horizontalDistanceMm: candidate.horizontalDistanceMm,
    verticalResidualMm: candidate.verticalResidualMm,
    spatialDistanceMm: candidate.spatialDistanceMm,
    score: candidate.score,
  }));
}

function withCrossLoopRank(candidates) {
  const summary = crossLoopSummary(candidates);
  return candidates.map((candidate, index) => ({
    ...candidate,
    crossLoopRank: index + 1,
    crossLoopWinner: index === 0,
    crossLoopCandidateCount: candidates.length,
    eligibleAnchorCount: candidates.length,
    equivalentAnchorCount: candidates.filter((item) => equivalentGeometry(candidate, item)).length,
    crossLoopEvaluations: summary,
    anchorSelectionReason: index === 0
      ? (candidates.length === 1 ? 'ONLY_ANCHOR_LOOP_WITH_IN_TOLERANCE_WINNER' : 'CLOSEST_ANCHOR_LOOP_WINNER')
      : 'CROSS_LOOP_RUNNER_UP',
  }));
}

function decisionMeta(candidates, config, distinctCommentCount) {
  const top = candidates[0] || null;
  const runnerUp = candidates[1] || null;
  return {
    scoringModel: NAVIS_CANDIDATE_SCORE_MODEL,
    decisionPolicy: NAVIS_ANCHOR_LOOP_POLICY,
    topCandidateTagId: top?.tagId || '',
    topCandidateScore: top?.score ?? null,
    topCandidateAnchorBasis: top?.anchorBasisLabel || '',
    runnerUpTagId: runnerUp?.tagId || '',
    runnerUpScore: runnerUp?.score ?? null,
    runnerUpCandidateAnchorBasis: runnerUp?.anchorBasisLabel || '',
    scoreGap: runnerUp ? fixed(top.score - runnerUp.score) : null,
    requiredScoreGap: config.ambiguityScoreGap,
    distinctCommentCount,
    crossLoopWinnerCount: candidates.length,
    equivalentCrossLoopWinnerCount: top ? candidates.filter((item) => equivalentGeometry(top, item)).length : 0,
    crossLoopGeometryGapMm: runnerUp ? fixed(runnerUp.spatialDistanceMm - top.spatialDistanceMm) : null,
  };
}

export function decisionAcrossAnchorLoops(candidates, config, nearestRejected = null) {
  if (!candidates.length) return {
    ...unresolvedDecision(nearestRejected, config),
    decisionPolicy: NAVIS_ANCHOR_LOOP_POLICY,
    crossLoopWinnerCount: 0,
    equivalentCrossLoopWinnerCount: 0,
    crossLoopGeometryGapMm: null,
  };
  const selected = candidates[0];
  const uniqueText = new Map();
  candidates.forEach((candidate) => {
    const key = normalizedComment(candidate.commentBody);
    if (!uniqueText.has(key)) uniqueText.set(key, candidate);
  });
  const equivalent = candidates.filter((candidate) => equivalentGeometry(selected, candidate));
  const equivalentComments = new Set(equivalent.map((candidate) => normalizedComment(candidate.commentBody)));
  const meta = decisionMeta(candidates, config, uniqueText.size);
  const modelReason = `SCORE_MODEL_${NAVIS_CANDIDATE_SCORE_MODEL}`;
  if (equivalentComments.size > 1) return {
    status: 'AMBIGUOUS',
    selected: null,
    nearestRejected,
    decisionReason: 'EQUIVALENT_CROSS_LOOP_WINNERS_CONFLICT',
    ambiguity: 'EQUIVALENT_CROSS_LOOP_WINNERS_CONFLICT',
    confidence: 'AMBIGUOUS',
    score: selected.score,
    confidenceReasons: [modelReason, NAVIS_ANCHOR_LOOP_POLICY, 'EQUIVALENT_GEOMETRY_DIFFERENT_COMMENTS'],
    ...meta,
  };
  const decisionReason = candidates.length === 1 ? 'SINGLE_ANCHOR_LOOP_WINNER'
    : uniqueText.size === 1 ? 'CROSS_LOOP_CLOSEST_DUPLICATE_TEXT'
      : 'CROSS_LOOP_CLOSEST_CANDIDATE';
  return {
    status: 'RESOLVED',
    selected,
    nearestRejected,
    decisionReason,
    ambiguity: uniqueText.size === 1 && candidates.length > 1 ? 'DUPLICATE_SAME_TEXT' : '',
    confidence: confidence(selected.score),
    score: selected.score,
    confidenceReasons: [...selected.confidenceReasons, modelReason, NAVIS_ANCHOR_LOOP_POLICY, decisionReason],
    ...meta,
  };
}

export function evaluateCandidatesAcrossAnchors(trace, supportPosition, navisTags, anchors, config) {
  const loops = (anchors || []).map((anchor) => evaluateAnchorLoop(
    trace,
    supportPosition,
    navisTags,
    anchor,
    config,
  ));
  const acceptedWinners = loops.map((loop) => loop.winner).filter(Boolean).sort(compareAccepted);
  const candidates = withCrossLoopRank(acceptedWinners);
  const rejectedWinners = loops.map((loop) => loop.nearestRejected).filter(Boolean).sort(compareRejected);
  const nearestRejected = candidates.length ? null : rejectedWinners[0] || null;
  const crossRanks = new Map(candidates.map((candidate) => [candidateKey(candidate), candidate.crossLoopRank]));
  const anchorLoopLedger = loops.flatMap((loop) => loop.ledger.map((candidate) => ({
    ...candidate,
    crossLoopRank: crossRanks.get(candidateKey(candidate)) || '',
    crossLoopWinner: crossRanks.get(candidateKey(candidate)) === 1,
  })));
  return {
    mode: 'ANCHOR_LOOPS',
    policy: NAVIS_ANCHOR_LOOP_POLICY,
    candidates,
    nearestRejected,
    anchorLoopLedger,
    anchorLoops: loops.map((loop) => ({
      anchorId: loop.anchorId,
      anchorBasisLabel: loop.anchorBasisLabel,
      inToleranceCandidateCount: loop.accepted.length,
      winnerCandidateKey: loop.winner?.candidateKey || '',
      winnerTagId: loop.winner?.tagId || '',
      nearestRejectedTagId: loop.nearestRejected?.tagId || '',
    })),
  };
}

export const _test = Object.freeze({
  candidateKey,
  compareAccepted,
  compareRejected,
  decisionAcrossAnchorLoops,
  equivalentGeometry,
  evaluateAnchorLoop,
  sameNumber,
});
