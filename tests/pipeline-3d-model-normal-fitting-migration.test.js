import assert from 'node:assert/strict';
import { resolvePipelineNormalFittingPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-normal-fitting-resolution.js';

const clean = { diagnostics: [], blockerCodes: [] };
const analysisSectionPlan = Object.freeze({ schema: 'PipelineAnalysisSectionPlan.v1', ready: true, ...clean,
  sections: Object.freeze([{ schema: 'PipelineAnalysisSection.v1', analysisSectionId: 'AS1',
    startElementIndex: 0, profileId: 'normal-metallic', status: 'CONTRACT_ONLY', ...clean }]),
  elementResolutions: Object.freeze([0, 1].map((elementIndex) => ({ schema: 'PipelineElementSectionResolution.v1',
    elementIndex, elementId: `E${elementIndex + 1}`, analysisSectionId: 'AS1', profileId: 'normal-metallic',
    ready: true, ...clean }))) });
const analysisDiameterPlan = Object.freeze({ schema: 'PipelineAnalysisDiameterPlan.v1', ready: true, ...clean,
  analysisSectionPlanSchema: 'PipelineAnalysisSectionPlan.v1', propertySectionPlanSchema: 'PipelinePropertySectionPlan.v1',
  migration: Object.freeze({ schema: 'PipelineDiameterMigration.v1', ready: true, ...clean }),
  sectionResolutions: Object.freeze([{ schema: 'PipelineAnalysisDiameterResolution.v1', analysisSectionId: 'AS1',
    startElementIndex: 0, profileId: 'normal-metallic', outsideDiameterMm: 100, status: 'RESOLVED', ready: true, ...clean }]),
  elementResolutions: Object.freeze([0, 1].map((elementIndex) => ({ schema: 'PipelineElementDiameterResolution.v1',
    elementIndex, elementId: `E${elementIndex + 1}`, analysisSectionId: 'AS1', profileId: 'normal-metallic',
    outsideDiameterMm: 100, ready: true, ...clean }))) });
const candidate = Object.freeze({ id: 'bend:110', incomingElementIndex: 0, outgoingElementIndex: 1,
  previousNode: 100, cornerNode: 110, nextNode: 120, classification: 'HORIZONTAL', turnAngleDeg: 30,
  sourceBasis: 'GEOMETRY_AUTHORITY', bendClass: 'standard', radiusBasis: 'DEFAULT_MULTIPLIER',
  radiusD: 1.5, radiusMm: 150, geometryFits: true, status: 'READY_NOT_EMITTED' });
const input = (extra = {}) => ({ analysisSectionPlan, analysisDiameterPlan,
  bendResolution: { schema: 'PipelineBendResolution.v3', candidates: [candidate] }, ...extra });

const candidateOverride = resolvePipelineNormalFittingPlan(input({
  normalFittingOverrides: [{ candidateId: 'bend:110', fittingPolicyId: 'normal-standard-elbow', radiusD: 2 }],
  normalFittingSections: [{ analysisSectionId: 'AS1', fittingPolicyId: 'normal-standard-elbow', radiusD: 3 }],
  normalFittingPolicy: { fittingPolicyId: 'normal-explicit-radius-bend', radiusMm: 400 },
  settings: { designBasis: 'default-metallic', bendClass: 'standard', standardRadiusMultiplierD: 1.5 },
  legacyNormalFittingBasisConfirmed: true,
}));
assert.equal(candidateOverride.ready, true);
assert.equal(candidateOverride.fittingResolutions[0].sourceKind, 'EXPLICIT_CANDIDATE_OVERRIDE');
assert.equal(candidateOverride.fittingResolutions[0].radiusMm, 200);

const section = resolvePipelineNormalFittingPlan(input({
  normalFittingSections: [{ analysisSectionId: 'AS1', fittingPolicyId: 'normal-explicit-radius-bend', radiusD: 2.5 }],
  normalFittingPolicy: { fittingPolicyId: 'normal-standard-elbow', radiusD: 3 },
}));
assert.equal(section.fittingResolutions[0].sourceKind, 'EXPLICIT_ANALYSIS_SECTION_POLICY');
assert.equal(section.fittingResolutions[0].radiusMm, 250);

const global = resolvePipelineNormalFittingPlan(input({
  normalFittingPolicy: { fittingPolicyId: 'normal-explicit-radius-bend', radiusMm: 220 },
}));
assert.equal(global.ready, true);
assert.equal(global.fittingResolutions[0].radiusD, 2.2);
assert.equal(global.fittingResolutions[0].sourceKind, 'EXPLICIT_GLOBAL_NORMAL_POLICY');

const legacy = resolvePipelineNormalFittingPlan(input({
  settings: { designBasis: 'default-metallic', bendClass: 'standard', standardRadiusMultiplierD: '1.5' },
  legacyNormalFittingBasisConfirmed: true,
}));
assert.equal(legacy.ready, true);
assert.equal(legacy.fittingResolutions[0].sourceKind, 'CONFIRMED_LEGACY_NORMAL_STANDARD_ELBOW');
assert.equal(legacy.fittingResolutions[0].radiusMm, 150);

const unconfirmed = resolvePipelineNormalFittingPlan(input({
  settings: { designBasis: 'default-metallic', bendClass: 'standard', standardRadiusMultiplierD: 1.5 },
}));
assert.equal(unconfirmed.ready, false);
assert.ok(unconfirmed.blockerCodes.includes('PIPELINE_NORMAL_FITTING_LEGACY_AUTHORITY_UNCONFIRMED'));
const candidateOnly = resolvePipelineNormalFittingPlan(input());
assert.equal(candidateOnly.ready, false);
assert.ok(candidateOnly.blockerCodes.includes('PIPELINE_NORMAL_FITTING_LEGACY_AUTHORITY_UNCONFIRMED'));

const invalidHigh = resolvePipelineNormalFittingPlan(input({
  normalFittingOverrides: [{ candidateId: 'bend:110', fittingPolicyId: 'normal-standard-elbow', radiusD: true }],
  normalFittingPolicy: { fittingPolicyId: 'normal-standard-elbow', radiusD: 2 },
  settings: { designBasis: 'default-metallic', bendClass: 'standard', standardRadiusMultiplierD: 1.5 },
  legacyNormalFittingBasisConfirmed: true,
}));
assert.equal(invalidHigh.ready, false);
assert.deepEqual(invalidHigh.fittingResolutions[0].blockerCodes, ['PIPELINE_NORMAL_FITTING_RADIUS_INVALID']);
assert.equal(invalidHigh.fittingResolutions[0].sourceKind, 'UNRESOLVED');
assert.equal(invalidHigh.fittingResolutions[0].cornerNode, 110);
assert.equal(invalidHigh.fittingResolutions[0].geometricClass, 'HORIZONTAL');
assert.equal(invalidHigh.fittingResolutions[0].observedCandidateRadiusD, 1.5);
assert.equal(invalidHigh.fittingResolutions[0].observedCandidateRadiusMm, 150);

const conflict = resolvePipelineNormalFittingPlan(input({ normalFittingSections: [
  { analysisSectionId: 'AS1', fittingPolicyId: 'normal-standard-elbow', radiusD: 1.5 },
  { analysisSectionId: 'AS1', fittingPolicyId: 'normal-standard-elbow', radiusD: 2 },
] }));
assert.equal(conflict.ready, false);
assert.ok(conflict.blockerCodes.includes('PIPELINE_NORMAL_FITTING_SOURCE_CONFLICT'));
const contradictoryTarget = resolvePipelineNormalFittingPlan(input({
  normalFittingOverrides: [{ candidateId: 'bend:110', incomingElementIndex: 9,
    fittingPolicyId: 'normal-standard-elbow', radiusD: 2 }],
  normalFittingPolicy: { fittingPolicyId: 'normal-standard-elbow', radiusD: 3 },
}));
assert.equal(contradictoryTarget.ready, false);
assert.ok(contradictoryTarget.blockerCodes.includes('PIPELINE_NORMAL_FITTING_TARGET_INVALID'));
assert.equal(contradictoryTarget.fittingResolutions[0].sourceKind, 'UNRESOLVED');
const invalidLegacyRadius = resolvePipelineNormalFittingPlan(input({
  settings: { designBasis: 'default-metallic', bendClass: 'standard', standardRadiusMultiplierD: true },
  legacyNormalFittingBasisConfirmed: true,
}));
assert.equal(invalidLegacyRadius.ready, false);
assert.ok(invalidLegacyRadius.blockerCodes.includes('PIPELINE_NORMAL_FITTING_RADIUS_INVALID'));
console.log('Pipeline Normal fitting migration tests passed.');
