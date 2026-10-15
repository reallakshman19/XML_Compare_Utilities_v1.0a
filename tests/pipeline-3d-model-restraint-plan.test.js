import assert from 'node:assert/strict';
import {
  PIPELINE_RESTRAINT_PLAN_SCHEMA,
  PIPELINE_RESTRAINT_SLOT_COUNT,
  resolvePipelineRestraintPlan,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-restraint-plan.js';

const rows = [
  { nodeNumber: 100, x: 0, y: 0, z: 0 },
  { nodeNumber: 110, x: 1000, y: 0, z: 0 },
  { nodeNumber: 120, x: 2000, y: 0, z: 0 },
];
const restraints = [
  { elementId: 'E1', node: 110, slot: 1, type: 17, frictionCoefficient: 0.3,
    xCosine: 0, yCosine: 1, zCosine: 0, tag: 'SL1' },
  { elementIndex: 0, type: 9, gap: 0, xCosine: 0, yCosine: 0, zCosine: 1 },
  { node: 120, type: -17, gap: 10, xCosine: 0, yCosine: 1, zCosine: 0 },
];
const plan = resolvePipelineRestraintPlan({ restraints, coordinateRows: rows });
assert.equal(plan.schema, PIPELINE_RESTRAINT_PLAN_SCHEMA);
assert.equal(plan.active, true);
assert.equal(plan.ready, true);
assert.equal(plan.restraintCount, 3);
assert.equal(plan.slotCount, PIPELINE_RESTRAINT_SLOT_COUNT);
assert.equal(plan.elements[0].realRestraintCount, 2);
assert.equal(plan.elements[0].slots.length, 6);
assert.equal(plan.elements[0].slots[0].type, 17);
assert.equal(plan.elements[0].slots[1].type, 9);
assert.equal(plan.elements[0].slots[2].placeholder, true);
assert.equal(plan.elements[1].slots[0].type, -17);
assert.equal(Object.isFrozen(plan.elements[0].slots), true);
assert.equal(JSON.stringify(plan), JSON.stringify(resolvePipelineRestraintPlan({
  restraints: structuredClone(restraints), coordinateRows: structuredClone(rows),
})));

const mismatch = resolvePipelineRestraintPlan({
  coordinateRows: rows, restraints: [{ elementId: 'E1', node: 120, type: 17 }],
});
assert.deepEqual(mismatch.blockerCodes, ['PIPELINE_RESTRAINT_NODE_MISMATCH']);

const duplicate = resolvePipelineRestraintPlan({
  coordinateRows: rows, restraints: [
    { elementId: 'E1', slot: 1, type: 17 }, { elementId: 'E1', slot: 1, type: 9 },
  ],
});
assert.ok(duplicate.blockerCodes.includes('PIPELINE_RESTRAINT_SLOT_DUPLICATE'));

const overflow = resolvePipelineRestraintPlan({
  coordinateRows: rows,
  restraints: Array.from({ length: 7 }, (_, index) => ({ elementId: 'E1', type: index + 1 })),
});
assert.ok(overflow.blockerCodes.includes('PIPELINE_RESTRAINT_SLOT_LIMIT_EXCEEDED'));

const invalid = resolvePipelineRestraintPlan({
  coordinateRows: rows, restraints: [{ elementId: 'E1', type: 17, xCosine: 1.1 }],
});
assert.ok(invalid.blockerCodes.includes('PIPELINE_RESTRAINT_VALUE_INVALID'));
const invalidLexical = resolvePipelineRestraintPlan({
  coordinateRows: rows, restraints: [{ elementId: 'E1', type: 17, stiffness: 'not-a-number' }],
});
assert.ok(invalidLexical.blockerCodes.includes('PIPELINE_RESTRAINT_VALUE_INVALID'));

const ambiguousRows = [
  { nodeNumber: 100 }, { nodeNumber: 110 }, { nodeNumber: 110 },
];
const ambiguous = resolvePipelineRestraintPlan({
  coordinateRows: ambiguousRows, restraints: [{ node: 110, type: 17 }],
});
assert.ok(ambiguous.blockerCodes.includes('PIPELINE_RESTRAINT_OWNERSHIP_AMBIGUOUS'));

const inactive = resolvePipelineRestraintPlan({ coordinateRows: rows });
assert.equal(inactive.active, false);
assert.equal(inactive.restraintCount, 0);
assert.equal(inactive.ready, true);

console.log('pipeline-3d-model restraint plan: PASS');
