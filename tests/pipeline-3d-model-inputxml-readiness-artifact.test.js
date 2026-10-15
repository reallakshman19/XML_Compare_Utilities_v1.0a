import assert from 'node:assert/strict';
import {
  PIPELINE_INPUTXML_READINESS_ARTIFACT_NAME,
  PIPELINE_INPUTXML_READINESS_EVIDENCE_SCHEMA,
  buildPipelineInputXmlReadinessArtifact,
  buildPipelineInputXmlReadinessEvidence,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-readiness-artifact.js';
import {
  pipelineApprovedCatalogVisibleArtifacts,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-approved-catalog-status-artifact.js';

const output = {
  xmlText: '',
  orchestration: { schema: 'PipelineOrchestration.v1', blockerCodes: ['ORCHESTRATION_BLOCKER'] },
  exportQualification: { inputXmlAllowed: false, blockerCodes: ['EXPORT_BLOCKER'] },
  inputXmlDocumentPlan: { schema: 'PipelineInputXmlDocumentPlan.v1', blockerCodes: ['DOCUMENT_BLOCKER'] },
  artifacts: [{ name: 'existing.json', text: '{}' }],
};
const before = JSON.stringify(output);
const evidence = buildPipelineInputXmlReadinessEvidence(output);
assert.equal(evidence.schema, PIPELINE_INPUTXML_READINESS_EVIDENCE_SCHEMA);
assert.equal(evidence.state, 'BLOCKED');
assert.deepEqual(evidence.blockerCodes,
  ['ORCHESTRATION_BLOCKER', 'EXPORT_BLOCKER', 'DOCUMENT_BLOCKER']);
assert.equal(evidence.inputXmlAllowed, false);
assert.equal(evidence.documentSchema, 'PipelineInputXmlDocumentPlan.v1');
assert.equal(evidence.orchestrationSchema, 'PipelineOrchestration.v1');
assert.equal(evidence.xmlAvailable, false);
assert.equal(Object.isFrozen(evidence), true);
assert.equal(Object.isFrozen(evidence.blockerCodes), true);

const artifact = buildPipelineInputXmlReadinessArtifact(output);
assert.equal(artifact.name, PIPELINE_INPUTXML_READINESS_ARTIFACT_NAME);
assert.equal(artifact.role, 'ENGINEERING_EVIDENCE');
assert.deepEqual(JSON.parse(artifact.text).blockerCodes, evidence.blockerCodes);
assert.equal(artifact.text.endsWith('\n'), true);

const visible = pipelineApprovedCatalogVisibleArtifacts(output);
assert.deepEqual(visible.map((item) => item.name), [
  'existing.json',
  'pipeline-approved-catalog-status.json',
  PIPELINE_INPUTXML_READINESS_ARTIFACT_NAME,
]);
assert.equal(JSON.stringify(output), before, 'artifact assembly must not mutate source output');
const deduplicated = pipelineApprovedCatalogVisibleArtifacts({ ...output,
  artifacts: [...output.artifacts, artifact] });
assert.equal(deduplicated.filter((item) => item.name === PIPELINE_INPUTXML_READINESS_ARTIFACT_NAME).length, 1);

console.log('pipeline-3d-model InputXML readiness artifact: PASS');
