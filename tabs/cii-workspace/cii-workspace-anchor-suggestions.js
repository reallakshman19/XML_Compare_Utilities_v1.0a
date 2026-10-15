import { deepFreeze } from './cii-workspace-contracts.js';
import { suggestCiiBaseAnchorPairs as suggestCore, _test as coreTest } from './cii-workspace-anchor-suggestions-core.js';
import { suggestCiiPhysicalMethodAAnchors, _test as physicalTest } from './cii-workspace-anchor-physical-candidates.js';
import { ciiCorroborationBand } from './cii-workspace-confidence-bands.js';
import { ciiAnchorNodeOdConfidence } from './cii-workspace-anchor-corroboration.js';
import { ciiNodeNameUniqueKey, compareCiiNodeNames } from './cii-workspace-node-name-corroboration.js';

function nodeNames(graph) { return new Map((graph?.nodes || []).map((node) => [String(node.id), String(node.nodeName || '').trim()])); }
function canonicalGraph(graph) { return { ...graph, nodes: (graph?.nodes || []).map((node) => ({ ...node, nodeName: ciiNodeNameUniqueKey(node.nodeName) || node.nodeName || '' })) }; }
function pairKey(row) { return `${row.sourceNodeId}=>${row.targetNodeId}`; }
function hasMethodB(row) { return ['METHOD_B_NETWORK', 'METHOD_A_AND_B'].includes(row?.basisMethod); }
function displayLimit(options) {
  const requested = Number(options.baseAnchorDisplayLimit ?? options.baseAnchorSuggestionLimit ?? 8);
  return Math.max(1, Number.isFinite(requested) ? Math.floor(requested) : 8);
}
function enrich(row, sourceGraph, targetGraph, canonicalOnly, sourceNames, targetNames) {
  const sourceName = sourceNames.get(String(row.sourceNodeId)) || ''; const targetName = targetNames.get(String(row.targetNodeId)) || '';
  const nodeNameEvidence = compareCiiNodeNames(sourceName, targetName);
  const odConfidence = ciiAnchorNodeOdConfidence(sourceGraph, targetGraph, row.sourceNodeId, row.targetNodeId);
  const priorDiscovery = row?.candidateGeneration?.reviewDiscovery || null;
  const corroborationBand = ciiCorroborationBand({
    m1: { available: row?.methodA?.status === 'READY', pass: row?.methodA?.status === 'READY' },
    m2: { pass: hasMethodB(row), partial: Boolean(priorDiscovery?.oneAxisCompatible) }, od: odConfidence, nodeName: nodeNameEvidence,
  });
  const canonicalKey = nodeNameEvidence?.canonicalKey || null;
  const reviewDiscovery = priorDiscovery || canonicalOnly ? Object.freeze({
    ...(priorDiscovery || {}), authority: 'EXISTING_NODE_NAME_REVIEW_DISCOVERY_ONLY', sourceNodeName: sourceName, targetNodeName: targetName,
    canonicalKey, nodeNameEvidence, odConfidence, reviewOnly: true,
  }) : null;
  const candidateGeneration = Object.freeze({ ...row.candidateGeneration,
    ...(canonicalOnly ? { method: 'SMART_NODE_NAME_REVIEW_DISCOVERY', authorityRole: 'REVIEW_DISCOVERY_ONLY_NOT_IDENTITY_AUTHORITY' } : {}),
    ...(reviewDiscovery ? { reviewDiscovery } : {}),
  });
  const smartBasis = canonicalOnly ? [`Review-only canonical Node Name corroboration ${sourceName} ↔ ${targetName}${canonicalKey ? ` (${canonicalKey})` : ''}; Node Name is not correspondence identity authority`] : [];
  return deepFreeze({ ...row, nodeNameEvidence, odConfidence, corroborationBand, candidateGeneration,
    basis: Object.freeze([...smartBasis, ...(row.basis || [])]),
    identityExclusions: Object.freeze([...new Set([...(row.identityExclusions || []), ...(reviewDiscovery ? ['NODE_NAME_USED_FOR_REVIEW_DISCOVERY_NOT_IDENTITY_AUTHORITY'] : [])])]),
  });
}
function addSuggestion(byPair, row, sourceGraph, targetGraph, sourceNames, targetNames) {
  const key = pairKey(row); const existing = byPair.get(key);
  if (existing?.methodA?.status === 'READY' && existing?.confidence !== 'REVIEW') return;
  byPair.set(key, enrich(row, sourceGraph, targetGraph, false, sourceNames, targetNames));
}

export function suggestCiiBaseAnchorPairs(sourceGraph, targetGraph, options = {}) {
  const instrumentation = options.instrumentation;
  const byPair = new Map(); const sourceNames = nodeNames(sourceGraph); const targetNames = nodeNames(targetGraph);
  const rawCoreStartedAt = performance.now();
  for (const row of suggestCore(sourceGraph, targetGraph, options)) byPair.set(pairKey(row), enrich(row, sourceGraph, targetGraph, false, sourceNames, targetNames));
  instrumentation?.record?.('ANCHOR_WRAPPER_RAW_CORE_MS', performance.now() - rawCoreStartedAt);
  const physicalStartedAt = performance.now();
  const physicalRows = suggestCiiPhysicalMethodAAnchors(sourceGraph, targetGraph, options);
  instrumentation?.record?.('ANCHOR_WRAPPER_PHYSICAL_CANDIDATES_MS', performance.now() - physicalStartedAt);
  const physicalEnrichStartedAt = performance.now();
  for (const row of physicalRows) addSuggestion(byPair, row, sourceGraph, targetGraph, sourceNames, targetNames);
  instrumentation?.record?.('ANCHOR_WRAPPER_PHYSICAL_ENRICH_MS', performance.now() - physicalEnrichStartedAt);
  const canonicalGraphStartedAt = performance.now();
  const canonicalSource = canonicalGraph(sourceGraph); const canonicalTarget = canonicalGraph(targetGraph);
  instrumentation?.record?.('ANCHOR_WRAPPER_CANONICAL_GRAPH_MS', performance.now() - canonicalGraphStartedAt);
  const canonicalCoreStartedAt = performance.now();
  for (const row of suggestCore(canonicalSource, canonicalTarget, options)) {
    const key = pairKey(row); if (byPair.has(key)) continue;
    if (!compareCiiNodeNames(sourceNames.get(String(row.sourceNodeId)), targetNames.get(String(row.targetNodeId))).match) continue;
    byPair.set(key, enrich(row, sourceGraph, targetGraph, true, sourceNames, targetNames));
  }
  instrumentation?.record?.('ANCHOR_WRAPPER_CANONICAL_CORE_MS', performance.now() - canonicalCoreStartedAt);
  const order = { HIGH: 0, MEDIUM: 1, REVIEW: 2 };
  const rows = [...byPair.values()].sort((a, b) => (order[a.confidence] - order[b.confidence])
    || Number(b?.methodA?.bestBase?.weight?.total || 0) - Number(a?.methodA?.bestBase?.weight?.total || 0)
    || Number(b.score || 0) - Number(a.score || 0));
  return deepFreeze(rows.slice(0, displayLimit(options)));
}

export const _test = Object.freeze({ ...coreTest, ...physicalTest, displayLimit });
