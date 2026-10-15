import assert from 'node:assert/strict';
import {
  PIPELINE_APPROVED_CATALOG_STATUS_ARTIFACT_NAME,
  PIPELINE_APPROVED_CATALOG_STATUS_EVIDENCE_SCHEMA,
  buildPipelineApprovedCatalogStatusArtifact,
  buildPipelineApprovedCatalogStatusEvidence,
  pipelineApprovedCatalogVisibleArtifacts,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-approved-catalog-status-artifact.js';
import {
  PIPELINE_INPUTXML_READINESS_ARTIFACT_NAME,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-readiness-artifact.js';

const output = {
  diagnostics: {
    approvedCatalogAdoptionActive: true,
    approvedCatalogAdoptionReady: false,
    approvedCatalogRegistryReference: 'P3D-CATALOG@R2#sha256:def',
    approvedCatalogBindingCount: 3,
  },
  inputXmlDocumentPlan: {
    schema: 'PipelineInputXmlDocumentPlan.v1',
    blockerCodes: ['PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_ENTRY_MISMATCH'],
  },
  exportQualification: { inputXmlAllowed: false },
  artifacts: [{ name: 'existing.json', text: '{}' }],
};
const before = JSON.stringify(output);
const evidence = buildPipelineApprovedCatalogStatusEvidence(output);
assert.equal(evidence.schema, PIPELINE_APPROVED_CATALOG_STATUS_EVIDENCE_SCHEMA);
assert.equal(evidence.state, 'BLOCKED');
assert.equal(evidence.registryReference, 'P3D-CATALOG@R2#sha256:def');
assert.equal(evidence.bindingCount, 3);
assert.deepEqual(evidence.blockerCodes,
  ['PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_ENTRY_MISMATCH']);
assert.equal(evidence.documentSchema, 'PipelineInputXmlDocumentPlan.v1');
assert.equal(evidence.inputXmlAllowed, false);
assert.equal(Object.isFrozen(evidence), true);
assert.equal(Object.isFrozen(evidence.blockerCodes), true);

const artifact = buildPipelineApprovedCatalogStatusArtifact(output);
assert.equal(artifact.name, PIPELINE_APPROVED_CATALOG_STATUS_ARTIFACT_NAME);
assert.equal(artifact.role, 'ENGINEERING_EVIDENCE');
assert.equal(JSON.parse(artifact.text).state, 'BLOCKED');

const visible = pipelineApprovedCatalogVisibleArtifacts(output);
assert.deepEqual(visible.map((item) => item.name), [
  'existing.json',
  PIPELINE_APPROVED_CATALOG_STATUS_ARTIFACT_NAME,
  PIPELINE_INPUTXML_READINESS_ARTIFACT_NAME,
]);
assert.equal(Object.isFrozen(visible), true);
assert.equal(JSON.stringify(output), before, 'artifact assembly must not mutate source output');

const deduplicated = pipelineApprovedCatalogVisibleArtifacts({
  ...output,
  artifacts: [...output.artifacts, artifact],
});
assert.equal(deduplicated.filter((item) =>
  item.name === PIPELINE_APPROVED_CATALOG_STATUS_ARTIFACT_NAME).length, 1);
assert.equal(deduplicated.filter((item) =>
  item.name === PIPELINE_INPUTXML_READINESS_ARTIFACT_NAME).length, 1);

console.log('pipeline-3d-model approved catalog status artifact: PASS');
