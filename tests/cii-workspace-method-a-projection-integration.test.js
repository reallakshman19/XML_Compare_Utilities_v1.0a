import assert from 'node:assert/strict';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { qualifyCiiMultiBaseAuthority } from '../tabs/cii-workspace/cii-workspace-multi-base-anchor.js';
import { buildCiiMultiBaseCorrespondence } from '../tabs/cii-workspace/cii-workspace-multi-base-correspondence.js';
import { arbitrateCiiLoopCorrespondences } from '../tabs/cii-workspace/cii-workspace-correspondence-arbitration.js';
import {
  buildCiiEngineeringDeltas,
  ciiIdentityBound,
  ciiIdentityConfidence,
} from '../tabs/cii-workspace/cii-workspace-engineering-delta.js';
import { buildCiiCompareReviewModel } from '../tabs/cii-workspace/cii-workspace-compare-review.js';

function qualifiedCapabilities() {
  const qualified = { state: 'PARSED', qualification: 'QUALIFIED', limitations: [] };
  return { families: {
    restraints: { state: 'NOT_PARSED', qualification: 'NONE', limitations: [] },
    hangers: { state: 'NOT_PARSED', qualification: 'NONE', limitations: [] },
    sifTee: { state: 'NOT_PARSED', qualification: 'NONE', limitations: [] },
    weightData: { state: 'NOT_PARSED', qualification: 'NONE', limitations: [] },
    lineNumbers: { state: 'NOT_PARSED', qualification: 'NONE', limitations: [] },
    process: { state: 'PARSED', qualification: 'PARTIAL', limitations: [] },
    nodeNames: qualified, pipeProperties: qualified, rigidMass: qualified,
  } };
}
function point(x, y, z = 0) { return { x, y, z }; }
function segment(from, to, fromPos, toPos, od = 100, wall = 6) {
  const dx = toPos.x - fromPos.x; const dy = toPos.y - fromPos.y; const dz = toPos.z - fromPos.z;
  return { from, to, dx, dy, dz, length: Math.hypot(dx, dy, dz), od, wall, fromPos, toPos };
}
function document(side, id, elements, nodeNames = {}) {
  const nodes = {};
  for (const element of elements) { nodes[element.from] = element.fromPos; nodes[element.to] = element.toPos; }
  return {
    schema: 'CIIWorkspaceDocument.v1', side, contentSha256: id, fileName: `${side}.CII`,
    summary: { nodeCount: Object.keys(nodes).length, elementCount: elements.length },
    nodeNames, capabilities: qualifiedCapabilities(), parsed: { elements, nodes, rigids: [], restraints: [] },
  };
}
function nodePosition(graph, id) { return graph.nodes.find((node) => String(node.id) === String(id)).position; }
function pair(sourceGraph, targetGraph, sourceNodeId, targetNodeId) {
  return {
    sourceNodeId: String(sourceNodeId), targetNodeId: String(targetNodeId),
    source: nodePosition(sourceGraph, sourceNodeId), target: nodePosition(targetGraph, targetNodeId), sourceOdMm: 100,
  };
}

const sourceElements = [
  segment(10, 20, point(0, 0), point(1000, 0)),
  segment(20, 30, point(1000, 0), point(1000, 1000)),
  segment(30, 40, point(1000, 1000), point(2000, 1000)),
];
const targetElements = [
  segment(110, 120, point(500, 200), point(1500, 200)),
  segment(120, 130, point(1500, 200), point(1500, 1200)),
  segment(130, 140, point(1500, 1200), point(2500, 1200)),
];
const sourceDoc = document('SOURCE', 'source-D3-3', sourceElements, { 20: 'OLD-BOUNDARY' });
const targetDoc = document('TARGET', 'target-D3-3', targetElements, { 120: 'NEW-BOUNDARY' });
const sourceGraph = adaptCiiDocumentToTopologyGraph(sourceDoc);
const targetGraph = adaptCiiDocumentToTopologyGraph(targetDoc);
const anchors = [
  pair(sourceGraph, targetGraph, 10, 110),
  pair(sourceGraph, targetGraph, 30, 130),
  pair(sourceGraph, targetGraph, 40, 140),
];
const authority = qualifyCiiMultiBaseAuthority({
  sourceGraph, targetGraph, methodABases: [{ baseId: 'A-D3-3', anchorPairs: anchors }],
});
assert.strictEqual(authority.status, 'READY');
assert(['HIGH', 'MEDIUM'].includes(authority.loops[0].confidence));

const correspondence = buildCiiMultiBaseCorrespondence(sourceGraph, targetGraph, authority);
assert.strictEqual(correspondence.status, 'READY');
const boundary = correspondence.nodeRows.find((row) => row.sourceNodeId === '20' && row.targetNodeId === '120');
assert(boundary, 'non-anchor interior boundary must survive arbitration');
assert.strictEqual(boundary.authority, 'MULTI_BASE_LOOP');
assert.strictEqual(boundary.status, 'REVIEW');
assert.strictEqual(boundary.evidence?.identitySupported, true);
assert.strictEqual(boundary.evidence?.identityConfidence, authority.loops[0].confidence);
assert.strictEqual(boundary.evidence?.identityEvidenceBasis, 'METHOD_A_QUALIFIED_ADJACENT_BOUNDARY');
assert(boundary.evidence?.multiBaseProvenance?.some((item) => item.rowAuthority === 'ADJACENT_MATCH_BOUNDARY'));
assert.strictEqual(ciiIdentityBound(boundary), true);
assert.strictEqual(ciiIdentityConfidence(boundary), authority.loops[0].confidence);

const deltas = buildCiiEngineeringDeltas(sourceDoc, targetDoc, sourceGraph, targetGraph, correspondence);
const nodeNameDelta = deltas.changedRows.find((row) =>
  row.correspondenceId === boundary.correspondenceId && row.category === 'NODE_NAME');
assert(nodeNameDelta, 'bound boundary identity must drive generic NodeName engineering delta');
assert.strictEqual(nodeNameDelta.sourceValue, 'OLD-BOUNDARY');
assert.strictEqual(nodeNameDelta.targetValue, 'NEW-BOUNDARY');

const review = { reviewedCorrespondenceIds: [], lockedCorrespondenceIds: [], rejectedCorrespondenceIds: [] };
const model = buildCiiCompareReviewModel(sourceDoc, targetDoc, correspondence, review, deltas);
const projection = model.rows.find((row) => row.correspondenceId === boundary.correspondenceId);
assert(projection);
assert.strictEqual(projection.workflowStatus, 'REVIEW');
assert.strictEqual(projection.identityBound, true);
assert.strictEqual(projection.confidence, authority.loops[0].confidence);
assert.strictEqual(projection.decision, 'REVIEW');
assert.notStrictEqual(projection.confidence, 'LOCKED');

const reviewLoop = { ...authority.loops[0], loopId: 'A-D3-3-REVIEW', status: 'READY', confidence: 'REVIEW' };
const unqualified = buildCiiMultiBaseCorrespondence(sourceGraph, targetGraph, { status: 'READY', loops: [reviewLoop] });
const unqualifiedBoundary = unqualified.nodeRows.find((row) => row.sourceNodeId === '20' && row.targetNodeId === '120');
assert(unqualifiedBoundary);
assert.strictEqual(unqualifiedBoundary.status, 'REVIEW');
assert.strictEqual(unqualifiedBoundary.evidence?.identitySupported, false);
assert.strictEqual(ciiIdentityBound(unqualifiedBoundary), false);
assert.strictEqual(ciiIdentityConfidence(unqualifiedBoundary), 'REVIEW');

const manualPairs = anchors.map(({ sourceNodeId, targetNodeId }) => ({ sourceNodeId, targetNodeId }));
const legacy = buildCiiMultiBaseCorrespondence(sourceGraph, targetGraph, {
  status: 'READY',
  loops: [{
    loopId: 'LEGACY', method: 'USER_LOCKED_LEGACY', status: 'READY',
    geometry: authority.loops[0].geometry, anchorPairs: manualPairs,
  }],
});
assert(legacy.nodeRows.some((row) => row.status === 'LOCKED' && row.authority === 'USER_LOCKED_ANCHOR'));

function mockLoop(loopId, targetNodeId) {
  return {
    loop: { loopId, method: 'METHOD_A_SPATIAL', status: 'READY', confidence: 'MEDIUM' },
    correspondence: {
      status: 'READY', blockers: [], elementRows: [],
      nodeRows: [{
        correspondenceId: `node:20:${targetNodeId}`, kind: 'NODE',
        sourceNodeId: '20', targetNodeId: String(targetNodeId), status: 'REVIEW',
        authority: 'ADJACENT_MATCH_BOUNDARY',
        evidence: { identitySupported: true, identityConfidence: 'MEDIUM' },
      }],
    },
  };
}
const conflict = arbitrateCiiLoopCorrespondences([mockLoop('A1', 120), mockLoop('A2', 999)]);
assert.strictEqual(conflict.status, 'AMBIGUOUS');
assert(conflict.conflicts.some((item) => item.kind === 'SOURCE_NODE_TO_MULTIPLE_TARGETS'));

console.log('CII Method-A projection integration checks passed.');
