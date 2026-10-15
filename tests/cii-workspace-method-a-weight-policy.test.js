import assert from 'node:assert/strict';
import {
  CII_METHOD_A_WEIGHT_DEFAULTS, CII_METHOD_A_WEIGHT_KEYS,
  validateCiiMethodAConfidenceWeights,
} from '../tabs/cii-workspace/cii-workspace-method-a-weights.js';
import { qualifyCiiGeometryTransform } from '../tabs/cii-workspace/cii-workspace-geometry.js';
import {
  getCiiMultiSourceMethodAConfidenceOptions, setCiiMultiSourceMethodAConfidenceWeights,
  _test as sourceSet,
} from '../tabs/cii-workspace/cii-workspace-source-set.js';
import {
  createCiiWriter2SessionSnapshot, ciiWriter2SessionPolicyMatches,
} from '../tabs/cii-workspace/cii-workspace-multisource-session-persistence.js';

const defaults = CII_METHOD_A_WEIGHT_DEFAULTS;
assert.deepEqual(Object.values(defaults), [35, 25, 20, 10, 10]);
assert.equal(CII_METHOD_A_WEIGHT_KEYS.length, 5);
const changed = { ...defaults, residualQuality: 40, conditioning: 20 };
assert.deepEqual(validateCiiMethodAConfidenceWeights(changed), changed);
for (const invalid of [
  null, {}, { ...defaults, residualQuality: 50 }, { ...defaults, residualQuality: -5, conditioning: 65 },
  { ...defaults, residualQuality: '' }, { ...defaults, residualQuality: Number.NaN },
  { ...defaults, residualQuality: Number.POSITIVE_INFINITY }, { ...defaults, unknown: 0 },
  { ...defaults, conditioning: undefined }, [35, 25, 20, 10, 10],
]) {
  assert.throws(() => validateCiiMethodAConfidenceWeights(invalid), /METHOD_A_CONFIDENCE_WEIGHTS_INVALID/);
}

const pt = (x, y, z) => ({ x, y, z });
const anchors = [[0, 0, 0], [10000, 0, 0], [2000, 800, 0]].map(([x, y, z]) => ({
  source: pt(x, y, z), target: pt(x + 50, y + 100, z), sourceOdMm: 100,
}));
const base = qualifyCiiGeometryTransform(anchors);
const explicitDefault = qualifyCiiGeometryTransform(anchors, { methodAConfidenceWeights: defaults });
assert.equal(base.status, 'READY');
assert.equal(base.weight.total, explicitDefault.weight.total, 'default score parity is non-negotiable');
assert.equal(base.confidence, explicitDefault.confidence, 'default grade parity');
assert.deepEqual(explicitDefault.weight.confidenceWeights, defaults);
const tuned = qualifyCiiGeometryTransform(anchors, { methodAConfidenceWeights: changed });
assert.equal(tuned.status, 'READY');
assert.notEqual(tuned.weight.total, base.weight.total, 'tuning changes the score for qualified geometry');
assert.deepEqual(tuned.weight.confidenceWeights, changed);
assert.equal(tuned.maxNormalizedResidual, base.maxNormalizedResidual, 'weights cannot change registration residual');
assert.deepEqual(tuned.rotation, base.rotation, 'weights cannot change the physical transform');
const components = ['residualQuality', 'conditioning', 'spatialExtent', 'redundancy', 'basisConsensus'];
assert(Math.abs(components.reduce((sum, key) => sum + tuned.weight[key], 0) - tuned.weight.total) <= 0.003);
const impossible = qualifyCiiGeometryTransform(
  anchors.map((pair, i) => i === 2 ? { ...pair, target: pt(50000, 50000, 0) } : pair),
  { methodAConfidenceWeights: { residualQuality: 0, conditioning: 0, spatialExtent: 0, redundancy: 0, basisConsensus: 100 } },
);
assert.notEqual(impossible.status, 'READY', 'no weight profile can bypass incompatible geometry');

const saved = getCiiMultiSourceMethodAConfidenceOptions();
try {
  setCiiMultiSourceMethodAConfidenceWeights(changed);
  assert.deepEqual(getCiiMultiSourceMethodAConfidenceOptions().methodAConfidenceWeights, changed);
  assert.deepEqual(sourceSet.sourceSetInspectionOptions({}).methodAConfidenceWeights, changed);
  assert.deepEqual(sourceSet.sourceSetInspectionOptions({ methodAConfidenceWeights: defaults }).methodAConfidenceWeights, defaults);
  assert.throws(() => setCiiMultiSourceMethodAConfidenceWeights({ ...changed, residualQuality: 101 }),
    /METHOD_A_CONFIDENCE_WEIGHTS_INVALID/);
  assert.deepEqual(getCiiMultiSourceMethodAConfidenceOptions().methodAConfidenceWeights, changed,
    'invalid settings must not change the current effective profile');
  const policy = getCiiMultiSourceMethodAConfidenceOptions();
  const snapshot = createCiiWriter2SessionSnapshot({
    sourceSetSha256: 'a'.repeat(64), targetOriginalSha256: 'b'.repeat(64),
    confidencePolicy: policy, reviewDecisions: { 'corr-1': 'ACCEPT' },
  });
  assert.deepEqual(snapshot.confidencePolicy.weights, changed);
  assert.equal(ciiWriter2SessionPolicyMatches(snapshot, policy), true);
  assert.equal(ciiWriter2SessionPolicyMatches(snapshot, { ...policy, methodAConfidenceWeights: defaults }), false,
    'changed weights must invalidate restored decisions even if HIGH/MEDIUM thresholds did not change');
  assert.equal(ciiWriter2SessionPolicyMatches({ ...snapshot,
    confidencePolicy: { high: 85, medium: 70 } }, policy), false,
  'legacy saved sessions without weight custody cannot restore approvals');
} finally {
  setCiiMultiSourceMethodAConfidenceWeights(saved.methodAConfidenceWeights);
}
console.log('CII Method A validated 100-point score weights and policy custody: PASS');
