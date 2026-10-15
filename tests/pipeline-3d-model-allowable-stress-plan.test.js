import assert from 'node:assert/strict';
import {
  PIPELINE_ALLOWABLE_CASE_COUNT,
  PIPELINE_ALLOWABLE_STRESS_PLAN_SCHEMA,
  resolvePipelineAllowableStressPlan,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-allowable-stress-plan.js';

const coordinateRows = [
  { nodeNumber: 100 }, { nodeNumber: 110 }, { nodeNumber: 120 },
];
const plan = resolvePipelineAllowableStressPlan({ coordinateRows, allowableStresses: [{
  elementId: 'E1', node: 110,
  allowableStressIndicator: '', designFactor: '', pipingCode: 3,
  coldAllow: 620528, suppRqr: 0, matLp: 0, buried: 0, expAllow: -1,
  cases: [{ num: 1, hotAllow: 510000, hotSy: 448159 }],
}] });
assert.equal(plan.schema, PIPELINE_ALLOWABLE_STRESS_PLAN_SCHEMA);
assert.equal(plan.ready, true);
assert.equal(plan.allowableCount, 1);
assert.equal(plan.caseCount, PIPELINE_ALLOWABLE_CASE_COUNT);
const allowable = plan.elements[0].allowableStress;
assert.equal(allowable.attributes.PIPING_CODE, 3);
assert.equal(allowable.attributes.SUPP_RQR, 0);
assert.equal(allowable.cases.length, 9);
assert.equal(allowable.cases[0].placeholder, false);
assert.equal(allowable.cases[0].attributes.HOT_ALLOW, 510000);
assert.equal(allowable.cases[1].placeholder, true);
assert.equal(plan.elements[1].allowableStress, null);
assert.ok(Object.isFrozen(plan));
assert.ok(Object.isFrozen(allowable.cases));

const exactNames = resolvePipelineAllowableStressPlan({ coordinateRows, allowableStresses: [{
  node: 120, PIPING_CODE: 36, SUPP_RQR: -1,
  cases: [{ NUM: 9, HOT_ALLOW: 1, BUTTWELDCYCLES: 0 }],
}] });
assert.equal(exactNames.ready, true);
assert.equal(exactNames.elements[1].allowableStress.attributes.PIPING_CODE, 36);
assert.equal(exactNames.elements[1].allowableStress.cases[8].attributes.BUTTWELDCYCLES, 0);

const duplicateBlock = resolvePipelineAllowableStressPlan({ coordinateRows, allowableStresses: [
  { elementIndex: 0 }, { elementId: 'E1' },
] });
assert.equal(duplicateBlock.ready, false);
assert.ok(duplicateBlock.blockerCodes.includes('PIPELINE_ALLOWABLE_DUPLICATE_ELEMENT'));

const invalidCase = resolvePipelineAllowableStressPlan({ coordinateRows, allowableStresses: [{
  elementId: 'E1', cases: [{ num: 2 }, { num: 2 }, { num: 10 }],
}] });
assert.equal(invalidCase.ready, false);
assert.ok(invalidCase.blockerCodes.includes('PIPELINE_ALLOWABLE_CASE_NUMBER_DUPLICATE'));
assert.ok(invalidCase.blockerCodes.includes('PIPELINE_ALLOWABLE_CASE_NUMBER_INVALID'));

const invalidField = resolvePipelineAllowableStressPlan({ coordinateRows, allowableStresses: [{
  elementId: 'E1', pipingCode: 'not-a-number', suppRqr: 1.5,
}] });
assert.equal(invalidField.ready, false);
assert.ok(invalidField.blockerCodes.includes('PIPELINE_ALLOWABLE_FIELD_INVALID'));

const mismatch = resolvePipelineAllowableStressPlan({ coordinateRows, allowableStresses: [{
  elementId: 'E1', node: 120,
}] });
assert.equal(mismatch.ready, false);
assert.ok(mismatch.blockerCodes.includes('PIPELINE_ALLOWABLE_NODE_MISMATCH'));

const inactive = resolvePipelineAllowableStressPlan({ coordinateRows });
assert.equal(inactive.active, false);
assert.equal(inactive.allowableCount, 0);
assert.equal(inactive.ready, true);

console.log('pipeline-3d-model allowable-stress plan: PASS');
