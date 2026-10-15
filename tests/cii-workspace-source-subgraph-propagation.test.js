import assert from 'node:assert/strict';
import { propagateSingleCiiAnchorCorrespondence } from '../tabs/cii-workspace/cii-workspace-propagation.js';
import { evaluateCiiNetworkMethod } from '../tabs/cii-workspace/cii-workspace-match-methods.js';

function context(degree) {
  return Object.freeze({ degree, neighbourhoodLayers: Object.freeze([Object.freeze(['PIPE'])]) });
}
function edge(id, from, to, { fromDegree, toDegree, kind = 'PIPE', sequence = ['PIPE', 'PIPE'], length = 1000 } = {}) {
  return Object.freeze({
    elementId: id, from: String(from), to: String(to), componentKind: kind,
    diameter: 100, wall: 5, lengthMm: length,
    fromContext: context(fromDegree), toContext: context(toDegree),
    pathSequenceContext: Object.freeze(sequence), pathStationMidMm: 500, pathTotalLengthMm: 2000,
  });
}
function graph(documentId, edges) {
  const adjacency = new Map();
  for (const item of edges) {
    for (const node of [item.from, item.to]) if (!adjacency.has(node)) adjacency.set(node, []);
    adjacency.get(item.from).push(item); adjacency.get(item.to).push(item);
  }
  return Object.freeze({ documentId, adjacency });
}
const anchor = (sourceNodeId, targetNodeId) => ({ sourceNodeId: String(sourceNodeId), targetNodeId: String(targetNodeId), locked: true });

// The matching primitive is directional: a larger TARGET degree is allowed because SOURCE may be a subgraph.
{
  const source = edge('S', 2, 3, { fromDegree: 2, toDegree: 1 });
  const target = edge('T', 102, 103, { fromDegree: 3, toDegree: 1 });
  const result = evaluateCiiNetworkMethod(source, target);
  assert.equal(result.blockers.includes('BRANCH_TOPOLOGY_INCOMPATIBLE'), false);
  assert.equal(result.pass, true);
}

// Positive falsifier: SOURCE chain maps completely into TARGET branch while one target-only arm remains untouched.
{
  const source = graph('source-subgraph', [
    edge('S1', 1, 2, { fromDegree: 1, toDegree: 2 }),
    edge('S2', 2, 3, { fromDegree: 2, toDegree: 1 }),
  ]);
  const target = graph('larger-target', [
    edge('T1', 101, 102, { fromDegree: 1, toDegree: 3 }),
    edge('T2', 102, 103, { fromDegree: 3, toDegree: 1 }),
    edge('T-EXTRA', 102, 104, { fromDegree: 3, toDegree: 1, kind: 'RIGID' }),
  ]);
  const result = propagateSingleCiiAnchorCorrespondence(source, target, anchor(1, 101));
  assert.equal(result.status, 'READY', result.blockers.join(','));
  assert.equal(result.propagation.matchedEdgeCount, 2);
  assert.deepEqual(result.propagation.unmatchedSourceElementIds, []);
  assert.deepEqual(result.propagation.unmatchedTargetElementIds, ['T-EXTRA']);
  assert.equal(result.blockers.includes('TARGET_COMPONENT_NOT_FULLY_CLAIMED'), false);
}

// Negative falsifier: every SOURCE frontier edge still requires unique TARGET support.
{
  const source = graph('source-branch', [
    edge('S0', 1, 2, { fromDegree: 1, toDegree: 3 }),
    edge('S1', 2, 3, { fromDegree: 3, toDegree: 1 }),
    edge('S2', 2, 4, { fromDegree: 3, toDegree: 1 }),
  ]);
  const target = graph('target-missing-arm', [
    edge('T0', 101, 102, { fromDegree: 1, toDegree: 2 }),
    edge('T1', 102, 103, { fromDegree: 2, toDegree: 1 }),
  ]);
  const result = propagateSingleCiiAnchorCorrespondence(source, target, anchor(1, 101));
  assert.equal(result.status, 'UNRESOLVED');
  assert(result.blockers.includes('FRONTIER_CARDINALITY_MISMATCH'));
  assert(result.blockers.includes('SOURCE_COMPONENT_NOT_FULLY_PROPAGATED'));
}

// Ambiguity remains fail-closed when two extra TARGET arms are equally valid candidates.
{
  const source = graph('source-ambiguous', [
    edge('S1', 1, 2, { fromDegree: 1, toDegree: 2 }),
    edge('S2', 2, 3, { fromDegree: 2, toDegree: 1 }),
  ]);
  const target = graph('target-ambiguous', [
    edge('T1', 101, 102, { fromDegree: 1, toDegree: 3 }),
    edge('T2', 102, 103, { fromDegree: 3, toDegree: 1 }),
    edge('T3', 102, 104, { fromDegree: 3, toDegree: 1 }),
  ]);
  const result = propagateSingleCiiAnchorCorrespondence(source, target, anchor(1, 101));
  assert.equal(result.status, 'UNRESOLVED');
  assert(result.blockers.includes('FRONTIER_WINNER_GAP_NOT_SATISFIED'));
}

console.log('CII source-subgraph propagation falsifiers passed.');