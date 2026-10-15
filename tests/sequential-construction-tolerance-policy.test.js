import assert from 'node:assert/strict';
import { stableToken } from '../tabs/sequential-sketcher/sequential-sketcher-contract.js';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { resolveBoundaryReference } from '../tabs/sequential-sketcher/construction/sequential-boundary-resolver.js';
import {
  SEQUENTIAL_CONSTRUCTION_TOLERANCE_POLICY,
  resolveSequentialConstructionTolerances,
  validateSequentialConstructionTolerancePolicy,
} from '../tabs/sequential-sketcher/policy/sequential-construction-tolerance-policy.js';

const policy = SEQUENTIAL_CONSTRUCTION_TOLERANCE_POLICY;
assert.equal(policy.schema, 'SequentialConstructionTolerancePolicy.v1');
assert.equal(policy.policyId, 'SEQUENTIAL_CONSTRUCTION_TOLERANCES');
assert.equal(policy.revision, 1);
assert.equal(policy.units, 'mm');
assert.equal(Object.isFrozen(policy), true);
assert.equal(validateSequentialConstructionTolerancePolicy(policy).valid, true);
const fingerprintInput = {
  schema: policy.schema,
  policyId: policy.policyId,
  revision: policy.revision,
  units: policy.units,
  exactEquivalence: policy.exactEquivalence,
  automaticRepair: policy.automaticRepair,
};
assert.equal(policy.policyFingerprint, stableToken(JSON.stringify(fingerprintInput)));

const defaults = resolveSequentialConstructionTolerances();
assert.equal(defaults.branchEndpointMm, 1);
assert.equal(defaults.referenceBoundaryMm, 1);
assert.equal(defaults.fittingPortMm, 1);
assert.equal(defaults.transformNoiseMm, 0.001);
assert.equal(defaults.automaticRepairMm, 25);

const legacy = resolveSequentialConstructionTolerances({ exactToleranceMm: 2 });
assert.equal(legacy.branchEndpointMm, 2);
assert.equal(legacy.referenceBoundaryMm, 2);
assert.equal(legacy.fittingPortMm, 2);
assert.equal(legacy.transformNoiseMm, 0.001, 'legacy exact override must not widen transform-noise equivalence');

const separated = resolveSequentialConstructionTolerances({
  exactToleranceMm: 2,
  branchEndpointEquivalenceMm: 0.5,
  referenceBoundaryEquivalenceMm: 0.25,
  fittingPortEquivalenceMm: 0.1,
  transformNoiseMm: 0.0001,
  autoRepairToleranceMm: 80,
});
assert.equal(separated.branchEndpointMm, 0.5);
assert.equal(separated.referenceBoundaryMm, 0.25);
assert.equal(separated.fittingPortMm, 0.1);
assert.equal(separated.transformNoiseMm, 0.0001);
assert.equal(separated.automaticRepairMm, 25, 'automatic repair must remain capped at 25 mm');

function pipe(name, start, end) {
  return { type: 'PIPE', name, attributes: { APOS: start, LPOS: end } };
}
function branch(name, attributes, children) {
  return { type: 'BRANCH', name, attributes: { NAME: name, ...attributes }, children };
}

{
  const target = '/TARGET';
  const root = '/ROOT';
  const records = [
    branch(root, { HPOS: { x: 100, y: 0, z: 0 } }, [
      pipe('ROOT-P1', { x: 100, y: 0, z: 0 }, { x: 200, y: 0, z: 0 }),
    ]),
    branch(target, { HPOS: { x: 100.5, y: 0, z: 0 } }, [
      pipe('TARGET-P1', { x: 100.5, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
    ]),
  ];
  const evidence = buildSequentialEvidenceModel(records);
  const indexes = indexSequentialEvidence(evidence);
  const connectedPort = indexes.branches.get(root).components[0].ports.find((port) => port.sourcePosition?.x === 100);
  const accepted = resolveBoundaryReference({
    boundaryRole: 'HEAD',
    boundaryPosition: { x: 100, y: 0, z: 0 },
    referenceValue: target,
    connectedPort,
    indexes,
    exactToleranceMm: 2,
    referenceBoundaryEquivalenceMm: 1,
  });
  assert.equal(accepted.status, 'CONFIRMED_REFERENCE');
  assert.equal(accepted.exactToleranceMm, 1);
  assert.equal(accepted.toleranceEvidenceType, 'REFERENCE_BOUNDARY_EQUIVALENCE');
  assert.equal(accepted.tolerancePolicyFingerprint, policy.policyFingerprint);

  const repaired = resolveBoundaryReference({
    boundaryRole: 'HEAD',
    boundaryPosition: { x: 100, y: 0, z: 0 },
    referenceValue: target,
    connectedPort,
    indexes,
    exactToleranceMm: 2,
    referenceBoundaryEquivalenceMm: 0.1,
  });
  assert.equal(repaired.status, 'AUTO_REPAIRED_SMALL_GAP');
  assert.equal(repaired.exactToleranceMm, 0.1);
}

{
  const root = '/EXTERNAL-BOUNDARY';
  const records = [branch(root, {
    HPOS: { x: 0, y: 0, z: 0 },
    TPOS: { x: 100.5, y: 0, z: 0 },
    TREF: '/A-881149-TP-04',
  }, [pipe('P1', { x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 })])];
  const evidence = buildSequentialEvidenceModel(records);
  const indexes = indexSequentialEvidence(evidence);
  const accepted = runConstructionUntilBlocked(
    createSequentialConstructionSession(root), evidence, indexes,
    { exactToleranceMm: 0.1, referenceBoundaryEquivalenceMm: 1 },
  );
  assert.equal(accepted.session.state, 'ROUTE_COMPLETE');
  const classification = accepted.session.boundaryClassifications[0];
  assert.equal(classification.exactBoundaryToleranceMm, 1);
  assert.equal(classification.toleranceEvidenceType, 'REFERENCE_BOUNDARY_EQUIVALENCE');
  assert.equal(classification.tolerancePolicyId, policy.policyId);
  assert.equal(classification.tolerancePolicyFingerprint, policy.policyFingerprint);

  const blocked = runConstructionUntilBlocked(
    createSequentialConstructionSession(root), evidence, indexes,
    { exactToleranceMm: 2, referenceBoundaryEquivalenceMm: 0.1 },
  );
  assert.equal(blocked.session.state, 'USER_DECISION_REQUIRED');
  assert.equal(blocked.session.currentDecisionRequest.reason, 'EXTERNAL_BOUNDARY_POSITION_MISMATCH');
  assert.equal(blocked.session.currentDecisionRequest.externalReferenceClassification.exactBoundaryToleranceMm, 0.1);
}

console.log('sequential construction tolerance policy tests passed');
