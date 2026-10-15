import assert from 'node:assert/strict';
import { suggestCiiBaseAnchorPairs } from '../tabs/cii-workspace/cii-workspace-anchor-suggestions.js';

function graph(nodeId, nodeName, otherId, diameter) {
  const edge = { elementId: `E:${nodeId}->${otherId}`, from: nodeId, to: otherId, componentKind: 'PIPE', diameter };
  const nodes = [
    { id: nodeId, degree: 1, nodeName, neighbourhoodLayers: [['D1->D1|PIPE']] },
    { id: otherId, degree: 1, nodeName: '', neighbourhoodLayers: [['D1->D1|PIPE']] },
  ];
  return { nodes, adjacency: new Map([[nodeId, [edge]], [otherId, [edge]]]) };
}

const source = graph('100', 'SL100.1', '110', 100);
const target = graph('500', 'SL-100/DATUM', '510', 105);
const rows = suggestCiiBaseAnchorPairs(source, target, { baseAnchorSuggestionLimit: 8 });
const smart = rows.find((row) => row.sourceNodeId === '100' && row.targetNodeId === '500');
assert(smart);
assert.equal(smart.nodeNameEvidence.kind, 'CANONICAL');
assert.equal(smart.nodeNameEvidence.canonicalKey, 'SL-100');
assert.equal(smart.odConfidence.confidence, 'HIGH');
assert.equal(smart.odConfidence.percentError, 5);

const ps = graph('100', 'PS100.1', '110', 100);
assert.equal(suggestCiiBaseAnchorPairs(ps, target, { baseAnchorSuggestionLimit: 8 }).some((row) => row.sourceNodeId === '100' && row.targetNodeId === '500' && row.candidateGeneration?.method === 'SMART_NODE_NAME_REVIEW_DISCOVERY'), false);

console.log('CII anchor smart Node Name discovery checks: PASS');
