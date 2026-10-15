import assert from 'node:assert/strict';
import { resolvePipelineGreBendMaterializationPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-gre-bend-materialization.js';
import {
  PIPELINE_INPUTXML_GRE_BEND_PROJECTION_SCHEMA,
  PIPELINE_INPUTXML_GRE_PROJECTED_ELEMENT_SCHEMA,
  PIPELINE_INPUTXML_GRE_PROJECTION_PLAN_SCHEMA,
  buildPipelineInputXmlGreProjectionPlan,
  buildPipelineInputXmlGreProjectionPlanJson,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-gre-projection.js';
import { createPipelineGreMaterializationFixture } from './pipeline-3d-model-gre-bend-materialization-fixtures.js';

const project = (options = {}) => {
  const fixture = createPipelineGreMaterializationFixture(options);
  const materializationPlan = resolvePipelineGreBendMaterializationPlan(fixture.input);
  assert.equal(materializationPlan.ready, true, materializationPlan.blockerCodes.join(', '));
  return { materializationPlan, projection: buildPipelineInputXmlGreProjectionPlan({ materializationPlan }) };
};

for (const applicationValue of ['EACH_LEG_FROM_CORNER', 'EACH_LEG_FROM_TANGENCY']) {
  const { materializationPlan, projection } = project({ applicationValue,
    breakLengthMm: applicationValue === 'EACH_LEG_FROM_TANGENCY' ? 200 : 400 });
  assert.equal(projection.schema, PIPELINE_INPUTXML_GRE_PROJECTION_PLAN_SCHEMA);
  assert.equal(projection.ready, true, `${applicationValue}: ${projection.blockerCodes.join(', ')}`);
  assert.equal(projection.projectionStatus, 'READY');
  assert.equal(projection.writerAdmission, 'NOT_ADOPTED');
  assert.equal(projection.documentAuthorityAdopted, false);
  assert.equal(projection.coordinateRouteAdopted, false);
  assert.equal(projection.canvasAdopted, false);
  assert.equal(projection.projectedElements.length,
    materializationPlan.materializedModel.elements.filter((item) => item.elementKind !== 'GRE_BEND').length);
  assert.equal(projection.bendProjections.length, 1);
  assert.equal(Object.isFrozen(projection), true);

  const bend = projection.bendProjections[0];
  assert.equal(bend.schema, PIPELINE_INPUTXML_GRE_BEND_PROJECTION_SCHEMA);
  const owner = projection.projectedElements.find((item) =>
    item.id === bend.incomingOwnerProjectionElementId);
  assert.equal(owner.schema, PIPELINE_INPUTXML_GRE_PROJECTED_ELEMENT_SCHEMA);
  assert.notEqual(owner.elementKind, 'GRE_BEND');
  assert.equal(owner.materializedElementId, bend.incomingOwnerMaterializedElementId);
  assert.equal(owner.toNode, bend.incomingTangencyNodeNumber);
  assert.deepEqual(owner.bend, bend);
  assert.equal(projection.projectedElements.some((item) => item.elementKind === 'GRE_BEND'), false);
  assert.equal(bend.outgoingSourceElementIndex, bend.incomingSourceElementIndex + 1);
  assert.equal(bend.bendBreakLengthApplication, applicationValue);

  const inactive = new Set(projection.inactiveCornerReferences);
  assert.equal(projection.projectedElements.some((item) => inactive.has(item.fromMaterializedNodeId)
    || inactive.has(item.toMaterializedNodeId)), false);
  for (const sourceIndex of [bend.incomingSourceElementIndex, bend.outgoingSourceElementIndex]) {
    const conservation = projection.sourceElementConservation.find((item) =>
      item.sourceElementIndex === sourceIndex);
    assert.ok(conservation.successorMaterializedElementIds.includes(bend.semanticGreBendElementId));
    assert.ok(conservation.emittedElementIds.includes(bend.incomingOwnerProjectionElementId));
  }
}

{
  const forward = project({ twoBends: true, breakLengthMm: 400 });
  const reverse = project({ twoBends: true, breakLengthMm: 400, reverse: true });
  assert.equal(buildPipelineInputXmlGreProjectionPlanJson(forward.projection),
    buildPipelineInputXmlGreProjectionPlanJson(reverse.projection));
  assert.equal(forward.projection.bendProjections.length, 2);
}

{
  const { materializationPlan } = project({ twoBends: true, breakLengthMm: 500 });
  const projection = buildPipelineInputXmlGreProjectionPlan({ materializationPlan });
  assert.equal(projection.ready, false);
  assert.ok(projection.blockerCodes.includes('PIPELINE_INPUTXML_GRE_ZERO_LENGTH_ELEMENT_UNRESOLVED'));
  assert.deepEqual(projection.projectedElements, []);
}

console.log('pipeline-3d-model InputXML GRE projection: PASS');
