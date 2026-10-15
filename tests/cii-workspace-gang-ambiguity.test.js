import assert from 'assert';
import { buildCiiCandidateEvidence } from '../tabs/cii-workspace/cii-workspace-candidates.js';

function context(degree, layers, sizeTransition = false) {
  return { degree, neighbourhoodLayers: layers, sizeTransition };
}
function straight(id, downstream, lengthMm = 1000) {
  return {
    elementId: id, componentKind: 'PIPE', lengthMm, diameter: 273, wall: 8,
    pathSequenceContext: ['PIPE', 'PIPE', 'PIPE'],
    fromContext: context(2, [
      ['D2->D2|PIPE|OD273'], ['D2->D2|PIPE|OD273'], downstream,
    ]),
    toContext: context(2, [
      ['D2->D2|PIPE|OD273'], ['D2->D2|PIPE|OD273'], downstream,
    ]),
  };
}

// Both regions are locally identical three-straight runs. Only 3-hop context differs:
// the correct region reaches tee context; the wrong region reaches reducer + rigid context.
const source = straight('S-middle', ['D2->D3|PIPE|OD273', 'D3->D1|PIPE|OD114']);
const correct = straight('T-tee-region', ['D2->D3|PIPE|OD273', 'D3->D1|PIPE|OD114']);
const wrong = straight('T-reducer-rigid-region', ['D2->D2|PIPE|OD273', 'D2->D2|RIGID|OD219']);
const evidence = buildCiiCandidateEvidence(source, [wrong, correct], correct.elementId, { lengthToleranceMm: 25, winnerGap: 2 });
assert.strictEqual(evidence.status, 'SUPPORTED');
assert.strictEqual(evidence.winnerTargetElementId, correct.elementId);
assert(evidence.winnerGap >= 2);
assert.strictEqual(evidence.rankedCandidates.length, 2, 'top alternatives must be audit-visible');
assert(evidence.rankedCandidates[0].components.neighbourhood > evidence.rankedCandidates[1].components.neighbourhood);

// If wider context cannot separate two otherwise identical regions, retain ambiguity.
const twin = straight('T-second-tee-region', ['D2->D3|PIPE|OD273', 'D3->D1|PIPE|OD114']);
const ambiguous = buildCiiCandidateEvidence(source, [correct, twin], correct.elementId, { lengthToleranceMm: 25, winnerGap: 2 });
assert.strictEqual(ambiguous.status, 'AMBIGUOUS');
assert(ambiguous.reasons.includes('WINNER_GAP_NOT_SATISFIED'));
assert.strictEqual(ambiguous.rankedCandidates.length, 2);
console.log('CII Workspace gang-of-nodes winner-gap checks passed.');
