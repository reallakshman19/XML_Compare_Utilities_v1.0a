import { ciiOdConfidenceBand } from './cii-workspace-confidence-bands.js';

function nodeOd(graph, nodeId) {
  const values = [...(graph?.adjacency?.get(String(nodeId)) || [])]
    .map((edge) => Number(edge?.diameter)).filter((value) => Number.isFinite(value) && value > 0);
  return values.length ? Math.min(...values) : null;
}

export function ciiAnchorNodeOdConfidence(sourceGraph, targetGraph, sourceNodeId, targetNodeId) {
  const source = nodeOd(sourceGraph, sourceNodeId); const target = nodeOd(targetGraph, targetNodeId);
  const available = Number.isFinite(source) && source > 0 && Number.isFinite(target) && target > 0;
  const relativeDelta = available ? Math.abs(target - source) / source : null;
  return Object.freeze({ source, target, ...ciiOdConfidenceBand({ available, relativeDelta }) });
}
