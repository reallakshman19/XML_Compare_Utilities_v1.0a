import assert from 'node:assert/strict';
import { resolvePipelineAnalysisDiameterPlan, buildPipelineAnalysisDiameterPlanJson,
  buildPipelineAnalysisDiameterLedgerText } from '../tabs/pipeline-3d-model/pipeline-3d-model-diameter-resolution.js';

function analysis(definitions, count) {
  const sections = definitions.map((item, index) => ({ analysisSectionId: `AS${index + 1}`,
    startElementIndex: item.start, profileId: item.profileId }));
  return { schema: 'PipelineAnalysisSectionPlan.v1', ready: true, blockerCodes: [], sections,
    elementResolutions: Array.from({ length: count }, (_, elementIndex) => {
      const owner = sections.filter((item) => item.startElementIndex <= elementIndex).at(-1);
      return { elementIndex, elementId: `E${elementIndex + 1}`, analysisSectionId: owner.analysisSectionId,
        profileId: owner.profileId, resolvedMode: owner.profileId === 'asme-b31.4' ? 'ASME_B31_4' : 'NORMAL',
        sectionDisposition: owner.startElementIndex === elementIndex ? 'SECTION_START' : 'INHERITED' };
    }) };
}
function property(values, starts = [0]) {
  const sections = starts.map((start, index) => ({ sectionId: `S${index + 1}`, startElementIndex: start }));
  return { schema: 'PipelinePropertySectionPlan.v1', ready: true, blockerCodes: [], sections,
    elements: values.map((diameter, elementIndex) => {
      const owner = sections.filter((item) => item.startElementIndex <= elementIndex).at(-1);
      return { elementIndex, elementId: `E${elementIndex + 1}`, sectionId: owner.sectionId,
        properties: { diameter }, effectiveSources: { diameter: owner.sectionId } };
    }) };
}
const frozen = (value) => !value || typeof value !== 'object'
  || (Object.isFrozen(value) && Object.values(value).every(frozen));
const alignedAnalysis = analysis([{ start: 0, profileId: 'normal-metallic' },
  { start: 2, profileId: 'asme-b31.4' }], 4);
const alignedProperty = property([100, 100, 120, 120], [0, 2]);
const aligned = resolvePipelineAnalysisDiameterPlan({ analysisSectionPlan: alignedAnalysis,
  propertySectionPlan: alignedProperty,
  settings: { diameterSource: 'branch-diameter', diameterBasisConfirmed: true } });
assert.equal(aligned.ready, true);
assert.deepEqual(aligned.sectionResolutions.map((item) => item.outsideDiameterMm), [100, 120]);
assert.deepEqual(aligned.elementResolutions.map((item) => item.analysisSectionId), ['AS1', 'AS1', 'AS2', 'AS2']);
assert.deepEqual(aligned.elementResolutions.map((item) => item.diameterDisposition),
  ['SECTION_START', 'INHERITED', 'SECTION_START', 'INHERITED']);

const inside = resolvePipelineAnalysisDiameterPlan({
  analysisSectionPlan: analysis([{ start: 0, profileId: 'normal-metallic' }], 4),
  propertySectionPlan: property([100, 100, 120, 120], [0, 2]),
  settings: { diameterSource: 'branch-diameter', diameterBasisConfirmed: true },
});
assert.equal(inside.ready, false);
assert.ok(inside.blockerCodes.includes('PIPELINE_DIAMETER_CHANGE_REQUIRES_ANALYSIS_SECTION'));
const invalidInherited = resolvePipelineAnalysisDiameterPlan({
  analysisSectionPlan: analysis([{ start: 0, profileId: 'normal-metallic' }], 2),
  propertySectionPlan: property([100, true]),
  settings: { diameterSource: 'branch-diameter', diameterBasisConfirmed: true },
});
assert.equal(invalidInherited.ready, false);
assert.ok(invalidInherited.blockerCodes.includes('PIPELINE_OUTSIDE_DIAMETER_INVALID'));

const badOwnership = analysis([{ start: 0, profileId: 'normal-metallic' },
  { start: 1, profileId: 'asme-b31.4' }], 2);
badOwnership.elementResolutions[1] = { ...badOwnership.elementResolutions[1], analysisSectionId: 'AS1',
  profileId: 'normal-metallic', resolvedMode: 'NORMAL', sectionDisposition: 'INHERITED' };
const ownershipResult = resolvePipelineAnalysisDiameterPlan({ analysisSectionPlan: badOwnership,
  propertySectionPlan: property([100, 100]), outsideDiameterMm: 100 });
assert.equal(ownershipResult.ready, false);
assert.ok(ownershipResult.blockerCodes.includes('PIPELINE_DIAMETER_SECTION_COVERAGE_INVALID'));
const badIds = analysis([{ start: 0, profileId: 'normal-metallic' }], 2);
badIds.elementResolutions[0].elementId = 'E9';
assert.equal(resolvePipelineAnalysisDiameterPlan({ analysisSectionPlan: badIds,
  propertySectionPlan: property([100, 100]), outsideDiameterMm: 100 }).ready, false);

const reorderedProperty = { ...alignedProperty, elements: [...alignedProperty.elements].reverse() };
const repeat = resolvePipelineAnalysisDiameterPlan({ propertySectionPlan: reorderedProperty,
  analysisSectionPlan: alignedAnalysis,
  settings: { diameterBasisConfirmed: true, diameterSource: 'branch-diameter' } });
assert.equal(JSON.stringify(aligned), JSON.stringify(repeat));
assert.equal(buildPipelineAnalysisDiameterPlanJson(aligned), buildPipelineAnalysisDiameterPlanJson(repeat));
assert.equal(buildPipelineAnalysisDiameterLedgerText(aligned), buildPipelineAnalysisDiameterLedgerText(repeat));
assert.ok(frozen(aligned));

console.log('Pipeline analysis-section diameter resolution tests passed.');
