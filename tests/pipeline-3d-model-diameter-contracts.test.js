import assert from 'node:assert/strict';
import {
  PIPELINE_DIAMETER_SEMANTIC_REGISTRY,
  PIPELINE_DIAMETER_BASIS_IDS,
  createPipelineDiameterSemanticRegistry,
  createPipelineDiameterMigration,
  createPipelineAnalysisDiameterResolution,
  createPipelineElementDiameterResolution,
  createPipelineAnalysisDiameterPlan,
  parsePipelinePositiveScalar,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-diameter-contracts.js';

const frozen = (value) => !value || typeof value !== 'object'
  || (Object.isFrozen(value) && Object.values(value).every(frozen));
const section = (patch = {}) => createPipelineAnalysisDiameterResolution({
  analysisSectionId: 'AS1', startElementIndex: 0, profileId: 'normal-metallic', resolvedMode: 'NORMAL',
  outsideDiameterMm: 114.3, caesarDiameterMm: 114.3, sourceKind: 'EXPLICIT_GLOBAL', ...patch,
});
const element = (patch = {}) => createPipelineElementDiameterResolution({
  elementIndex: 0, elementId: 'E1', analysisSectionId: 'AS1', profileId: 'normal-metallic',
  outsideDiameterMm: 114.3, caesarDiameterMm: 114.3, diameterDisposition: 'SECTION_START',
  sourceKind: 'EXPLICIT_GLOBAL', ...patch,
});
const blocked = (value, code) => {
  assert.equal(value.ready, false);
  assert.ok(value.blockerCodes.includes(code), `${code} expected in ${value.blockerCodes}`);
};

assert.deepEqual(Object.values(PIPELINE_DIAMETER_BASIS_IDS), [
  'outside-diameter-mm', 'nominal-pipe-size-nps', 'gre-vendor-nominal-bore-mm',
]);
assert.equal(PIPELINE_DIAMETER_SEMANTIC_REGISTRY.ready, true);
assert.ok(frozen(PIPELINE_DIAMETER_SEMANTIC_REGISTRY));
const reversed = [...PIPELINE_DIAMETER_SEMANTIC_REGISTRY.descriptors].reverse();
blocked(createPipelineDiameterSemanticRegistry(reversed), 'PIPELINE_DIAMETER_BASIS_INVALID');

for (const value of [114.3, ' 114.3 ']) assert.equal(parsePipelinePositiveScalar(value), 114.3);
for (const value of [true, false, [114.3], { value: 114.3 }, '', ' ', 0, -1, NaN, Infinity]) {
  assert.equal(parsePipelinePositiveScalar(value), null);
}

assert.equal(section().ready, true);
for (const patch of [{ profileId: 'unknown-profile' }, { profileId: 'Normal-Metallic' }, { resolvedMode: 'GRE' }]) {
  blocked(section(patch), 'PIPELINE_DIAMETER_PROFILE_INCOMPATIBLE');
}
blocked(section({ outsideDiameterMm: null, caesarDiameterMm: null }), 'PIPELINE_OUTSIDE_DIAMETER_REQUIRED');
blocked(section({ profileId: 'gre', resolvedMode: 'GRE', outsideDiameterMm: null, caesarDiameterMm: null }),
  'PIPELINE_GRE_VENDOR_BORE_REQUIRED');
blocked(section({ greVendorNominalBoreMm: 100 }), 'PIPELINE_DIAMETER_PROFILE_INCOMPATIBLE');
blocked(section({ sourceKind: '' }), 'PIPELINE_DIAMETER_INPUT_INVALID');
blocked(element({ elementId: 'E9' }), 'PIPELINE_DIAMETER_INPUT_INVALID');
blocked(element({ profileId: 'gre', outsideDiameterMm: null, caesarDiameterMm: null }),
  'PIPELINE_GRE_VENDOR_BORE_REQUIRED');

blocked(createPipelineDiameterMigration({ legacyDiameterEvidenceObserved: true }),
  'PIPELINE_DIAMETER_BASIS_UNCONFIRMED');
blocked(createPipelineDiameterMigration({ npsToOutsideDiameterConversionApplied: true }),
  'PIPELINE_DIAMETER_BASIS_INVALID');
const migration = createPipelineDiameterMigration();
assert.equal(migration.ready, true);
assert.equal(migration.npsToOutsideDiameterConversionApplied, false);
assert.equal(migration.greVendorBoreToOutsideDiameterConversionApplied, false);

const planInput = {
  analysisSectionPlanSchema: 'PipelineAnalysisSectionPlan.v1',
  propertySectionPlanSchema: 'PipelinePropertySectionPlan.v1', migration,
  sectionResolutions: [section()], elementResolutions: [element()],
};
const readyPlan = createPipelineAnalysisDiameterPlan(planInput);
assert.equal(readyPlan.ready, true);
assert.ok(frozen(readyPlan));
blocked(createPipelineAnalysisDiameterPlan({ ...planInput, analysisSectionPlanSchema: 'Wrong.v1' }),
  'PIPELINE_DIAMETER_INPUT_INVALID');
blocked(createPipelineAnalysisDiameterPlan({ ...planInput, sectionResolutions: [section({ analysisSectionId: 'AS2' })] }),
  'PIPELINE_DIAMETER_SECTION_COVERAGE_INVALID');
blocked(createPipelineAnalysisDiameterPlan({ ...planInput,
  elementResolutions: [element({ elementIndex: 0, elementId: 'E1', analysisSectionId: 'AS2' })] }),
  'PIPELINE_DIAMETER_SECTION_COVERAGE_INVALID');
const blockedSection = section({ blockerCodes: ['PIPELINE_DIAMETER_SOURCE_CONFLICT'] });
const nested = createPipelineAnalysisDiameterPlan({ ...planInput, sectionResolutions: [blockedSection] });
blocked(nested, 'PIPELINE_DIAMETER_SOURCE_CONFLICT');
const reordered = createPipelineAnalysisDiameterPlan({ ...planInput,
  sectionResolutions: [section({ analysisSectionId: 'AS2', startElementIndex: 1 }), section()],
  elementResolutions: [element({ elementIndex: 1, elementId: 'E2', analysisSectionId: 'AS2', diameterDisposition: 'SECTION_START' }), element()],
});
assert.equal(reordered.ready, true);
assert.deepEqual(reordered.sectionResolutions.map((item) => item.analysisSectionId), ['AS1', 'AS2']);
assert.deepEqual(reordered.elementResolutions.map((item) => item.elementId), ['E1', 'E2']);

console.log('Pipeline diameter semantic contract tests passed.');
