import assert from 'node:assert/strict';
import { createCiiWriter2SessionSnapshot, ciiWriter2SessionPolicyMatches } from '../tabs/cii-workspace/cii-workspace-multisource-session-persistence.js';
import { ciiMultiSourceReviewMarkup } from '../tabs/cii-workspace/cii-workspace-multisource-review-ui.js';
import {
  CII_METHOD_A_CONFIDENCE_DEFAULTS,
  qualifyCiiGeometryTransform,
  resolveCiiMethodAConfidenceThresholds,
  validateCiiMethodAConfidenceThresholds,
} from '../tabs/cii-workspace/cii-workspace-geometry.js';
import {
  getCiiMultiSourceMethodAConfidenceOptions,
  setCiiMultiSourceMethodAConfidenceThresholds,
  _test as sourceSetTest,
} from '../tabs/cii-workspace/cii-workspace-source-set.js';

const point = (x, y, z) => ({ x, y, z });
const anchors = [[0, 0, 0], [10000, 0, 0], [2000, 800, 0]].map(([x, y, z]) => ({
  source: point(x, y, z), target: point(x + 50, y + 100, z), sourceOdMm: 100,
}));
const baseline = qualifyCiiGeometryTransform(anchors);
assert.equal(baseline.status, 'READY');
assert.equal(baseline.confidence, 'MEDIUM');
assert.deepEqual(baseline.weight.confidenceThresholds, { high: 85, medium: 70 });
assert(baseline.weight.total >= 75 && baseline.weight.total < 85);

const tuned = qualifyCiiGeometryTransform(anchors, { methodAHighConfidenceThreshold: 75 });
assert.equal(tuned.status, 'READY');
assert.equal(tuned.confidence, 'HIGH');
assert.equal(tuned.weight.total, baseline.weight.total, 'threshold must not change physical evidence');
assert.equal(tuned.weight.confidenceThresholds.high, 75);
assert.equal(tuned.maxNormalizedResidual, baseline.maxNormalizedResidual);
assert.deepEqual(resolveCiiMethodAConfidenceThresholds({
  methodAHighConfidenceThreshold: 60, methodAMediumConfidenceThreshold: 70,
}), CII_METHOD_A_CONFIDENCE_DEFAULTS, 'overlapping thresholds must fail closed');

const saved = getCiiMultiSourceMethodAConfidenceOptions();
try {
  const current = setCiiMultiSourceMethodAConfidenceThresholds({ high: 75, medium: 65 });
  assert.deepEqual(current, { high: 75, medium: 65 });
  const inspection = sourceSetTest.sourceSetInspectionOptions({ cryptoRef: 'test' });
  assert.equal(inspection.methodAHighConfidenceThreshold, 75);
  assert.equal(inspection.methodAMediumConfidenceThreshold, 65);
  assert.equal(sourceSetTest.sourceSetInspectionOptions({ methodAHighConfidenceThreshold: 90 }).methodAHighConfidenceThreshold, 90);
} finally {
  setCiiMultiSourceMethodAConfidenceThresholds({
    high: saved.methodAHighConfidenceThreshold, medium: saved.methodAMediumConfidenceThreshold,
  });
}
const reviewMarkup = ciiMultiSourceReviewMarkup({
  compareReview: { rows: [{
    correspondenceId: 'S1-4410-970', sourceId: 'S1', kind: 'NODE',
    source: '4410', target: '970', confidence: 'MEDIUM',
    identityBound: true, workflowStatus: 'REVIEW', decision: 'REVIEW',
    methodABase: { score: baseline.weight.total, anchorCount: 10,
      highThreshold: 85, mediumThreshold: 70,
      residualQuality: baseline.weight.residualQuality, conditioning: baseline.weight.conditioning,
      spatialExtent: baseline.weight.spatialExtent, redundancy: baseline.weight.redundancy,
      basisConsensus: baseline.weight.basisConsensus, weights: baseline.weight.confidenceWeights },
  }] },
}, new Map());
assert.match(reviewMarkup, /METHOD A BASE/);
assert.match(reviewMarkup, /HIGH ≥ 85/);
assert.match(reviewMarkup, /residual/);
assert.match(reviewMarkup, /Applied weightage: 35 \/ 25 \/ 20 \/ 10 \/ 10/, 'visible review must show actual applied score weights');
assert.doesNotMatch(reviewMarkup, /RED · 0\/0/, 'missing direct M1\/M2 evidence must not obscure qualified Method A score');


// P201-P205/P207: reject invalid interactive policy atomically; changing policy
// must not reuse accepted review decisions or the previous Writer2 scope.
for (const invalid of [
  { high: '', medium: 70 }, { high: Number.NaN, medium: 70 },
  { high: 101, medium: 70 }, { high: 70, medium: 70 },
  { high: 69, medium: 70 }, { high: 85, medium: -1 },
]) {
  assert.throws(() => validateCiiMethodAConfidenceThresholds(invalid), /METHOD_A_CONFIDENCE_THRESHOLDS_INVALID/);
}
assert.deepEqual(validateCiiMethodAConfidenceThresholds({ high: 100, medium: 0 }), { high: 100, medium: 0 });
const impossible = qualifyCiiGeometryTransform(
  anchors.map((pair, index) => index === 2 ? {
    ...pair, target: point(pair.target.x + 50000, pair.target.y, pair.target.z),
  } : pair), { methodAHighConfidenceThreshold: 1, methodAMediumConfidenceThreshold: 0 },
);
assert.notEqual(impossible.status, 'READY', 'confidence policy must never legalize incompatible geometry');

const storedPolicy = { methodAHighConfidenceThreshold: 75, methodAMediumConfidenceThreshold: 65 };
const savedSnapshot = createCiiWriter2SessionSnapshot({
  sourceSetSha256: 'a'.repeat(64),
  targetOriginalSha256: 'b'.repeat(64),
  confidencePolicy: storedPolicy,
  reviewDecisions: new Map([['corr-1', 'ACCEPT']]),
});
assert.deepEqual(savedSnapshot.confidencePolicy, { high: 75, medium: 65, weights: getCiiMultiSourceMethodAConfidenceOptions().methodAConfidenceWeights });
assert.equal(ciiWriter2SessionPolicyMatches(savedSnapshot, storedPolicy), true);
assert.equal(ciiWriter2SessionPolicyMatches(savedSnapshot, {
  methodAHighConfidenceThreshold: 85, methodAMediumConfidenceThreshold: 70,
}), false, 'mismatched policy cannot restore saved approvals');
assert.equal(ciiWriter2SessionPolicyMatches({ ...savedSnapshot, confidencePolicy: undefined }, storedPolicy), false,
  'legacy sessions without policy custody must fail closed');

console.log('CII Method A configurable confidence thresholds: PASS');
