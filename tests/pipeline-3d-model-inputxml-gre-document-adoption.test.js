import assert from 'node:assert/strict';
import {
  PIPELINE_INPUTXML_GRE_DOCUMENT_ADOPTION_PLAN_SCHEMA,
  buildPipelineInputXmlGreDocumentAdoptionPlan,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-gre-document-adoption.js';
import { createGreAdoptionFixture } from './pipeline-3d-model-inputxml-gre-document-adoption-fixtures.js';

for (const applicationValue of ['EACH_LEG_FROM_CORNER', 'EACH_LEG_FROM_TANGENCY']) {
  const fixture = createGreAdoptionFixture({ applicationValue });
  const plan = buildPipelineInputXmlGreDocumentAdoptionPlan(fixture);
  assert.equal(plan.schema, PIPELINE_INPUTXML_GRE_DOCUMENT_ADOPTION_PLAN_SCHEMA);
  assert.equal(plan.ready, true, `${applicationValue}: ${plan.blockerCodes.join(', ')}`);
  assert.equal(plan.projectionStatus, 'READY');
  assert.equal(plan.documentAuthorityAdopted, true);
  assert.equal(plan.writerAdmission, 'NOT_ADOPTED');
  assert.equal(plan.coordinateRouteAdopted, false);
  assert.equal(plan.canvasAdopted, false);
  assert.deepEqual(plan.removedSourceBlockerCodes,
    ['PIPELINE_INPUTXML_GRE_BEND_GEOMETRY_REQUIRED']);
  assert.deepEqual(plan.adoptedElements.map((item) => item.id), ['E1', 'E2', 'E3', 'E4']);
  assert.equal(plan.adoptedElements.some((item) =>
    item.sourceMaterializedElementId.startsWith('gre-bend:')), false);
  assert.equal(plan.greBendAuthorities.length, 1);
  const bend = plan.greBendAuthorities[0];
  const owner = plan.adoptedElements.find((item) => item.id === bend.incomingOwnerDocumentElementId);
  assert.equal(owner.sourceProjectionElementId, bend.incomingOwnerProjectedElementId);
  assert.equal(owner.toNode, bend.incomingTangencyNodeNumber);
  assert.equal(owner.bend.candidateId, bend.candidateId);
  assert.equal(owner.bend.bendBreakLengthApplication, applicationValue);
  assert.equal(plan.adoptedElements.filter((item) => item.bend?.candidateId === bend.candidateId).length, 1);
  assert.equal(plan.inactiveCornerReferences.includes(owner.fromMaterializedNodeId), false);
  assert.equal(plan.inactiveCornerReferences.includes(owner.toMaterializedNodeId), false);
  assert.equal(plan.adoptedElements.some((item) => item.fromNode === bend.inactiveCornerNodeNumber
    || item.toNode === bend.inactiveCornerNodeNumber), false);
  assert.equal(plan.sourceElementConservation.length, 2);
  assert.equal(plan.candidateConservation.length, 1);
  assert.equal(plan.counts.numElt, plan.adoptedElements.length);
  assert.equal(plan.counts.numBend, 1);
  assert.equal(plan.counts.greBendAuthorityCount, 1);
  assert.equal(Object.isFrozen(plan), true);
}

const two = buildPipelineInputXmlGreDocumentAdoptionPlan(createGreAdoptionFixture({ twoBends: true }));
assert.equal(two.ready, true, two.blockerCodes.join(', '));
assert.equal(two.greBendAuthorities.length, 2);
assert.deepEqual(two.adoptedElements.map((item) => item.id),
  ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8']);
assert.equal(new Set(two.greBendAuthorities.map((item) => item.incomingOwnerDocumentElementId)).size, 2);
assert.equal(two.candidateConservation.length, 2);
assert.equal(two.sourceElementConservation.length, 4);

const repeat = buildPipelineInputXmlGreDocumentAdoptionPlan(createGreAdoptionFixture({ twoBends: true }));
assert.equal(JSON.stringify(two), JSON.stringify(repeat));

console.log('pipeline-3d-model InputXML GRE document adoption: PASS');
