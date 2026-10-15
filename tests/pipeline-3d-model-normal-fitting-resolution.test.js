import assert from 'node:assert/strict';
import {
  buildPipelineNormalFittingLedgerText,
  buildPipelineNormalFittingPlanJson,
  resolvePipelineNormalFittingPlan,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-normal-fitting-resolution.js';

const clean = { diagnostics: [], blockerCodes: [] };
function analysisSection(analysisSectionId, startElementIndex, profileId) {
  return { schema: 'PipelineAnalysisSection.v1', analysisSectionId, startElementIndex, profileId,
    status: 'CONTRACT_ONLY', ...clean };
}
function analysisElement(elementIndex, analysisSectionId, profileId) {
  return { schema: 'PipelineElementSectionResolution.v1', elementIndex, elementId: `E${elementIndex + 1}`,
    analysisSectionId, profileId, ready: true, ...clean };
}
function diameterSection(analysisSectionId, startElementIndex, profileId, outsideDiameterMm) {
  return { schema: 'PipelineAnalysisDiameterResolution.v1', analysisSectionId, startElementIndex, profileId,
    outsideDiameterMm, ready: true, status: 'RESOLVED', ...clean };
}
function diameterElement(elementIndex, analysisSectionId, profileId, outsideDiameterMm) {
  return { schema: 'PipelineElementDiameterResolution.v1', elementIndex, elementId: `E${elementIndex + 1}`,
    analysisSectionId, profileId, outsideDiameterMm, ready: true, ...clean };
}
function plans(candidateOverrides = [], planOverrides = {}) {
  const analysisSectionPlan = { schema: 'PipelineAnalysisSectionPlan.v1', ready: true, ...clean,
    sections: [analysisSection('AS1', 0, 'normal-metallic'), analysisSection('AS2', 2, 'asme-b31.4')],
    elementResolutions: [analysisElement(0, 'AS1', 'normal-metallic'), analysisElement(1, 'AS1', 'normal-metallic'),
      analysisElement(2, 'AS2', 'asme-b31.4'), analysisElement(3, 'AS2', 'asme-b31.4')] };
  const analysisDiameterPlan = { schema: 'PipelineAnalysisDiameterPlan.v1', ready: true, ...clean,
    analysisSectionPlanSchema: 'PipelineAnalysisSectionPlan.v1', propertySectionPlanSchema: 'PipelinePropertySectionPlan.v1',
    migration: { schema: 'PipelineDiameterMigration.v1', ready: true, ...clean },
    sectionResolutions: [diameterSection('AS1', 0, 'normal-metallic', 100), diameterSection('AS2', 2, 'asme-b31.4', 200)],
    elementResolutions: [diameterElement(0, 'AS1', 'normal-metallic', 100), diameterElement(1, 'AS1', 'normal-metallic', 100),
      diameterElement(2, 'AS2', 'asme-b31.4', 200), diameterElement(3, 'AS2', 'asme-b31.4', 200)] };
  const candidates = [
    { id: 'bend:110', incomingElementIndex: 0, outgoingElementIndex: 1, previousNode: 100, cornerNode: 110,
      nextNode: 120, classification: 'COMPOUND', turnAngleDeg: 60, sourceBasis: 'GEOMETRY_AUTHORITY',
      bendClass: 'standard', radiusBasis: 'DEFAULT_MULTIPLIER', radiusD: 1.5, radiusMm: 150,
      geometryFits: true, status: 'READY_NOT_EMITTED', ...candidateOverrides[0] },
    { id: 'bend:130', incomingElementIndex: 2, outgoingElementIndex: 3, previousNode: 120, cornerNode: 130,
      nextNode: 140, classification: 'HORIZONTAL', turnAngleDeg: 30, sourceBasis: 'TABLE_1_PLAN',
      bendClass: 'cold-field', radiusD: 30, radiusMm: 6000, geometryFits: true, status: 'READY_NOT_EMITTED',
      ...candidateOverrides[1] },
  ];
  return { analysisSectionPlan, analysisDiameterPlan,
    bendResolution: { schema: 'PipelineBendResolution.v3', candidates }, ...planOverrides };
}
const policy = { normalFittingPolicy: { fittingPolicyId: 'normal-standard-elbow', radiusD: 2 } };
const recompute = resolvePipelineNormalFittingPlan({ ...plans(), ...policy });
assert.equal(recompute.ready, true);
assert.equal(recompute.fittingResolutions.length, 1);
assert.deepEqual(recompute.notApplicableCandidateIds, ['bend:130']);
const item = recompute.fittingResolutions[0];
assert.equal(item.incomingElementId, 'E1');
assert.equal(item.outgoingElementId, 'E2');
assert.equal(item.radiusMm, 200);
assert.equal(item.candidateRadiusDisposition, 'REQUIRES_RECOMPUTE');
assert.equal(item.geometryRecheckRequired, true);
assert.equal(item.ready, true);
assert.notEqual(item.radiusMm, 8 * 2);

const radiusDOnlyMatch = resolvePipelineNormalFittingPlan({ ...plans([{ radiusD: 2, radiusMm: null }]), ...policy });
assert.equal(radiusDOnlyMatch.ready, true);
assert.equal(radiusDOnlyMatch.fittingResolutions[0].candidateRadiusDisposition, 'MATCHES_AUTHORITY');
assert.equal(radiusDOnlyMatch.fittingResolutions[0].observedCandidateRadiusD, 2);
assert.equal(radiusDOnlyMatch.fittingResolutions[0].observedCandidateRadiusMm, 200);
const radiusDOnlyMismatch = resolvePipelineNormalFittingPlan({ ...plans([{ radiusD: 1.5, radiusMm: null }]), ...policy });
assert.equal(radiusDOnlyMismatch.ready, true);
assert.equal(radiusDOnlyMismatch.fittingResolutions[0].candidateRadiusDisposition, 'REQUIRES_RECOMPUTE');
const emittedDOnly = resolvePipelineNormalFittingPlan({ ...plans([{ radiusD: 1.5, radiusMm: null, status: 'EMITTED' }]), ...policy });
assert.equal(emittedDOnly.ready, false);
assert.ok(emittedDOnly.blockerCodes.includes('PIPELINE_NORMAL_FITTING_EMITTED_RADIUS_CONFLICT'));

const consistentDual = resolvePipelineNormalFittingPlan({ ...plans([{ radiusD: 2, radiusMm: 200 }]), ...policy });
assert.equal(consistentDual.ready, true);
assert.equal(consistentDual.fittingResolutions[0].candidateRadiusDisposition, 'MATCHES_AUTHORITY');
const inconsistentDual = resolvePipelineNormalFittingPlan({ ...plans([{ radiusD: 9, radiusMm: 200 }]), ...policy });
assert.equal(inconsistentDual.ready, false);
assert.ok(inconsistentDual.blockerCodes.includes('PIPELINE_NORMAL_FITTING_RADIUS_BASIS_CONFLICT'));
assert.equal(inconsistentDual.fittingResolutions[0].candidateRadiusDisposition, 'REQUIRES_RECOMPUTE');
assert.equal(inconsistentDual.fittingResolutions[0].observedCandidateRadiusD, 9);
assert.equal(inconsistentDual.fittingResolutions[0].observedCandidateRadiusMm, 200);
const emittedDual = resolvePipelineNormalFittingPlan({ ...plans([{ radiusD: 9, radiusMm: 200, status: 'EMITTED' }]), ...policy });
assert.ok(emittedDual.blockerCodes.includes('PIPELINE_NORMAL_FITTING_EMITTED_RADIUS_CONFLICT'));

for (const invalid of [true, [], {}]) {
  const result = resolvePipelineNormalFittingPlan({ ...plans([{ radiusD: invalid, radiusMm: null }]), ...policy });
  assert.equal(result.ready, false);
  assert.ok(result.blockerCodes.includes('PIPELINE_NORMAL_FITTING_RADIUS_INVALID'));
}

const noRadius = resolvePipelineNormalFittingPlan({ ...plans([{ radiusMm: null, radiusD: null }]), ...policy });
assert.equal(noRadius.ready, true);
assert.equal(noRadius.fittingResolutions[0].candidateRadiusDisposition, 'NOT_AVAILABLE');
const explicitMm = resolvePipelineNormalFittingPlan({ ...plans(),
  normalFittingPolicy: { fittingPolicyId: 'normal-explicit-radius-bend', radiusMm: 250 } });
assert.equal(explicitMm.ready, true);
assert.equal(explicitMm.fittingResolutions[0].radiusD, 2.5);
assert.equal(explicitMm.fittingResolutions[0].radiusBasis, 'NORMAL_EXPLICIT_RADIUS_MM');

const forgedPlans = [
  (value) => { value.analysisSectionPlan.blockerCodes = ['PIPELINE_ANALYSIS_SECTION_CONTRACT_INVALID']; },
  (value) => { value.analysisSectionPlan.diagnostics = [{ severity: 'BLOCKING', code: 'X', message: '', details: {} }]; },
  (value) => { value.analysisSectionPlan.sections[0].status = 'BLOCKED'; },
  (value) => { value.analysisSectionPlan.elementResolutions[0].ready = false; },
  (value) => { value.analysisDiameterPlan.blockerCodes = ['PIPELINE_DIAMETER_BASIS_INVALID']; },
  (value) => { value.analysisDiameterPlan.diagnostics = [{ severity: 'BLOCKING', code: 'X', message: '', details: {} }]; },
  (value) => { value.analysisDiameterPlan.migration.ready = false; },
  (value) => { value.analysisDiameterPlan.sectionResolutions[0].ready = false; },
  (value) => { value.analysisDiameterPlan.elementResolutions[0].ready = false; },
  (value) => { value.analysisDiameterPlan.analysisSectionPlanSchema = 'PipelineAnalysisSectionPlan.v0'; },
];
for (const forge of forgedPlans) {
  const value = plans(); forge(value);
  const result = resolvePipelineNormalFittingPlan({ ...value, ...policy });
  assert.equal(result.ready, false);
  assert.ok(result.blockerCodes.includes('PIPELINE_NORMAL_FITTING_INPUT_INVALID')
    || result.blockerCodes.includes('PIPELINE_NORMAL_FITTING_DIAMETER_PLAN_INVALID'));
}
const ownershipContradiction = plans();
ownershipContradiction.analysisSectionPlan.elementResolutions[0].profileId = 'asme-b31.4';
assert.equal(resolvePipelineNormalFittingPlan({ ...ownershipContradiction, ...policy }).ready, false);

const invalidHigh = resolvePipelineNormalFittingPlan({ ...plans(),
  normalFittingOverrides: [{ candidateId: 'bend:110', fittingPolicyId: 'normal-standard-elbow', radiusD: true }],
  normalFittingPolicy: { fittingPolicyId: 'normal-standard-elbow', radiusD: 2 } });
assert.equal(invalidHigh.ready, false);
const blockedItem = invalidHigh.fittingResolutions[0];
assert.deepEqual(blockedItem.blockerCodes, ['PIPELINE_NORMAL_FITTING_RADIUS_INVALID']);
assert.equal(blockedItem.status, 'BLOCKED');
assert.equal(blockedItem.cornerNode, 110);
assert.equal(blockedItem.previousNode, 100);
assert.equal(blockedItem.nextNode, 120);
assert.equal(blockedItem.geometricClass, 'COMPOUND');
assert.equal(blockedItem.turnAngleDeg, 60);
assert.equal(blockedItem.sourceBasis, 'GEOMETRY_AUTHORITY');
assert.equal(blockedItem.observedCandidateRadiusD, 1.5);
assert.equal(blockedItem.observedCandidateRadiusMm, 150);
assert.equal(blockedItem.fittingPolicyId, '');
assert.equal(blockedItem.radiusMm, null);

const duplicate = plans([{ id: 'bend:130', cornerNode: 130, incomingElementIndex: 2, outgoingElementIndex: 3 }]);
const duplicateResult = resolvePipelineNormalFittingPlan({ ...duplicate, ...policy });
assert.equal(duplicateResult.ready, false);
assert.ok(duplicateResult.blockerCodes.includes('PIPELINE_NORMAL_FITTING_CANDIDATE_COVERAGE_INVALID'));
const crossing = plans([{ outgoingElementIndex: 2 }]);
assert.ok(resolvePipelineNormalFittingPlan({ ...crossing, ...policy }).blockerCodes.includes('PIPELINE_NORMAL_FITTING_OWNERSHIP_INVALID'));
const missingDiameter = plans();
missingDiameter.analysisDiameterPlan.sectionResolutions[0].outsideDiameterMm = null;
assert.ok(resolvePipelineNormalFittingPlan({ ...missingDiameter, ...policy }).blockerCodes.includes('PIPELINE_NORMAL_FITTING_DIAMETER_PLAN_INVALID'));

for (const malformed of [
  { analysisSectionPlan: { schema: 'PipelineAnalysisSectionPlan.v1', ready: true, sections: [null], elementResolutions: [] } },
  { analysisDiameterPlan: { schema: 'PipelineAnalysisDiameterPlan.v1', ready: true, sectionResolutions: {}, elementResolutions: [] } },
  { bendResolution: { schema: 'PipelineBendResolution.v3', candidates: [null] } },
  { normalFittingOverrides: [null] },
]) {
  assert.doesNotThrow(() => resolvePipelineNormalFittingPlan({ ...plans(), ...policy, ...malformed }));
  assert.equal(resolvePipelineNormalFittingPlan({ ...plans(), ...policy, ...malformed }).ready, false);
}
assert.equal(buildPipelineNormalFittingPlanJson(recompute), buildPipelineNormalFittingPlanJson(resolvePipelineNormalFittingPlan({ ...plans(), ...policy })));
assert.equal(buildPipelineNormalFittingLedgerText(recompute), buildPipelineNormalFittingLedgerText(resolvePipelineNormalFittingPlan({ ...plans(), ...policy })));
assert.match(buildPipelineNormalFittingLedgerText(recompute), /ObservedCandidateRadiusD/);
assert.ok(Object.isFrozen(recompute));
assert.ok(Object.isFrozen(recompute.fittingResolutions[0]));
console.log('Pipeline Normal fitting resolution tests passed.');
