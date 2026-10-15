import assert from 'node:assert/strict';
import {
  PIPELINE_RIGID_PLAN_SCHEMA,
  PIPELINE_RIGID_TYPES,
  resolvePipelineRigidPlan,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-rigid-plan.js';

const coordinateRows = [
  { nodeNumber: 100 }, { nodeNumber: 110 }, { nodeNumber: 120 }, { nodeNumber: 130 },
];
const plan = resolvePipelineRigidPlan({
  coordinateRows,
  rigids: [
    { elementId: 'E1', type: 'flange', weight: 462 },
    { node: 120, type: 'FLANGE_PAIR', weightKg: 1685.791992 },
    { elementIndex: 2, type: 'valv', weight: 2708 },
  ],
});
assert.equal(plan.schema, PIPELINE_RIGID_PLAN_SCHEMA);
assert.deepEqual(PIPELINE_RIGID_TYPES, ['Flange', 'Flange Pair', 'Valve', 'Rigid']);
assert.equal(plan.ready, true);
assert.equal(plan.active, true);
assert.equal(plan.rigidCount, 3);
assert.deepEqual(plan.elements.map((item) => item.rigid?.type), ['Flange', 'Flange Pair', 'Valve']);
assert.equal(plan.elements[1].rigid.node, 120);
assert.equal(plan.elements[1].rigid.weight, 1685.791992);
assert.equal(Object.isFrozen(plan.elements[0].rigid), true);
assert.equal(JSON.stringify(plan), JSON.stringify(resolvePipelineRigidPlan({
  coordinateRows,
  rigids: [
    { elementId: 'E1', type: 'flange', weight: 462 },
    { node: 120, type: 'FLANGE_PAIR', weightKg: 1685.791992 },
    { elementIndex: 2, type: 'valv', weight: 2708 },
  ],
})));
const generic = resolvePipelineRigidPlan({ coordinateRows,
  rigids: [{ elementId: 'E1', type: 'rigid element', weight: 0 }] });
assert.equal(generic.ready, true);
assert.equal(generic.elements[0].rigid.type, 'Rigid');
assert.equal(generic.elements[0].rigid.weight, 0);
function codes(rigids) { return resolvePipelineRigidPlan({ coordinateRows, rigids }).blockerCodes; }
assert.ok(codes([{ elementId: 'E9', type: 'Valve', weight: 1 }]).includes('PIPELINE_RIGID_OWNERSHIP_INVALID'));
assert.ok(codes([{ elementId: 'E1', node: 120, type: 'Valve', weight: 1 }]).includes('PIPELINE_RIGID_NODE_MISMATCH'));
assert.ok(codes([{ elementId: 'E1', type: 'Unknown', weight: 1 }]).includes('PIPELINE_RIGID_TYPE_UNSUPPORTED'));
assert.ok(codes([{ elementId: 'E1', type: 'Valve' }]).includes('PIPELINE_RIGID_WEIGHT_INVALID'));
assert.ok(codes([{ elementId: 'E1', type: 'Valve', weight: -1 }]).includes('PIPELINE_RIGID_WEIGHT_INVALID'));
assert.ok(codes([
  { elementId: 'E1', type: 'Valve', weight: 1 },
  { elementId: 'E1', type: 'Flange', weight: 2 },
]).includes('PIPELINE_RIGID_DUPLICATE'));
const inactive = resolvePipelineRigidPlan({ coordinateRows });
assert.equal(inactive.active, false);
assert.equal(inactive.rigidCount, 0);
console.log('pipeline-3d-model rigid plan: PASS');
