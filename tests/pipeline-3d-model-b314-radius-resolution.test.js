import assert from 'node:assert/strict';
import {
  buildPipelineB314RadiusLedgerText,
  buildPipelineB314RadiusPlanJson,
  resolvePipelineB314RadiusPlan,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-b314-radius-resolution.js';

const section = (id, start, profileId) => ({
  schema: 'PipelineAnalysisSection.v1', analysisSectionId: id, startElementIndex: start, profileId,
  boundaryAuthority: 'TEST', boundarySourceReference: '', sourceAuthority: 'TEST', sourceReference: '',
  status: 'CONTRACT_ONLY', diagnostics: [], blockerCodes: [],
});
const element = (index, sectionId, profileId, start) => ({
  schema: 'PipelineElementSectionResolution.v1', elementIndex: index, elementId: `E${index + 1}`,
  analysisSectionId: sectionId, profileId,
  resolvedMode: profileId === 'asme-b31.4' ? 'ASME_B31_4' : 'NORMAL',
  sectionDisposition: start ? 'SECTION_START' : 'INHERITED', boundaryNode: start ? 100 + index : null,
  sourceAuthority: 'TEST', sourceReference: '', diagnostics: [], blockerCodes: [], ready: true,
});
function fixture({ elastic = {}, cold = {}, coldStatus = 'READY_NOT_EMITTED' } = {}) {
  const sections = [section('AS1', 0, 'asme-b31.4'), section('AS2', 4, 'normal-metallic')];
  const elements = [
    element(0, 'AS1', 'asme-b31.4', true), element(1, 'AS1', 'asme-b31.4', false),
    element(2, 'AS1', 'asme-b31.4', false), element(3, 'AS1', 'asme-b31.4', false),
    element(4, 'AS2', 'normal-metallic', true), element(5, 'AS2', 'normal-metallic', false),
  ];
  const diameterSections = [
    { schema: 'PipelineAnalysisDiameterResolution.v1', analysisSectionId: 'AS1', profileId: 'asme-b31.4',
      resolvedMode: 'ASME_B31_4', startElementIndex: 0, outsideDiameterMm: 508, nominalPipeSizeNps: 20,
      greVendorNominalBoreMm: null, caesarDiameterMm: 508, physicalDiameterReady: true,
      sizeBandInputReady: true, vendorSeriesInputReady: false, sourceKind: 'EXPLICIT',
      sourceAuthority: 'TEST', sourceReference: '', quantitySources: {}, status: 'RESOLVED',
      diagnostics: [], blockerCodes: [], ready: true },
    { schema: 'PipelineAnalysisDiameterResolution.v1', analysisSectionId: 'AS2', profileId: 'normal-metallic',
      resolvedMode: 'NORMAL', startElementIndex: 4, outsideDiameterMm: 114.3, nominalPipeSizeNps: 4,
      greVendorNominalBoreMm: null, caesarDiameterMm: 114.3, physicalDiameterReady: true,
      sizeBandInputReady: true, vendorSeriesInputReady: false, sourceKind: 'EXPLICIT',
      sourceAuthority: 'TEST', sourceReference: '', quantitySources: {}, status: 'RESOLVED',
      diagnostics: [], blockerCodes: [], ready: true },
  ];
  const diameterElements = elements.map((item) => {
    const owner = diameterSections.find((candidate) => candidate.analysisSectionId === item.analysisSectionId);
    return { schema: 'PipelineElementDiameterResolution.v1', elementIndex: item.elementIndex,
      elementId: item.elementId, analysisSectionId: item.analysisSectionId, profileId: item.profileId,
      outsideDiameterMm: owner.outsideDiameterMm, nominalPipeSizeNps: owner.nominalPipeSizeNps,
      greVendorNominalBoreMm: null, caesarDiameterMm: owner.caesarDiameterMm, propertyDiameterMm: null,
      diameterDisposition: item.sectionDisposition, sourceKind: 'EXPLICIT',
      diagnostics: [], blockerCodes: [], ready: true };
  });
  return {
    analysisSectionPlan: { schema: 'PipelineAnalysisSectionPlan.v1', sections,
      elementResolutions: elements, diagnostics: [], blockerCodes: [], ready: true },
    analysisDiameterPlan: { schema: 'PipelineAnalysisDiameterPlan.v1',
      analysisSectionPlanSchema: 'PipelineAnalysisSectionPlan.v1',
      propertySectionPlanSchema: 'PipelinePropertySectionPlan.v1',
      migration: { schema: 'PipelineDiameterMigration.v1', outsideDiameterSourceKinds: ['EXPLICIT'],
        nominalPipeSizeSourceKinds: ['EXPLICIT'], greVendorNominalBoreSourceKinds: [],
        legacyDiameterEvidenceObserved: false, legacyDiameterBasisConfirmed: false,
        npsToOutsideDiameterConversionApplied: false, greVendorBoreToOutsideDiameterConversionApplied: false,
        sourceAuthority: 'TEST', sourceReference: '', diagnostics: [], blockerCodes: [], ready: true },
      sectionResolutions: diameterSections, elementResolutions: diameterElements,
      diagnostics: [], blockerCodes: [], ready: true },
    bendResolution: { schema: 'PipelineBendResolution.v3', candidates: [
      { id: 'elastic', incomingElementIndex: 0, outgoingElementIndex: 1,
        previousNode: 100, cornerNode: 110, nextNode: 120, classification: 'VERTICAL',
        sourceBasis: 'TABLE_2_PROFILE_ONLY', turnAngleDeg: 5, bendClass: 'elastic',
        radiusD: 500, radiusMm: 254000, geometryFits: false, status: 'INFEASIBLE', ...elastic },
      { id: 'cold', incomingElementIndex: 2, outgoingElementIndex: 3,
        previousNode: 120, cornerNode: 130, nextNode: 140, classification: 'HORIZONTAL',
        sourceBasis: 'TABLE_1_PLAN', turnAngleDeg: 10, bendClass: 'cold-field',
        radiusD: 30, radiusMm: 15240, geometryFits: true, status: coldStatus, ...cold },
      { id: 'normal', incomingElementIndex: 4, outgoingElementIndex: 5,
        previousNode: 140, cornerNode: 150, nextNode: 160, classification: 'HORIZONTAL',
        sourceBasis: 'GEOMETRY', turnAngleDeg: 90, bendClass: 'standard',
        radiusD: 1.5, radiusMm: 171.45, geometryFits: true, status: 'READY_NOT_EMITTED' },
    ] },
  };
}
const elasticPolicy = { bendClass: 'elastic', radiusPolicyId: 'b31.4-elastic-screening',
  formulaEnabled: true, youngsModulusMpa: 207000, allowableBendingStressMpa: 100,
  practicalEnabled: true, practicalRadiusD: 500, sourceAuthority: 'PROJECT', sourceReference: 'E1' };
const sizeBandPolicy = { bendClass: 'cold-field', radiusPolicyId: 'b31.4-cold-field-size-band',
  qualifiedAlternativeRequested: false, projectMinimumEnabled: false,
  sourceAuthority: 'PROJECT', sourceReference: 'C1' };
const base = { ...fixture(), b314RadiusPolicies: [elasticPolicy, sizeBandPolicy] };
const plan = resolvePipelineB314RadiusPlan(base);
assert.equal(plan.ready, true);
assert.deepEqual(plan.notApplicableCandidateIds, ['normal']);
assert.equal(plan.radiusResolutions[0].bendClass, 'elastic');
assert.equal(plan.radiusResolutions[0].governingRadiusD, 1035);
assert.equal(plan.radiusResolutions[0].candidateRadiusDisposition, 'REQUIRES_RECOMPUTE');
assert.equal(plan.radiusResolutions[0].geometryRecheckRequired, true);
assert.equal(plan.radiusResolutions[1].bendClass, 'cold-field');
assert.equal(plan.radiusResolutions[1].normalCodeRadiusD, 30);
assert.equal(plan.radiusResolutions[1].candidateRadiusDisposition, 'MATCHES_AUTHORITY');
assert.equal(plan.radiusResolutions[0].incomingElementId, 'E1');
assert.equal(plan.radiusResolutions[0].outgoingElementId, 'E2');
assert.equal(Object.isFrozen(plan.radiusResolutions[0]), true);
assert.equal(buildPipelineB314RadiusPlanJson(plan), buildPipelineB314RadiusPlanJson(resolvePipelineB314RadiusPlan(base)));
assert.equal(buildPipelineB314RadiusLedgerText(plan), buildPipelineB314RadiusLedgerText(resolvePipelineB314RadiusPlan(base)));

const dWrongMmMatch = resolvePipelineB314RadiusPlan({ ...fixture({ cold: { radiusD: 9, radiusMm: 15240 } }),
  b314RadiusPolicies: [elasticPolicy, sizeBandPolicy] });
const coldWrongD = dWrongMmMatch.radiusResolutions.find((item) => item.candidateId === 'cold');
assert.equal(coldWrongD.candidateRadiusDisposition, 'REQUIRES_RECOMPUTE');
assert.ok(coldWrongD.blockerCodes.includes('PIPELINE_B314_RADIUS_OBSERVED_BASIS_CONFLICT'));

const mmWrongDMatch = resolvePipelineB314RadiusPlan({ ...fixture({ cold: { radiusD: 30, radiusMm: 9999 } }),
  b314RadiusPolicies: [elasticPolicy, sizeBandPolicy] });
const coldWrongMm = mmWrongDMatch.radiusResolutions.find((item) => item.candidateId === 'cold');
assert.equal(coldWrongMm.candidateRadiusDisposition, 'REQUIRES_RECOMPUTE');
assert.ok(coldWrongMm.blockerCodes.includes('PIPELINE_B314_RADIUS_OBSERVED_BASIS_CONFLICT'));

const emitted = resolvePipelineB314RadiusPlan({
  ...fixture({ cold: { radiusD: 9, radiusMm: 15240 }, coldStatus: 'EMITTED' }),
  b314RadiusPolicies: [elasticPolicy, sizeBandPolicy],
});
const emittedCold = emitted.radiusResolutions.find((item) => item.candidateId === 'cold');
assert.ok(emittedCold.blockerCodes.includes('PIPELINE_B314_RADIUS_EMITTED_RADIUS_CONFLICT'));

const dOnly = resolvePipelineB314RadiusPlan({ ...fixture({ cold: { radiusD: 30, radiusMm: null } }),
  b314RadiusPolicies: [elasticPolicy, sizeBandPolicy] });
const dOnlyCold = dOnly.radiusResolutions.find((item) => item.candidateId === 'cold');
assert.equal(dOnlyCold.observedCandidateRadiusD, 30);
assert.equal(dOnlyCold.observedCandidateRadiusMm, 15240);
console.log('pipeline-3d-model B31.4 radius resolution: PASS');
