import assert from 'node:assert/strict';
import {
  PIPELINE_GRE_BEND_INSERTED_NODE_ORDER,
  createPipelineGreBendAbortedMaterializationPlan,
  createPipelineGreBendNodeAllocationPolicy,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-gre-bend-materialization-contracts.js';

const policy = createPipelineGreBendNodeAllocationPolicy({
  schema: 'PipelineGreBendNodeAllocationPolicy.v1', policyId: 'POLICY-A',
  nodeStep: 10, allocationStart: 1000, originalNodeNumbers: [100, 110, 120],
  reservedNodeNumbers: [900], allocationOrder: [...PIPELINE_GRE_BEND_INSERTED_NODE_ORDER],
  sourceAuthority: 'PIPELINE_GRE_BEND_NODE_ALLOCATION_POLICY', sourceReference: 'TEST:POLICY-A',
});
assert.equal(policy.ready, true);
assert.equal(Object.isFrozen(policy), true);
assert.equal(Object.isFrozen(policy.allocationOrder), true);

const invalid = createPipelineGreBendNodeAllocationPolicy({
  schema: 'PipelineGreBendNodeAllocationPolicy.v1', policyId: 'POLICY-B', nodeStep: 0,
  allocationStart: 1000, originalNodeNumbers: [100], reservedNodeNumbers: [], allocationOrder: [],
});
assert.equal(invalid.ready, false);
assert.ok(invalid.blockerCodes.includes('PIPELINE_GRE_BEND_MATERIALIZATION_NODE_POLICY_INVALID'));

const aborted = createPipelineGreBendAbortedMaterializationPlan({
  sourceGeometryPlanSchema: 'PipelineGreBendGeometryPlan.v1',
  sourceBendResolutionSchema: 'PipelineBendResolution.v3',
  sourceRoutingPlanSchema: 'PipelineSectionProfileRoutingPlan.v1',
});
assert.equal(aborted.ready, false);
assert.equal(aborted.materializedModel, null);
assert.ok(aborted.blockerCodes.includes('PIPELINE_GRE_BEND_MATERIALIZATION_TRANSACTION_ABORTED'));
assert.equal(Object.isFrozen(aborted), true);

console.log('pipeline-3d-model GRE bend materialization contracts: PASS');
