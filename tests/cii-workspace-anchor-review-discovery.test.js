import assert from 'node:assert/strict';
import { _test } from '../tabs/cii-workspace/cii-workspace-anchor-suggestions.js';

function graph(nodeId, name, neighbours = ['1', '2']) {
  const edges = neighbours.map((other, index) => ({
    from: String(nodeId), to: String(other), componentKind: 'PIPE', elementId: `E${index + 1}`,
  }));
  const adjacency = new Map([[String(nodeId), edges], ...neighbours.map((other, index) => [String(other), [edges[index]]])]);
  return {
    nodes: [
      { id: String(nodeId), degree: 2, nodeName: name, neighbourhoodLayers: [['D2->D1|PIPE'], ['D1->D2|PIPE']] },
      ...neighbours.map((other) => ({ id: String(other), degree: 1, nodeName: '', neighbourhoodLayers: [['D1->D2|PIPE']] })),
    ], adjacency,
  };
}

const source = graph('3870', 'SL-097.19', ['3860', '3880']);
const target = graph('870', 'SL-097.19', ['860', '880']);
const rows = _test.exactNameReviewHypotheses(source, target, 65);
assert.equal(rows.length, 1);
assert.equal(rows[0].item.nodeId, '3870');
assert.equal(rows[0].winner.target.nodeId, '870');
assert.equal(rows[0].reviewDiscovery.authority, 'EXACT_EXISTING_NODE_NAME_REVIEW_DISCOVERY_ONLY');
assert.equal(rows[0].mutualBest, false, 'review discovery must never manufacture mutual-best authority');

const oneAxis = _test.reviewDiscoveryEvidence(rows[0], {
  source: { independentAxisRunCount: 1, runs: [{ totalLengthMm: 63564, terminatorClasses: ['COMPONENT_TRANSITION:BEND'] }] },
  target: { independentAxisRunCount: 1, runs: [{ totalLengthMm: 63564, terminatorClasses: ['COMPONENT_TRANSITION:BEND'] }] },
  tolerancePolicy: { toleranceMm: 762 },
});
assert.equal(oneAxis.oneAxisCompatible, true);
assert.equal(oneAxis.lengthDeltaMm, 0);
assert.equal(oneAxis.reviewOnly, true);

const duplicateTarget = graph('870', 'SL-097.19', ['860', '880']);
duplicateTarget.nodes.push({ id: '871', degree: 2, nodeName: 'SL-097.19', neighbourhoodLayers: [['D2->D1|PIPE']] });
duplicateTarget.adjacency.set('871', []);
assert.equal(_test.exactNameReviewHypotheses(source, duplicateTarget, 65).length, 0, 'non-unique target names must not enter review discovery');

console.log('CII anchor exact-name + one-axis review-only discovery: PASS');
