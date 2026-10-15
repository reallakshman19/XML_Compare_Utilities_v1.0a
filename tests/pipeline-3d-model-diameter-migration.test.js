import assert from 'node:assert/strict';
import { resolvePipelineAnalysisDiameterPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-diameter-resolution.js';

const analysis = (profileId = 'normal-metallic') => ({
  schema: 'PipelineAnalysisSectionPlan.v1', ready: true, blockerCodes: [],
  sections: [{ analysisSectionId: 'AS1', startElementIndex: 0, profileId }],
  elementResolutions: [{ elementIndex: 0, elementId: 'E1', analysisSectionId: 'AS1', profileId,
    resolvedMode: profileId === 'gre' ? 'GRE' : profileId === 'asme-b31.4' ? 'ASME_B31_4' : 'NORMAL',
    sectionDisposition: 'SECTION_START' }],
});
const property = (diameter = 114.3) => ({
  schema: 'PipelinePropertySectionPlan.v1', ready: true, blockerCodes: [],
  sections: [{ sectionId: 'S1', startElementIndex: 0 }],
  elements: [{ elementIndex: 0, elementId: 'E1', sectionId: 'S1', properties: { diameter },
    effectiveSources: { diameter: 'S1' } }],
});
const resolve = (extra = {}) => resolvePipelineAnalysisDiameterPlan({
  analysisSectionPlan: analysis(), propertySectionPlan: property(), ...extra,
});
const blocked = (plan, code) => {
  assert.equal(plan.ready, false);
  assert.ok(plan.blockerCodes.includes(code), `${code} expected in ${plan.blockerCodes}`);
};

const explicit = resolve({ outsideDiameterMm: 120, branchInfo: { boreMm: 114.3 } });
assert.equal(explicit.ready, true);
assert.equal(explicit.sectionResolutions[0].outsideDiameterMm, 120);
assert.equal(explicit.migration.legacyDiameterEvidenceObserved, false);
const setting = resolve({ settings: { diameterSource: 'explicit-od', explicitOutsideDiameterMm: ' 121.5 ' } });
assert.equal(setting.ready, true);
assert.equal(setting.sectionResolutions[0].outsideDiameterMm, 121.5);
const confirmed = resolve({ settings: { diameterSource: 'branch-diameter', diameterBasisConfirmed: true } });
assert.equal(confirmed.ready, true);
assert.equal(confirmed.sectionResolutions[0].outsideDiameterMm, 114.3);
blocked(resolve({}), 'PIPELINE_DIAMETER_BASIS_UNCONFIRMED');
blocked(resolve({ outsideDiameterMm: true }), 'PIPELINE_OUTSIDE_DIAMETER_INVALID');
blocked(resolve({ settings: { diameterSource: 'branch-diameter', diameterBasisConfirmed: true },
  branchInfo: { boreMm: 120 } }), 'PIPELINE_OUTSIDE_DIAMETER_CONFLICT');

const gre = resolvePipelineAnalysisDiameterPlan({
  analysisSectionPlan: analysis('gre'), propertySectionPlan: property(null), greVendorNominalBoreMm: 200,
});
assert.equal(gre.ready, true);
assert.equal(gre.sectionResolutions[0].caesarDiameterMm, null);
assert.equal(gre.migration.greVendorBoreToOutsideDiameterConversionApplied, false);

for (const malformed of [
  { propertySectionPlan: { schema: 'PipelinePropertySectionPlan.v1', ready: true, elements: {} } },
  { analysisSectionPlan: { ...analysis(), sections: [null] } },
  { analysisSectionPlan: { ...analysis(), elementResolutions: [null] } },
  { diameterSections: [null] }, { diameterSections: [3] },
  { diameterSections: [{ analysisSectionId: 'AS1', startElementIndex: '0', outsideDiameterMm: 120 }] },
  { diameterSections: [{ analysisSectionId: 'BAD', startElementIndex: 0, outsideDiameterMm: 120 }] },
  { analysisPropertyReseedPlan: { schema: 'PipelineAnalysisPropertyReseedPlan.v1', ready: true,
    propertySectionPlan: { schema: 'PipelinePropertySectionPlan.v1', ready: true, elements: {} } } },
]) {
  const result = resolve({ ...malformed });
  assert.equal(result.ready, false);
  assert.ok(result.blockerCodes.includes('PIPELINE_DIAMETER_INPUT_INVALID'));
}
const fakeReady = resolve({ analysisSectionPlan: { ...analysis(), blockerCodes: ['UPSTREAM_BLOCKER'] } });
blocked(fakeReady, 'PIPELINE_DIAMETER_INPUT_INVALID');

console.log('Pipeline diameter legacy migration tests passed.');
