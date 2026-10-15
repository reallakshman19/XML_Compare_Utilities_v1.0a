import assert from 'node:assert/strict';
import { buildPipelineInputXmlGreDocumentAdoptionPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-gre-document-adoption.js';
import {
  createGreAdoptionFixture,
  createNoGreAdoptionFixture,
} from './pipeline-3d-model-inputxml-gre-document-adoption-fixtures.js';

const clone = (value) => structuredClone(value);
function blocked(input, expectedCode) {
  const plan = buildPipelineInputXmlGreDocumentAdoptionPlan(input);
  assert.equal(plan.ready, false, `unexpected ready plan for ${expectedCode}`);
  assert.equal(plan.documentAuthorityAdopted, false);
  assert.equal(plan.writerAdmission, 'BLOCKED');
  assert.deepEqual(plan.adoptedElements, []);
  assert.deepEqual(plan.greBendAuthorities, []);
  assert.deepEqual(plan.sourceElementConservation, []);
  assert.deepEqual(plan.candidateConservation, []);
  assert.ok(plan.blockerCodes.includes(expectedCode), `${expectedCode}: ${plan.blockerCodes.join(', ')}`);
  return plan;
}

{
  const input = clone(createGreAdoptionFixture());
  input.greProjectionPlan.documentAuthorityAdopted = true;
  blocked(input, 'PIPELINE_INPUTXML_GRE_PROJECTION_UNAUTHENTICATED');
}
{
  const input = clone(createGreAdoptionFixture());
  input.greProjectionPlan.projectedElements[1].id = 'E1';
  blocked(input, 'PIPELINE_INPUTXML_GRE_DOCUMENT_ELEMENT_INVALID');
}
{
  const input = clone(createGreAdoptionFixture());
  input.greProjectionPlan.projectedElements[2].fromNode =
    input.greProjectionPlan.projectedElements[1].fromNode;
  blocked(input, 'PIPELINE_INPUTXML_GRE_DOCUMENT_NODE_IDENTITY_INVALID');
}
{
  const input = clone(createGreAdoptionFixture());
  input.greProjectionPlan.bendProjections[0].incomingOwnerProjectionElementId = 'E99';
  blocked(input, 'PIPELINE_INPUTXML_GRE_DOCUMENT_BEND_OWNERSHIP_INVALID');
}
{
  const input = clone(createGreAdoptionFixture());
  const bend = input.greProjectionPlan.bendProjections[0];
  const outgoing = input.greProjectionPlan.projectedElements[2];
  bend.incomingOwnerProjectionElementId = outgoing.id;
  bend.incomingOwnerMaterializedElementId = outgoing.materializedElementId;
  bend.incomingTangencyNodeId = outgoing.toMaterializedNodeId;
  bend.incomingTangencyNodeNumber = outgoing.toNode;
  input.greProjectionPlan.projectedElements[1].bend = null;
  outgoing.bend = clone(bend);
  blocked(input, 'PIPELINE_INPUTXML_GRE_DOCUMENT_SOURCE_CONSERVATION_INVALID');
}
{
  const input = clone(createGreAdoptionFixture());
  const template = input.greProjectionPlan.projectedElements.at(-1);
  input.greProjectionPlan.projectedElements.push({ ...clone(template), id: 'E5', index: 4,
    materializedElementId: input.greProjectionPlan.bendProjections[0].semanticGreBendElementId,
    elementKind: 'GRE_BEND' });
  input.greProjectionPlan.coverage.projectedElementCount += 1;
  blocked(input, 'PIPELINE_INPUTXML_GRE_DOCUMENT_ELEMENT_INVALID');
}
{
  const input = clone(createGreAdoptionFixture());
  input.greProjectionPlan.projectedElements[0].fromMaterializedNodeId =
    input.greProjectionPlan.inactiveCornerReferences[0];
  blocked(input, 'PIPELINE_INPUTXML_GRE_DOCUMENT_INACTIVE_CORNER_REAPPEARED');
}
{
  const input = clone(createGreAdoptionFixture());
  input.greProjectionPlan.projectedElements[0].analysisSectionId = 'AS9';
  blocked(input, 'PIPELINE_INPUTXML_GRE_DOCUMENT_SECTION_BOUNDARY_CONFLICT');
}
{
  const input = clone(createGreAdoptionFixture());
  const bend = input.greProjectionPlan.bendProjections[0];
  bend.vendorId = 'FORGED-VENDOR';
  input.greProjectionPlan.projectedElements[1].bend = clone(bend);
  blocked(input, 'PIPELINE_INPUTXML_GRE_DOCUMENT_VENDOR_CONFLICT');
}
{
  const input = clone(createGreAdoptionFixture());
  const bend = input.greProjectionPlan.bendProjections[0];
  bend.fittingThicknessMm = 99;
  input.greProjectionPlan.projectedElements[1].bend = clone(bend);
  blocked(input, 'PIPELINE_INPUTXML_GRE_DOCUMENT_VENDOR_CONFLICT');
}
{
  const input = clone(createGreAdoptionFixture());
  input.greProjectionPlan.sourceElementConservation.pop();
  blocked(input, 'PIPELINE_INPUTXML_GRE_DOCUMENT_SOURCE_CONSERVATION_INVALID');
}
{
  const input = clone(createGreAdoptionFixture());
  input.greProjectionPlan.bendProjections.push(clone(input.greProjectionPlan.bendProjections[0]));
  input.greProjectionPlan.coverage.bendProjectionCount += 1;
  blocked(input, 'PIPELINE_INPUTXML_GRE_DOCUMENT_CANDIDATE_CONSERVATION_INVALID');
}
{
  const input = clone(createGreAdoptionFixture());
  input.greProjectionPlan.coverage.projectedElementCount += 1;
  blocked(input, 'PIPELINE_INPUTXML_GRE_DOCUMENT_COUNT_MISMATCH');
}
{
  const input = clone(createGreAdoptionFixture());
  const element = input.greProjectionPlan.projectedElements[0];
  element.toNode = element.fromNode;
  element.toMaterializedNodeId = element.fromMaterializedNodeId;
  element.toX = element.fromX; element.toY = element.fromY; element.toZ = element.fromZ;
  element.deltaX = 0; element.deltaY = 0; element.deltaZ = 0;
  blocked(input, 'PIPELINE_INPUTXML_GRE_DOCUMENT_ZERO_LENGTH_ELEMENT');
}
{
  const input = clone(createGreAdoptionFixture({ twoBends: true }));
  const second = input.greProjectionPlan.bendProjections[1];
  second.vendorId = 'FORGED-VENDOR';
  const owner = input.greProjectionPlan.projectedElements.find((item) =>
    item.id === second.incomingOwnerProjectionElementId);
  owner.bend = clone(second);
  const plan = blocked(input, 'PIPELINE_INPUTXML_GRE_DOCUMENT_VENDOR_CONFLICT');
  assert.equal(plan.counts.adoptedElementCount, 0);
}
{
  const source = clone(createGreAdoptionFixture().sourceDocumentPlan);
  const projection = clone(createNoGreAdoptionFixture('gre').greProjectionPlan);
  blocked({ sourceDocumentPlan: source, greProjectionPlan: projection },
    'PIPELINE_INPUTXML_GRE_DOCUMENT_BEND_OWNERSHIP_INVALID');
}

console.log('pipeline-3d-model InputXML GRE document adoption adversarial: PASS');
