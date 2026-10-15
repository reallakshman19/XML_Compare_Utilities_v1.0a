import assert from 'node:assert/strict';
import {
  buildPipelineGreVendorSeriesLedgerText,
  buildPipelineGreVendorSeriesPlanJson,
  resolvePipelineGreVendorSeriesPlan,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-gre-vendor-series-resolution.js';

const section = (id, start, profileId, mode) => ({ schema: 'PipelineAnalysisSection.v1',
  analysisSectionId: id, startElementIndex: start, profileId, mode, boundaryAuthority: 'TEST',
  boundarySourceReference: '', sourceAuthority: 'TEST', sourceReference: '', status: 'CONTRACT_ONLY',
  diagnostics: [], blockerCodes: [] });
const element = (index, id, profileId, mode, start) => ({ schema: 'PipelineElementSectionResolution.v1',
  elementIndex: index, elementId: `E${index + 1}`, analysisSectionId: id, profileId, resolvedMode: mode,
  sectionDisposition: start ? 'SECTION_START' : 'INHERITED', boundaryNode: start ? 100 + index : null,
  sourceAuthority: 'TEST', sourceReference: '', diagnostics: [], blockerCodes: [], ready: true });
function fixture({ placeholderActive = false } = {}) {
  const sections = [section('AS1', 0, 'gre', 'GRE'), section('AS2', 2, 'normal-metallic', 'NORMAL')];
  const elements = [element(0, 'AS1', 'gre', 'GRE', true), element(1, 'AS1', 'gre', 'GRE', false),
    element(2, 'AS2', 'normal-metallic', 'NORMAL', true), element(3, 'AS2', 'normal-metallic', 'NORMAL', false)];
  const values = [{ outsideDiameterMm: 400, nominalPipeSizeNps: null, greVendorNominalBoreMm: 254 },
    { outsideDiameterMm: 114.3, nominalPipeSizeNps: 4, greVendorNominalBoreMm: null }];
  const diameterSections = sections.map((item, index) => ({ schema: 'PipelineAnalysisDiameterResolution.v1',
    analysisSectionId: item.analysisSectionId, profileId: item.profileId, resolvedMode: item.mode,
    startElementIndex: item.startElementIndex, ...values[index], caesarDiameterMm: values[index].outsideDiameterMm,
    physicalDiameterReady: true, sizeBandInputReady: values[index].nominalPipeSizeNps != null,
    vendorSeriesInputReady: values[index].greVendorNominalBoreMm != null, sourceKind: 'EXPLICIT',
    sourceAuthority: 'TEST', sourceReference: '', quantitySources: {}, status: 'RESOLVED',
    diagnostics: [], blockerCodes: [], ready: true }));
  const diameterElements = elements.map((item) => {
    const owner = diameterSections.find((candidate) => candidate.analysisSectionId === item.analysisSectionId);
    return { schema: 'PipelineElementDiameterResolution.v1', elementIndex: item.elementIndex, elementId: item.elementId,
      analysisSectionId: item.analysisSectionId, profileId: item.profileId, outsideDiameterMm: owner.outsideDiameterMm,
      nominalPipeSizeNps: owner.nominalPipeSizeNps, greVendorNominalBoreMm: owner.greVendorNominalBoreMm,
      caesarDiameterMm: owner.caesarDiameterMm, propertyDiameterMm: null, diameterDisposition: item.sectionDisposition,
      sourceKind: 'EXPLICIT', diagnostics: [], blockerCodes: [], ready: true };
  });
  return { analysisSectionPlan: { schema: 'PipelineAnalysisSectionPlan.v1', sections,
    elementResolutions: elements, diagnostics: [], blockerCodes: [], ready: true },
  analysisDiameterPlan: { schema: 'PipelineAnalysisDiameterPlan.v1',
    analysisSectionPlanSchema: 'PipelineAnalysisSectionPlan.v1', propertySectionPlanSchema: 'PipelinePropertySectionPlan.v1',
    migration: { schema: 'PipelineDiameterMigration.v1', outsideDiameterSourceKinds: ['EXPLICIT'],
      nominalPipeSizeSourceKinds: ['EXPLICIT'], greVendorNominalBoreSourceKinds: ['EXPLICIT'],
      legacyDiameterEvidenceObserved: false, legacyDiameterBasisConfirmed: false,
      npsToOutsideDiameterConversionApplied: false, greVendorBoreToOutsideDiameterConversionApplied: false,
      sourceAuthority: 'TEST', sourceReference: '', diagnostics: [], blockerCodes: [], ready: true },
    sectionResolutions: diameterSections, elementResolutions: diameterElements,
    diagnostics: [], blockerCodes: [], ready: true },
  grePlaceholder: { schema: 'PipelineGreFittingPlaceholder.v1', active: placeholderActive,
    policyReady: false, resolverReady: false, geometryApplied: false, inputXmlApplied: false,
    requirementReference: placeholderActive ? 'LEGACY-REQ' : '', bend: { radiusBasis: 'GRE_PLACEHOLDER',
      radiusMm: placeholderActive ? 700 : null, breakLengthBasis: 'NOMINAL_BORE',
      nominalBoreMm: placeholderActive ? 254 : null, breakMultiplierBore: 1.5,
      breakLengthMm: placeholderActive ? 381 : null, localThicknessMm: placeholderActive ? 10 : null,
      resolverReady: false }, tee: { breakLengthBasis: 'CUSTOM_LENGTH',
      breakLengthMm: placeholderActive ? 280 : null, localThicknessMm: placeholderActive ? 12 : null,
      resolverReady: false } } };
}
const series = (overrides = {}) => ({ vendorId: 'VENDOR-254', seriesId: 'SERIES-254',
  qualificationEvidenceId: 'QUAL-254', requirementReference: 'REQ-550', greVendorNominalBoreMm: 254,
  bendPolicyId: 'gre-vendor-qualified-bend', bendRadiusMm: 762,
  bendBreakLengthBasis: 'NOMINAL_BORE_MULTIPLIER', bendBreakMultiplierBore: 1.5,
  bendBreakLengthMm: 381, bendLocalThicknessMm: 12, teePolicyId: 'gre-vendor-qualified-tee',
  teeBreakLengthBasis: 'EXPLICIT_LENGTH', teeBreakLengthMm: 300, teeLocalThicknessMm: 14,
  sourceAuthority: 'PROJECT', sourceReference: 'REF-254', ...overrides });
const legacy = { settings: { designBasis: 'gre' }, legacyGreVendorSeriesBasisConfirmed: true,
  legacyGreVendorId: 'LEGACY-VENDOR', legacyGreSeriesId: 'LEGACY-SERIES',
  legacyGreQualificationEvidenceId: 'LEGACY-QUAL', sourceAuthority: 'LEGACY', sourceReference: 'SETTINGS-1' };

const explicit = { ...fixture(), greVendorSeriesSections: [{ analysisSectionId: 'AS1', ...series() }] };
const plan = resolvePipelineGreVendorSeriesPlan(explicit);
assert.equal(plan.ready, true);
assert.equal(plan.sectionResolutions.length, 1);
assert.equal(plan.elementResolutions.length, 2);
assert.deepEqual(plan.notApplicableAnalysisSectionIds, ['AS2']);
assert.equal(plan.sectionResolutions[0].bendBreakLengthMm, 381);
assert.notEqual(plan.sectionResolutions[0].bendBreakLengthMm, 400 * 1.5);
assert.equal(plan.elementResolutions[0].vendorId, plan.sectionResolutions[0].vendorId);
assert.equal(Object.isFrozen(plan.sectionResolutions[0]), true);
assert.equal(buildPipelineGreVendorSeriesPlanJson(plan), buildPipelineGreVendorSeriesPlanJson(resolvePipelineGreVendorSeriesPlan(explicit)));
assert.equal(buildPipelineGreVendorSeriesLedgerText(plan), buildPipelineGreVendorSeriesLedgerText(resolvePipelineGreVendorSeriesPlan(explicit)));

const global = resolvePipelineGreVendorSeriesPlan({ ...fixture(), greVendorSeriesGlobal: [series()] });
assert.equal(global.ready, true);
assert.equal(global.sectionResolutions[0].sourceKind, 'EXPLICIT_GLOBAL_GRE_VENDOR_SERIES');
const legacyPlan = resolvePipelineGreVendorSeriesPlan({ ...fixture({ placeholderActive: true }), ...legacy });
assert.equal(legacyPlan.ready, true);
assert.equal(legacyPlan.sectionResolutions[0].sourceKind, 'CONFIRMED_LEGACY_GRE_PLACEHOLDER');
assert.deepEqual(legacyPlan.migration.legacyAnalysisSectionIds, ['AS1']);
const invalidHigh = resolvePipelineGreVendorSeriesPlan({ ...fixture({ placeholderActive: true }), ...legacy,
  greVendorSeriesSections: [{ analysisSectionId: 'AS1', ...series({ bendRadiusMm: true }) }],
  greVendorSeriesGlobal: [series()] });
assert.equal(invalidHigh.ready, false);
assert.equal(invalidHigh.sectionResolutions[0].sourceKind, 'EXPLICIT_ANALYSIS_SECTION_VENDOR_SERIES');
const noNearest = resolvePipelineGreVendorSeriesPlan({ ...fixture(), greVendorSeriesGlobal: [
  series({ greVendorNominalBoreMm: 253, bendBreakLengthMm: 379.5 }),
  series({ greVendorNominalBoreMm: 255, bendBreakLengthMm: 382.5 })] });
assert.ok(noNearest.blockerCodes.includes('PIPELINE_GRE_VENDOR_AUTHORITY_UNRESOLVED'));

for (const [field, value] of [['vendorId', true], ['seriesId', 123],
  ['qualificationEvidenceId', ['QUAL']], ['sourceAuthority', {}]]) {
  const result = resolvePipelineGreVendorSeriesPlan({ ...fixture(),
    greVendorSeriesSections: [{ analysisSectionId: 'AS1', ...series(), [field]: value }] });
  assert.equal(result.ready, false, `${field} must reject a non-string inventory value`);
}
for (const [field, value] of [['legacyGreVendorId', true], ['legacyGreSeriesId', 123],
  ['legacyGreQualificationEvidenceId', ['QUAL']], ['sourceAuthority', {}]]) {
  assert.equal(resolvePipelineGreVendorSeriesPlan({ ...fixture({ placeholderActive: true }),
    ...legacy, [field]: value }).ready, false, `${field} must reject a non-string legacy value`);
}
for (const active of [false, true]) for (const [part, field, value] of [
  ['bend', 'radiusMm', {}], ['bend', 'nominalBoreMm', true],
  ['bend', 'breakMultiplierBore', []], ['tee', 'localThicknessMm', {}]]) {
  const malformed = fixture({ placeholderActive: active });
  malformed.grePlaceholder[part][field] = value;
  const result = resolvePipelineGreVendorSeriesPlan({ ...malformed, greVendorSeriesGlobal: [series()] });
  assert.doesNotThrow(() => resolvePipelineGreVendorSeriesPlan({ ...malformed, greVendorSeriesGlobal: [series()] }));
  assert.equal(result.ready, false, `${part}.${field} must block for active=${active}`);
}
const inconsistent = fixture();
inconsistent.grePlaceholder.bend.nominalBoreMm = 254;
inconsistent.grePlaceholder.bend.breakLengthMm = 400;
assert.equal(resolvePipelineGreVendorSeriesPlan({ ...inconsistent, greVendorSeriesGlobal: [series()] }).ready, false);
const explicitMultiplier = fixture();
explicitMultiplier.grePlaceholder.bend.breakLengthBasis = 'EXPLICIT_LENGTH';
assert.equal(resolvePipelineGreVendorSeriesPlan({ ...explicitMultiplier, greVendorSeriesGlobal: [series()] }).ready, false);

const forged = fixture();
forged.analysisDiameterPlan.ready = false;
assert.equal(resolvePipelineGreVendorSeriesPlan({ ...forged, greVendorSeriesGlobal: [series()] }).ready, false);
const converted = fixture();
converted.analysisDiameterPlan.migration.greVendorBoreToOutsideDiameterConversionApplied = true;
assert.ok(resolvePipelineGreVendorSeriesPlan({ ...converted, greVendorSeriesGlobal: [series()] })
  .blockerCodes.includes('PIPELINE_GRE_VENDOR_DIAMETER_PLAN_INVALID'));
const orphan = fixture();
orphan.analysisSectionPlan.sections[1].startElementIndex = orphan.analysisSectionPlan.elementResolutions.length;
orphan.analysisDiameterPlan.sectionResolutions[1].startElementIndex = orphan.analysisSectionPlan.elementResolutions.length;
assert.ok(resolvePipelineGreVendorSeriesPlan({ ...orphan, greVendorSeriesGlobal: [series()] })
  .blockerCodes.includes('PIPELINE_GRE_VENDOR_OWNERSHIP_INVALID'));
const cyclic = {}; cyclic.self = cyclic;
for (const malformed of [null, [], cyclic, { analysisSectionPlan: { sections: [null] } },
  { ...fixture(), greVendorSeriesGlobal: [null] }]) {
  assert.doesNotThrow(() => resolvePipelineGreVendorSeriesPlan(malformed));
  assert.equal(resolvePipelineGreVendorSeriesPlan(malformed).ready, false);
}

console.log('pipeline-3d-model GRE vendor-series resolution: PASS');
