import assert from 'node:assert/strict';
import {
  PIPELINE_GRE_VENDOR_POLICY_IDS,
  PIPELINE_GRE_VENDOR_SERIES_POLICY_REGISTRY,
  createPipelineGreVendorSeriesElementResolution,
  createPipelineGreVendorSeriesMigration,
  createPipelineGreVendorSeriesPlan,
  createPipelineGreVendorSeriesSectionResolution,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-gre-vendor-series-contracts.js';

assert.deepEqual(PIPELINE_GRE_VENDOR_SERIES_POLICY_REGISTRY.descriptors.map((item) => item.componentPolicyId), [
  'gre-vendor-qualified-bend', 'gre-vendor-qualified-tee',
]);
assert.equal(PIPELINE_GRE_VENDOR_SERIES_POLICY_REGISTRY.ready, true);
assert.equal(Object.isFrozen(PIPELINE_GRE_VENDOR_SERIES_POLICY_REGISTRY.descriptors[0]), true);

const sectionInput = {
  analysisSectionId: 'AS1', startElementIndex: 0, profileId: 'gre',
  vendorId: 'VENDOR-A', seriesId: 'SERIES-254', qualificationEvidenceId: 'QUAL-1',
  requirementReference: 'REQ-550', greVendorNominalBoreMm: 254,
  bendPolicyId: PIPELINE_GRE_VENDOR_POLICY_IDS.BEND, bendRadiusMm: 762,
  bendBreakLengthBasis: 'NOMINAL_BORE_MULTIPLIER', bendBreakMultiplierBore: 1.5,
  bendBreakLengthMm: 381, bendLocalThicknessMm: 12,
  teePolicyId: PIPELINE_GRE_VENDOR_POLICY_IDS.TEE, teeBreakLengthBasis: 'EXPLICIT_LENGTH',
  teeBreakLengthMm: 300, teeLocalThicknessMm: 14,
  sourceKind: 'EXPLICIT_ANALYSIS_SECTION_VENDOR_SERIES', sourceAuthority: 'PROJECT', sourceReference: 'VS-1',
};
const section = createPipelineGreVendorSeriesSectionResolution(sectionInput);
assert.equal(section.ready, true);
assert.equal(section.bendBreakLengthMm, 381);
assert.equal(Object.isFrozen(section), true);

const explicit = createPipelineGreVendorSeriesSectionResolution({
  ...sectionInput, bendBreakLengthBasis: 'EXPLICIT_LENGTH', bendBreakMultiplierBore: null, bendBreakLengthMm: 425,
});
assert.equal(explicit.ready, true);
assert.equal(explicit.bendBreakMultiplierBore, null);
assert.ok(createPipelineGreVendorSeriesSectionResolution({ ...sectionInput, bendBreakLengthMm: 400 })
  .blockerCodes.includes('PIPELINE_GRE_VENDOR_BEND_INPUT_INVALID'));
assert.ok(createPipelineGreVendorSeriesSectionResolution({ ...explicit, bendBreakMultiplierBore: 1.5 })
  .blockerCodes.includes('PIPELINE_GRE_VENDOR_BEND_INPUT_INVALID'));
assert.ok(createPipelineGreVendorSeriesSectionResolution({ ...sectionInput, teeLocalThicknessMm: null })
  .blockerCodes.includes('PIPELINE_GRE_VENDOR_TEE_INPUT_INVALID'));

const invalidTypes = [
  ['vendorId', true],
  ['seriesId', 123],
  ['qualificationEvidenceId', ['QUAL-1']],
  ['sourceAuthority', {}],
];
for (const [field, value] of invalidTypes) {
  const result = createPipelineGreVendorSeriesSectionResolution({ ...sectionInput, [field]: value });
  assert.equal(result.ready, false, `${field} must reject ${typeof value}`);
  assert.ok(result.blockerCodes.includes('PIPELINE_GRE_VENDOR_IDENTITY_INVALID')
    || result.blockerCodes.includes('PIPELINE_GRE_VENDOR_QUALIFICATION_REQUIRED'));
}

const diagnosticOnlyBlocked = createPipelineGreVendorSeriesSectionResolution({
  analysisSectionId: 'AS1', startElementIndex: 0, profileId: 'gre', greVendorNominalBoreMm: 254,
  sourceKind: 'UNRESOLVED', status: 'BLOCKED',
  diagnostics: [{ severity: 'BLOCKING', code: 'PIPELINE_GRE_VENDOR_AUTHORITY_UNRESOLVED', message: 'blocked', details: {} }],
});
assert.equal(diagnosticOnlyBlocked.ready, false);
assert.equal(diagnosticOnlyBlocked.blockerCodes.includes('PIPELINE_GRE_VENDOR_IDENTITY_INVALID'), false);

const elementInput = {
  elementIndex: 0, elementId: 'E1', analysisSectionId: 'AS1', profileId: 'gre',
  vendorId: 'VENDOR-A', seriesId: 'SERIES-254', greVendorNominalBoreMm: 254,
  sectionDisposition: 'SECTION_START', sourceKind: 'EXPLICIT_ANALYSIS_SECTION_VENDOR_SERIES',
};
const inheritedInput = { ...elementInput, elementIndex: 1, elementId: 'E2', sectionDisposition: 'INHERITED' };
const element = createPipelineGreVendorSeriesElementResolution(elementInput);
assert.equal(element.ready, true);
assert.equal(Object.isFrozen(element), true);
assert.equal(createPipelineGreVendorSeriesElementResolution({ ...elementInput, vendorId: true }).ready, false);

const migration = createPipelineGreVendorSeriesMigration({
  sourceKinds: ['EXPLICIT_ANALYSIS_SECTION_VENDOR_SERIES'], legacyEvidenceObserved: false,
});
assert.equal(migration.ready, true);
const planInput = {
  analysisSectionPlanSchema: 'PipelineAnalysisSectionPlan.v1',
  analysisDiameterPlanSchema: 'PipelineAnalysisDiameterPlan.v1',
  grePlaceholderSchema: 'PipelineGreFittingPlaceholder.v1', migration,
  sectionResolutions: [section],
  elementResolutions: [element, createPipelineGreVendorSeriesElementResolution(inheritedInput)],
  notApplicableAnalysisSectionIds: ['AS2'],
};
const plan = createPipelineGreVendorSeriesPlan(planInput);
assert.equal(plan.ready, true);
assert.equal(Object.isFrozen(plan.sectionResolutions), true);
assert.doesNotThrow(() => JSON.stringify(plan));

for (const [field, value] of [
  ['profileId', 'normal-metallic'],
  ['vendorId', 'VENDOR-B'],
  ['seriesId', 'SERIES-300'],
  ['greVendorNominalBoreMm', 300],
  ['sourceKind', 'EXPLICIT_GLOBAL_GRE_VENDOR_SERIES'],
]) {
  const mismatched = createPipelineGreVendorSeriesPlan({
    ...planInput, elementResolutions: [{ ...elementInput, [field]: value }, inheritedInput],
  });
  assert.equal(mismatched.ready, false, `${field} mismatch must block`);
  assert.ok(mismatched.blockerCodes.includes('PIPELINE_GRE_VENDOR_ELEMENT_COVERAGE_INVALID'));
}

const empty = createPipelineGreVendorSeriesPlan({
  analysisSectionPlanSchema: 'PipelineAnalysisSectionPlan.v1',
  analysisDiameterPlanSchema: 'PipelineAnalysisDiameterPlan.v1',
  grePlaceholderSchema: 'PipelineGreFittingPlaceholder.v1', migration,
  sectionResolutions: [], elementResolutions: [], notApplicableAnalysisSectionIds: [],
});
assert.equal(empty.ready, false);
assert.ok(empty.blockerCodes.includes('PIPELINE_GRE_VENDOR_SECTION_COVERAGE_INVALID'));

const noElements = createPipelineGreVendorSeriesPlan({ ...planInput, elementResolutions: [] });
assert.equal(noElements.ready, false);
assert.ok(noElements.blockerCodes.includes('PIPELINE_GRE_VENDOR_ELEMENT_COVERAGE_INVALID'));
const noStart = createPipelineGreVendorSeriesPlan({ ...planInput,
  elementResolutions: [{ ...inheritedInput, elementIndex: 2, elementId: 'E3' }] });
assert.equal(noStart.ready, false);
const orphan = createPipelineGreVendorSeriesPlan({ ...planInput,
  elementResolutions: [{ ...elementInput, analysisSectionId: 'AS9' }] });
assert.equal(orphan.ready, false);

const wrongMigration = createPipelineGreVendorSeriesMigration({
  sourceKinds: ['EXPLICIT_GLOBAL_GRE_VENDOR_SERIES'], legacyEvidenceObserved: false,
});
const migrationMismatch = createPipelineGreVendorSeriesPlan({ ...planInput, migration: wrongMigration });
assert.equal(migrationMismatch.ready, false);
assert.ok(migrationMismatch.blockerCodes.includes('PIPELINE_GRE_VENDOR_SOURCE_CONFLICT'));
const falseLegacy = createPipelineGreVendorSeriesMigration({
  sourceKinds: ['CONFIRMED_LEGACY_GRE_PLACEHOLDER'], legacyAnalysisSectionIds: ['AS1'],
  legacyEvidenceObserved: true, legacyGreVendorSeriesBasisConfirmed: true,
});
assert.equal(createPipelineGreVendorSeriesPlan({ ...planInput, migration: falseLegacy }).ready, false);

const sectionAtTwo = { ...sectionInput, startElementIndex: 2 };
const sectionTwoAtZero = { ...sectionInput, analysisSectionId: 'AS2', startElementIndex: 0 };
const as2Start = { ...elementInput, analysisSectionId: 'AS2' };
const as2Inherited = { ...as2Start, elementIndex: 1, elementId: 'E2', sectionDisposition: 'INHERITED' };
const as1StartAtTwo = { ...elementInput, elementIndex: 2, elementId: 'E3' };
const reversed = createPipelineGreVendorSeriesPlan({ ...planInput, notApplicableAnalysisSectionIds: [],
  sectionResolutions: [sectionAtTwo, sectionTwoAtZero],
  elementResolutions: [as2Start, as2Inherited, as1StartAtTwo],
});
assert.equal(reversed.ready, false);
assert.ok(reversed.blockerCodes.includes('PIPELINE_GRE_VENDOR_SECTION_COVERAGE_INVALID'));
const preStart = createPipelineGreVendorSeriesPlan({ ...planInput, notApplicableAnalysisSectionIds: [],
  sectionResolutions: [sectionAtTwo], elementResolutions: [
    { ...elementInput, sectionDisposition: 'INHERITED' }, as1StartAtTwo,
  ],
});
assert.equal(preStart.ready, false);
assert.ok(preStart.blockerCodes.includes('PIPELINE_GRE_VENDOR_ELEMENT_COVERAGE_INVALID'));

assert.doesNotThrow(() => createPipelineGreVendorSeriesPlan({ sectionResolutions: [null], elementResolutions: {},
  notApplicableAnalysisSectionIds: [] }));
assert.equal(createPipelineGreVendorSeriesPlan({ sectionResolutions: [null], elementResolutions: {},
  notApplicableAnalysisSectionIds: [] }).ready, false);

console.log('pipeline-3d-model GRE vendor-series contracts: PASS');
