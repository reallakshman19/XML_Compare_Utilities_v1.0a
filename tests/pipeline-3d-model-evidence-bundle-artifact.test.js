import assert from 'node:assert/strict';
import {
  PIPELINE_EVIDENCE_BUNDLE_NAME,
  PIPELINE_EVIDENCE_BUNDLE_SCHEMA,
  buildPipelineEvidenceBundle,
  buildPipelineEvidenceBundleArtifact,
  pipelineArtifactsWithEvidenceBundle,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-evidence-bundle-artifact.js';

const source = [
  { fileId: 'status', name: 'status.json', role: 'ENGINEERING_EVIDENCE',
    mime: 'application/json', sourceSchema: 'Status.v1', text: '{"ok":true}' },
  { fileId: 'table', name: 'table.tsv', role: 'SOURCE_TABLE',
    mime: 'text/tab-separated-values', sourceSchema: 'Table.v1', text: 'A\tB' },
];
const before = JSON.stringify(source);
const evidence = buildPipelineEvidenceBundle(source);
assert.equal(evidence.schema, PIPELINE_EVIDENCE_BUNDLE_SCHEMA);
assert.equal(evidence.artifactCount, 2);
assert.deepEqual(evidence.artifacts.map((item) => item.order), [0, 1]);
assert.deepEqual(evidence.artifacts.map((item) => item.name), ['status.json', 'table.tsv']);
assert.equal(evidence.artifacts[0].text, '{"ok":true}');
assert.equal(Object.isFrozen(evidence), true);
assert.equal(Object.isFrozen(evidence.artifacts), true);
assert.equal(Object.isFrozen(evidence.artifacts[0]), true);

const artifact = buildPipelineEvidenceBundleArtifact(source);
assert.equal(artifact.name, PIPELINE_EVIDENCE_BUNDLE_NAME);
assert.equal(artifact.role, 'ENGINEERING_EVIDENCE');
assert.equal(JSON.parse(artifact.text).artifactCount, 2);
assert.equal(artifact.text.endsWith('\n'), true);

const assembled = pipelineArtifactsWithEvidenceBundle(source);
assert.deepEqual(assembled.map((item) => item.name),
  ['status.json', 'table.tsv', PIPELINE_EVIDENCE_BUNDLE_NAME]);
assert.equal(JSON.stringify(source), before, 'bundle assembly must not mutate source artifacts');
const stale = pipelineArtifactsWithEvidenceBundle([
  ...assembled,
  { name: 'pipeline-export-manifest.json', text: 'stale' },
  { name: PIPELINE_EVIDENCE_BUNDLE_NAME, text: 'stale' },
]);
assert.equal(stale.filter((item) => item.name === PIPELINE_EVIDENCE_BUNDLE_NAME).length, 1);
const regenerated = JSON.parse(stale.at(-1).text);
assert.equal(regenerated.artifactCount, 2);
assert.deepEqual(regenerated.artifacts.map((item) => item.name), ['status.json', 'table.tsv']);
assert.equal(regenerated.artifacts.some((item) =>
  item.name === 'pipeline-export-manifest.json'), false);

console.log('pipeline-3d-model evidence bundle artifact: PASS');
