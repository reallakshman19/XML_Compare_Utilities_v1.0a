import assert from 'assert';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { compareLockedCiiAnchorSpan } from '../tabs/cii-workspace/cii-workspace-topology.js';

function document(side, elements) {
  const nodes = {};
  for (const element of elements) {
    nodes[element.from] ||= { x: 0, y: 0, z: 0 };
    nodes[element.to] ||= { x: 0, y: 0, z: 0 };
  }
  return { schema: 'CIIWorkspaceDocument.v1', side, contentSha256: `${side}-sha`, nodeNames: {}, parsed: { elements, nodes, rigids: [] } };
}
function edge(index, from, to, length, od = 273) {
  return { index, from, to, dx: length, dy: 0, dz: 0, length, od, wall: 8, P1: 10, T1: 100, fromPos: { x: 0, y: 0, z: 0 }, toPos: { x: length, y: 0, z: 0 }, hasBend: false };
}
const source = adaptCiiDocumentToTopologyGraph(document('SOURCE', [edge(0, 100, 200, 1000)]));
const target = adaptCiiDocumentToTopologyGraph(document('TARGET', [edge(0, 5000, 5010, 400), edge(1, 5010, 5020, 600)]));
const result = compareLockedCiiAnchorSpan(source, target, [
  { sourceNodeId: '100', targetNodeId: '5000' },
  { sourceNodeId: '200', targetNodeId: '5020' },
]);
assert.strictEqual(result.status, 'READY');
assert.strictEqual(result.elementRows[0].kind, 'ELEMENT_PATH');
assert.strictEqual(result.elementRows[0].targetElementIds.length, 2);
assert(result.nodeRows.some((row) => row.targetNodeId === '5010' && row.status === 'INSERTED'));
console.log('CII Workspace anchored subdivision checks passed.');
