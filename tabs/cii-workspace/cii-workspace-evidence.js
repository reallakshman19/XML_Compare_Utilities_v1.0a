import { deepFreeze } from './cii-workspace-contracts.js';
import { evaluateCiiMatchMethods } from './cii-workspace-match-methods.js';

function compatibilityComponents(evaluation) {
  const network = evaluation.m2Network?.components || {};
  const dimensions = evaluation.dimensions || {};
  return Object.freeze({
    topology: Number(network.topology || 0),
    neighbourhood: Number(network.neighbourhood || 0),
    pathSequence: Number(network.pathSequence || 0),
    // Preserve the historical 14-point public component scale while M2 uses a
    // 10-point local-length contribution internally.
    length: Number((1.4 * Number(network.localLength || 0)).toFixed(1)),
    od: dimensions.diameter?.pass ? 30 : 0,
    wall: dimensions.wall?.pass ? 30 : 0,
    componentKind: Number(network.componentKind || 0),
    rigidLength: 0,
    pathStation: Number(network.pathStation || 0),
    registeredGeometry: evaluation.m1Spatial?.available
      ? Number((0.5 * Number(evaluation.m1Spatial.score || 0)).toFixed(1)) : 0,
  });
}

function rankingScore(evaluation) {
  if (!evaluation.identity?.identitySupported) return 0;
  const m1Pass = Boolean(evaluation.m1Spatial?.pass);
  const m2Pass = Boolean(evaluation.m2Network?.pass);
  let quality = 0;
  if (m1Pass && m2Pass) {
    // Agreement is only as strong as the weaker supporting method.
    quality = Math.min(Number(evaluation.m1Spatial.score || 0), Number(evaluation.m2Network.score || 0));
  } else if (m1Pass) quality = Number(evaluation.m1Spatial.score || 0);
  else if (m2Pass) quality = Number(evaluation.m2Network.score || 0);
  return Number((0.5 * Number(evaluation.identity.score || 0) + 0.5 * quality).toFixed(1));
}

/**
 * Candidate evidence contract.
 *
 * Identity is established only by M1 Spatial and/or M2 Network. OD is a
 * graded corroboration axis (<10 HIGH, 10..50 MEDIUM, >50 REVIEW); wall
 * remains downstream engineering-delta evidence. Node Name corroboration
 * may strengthen an already-supported identity but never establishes it alone.
 */
export function scoreCiiEdgeCandidate(source, target, options = {}) {
  const evaluation = evaluateCiiMatchMethods(source, target, options);
  const blockers = evaluation.m2Network?.blockers || [];
  return deepFreeze({
    score: evaluation.identity.score,
    rankingScore: rankingScore(evaluation),
    weightedScores: evaluation.identity.weightedScores,
    identityConfidence: evaluation.identity.confidence,
    identitySupported: evaluation.identity.identitySupported,
    identityReasons: evaluation.identity.reasons,
    odConfidence: evaluation.identity.odConfidence,
    nodeNameEvidence: evaluation.nodeName,
    corroborationBand: evaluation.identity.corroborationBand,
    methods: Object.freeze({
      m1Spatial: evaluation.m1Spatial,
      m2Network: evaluation.m2Network,
    }),
    dimensions: evaluation.dimensions,
    components: compatibilityComponents(evaluation),
    blockers,
    geometryDistanceMm: evaluation.m1Spatial?.distanceMm ?? null,
    hardFail: !evaluation.identity.identitySupported,
  });
}

export function ciiAlignmentScore(source, target, options = {}) {
  return scoreCiiEdgeCandidate(source, target, options).rankingScore;
}
