import assert from 'node:assert/strict';
import {
  PIPELINE_SECTION_PROFILE_ROUTING_PLAN_SCHEMA,
  buildPipelineSectionProfileRoutingPlan,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-section-profile-routing.js';

const profiles = ['normal-metallic', 'asme-b31.4', 'gre'];
const canonical = Object.freeze({
  schema: 'PipelineAnalysisSectionPlan.v1', ready: true,
  sections: Object.freeze(profiles.map((profileId, index) => Object.freeze({
    analysisSectionId: `AS${index + 1}`, startElementIndex: index * 2, profileId,
  }))),
  elementResolutions: Object.freeze(Array.from({ length: 6 }, (_, elementIndex) => {
    const owner = Math.floor(elementIndex / 2);
    return Object.freeze({ elementIndex, elementId: `E${elementIndex + 1}`,
      analysisSectionId: `AS${owner + 1}`, profileId: profiles[owner] });
  })),
});
const candidates = Object.freeze([0, 2, 4].map((incomingElementIndex, index) => Object.freeze({
  id: `B${index + 1}`, incomingElementIndex, outgoingElementIndex: incomingElementIndex + 1,
})));
function route(candidateValues = candidates, plan = canonical) {
  return buildPipelineSectionProfileRoutingPlan({ canonicalAnalysisSectionPlan: plan,
    bendResolution: { schema: 'PipelineBendResolution.v3', candidates: candidateValues } });
}

const result = route();
assert.equal(result.schema, PIPELINE_SECTION_PROFILE_ROUTING_PLAN_SCHEMA);
assert.equal(result.ready, true);
assert.equal(result.fallbackApplied, false);
assert.deepEqual(result.coverageCounts, { candidateCount: 3, ownedCandidateCount: 3,
  normalCandidateCount: 1, b314CandidateCount: 1, greCandidateCount: 1,
  unownedCandidateCount: 0, duplicateCandidateCount: 0 });
assert.deepEqual(result.profileRoutes['normal-metallic'], ['B1']);
assert.deepEqual(result.profileRoutes['asme-b31.4'], ['B2']);
assert.deepEqual(result.profileRoutes.gre, ['B3']);

const duplicate = route([...candidates, { ...candidates[2], incomingElementIndex: 5,
  outgoingElementIndex: 6 }]);
assert.equal(duplicate.ready, false);
assert.ok(duplicate.blockerCodes.includes('PIPELINE_SECTION_PROFILE_ROUTING_DUPLICATE_CANDIDATE'));
const crossing = route([{ id: 'CROSS', incomingElementIndex: 1, outgoingElementIndex: 2 }]);
assert.equal(crossing.ready, false);
assert.ok(crossing.blockerCodes.includes('PIPELINE_SECTION_PROFILE_ROUTING_UNOWNED_CANDIDATE'));
const invalidPlan = structuredClone(canonical);
invalidPlan.elementResolutions[4].profileId = 'normal-metallic';
const invalid = route([candidates[2]], invalidPlan);
assert.equal(invalid.ready, false);
assert.ok(invalid.blockerCodes.includes('PIPELINE_SECTION_PROFILE_ROUTING_PROFILE_INVALID'));

console.log('pipeline-3d-model section profile routing: PASS');
