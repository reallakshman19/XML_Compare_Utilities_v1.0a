import assert from 'node:assert/strict';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { qualifyCiiMultiBaseAuthority } from '../tabs/cii-workspace/cii-workspace-multi-base-anchor.js';
import { buildCiiMultiBaseCorrespondence } from '../tabs/cii-workspace/cii-workspace-multi-base-correspondence.js';
import { compareLockedCiiAnchorSpan } from '../tabs/cii-workspace/cii-workspace-topology.js';
import { ciiIdentityBound, ciiIdentityConfidence } from '../tabs/cii-workspace/cii-workspace-engineering-delta.js';

function point(x = 0, y = 0, z = 0) { return { x, y, z }; }
function segment(from, to, fromPos, toPos, od = 100, wall = 6) {
  const dx = toPos.x - fromPos.x; const dy = toPos.y - fromPos.y; const dz = toPos.z - fromPos.z;
  return { from, to, dx, dy, dz, length: Math.hypot(dx, dy, dz), od, wall, fromPos, toPos };
}
function document(side, id, elements) {
  const nodes = {};
  for (const element of elements) { nodes[element.from] = element.fromPos; nodes[element.to] = element.toPos; }
  return { schema: 'CIIWorkspaceDocument.v1', side, contentSha256: id, nodeNames: {}, parsed: { elements, nodes, rigids: [] } };
}
function graph(side, id, elements) { return adaptCiiDocumentToTopologyGraph(document(side, id, elements)); }
function nodePosition(graphValue, id) { return graphValue.nodes.find((node) => String(node.id) === String(id)).position; }
function pair(sourceGraph, targetGraph, sourceNodeId, targetNodeId) {
  return {
    sourceNodeId: String(sourceNodeId), targetNodeId: String(targetNodeId),
    source: nodePosition(sourceGraph, sourceNodeId), target: nodePosition(targetGraph, targetNodeId), sourceOdMm: 100,
  };
}

const source = graph('SOURCE', 'source-D3-1', [
  segment(10, 20, point(0, 0, 0), point(1000, 0, 0)),
  segment(20, 30, point(1000, 0, 0), point(1000, 1000, 0)),
]);
const target = graph('TARGET', 'target-D3-1', [
  segment(110, 120, point(0, 0, 0), point(1000, 0, 0)),
  segment(120, 130, point(1000, 0, 0), point(1000, 1000, 0)),
]);
const anchorPairs = [
  pair(source, target, 10, 110),
  pair(source, target, 20, 120),
  pair(source, target, 30, 130),
];
const authority = qualifyCiiMultiBaseAuthority({
  sourceGraph: source, targetGraph: target, methodABases: [{ baseId: 'A-D3-1', anchorPairs }],
});
assert.strictEqual(authority.status, 'READY');
assert(['HIGH', 'MEDIUM'].includes(authority.loops[0].confidence));

const automatic = buildCiiMultiBaseCorrespondence(source, target, authority);
assert.strictEqual(automatic.status, 'READY');
const raw = automatic.loopResults[0].correspondence;
const rawAnchors = raw.nodeRows.filter((row) => row.authority === 'METHOD_A_QUALIFIED_ANCHOR');
assert.strictEqual(rawAnchors.length, 3);
assert(rawAnchors.every((row) => row.status === 'REVIEW'));
assert(rawAnchors.every((row) => row.evidence?.identitySupported === true));
assert(rawAnchors.every((row) => row.evidence?.identityConfidence === authority.loops[0].confidence));
assert(rawAnchors.every((row) => row.evidence?.identityEvidenceBasis === 'METHOD_A_QUALIFIED_BASE_ANCHOR'));
assert(!raw.nodeRows.some((row) => row.authority === 'USER_LOCKED_ANCHOR'));

const endpoint = automatic.nodeRows.find((row) => row.sourceNodeId === '10' && row.targetNodeId === '110');
assert(endpoint);
assert.strictEqual(endpoint.status, 'REVIEW');
assert.strictEqual(endpoint.evidence?.identityEvidenceBasis, 'METHOD_A_QUALIFIED_BASE_ANCHOR');
assert.strictEqual(ciiIdentityBound(endpoint), true);
assert.strictEqual(ciiIdentityConfidence(endpoint), authority.loops[0].confidence);

const reviewLoop = { ...authority.loops[0], loopId: 'A-REVIEW', status: 'READY', confidence: 'REVIEW' };
const reviewResult = buildCiiMultiBaseCorrespondence(source, target, { status: 'READY', loops: [reviewLoop] });
const reviewEndpoint = reviewResult.nodeRows.find((row) => row.sourceNodeId === '10' && row.targetNodeId === '110');
assert(reviewEndpoint);
assert.strictEqual(reviewEndpoint.status, 'REVIEW');
assert.strictEqual(reviewEndpoint.evidence?.identitySupported, false);
assert.strictEqual(reviewEndpoint.evidence?.identityConfidence, 'REVIEW');
assert.strictEqual(ciiIdentityBound(reviewEndpoint), false);
assert.strictEqual(ciiIdentityConfidence(reviewEndpoint), 'REVIEW');

const manualPairs = anchorPairs.map(({ sourceNodeId, targetNodeId }) => ({ sourceNodeId, targetNodeId }));
const directManual = compareLockedCiiAnchorSpan(source, target, manualPairs, { geometryTransform: authority.loops[0].geometry });
const legacy = buildCiiMultiBaseCorrespondence(source, target, {
  status: 'READY',
  loops: [{
    loopId: 'LEGACY_LOCKED_BASE_1', method: 'USER_LOCKED_LEGACY', status: 'READY',
    geometry: authority.loops[0].geometry, anchorPairs: manualPairs,
  }],
});
assert.deepStrictEqual(
  legacy.nodeRows.map((row) => [row.correspondenceId, row.status, row.authority]),
  directManual.nodeRows.map((row) => [row.correspondenceId, row.status, row.authority]),
);
assert(legacy.nodeRows.some((row) => row.status === 'LOCKED' && row.authority === 'USER_LOCKED_ANCHOR'));

console.log('CII Method-A automatic anchor provenance checks passed.');
