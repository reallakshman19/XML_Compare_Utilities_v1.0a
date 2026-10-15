import { compareNodeIds, deepFreeze } from './cii-workspace-contracts.js';
import { qualifyCiiGeometryTransform, registeredCiiPoint } from './cii-workspace-geometry.js';

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}
function nodeMap(graph) { return new Map((graph?.nodes || []).map((node) => [String(node.id), node])); }
function sourceOdAtNode(graph, nodeId) {
  const values = [...(graph?.adjacency?.get(String(nodeId)) || [])]
    .map((edge) => positiveNumber(edge.diameter)).filter((value) => value != null);
  return values.length ? Math.min(...values) : null;
}
function pairKey(pair) { return `${pair.sourceNodeId}=>${pair.targetNodeId}`; }
function rankInputPairs(left, right) {
  return Number(right.score || 0) - Number(left.score || 0)
    || Number(left.sourceRank || 1) - Number(right.sourceRank || 1)
    || Number(left.targetRank || 1) - Number(right.targetRank || 1)
    || Number(right.winnerGap || 0) - Number(left.winnerGap || 0)
    || compareNodeIds(left.sourceNodeId, right.sourceNodeId)
    || compareNodeIds(left.targetNodeId, right.targetNodeId);
}
function resolvedPair(sourceNodes, targetNodes, sourceGraph, pair) {
  const sourceNodeId = String(pair.sourceNodeId); const targetNodeId = String(pair.targetNodeId);
  const source = sourceNodes.get(sourceNodeId)?.position; const target = targetNodes.get(targetNodeId)?.position;
  const sourceOdMm = sourceOdAtNode(sourceGraph, sourceNodeId);
  if (!source || !target || sourceOdMm == null) return null;
  return { ...pair, sourceNodeId, targetNodeId, source, target, sourceOdMm };
}
function diversifiedCandidates(rows, limit) {
  const grouped = new Map();
  for (const row of [...rows].sort(rankInputPairs)) {
    if (!grouped.has(row.sourceNodeId)) grouped.set(row.sourceNodeId, []);
    grouped.get(row.sourceNodeId).push(row);
  }
  const groups = [...grouped.values()].sort((a, b) => rankInputPairs(a[0], b[0])); const result = [];
  for (let depth = 0; result.length < limit; depth += 1) {
    let added = false;
    for (const group of groups) {
      if (result.length >= limit) break;
      if (group[depth]) { result.push(group[depth]); added = true; }
    }
    if (!added) break;
  }
  return result;
}
function geometryPair(pair) {
  return { sourceNodeId: pair.sourceNodeId, targetNodeId: pair.targetNodeId,
    source: pair.source, target: pair.target, sourceOdMm: pair.sourceOdMm };
}
function oneToOne(rows) {
  return new Set(rows.map((row) => row.sourceNodeId)).size === rows.length
    && new Set(rows.map((row) => row.targetNodeId)).size === rows.length;
}
function combinations3(rows) {
  const result = [];
  for (let a = 0; a < rows.length - 2; a += 1) for (let b = a + 1; b < rows.length - 1; b += 1) {
    for (let c = b + 1; c < rows.length; c += 1) {
      const candidate = [rows[a], rows[b], rows[c]]; if (oneToOne(candidate)) result.push(candidate);
    }
  }
  return result;
}
function distance(left, right) {
  return Math.hypot(Number(left.x) - Number(right.x), Number(left.y) - Number(right.y), Number(left.z) - Number(right.z));
}
function residualEvidence(transform, pair, options) {
  if (transform?.status !== 'READY') return null;
  const registered = registeredCiiPoint(transform, pair.source); if (!registered) return null;
  const factor = positiveNumber(options.odToleranceFactor) ?? 2; const toleranceMm = factor * pair.sourceOdMm;
  const residualMm = distance(registered, pair.target);
  return { pair, residualMm, toleranceMm, normalizedResidual: residualMm / toleranceMm };
}
function uniqueSpatialWinners(rows, field, tieTolerance) {
  const grouped = new Map();
  for (const row of rows) {
    const key = row.pair[field]; if (!grouped.has(key)) grouped.set(key, []); grouped.get(key).push(row);
  }
  const winners = new Map(); const ambiguous = [];
  for (const [key, values] of grouped.entries()) {
    values.sort((a, b) => a.normalizedResidual - b.normalizedResidual
      || Number(b.pair.score || 0) - Number(a.pair.score || 0)
      || pairKey(a.pair).localeCompare(pairKey(b.pair), undefined, { numeric: true }));
    if (values.length > 1 && Math.abs(values[1].normalizedResidual - values[0].normalizedResidual) <= tieTolerance) {
      ambiguous.push(String(key)); continue;
    }
    winners.set(String(key), values[0]);
  }
  return { winners, ambiguous };
}
function spatialExpansion(transform, eligible, options) {
  const compatible = eligible.map((pair) => residualEvidence(transform, pair, options)).filter((row) => row && row.normalizedResidual <= 1);
  const tieTolerance = Math.max(0, Number(options.methodASpatialTieNormalizedTolerance ?? 1e-9));
  const bySource = uniqueSpatialWinners(compatible, 'sourceNodeId', tieTolerance);
  const byTarget = uniqueSpatialWinners(compatible, 'targetNodeId', tieTolerance);
  const pairs = compatible.filter((row) => bySource.winners.get(row.pair.sourceNodeId) === row
    && byTarget.winners.get(row.pair.targetNodeId) === row).map((row) => row.pair);
  return { pairs, compatibleCandidateCount: compatible.length,
    ambiguousSourceNodeIds: bySource.ambiguous, ambiguousTargetNodeIds: byTarget.ambiguous };
}
function confidenceRank(value) { return ({ HIGH: 3, MEDIUM: 2, REVIEW: 1 }[value] || 0); }
function automaticConfidence(geometry, anchorCount, options) {
  const minimum = Math.max(3, Number(options.methodAAutoConfidenceMinAnchorCount ?? 4));
  return anchorCount >= minimum ? (geometry.confidence || 'REVIEW') : 'REVIEW';
}
function baseId(pairs) { return `METHOD_A_AUTO_${pairs.map(pairKey).sort().join('__')}`; }
function baseCandidateScore(pairs) {
  return pairs.reduce((sum, pair) => sum + Number(pair.score || 0), 0) / Math.max(pairs.length, 1);
}
function baseCandidateGap(pairs) {
  const values = pairs.map((pair) => Number(pair.winnerGap)).filter(Number.isFinite);
  return values.length ? Math.min(...values) : 0;
}
function seedKey(seed) { return [...seed].map(pairKey).sort(); }
function addSeed(existing, seed) {
  const key = seedKey(seed); const token = key.join('|');
  if (!existing.seedTriplets.some((row) => row.join('|') === token)) existing.seedTriplets.push(key);
  existing.seedTriplets.sort((a, b) => a.join('|').localeCompare(b.join('|'), undefined, { numeric: true }));
}
function makeBase(seed, expansion, geometry, options) {
  const ordered = [...expansion.pairs].sort((a, b) => compareNodeIds(a.sourceNodeId, b.sourceNodeId)
    || compareNodeIds(a.targetNodeId, b.targetNodeId));
  const confidence = automaticConfidence(geometry, ordered.length, options);
  const minimumForAuto = Math.max(3, Number(options.methodAAutoConfidenceMinAnchorCount ?? 4));
  return {
    baseId: baseId(ordered), status: 'READY', method: 'METHOD_A_SPATIAL', confidence,
    anchorCount: ordered.length, establishmentAnchorCount: 3, validationAnchorCount: Math.max(0, ordered.length - 3),
    automaticConfidenceMinimumAnchorCount: minimumForAuto,
    automaticConfidenceCap: ordered.length < minimumForAuto ? 'REVIEW' : null,
    candidateScoreMean: Number(baseCandidateScore(ordered).toFixed(3)),
    candidateWinnerGapMin: Number(baseCandidateGap(ordered).toFixed(3)), seedTriplets: [seedKey(seed)],
    expansionDiagnostics: {
      compatibleCandidateCount: expansion.compatibleCandidateCount,
      ambiguousSourceNodeIds: expansion.ambiguousSourceNodeIds,
      ambiguousTargetNodeIds: expansion.ambiguousTargetNodeIds,
    },
    anchorPairs: ordered.map((pair) => ({ sourceNodeId: pair.sourceNodeId, targetNodeId: pair.targetNodeId,
      sourceOdMm: pair.sourceOdMm, candidateScore: Number(pair.score || 0), winnerGap: Number(pair.winnerGap || 0),
      sourceRank: Number(pair.sourceRank || 1), targetRank: Number(pair.targetRank || 1), mutualBest: Boolean(pair.mutualBest) })),
    geometry,
  };
}
function rankBases(left, right) {
  return confidenceRank(right.confidence) - confidenceRank(left.confidence)
    || right.anchorCount - left.anchorCount
    || Number(right.geometry?.weight?.total || 0) - Number(left.geometry?.weight?.total || 0)
    || Number(left.geometry?.maxNormalizedResidual ?? Infinity) - Number(right.geometry?.maxNormalizedResidual ?? Infinity)
    || left.baseId.localeCompare(right.baseId, undefined, { numeric: true });
}
function baseEvidence(base) {
  return deepFreeze({
    baseId: base.baseId, status: base.status, confidence: base.confidence,
    anchorCount: base.anchorCount, establishmentAnchorCount: base.establishmentAnchorCount,
    validationAnchorCount: base.validationAnchorCount, automaticConfidenceMinimumAnchorCount: base.automaticConfidenceMinimumAnchorCount,
    automaticConfidenceCap: base.automaticConfidenceCap, candidateScoreMean: base.candidateScoreMean,
    candidateWinnerGapMin: base.candidateWinnerGapMin, seedTriplets: deepFreeze(base.seedTriplets),
    expansionDiagnostics: deepFreeze(base.expansionDiagnostics), anchorPairs: deepFreeze(base.anchorPairs),
    selectedBasisId: base.geometry.selectedBasisId, minimumAnchorSinAngle: base.geometry.minimumAnchorSinAngle,
    maxResidualMm: base.geometry.maxResidualMm, rmsResidualMm: base.geometry.rmsResidualMm,
    maxNormalizedResidual: base.geometry.maxNormalizedResidual, rmsNormalizedResidual: base.geometry.rmsNormalizedResidual,
    rotation: base.geometry.rotation, translation: base.geometry.translation,
    tolerancePolicy: base.geometry.tolerancePolicy, weight: base.geometry.weight,
  });
}

export function discoverCiiMethodABases(sourceGraph, targetGraph, pairCandidates = [], options = {}) {
  const sourceNodes = nodeMap(sourceGraph); const targetNodes = nodeMap(targetGraph);
  const seedLimit = Math.max(3, Number(options.methodASeedPairLimit ?? 16));
  const expansionLimit = Math.max(seedLimit, Number(options.methodAExpansionPairLimit ?? 64));
  const baseLimit = Math.max(1, Number(options.methodABaseSuggestionLimit ?? 24));
  const resolved = pairCandidates.map((pair) => resolvedPair(sourceNodes, targetNodes, sourceGraph, pair)).filter(Boolean);
  const seedEligible = diversifiedCandidates(resolved, seedLimit);
  const expansionEligible = diversifiedCandidates(resolved, expansionLimit);
  const seeds = combinations3(seedEligible); const basesById = new Map();
  for (const seed of seeds) {
    const seedGeometry = qualifyCiiGeometryTransform(seed.map(geometryPair), options);
    if (seedGeometry.status !== 'READY') continue;
    const expansion = spatialExpansion(seedGeometry, expansionEligible, options);
    if (expansion.pairs.length < 3) continue;
    const expansionId = baseId(expansion.pairs); const existing = basesById.get(expansionId);
    if (existing) { addSeed(existing, seed); continue; }
    const geometry = qualifyCiiGeometryTransform(expansion.pairs.map(geometryPair), options);
    if (geometry.status !== 'READY') continue;
    basesById.set(expansionId, makeBase(seed, expansion, geometry, options));
  }
  const bases = [...basesById.values()].sort(rankBases).slice(0, baseLimit).map(baseEvidence);
  return deepFreeze({
    status: bases.length ? 'READY' : 'UNAVAILABLE', method: 'METHOD_A_SPATIAL',
    candidatePairCount: pairCandidates.length, eligiblePairCount: seedEligible.length, expansionPairCount: expansionEligible.length,
    seedPairLimit: seedLimit, expansionPairLimit: expansionLimit,
    seedSelectionPolicy: 'ROUND_ROBIN_BY_SOURCE_CANDIDATE_RANK', seedTripletCount: seeds.length,
    qualifiedBaseCount: bases.length, bases,
    reason: bases.length ? 'AT_LEAST_ONE_AUTOMATIC_LOCAL_METHOD_A_BASE_READY' : 'NO_AUTOMATIC_LOCAL_METHOD_A_BASE_READY',
  });
}

export function projectCiiMethodAEvidence(discovery, sourceNodeId, targetNodeId) {
  const source = String(sourceNodeId); const target = String(targetNodeId);
  const bases = (discovery?.bases || []).filter((base) => base.anchorPairs.some((pair) => pair.sourceNodeId === source && pair.targetNodeId === target));
  if (!bases.length) return deepFreeze({ status: 'UNAVAILABLE', confidence: 'REVIEW', baseCount: 0, baseIds: deepFreeze([]), bestBase: null });
  const bestBase = bases[0];
  return deepFreeze({ status: 'READY', confidence: bestBase.confidence, baseCount: bases.length,
    baseIds: deepFreeze(bases.map((base) => base.baseId)), bestBaseId: bestBase.baseId, bestBase, bases: deepFreeze(bases) });
}
