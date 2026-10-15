import assert from 'node:assert/strict';
import { ciiAutomaticBaseSelection } from '../tabs/cii-workspace/cii-workspace-base-loop-selection.js';
import {
  ciiForensicSelectedBaseEvidence, ciiForensicRowObservations,
} from './cii-workspace-method-a-forensic-selection.js';

// Score-grading weights can change auto-selection order, but cannot create a
// qualified candidate from REVIEW_DISCOVERY_ONLY or failed Method A admission.
const anchorPairs = [
  { sourceNodeId: '100', targetNodeId: '500' },
  { sourceNodeId: '110', targetNodeId: '510' },
  { sourceNodeId: '120', targetNodeId: '520' },
];
function suggestion(sourceNodeId, targetNodeId, baseId, total, extras = {}) {
  const base = {
    baseId, status: 'READY', confidence: 'MEDIUM', anchorPairs,
    anchorCount: 3, selectedBasisId: 'BASIS_0', minimumAnchorSinAngle: 0.9,
    maxResidualMm: 0.2, maxNormalizedResidual: 0.01, rmsNormalizedResidual: 0.008,
    weight: {
      total, residualQuality: total - 65, conditioning: 25, spatialExtent: 20,
      redundancy: 10, basisConsensus: 10,
      confidenceWeights: { residualQuality: 35, conditioning: 25, spatialExtent: 20, redundancy: 10, basisConsensus: 10 },
      confidenceThresholds: { high: 85, medium: 70 },
    },
  };
  return {
    sourceNodeId, targetNodeId,
    confidence: 'MEDIUM', basisMethod: 'METHOD_A_SPATIAL',
    methodA: { status: 'READY', confidence: 'MEDIUM', bestBase: base, bases: [base] },
    winnerGap: 3, score: 75, ...extras,
  };
}
const rowA = suggestion('1', '10', 'BASE_A', 78);
const rowB = suggestion('2', '20', 'BASE_B', 81);
const first = ciiAutomaticBaseSelection([rowA, rowB]);
assert.equal(first.status, 'READY');
assert.equal(first.sourceNodeId, '2');
assert.equal(first.baseLoops[0].baseId, 'BASE_B');
assert.equal(first.baseLoops[0].weight, undefined, 'selector returns descriptors, never score evidence');
const originalEvidence = ciiForensicSelectedBaseEvidence([rowA, rowB], first);
assert.equal(originalEvidence.length, 1);
assert.equal(originalEvidence[0].evidenceStatus, 'READY');
assert.equal(originalEvidence[0].score, 81);
assert.equal(originalEvidence[0].confidence, 'MEDIUM');
assert.deepEqual(originalEvidence[0].components, {
  residualQuality: 16, conditioning: 25, spatialExtent: 20, redundancy: 10, basisConsensus: 10,
});
assert.equal(originalEvidence[0].thresholds.high, 85);
assert.equal(originalEvidence[0].weights.residualQuality, 35);
assert.equal(originalEvidence[0].selectedBasisId, 'BASIS_0');

// Two independently qualified topology bases reverse rank when their scores
// are independently recomputed under an alternative valid 100-point profile.
// This MUST be reported as potential topology drift, not only a label change.
const weightedA = suggestion('1', '10', 'BASE_A', 82);
const weightedB = suggestion('2', '20', 'BASE_B', 77);
const tuned = ciiAutomaticBaseSelection([weightedA, weightedB]);
assert.equal(tuned.status, 'READY');
assert.equal(tuned.sourceNodeId, '1');
assert.notEqual(tuned.baseLoops[0].baseId, first.baseLoops[0].baseId);
assert.equal(ciiForensicSelectedBaseEvidence([weightedA, weightedB], tuned)[0].score, 82);

// Identical evidence tuple but incompatible base topology is a REVIEW veto,
// not an arbitrary tie-breaker to manufacture a winner.
const tied = ciiAutomaticBaseSelection([
  suggestion('1', '10', 'BASE_A', 80), suggestion('2', '20', 'BASE_B', 80),
]);
assert.equal(tied.status, 'AMBIGUOUS');
assert.equal(tied.reason, 'EQUALLY_STRONG_DIFFERENT_TOPOLOGY_OUTCOMES');
assert.equal(tied.baseLoops.length, 0);

const discoveryOnly = ciiAutomaticBaseSelection([
  suggestion('1', '10', 'DISCOVERY_ONLY', 100, {
    confidence: 'HIGH',
    candidateGeneration: { authorityRole: 'REVIEW_DISCOVERY_ONLY_NOT_IDENTITY_AUTHORITY' },
  }),
]);
assert.equal(discoveryOnly.status, 'REVIEW_REQUIRED');
assert.equal(discoveryOnly.baseLoops.length, 0);
const invalidMethodA = ciiAutomaticBaseSelection([
  suggestion('1', '10', 'UNQUALIFIED', 100, {
    confidence: 'HIGH', methodA: { status: 'UNAVAILABLE', bestBase: null },
  }),
]);
assert.equal(invalidMethodA.status, 'REVIEW_REQUIRED');
const lostEvidence = ciiForensicSelectedBaseEvidence([], first);
assert.equal(lostEvidence[0].evidenceStatus, 'MISSING_SELECTED_QUALIFICATION');
assert.equal(lostEvidence[0].score, null);

const previews = {
  memberPreviews: [{
    sourceId: 'S1',
    preview: {
      correspondence: { nodeRows: [
        { correspondenceId: 'node:A', kind: 'NODE', status: 'REVIEW', authority: 'MULTI_BASE_LOOP',
          sourceNodeId: '1', targetNodeId: '10', basisMethod: 'METHOD_A_SPATIAL',
          evidence: { identitySupported: true, identityConfidence: 'MEDIUM' } },
      ] },
      compareReview: { rows: [{
        correspondenceId: 'node:A', kind: 'NODE', source: '1', target: '10', confidence: 'MEDIUM',
        identityBound: true, authority: 'MULTI_BASE_LOOP', workflowStatus: 'REVIEW', decision: 'REVIEW',
      }] },
    },
  }],
  correspondence: { nodeRows: [] },
};
const observed = ciiForensicRowObservations(previews, [
  ['S1', '1', '10', 'HIGH'], ['S1', '3', '30', 'HIGH'],
]);
assert.equal(observed.length, 2);
assert.equal(observed[0].status, 'EMITTED');
assert.equal(observed[0].emittedRowCount, 1);
assert.equal(observed[0].reviewRowCount, 1);
assert.equal(observed[0].review[0].confidence, 'MEDIUM');
assert.equal(observed[0].review[0].identityBound, true);
assert.equal(observed[0].observed[0].evidenceBasis, null);
assert.equal(observed[1].status, 'NOT_EMITTED');
assert.deepEqual(observed[1].review, []);
assert.deepEqual(observed[1].observed, []);
console.log('CII forensic selected-base provenance and weight-driven selection controls: PASS');
