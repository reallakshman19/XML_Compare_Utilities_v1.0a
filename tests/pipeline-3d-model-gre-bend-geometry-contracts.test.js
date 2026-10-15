import assert from 'node:assert/strict';
import {
  PIPELINE_GRE_BEND_BREAK_APPLICATIONS,
  createPipelineGreBendBreakApplicationAuthority,
  createPipelineGreBendGeometryCandidatePlan,
  createPipelineGreBendGeometryPlan,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-gre-bend-geometry-contracts.js';

assert.deepEqual(PIPELINE_GRE_BEND_BREAK_APPLICATIONS,
  ['EACH_LEG_FROM_CORNER', 'EACH_LEG_FROM_TANGENCY']);
const authority = createPipelineGreBendBreakApplicationAuthority({
  analysisSectionId: 'AS1', vendorId: 'V', seriesId: 'S', qualificationEvidenceId: 'Q',
  bendBreakLengthApplication: 'EACH_LEG_FROM_CORNER',
  sourceAuthority: 'VENDOR', sourceReference: 'CATALOG-1',
});
assert.equal(authority.ready, true);
assert.equal(Object.isFrozen(authority), true);
assert.equal(createPipelineGreBendBreakApplicationAuthority({
  ...authority, bendBreakLengthApplication: '',
}).ready, false);

const point = { x: 0, y: 0, z: 0 };
const candidate = createPipelineGreBendGeometryCandidatePlan({
  candidateId: 'bend:110', analysisSectionId: 'AS1', profileId: 'gre',
  incomingElementIndex: 0, outgoingElementIndex: 1, incomingElementId: 'E1', outgoingElementId: 'E2',
  previousNode: 100, cornerNode: 110, nextNode: 120, turnAngleDeg: 90,
  bendRadiusMm: 300, tangentLengthMm: 300, bendBreakLengthBasis: 'EXPLICIT_LENGTH',
  bendBreakLengthApplication: 'EACH_LEG_FROM_CORNER', bendBreakLengthMm: 400,
  bendLocalThicknessMm: 12, incomingAvailableLengthMm: 1000, outgoingAvailableLengthMm: 1000,
  incomingBreakDistanceFromCornerMm: 400, outgoingBreakDistanceFromCornerMm: 400,
  incomingTangencyPoint: point, outgoingTangencyPoint: point,
  incomingBreakPoint: point, outgoingBreakPoint: point,
  vendorId: 'V', seriesId: 'S', qualificationEvidenceId: 'Q', requirementReference: 'R',
  sourceAuthority: 'VENDOR', sourceReference: 'CATALOG-1',
  geometryFits: true, breakEnvelopeFits: true, sharedSegmentFits: true,
});
assert.equal(candidate.ready, true);
const plan = createPipelineGreBendGeometryPlan({
  bendResolutionSchema: 'PipelineBendResolution.v3',
  sectionProfileRoutingPlanSchema: 'PipelineSectionProfileRoutingPlan.v1',
  greVendorSeriesPlanSchema: 'PipelineGreVendorSeriesPlan.v1',
  candidatePlans: [candidate], notApplicableCandidateIds: [], sharedSegmentConflicts: [],
  coverage: { candidateCount: 1, greOwnedCandidateCount: 1, plannedCandidateCount: 1 },
});
assert.equal(plan.ready, true);
assert.equal(Object.isFrozen(plan.candidatePlans), true);
console.log('pipeline-3d-model GRE bend geometry contracts: PASS');
