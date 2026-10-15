import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  resolvePipelineInputXmlBlockerProvenance,
  resolvePipelineInputXmlBlockers,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-readiness.js';
import {
  PIPELINE_INPUTXML_BLOCKER_PROVENANCE_ARTIFACT_NAME,
  buildPipelineInputXmlBlockerProvenanceArtifact,
  buildPipelineInputXmlBlockerProvenanceEvidence,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-blocker-provenance-artifact.js';

const output = {
  orchestration: { blockerCodes: ['SHARED', 'ORCHESTRATION_ONLY'] },
  exportQualification: {
    inputXmlAllowed: false,
    blockerCodes: ['EXPORT_ONLY', 'SHARED'],
  },
  inputXmlDocumentPlan: { blockerCodes: ['SHARED', 'DOCUMENT_ONLY'] },
};
const before = JSON.stringify(output);
const provenance = resolvePipelineInputXmlBlockerProvenance(output);
assert.deepEqual(provenance.map((row) => row.blockerCode),
  ['SHARED', 'ORCHESTRATION_ONLY', 'EXPORT_ONLY', 'DOCUMENT_ONLY']);
assert.deepEqual(provenance[0].sources,
  ['ORCHESTRATION', 'EXPORT_QUALIFICATION', 'INPUTXML_DOCUMENT_PLAN']);
assert.deepEqual(resolvePipelineInputXmlBlockers(output),
  provenance.map((row) => row.blockerCode));
assert.equal(Object.isFrozen(provenance), true);
assert.equal(Object.isFrozen(provenance[0]), true);
assert.equal(Object.isFrozen(provenance[0].sources), true);
assert.equal(JSON.stringify(output), before);

const evidence = buildPipelineInputXmlBlockerProvenanceEvidence(output);
assert.equal(evidence.state, 'BLOCKED');
assert.equal(evidence.blockerCount, 4);
const artifact = buildPipelineInputXmlBlockerProvenanceArtifact(output);
assert.equal(artifact.name, PIPELINE_INPUTXML_BLOCKER_PROVENANCE_ARTIFACT_NAME);
assert.match(artifact.text, /^Order\tBlockerCode\tSources\n/);
assert.match(artifact.text,
  /1\tSHARED\tORCHESTRATION\|EXPORT_QUALIFICATION\|INPUTXML_DOCUMENT_PLAN/);

const fallback = resolvePipelineInputXmlBlockerProvenance({
  exportQualification: { inputXmlAllowed: false, blockerCodes: [] },
});
assert.deepEqual(fallback[0], {
  order: 1,
  blockerCode: 'PIPELINE_PROJECT_MIGRATION_INPUTXML_NOT_ALLOWED',
  sources: ['EXPORT_QUALIFICATION'],
});
const readyArtifact = buildPipelineInputXmlBlockerProvenanceArtifact({});
assert.equal(readyArtifact.text, 'Order\tBlockerCode\tSources\n');

const aggregator = fs.readFileSync(new URL(
  '../tabs/pipeline-3d-model/pipeline-3d-model-approved-catalog-status-artifact.js',
  import.meta.url), 'utf8');
assert.match(aggregator, /buildPipelineInputXmlBlockerProvenanceArtifact/);
assert.match(aggregator, /appendArtifact\(copied, buildPipelineInputXmlBlockerProvenanceArtifact\(output\)\)/);

console.log('pipeline-3d-model InputXML blocker provenance: PASS');
