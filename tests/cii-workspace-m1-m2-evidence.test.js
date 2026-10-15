import assert from 'assert';

import { ciiAlignmentScore, scoreCiiEdgeCandidate } from '../tabs/cii-workspace/cii-workspace-evidence.js';
import { buildCiiCandidateEvidence } from '../tabs/cii-workspace/cii-workspace-candidates.js';
import { evaluateCiiMatchMethods } from '../tabs/cii-workspace/cii-workspace-match-methods.js';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';

function context(degree = 2, layers = [['D2->D2|PIPE']]) {
  return { degree, neighbourhoodLayers: layers, sizeTransition: false };
}
function edge(id, options = {}) {
  const midpoint = options.midpoint || { x: 0, y: 0, z: 0 };
  const half = Number(options.halfLength ?? 500);
  return {
    elementId: id,
    componentKind: options.componentKind || 'PIPE',
    lengthMm: Number(options.lengthMm ?? 1000),
    diameter: Number(options.diameter ?? 88.9),
    wall: Number(options.wall ?? 5.5),
    fromPos: options.noPosition ? null : { x: midpoint.x - half, y: midpoint.y, z: midpoint.z },
    toPos: options.noPosition ? null : { x: midpoint.x + half, y: midpoint.y, z: midpoint.z },
    fromContext: options.fromContext || context(),
    toContext: options.toContext || context(),
    pathSequenceContext: options.pathSequenceContext || ['PIPE', 'PIPE', 'PIPE'],
  };
}

// M1 must use Euclidean distance. Independent ±100 mm axis boxes would
// incorrectly accept this 90/90/90 displacement; radial distance is ~155.9 mm.
{
  const source = edge('S-diagonal');
  const target = edge('T-diagonal', { midpoint: { x: 90, y: 90, z: 90 } });
  const evaluation = evaluateCiiMatchMethods(source, target, { spatialToleranceMm: 100 });
  assert(evaluation.m1Spatial.distanceMm > 155 && evaluation.m1Spatial.distanceMm < 157);
  assert.strictEqual(evaluation.m1Spatial.pass, false);
}

// Node-205 concept: location moves beyond M1 tolerance while network identity
// and OD/WT remain compatible. Identity is retained as MEDIUM, not lost.
{
  const source = edge('S-205');
  const target = edge('T-20205', { midpoint: { x: 200, y: 0, z: 0 } });
  const evidence = scoreCiiEdgeCandidate(source, target, { spatialToleranceMm: 100 });
  assert.strictEqual(evidence.methods.m1Spatial.pass, false);
  assert.strictEqual(evidence.methods.m2Network.pass, true);
  assert.strictEqual(evidence.dimensions.diameter.pass, true);
  assert.strictEqual(evidence.dimensions.wall.pass, true);
  assert.strictEqual(evidence.identityConfidence, 'MEDIUM');
  assert.strictEqual(evidence.hardFail, false);
}

// 250-series concept: topology/location can identify the same gang even when
// OD changes above 50% are explicit REVIEW while the M1/M2-supported pair
// remains identity-supported and reviewable. Wall remains downstream delta evidence.
{
  const source = edge('S-250', { diameter: 60.3, wall: 3.9 });
  const target = edge('T-20250', { diameter: 114.3, wall: 4.7752 });
  const evidence = scoreCiiEdgeCandidate(source, target, {
    diameterRelativeTolerance: 0.10,
    wallRelativeTolerance: 0.10,
  });
  assert.strictEqual(evidence.methods.m1Spatial.pass, true);
  assert.strictEqual(evidence.methods.m2Network.pass, true);
  assert.strictEqual(evidence.dimensions.diameter.pass, false);
  assert.strictEqual(evidence.dimensions.wall.pass, false);
  assert.strictEqual(evidence.identityConfidence, 'REVIEW');
  assert.strictEqual(evidence.odConfidence.confidence, 'REVIEW');
  assert.strictEqual(evidence.hardFail, false);
  assert(evidence.score >= 62 && evidence.score < 63);
}

// Same dimensions alone can never establish identity.
{
  const source = edge('S-no-id', { fromContext: context(2), toContext: context(2) });
  const target = edge('T-no-id', {
    midpoint: { x: 500, y: 0, z: 0 },
    fromContext: context(3), toContext: context(3),
  });
  const evidence = scoreCiiEdgeCandidate(source, target, { spatialToleranceMm: 100 });
  assert.strictEqual(evidence.dimensions.diameter.pass, true);
  assert.strictEqual(evidence.dimensions.wall.pass, true);
  assert.strictEqual(evidence.methods.m1Spatial.pass, false);
  assert.strictEqual(evidence.methods.m2Network.pass, false);
  assert.strictEqual(evidence.identityConfidence, 'UNRESOLVED');
  assert.strictEqual(evidence.hardFail, true);
  assert.strictEqual(evidence.score, 0);
  assert.strictEqual(evidence.rankingScore, 0);
}

// M2 must not double-count OD through neighbourhood tokens. Legacy-style
// tokens containing different OD values are normalized before comparison.
{
  const sourceLayers = [['D2->D2|PIPE|OD60.3'], ['D2->D2|PIPE|OD60.3']];
  const targetLayers = [['D2->D2|PIPE|OD114.3'], ['D2->D2|PIPE|OD114.3']];
  const source = edge('S-token', { diameter: 60.3, fromContext: context(2, sourceLayers), toContext: context(2, sourceLayers) });
  const target = edge('T-token', { diameter: 114.3, fromContext: context(2, targetLayers), toContext: context(2, targetLayers) });
  const evidence = scoreCiiEdgeCandidate(source, target);
  assert.strictEqual(evidence.methods.m2Network.pass, true);
  assert(evidence.components.neighbourhood > 24);
}

// Production topology-adapter tokens themselves must no longer contain OD/WT.
{
  const document = {
    schema: 'CIIWorkspaceDocument.v1', side: 'SOURCE', contentSha256: 'x', nodeNames: {},
    parsed: {
      rigids: [],
      nodes: { 10: { x: 0, y: 0, z: 0 }, 20: { x: 1000, y: 0, z: 0 }, 30: { x: 2000, y: 0, z: 0 } },
      elements: [
        { from: 10, to: 20, dx: 1000, dy: 0, dz: 0, od: 60.3, wall: 3.9 },
        { from: 20, to: 30, dx: 1000, dy: 0, dz: 0, od: 114.3, wall: 4.7752 },
      ],
    },
  };
  const graph = adaptCiiDocumentToTopologyGraph(document);
  const tokens = graph.nodes.flatMap((node) => node.neighbourhoodLayers.flat());
  assert(tokens.length > 0);
  assert(tokens.every((token) => !/\|OD|\|WT/i.test(token)));
}

// Confidence scoring retains identity+OD weighting, while path
// ranking retains method quality so repeated network regions do not tie.
{
  const sourceLayers = [
    ['D2->D2|PIPE|OD273'],
    ['D2->D2|PIPE|OD273'],
    ['D2->D3|PIPE|OD273', 'D3->D1|PIPE|OD114'],
  ];
  const wrongLayers = [
    ['D2->D2|PIPE|OD273'],
    ['D2->D2|PIPE|OD273'],
    ['D2->D2|PIPE|OD273', 'D2->D2|RIGID|OD219'],
  ];
  const source = edge('S-rank', { noPosition: true, diameter: 273, wall: 8, fromContext: context(2, sourceLayers), toContext: context(2, sourceLayers) });
  const correct = edge('T-rank-correct', { noPosition: true, diameter: 273, wall: 8, fromContext: context(2, sourceLayers), toContext: context(2, sourceLayers) });
  const wrong = edge('T-rank-wrong', { noPosition: true, diameter: 273, wall: 8, fromContext: context(2, wrongLayers), toContext: context(2, wrongLayers) });
  const correctEvidence = scoreCiiEdgeCandidate(source, correct);
  const wrongEvidence = scoreCiiEdgeCandidate(source, wrong);
  assert.strictEqual(correctEvidence.score, 100);
  assert.strictEqual(wrongEvidence.score, 100);
  assert(correctEvidence.methods.m2Network.score > wrongEvidence.methods.m2Network.score);
  assert(correctEvidence.rankingScore > wrongEvidence.rankingScore);
  assert.strictEqual(ciiAlignmentScore(source, correct), correctEvidence.rankingScore);
  assert.strictEqual(ciiAlignmentScore(source, wrong), wrongEvidence.rankingScore);
}

// M1 and M2 choose independently. If they select different target elements,
// the result is review-required even when each method is individually strong.
{
  const source = edge('S-disagree');
  const spatialOnly = edge('T-spatial', {
    fromContext: context(3), toContext: context(3),
  });
  const networkOnly = edge('T-network', {
    midpoint: { x: 200, y: 0, z: 0 },
  });
  const candidates = buildCiiCandidateEvidence(source, [spatialOnly, networkOnly], spatialOnly.elementId, {
    spatialToleranceMm: 100,
    winnerGap: 0,
  });
  assert.strictEqual(candidates.methodWinners.m1Spatial, spatialOnly.elementId);
  assert.strictEqual(candidates.methodWinners.m2Network, networkOnly.elementId);
  assert.strictEqual(candidates.methodWinners.disagree, true);
  assert.strictEqual(candidates.status, 'AMBIGUOUS');
  assert(candidates.reasons.includes('METHOD_A_B_DISAGREE'));
}

console.log('CII M1 Spatial / M2 Network evidence checks passed.');
