import assert from 'assert';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { compareLockedCiiAnchorSpan } from '../tabs/cii-workspace/cii-workspace-topology.js';

function edge(index, from, to, length, vector = { x: length, y: 0, z: 0 }) {
  return { index, from, to, dx: vector.x, dy: vector.y, dz: vector.z, length, od: 273, wall: 8, P1: 10, T1: 100, hasBend: false };
}
function graph(side, edges) {
  const nodes = {};
  for (const item of edges) {
    nodes[item.from] ||= { x: 0, y: 0, z: 0 };
    const origin = nodes[item.from];
    nodes[item.to] ||= { x: origin.x + item.dx, y: origin.y + item.dy, z: origin.z + item.dz };
    item.fromPos = nodes[item.from]; item.toPos = nodes[item.to];
  }
  return adaptCiiDocumentToTopologyGraph({
    schema: 'CIIWorkspaceDocument.v1', side, contentSha256: `${side}-sha`, nodeNames: {}, parsed: { elements: edges, nodes, rigids: [] },
  });
}

const source = graph('SOURCE', [edge(0, 100, 110, 1000), edge(1, 110, 120, 1000)]);
const target = graph('TARGET', [edge(0, 5000, 5010, 400), edge(1, 5010, 5020, 400)]);
const rerouted = compareLockedCiiAnchorSpan(source, target, [
  { sourceNodeId: '100', targetNodeId: '5000' },
  { sourceNodeId: '120', targetNodeId: '5020' },
]);
assert.strictEqual(rerouted.status, 'UNRESOLVED');
assert(rerouted.blockers.includes('ANCHOR_PATH_LENGTH_DIVERGENCE'));
assert.strictEqual(rerouted.pathGate.status, 'UNRESOLVED');
assert(rerouted.elementRows.every((row) => row.status !== 'HIGH'), 'material path divergence must not retain automatic HIGH custody');

// Same cumulative length is not sufficient: a 90-degree kink is a reroute, not a subdivision.
const sourceStraight = graph('SOURCE', [edge(0, 200, 300, 1000)]);
const targetKink = graph('TARGET', [
  edge(0, 6000, 6010, 500, { x: 500, y: 0, z: 0 }),
  edge(1, 6010, 6020, 500, { x: 0, y: 500, z: 0 }),
]);
const kink = compareLockedCiiAnchorSpan(sourceStraight, targetKink, [
  { sourceNodeId: '200', targetNodeId: '6000' },
  { sourceNodeId: '300', targetNodeId: '6020' },
]);
assert.strictEqual(kink.status, 'UNRESOLVED');
assert(kink.blockers.includes('SUBDIVISION_SEMANTICS_INCOMPATIBLE'));
assert.strictEqual(kink.pathGate.status, 'UNRESOLVED');
assert(kink.elementRows.every((row) => row.status !== 'HIGH'));

// A true straight subdivision preserves cumulative length and engineering semantics.
const targetSubdivision = graph('TARGET', [edge(0, 7000, 7010, 400), edge(1, 7010, 7020, 600)]);
const subdivision = compareLockedCiiAnchorSpan(sourceStraight, targetSubdivision, [
  { sourceNodeId: '200', targetNodeId: '7000' },
  { sourceNodeId: '300', targetNodeId: '7020' },
]);
assert.strictEqual(subdivision.status, 'READY');
assert.strictEqual(subdivision.pathGate.status, 'SUPPORTED');
assert.strictEqual(subdivision.elementRows[0].kind, 'ELEMENT_PATH');
assert.strictEqual(subdivision.elementRows[0].evidence.subdivision.straightnessOk, true);
assert(subdivision.elementRows[0].evidence.subdivision.evidenceFamilies.wall);
console.log('CII Workspace reroute/subdivision fail-closed checks passed.');
