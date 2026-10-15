import assert from 'assert';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { suggestCiiLandmarks } from '../tabs/cii-workspace/cii-workspace-landmarks.js';

function edge(index, from, to, od = 273, hasBend = false) {
  return { index, from, to, dx: 100, dy: 0, dz: 0, length: 100, od, wall: 8, P1: 10, T1: 100, hasBend };
}
const elements = [
  edge(0, 10, 20), edge(1, 20, 30), edge(2, 20, 40),
  edge(3, 40, 50, 219), edge(4, 50, 60, 219, true),
];
const nodes = {};
for (const item of elements) {
  nodes[item.from] ||= { x: item.from, y: 0, z: 0 };
  nodes[item.to] ||= { x: item.to, y: 0, z: 0 };
  item.fromPos = nodes[item.from]; item.toPos = nodes[item.to];
}
const graph = adaptCiiDocumentToTopologyGraph({
  schema: 'CIIWorkspaceDocument.v1', side: 'SOURCE', contentSha256: 'sha', nodeNames: { 60: 'END-NAME' },
  parsed: { elements, nodes, rigids: [] },
});
const first = suggestCiiLandmarks(graph);
const second = suggestCiiLandmarks(graph);
assert.deepStrictEqual(first, second, 'suggestion order/evidence must be deterministic');
assert(first.every((row) => row.status === 'SUGGESTED'));
assert(first.every((row) => row.authority === 'EVIDENCE_ONLY_ENGINEER_LOCK_REQUIRED'));
const branch = first.find((row) => row.nodeId === '20');
assert(branch?.reasons.includes('BRANCH'));
const transition = first.find((row) => row.nodeId === '40');
assert(transition?.reasons.includes('SIZE_TRANSITION'));
const terminal = first.find((row) => row.nodeId === '10');
assert(terminal?.reasons.includes('TERMINAL'));
assert(!first.some((row) => row.status === 'LOCKED'), 'computed landmark evidence must never create engineer authority');
console.log('CII Workspace landmark suggestion checks passed.');
