import assert from 'assert';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { suggestCiiBaseAnchorPairs } from '../tabs/cii-workspace/cii-workspace-anchor-suggestions.js';

function edge(index, from, to, od) {
  return { index, from, to, dx: 100, dy: 0, dz: 0, length: 100, od, wall: 8, P1: 10, T1: 100, hasBend: false };
}
function graph(side, ids, od) {
  const [a, branch, c, d, e, f] = ids;
  const elements = [edge(0, a, branch, od), edge(1, branch, c, od), edge(2, branch, d, od), edge(3, d, e, od), edge(4, e, f, od)];
  const nodes = {};
  for (const item of elements) {
    nodes[item.from] ||= { x: item.from, y: 0, z: 0 };
    nodes[item.to] ||= { x: item.to, y: 0, z: 0 };
    item.fromPos = nodes[item.from]; item.toPos = nodes[item.to];
  }
  return adaptCiiDocumentToTopologyGraph({ schema: 'CIIWorkspaceDocument.v1', side, contentSha256: `${side}-sha`, nodeNames: {}, parsed: { elements, nodes, rigids: [] } });
}
function vectorEdge(index, from, to, vector, od, nodes) {
  const [dx, dy, dz] = vector;
  return { index, from, to, dx, dy, dz, length: Math.hypot(dx, dy, dz), od, wall: 8, P1: 10, T1: 100,
    hasBend: false, fromPos: nodes[from], toPos: nodes[to] };
}
function twoAxisGraph(side, ids, od, rotated = false) {
  const [a, branch, c, d] = ids;
  const nodes = rotated
    ? { [branch]: { x: 0, y: 0, z: 0 }, [a]: { x: 0, y: -1000, z: 0 }, [c]: { x: 0, y: 1000, z: 0 }, [d]: { x: 0, y: 0, z: 700 } }
    : { [branch]: { x: 0, y: 0, z: 0 }, [a]: { x: -1000, y: 0, z: 0 }, [c]: { x: 1000, y: 0, z: 0 }, [d]: { x: 0, y: 0, z: 700 } };
  const primary = rotated ? [0, 1000, 0] : [1000, 0, 0];
  const elements = [vectorEdge(0, a, branch, primary, od, nodes), vectorEdge(1, branch, c, primary, od, nodes), vectorEdge(2, branch, d, [0, 0, 700], od, nodes)];
  return adaptCiiDocumentToTopologyGraph({ schema: 'CIIWorkspaceDocument.v1', side, contentSha256: `${side}-two-axis`, nodeNames: {}, parsed: { elements, nodes, rigids: [] } });
}

const source = graph('SOURCE', [10, 20, 30, 40, 50, 60], 273);
const target = graph('TARGET', [901, 777, 333, 555, 444, 222], 88.9);
const first = suggestCiiBaseAnchorPairs(source, target); const second = suggestCiiBaseAnchorPairs(source, target);
assert.deepStrictEqual(first, second, 'paired anchor suggestions must be deterministic');
const branchPair = first.find((row) => row.sourceNodeId === '20');
assert(branchPair, 'unique source branch must receive a paired base-anchor suggestion');
assert.strictEqual(branchPair.targetNodeId, '777', 'pairing must follow topology, not numeric offset');
assert.strictEqual(branchPair.confidence, 'REVIEW', 'one-axis geometry must never be promoted to MEDIUM/HIGH Method B confidence');
assert.strictEqual(branchPair.basisMethod, 'LANDMARK_ONLY');
assert.strictEqual(branchPair.methodB.status, 'REVIEW');
assert.strictEqual(branchPair.methodB.source.independentAxisRunCount, 1);
assert.strictEqual(branchPair.methodB.tolerancePolicy.odRefMm, 273);
assert.strictEqual(branchPair.methodB.tolerancePolicy.toleranceMm, 546);
assert.strictEqual(branchPair.status, 'SUGGESTED');
assert.strictEqual(branchPair.authority, 'EVIDENCE_ONLY_ENGINEER_ACCEPT_REQUIRED');
assert.strictEqual(branchPair.reviewRequired, true);
assert(branchPair.basis.some((item) => item.includes('topology neighbourhood')));
assert(branchPair.identityExclusions.includes('NODE_NUMBER_OFFSET_NOT_USED'));
assert(branchPair.identityExclusions.includes('OD_NOT_IDENTITY_USED_AS_TOLERANCE_SCALE'));
assert(branchPair.identityExclusions.includes('WALL_NOT_USED'));
assert(!first.some((row) => row.status === 'LOCKED'), 'suggestions must never create anchor authority automatically');

const sourceTwoAxis = twoAxisGraph('SOURCE', [10, 20, 30, 40], 273, false);
const targetTwoAxis = twoAxisGraph('TARGET', [901, 777, 333, 555], 88.9, true);
const twoAxis = suggestCiiBaseAnchorPairs(sourceTwoAxis, targetTwoAxis);
const twoAxisBranch = twoAxis.find((row) => row.sourceNodeId === '20');
assert(twoAxisBranch, 'two-axis branch must receive a candidate');
assert.strictEqual(twoAxisBranch.targetNodeId, '777');
assert.strictEqual(twoAxisBranch.basisMethod, 'METHOD_B_NETWORK');
assert.strictEqual(twoAxisBranch.methodB.status, 'READY');
assert.strictEqual(twoAxisBranch.methodB.source.independentAxisRunCount, 2);
assert.strictEqual(twoAxisBranch.methodB.target.independentAxisRunCount, 2);
assert.strictEqual(twoAxisBranch.methodB.weight.geometryComplexity, 24);
assert(twoAxisBranch.methodBWeight.total >= 80, 'excellent two-axis evidence remains eligible for HIGH');
assert.strictEqual(twoAxisBranch.confidence, 'HIGH');

const targetDifferentOd = twoAxisGraph('TARGET', [901, 777, 333, 555], 1000, true);
const targetDifferentOdBranch = suggestCiiBaseAnchorPairs(sourceTwoAxis, targetDifferentOd).find((row) => row.sourceNodeId === '20');
assert.strictEqual(targetDifferentOdBranch.methodB.tolerancePolicy.toleranceMm, 546, 'TARGET OD must not change Method B tolerance');
assert.strictEqual(targetDifferentOdBranch.confidence, twoAxisBranch.confidence, 'TARGET OD must not change Method B confidence');

console.log('CII OD-scaled method-qualified paired base-anchor suggestion checks passed.');
