import assert from 'node:assert/strict';
import {
  buildPipelineGreBendGeometryPlanJson,
  buildPipelineGreBendGeometryPlanTsv,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-gre-bend-geometry-contracts.js';
import { resolvePipelineGreBendGeometryPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-gre-bend-geometry-plan.js';

const rows = [
  { nodeNumber: 100, x: 0, y: 0, z: 0 },
  { nodeNumber: 110, x: 1000, y: 0, z: 0 },
  { nodeNumber: 120, x: 1000, y: 1000, z: 0 },
  { nodeNumber: 130, x: 2000, y: 1000, z: 0 },
  { nodeNumber: 140, x: 2000, y: 2000, z: 0 },
];
const candidate = (id, incoming, radius = 300, tangent = 300) => ({
  id, incomingElementIndex: incoming, outgoingElementIndex: incoming + 1,
  previousNode: rows[incoming].nodeNumber, cornerNode: rows[incoming + 1].nodeNumber,
  nextNode: rows[incoming + 2].nodeNumber, turnAngleDeg: 90, radiusMm: radius,
  tangentMm: tangent, incomingLengthMm: 1000, outgoingLengthMm: 1000,
});
const bendResolution = { schema: 'PipelineBendResolution.v3',
  candidates: [candidate('bend:110', 0)], geometryRows: rows };
const routing = { schema: 'PipelineSectionProfileRoutingPlan.v1', ready: true,
  candidateOwnership: [{ candidateId: 'bend:110', analysisSectionId: 'AS1', profileId: 'gre' }] };
const vendor = (length = 400) => ({
  schema: 'PipelineGreVendorSeriesPlan.v1', ready: true,
  sectionResolutions: [{ analysisSectionId: 'AS1', profileId: 'gre', ready: true, status: 'RESOLVED',
    vendorId: 'V', seriesId: 'S', qualificationEvidenceId: 'Q', requirementReference: 'R',
    bendRadiusMm: 300, bendBreakLengthBasis: 'EXPLICIT_LENGTH',
    bendBreakLengthMm: length, bendLocalThicknessMm: 12,
    sourceAuthority: 'PROJECT', sourceReference: 'REF' }],
});
const application = (value = 'EACH_LEG_FROM_CORNER') => [{
  analysisSectionId: 'AS1', vendorId: 'V', seriesId: 'S', qualificationEvidenceId: 'Q',
  bendBreakLengthApplication: value, sourceAuthority: 'PROJECT', sourceReference: 'APP-REF',
}];
const input = { bendResolution, sectionProfileRoutingPlan: routing, greVendorSeriesPlan: vendor(),
  bendBreakApplications: application() };
const plan = resolvePipelineGreBendGeometryPlan(input);
assert.equal(plan.ready, true);
assert.equal(plan.candidatePlans[0].status, 'PLANNED');
assert.deepEqual(plan.candidatePlans[0].incomingTangencyPoint, {
  schema: 'PipelineGreBendGeometryPoint.v1', x: 700, y: 0, z: 0,
  diagnostics: [], blockerCodes: [], ready: true,
});
assert.equal(plan.candidatePlans[0].incomingBreakPoint.x, 600);
assert.equal(plan.candidatePlans[0].outgoingBreakPoint.y, 400);
assert.equal(Object.isFrozen(plan.candidatePlans[0]), true);
assert.equal(buildPipelineGreBendGeometryPlanJson(plan),
  buildPipelineGreBendGeometryPlanJson(resolvePipelineGreBendGeometryPlan(input)));
assert.equal(buildPipelineGreBendGeometryPlanTsv(plan),
  buildPipelineGreBendGeometryPlanTsv(resolvePipelineGreBendGeometryPlan(input)));

const fromTangent = resolvePipelineGreBendGeometryPlan({
  ...input, greVendorSeriesPlan: vendor(200),
  bendBreakApplications: application('EACH_LEG_FROM_TANGENCY') });
assert.equal(fromTangent.candidatePlans[0].incomingBreakDistanceFromCornerMm, 500);
assert.equal(fromTangent.candidatePlans[0].incomingBreakPoint.x, 500);

const missingBasis = resolvePipelineGreBendGeometryPlan({
  ...input, bendBreakApplications: application('') });
assert.equal(missingBasis.ready, false);
assert.ok(missingBasis.blockerCodes.includes('PIPELINE_GRE_BEND_GEOMETRY_BREAK_BASIS_UNRESOLVED'));

const normalRouting = { ...routing, candidateOwnership: [
  { candidateId: 'bend:110', analysisSectionId: 'AS1', profileId: 'normal-metallic' }] };
const notApplicable = resolvePipelineGreBendGeometryPlan({
  bendResolution, sectionProfileRoutingPlan: normalRouting, greVendorSeriesPlan: vendor() });
assert.equal(notApplicable.ready, true);
assert.deepEqual(notApplicable.notApplicableCandidateIds, ['bend:110']);

const noFit = resolvePipelineGreBendGeometryPlan({
  ...input, greVendorSeriesPlan: vendor(1200) });
assert.equal(noFit.ready, false);
assert.ok(noFit.candidatePlans[0].blockerCodes.includes(
  'PIPELINE_GRE_BEND_GEOMETRY_BREAK_ENVELOPE_INFEASIBLE'));

const sharedBends = { schema: 'PipelineBendResolution.v3',
  candidates: [candidate('bend:110', 0), candidate('bend:120', 1)], geometryRows: rows };
const sharedRouting = { schema: 'PipelineSectionProfileRoutingPlan.v1', ready: true,
  candidateOwnership: [
    { candidateId: 'bend:110', analysisSectionId: 'AS1', profileId: 'gre' },
    { candidateId: 'bend:120', analysisSectionId: 'AS1', profileId: 'gre' },
  ] };
const overlap = resolvePipelineGreBendGeometryPlan({
  bendResolution: sharedBends, sectionProfileRoutingPlan: sharedRouting,
  greVendorSeriesPlan: vendor(600), bendBreakApplications: application(),
});
assert.equal(overlap.ready, false);
assert.equal(overlap.sharedSegmentConflicts.length, 1);
assert.equal(overlap.sharedSegmentConflicts[0].conflictId,
  'GRE-BEND-SHARED:1:bend:110|bend:120');
assert.ok(overlap.candidatePlans.every((item) =>
  item.blockerCodes.includes('PIPELINE_GRE_BEND_GEOMETRY_SHARED_SEGMENT_CONFLICT')));

const unowned = resolvePipelineGreBendGeometryPlan({
  bendResolution, sectionProfileRoutingPlan: { ...routing, candidateOwnership: [] },
  greVendorSeriesPlan: vendor(), bendBreakApplications: application(),
});
assert.equal(unowned.ready, false);
assert.ok(unowned.blockerCodes.includes('PIPELINE_GRE_BEND_GEOMETRY_CANDIDATE_UNOWNED'));

const nonFiniteRows = rows.map((row) => ({ ...row }));
nonFiniteRows[1].x = Number.NaN;
const nonFinite = resolvePipelineGreBendGeometryPlan({
  ...input, bendResolution: { ...bendResolution, geometryRows: nonFiniteRows },
});
assert.equal(nonFinite.ready, false);
assert.ok(nonFinite.blockerCodes.includes('PIPELINE_GRE_BEND_GEOMETRY_INPUT_INVALID'));

const cyclic = {}; cyclic.self = cyclic;
assert.doesNotThrow(() => resolvePipelineGreBendGeometryPlan(cyclic));
assert.equal(resolvePipelineGreBendGeometryPlan(cyclic).ready, false);

console.log('pipeline-3d-model GRE bend geometry plan: PASS');
