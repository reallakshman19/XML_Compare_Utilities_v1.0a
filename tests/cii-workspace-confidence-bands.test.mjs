import assert from 'node:assert/strict';
import { ciiOdConfidenceBand } from '../tabs/cii-workspace/cii-workspace-confidence-bands.js';
import {
  evaluateCiiSpatialMethod,
  fuseCiiIdentityEvidence,
} from '../tabs/cii-workspace/cii-workspace-match-methods.js';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { propagateSingleCiiAnchorCorrespondence } from '../tabs/cii-workspace/cii-workspace-propagation.js';
import {
  canonicalizeCiiNodeName,
  compareCiiElementNodeNames,
  compareCiiNodeNames,
} from '../tabs/cii-workspace/cii-workspace-node-name-corroboration.js';

const od = (relativeDelta, available = true) => ({ available, relativeDelta });
assert.equal(ciiOdConfidenceBand(od(0.09999)).confidence, 'HIGH');
assert.equal(ciiOdConfidenceBand(od(0.10)).confidence, 'MEDIUM');
assert.equal(ciiOdConfidenceBand(od(0.50)).confidence, 'MEDIUM');
assert.equal(ciiOdConfidenceBand(od(0.50001)).confidence, 'REVIEW');
assert.equal(ciiOdConfidenceBand(od(null, false)).confidence, 'REVIEW');

for (const value of ['SL100.1', 'SL-100', 'SL-100(REF)', 'SL-100/DATUM']) {
  assert.equal(canonicalizeCiiNodeName(value)?.key, 'SL-100');
}
for (const value of ['PS100.1', 'PS-100', 'PS-100(REF)', '/PS-100/DATUM']) {
  assert.equal(canonicalizeCiiNodeName(value)?.key, 'PS-100');
}
assert.equal(compareCiiNodeNames('SL100.1', 'SL-100/DATUM').kind, 'CANONICAL');
assert.equal(compareCiiNodeNames('SL100', 'PS-100').match, false);
assert.equal(compareCiiNodeNames('ABC-1', 'ABC-1').kind, 'EXACT');
assert.equal(compareCiiNodeNames('ABC1', 'ABC-1').match, false, 'smart collapse is deliberately limited to SL/PS');

const edgeNames = compareCiiElementNodeNames(
  { fromNodeName: 'SL100.1', toNodeName: 'PS-200(REF)' },
  { fromNodeName: '/PS-200/DATUM', toNodeName: 'SL-100' },
);
assert.equal(edgeNames.kind, 'CANONICAL');
assert.equal(edgeNames.orientation, 'REVERSED');
assert.equal(edgeNames.matchedEndpointCount, 2);

const sourceEdge = { fromPos: { x: 0, y: 0, z: 0 }, toPos: { x: 1000, y: 0, z: 0 } };
const targetEdge = { fromPos: { x: 50, y: 50, z: 0 }, toPos: { x: 1050, y: 50, z: 0 } };
const m1Underdetermined = evaluateCiiSpatialMethod(sourceEdge, targetEdge, {
  geometryTransform: { status: 'UNDERDETERMINED', reason: 'ONE_ANCHOR_CANNOT_ESTABLISH_ROTATION' },
});
assert.equal(m1Underdetermined.available, false);
assert.equal(m1Underdetermined.basis, 'REGISTRATION_UNDERDETERMINED');
assert.equal(m1Underdetermined.registrationStatus, 'UNDERDETERMINED');

const m1Pass = { available: true, pass: true, score: 95 };
const m1Fail = { available: true, pass: false, score: 0 };
const m1NA = { available: false, pass: false, score: 0 };
const m2Pass = { available: true, pass: true, score: 90 };
const m2Medium = { available: true, pass: true, score: 60 };
const m2Fail = { available: true, pass: false, score: 20 };
const highOd = { diameter: { available: true, pass: true, relativeDelta: 0.05 }, wall: { available: true, pass: false, relativeDelta: 0.9 } };
const mediumOd = { diameter: { available: true, pass: false, relativeDelta: 0.20 }, wall: { available: true, pass: true, relativeDelta: 0 } };
const reviewOd = { diameter: { available: true, pass: false, relativeDelta: 0.60 }, wall: { available: true, pass: true, relativeDelta: 0 } };
const nameMatch = compareCiiNodeNames('SL100.1', 'SL-100/DATUM');
const noName = { available: false, match: false, kind: 'UNAVAILABLE', matchRatio: null };

assert.equal(fuseCiiIdentityEvidence(m1Pass, m2Pass, highOd, nameMatch).confidence, 'HIGH', 'wall mismatch cannot downgrade identity');
assert.equal(fuseCiiIdentityEvidence(m1Pass, m2Pass, mediumOd, nameMatch).confidence, 'MEDIUM');
assert.equal(fuseCiiIdentityEvidence(m1Pass, m2Pass, reviewOd, nameMatch).confidence, 'REVIEW');
assert.equal(fuseCiiIdentityEvidence(m1NA, m2Pass, highOd, nameMatch).confidence, 'HIGH');
assert.equal(fuseCiiIdentityEvidence(m1NA, m2Pass, highOd, noName).confidence, 'HIGH', 'strong M2 + OD <10% can be HIGH when M1 is unavailable');
assert.equal(fuseCiiIdentityEvidence(m1NA, m2Medium, highOd, noName).confidence, 'MEDIUM', 'supported but non-strong M2 remains MEDIUM without other corroboration');
assert.equal(fuseCiiIdentityEvidence(m1Fail, m2Pass, highOd, nameMatch).confidence, 'MEDIUM');
assert.equal(fuseCiiIdentityEvidence(m1Pass, m2Fail, highOd, nameMatch).confidence, 'MEDIUM');
assert.equal(fuseCiiIdentityEvidence(m1Fail, m2Fail, highOd, nameMatch).confidence, 'UNRESOLVED', 'OD/name cannot establish identity alone');

function graph(side, id, odValue) {
  const document = {
    schema: 'CIIWorkspaceDocument.v1', side, contentSha256: id, nodeNames: {},
    parsed: { nodes: { 10: { x: 0, y: 0, z: 0 }, 20: { x: 1000, y: 0, z: 0 } }, rigids: [],
      elements: [{ from: 10, to: 20, dx: 1000, dy: 0, dz: 0, od: odValue, wall: 5.5 }] },
  };
  return adaptCiiDocumentToTopologyGraph(document);
}
const anchoredHigh = propagateSingleCiiAnchorCorrespondence(graph('SOURCE', 's-hi', 100), graph('TARGET', 't-hi', 105), { sourceNodeId: '10', targetNodeId: '10' });
assert.equal(anchoredHigh.status, 'READY');
assert.equal(anchoredHigh.elementRows[0].evidence.candidates.rankedCandidates[0].methods.m1Spatial.available, false);
assert.equal(anchoredHigh.elementRows[0].evidence.candidates.rankedCandidates[0].methods.m1Spatial.registrationStatus, 'UNDERDETERMINED');
assert.equal(anchoredHigh.elementRows[0].evidence.candidates.winnerIdentityConfidence, 'HIGH');
const anchoredReview = propagateSingleCiiAnchorCorrespondence(graph('SOURCE', 's-review', 100), graph('TARGET', 't-review', 160), { sourceNodeId: '10', targetNodeId: '10' });
assert.equal(anchoredReview.status, 'READY', 'OD >50% remains reviewable when network identity is unique');
assert.equal(anchoredReview.elementRows[0].status, 'REVIEW');
assert.equal(anchoredReview.elementRows[0].evidence.candidates.status, 'SUPPORTED');
assert.equal(anchoredReview.elementRows[0].evidence.candidates.winnerIdentityConfidence, 'REVIEW');

console.log('CII confidence bands / smart Node Name checks: PASS');
