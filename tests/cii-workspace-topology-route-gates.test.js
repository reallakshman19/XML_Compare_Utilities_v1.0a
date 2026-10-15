import assert from 'assert';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { compareLockedCiiAnchorSpan } from '../tabs/cii-workspace/cii-workspace-topology.js';

function edge(index, from, to, length = 100) {
  return { index, from, to, dx: length, dy: 0, dz: 0, length, od: 273, wall: 8, P1: 10, T1: 100, hasBend: false };
}
function document(side, edges) {
  const nodes = {};
  let x = 0;
  for (const item of edges) {
    nodes[item.from] ||= { x, y: 0, z: 0 };
    x += item.length;
    nodes[item.to] ||= { x, y: 0, z: 0 };
    item.fromPos = nodes[item.from]; item.toPos = nodes[item.to];
  }
  return { schema: 'CIIWorkspaceDocument.v1', side, contentSha256: `${side}-sha`, nodeNames: {}, parsed: { elements: edges, nodes, rigids: [] } };
}
function graph(side, edges) { return adaptCiiDocumentToTopologyGraph(document(side, edges)); }

const ambiguousSource = graph('SOURCE', [
  edge(0, 100, 110), edge(1, 110, 200),
  edge(2, 100, 120), edge(3, 120, 130), edge(4, 130, 200),
]);
const simpleTarget = graph('TARGET', [edge(0, 5000, 5010), edge(1, 5010, 5020)]);
const ambiguous = compareLockedCiiAnchorSpan(ambiguousSource, simpleTarget, [
  { sourceNodeId: '100', targetNodeId: '5000' },
  { sourceNodeId: '200', targetNodeId: '5020' },
]);
assert.strictEqual(ambiguous.status, 'BLOCKED');
assert(ambiguous.blockers.includes('AMBIGUOUS_ANCHOR_ROUTE'), 'any alternate physical route between locked anchors must block automatic custody');

const sourceLine = graph('SOURCE', [edge(0, 100, 110), edge(1, 110, 120), edge(2, 120, 130)]);
const targetLine = graph('TARGET', [edge(0, 5000, 5010), edge(1, 5010, 5020), edge(2, 5020, 5030)]);
const wrongOrder = compareLockedCiiAnchorSpan(sourceLine, targetLine, [
  { sourceNodeId: '100', targetNodeId: '5000' },
  { sourceNodeId: '120', targetNodeId: '5020' },
  { sourceNodeId: '110', targetNodeId: '5010' },
  { sourceNodeId: '130', targetNodeId: '5030' },
]);
assert.strictEqual(wrongOrder.status, 'BLOCKED');
assert(wrongOrder.blockers.includes('LOCKED_ANCHOR_ORDER_CONTRADICTION'));

const outsideSpan = compareLockedCiiAnchorSpan(sourceLine, targetLine, [
  { sourceNodeId: '100', targetNodeId: '5000' },
  { sourceNodeId: '999', targetNodeId: '5010' },
  { sourceNodeId: '130', targetNodeId: '5030' },
]);
assert.strictEqual(outsideSpan.status, 'BLOCKED');
assert(outsideSpan.blockers.includes('LOCKED_ANCHOR_OUTSIDE_SPAN'));
console.log('CII Workspace locked-anchor route gates passed.');
