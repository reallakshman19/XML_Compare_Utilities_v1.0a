import { CII_WORKSPACE_SCHEMAS, compareNodeIds, deepFreeze } from './cii-workspace-contracts.js';
import { discoverCiiMethodABases, projectCiiMethodAEvidence } from './cii-workspace-anchor-method-a.js';

function componentLengthToken(edge) {
  const length = Number(edge?.lengthMm);
  if (!Number.isFinite(length)) return null;
  return `${String(edge?.componentKind || 'UNKNOWN')}@${length.toFixed(3)}`;
}
function incidentFingerprint(graph, nodeId) {
  const tokens = [...(graph?.adjacency?.get(String(nodeId)) || [])].map(componentLengthToken).filter(Boolean).sort();
  return tokens.length ? tokens.join('|') : null;
}
function uniqueByFingerprint(graph) {
  const groups = new Map();
  for (const node of graph?.nodes || []) {
    const fingerprint = incidentFingerprint(graph, node?.id); if (!fingerprint) continue;
    if (!groups.has(fingerprint)) groups.set(fingerprint, []);
    groups.get(fingerprint).push(String(node.id));
  }
  return new Map([...groups].filter(([, ids]) => ids.length === 1).map(([fingerprint, ids]) => [fingerprint, ids[0]]));
}
export function uniqueIncidentComponentLengthPairs(sourceGraph, targetGraph) {
  const source = uniqueByFingerprint(sourceGraph); const target = uniqueByFingerprint(targetGraph); const rows = [];
  for (const [fingerprint, sourceNodeId] of source) {
    const targetNodeId = target.get(fingerprint); if (!targetNodeId) continue;
    rows.push(deepFreeze({ sourceNodeId, targetNodeId, score: 100, winnerGap: 0, sourceRank: 1, targetRank: 1, mutualBest: true,
      physicalFingerprint: deepFreeze({ authority: 'CANDIDATE_GENERATION_ONLY', fingerprint, uniqueInSource: true, uniqueInTarget: true }) }));
  }
  return deepFreeze(rows.sort((a, b) => compareNodeIds(a.sourceNodeId, b.sourceNodeId) || compareNodeIds(a.targetNodeId, b.targetNodeId)));
}
function methodABasis(methodA) {
  const base = methodA?.bestBase;
  if (!base) return ['Method A unavailable'];
  return [`Method A PASS: base ${base.baseId}; ${base.anchorCount} anchors (${base.validationAnchorCount} validation); confidence ${base.confidence}`,
    `registered max residual ${Number(base.maxResidualMm || 0).toFixed(3)} mm; normalized ${Number(base.maxNormalizedResidual || 0).toFixed(3)}`];
}
export function suggestCiiPhysicalMethodAAnchors(sourceGraph, targetGraph, options = {}) {
  const pairs = uniqueIncidentComponentLengthPairs(sourceGraph, targetGraph);
  if (pairs.length < 3) return deepFreeze([]);
  const discovery = discoverCiiMethodABases(sourceGraph, targetGraph, pairs, options);
  const rows = pairs.flatMap((pair) => {
    const methodA = projectCiiMethodAEvidence(discovery, pair.sourceNodeId, pair.targetNodeId);
    if (methodA.status !== 'READY') return [];
    return [deepFreeze({
      schema: CII_WORKSPACE_SCHEMAS.baseAnchorSuggestion,
      sourceNodeId: pair.sourceNodeId, targetNodeId: pair.targetNodeId,
      status: 'SUGGESTED', authority: 'EVIDENCE_ONLY_ENGINEER_ACCEPT_REQUIRED', reviewRequired: true,
      basisMethod: 'METHOD_A_SPATIAL', methodA, methodAWeight: methodA.bestBase?.weight || null,
      methodB: null, methodBWeight: null, confidence: methodA.bestBase?.confidence || 'REVIEW',
      score: pair.score, winnerGap: 0, requiredWinnerGap: Math.max(0, Number(options.baseAnchorWinnerGap ?? 8)),
      candidateGeneration: deepFreeze({
        method: 'UNIQUE_INCIDENT_COMPONENT_LENGTH_FOR_METHOD_A', authorityRole: 'CANDIDATE_GENERATION_ONLY',
        score: pair.score, sourceRank: 1, targetRank: 1, mutualBest: true,
        sourceWinnerGap: 0, targetWinnerGap: 0, physicalFingerprint: pair.physicalFingerprint,
      }),
      basis: deepFreeze([`Candidate-generation-only unique incident component/length fingerprint ${pair.physicalFingerprint.fingerprint}`, ...methodABasis(methodA)]),
      identityExclusions: deepFreeze(['NODE_NUMBER_OFFSET_NOT_USED', 'NODE_NAME_NOT_USED_FOR_PHYSICAL_FINGERPRINT', 'OD_NOT_IDENTITY_USED_AS_METHOD_A_TOLERANCE_SCALE', 'WALL_NOT_USED']),
    })];
  });
  return deepFreeze(rows);
}

export const _test = Object.freeze({ componentLengthToken, incidentFingerprint, uniqueByFingerprint });
