import { CII_WORKSPACE_SCHEMAS, compareNodeIds, deepFreeze, uniqueStrings } from './cii-workspace-contracts.js';
import { discoverCiiMethodABases, projectCiiMethodAEvidence } from './cii-workspace-anchor-method-a.js';
import { qualifyCiiMultiBaseAuthority } from './cii-workspace-multi-base-anchor.js';

const REASON_WEIGHT = Object.freeze({ BRANCH: 100, RIGID_ADJACENT: 90, TERMINAL: 80, BEND_ADJACENT: 65, NAMED_NODE: 45 });
const CONFIDENCE_RANK = Object.freeze({ REVIEW: 1, MEDIUM: 2, HIGH: 3 });
function clamp(value, low = 0, high = 1) { return Math.max(low, Math.min(high, value)); }
function nodeMap(graph) { return new Map((graph?.nodes || []).map((node) => [String(node.id), node])); }
function otherNode(edge, nodeId) { return edge.from === nodeId ? edge.to : edge.from; }
function jaccard(left, right) {
  const a = new Set(left || []); const b = new Set(right || []); const union = new Set([...a, ...b]);
  if (!union.size) return 1;
  return [...union].filter((item) => a.has(item) && b.has(item)).length / union.size;
}
function multisetSimilarity(left, right) {
  const a = [...(left || [])]; const b = [...(right || [])];
  if (!a.length && !b.length) return 1;
  const counts = new Map(); for (const item of a) counts.set(item, (counts.get(item) || 0) + 1);
  let common = 0; for (const item of b) { const count = counts.get(item) || 0; if (count) { common += 1; counts.set(item, count - 1); } }
  return common / Math.max(a.length, b.length, 1);
}
function layerSimilarity(left, right) {
  const weights = [0.5, 0.3, 0.2]; let score = 0; let total = 0;
  for (let index = 0; index < weights.length; index += 1) {
    const a = left?.[index] || []; const b = right?.[index] || [];
    if (!a.length && !b.length) continue;
    score += jaccard(a, b) * weights[index]; total += weights[index];
  }
  return total ? score / total : 1;
}
function robustReasons(node, incident) {
  const componentKinds = uniqueStrings(incident.map((edge) => edge.componentKind)); const reasons = [];
  if (Number(node?.degree || 0) >= 3) reasons.push('BRANCH');
  if (componentKinds.includes('RIGID')) reasons.push('RIGID_ADJACENT');
  if (Number(node?.degree || 0) === 1) reasons.push('TERMINAL');
  if (componentKinds.includes('BEND')) reasons.push('BEND_ADJACENT');
  if (node?.nodeName) reasons.push('NAMED_NODE');
  return reasons;
}
function structuralEvidence(graph, node, nodes = nodeMap(graph)) {
  const nodeId = String(node.id); const incident = [...(graph?.adjacency?.get(nodeId) || [])];
  const neighbourDegrees = incident.map((edge) => Number(nodes.get(String(otherNode(edge, nodeId)))?.degree || 0)).sort((a, b) => a - b);
  const reasons = robustReasons(node, incident);
  return { nodeId, nodeName: String(node?.nodeName || '').trim(), degree: Number(node.degree || 0), componentKinds: uniqueStrings(incident.map((edge) => edge.componentKind)),
    neighbourDegrees, layers: node.neighbourhoodLayers || [], robustReasons: reasons,
    salience: reasons.reduce((best, reason) => Math.max(best, REASON_WEIGHT[reason] || 0), 0) };
}
function structuralCandidates(graph, limit) {
  const nodes = nodeMap(graph);
  return (graph?.nodes || []).map((node) => structuralEvidence(graph, node, nodes)).filter((item) => item.robustReasons.length)
    .sort((a, b) => b.salience - a.salience || compareNodeIds(a.nodeId, b.nodeId)).slice(0, limit);
}
function pairEvidence(source, target) {
  if (source.degree !== target.degree) return { score: 0, basis: ['degree mismatch'], blocked: true, metrics: null };
  const kinds = jaccard(source.componentKinds, target.componentKinds); const neighbours = multisetSimilarity(source.neighbourDegrees, target.neighbourDegrees);
  const layers = layerSimilarity(source.layers, target.layers); const reasons = jaccard(source.robustReasons, target.robustReasons);
  const score = 30 + (20 * kinds) + (20 * neighbours) + (25 * layers) + (5 * reasons);
  const basis = [`degree ${source.degree}=${target.degree}`, `incident kinds ${Math.round(kinds * 100)}%`,
    `neighbour degrees ${Math.round(neighbours * 100)}%`, `topology neighbourhood ${Math.round(layers * 100)}%`];
  const sharedReasons = source.robustReasons.filter((reason) => target.robustReasons.includes(reason));
  if (sharedReasons.length) basis.push(`shared ${sharedReasons.join('+')}`);
  return { score, basis, blocked: false, metrics: { kinds, neighbours, layers, reasons } };
}
function rankedForSource(source, targets) {
  return targets.map((target) => ({ target, ...pairEvidence(source, target) })).filter((row) => !row.blocked)
    .sort((a, b) => b.score - a.score || compareNodeIds(a.target.nodeId, b.target.nodeId));
}
function reverseRank(targetRankings, targetNodeId, sourceNodeId) {
  const rows = targetRankings.get(String(targetNodeId)) || [];
  const index = rows.findIndex((row) => row.target.nodeId === String(sourceNodeId));
  return index >= 0 ? index + 1 : Number.POSITIVE_INFINITY;
}
function mutualBestHypotheses(source, sourceRankings, targetRankings, minimumScore) {
  const rows = [];
  for (const item of source) {
    const ranked = sourceRankings.get(item.nodeId) || []; const winner = ranked[0]; if (!winner || winner.score < minimumScore) continue;
    const reverse = targetRankings.get(winner.target.nodeId) || []; if (reverse[0]?.target?.nodeId !== item.nodeId) continue;
    const sourceGap = winner.score - Number(ranked[1]?.score ?? 0); const targetGap = winner.score - Number(reverse[1]?.score ?? 0);
    rows.push({ item, winner, sourceRank: 1, targetRank: 1, mutualBest: true,
      sourceGap, targetGap, winnerGap: Math.min(sourceGap, targetGap) });
  }
  return rows;
}
function methodACandidateHypotheses(source, sourceRankings, targetRankings, minimumScore, options) {
  const perSource = Math.max(1, Number(options.methodACandidatesPerSource ?? 3));
  const reverseLimit = Math.max(1, Number(options.methodAReverseCandidateRankLimit ?? 3)); const rows = [];
  for (const item of source) {
    const ranked = (sourceRankings.get(item.nodeId) || []).slice(0, perSource);
    for (let index = 0; index < ranked.length; index += 1) {
      const candidate = ranked[index]; if (candidate.score < minimumScore) continue;
      const targetRank = reverseRank(targetRankings, candidate.target.nodeId, item.nodeId); if (targetRank > reverseLimit) continue;
      const sourceRank = index + 1; const mutualBest = sourceRank === 1 && targetRank === 1;
      const reverse = targetRankings.get(candidate.target.nodeId) || [];
      const sourceGap = sourceRank === 1 ? candidate.score - Number(ranked[1]?.score ?? 0) : 0;
      const targetGap = targetRank === 1 ? candidate.score - Number(reverse[1]?.score ?? 0) : 0;
      rows.push({ item, winner: candidate, sourceRank, targetRank, mutualBest,
        sourceGap, targetGap, winnerGap: mutualBest ? Math.min(sourceGap, targetGap) : 0 });
    }
  }
  return rows;
}
function pairKey(row) { return `${row.item.nodeId}=>${row.winner.target.nodeId}`; }
function surfacedHypotheses(mutualRows, methodARows, discovery) {
  const byKey = new Map(mutualRows.map((row) => [pairKey(row), row]));
  const aPairs = new Set((discovery?.bases || []).flatMap((base) => base.anchorPairs.map((pair) => `${pair.sourceNodeId}=>${pair.targetNodeId}`)));
  for (const row of methodARows) if (aPairs.has(pairKey(row)) && !byKey.has(pairKey(row))) byKey.set(pairKey(row), row);
  return [...byKey.values()];
}
function uniqueNamedStructuralEvidence(graph) {
  const nodes = nodeMap(graph);
  const byName = new Map();
  for (const node of graph?.nodes || []) {
    const name = String(node?.nodeName || '').trim(); if (!name) continue;
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(structuralEvidence(graph, node, nodes));
  }
  return new Map([...byName.entries()].filter(([, rows]) => rows.length === 1).map(([name, rows]) => [name, rows[0]]));
}
function exactNameReviewHypotheses(sourceGraph, targetGraph, minimumScore) {
  const sourceNames = uniqueNamedStructuralEvidence(sourceGraph); const targetNames = uniqueNamedStructuralEvidence(targetGraph); const rows = [];
  for (const [name, item] of sourceNames) {
    const target = targetNames.get(name); if (!target) continue;
    const evidence = pairEvidence(item, target); if (evidence.blocked || evidence.score < minimumScore) continue;
    rows.push({
      item, winner: { target, ...evidence }, sourceRank: null, targetRank: null, mutualBest: false,
      sourceGap: 0, targetGap: 0, winnerGap: 0,
      reviewDiscovery: Object.freeze({ authority: 'EXACT_EXISTING_NODE_NAME_REVIEW_DISCOVERY_ONLY', nodeName: name }),
    });
  }
  return rows;
}
function mergeReviewHypotheses(primary, reviewRows) {
  const byKey = new Map(primary.map((row) => [pairKey(row), row]));
  for (const row of reviewRows) if (!byKey.has(pairKey(row))) byKey.set(pairKey(row), row);
  return [...byKey.values()];
}
function finalMethodBWeight(methodB, winner, gap, requiredGap) {
  const metrics = winner.metrics || { kinds: 0, neighbours: 0, layers: 0, reasons: 0 };
  const quality = (0.2 * metrics.kinds) + (0.2 * metrics.neighbours) + (0.5 * metrics.layers) + (0.1 * metrics.reasons);
  const neighbourhood = 15 * clamp(quality);
  const gapQuality = requiredGap > 0 ? clamp(gap / (2 * requiredGap)) : 1;
  const mutualBestWinnerGap = 5 + (5 * gapQuality);
  const subtotal = Number(methodB?.weight?.subtotal || 0); const total = subtotal + neighbourhood + mutualBestWinnerGap;
  return Object.freeze({
    geometryComplexity: Number(methodB?.weight?.geometryComplexity || 0), runCompatibility: Number(methodB?.weight?.runCompatibility || 0),
    topologyFingerprint: Number(methodB?.weight?.topologyFingerprint || 0), neighbourhood: Number(neighbourhood.toFixed(3)),
    mutualBestWinnerGap: Number(mutualBestWinnerGap.toFixed(3)), total: Number(total.toFixed(3)),
  });
}
function methodBQualified(methodB, row, requiredGap) {
  return row.mutualBest && methodB?.status === 'READY' && row.winnerGap >= requiredGap;
}
function methodBConfidence(weight, requiredGap, methodB, row) {
  if (!methodBQualified(methodB, row, requiredGap)) return 'REVIEW';
  if (weight.total >= 80 && row.winnerGap >= Math.max(requiredGap, 12)) return 'HIGH';
  if (weight.total >= 65) return 'MEDIUM';
  return 'REVIEW';
}
function methodBBasis(methodB, weight, row, requiredGap) {
  if (!methodB) return ['Method B unavailable'];
  const sourceCount = methodB.source?.independentAxisRunCount || 0; const targetCount = methodB.target?.independentAxisRunCount || 0;
  if (methodB.status !== 'READY') return [`Method B REVIEW: independent runs ${sourceCount}/${targetCount}; ${methodB.reason}`];
  if (!row.mutualBest) return [`Method B REVIEW: local run basis qualifies but structural candidate is rank ${row.sourceRank ?? 'review-only'}/${row.targetRank ?? 'review-only'}, not mutual-best`];
  if (row.winnerGap < requiredGap) return [`Method B REVIEW: winner gap ${row.winnerGap.toFixed(3)} < required ${requiredGap.toFixed(3)}`];
  const basis = methodB.selectedBasis;
  return [`Method B PASS: ${methodB.weight.sourceDimension}/${methodB.weight.targetDimension}; independent runs ${sourceCount}/${targetCount}`,
    `OD-scaled tolerance ${methodB.tolerancePolicy.toleranceMm.toFixed(3)} mm = ${methodB.tolerancePolicy.factor} × SOURCE OD ${methodB.tolerancePolicy.odRefMm.toFixed(3)} mm`,
    `included angle ${basis.sourceIncludedAngleDeg.toFixed(3)}°/${basis.targetIncludedAngleDeg.toFixed(3)}°; weight ${weight.total.toFixed(1)}/100`];
}
function methodABasis(methodA) {
  if (methodA?.status !== 'READY' || !methodA.bestBase) return ['Method A unavailable: no qualified non-collinear local base contains this pair'];
  const base = methodA.bestBase; const factor = base.tolerancePolicy?.factor ?? 2;
  return [`Method A PASS: base ${base.baseId}; ${base.anchorCount} anchors (${base.validationAnchorCount} validation); confidence ${base.confidence}`,
    `registered max residual ${Number(base.maxResidualMm || 0).toFixed(3)} mm; normalized ${Number(base.maxNormalizedResidual || 0).toFixed(3)}; basis ${base.selectedBasisId}`,
    `OD-scaled tolerance factor ${factor} × SOURCE OD; local bases containing pair ${methodA.baseCount}`];
}
function basisMethod(methodA, methodB, row, requiredGap) {
  const a = methodA?.status === 'READY'; const b = methodBQualified(methodB, row, requiredGap);
  if (a && b) return 'METHOD_A_AND_B';
  if (a) return 'METHOD_A_SPATIAL';
  if (b) return 'METHOD_B_NETWORK';
  return 'LANDMARK_ONLY';
}
function strongestConfidence(left, right) {
  return (CONFIDENCE_RANK[left] || 0) >= (CONFIDENCE_RANK[right] || 0) ? left : right;
}
function suggestionConfidence(methodA, methodB, methodBResult, row, requiredGap) {
  const a = methodA?.status === 'READY' ? (methodA.confidence || 'REVIEW') : 'REVIEW';
  const b = methodBQualified(methodB, row, requiredGap) ? methodBResult : 'REVIEW';
  return strongestConfidence(a, b);
}
function methodStrength(suggestion) {
  const a = Number(suggestion.methodA?.bestBase?.weight?.total || 0);
  const b = ['METHOD_B_NETWORK', 'METHOD_A_AND_B'].includes(suggestion.basisMethod) ? Number(suggestion.methodBWeight?.total || 0) : 0;
  return Math.max(a, b);
}
function reviewDiscoveryEvidence(row, methodB) {
  if (!row.reviewDiscovery) return null;
  const sourceRuns = methodB?.source?.runs || []; const targetRuns = methodB?.target?.runs || [];
  const sourceAxisCount = Number(methodB?.source?.independentAxisRunCount || 0); const targetAxisCount = Number(methodB?.target?.independentAxisRunCount || 0);
  const sourceRun = sourceAxisCount === 1 && sourceRuns.length === 1 ? sourceRuns[0] : null;
  const targetRun = targetAxisCount === 1 && targetRuns.length === 1 ? targetRuns[0] : null;
  const sourceLengthMm = Number(sourceRun?.totalLengthMm); const targetLengthMm = Number(targetRun?.totalLengthMm);
  const lengthDeltaMm = Number.isFinite(sourceLengthMm) && Number.isFinite(targetLengthMm) ? Math.abs(sourceLengthMm - targetLengthMm) : null;
  const toleranceMm = Number(methodB?.tolerancePolicy?.toleranceMm);
  const sourceTerminators = [...(sourceRun?.terminatorClasses || [])].map(String).sort(); const targetTerminators = [...(targetRun?.terminatorClasses || [])].map(String).sort();
  const terminatorsCompatible = sourceTerminators.join('|') === targetTerminators.join('|') && sourceTerminators.length > 0;
  const oneAxisCompatible = lengthDeltaMm != null && Number.isFinite(toleranceMm) && lengthDeltaMm <= toleranceMm && terminatorsCompatible;
  return deepFreeze({
    ...row.reviewDiscovery, reviewOnly: true, sourceAxisCount, targetAxisCount, sourceLengthMm, targetLengthMm,
    lengthDeltaMm, toleranceMm: Number.isFinite(toleranceMm) ? toleranceMm : null, terminatorsCompatible, oneAxisCompatible,
  });
}
function reviewDiscoveryStrength(suggestion) {
  const item = suggestion?.candidateGeneration?.reviewDiscovery; if (!item) return 0;
  const normalized = item.oneAxisCompatible && item.toleranceMm > 0 ? clamp(1 - (item.lengthDeltaMm / item.toleranceMm)) : 0;
  const lengthScale = Math.min(99999, Number(item.sourceLengthMm || 0)) / 100000;
  return (item.oneAxisCompatible ? 100 : 1) + normalized + lengthScale;
}

export function suggestCiiBaseAnchorPairs(sourceGraph, targetGraph, options = {}) {
  const instrumentation = options.instrumentation;
  const stageStartedAt = performance.now();
  const limit = Math.max(1, Number(options.baseAnchorSuggestionLimit || 8));
  const poolLimit = Math.max(limit * 2, Number(options.baseAnchorCandidatePool || 16));
  const requiredGap = Math.max(0, Number(options.baseAnchorWinnerGap ?? 8));
  const minimumScore = Math.max(0, Number(options.baseAnchorMinimumScore ?? 65));
  const methodAMinimumScore = Math.max(0, Number(options.methodAMinimumCandidateScore ?? Math.min(minimumScore, 55)));
  const source = structuralCandidates(sourceGraph, poolLimit); const target = structuralCandidates(targetGraph, poolLimit);
  instrumentation?.record?.('ANCHOR_STRUCTURAL_CANDIDATES_MS', performance.now() - stageStartedAt);
  const rankingsStartedAt = performance.now();
  const sourceRankings = new Map(source.map((item) => [item.nodeId, rankedForSource(item, target)]));
  const targetRankings = new Map(target.map((item) => [item.nodeId, rankedForSource(item, source)]));
  const mutualRows = mutualBestHypotheses(source, sourceRankings, targetRankings, minimumScore);
  const methodASourceLimit = Math.max(3, Number(options.methodASourceCandidateLimit ?? limit));
  const methodASources = source.slice(0, Math.min(source.length, methodASourceLimit));
  const methodARows = methodACandidateHypotheses(methodASources, sourceRankings, targetRankings, methodAMinimumScore, options);
  instrumentation?.record?.('ANCHOR_RANKINGS_MS', performance.now() - rankingsStartedAt);
  const methodADiscoveryStartedAt = performance.now();
  const methodADiscovery = discoverCiiMethodABases(sourceGraph, targetGraph, methodARows.map((row) => ({
    sourceNodeId: row.item.nodeId, targetNodeId: row.winner.target.nodeId, score: row.winner.score, winnerGap: row.winnerGap,
    sourceRank: row.sourceRank, targetRank: row.targetRank, mutualBest: row.mutualBest,
  })), options);
  instrumentation?.record?.('ANCHOR_METHOD_A_DISCOVERY_MS', performance.now() - methodADiscoveryStartedAt);
  const structuralHypotheses = surfacedHypotheses(mutualRows, methodARows, methodADiscovery);
  const reviewStartedAt = performance.now();
  const reviewHypotheses = exactNameReviewHypotheses(sourceGraph, targetGraph, minimumScore);
  instrumentation?.record?.('ANCHOR_REVIEW_HYPOTHESES_MS', performance.now() - reviewStartedAt);
  instrumentation?.record?.('ANCHOR_REVIEW_HYPOTHESES_COUNT', reviewHypotheses.length);
  const hypotheses = mergeReviewHypotheses(structuralHypotheses, reviewHypotheses);
  instrumentation?.record?.('ANCHOR_HYPOTHESES_COUNT', hypotheses.length);
  const projectionStartedAt = performance.now();
  const suggestions = hypotheses.map((row) => {
    const sourceNodeId = row.item.nodeId; const targetNodeId = row.winner.target.nodeId;
    const methodA = projectCiiMethodAEvidence(methodADiscovery, sourceNodeId, targetNodeId);
    const multiBase = qualifyCiiMultiBaseAuthority({ sourceGraph, targetGraph,
      methodBAnchors: [{ baseId: `SUGGESTION_B_${sourceNodeId}_${targetNodeId}`, sourceNodeId, targetNodeId }] }, options);
    const methodB = multiBase.loops[0]?.evidence || null; const methodBWeight = finalMethodBWeight(methodB, row.winner, row.winnerGap, requiredGap);
    const bConfidence = methodBConfidence(methodBWeight, requiredGap, methodB, row); const reviewDiscovery = reviewDiscoveryEvidence(row, methodB);
    const discoveryBasis = reviewDiscovery ? [
      `Review-only exact existing Node Name corroboration ${reviewDiscovery.nodeName}; Node Name is not correspondence identity authority`,
      reviewDiscovery.oneAxisCompatible
        ? `Review-only one-axis network corroboration Δ ${Number(reviewDiscovery.lengthDeltaMm || 0).toFixed(3)} mm within ${Number(reviewDiscovery.toleranceMm || 0).toFixed(3)} mm; two-axis Method B gate remains unmet`
        : 'Exact-name review discovery did not independently qualify the Method B two-axis gate',
    ] : [];
    return deepFreeze({
      schema: CII_WORKSPACE_SCHEMAS.baseAnchorSuggestion, sourceNodeId, targetNodeId,
      status: 'SUGGESTED', authority: 'EVIDENCE_ONLY_ENGINEER_ACCEPT_REQUIRED', reviewRequired: true,
      basisMethod: basisMethod(methodA, methodB, row, requiredGap), methodA, methodAWeight: methodA.bestBase?.weight || null,
      methodB, methodBWeight, confidence: suggestionConfidence(methodA, methodB, bConfidence, row, requiredGap),
      score: Number(row.winner.score.toFixed(3)), winnerGap: Number(row.winnerGap.toFixed(3)), requiredWinnerGap: requiredGap,
      candidateGeneration: deepFreeze({
        method: row.reviewDiscovery ? 'EXACT_NODE_NAME_REVIEW_DISCOVERY' : (row.mutualBest ? 'MUTUAL_BEST_STRUCTURAL_LANDMARK' : 'BIDIRECTIONAL_STRUCTURAL_CANDIDATE_FOR_METHOD_A'),
        authorityRole: row.reviewDiscovery ? 'REVIEW_DISCOVERY_ONLY_NOT_IDENTITY_AUTHORITY' : 'CANDIDATE_GENERATION_ONLY',
        score: Number(row.winner.score.toFixed(3)), methodAMinimumCandidateScore: methodAMinimumScore,
        sourceRank: row.sourceRank, targetRank: row.targetRank, mutualBest: row.mutualBest,
        sourceWinnerGap: Number(row.sourceGap.toFixed(3)), targetWinnerGap: Number(row.targetGap.toFixed(3)),
        reviewDiscovery,
      }),
      basis: Object.freeze([...discoveryBasis, ...row.winner.basis, ...methodABasis(methodA), ...methodBBasis(methodB, methodBWeight, row, requiredGap)]),
      identityExclusions: Object.freeze(['NODE_NUMBER_OFFSET_NOT_USED', 'OD_NOT_IDENTITY_USED_AS_TOLERANCE_SCALE', 'WALL_NOT_USED',
        ...(row.reviewDiscovery ? ['EXACT_NODE_NAME_USED_FOR_REVIEW_DISCOVERY_NOT_IDENTITY_AUTHORITY'] : [])]),
    });
  });
  instrumentation?.record?.('ANCHOR_PROJECTION_MS', performance.now() - projectionStartedAt);
  const order = { HIGH: 0, MEDIUM: 1, REVIEW: 2 };
  suggestions.sort((a, b) => (order[a.confidence] - order[b.confidence])
    || Number(b.basisMethod === 'METHOD_A_AND_B') - Number(a.basisMethod === 'METHOD_A_AND_B')
    || reviewDiscoveryStrength(b) - reviewDiscoveryStrength(a)
    || methodStrength(b) - methodStrength(a)
    || b.winnerGap - a.winnerGap || compareNodeIds(a.sourceNodeId, b.sourceNodeId));
  return deepFreeze(suggestions.slice(0, limit));
}

export const _test = Object.freeze({
  structuralEvidence, structuralCandidates, pairEvidence, uniqueNamedStructuralEvidence,
  exactNameReviewHypotheses, mergeReviewHypotheses, reviewDiscoveryEvidence, reviewDiscoveryStrength,
});
