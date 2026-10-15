import assert from 'node:assert/strict';
import { resolvePipelineGreBendNodeAllocationPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-gre-bend-node-allocation.js';
import { createPipelineGreMaterializationFixture } from './pipeline-3d-model-gre-bend-materialization-fixtures.js';

const forward = createPipelineGreMaterializationFixture({ twoBends: true });
const reversed = createPipelineGreMaterializationFixture({ twoBends: true, reverse: true });
const planA = resolvePipelineGreBendNodeAllocationPlan({
  greBendGeometryPlan: forward.greBendGeometryPlan,
  bendResolution: forward.bendResolution,
  nodeAllocationPolicy: forward.nodeAllocationPolicy,
});
const planB = resolvePipelineGreBendNodeAllocationPlan({
  greBendGeometryPlan: reversed.greBendGeometryPlan,
  bendResolution: reversed.bendResolution,
  nodeAllocationPolicy: reversed.nodeAllocationPolicy,
});
assert.equal(planA.ready, true);
assert.equal(planA.allocations.length, 8);
assert.deepEqual(planA.allocations, planB.allocations);
assert.deepEqual(planA.originalNodeNumbers, [100, 110, 120, 130]);
assert.ok(planA.allocations.every((item) => ![100, 110, 120, 130, 900, 910].includes(item.nodeNumber)));
assert.equal(new Set(planA.allocations.map((item) => item.nodeNumber)).size, 8);
assert.equal(Object.isFrozen(planA.allocations), true);

const conflict = resolvePipelineGreBendNodeAllocationPlan({
  greBendGeometryPlan: forward.greBendGeometryPlan,
  bendResolution: forward.bendResolution,
  nodeAllocationPolicy: { ...forward.nodeAllocationPolicy, originalNodeNumbers: [100, 110] },
});
assert.equal(conflict.ready, false);
assert.ok(conflict.blockerCodes.includes('PIPELINE_GRE_BEND_MATERIALIZATION_NODE_POLICY_INVALID'));

console.log('pipeline-3d-model GRE bend node allocation: PASS');
