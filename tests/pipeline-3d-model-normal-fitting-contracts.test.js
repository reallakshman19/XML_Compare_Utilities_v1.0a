import assert from 'node:assert/strict';
import {
  PIPELINE_NORMAL_FITTING_POLICY_REGISTRY,
  PIPELINE_NORMAL_FITTING_POLICY_IDS,
  createPipelineNormalFittingPlan,
  createPipelineNormalFittingResolution,
  getPipelineNormalFittingPolicy,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-normal-fitting-contracts.js';

assert.equal(PIPELINE_NORMAL_FITTING_POLICY_REGISTRY.ready, true);
assert.deepEqual(PIPELINE_NORMAL_FITTING_POLICY_REGISTRY.descriptors.map((item) => item.fittingPolicyId),
  ['normal-standard-elbow', 'normal-explicit-radius-bend']);
assert.equal(getPipelineNormalFittingPolicy('NORMAL-STANDARD-ELBOW'), null);
assert.equal(getPipelineNormalFittingPolicy(PIPELINE_NORMAL_FITTING_POLICY_IDS.STANDARD_ELBOW).fittingKind, 'STANDARD_ELBOW');

const base = {
  candidateId: 'bend:110', incomingElementIndex: 0, incomingElementId: 'E1',
  outgoingElementIndex: 1, outgoingElementId: 'E2', analysisSectionId: 'AS1',
  profileId: 'normal-metallic', cornerNode: 110, previousNode: 100, nextNode: 120,
  geometricClass: 'HORIZONTAL', turnAngleDeg: 45, sourceBasis: 'GEOMETRY_AUTHORITY',
  outsideDiameterMm: 100, candidateStatus: 'READY_NOT_EMITTED',
  candidateRadiusDisposition: 'MATCHES_AUTHORITY', geometryRecheckRequired: false,
  sourceKind: 'EXPLICIT_GLOBAL_NORMAL_POLICY', sourceAuthority: 'TEST', sourceReference: 'C-1',
};
const standard = createPipelineNormalFittingResolution({ ...base,
  fittingPolicyId: 'normal-standard-elbow', fittingKind: 'STANDARD_ELBOW',
  radiusBasis: 'NORMAL_STANDARD_ELBOW_RADIUS_D', radiusD: 1.5, radiusMm: 150,
  observedCandidateRadiusD: 1.5, observedCandidateRadiusMm: 150,
});
assert.equal(standard.ready, true);
assert.equal(standard.radiusMm, 150);

const radiusDOnly = createPipelineNormalFittingResolution({ ...base,
  fittingPolicyId: 'normal-standard-elbow', fittingKind: 'STANDARD_ELBOW',
  radiusBasis: 'NORMAL_STANDARD_ELBOW_RADIUS_D', radiusD: 1.5, radiusMm: 150,
  observedCandidateRadiusD: 1.5,
});
assert.equal(radiusDOnly.ready, true);
assert.equal(radiusDOnly.observedCandidateRadiusMm, 150);
assert.equal(radiusDOnly.candidateRadiusDisposition, 'MATCHES_AUTHORITY');

const inconsistentObserved = createPipelineNormalFittingResolution({ ...base,
  fittingPolicyId: 'normal-standard-elbow', fittingKind: 'STANDARD_ELBOW',
  radiusBasis: 'NORMAL_STANDARD_ELBOW_RADIUS_D', radiusD: 1.5, radiusMm: 150,
  observedCandidateRadiusD: 9, observedCandidateRadiusMm: 150,
  candidateRadiusDisposition: 'REQUIRES_RECOMPUTE', geometryRecheckRequired: true,
});
assert.equal(inconsistentObserved.ready, false);
assert.ok(inconsistentObserved.blockerCodes.includes('PIPELINE_NORMAL_FITTING_RADIUS_BASIS_CONFLICT'));
assert.equal(inconsistentObserved.observedCandidateRadiusD, 9);
assert.equal(inconsistentObserved.observedCandidateRadiusMm, 150);

const blocked = createPipelineNormalFittingResolution({ ...base,
  fittingPolicyId: '', fittingKind: '', radiusBasis: '', radiusD: null, radiusMm: null,
  observedCandidateRadiusD: 1.5, observedCandidateRadiusMm: 150,
  candidateRadiusDisposition: 'NOT_AVAILABLE', geometryRecheckRequired: false,
  sourceKind: 'UNRESOLVED', status: 'BLOCKED',
  diagnostics: [{ severity: 'BLOCKING', code: 'PIPELINE_NORMAL_FITTING_AUTHORITY_UNRESOLVED',
    message: 'No authority.', details: { candidateId: 'bend:110' } }],
});
assert.equal(blocked.ready, false);
assert.equal(blocked.status, 'BLOCKED');
assert.deepEqual(blocked.blockerCodes, ['PIPELINE_NORMAL_FITTING_AUTHORITY_UNRESOLVED']);
assert.equal(blocked.cornerNode, 110);
assert.equal(blocked.observedCandidateRadiusD, 1.5);
assert.equal(blocked.observedCandidateRadiusMm, 150);

const emittedMismatch = createPipelineNormalFittingResolution({ ...standard, candidateStatus: 'EMITTED',
  observedCandidateRadiusD: 1.4, observedCandidateRadiusMm: null,
  candidateRadiusDisposition: 'REQUIRES_RECOMPUTE', geometryRecheckRequired: true });
assert.ok(emittedMismatch.blockerCodes.includes('PIPELINE_NORMAL_FITTING_EMITTED_RADIUS_CONFLICT'));
const wrongProfile = createPipelineNormalFittingResolution({ ...standard, profileId: 'asme-b31.4' });
assert.ok(wrongProfile.blockerCodes.includes('PIPELINE_NORMAL_FITTING_PROFILE_INCOMPATIBLE'));
const booleanRadius = createPipelineNormalFittingResolution({ ...base,
  fittingPolicyId: 'normal-standard-elbow', fittingKind: 'STANDARD_ELBOW',
  radiusBasis: 'NORMAL_STANDARD_ELBOW_RADIUS_D', radiusD: true, radiusMm: 150,
});
assert.ok(booleanRadius.blockerCodes.includes('PIPELINE_NORMAL_FITTING_RADIUS_INVALID'));

const planInput = (fittingResolutions) => ({
  analysisSectionPlanSchema: 'PipelineAnalysisSectionPlan.v1',
  analysisDiameterPlanSchema: 'PipelineAnalysisDiameterPlan.v1',
  bendResolutionSchema: 'PipelineBendResolution.v3',
  migration: { sourceKinds: ['EXPLICIT_GLOBAL_NORMAL_POLICY'] },
  fittingResolutions, notApplicableCandidateIds: [],
});
const plan = createPipelineNormalFittingPlan(planInput([standard]));
assert.equal(plan.ready, true);
assert.ok(Object.isFrozen(plan));
assert.ok(Object.isFrozen(plan.fittingResolutions));
assert.ok(Object.isFrozen(plan.fittingResolutions[0]));
assert.doesNotThrow(() => JSON.stringify(plan));

const sameCorner = createPipelineNormalFittingResolution({ ...standard,
  candidateId: 'bend:210', incomingElementIndex: 2, incomingElementId: 'E3',
  outgoingElementIndex: 3, outgoingElementId: 'E4', analysisSectionId: 'AS2',
  previousNode: 200, cornerNode: 110, nextNode: 220,
});
const duplicateCornerPlan = createPipelineNormalFittingPlan(planInput([standard, sameCorner]));
assert.equal(duplicateCornerPlan.ready, false);
assert.ok(duplicateCornerPlan.blockerCodes.includes('PIPELINE_NORMAL_FITTING_CANDIDATE_COVERAGE_INVALID'));

const blockedMigration = createPipelineNormalFittingPlan({ ...planInput([standard]),
  migration: { blockerCodes: ['PIPELINE_NORMAL_FITTING_LEGACY_AUTHORITY_UNCONFIRMED'] },
});
assert.equal(blockedMigration.ready, false);
assert.ok(blockedMigration.blockerCodes.includes('PIPELINE_NORMAL_FITTING_LEGACY_AUTHORITY_UNCONFIRMED'));
console.log('Pipeline Normal fitting contract tests passed.');
