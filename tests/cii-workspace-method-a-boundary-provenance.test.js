import assert from 'node:assert/strict';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { qualifyCiiMultiBaseAuthority } from '../tabs/cii-workspace/cii-workspace-multi-base-anchor.js';
import {
  buildCiiMultiBaseCorrespondence,
  _test as correspondenceTest,
} from '../tabs/cii-workspace/cii-workspace-multi-base-correspondence.js';

function highEvidence() { return { identitySupported: true, identityConfidence: 'HIGH' }; }
function boundaryRow(status = 'HIGH', left = highEvidence(), right = highEvidence()) {
  return {
    correspondenceId: 'node:20:120',
    kind: 'NODE',
    sourceNodeId: '20',
    targetNodeId: '120',
    status,
    authority: 'ADJACENT_MATCH_BOUNDARY',
    evidence: { leftElement: left, rightElement: right },
  };
}
function loop(confidence) { return { loopId: `A-${confidence}`, method: 'METHOD_A_SPATIAL', confidence }; }

for (const confidence of ['HIGH', 'MEDIUM']) {
  const projected = correspondenceTest.projectMethodABoundaryRow(boundaryRow(), loop(confidence));
  assert.strictEqual(projected.status, 'REVIEW');
  assert.strictEqual(projected.authority, 'ADJACENT_MATCH_BOUNDARY');
  assert.strictEqual(projected.evidence.identitySupported, true);
  assert.strictEqual(projected.evidence.identityConfidence, confidence);
  assert.strictEqual(projected.evidence.identityEvidenceBasis, 'METHOD_A_QUALIFIED_ADJACENT_BOUNDARY');
  assert.strictEqual(projected.evidence.methodALoopId, `A-${confidence}`);
  assert(projected.evidence.leftElement && projected.evidence.rightElement, 'adjacent evidence family must be preserved');
}

{
  const projected = correspondenceTest.projectMethodABoundaryRow(boundaryRow(), loop('REVIEW'));
  assert.strictEqual(projected.status, 'REVIEW');
  assert.strictEqual(projected.evidence.identitySupported, false);
  assert.strictEqual(projected.evidence.identityConfidence, 'REVIEW');
}

{
  const weak = correspondenceTest.projectMethodABoundaryRow(
    boundaryRow('HIGH', { identitySupported: true, identityConfidence: 'MEDIUM' }, highEvidence()),
    loop('HIGH'),
  );
  assert.strictEqual(weak.evidence.identitySupported, false);
  assert.strictEqual(weak.evidence.identityConfidence, 'REVIEW');
}

{
  const unsupported = correspondenceTest.projectMethodABoundaryRow(
    boundaryRow('HIGH', { identitySupported: false, identityConfidence: 'HIGH' }, highEvidence()),
    loop('HIGH'),
  );
  assert.strictEqual(unsupported.evidence.identitySupported, false);
  assert.strictEqual(unsupported.evidence.identityConfidence, 'REVIEW');
}

for (const status of ['CONFLICT', 'UNRESOLVED']) {
  const original = boundaryRow(status);
  assert.strictEqual(correspondenceTest.projectMethodABoundaryRow(original, loop('HIGH')), original,
    `${status} boundary row must remain unchanged`);
}
{
  const nonBoundary = { ...boundaryRow(), authority: 'OTHER_EVIDENCE' };
  assert.strictEqual(correspondenceTest.projectMethodABoundaryRow(nonBoundary, loop('HIGH')), nonBoundary);
}

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

const source = graph('SOURCE', 'source-D3-2', [
  segment(10, 20, point(0, 0, 0), point(1000, 0, 0)),
  segment(20, 30, point(1000, 0, 0), point(1000, 1000, 0)),
]);
const target = graph('TARGET', 'target-D3-2', [
  segment(110, 120, point(0, 0, 0), point(1000, 0, 0)),
  segment(120, 130, point(1000, 0, 0), point(1000, 1000, 0)),
]);
const anchorPairs = [
  pair(source, target, 10, 110),
  pair(source, target, 20, 120),
  pair(source, target, 30, 130),
];
const authority = qualifyCiiMultiBaseAuthority({
  sourceGraph: source, targetGraph: target, methodABases: [{ baseId: 'A-D3-2', anchorPairs }],
});
assert.strictEqual(authority.status, 'READY');
assert(['HIGH', 'MEDIUM'].includes(authority.loops[0].confidence));

const result = buildCiiMultiBaseCorrespondence(source, target, authority);
assert.strictEqual(result.status, 'READY');
const raw = result.loopResults[0].correspondence;
const boundaries = raw.nodeRows.filter((row) => row.authority === 'ADJACENT_MATCH_BOUNDARY');
assert(boundaries.length > 0, 'single Method-A span must retain adjacent boundary rows');
assert(boundaries.every((row) => row.status === 'REVIEW'));
assert(boundaries.every((row) => row.evidence?.identitySupported === true));
assert(boundaries.every((row) => row.evidence?.identityConfidence === authority.loops[0].confidence));
assert(boundaries.every((row) => row.evidence?.identityEvidenceBasis === 'METHOD_A_QUALIFIED_ADJACENT_BOUNDARY'));

console.log('CII Method-A adjacent-boundary provenance checks passed.');
