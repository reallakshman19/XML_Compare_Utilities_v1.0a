import assert from 'node:assert/strict';
import {
  PIPELINE_B314_RADIUS_POLICY_IDS,
  PIPELINE_B314_RADIUS_POLICY_REGISTRY,
  PIPELINE_B314_RADIUS_MIGRATION_SCHEMA,
  createPipelineB314RadiusMigration,
  createPipelineB314RadiusResolution,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-b314-radius-contracts.js';

assert.deepEqual(PIPELINE_B314_RADIUS_POLICY_REGISTRY.descriptors.map((item) => item.radiusPolicyId), [
  'b31.4-elastic-screening',
  'b31.4-cold-field-size-band',
  'b31.4-cold-field-project-radius-d',
]);
assert.equal(Object.isFrozen(PIPELINE_B314_RADIUS_POLICY_REGISTRY.descriptors[0]), true);

const blockedLegacy = createPipelineB314RadiusMigration({
  schema: PIPELINE_B314_RADIUS_MIGRATION_SCHEMA,
  legacyEvidenceObserved: true,
  legacyB314RadiusBasisConfirmed: false,
});
assert.equal(blockedLegacy.ready, false);
assert.ok(blockedLegacy.blockerCodes.includes('PIPELINE_B314_RADIUS_LEGACY_AUTHORITY_UNCONFIRMED'));

const npsConflict = createPipelineB314RadiusMigration({
  legacyEvidenceObserved: true,
  legacyB314RadiusBasisConfirmed: true,
  legacySettingsNpsObserved: 20,
  legacySettingsNpsMatchedCanonical: false,
});
assert.equal(npsConflict.ready, false);
assert.ok(npsConflict.blockerCodes.includes('PIPELINE_B314_RADIUS_NPS_CONFLICT'));

const identity = {
  candidateId: 'bend:110', incomingElementIndex: 0, incomingElementId: 'E1',
  outgoingElementIndex: 1, outgoingElementId: 'E2', analysisSectionId: 'AS1',
  profileId: 'asme-b31.4', cornerNode: 110, previousNode: 100, nextNode: 120,
  geometricClass: 'VERTICAL', turnAngleDeg: 5, sourceBasis: 'TABLE_2_PROFILE_ONLY',
  bendClass: 'elastic', outsideDiameterMm: 100, nominalPipeSizeNps: 4,
  sizeBandInputReady: true, candidateStatus: 'READY_NOT_EMITTED',
  sourceKind: 'EXPLICIT_GLOBAL_B31_4_POLICY', sourceAuthority: 'TEST', sourceReference: 'T1',
};
const elastic = {
  ...identity,
  radiusPolicyId: PIPELINE_B314_RADIUS_POLICY_IDS.ELASTIC_SCREENING,
  radiusBasis: 'B31_4_ELASTIC_GOVERNING', formulaEnabled: true,
  youngsModulusMpa: 200, allowableBendingStressMpa: 100,
  formulaRadiusD: 1, formulaRadiusMm: 100, practicalEnabled: false,
  governingRadiusD: 1, governingRadiusMm: 100,
  observedCandidateRadiusD: 1, observedCandidateRadiusMm: 100,
  candidateRadiusDisposition: 'MATCHES_AUTHORITY', geometryRecheckRequired: false,
};
const valid = createPipelineB314RadiusResolution(elastic);
assert.equal(valid.ready, true);
assert.equal(valid.radiusBasis, 'B31_4_ELASTIC_GOVERNING');

const wrongBasis = createPipelineB314RadiusResolution({ ...elastic, radiusBasis: 'UNRELATED' });
assert.equal(wrongBasis.ready, false);
assert.ok(wrongBasis.blockerCodes.includes('PIPELINE_B314_RADIUS_POLICY_INVALID'));

const projectBase = {
  ...identity, bendClass: 'cold-field', radiusPolicyId: PIPELINE_B314_RADIUS_POLICY_IDS.COLD_FIELD_PROJECT_RADIUS_D,
  radiusBasis: 'B31_4_COLD_FIELD_PROJECT_RADIUS_D', projectRadiusD: 30,
  governingRadiusD: 30, governingRadiusMm: 3000,
  observedCandidateRadiusD: 30, observedCandidateRadiusMm: 3000,
  candidateRadiusDisposition: 'MATCHES_AUTHORITY', geometryRecheckRequired: false,
};
const invalidProjectClaim = createPipelineB314RadiusResolution({
  ...projectBase, normalCodeRadiusD: 30, qualificationEligible: true,
});
assert.equal(invalidProjectClaim.ready, false);
assert.ok(invalidProjectClaim.blockerCodes.includes('PIPELINE_B314_RADIUS_POLICY_INVALID'));

const diagnosticOnlyBlocked = createPipelineB314RadiusResolution({
  ...identity, radiusPolicyId: '', radiusBasis: '', status: 'BLOCKED',
  candidateRadiusDisposition: 'NOT_AVAILABLE', geometryRecheckRequired: false,
  diagnostics: [{ severity: 'BLOCKING', code: 'PIPELINE_B314_RADIUS_AUTHORITY_UNRESOLVED', message: 'blocked', details: {} }],
});
assert.equal(diagnosticOnlyBlocked.ready, false);
assert.equal(diagnosticOnlyBlocked.blockerCodes.includes('PIPELINE_B314_RADIUS_POLICY_INVALID'), false);
assert.ok(diagnosticOnlyBlocked.blockerCodes.includes('PIPELINE_B314_RADIUS_AUTHORITY_UNRESOLVED'));

const dWrong = createPipelineB314RadiusResolution({
  ...elastic, observedCandidateRadiusD: 9, observedCandidateRadiusMm: 100,
  candidateRadiusDisposition: 'REQUIRES_RECOMPUTE', geometryRecheckRequired: true,
});
assert.equal(dWrong.candidateRadiusDisposition, 'REQUIRES_RECOMPUTE');
assert.equal(dWrong.geometryRecheckRequired, true);
assert.ok(dWrong.blockerCodes.includes('PIPELINE_B314_RADIUS_OBSERVED_BASIS_CONFLICT'));

const mmWrong = createPipelineB314RadiusResolution({
  ...elastic, observedCandidateRadiusD: 1, observedCandidateRadiusMm: 900,
  candidateRadiusDisposition: 'REQUIRES_RECOMPUTE', geometryRecheckRequired: true,
});
assert.equal(mmWrong.candidateRadiusDisposition, 'REQUIRES_RECOMPUTE');
assert.ok(mmWrong.blockerCodes.includes('PIPELINE_B314_RADIUS_OBSERVED_BASIS_CONFLICT'));

const dOnly = createPipelineB314RadiusResolution({
  ...elastic, observedCandidateRadiusD: 1, observedCandidateRadiusMm: null,
});
assert.equal(dOnly.observedCandidateRadiusMm, 100);
assert.equal(dOnly.observedCandidateRadiusD, 1);

const emittedDualConflict = createPipelineB314RadiusResolution({
  ...elastic, candidateStatus: 'EMITTED', observedCandidateRadiusD: 9, observedCandidateRadiusMm: 100,
  candidateRadiusDisposition: 'REQUIRES_RECOMPUTE', geometryRecheckRequired: true,
});
assert.ok(emittedDualConflict.blockerCodes.includes('PIPELINE_B314_RADIUS_EMITTED_RADIUS_CONFLICT'));
console.log('pipeline-3d-model B31.4 radius contracts: PASS');
