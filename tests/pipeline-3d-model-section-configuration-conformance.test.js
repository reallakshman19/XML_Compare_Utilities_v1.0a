import assert from 'node:assert/strict';
import {
  PIPELINE_SECTION_CONFIGURATION_CONFORMANCE_SCHEMA,
  buildPipelineSectionConfigurationConformance,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-section-configuration-conformance.js';

const canonical = Object.freeze({
  schema: 'PipelineAnalysisSectionPlan.v1',
  ready: true,
  sections: Object.freeze([
    Object.freeze({ analysisSectionId: 'AS1', startElementIndex: 0,
      boundaryAuthority: 'SOURCE', boundarySourceReference: 'E1' }),
    Object.freeze({ analysisSectionId: 'AS2', startElementIndex: 2,
      boundaryAuthority: 'SOURCE', boundarySourceReference: 'E3' }),
    Object.freeze({ analysisSectionId: 'AS3', startElementIndex: 4,
      boundaryAuthority: 'SOURCE', boundarySourceReference: 'E5' }),
  ]),
});
const evidence = Object.freeze([
  Object.freeze({ analysisSectionId: 'AS1', startElementIndex: 0,
    profileId: 'normal-metallic', outsideDiameterMm: 100 }),
  Object.freeze({ analysisSectionId: 'AS2', startElementIndex: 2,
    profileId: 'asme-b31.4', outsideDiameterMm: 200, nominalPipeSizeNps: 8 }),
  Object.freeze({ analysisSectionId: 'AS3', startElementIndex: 4,
    profileId: 'gre', outsideDiameterMm: 250, greVendorNominalBoreMm: 200 }),
]);

const plan = buildPipelineSectionConfigurationConformance({
  canonicalAnalysisSectionPlan: canonical, sectionEvidence: evidence,
});
assert.equal(plan.schema, PIPELINE_SECTION_CONFIGURATION_CONFORMANCE_SCHEMA);
assert.equal(plan.ready, true);
assert.deepEqual(plan.configuredSections.map((item) => item.analysisSectionId), ['AS1', 'AS2', 'AS3']);
assert.deepEqual(plan.configuredSections.map((item) => item.startElementIndex), [0, 2, 4]);
assert.equal(Object.isFrozen(plan.configuredSections[0]), true);

function blocked(mutator, code) {
  const supplied = structuredClone(evidence);
  mutator(supplied);
  const result = buildPipelineSectionConfigurationConformance({
    canonicalAnalysisSectionPlan: canonical, sectionEvidence: supplied,
  });
  assert.equal(result.ready, false);
  assert.ok(result.blockerCodes.includes(code), JSON.stringify(result.blockerCodes));
}
blocked((items) => { items[1].startElementIndex = 3; }, 'PIPELINE_CONFIGURATION_SECTION_BOUNDARY_MOVED');
blocked((items) => { [items[0], items[1]] = [items[1], items[0]]; },
  'PIPELINE_CONFIGURATION_SECTION_EVIDENCE_REORDERED');
blocked((items) => { items.pop(); }, 'PIPELINE_CONFIGURATION_SECTION_EVIDENCE_MISSING');
blocked((items) => { items[1].analysisSectionId = 'AS1'; },
  'PIPELINE_CONFIGURATION_SECTION_EVIDENCE_DUPLICATE');
blocked((items) => { items[0].profileId = ''; }, 'PIPELINE_CONFIGURATION_PROFILE_REQUIRED');
blocked((items) => { items[1].nominalPipeSizeNps = null; }, 'PIPELINE_CONFIGURATION_B314_POLICY_REQUIRED');
blocked((items) => { items[2].greVendorNominalBoreMm = null; }, 'PIPELINE_CONFIGURATION_GRE_VENDOR_REQUIRED');

console.log('pipeline-3d-model section configuration conformance: PASS');
