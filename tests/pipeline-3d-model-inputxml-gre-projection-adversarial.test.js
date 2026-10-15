import assert from 'node:assert/strict';
import { resolvePipelineGreBendMaterializationPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-gre-bend-materialization.js';
import { buildPipelineInputXmlGreProjectionPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-gre-projection.js';
import { createPipelineGreMaterializationFixture } from './pipeline-3d-model-gre-bend-materialization-fixtures.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const materialized = (options = {}) => {
  const fixture = createPipelineGreMaterializationFixture(options);
  const plan = resolvePipelineGreBendMaterializationPlan(fixture.input);
  assert.equal(plan.ready, true, plan.blockerCodes.join(', '));
  return plan;
};
const blocked = (plan, code) => {
  const projection = buildPipelineInputXmlGreProjectionPlan({ materializationPlan: plan });
  assert.equal(projection.ready, false, code);
  assert.ok(projection.blockerCodes.includes(code), projection.blockerCodes.join(', '));
  assert.deepEqual(projection.projectedElements, []);
  assert.deepEqual(projection.bendProjections, []);
};

{
  const plan = clone(materialized());
  const node = plan.materializedModel.nodes.find((item) => item.inserted === true);
  node.nodeRole = 'ORIGINAL_ROUTE_NODE';
  blocked(plan, 'PIPELINE_INPUTXML_GRE_NODE_IDENTITY_INVALID');
}
{
  const plan = clone(materialized());
  plan.materializedModel.elements[0].elementKind = 'FORGED_KIND';
  blocked(plan, 'PIPELINE_INPUTXML_GRE_ELEMENT_IDENTITY_INVALID');
}
{
  const plan = clone(materialized());
  plan.materializedModel.elements[0].lineageDisposition = 'FORGED_DISPOSITION';
  blocked(plan, 'PIPELINE_INPUTXML_GRE_ELEMENT_IDENTITY_INVALID');
}
{
  const plan = clone(materialized({ twoBends: true, breakLengthMm: 400 }));
  plan.materializedModel.bendComponents[1].componentId = plan.materializedModel.bendComponents[0].componentId;
  blocked(plan, 'PIPELINE_INPUTXML_GRE_BEND_OWNERSHIP_INVALID');
}
{
  const plan = clone(materialized({ twoBends: true, breakLengthMm: 400 }));
  plan.materializedModel.bendComponents[0].outgoingTangencyNodeId =
    plan.materializedModel.bendComponents[1].outgoingTangencyNodeId;
  blocked(plan, 'PIPELINE_INPUTXML_GRE_BEND_OWNERSHIP_INVALID');
}
{
  const plan = clone(materialized());
  const component = plan.materializedModel.bendComponents[0];
  const node = plan.materializedModel.nodes.find((item) =>
    item.materializedNodeId === component.incomingTangencyNodeId);
  node.analysisSectionId = 'AS-FORGED';
  blocked(plan, 'PIPELINE_INPUTXML_GRE_BEND_OWNERSHIP_INVALID');
}
{
  const plan = clone(materialized());
  const bend = plan.materializedModel.elements.find((item) => item.elementKind === 'GRE_BEND');
  bend.vendorId = 'FORGED-VENDOR';
  blocked(plan, 'PIPELINE_INPUTXML_GRE_BEND_OWNERSHIP_INVALID');
}
{
  const plan = clone(materialized());
  plan.materializedModel.inactiveCornerReferences.push('route-node:100');
  blocked(plan, 'PIPELINE_INPUTXML_GRE_INACTIVE_CORNER_REAPPEARED');
}
{
  const plan = clone(materialized());
  const extra = clone(plan.materializedModel.nodes.find((item) => item.inserted === false && item.active === true));
  extra.materializedNodeId = 'route-node:999';
  extra.nodeNumber = 999;
  extra.sourceNodeNumber = 999;
  plan.materializedModel.nodes.push(extra);
  blocked(plan, 'PIPELINE_INPUTXML_GRE_MATERIALIZATION_UNAUTHENTICATED');
}
{
  const plan = clone(materialized());
  plan.nodeAllocationPlan.allocations[0].nodeRole = 'GRE_OUTGOING_BREAK';
  blocked(plan, 'PIPELINE_INPUTXML_GRE_NODE_ALLOCATION_INVALID');
}
{
  const plan = clone(materialized());
  plan.appliedCandidateIds = ['FORGED'];
  blocked(plan, 'PIPELINE_INPUTXML_GRE_BEND_OWNERSHIP_INVALID');
}
{
  const projection = buildPipelineInputXmlGreProjectionPlan({ materializationPlan: {
    schema: 'PipelineGreBendMaterializationPlan.v1', ready: false,
    diagnostics: [{ severity: 'BLOCKING', code: 'TEST_BLOCKER', message: 'TEST_BLOCKER', details: {} }],
    blockerCodes: ['TEST_BLOCKER'], materializedModel: null,
  } });
  assert.equal(projection.ready, false);
  assert.ok(projection.blockerCodes.includes('PIPELINE_INPUTXML_GRE_MATERIALIZATION_UNAUTHENTICATED'));
  assert.equal(projection.writerAdmission, 'BLOCKED');
}

console.log('pipeline-3d-model InputXML GRE projection adversarial: PASS');
