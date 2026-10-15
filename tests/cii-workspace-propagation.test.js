import assert from 'assert';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { propagateSingleCiiAnchorCorrespondence } from '../tabs/cii-workspace/cii-workspace-propagation.js';

const point = (x = 0, y = 0, z = 0) => ({ x, y, z });
function segment(from, to, fromPos, toPos, od = 88.9, wall = 5.5, positions = true) {
  return {
    from, to,
    dx: toPos.x - fromPos.x, dy: toPos.y - fromPos.y, dz: toPos.z - fromPos.z,
    length: Math.hypot(toPos.x - fromPos.x, toPos.y - fromPos.y, toPos.z - fromPos.z),
    od, wall, ...(positions ? { fromPos, toPos } : {}),
  };
}
function graph(side, id, elements) {
  const nodes = {};
  for (const item of elements) {
    if (item.fromPos) nodes[item.from] = item.fromPos;
    if (item.toPos) nodes[item.to] = item.toPos;
  }
  return adaptCiiDocumentToTopologyGraph({
    schema: 'CIIWorkspaceDocument.v1', side, contentSha256: id, nodeNames: {},
    parsed: { elements, nodes, rigids: [] },
  });
}
const anchor = (sourceNodeId, targetNodeId) => ({ sourceNodeId: String(sourceNodeId), targetNodeId: String(targetNodeId), locked: true });

// Multi-hop propagation still traverses the complete unambiguous chain.
{
  const source = graph('SOURCE', 'chain-s', [
    segment(10, 20, point(0), point(1000)), segment(20, 30, point(1000), point(2000)),
    segment(30, 40, point(2000), point(3000)), segment(40, 50, point(3000), point(4000)),
  ]);
  const target = graph('TARGET', 'chain-t', [
    segment(110, 120, point(0), point(1000)), segment(120, 130, point(1000), point(2000)),
    segment(130, 140, point(2000), point(3000)), segment(140, 150, point(3000), point(4000)),
  ]);
  const result = propagateSingleCiiAnchorCorrespondence(source, target, anchor(10, 110));
  assert.equal(result.status, 'READY');
  assert.equal(result.propagation.matchedEdgeCount, 4);
  assert(result.elementRows.every((row) => row.status === 'HIGH'));
}

// One locked anchor cannot establish rotation. M1 is N/A, not a raw-coordinate FAIL;
// ordinary M2 + HIGH OD remains MEDIUM/REVIEW without independent Node Name corroboration.
{
  const source = graph('SOURCE', 'move-s', [
    segment(200, 205, point(0), point(-1213.79)), segment(205, 210, point(-1213.79), point(-2427.58)),
  ]);
  const target = graph('TARGET', 'move-t', [
    segment(20200, 20205, point(0), point(-1013.79)), segment(20205, 20210, point(-1013.79), point(-2427.58)),
  ]);
  const result = propagateSingleCiiAnchorCorrespondence(source, target, anchor(200, 20200), { spatialToleranceMm: 100 });
  assert.equal(result.status, 'READY');
  assert(result.elementRows.every((row) => row.status === 'REVIEW'));
  for (const row of result.elementRows) {
    const winner = row.evidence.candidates.rankedCandidates[0];
    assert.equal(row.evidence.candidates.winnerIdentityConfidence, 'MEDIUM');
    assert.equal(winner.methods.m1Spatial.available, false);
    assert.equal(winner.methods.m1Spatial.registrationStatus, 'UNDERDETERMINED');
    assert.equal(winner.methods.m2Network.pass, true);
  }
}

// OD >50% is REVIEW, but a unique M2-supported pair remains available for explicit review.
{
  const source = graph('SOURCE', 'od-s', [
    segment(250, 255, point(0), point(0, 0, -659.301), 60.3, 3.9),
    segment(255, 260, point(0, 0, -659.301), point(0, 0, -930.903), 60.3, 3.9),
  ]);
  const target = graph('TARGET', 'od-t', [
    segment(20250, 20255, point(0), point(0, 0, -659.301), 114.3, 4.7752),
    segment(20255, 20260, point(0, 0, -659.301), point(0, 0, -930.903), 114.3, 4.7752),
  ]);
  const result = propagateSingleCiiAnchorCorrespondence(source, target, anchor(250, 20250));
  assert.equal(result.status, 'READY');
  assert.equal(result.propagation.matchedEdgeCount, 2);
  assert(result.elementRows.every((row) => row.status === 'REVIEW'));
  assert(result.elementRows.every((row) => row.evidence.candidates.status === 'SUPPORTED'));
  assert(result.elementRows.every((row) => row.evidence.candidates.winnerIdentityConfidence === 'REVIEW'));
}

// Equal topology branches remain fail-closed; no arbitrary target arm is chosen.
{
  const source = graph('SOURCE', 'amb-s', [
    segment(1, 2, point(0), point(1000), 273, 8, false),
    segment(2, 3, point(1000), point(2000), 273, 8, false),
    segment(2, 4, point(1000), point(2000), 273, 8, false),
  ]);
  const target = graph('TARGET', 'amb-t', [
    segment(101, 102, point(0), point(1000), 273, 8, false),
    segment(102, 103, point(1000), point(2000), 273, 8, false),
    segment(102, 104, point(1000), point(2000), 273, 8, false),
  ]);
  const result = propagateSingleCiiAnchorCorrespondence(source, target, anchor(1, 101), { winnerGap: 8 });
  assert.equal(result.status, 'UNRESOLVED');
  assert(result.blockers.includes('FRONTIER_WINNER_GAP_NOT_SATISFIED'));
  assert(result.blockers.includes('PROPAGATION_AMBIGUITY_RETAINED'));
  assert.equal(result.propagation.matchedEdgeCount, 1);
}

console.log('CII anchor-seeded propagation checks passed.');
