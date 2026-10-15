import assert from 'node:assert/strict';
import { resolvePipelineGreBendMaterializationPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-gre-bend-materialization.js';
import { createPipelineGreMaterializationFixture } from './pipeline-3d-model-gre-bend-materialization-fixtures.js';

const fixture = createPipelineGreMaterializationFixture();
const blockedCandidate = JSON.parse(JSON.stringify(fixture.greBendGeometryPlan));
blockedCandidate.candidatePlans[0].ready = false;
const candidateFailure = resolvePipelineGreBendMaterializationPlan({
  ...fixture.input, greBendGeometryPlan: blockedCandidate,
});
assert.equal(candidateFailure.ready, false);
assert.equal(candidateFailure.materializedModel, null);
assert.ok(candidateFailure.blockerCodes.includes('PIPELINE_GRE_BEND_MATERIALIZATION_CANDIDATE_INVALID'));
assert.ok(candidateFailure.blockerCodes.includes('PIPELINE_GRE_BEND_MATERIALIZATION_TRANSACTION_ABORTED'));

const duplicateOwnership = JSON.parse(JSON.stringify(fixture.sectionProfileRoutingPlan));
duplicateOwnership.candidateOwnership.push({ ...duplicateOwnership.candidateOwnership[0] });
const ownershipFailure = resolvePipelineGreBendMaterializationPlan({
  ...fixture.input, sectionProfileRoutingPlan: duplicateOwnership,
});
assert.equal(ownershipFailure.ready, false);
assert.equal(ownershipFailure.materializedModel, null);
assert.ok(ownershipFailure.blockerCodes.includes('PIPELINE_GRE_BEND_MATERIALIZATION_OWNERSHIP_INVALID'));

const nonFiniteBend = JSON.parse(JSON.stringify(fixture.bendResolution));
nonFiniteBend.geometryRows[1].x = Number.NaN;
assert.doesNotThrow(() => resolvePipelineGreBendMaterializationPlan({
  ...fixture.input, bendResolution: nonFiniteBend,
}));
const nonFiniteFailure = resolvePipelineGreBendMaterializationPlan({
  ...fixture.input, bendResolution: nonFiniteBend,
});
assert.equal(nonFiniteFailure.ready, false);
assert.equal(nonFiniteFailure.materializedModel, null);
assert.ok(nonFiniteFailure.blockerCodes.includes('PIPELINE_GRE_BEND_MATERIALIZATION_CANDIDATE_INVALID'));

console.log('pipeline-3d-model GRE bend materialization atomicity: PASS');
