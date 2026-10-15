// Method A confidence grade weights are score points, not geometry-admission
// tolerances. An explicit policy must cover all five terms and total 100.
// Neither writer nor physical-node identity may use these as authority.
export const CII_METHOD_A_WEIGHT_KEYS = Object.freeze([
  'residualQuality', 'conditioning', 'spatialExtent', 'redundancy', 'basisConsensus',
]);

export const CII_METHOD_A_WEIGHT_DEFAULTS = Object.freeze({
  residualQuality: 35,
  conditioning: 25,
  spatialExtent: 20,
  redundancy: 10,
  basisConsensus: 10,
});

export function validateCiiMethodAConfidenceWeights(weights) {
  if (!weights || typeof weights !== 'object' || Array.isArray(weights)) {
    throw new RangeError('METHOD_A_CONFIDENCE_WEIGHTS_INVALID: five weights must total 100');
  }
  const keys = Object.keys(weights);
  if (keys.length !== CII_METHOD_A_WEIGHT_KEYS.length
    || keys.some((key) => !CII_METHOD_A_WEIGHT_KEYS.includes(key))) {
    throw new RangeError('METHOD_A_CONFIDENCE_WEIGHTS_INVALID: expected all five named weights');
  }
  const result = {};
  for (const key of CII_METHOD_A_WEIGHT_KEYS) {
    const raw = weights[key];
    const value = Number(raw);
    if (raw == null || String(raw).trim() === '' || !Number.isFinite(value)
      || value < 0 || value > 100) {
      throw new RangeError('METHOD_A_CONFIDENCE_WEIGHTS_INVALID: each weight must be 0–100');
    }
    result[key] = value;
  }
  const sum = CII_METHOD_A_WEIGHT_KEYS.reduce((total, key) => total + result[key], 0);
  if (Math.abs(sum - 100) > 1e-7) {
    throw new RangeError('METHOD_A_CONFIDENCE_WEIGHTS_INVALID: five weights must total 100');
  }
  return Object.freeze(result);
}

export function resolveCiiMethodAConfidenceWeights(options = {}) {
  return options.methodAConfidenceWeights == null
    ? CII_METHOD_A_WEIGHT_DEFAULTS
    : validateCiiMethodAConfidenceWeights(options.methodAConfidenceWeights);
}
