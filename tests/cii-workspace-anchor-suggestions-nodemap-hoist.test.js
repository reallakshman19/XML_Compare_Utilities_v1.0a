import assert from 'node:assert/strict';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { CII_WORKSPACE_SCHEMAS } from '../tabs/cii-workspace/cii-workspace-contracts.js';
import { suggestCiiBaseAnchorPairs, _test } from '../tabs/cii-workspace/cii-workspace-anchor-suggestions-core.js';

// Performance fix under test: structuralCandidates()/uniqueNamedStructuralEvidence()
// used to call structuralEvidence(graph, node), which rebuilt a full node-id map
// from scratch on every call - O(node count) work repeated once per node, i.e.
// O(n^2) overall for a graph with n nodes. The fix hoists that map out to be built
// once per graph and passed through. structuralEvidence() keeps its original
// 2-argument behavior (nodes defaults to nodeMap(graph)) for any standalone caller,
// so this test proves the 2-arg and 3-arg forms are byte-for-byte equivalent, and
// that suggestCiiBaseAnchorPairs() still runs end-to-end without throwing.

function element(index, from, to, od = 100, nodeNames = {}) {
  return {
    index, from, to, od, wall: 4, dx: 100, dy: 0, dz: 0, length: 100,
    fromPos: { x: from * 100, y: 0, z: 0 },
    toPos: { x: to * 100, y: 0, z: 0 },
  };
}

function document(side, elements, nodeNames) {
  const nodes = {};
  for (const el of elements) {
    nodes[el.from] = el.fromPos;
    nodes[el.to] = el.toPos;
  }
  return {
    schema: CII_WORKSPACE_SCHEMAS.document,
    side,
    contentSha256: `${side.toLowerCase()}-sha`.padEnd(64, '0'),
    capabilities: { families: {} },
    auxiliaryEvidence: { elements: {} },
    nodeNames,
    parsed: { nodes, elements },
  };
}

// A small branching graph: 1-2-3-4-5 spine with a branch at 3 (3-6) and named nodes.
const elements = [
  element(1, 1, 2), element(2, 2, 3), element(3, 3, 4), element(4, 4, 5), element(5, 3, 6),
];
const sourceGraph = adaptCiiDocumentToTopologyGraph(document('SOURCE', elements, { 1: 'N1', 3: 'BRANCH', 5: 'END' }));
const targetGraph = adaptCiiDocumentToTopologyGraph(document('TARGET', elements, { 1: 'N1', 3: 'BRANCH', 5: 'END' }));

for (const graph of [sourceGraph, targetGraph]) {
  const nodesOnce = new Map(graph.nodes.map((node) => [String(node.id), node]));
  for (const node of graph.nodes) {
    const legacyTwoArg = _test.structuralEvidence(graph, node);
    const hoistedThreeArg = _test.structuralEvidence(graph, node, nodesOnce);
    assert.deepEqual(hoistedThreeArg, legacyTwoArg,
      `structuralEvidence(graph, node) and structuralEvidence(graph, node, nodes) must be identical for node ${node.id}`);
  }
}

// suggestCiiBaseAnchorPairs() must still run end-to-end without throwing and
// return a well-formed, bounded suggestion list after the hoist.
const suggestions = suggestCiiBaseAnchorPairs(sourceGraph, targetGraph, {});
assert.ok(Array.isArray(suggestions), 'suggestCiiBaseAnchorPairs must return an array');
for (const suggestion of suggestions) {
  assert.equal(suggestion.schema, CII_WORKSPACE_SCHEMAS.baseAnchorSuggestion);
}

console.log('PASS cii-workspace anchor-suggestions nodeMap hoist parity (2-arg vs 3-arg structuralEvidence identical; suggestCiiBaseAnchorPairs unaffected)');
