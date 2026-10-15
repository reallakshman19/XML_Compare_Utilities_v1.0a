import assert from 'node:assert/strict';
import {
  PIPELINE_INPUTXML_GRE_DOCUMENT_ADOPTION_PLAN_SCHEMA,
  buildPipelineInputXmlGreBendAuthoritiesTsv,
  buildPipelineInputXmlGreDocumentElementsTsv,
  createPipelineInputXmlGreDocumentAdoptionDiagnostic,
  createPipelineInputXmlGreDocumentAdoptionPlan,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-gre-document-adoption-contracts.js';

const ready = createPipelineInputXmlGreDocumentAdoptionPlan({
  sourceDocumentPlanSchema: 'PipelineInputXmlDocumentPlan.v1',
  sourceProjectionPlanSchema: 'PipelineInputXmlGreProjectionPlan.v1',
  adoptedElements: [{ id: 'E1', index: 0, profileId: 'gre', analysisSectionId: 'AS1',
    fromNode: 100, toNode: 110, sourceProjectionElementId: 'E1',
    sourceMaterializedElementId: 'm1', sourceElementIndexes: [0], bend: null }],
  greBendAuthorities: [], sourceElementConservation: [], candidateConservation: [],
  inactiveCornerReferences: [], removedSourceBlockerCodes: [],
  counts: { numElt: 1, numBend: 0, sourceElementCount: 1, projectedElementCount: 1,
    adoptedElementCount: 1, greCandidateCount: 0, greBendAuthorityCount: 0, inactiveCornerCount: 0 },
});
assert.equal(ready.schema, PIPELINE_INPUTXML_GRE_DOCUMENT_ADOPTION_PLAN_SCHEMA);
assert.equal(ready.ready, true);
assert.equal(ready.projectionStatus, 'READY');
assert.equal(ready.documentAuthorityAdopted, true);
assert.equal(ready.writerAdmission, 'NOT_ADOPTED');
assert.equal(ready.coordinateRouteAdopted, false);
assert.equal(ready.canvasAdopted, false);
assert.equal(Object.isFrozen(ready), true);
assert.match(buildPipelineInputXmlGreDocumentElementsTsv(ready), /^Id\tIndex\t/);
assert.match(buildPipelineInputXmlGreBendAuthoritiesTsv(ready), /^CandidateId\t/);

const blocked = createPipelineInputXmlGreDocumentAdoptionPlan({ adoptedElements: [{ id: 'E1' }] }, [
  createPipelineInputXmlGreDocumentAdoptionDiagnostic('PIPELINE_INPUTXML_GRE_SOURCE_DOCUMENT_INVALID'),
]);
assert.equal(blocked.ready, false);
assert.equal(blocked.documentAuthorityAdopted, false);
assert.equal(blocked.writerAdmission, 'BLOCKED');
assert.deepEqual(blocked.adoptedElements, []);
assert.deepEqual(blocked.greBendAuthorities, []);
assert.deepEqual(blocked.sourceElementConservation, []);
assert.deepEqual(blocked.candidateConservation, []);

console.log('pipeline-3d-model InputXML GRE document adoption contracts: PASS');
