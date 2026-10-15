import assert from 'assert';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { compareLockedCiiAnchorSpan } from '../tabs/cii-workspace/cii-workspace-topology.js';

function edge(index, from, to, length = 500) {
  return { index, from, to, dx: length, dy: 0, dz: 0, length, od: 273, wall: 8, P1: 10, T1: 100, hasBend: false };
}
function graph(side, edges) {
  const nodes = {};
  for (const item of edges) {
    nodes[item.from] ||= { x: Number(item.from), y: 0, z: 0 };
    nodes[item.to] ||= { x: Number(item.to), y: 0, z: 0 };
    item.fromPos = nodes[item.from]; item.toPos = nodes[item.to];
  }
  return adaptCiiDocumentToTopologyGraph({
    schema: 'CIIWorkspaceDocument.v1', side, contentSha256: `${side}-sha`, nodeNames: {}, parsed: { elements: edges, nodes, rigids: [] },
  });
}

const source = graph('SOURCE', [edge(0, 100, 110)]);
const target = graph('TARGET', [edge(0, 5000, 5010)]);
const oneAnchor = compareLockedCiiAnchorSpan(source, target, [{ sourceNodeId: '100', targetNodeId: '5000' }]);
assert.strictEqual(oneAnchor.status, 'READY');
assert.strictEqual(oneAnchor.nodeRows[0].status, 'LOCKED');
assert.strictEqual(oneAnchor.elementRows.length, 1);
assert.strictEqual(oneAnchor.elementRows[0].status, 'REVIEW', 'one anchor may bound a unique candidate but does not by itself create HIGH authority');
assert.strictEqual(oneAnchor.elementRows[0].evidence.candidates.status, 'SUPPORTED');

const sourceBranch = graph('SOURCE', [edge(0, 100, 110), edge(1, 100, 120)]);
const targetSingle = graph('TARGET', [edge(0, 5000, 5010)]);
const custody = compareLockedCiiAnchorSpan(
  sourceBranch,
  targetSingle,
  [{ sourceNodeId: '100', targetNodeId: '5000' }],
  { candidatePassingScore: 40 },
);
assert.strictEqual(custody.status, 'UNRESOLVED');
assert(custody.blockers.includes('TARGET_CUSTODY_AMBIGUOUS'));
assert(custody.targetCustodyConflicts.length > 0);
console.log('CII Workspace single-anchor and target-custody checks passed.');
