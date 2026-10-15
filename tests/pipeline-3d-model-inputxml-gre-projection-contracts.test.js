import assert from 'node:assert/strict';
import {
  createPipelineInputXmlGreProjectionDiagnostic,
  createPipelineInputXmlGreProjectionPlan,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-gre-projection-contracts.js';

const ready = createPipelineInputXmlGreProjectionPlan({ projectedElements: [{ id: 'E1' }],
  bendProjections: [], sourceElementConservation: [], inactiveCornerReferences: [],
  notApplicableCandidateIds: [], coverage: { projectedElementCount: 1 } });
assert.equal(ready.ready, true);
assert.equal(ready.projectionStatus, 'READY');
assert.equal(ready.documentAuthorityAdopted, false);
assert.equal(ready.writerAdmission, 'NOT_ADOPTED');
assert.equal(ready.coordinateRouteAdopted, false);
assert.equal(ready.canvasAdopted, false);
assert.equal(Object.isFrozen(ready), true);

const blocked = createPipelineInputXmlGreProjectionPlan({ projectedElements: [{ id: 'E1' }] }, [
  createPipelineInputXmlGreProjectionDiagnostic('PIPELINE_INPUTXML_GRE_ELEMENT_IDENTITY_INVALID'),
]);
assert.equal(blocked.ready, false);
assert.equal(blocked.projectionStatus, 'BLOCKED');
assert.equal(blocked.writerAdmission, 'BLOCKED');
assert.deepEqual(blocked.projectedElements, []);
assert.deepEqual(blocked.bendProjections, []);

console.log('pipeline-3d-model InputXML GRE projection contracts: PASS');
