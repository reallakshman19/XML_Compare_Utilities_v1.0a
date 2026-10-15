import assert from 'node:assert/strict';
import {
  PIPELINE_INPUTXML_FITTING_AUTHORITY_SCHEMA,
  PIPELINE_INPUTXML_PROFILE_AUTHORITY_PLAN_SCHEMA,
  PIPELINE_INPUTXML_PROFILE_ELEMENT_AUTHORITY_SCHEMA,
  PIPELINE_INPUTXML_PROFILE_SECTION_AUTHORITY_SCHEMA,
  buildPipelineInputXmlProfileAuthorityPlan,
  buildPipelineInputXmlProfileAuthorityPlanJson,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-profile-authority.js';
import { createPipelineAnalysisSectionPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-analysis-section-contracts.js';
import { createPipelineAnalysisDiameterPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-diameter-contracts.js';
import { createPipelineNormalFittingPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-normal-fitting-contracts.js';
import { createPipelineB314RadiusPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-b314-radius-contracts.js';
import { createPipelineGreVendorSeriesPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-gre-vendor-series-contracts.js';
import { resolvePipelinePropertySectionPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-property-sections.js';

const profiles = [
  ['AS1', 0, 'normal-metallic', 'NORMAL', 100, 4, null],
  ['AS2', 2, 'asme-b31.4', 'ASME_B31_4', 200, 20, null],
  ['AS3', 4, 'gre', 'GRE', 300, null, 254],
];
const cleanMigration = (sourceKinds, authority = 'TEST') => ({
  sourceKinds, legacyEvidenceObserved: false, sourceAuthority: authority, sourceReference: 'FIXTURE',
  diagnostics: [], blockerCodes: [], ready: true,
});
const candidate = (id, incoming, nodes, bendClass, radiusD, radiusMm) => ({
  id, incomingElementIndex: incoming, outgoingElementIndex: incoming + 1,
  previousNode: nodes[0], cornerNode: nodes[1], nextNode: nodes[2],
  classification: 'HORIZONTAL', sourceBasis: 'GEOMETRY', bendClass,
  radiusD, radiusMm, bendTypeCode: 0, turnAngleDeg: 90,
  curvatureNodes: [{ angleDeg: 45, nodeNumber: nodes[1] - 5 }],
  fittingThicknessMm: null, kfactor: null, status: 'EMITTED',
});
export const profileRows = Object.freeze(Array.from({ length: 7 }, (_, index) => Object.freeze({
  nodeNumber: 100 + index * 10, x: index * 1000, y: 0, z: 0,
  nodeName: `NODE-${index + 1}`, lineNo: 'PL-048',
})));

function analysisPlan() {
  const sections = profiles.map(([id, start, profileId]) => ({
    analysisSectionId: id, startElementIndex: start, profileId,
    boundaryAuthority: 'TEST', boundarySourceReference: `NODE-${start}`,
    sourceAuthority: 'TEST', sourceReference: 'FIXTURE', status: 'CONTRACT_ONLY',
    diagnostics: [], blockerCodes: [],
  }));
  const elementResolutions = Array.from({ length: 6 }, (_, elementIndex) => {
    const owner = profiles.filter((item) => item[1] <= elementIndex).at(-1);
    return {
      elementIndex, elementId: `E${elementIndex + 1}`, analysisSectionId: owner[0],
      profileId: owner[2], resolvedMode: owner[3],
      sectionDisposition: owner[1] === elementIndex ? 'SECTION_START' : 'INHERITED',
      boundaryNode: owner[1] === elementIndex ? 100 + elementIndex * 10 : null,
      sourceAuthority: 'TEST', sourceReference: 'FIXTURE', diagnostics: [], blockerCodes: [], ready: true,
    };
  });
  return createPipelineAnalysisSectionPlan({ sections, elementResolutions, diagnostics: [], blockerCodes: [] });
}
function diameterPlan(analysis) {
  const sectionResolutions = profiles.map(([id, start, profileId, resolvedMode,
    outsideDiameterMm, nominalPipeSizeNps, greVendorNominalBoreMm]) => ({
    analysisSectionId: id, profileId, resolvedMode, startElementIndex: start,
    outsideDiameterMm, nominalPipeSizeNps, greVendorNominalBoreMm,
    caesarDiameterMm: outsideDiameterMm, sourceKind: 'EXPLICIT',
    sourceAuthority: 'TEST', sourceReference: 'FIXTURE', quantitySources: {},
    diagnostics: [], blockerCodes: [],
  }));
  const elementResolutions = analysis.elementResolutions.map((item) => {
    const owner = sectionResolutions.find((section) => section.analysisSectionId === item.analysisSectionId);
    return {
      elementIndex: item.elementIndex, elementId: item.elementId,
      analysisSectionId: item.analysisSectionId, profileId: item.profileId,
      outsideDiameterMm: owner.outsideDiameterMm, nominalPipeSizeNps: owner.nominalPipeSizeNps,
      greVendorNominalBoreMm: owner.greVendorNominalBoreMm, caesarDiameterMm: owner.caesarDiameterMm,
      propertyDiameterMm: owner.caesarDiameterMm, diameterDisposition: item.sectionDisposition,
      sourceKind: 'EXPLICIT', diagnostics: [], blockerCodes: [],
    };
  });
  return createPipelineAnalysisDiameterPlan({
    analysisSectionPlanSchema: 'PipelineAnalysisSectionPlan.v1',
    propertySectionPlanSchema: 'PipelinePropertySectionPlan.v1',
    migration: {
      outsideDiameterSourceKinds: ['EXPLICIT'], nominalPipeSizeSourceKinds: ['EXPLICIT'],
      greVendorNominalBoreSourceKinds: ['EXPLICIT'], legacyDiameterEvidenceObserved: false,
      legacyDiameterBasisConfirmed: false, npsToOutsideDiameterConversionApplied: false,
      greVendorBoreToOutsideDiameterConversionApplied: false,
      sourceAuthority: 'TEST', sourceReference: 'FIXTURE', diagnostics: [], blockerCodes: [],
    },
    sectionResolutions, elementResolutions, diagnostics: [], blockerCodes: [],
  });
}
function normalPlan() {
  return createPipelineNormalFittingPlan({
    analysisSectionPlanSchema: 'PipelineAnalysisSectionPlan.v1',
    analysisDiameterPlanSchema: 'PipelineAnalysisDiameterPlan.v1',
    bendResolutionSchema: 'PipelineBendResolution.v3',
    migration: { ...cleanMigration(['EXPLICIT_GLOBAL_NORMAL_POLICY']),
      legacyNormalFittingBasisConfirmed: false },
    fittingResolutions: [{
      candidateId: 'bend:110', incomingElementIndex: 0, incomingElementId: 'E1',
      outgoingElementIndex: 1, outgoingElementId: 'E2', analysisSectionId: 'AS1',
      profileId: 'normal-metallic', previousNode: 100, cornerNode: 110, nextNode: 120,
      geometricClass: 'HORIZONTAL', turnAngleDeg: 90, sourceBasis: 'GEOMETRY',
      fittingPolicyId: 'normal-standard-elbow', fittingKind: 'STANDARD_ELBOW',
      radiusBasis: 'NORMAL_STANDARD_ELBOW_RADIUS_D', outsideDiameterMm: 100,
      radiusD: 1.5, radiusMm: 150, observedCandidateRadiusD: 1.5,
      observedCandidateRadiusMm: 150, candidateStatus: 'EMITTED',
      candidateRadiusDisposition: 'MATCHES_AUTHORITY', geometryRecheckRequired: false,
      sourceKind: 'EXPLICIT_GLOBAL_NORMAL_POLICY', sourceAuthority: 'TEST', sourceReference: 'NORMAL',
      diagnostics: [], blockerCodes: [],
    }],
    notApplicableCandidateIds: ['bend:130'], diagnostics: [], blockerCodes: [],
  });
}
function b314Plan() {
  return createPipelineB314RadiusPlan({
    analysisSectionPlanSchema: 'PipelineAnalysisSectionPlan.v1',
    analysisDiameterPlanSchema: 'PipelineAnalysisDiameterPlan.v1',
    bendResolutionSchema: 'PipelineBendResolution.v3',
    migration: { ...cleanMigration(['EXPLICIT_GLOBAL_B31_4_POLICY']),
      legacyB314RadiusBasisConfirmed: false, legacySettingsNpsObserved: null,
      legacySettingsNpsMatchedCanonical: false },
    radiusResolutions: [{
      candidateId: 'bend:130', incomingElementIndex: 2, incomingElementId: 'E3',
      outgoingElementIndex: 3, outgoingElementId: 'E4', analysisSectionId: 'AS2',
      profileId: 'asme-b31.4', previousNode: 120, cornerNode: 130, nextNode: 140,
      geometricClass: 'HORIZONTAL', turnAngleDeg: 90, sourceBasis: 'GEOMETRY', bendClass: 'cold-field',
      radiusPolicyId: 'b31.4-cold-field-size-band', radiusBasis: 'B31_4_COLD_FIELD_SIZE_BAND_GOVERNING',
      outsideDiameterMm: 200, nominalPipeSizeNps: 20, sizeBandInputReady: true,
      formulaEnabled: false, youngsModulusMpa: null, allowableBendingStressMpa: null,
      formulaRadiusD: null, formulaRadiusMm: null, practicalEnabled: false,
      practicalRadiusD: null, practicalRadiusMm: null, normalCodeRadiusD: 30,
      qualifiedAlternativeRequested: false, qualificationEligible: true,
      qualificationEvidenceId: '', qualifiedAlternativeApplied: false, selectedCodeRadiusD: 30,
      projectMinimumEnabled: false, projectMinimumRadiusD: null, procedureMinimumRadiusD: null,
      projectRadiusD: null, governingRadiusD: 30, governingRadiusMm: 6000,
      observedCandidateRadiusD: 30, observedCandidateRadiusMm: 6000,
      candidateStatus: 'EMITTED', candidateRadiusDisposition: 'MATCHES_AUTHORITY',
      geometryRecheckRequired: false, sourceKind: 'EXPLICIT_GLOBAL_B31_4_POLICY',
      sourceAuthority: 'TEST', sourceReference: 'B314', diagnostics: [], blockerCodes: [],
    }],
    notApplicableCandidateIds: ['bend:110'], diagnostics: [], blockerCodes: [],
  });
}
function grePlan(analysis) {
  const section = {
    analysisSectionId: 'AS3', startElementIndex: 4, profileId: 'gre',
    vendorId: 'VENDOR-A', seriesId: 'SERIES-254', qualificationEvidenceId: 'QUAL-1',
    requirementReference: 'REQ-1', greVendorNominalBoreMm: 254,
    bendPolicyId: 'gre-vendor-qualified-bend', bendRadiusMm: 762,
    bendBreakLengthBasis: 'NOMINAL_BORE_MULTIPLIER', bendBreakMultiplierBore: 3,
    bendBreakLengthMm: 762, bendLocalThicknessMm: 14,
    teePolicyId: 'gre-vendor-qualified-tee', teeBreakLengthBasis: 'EXPLICIT_LENGTH',
    teeBreakLengthMm: 508, teeLocalThicknessMm: 16,
    sourceKind: 'EXPLICIT_GLOBAL_GRE_VENDOR_SERIES', sourceAuthority: 'TEST',
    sourceReference: 'GRE', diagnostics: [], blockerCodes: [],
  };
  const elementResolutions = analysis.elementResolutions.slice(4).map((item) => ({
    elementIndex: item.elementIndex, elementId: item.elementId, analysisSectionId: 'AS3',
    profileId: 'gre', vendorId: section.vendorId, seriesId: section.seriesId,
    greVendorNominalBoreMm: 254, sectionDisposition: item.sectionDisposition,
    sourceKind: section.sourceKind, diagnostics: [], blockerCodes: [],
  }));
  return createPipelineGreVendorSeriesPlan({
    analysisSectionPlanSchema: 'PipelineAnalysisSectionPlan.v1',
    analysisDiameterPlanSchema: 'PipelineAnalysisDiameterPlan.v1',
    grePlaceholderSchema: 'PipelineGrePlaceholder.v1',
    migration: {
      sourceKinds: ['EXPLICIT_GLOBAL_GRE_VENDOR_SERIES'], legacyAnalysisSectionIds: [],
      legacyEvidenceObserved: false, legacyGreVendorSeriesBasisConfirmed: false,
      sourceAuthority: 'TEST', sourceReference: 'GRE', diagnostics: [], blockerCodes: [],
    },
    sectionResolutions: [section], elementResolutions,
    notApplicableAnalysisSectionIds: ['AS1', 'AS2'], diagnostics: [], blockerCodes: [],
  });
}
export function authorityFixture() {
  const analysisSectionPlan = analysisPlan(), analysisDiameterPlan = diameterPlan(analysisSectionPlan);
  const propertySectionPlan = resolvePipelinePropertySectionPlan({
    branchInfo: {
      lineNo: 'PL-048', diameter: 100, wallThickness: 6,
      insulationThickness: 0, corrosionAllowance: 0, insulationDensity: 0,
      fluidDensity: 0, materialNumber: 1,
    },
    coordinateRows: profileRows,
    propertySections: [{ startElementIndex: 2, diameter: 200 },
      { startElementIndex: 4, diameter: 300 }],
  });
  const normalCandidate = candidate('bend:110', 0, [100, 110, 120], 'standard', 1.5, 150);
  const b314Candidate = candidate('bend:130', 2, [120, 130, 140], 'cold-field', 30, 6000);
  return {
    analysisSectionPlan, analysisDiameterPlan, propertySectionPlan,
    bendResolution: {
      schema: 'PipelineBendResolution.v3', candidates: [normalCandidate, b314Candidate],
      bendByIncomingElementIndex: {
        0: structuredClone(normalCandidate), 2: structuredClone(b314Candidate),
      },
      errors: [], hasBlockingErrors: false,
    },
    normalFittingPlan: normalPlan(), b314RadiusPlan: b314Plan(),
    greVendorSeriesPlan: grePlan(analysisSectionPlan),
  };
}
export function withGreTurn(input = authorityFixture()) {
  const value = structuredClone(input);
  const turn = candidate('bend:150', 4, [140, 150, 160], 'gre-placeholder', 3, 762);
  value.bendResolution.candidates.push(turn);
  value.bendResolution.bendByIncomingElementIndex[4] = structuredClone(turn);
  value.normalFittingPlan.notApplicableCandidateIds.push(turn.id);
  value.b314RadiusPlan.notApplicableCandidateIds.push(turn.id);
  return value;
}

const plan = buildPipelineInputXmlProfileAuthorityPlan(authorityFixture());
assert.equal(plan.schema, PIPELINE_INPUTXML_PROFILE_AUTHORITY_PLAN_SCHEMA);
assert.equal(plan.sectionAuthorities[0].schema, PIPELINE_INPUTXML_PROFILE_SECTION_AUTHORITY_SCHEMA);
assert.equal(plan.elementAuthorities[0].schema, PIPELINE_INPUTXML_PROFILE_ELEMENT_AUTHORITY_SCHEMA);
assert.equal(plan.fittingAuthorities[0].schema, PIPELINE_INPUTXML_FITTING_AUTHORITY_SCHEMA);
assert.equal(plan.ready, true);
assert.equal(plan.elementAuthorities[0].caesarDiameterMm, 100);
assert.equal(plan.elementAuthorities[0].geometryDisposition, 'MATCHES_AUTHORITY');
assert.equal(plan.elementAuthorities[4].geometryDisposition, 'NOT_A_TURN');
assert.equal(plan.fittingAuthorities[1].bendClass, 'cold-field');
assert.equal(Object.isFrozen(plan.fittingAuthorities[0].bendGeometry.curvatureNodes[0]), true);
assert.equal(buildPipelineInputXmlProfileAuthorityPlanJson(plan),
  buildPipelineInputXmlProfileAuthorityPlanJson(buildPipelineInputXmlProfileAuthorityPlan(authorityFixture())));

function blocked(mutator, code) {
  const input = structuredClone(authorityFixture()); mutator(input);
  const result = buildPipelineInputXmlProfileAuthorityPlan(input);
  assert.equal(result.ready, false); assert.ok(result.blockerCodes.includes(code), JSON.stringify(result.blockerCodes));
}
blocked((v) => { v.analysisSectionPlan.elementResolutions[0].analysisSectionId = 'AS2'; },
  'PIPELINE_INPUTXML_AUTHORITY_OWNERSHIP_INVALID');
blocked((v) => { v.analysisSectionPlan.sections[1].startElementIndex = 1; },
  'PIPELINE_INPUTXML_AUTHORITY_OWNERSHIP_INVALID');
blocked((v) => { v.propertySectionPlan.blockerCodes = ['PIPELINE_DIAMETER_REQUIRED']; },
  'PIPELINE_INPUTXML_PROPERTY_CONFLICT');
blocked((v) => {
  v.propertySectionPlan.diagnostics = [{ severity: 'BLOCKING', code: 'PIPELINE_DIAMETER_REQUIRED',
    message: 'The first element of the LINE scope requires a positive DIAMETER.', details: {} }];
  v.propertySectionPlan.ready = false;
}, 'PIPELINE_INPUTXML_PROPERTY_CONFLICT');
blocked((v) => { delete v.greVendorSeriesPlan.sectionResolutions[0].teePolicyId; }, 'PIPELINE_INPUTXML_AUTHORITY_COVERAGE_INVALID');
blocked((v) => { delete v.greVendorSeriesPlan.sectionResolutions[0].bendBreakLengthMm; }, 'PIPELINE_INPUTXML_AUTHORITY_COVERAGE_INVALID');
blocked((v) => { v.greVendorSeriesPlan.sectionResolutions[0].bendPolicyId = 'invalid'; }, 'PIPELINE_INPUTXML_AUTHORITY_COVERAGE_INVALID');
blocked((v) => { v.greVendorSeriesPlan.migration.sourceKinds = []; }, 'PIPELINE_INPUTXML_AUTHORITY_COVERAGE_INVALID');
blocked((v) => { v.greVendorSeriesPlan.sectionResolutions[0].greVendorNominalBoreMm = 300; }, 'PIPELINE_INPUTXML_AUTHORITY_COVERAGE_INVALID');
blocked((v) => { v.analysisDiameterPlan.sectionResolutions[0].physicalDiameterReady = false; }, 'PIPELINE_INPUTXML_DIAMETER_CONFLICT');
blocked((v) => { v.propertySectionPlan.elements[0].properties.diameter = -1; }, 'PIPELINE_INPUTXML_PROPERTY_CONFLICT');
blocked((v) => { v.propertySectionPlan.elements[0].properties.wallThickness = {}; }, 'PIPELINE_INPUTXML_PROPERTY_CONFLICT');
blocked((v) => { v.propertySectionPlan.elements[0].properties.materialNumber = true; }, 'PIPELINE_INPUTXML_PROPERTY_CONFLICT');
blocked((v) => { delete v.normalFittingPlan.fittingResolutions[0].radiusBasis; }, 'PIPELINE_INPUTXML_AUTHORITY_COVERAGE_INVALID');
blocked((v) => { v.normalFittingPlan.fittingResolutions[0].profileId = 'asme-b31.4'; }, 'PIPELINE_INPUTXML_AUTHORITY_COVERAGE_INVALID');
blocked((v) => { v.b314RadiusPlan.radiusResolutions[0].previousNode = 999; }, 'PIPELINE_INPUTXML_AUTHORITY_COVERAGE_INVALID');
for (const mutate of [
  (g) => { g.bendTypeCode = 2; },
  (g) => { g.curvatureNodes[0].angleDeg = 10; },
  (g) => { g.curvatureNodes[0].nodeNumber = 999999; },
  (g) => { g.previousNode = 999; },
  (g) => { g.nextNode = 999; },
  (g) => { g.sourceBasis = 'FORGED'; },
  (g) => { g.classification = 'VERTICAL'; },
  (g) => { g.curvatureNodes.push({ angleDeg: 60, nodeNumber: 106 }); },
]) blocked((v) => mutate(v.bendResolution.bendByIncomingElementIndex[0]),
  'PIPELINE_INPUTXML_AUTHORITY_OWNERSHIP_INVALID');
const greTurn = buildPipelineInputXmlProfileAuthorityPlan(withGreTurn());
assert.equal(greTurn.ready, false);
assert.ok(greTurn.blockerCodes.includes('PIPELINE_INPUTXML_GRE_BEND_GEOMETRY_REQUIRED'));
for (const malformed of [null, [], { analysisSectionPlan: { sections: [null] } }]) {
  assert.doesNotThrow(() => buildPipelineInputXmlProfileAuthorityPlan(malformed));
  assert.equal(buildPipelineInputXmlProfileAuthorityPlan(malformed).ready, false);
}
console.log('pipeline-3d-model InputXML profile authority: PASS');
