import { CII_WORKSPACE_SCHEMAS, compareNodeIds, deepFreeze, uniqueStrings } from './cii-workspace-contracts.js';

const REASON_WEIGHT = Object.freeze({ BRANCH: 100, RIGID_ADJACENT: 90, SIZE_TRANSITION: 85, TERMINAL: 80, BEND_ADJACENT: 65, NAMED_NODE: 45 });
function incidents(graph, nodeId) { return [...(graph?.adjacency?.get(String(nodeId)) || [])]; }
function reasonRows(node, rows) {
  const diameters = uniqueStrings(rows.map((edge) => Number(edge.diameter || 0).toFixed(6)));
  const componentKinds = uniqueStrings(rows.map((edge) => edge.componentKind));
  const reasons = [];
  if (Number(node.degree) >= 3) reasons.push('BRANCH');
  if (componentKinds.includes('RIGID')) reasons.push('RIGID_ADJACENT');
  if (diameters.length > 1) reasons.push('SIZE_TRANSITION');
  if (Number(node.degree) === 1) reasons.push('TERMINAL');
  if (componentKinds.includes('BEND')) reasons.push('BEND_ADJACENT');
  if (node.nodeName) reasons.push('NAMED_NODE');
  return { reasons, diameters, componentKinds };
}
function salience(reasons) { return reasons.reduce((best, reason) => Math.max(best, REASON_WEIGHT[reason] || 0), 0); }

export function suggestCiiLandmarks(graph, options = {}) {
  const limit = Math.max(1, Number(options.limit || 12));
  const suggestions = (graph?.nodes || []).map((node) => {
    const rows = incidents(graph, node.id); const evidence = reasonRows(node, rows);
    if (!evidence.reasons.length) return null;
    return deepFreeze({
      schema: CII_WORKSPACE_SCHEMAS.landmarkSuggestion,
      nodeId: String(node.id), status: 'SUGGESTED', authority: 'EVIDENCE_ONLY_ENGINEER_LOCK_REQUIRED',
      salience: salience(evidence.reasons), reasons: Object.freeze(evidence.reasons),
      evidence: Object.freeze({
        degree: Number(node.degree || 0),
        incidentElementIds: Object.freeze(rows.map((edge) => edge.elementId).sort()),
        diameters: Object.freeze(evidence.diameters), componentKinds: Object.freeze(evidence.componentKinds),
        nodeName: node.nodeName || '',
      }),
    });
  }).filter(Boolean);
  suggestions.sort((a, b) => b.salience - a.salience || compareNodeIds(a.nodeId, b.nodeId));
  return deepFreeze(suggestions.slice(0, limit));
}
