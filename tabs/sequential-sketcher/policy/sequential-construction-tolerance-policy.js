import { stableToken } from '../sequential-sketcher-contract.js';

const RAW_POLICY = {
  schema: 'SequentialConstructionTolerancePolicy.v1',
  policyId: 'SEQUENTIAL_CONSTRUCTION_TOLERANCES',
  revision: 1,
  units: 'mm',
  exactEquivalence: {
    branchEndpointMm: 1,
    referenceBoundaryMm: 1,
    fittingPortMm: 1,
    transformNoiseMm: 0.001,
  },
  automaticRepair: {
    defaultMm: 25,
    maximumMm: 25,
  },
};

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export const SEQUENTIAL_CONSTRUCTION_TOLERANCE_POLICY = deepFreeze({
  ...RAW_POLICY,
  policyFingerprint: stableToken(JSON.stringify(RAW_POLICY)),
});

function nonNegativeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function firstNumber(...values) {
  for (const value of values) {
    const parsed = nonNegativeNumber(value);
    if (parsed !== null) return parsed;
  }
  return 0;
}

export function validateSequentialConstructionTolerancePolicy(
  policy = SEQUENTIAL_CONSTRUCTION_TOLERANCE_POLICY,
) {
  const errors = [];
  if (policy?.schema !== 'SequentialConstructionTolerancePolicy.v1') errors.push('POLICY_SCHEMA_INVALID');
  if (!String(policy?.policyId || '').trim()) errors.push('POLICY_ID_MISSING');
  if (!Number.isInteger(policy?.revision) || policy.revision < 1) errors.push('POLICY_REVISION_INVALID');
  if (policy?.units !== 'mm') errors.push('POLICY_UNITS_INVALID');
  for (const [name, value] of Object.entries(policy?.exactEquivalence || {})) {
    if (nonNegativeNumber(value) === null) errors.push(`EXACT_TOLERANCE_INVALID:${name}`);
  }
  const defaultRepair = nonNegativeNumber(policy?.automaticRepair?.defaultMm);
  const maximumRepair = nonNegativeNumber(policy?.automaticRepair?.maximumMm);
  if (defaultRepair === null) errors.push('REPAIR_DEFAULT_INVALID');
  if (maximumRepair === null) errors.push('REPAIR_MAXIMUM_INVALID');
  if (defaultRepair !== null && maximumRepair !== null && defaultRepair > maximumRepair) {
    errors.push('REPAIR_DEFAULT_EXCEEDS_MAXIMUM');
  }
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function resolveSequentialConstructionTolerances(options = {}) {
  const policy = SEQUENTIAL_CONSTRUCTION_TOLERANCE_POLICY;
  const legacyExact = nonNegativeNumber(options.exactToleranceMm);
  const branchEndpointMm = firstNumber(
    options.branchEndpointEquivalenceMm,
    legacyExact,
    policy.exactEquivalence.branchEndpointMm,
  );
  const referenceBoundaryMm = firstNumber(
    options.referenceBoundaryEquivalenceMm,
    options.externalBoundaryExactToleranceMm,
    legacyExact,
    policy.exactEquivalence.referenceBoundaryMm,
  );
  const fittingPortMm = firstNumber(
    options.fittingPortEquivalenceMm,
    legacyExact,
    policy.exactEquivalence.fittingPortMm,
  );
  const transformNoiseMm = firstNumber(
    options.transformNoiseMm,
    policy.exactEquivalence.transformNoiseMm,
  );
  const requestedRepairMm = firstNumber(
    options.autoRepairToleranceMm,
    policy.automaticRepair.defaultMm,
  );
  const automaticRepairMm = Math.min(requestedRepairMm, policy.automaticRepair.maximumMm);

  return Object.freeze({
    schema: 'SequentialResolvedToleranceSet.v1',
    policySchema: policy.schema,
    policyId: policy.policyId,
    policyRevision: policy.revision,
    policyFingerprint: policy.policyFingerprint,
    units: policy.units,
    branchEndpointMm,
    referenceBoundaryMm,
    fittingPortMm,
    transformNoiseMm,
    automaticRepairMm,
    automaticRepairMaximumMm: policy.automaticRepair.maximumMm,
  });
}
