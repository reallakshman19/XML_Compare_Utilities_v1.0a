import assert from 'assert';
import { stableStringify } from '../tabs/cii-workspace/cii-workspace-contracts.js';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { compareLockedCiiAnchorSpan } from '../tabs/cii-workspace/cii-workspace-topology.js';

function element(from, to, length, P1 = 10, T1 = 100) {
  return { from, to, dx: length, dy: 0, dz: 0, length, od: 273, wall: 8, P1, T1, hasBend: false };
}
function makeDocument(side, offset, order = [0, 1, 2]) {
  const base = [
    element(offset, offset + 10, 400),
    element(offset + 10, offset + 20, 500),
    element(offset + 20, offset + 30, 600),
  ];
  const elements = order.map((position, index) => ({ ...base[position], index }));
  const nodes = Object.fromEntries([offset, offset + 10, offset + 20, offset + 30].map((node, index) => [node, { x: index * 500, y: 0, z: 0 }]));
  for (const item of elements) { item.fromPos = nodes[item.from]; item.toPos = nodes[item.to]; }
  return { schema: 'CIIWorkspaceDocument.v1', side, contentSha256: `${side}-sha`, nodeNames: {}, parsed: { elements, nodes, rigids: [] } };
}
function run(sourceOrder, targetOrder) {
  const source = adaptCiiDocumentToTopologyGraph(makeDocument('SOURCE', 100, sourceOrder));
  const target = adaptCiiDocumentToTopologyGraph(makeDocument('TARGET', 5000, targetOrder));
  const correspondence = compareLockedCiiAnchorSpan(source, target, [
    { sourceNodeId: '100', targetNodeId: '5000' }, { sourceNodeId: '130', targetNodeId: '5030' },
  ]);
  return { sourceEdges: source.edges, targetEdges: target.edges, correspondence };
}

const canonical = stableStringify(run([0, 1, 2], [0, 1, 2]));
for (const [sourceOrder, targetOrder] of [
  [[2, 0, 1], [1, 2, 0]],
  [[1, 2, 0], [2, 0, 1]],
  [[2, 1, 0], [2, 1, 0]],
]) {
  assert.strictEqual(stableStringify(run(sourceOrder, targetOrder)), canonical, 'record-order permutations must produce identical canonical correspondence material');
}

function parallel(order) {
  const base = [element(100, 110, 500, 20, 200), element(100, 110, 500, 10, 100)];
  const elements = order.map((position, index) => ({ ...base[position], index }));
  const nodes = { 100: { x: 0, y: 0, z: 0 }, 110: { x: 500, y: 0, z: 0 } };
  for (const item of elements) { item.fromPos = nodes[item.from]; item.toPos = nodes[item.to]; }
  return adaptCiiDocumentToTopologyGraph({
    schema: 'CIIWorkspaceDocument.v1', side: 'SOURCE', contentSha256: 'parallel-sha', nodeNames: {}, parsed: { elements, nodes, rigids: [] },
  }).edges;
}
assert.strictEqual(stableStringify(parallel([0, 1])), stableStringify(parallel([1, 0])), 'same-geometry rows with different operating data must have canonical order independent of input ordinal');
console.log('CII Workspace permutation-invariant correspondence checks passed.');
