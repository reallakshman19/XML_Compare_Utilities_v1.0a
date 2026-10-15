import assert from 'node:assert/strict';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { CII_WORKSPACE_SCHEMAS } from '../tabs/cii-workspace/cii-workspace-contracts.js';

function element(index, from, to, od = 100) {
  return {
    index, from, to, od, wall: 4, dx: 100, dy: 0, dz: 0, length: 100,
    fromPos: { x: index * 100, y: 0, z: 0 },
    toPos: { x: (index + 1) * 100, y: 0, z: 0 },
  };
}

const document = {
  schema: CII_WORKSPACE_SCHEMAS.document,
  side: 'TARGET',
  contentSha256: 'f'.repeat(64),
  capabilities: { families: {} },
  auxiliaryEvidence: { elements: {} },
  nodeNames: { 1: 'N1', 2: 'N2', 3: 'N3', 4: 'N4' },
  parsed: {
    nodes: {
      1: { x: 0, y: 0, z: 0 },
      2: { x: 100, y: 0, z: 0 },
      3: { x: 200, y: 0, z: 0 },
      4: { x: 100, y: 100, z: 0 },
    },
    elements: [element(1, 1, 2, 100), element(2, 2, 3, 100), element(3, 2, 4, 150)],
  },
};

const graph = adaptCiiDocumentToTopologyGraph(document);
assert.equal(graph.summary.nodeCount, 4);
assert.equal(graph.summary.elementCount, 3);

const node2 = graph.nodes.find((node) => node.id === '2');
assert.equal(node2.degree, 3);
assert.equal(node2.nodeName, 'N2');

const node2Contexts = graph.edges.flatMap((edge) => [
  ...(edge.from === '2' ? [edge.fromContext] : []),
  ...(edge.to === '2' ? [edge.toContext] : []),
]);
assert.equal(node2Contexts.length, 3);
assert.ok(node2Contexts.every((context) => context === node2Contexts[0]), 'node context should be reused for every incident edge');
assert.equal(node2Contexts[0].degree, 3);
assert.equal(node2Contexts[0].sizeTransition, true);
assert.deepEqual(node2Contexts[0].diameters, [100, 100, 150]);
assert.strictEqual(node2.neighbourhoodLayers, node2Contexts[0].neighbourhoodLayers, 'graph node should reuse cached neighbourhood layers');

for (const edge of graph.edges) {
  if (edge.from === '2') assert.ok(edge.anchorFlags.includes('FROM_BRANCH'));
  if (edge.to === '2') assert.ok(edge.anchorFlags.includes('TO_BRANCH'));
}

console.log('PASS cii-workspace topology context cache');
