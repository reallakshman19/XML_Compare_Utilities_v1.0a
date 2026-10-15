import assert from 'node:assert/strict';
import {
  resolvePipelineB314RadiusPlan,
  buildPipelineB314RadiusPlanJson,
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
function fixture({ includeNormal = false } = {}) {
  const sections = [section('AS1', 0, 'asme-b31.4')];
  const elements = [element(0, 'AS1', 'asme-b31.4', true), element(1, 'AS1', 'asme-b31.4', false)];
  if (includeNormal) {
    sections.push(section('AS2', 2, 'normal-metallic'));
    elements.push(element(2, 'AS2', 'normal-metallic', true), element(3, 'AS2', 'normal-metallic', false));
  }
  const diameterSections = sections.map((item) => ({
    schema: 'PipelineAnalysisDiameterResolution.v1', analysisSectionId: item.analysisSectionId,
    profileId: item.profileId, resolvedMode: item.profileId === 'asme-b31.4' ? 'ASME_B31_4' : 'NORMAL',
    startElementIndex: item.startElementIndex, outsideDiameterMm: item.profileId === 'asme-b31.4' ? 508 : 114.3,
    nominalPipeSizeNps: item.profileId === 'asme-b31.4' ? 20 : 4, greVendorNominalBoreMm: null,
    caesarDiameterMm: item.profileId === 'asme-b31.4' ? 508 : 114.3, physicalDiameterReady: true,
    sizeBandInputReady: true, vendorSeriesInputReady: false, sourceKind: 'EXPLICIT',
    sourceAuthority: 'TEST', sourceReference: '', quantitySources: {}, status: 'RESOLVED',
    diagnostics: [], blockerCodes: [], ready: true,
  }));
  const diameterElements = elements.map((item) => {
    const owner = diameterSections.find((candidate) => candidate.analysisSectionId === item.analysisSectionId);
    return { schema: 'PipelineElementDiameterResolution.v1', elementIndex: item.elementIndex,
      elementId: item.elementId, analysisSectionId: item.analysisSectionId, profileId: item.profileId,
      outsideDiameterMm: owner.outsideDiameterMm, nominalPipeSizeNps: owner.nominalPipeSizeNps,
      greVendorNominalBoreMm: null, caesarDiameterMm: owner.caesarDiameterMm, propertyDiameterMm: null,
      diameterDisposition: item.sectionDisposition, sourceKind: 'EXPLICIT',
      diagnostics: [], blockerCodes: [], ready: true };
  });
  const candidates = [{ id: 'bend:110', incomingElementIndex: 0, outgoingElementIndex: 1,
    previousNode: 100, cornerNode: 110, nextNode: 120, classification: 'VERTICAL',
    sourceBasis: 'TABLE_2_PROFILE_ONLY', turnAngleDeg: 5, bendClass: 'elastic',
    radiusD: 500, radiusMm: 254000, geometryFits: true, status: 'READY_NOT_EMITTED' }];
  if (includeNormal) candidates.push({ id: 'bend:130', incomingElementIndex: 2, outgoingElementIndex: 3,
    previousNode: 120, cornerNode: 130, nextNode: 140, classification: 'HORIZONTAL',
    sourceBasis: 'TABLE_1_PLAN', turnAngleDeg: 90, bendClass: 'standard',
    radiusD: 1.5, radiusMm: 171.45, geometryFits: true, status: 'READY_NOT_EMITTED' });
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
    bendResolution: { schema: 'PipelineBendResolution.v3', candidates },
  };
}
const elasticPolicy = { bendClass: 'elastic', radiusPolicyId: 'b31.4-elastic-screening',
  formulaEnabled: true, youngsModulusMpa: 207000, allowableBendingStressMpa: 100,
  practicalEnabled: true, practicalRadiusD: 500, sourceAuthority: 'PROJECT', sourceReference: 'P1' };
const coldProject = { bendClass: 'cold-field', radiusPolicyId: 'b31.4-cold-field-project-radius-d',
  projectRadiusD: 30, sourceAuthority: 'PROJECT', sourceReference: 'C1' };
const base = { ...fixture(), b314RadiusPolicies: [elasticPolicy] };
assert.equal(resolvePipelineB314RadiusPlan(base).ready, true);

const forgedRoot = structuredClone(base);
forgedRoot.analysisSectionPlan.ready = false;
assert.equal(resolvePipelineB314RadiusPlan(forgedRoot).ready, false);

const blockedMigration = structuredClone(base);
blockedMigration.analysisDiameterPlan.migration.blockerCodes = ['PIPELINE_DIAMETER_BASIS_UNCONFIRMED'];
blockedMigration.analysisDiameterPlan.migration.ready = false;
const blockedMigrationResult = resolvePipelineB314RadiusPlan(blockedMigration);
assert.equal(blockedMigrationResult.ready, false);
assert.ok(blockedMigrationResult.blockerCodes.includes('PIPELINE_B314_RADIUS_DIAMETER_PLAN_INVALID'));

const wrongReferences = structuredClone(base);
wrongReferences.analysisDiameterPlan.propertySectionPlanSchema = 'ForgedPropertyPlan.v1';
assert.equal(resolvePipelineB314RadiusPlan(wrongReferences).ready, false);

const wrongDiameterNestedSchema = structuredClone(base);
wrongDiameterNestedSchema.analysisDiameterPlan.sectionResolutions[0].schema = 'ForgedDiameterSection.v1';
assert.equal(resolvePipelineB314RadiusPlan(wrongDiameterNestedSchema).ready, false);

const profileMismatch = structuredClone(base);
profileMismatch.analysisSectionPlan.elementResolutions[0].profileId = 'normal-metallic';
profileMismatch.analysisSectionPlan.elementResolutions[0].resolvedMode = 'NORMAL';
const profileMismatchResult = resolvePipelineB314RadiusPlan(profileMismatch);
assert.equal(profileMismatchResult.ready, false);
assert.ok(profileMismatchResult.blockerCodes.includes('PIPELINE_B314_RADIUS_OWNERSHIP_INVALID'));

const wrongNestedSchema = structuredClone(base);
wrongNestedSchema.analysisSectionPlan.elementResolutions[0].schema = 'ForgedElement.v1';
assert.equal(resolvePipelineB314RadiusPlan(wrongNestedSchema).ready, false);

const wrongElementId = structuredClone(base);
wrongElementId.analysisSectionPlan.elementResolutions[0].elementId = 'E99';
const wrongElementResult = resolvePipelineB314RadiusPlan(wrongElementId);
assert.equal(wrongElementResult.ready, false);
assert.ok(wrongElementResult.blockerCodes.includes('PIPELINE_B314_RADIUS_OWNERSHIP_INVALID'));

const nestedBlocker = structuredClone(base);
nestedBlocker.analysisDiameterPlan.elementResolutions[0].blockerCodes = ['PIPELINE_DIAMETER_INPUT_INVALID'];
nestedBlocker.analysisDiameterPlan.elementResolutions[0].ready = false;
assert.equal(resolvePipelineB314RadiusPlan(nestedBlocker).ready, false);

for (const start of [2, 99]) {
  const orphan = fixture();
  orphan.analysisSectionPlan.sections.push(section('AS2', start, 'normal-metallic'));
  orphan.analysisDiameterPlan.sectionResolutions.push({
    ...orphan.analysisDiameterPlan.sectionResolutions[0], analysisSectionId: 'AS2',
    profileId: 'normal-metallic', resolvedMode: 'NORMAL', startElementIndex: start,
    outsideDiameterMm: 114.3, nominalPipeSizeNps: 4, caesarDiameterMm: 114.3,
  });
  assert.equal(resolvePipelineB314RadiusPlan({ ...orphan, b314RadiusPolicies: [elasticPolicy] }).ready, false,
    `orphan start ${start} must block`);
}

const forgedCases = [
  (value) => { value.analysisDiameterPlan.sectionResolutions[0].nominalPipeSizeNps = -1; },
  (value) => { value.analysisDiameterPlan.sectionResolutions[0].greVendorNominalBoreMm = 400;
    value.analysisDiameterPlan.sectionResolutions[0].vendorSeriesInputReady = true; },
  (value) => { value.analysisDiameterPlan.sectionResolutions[0].physicalDiameterReady = false; },
  (value) => { value.analysisDiameterPlan.sectionResolutions[0].sizeBandInputReady = false; },
  (value) => { value.analysisDiameterPlan.sectionResolutions[0].sourceKind = ''; },
  (value) => { value.analysisDiameterPlan.elementResolutions[0].sourceKind = ''; },
];
for (const forge of forgedCases) {
  const value = fixture(); forge(value);
  const result = resolvePipelineB314RadiusPlan({ ...value, b314RadiusPolicies: [elasticPolicy] });
  assert.equal(result.ready, false);
  assert.ok(result.blockerCodes.includes('PIPELINE_B314_RADIUS_DIAMETER_PLAN_INVALID'));
}

const incompatibleElastic = resolvePipelineB314RadiusPlan({ ...fixture(), b314RadiusPolicies: [
  { ...elasticPolicy, projectRadiusD: 30 },
] });
assert.equal(incompatibleElastic.ready, false);
assert.ok(incompatibleElastic.blockerCodes.includes('PIPELINE_B314_RADIUS_POLICY_INVALID'));

const incompatibleUnused = resolvePipelineB314RadiusPlan({ ...fixture(), b314RadiusPolicies: [
  elasticPolicy, { ...coldProject, formulaEnabled: true },
] });
assert.equal(incompatibleUnused.ready, false);
assert.ok(incompatibleUnused.blockerCodes.includes('PIPELINE_B314_RADIUS_POLICY_INVALID'));

const unusedGlobalQualification = resolvePipelineB314RadiusPlan({ ...fixture(), b314RadiusPolicies: [
  elasticPolicy, { bendClass: 'cold-field', radiusPolicyId: 'b31.4-cold-field-size-band',
    qualifiedAlternativeRequested: true, sourceAuthority: 'PROJECT', sourceReference: 'U1' },
] });
assert.equal(unusedGlobalQualification.ready, false);
assert.ok(unusedGlobalQualification.blockerCodes.includes('PIPELINE_B314_RADIUS_QUALIFICATION_EVIDENCE_REQUIRED'));

const unusedSectionQualification = resolvePipelineB314RadiusPlan({ ...fixture(),
  b314RadiusPolicies: [elasticPolicy], b314RadiusSections: [{ analysisSectionId: 'AS1',
    bendClass: 'cold-field', radiusPolicyId: 'b31.4-cold-field-size-band',
    qualifiedAlternativeRequested: true, sourceAuthority: 'PROJECT', sourceReference: 'U2' }] });
assert.equal(unusedSectionQualification.ready, false);
assert.ok(unusedSectionQualification.blockerCodes.includes('PIPELINE_B314_RADIUS_QUALIFICATION_EVIDENCE_REQUIRED'));

const unusedConflict = resolvePipelineB314RadiusPlan({ ...fixture(), b314RadiusPolicies: [
  elasticPolicy, coldProject, { ...coldProject, projectRadiusD: 31 },
] });
assert.equal(unusedConflict.ready, false);
assert.ok(unusedConflict.blockerCodes.includes('PIPELINE_B314_RADIUS_SOURCE_CONFLICT'));

const normalOverride = resolvePipelineB314RadiusPlan({ ...fixture({ includeNormal: true }),
  b314RadiusPolicies: [elasticPolicy], b314RadiusOverrides: [{ candidateId: 'bend:130',
    bendClass: 'cold-field', radiusPolicyId: 'b31.4-cold-field-project-radius-d', projectRadiusD: 30 }] });
assert.equal(normalOverride.ready, false);
assert.ok(normalOverride.blockerCodes.includes('PIPELINE_B314_RADIUS_TARGET_INVALID'));

const metadataConflict = resolvePipelineB314RadiusPlan({ ...fixture(), b314RadiusPolicies: [
  elasticPolicy, { ...elasticPolicy, sourceReference: 'P2' },
] });
assert.equal(metadataConflict.ready, false);
assert.ok(metadataConflict.blockerCodes.includes('PIPELINE_B314_RADIUS_SOURCE_CONFLICT'));

const equivalentA = { ...elasticPolicy, formulaEnabled: 'true', practicalEnabled: 'true' };
const equivalentB = { ...elasticPolicy };
const first = resolvePipelineB314RadiusPlan({ ...fixture(), b314RadiusPolicies: [equivalentA, equivalentB] });
const second = resolvePipelineB314RadiusPlan({ ...fixture(), b314RadiusPolicies: [equivalentB, equivalentA] });
assert.equal(first.ready, true);
assert.equal(buildPipelineB314RadiusPlanJson(first), buildPipelineB314RadiusPlanJson(second));

const explicitSuppressesLegacy = resolvePipelineB314RadiusPlan({ ...fixture(),
  b314RadiusPolicies: [elasticPolicy], settings: { designBasis: 'asme-b31.4', nominalPipeSizeNps: 18 } });
assert.equal(explicitSuppressesLegacy.ready, true);
assert.equal(explicitSuppressesLegacy.migration.legacyEvidenceObserved, false);
console.log('pipeline-3d-model B31.4 radius migration: PASS');
