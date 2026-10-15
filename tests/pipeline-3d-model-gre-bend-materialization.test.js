import assert from 'node:assert/strict';
import { resolvePipelineGreBendMaterializationPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-gre-bend-materialization.js';
import { createPipelineGreMaterializationFixture } from './pipeline-3d-model-gre-bend-materialization-fixtures.js';

for (const applicationValue of ['EACH_LEG_FROM_CORNER', 'EACH_LEG_FROM_TANGENCY']) {
  const fixture = createPipelineGreMaterializationFixture({ applicationValue,
    breakLengthMm: applicationValue === 'EACH_LEG_FROM_TANGENCY' ? 200 : 400 });
  const before = JSON.stringify(fixture.bendResolution.geometryRows);
  const plan = resolvePipelineGreBendMaterializationPlan(fixture.input);
  assert.equal(plan.ready, true, `${applicationValue}: ${plan.blockerCodes.join(', ')}`);
  assert.equal(plan.materializedModel.bendComponents.length, 1);
  assert.equal(plan.coverage.insertedNodeCount, 4);
  assert.equal(plan.coverage.inactiveCornerCount, 1);
  assert.equal(JSON.stringify(fixture.bendResolution.geometryRows), before);
  assert.equal(JSON.stringify(plan.materializedModel.sourceRows), before);
  const corner = plan.materializedModel.nodes.find((item) => item.nodeNumber === 110);
  assert.equal(corner.nodeRole, 'INACTIVE_CORNER_REFERENCE');
  assert.equal(corner.active, false);
  const component = plan.materializedModel.bendComponents[0];
  assert.equal(component.semanticArcOnly, true);
  assert.deepEqual(component.sampledNodeIds, []);
  assert.equal(component.bendBreakLengthApplication, applicationValue);
  const bend = plan.materializedModel.elements.find((item) => item.elementKind === 'GRE_BEND');
  assert.equal(bend.localThicknessMm, 12);
  assert.equal(bend.vendorId, 'VENDOR-A');
  assert.equal(Object.isFrozen(plan.materializedModel), true);
}

console.log('pipeline-3d-model GRE bend materialization: PASS');
