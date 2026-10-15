import assert from 'node:assert/strict';
import {
  PIPELINE_EXPORT_MANIFEST_NAME,
  PIPELINE_EXPORT_MANIFEST_SCHEMA,
  buildPipelineExportManifestArtifact,
  buildPipelineExportManifestEvidence,
  pipelineArtifactsWithManifest,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-export-manifest-artifact.js';

const source = [
  { fileId: 'a', name: 'a.json', role: 'ENGINEERING_EVIDENCE', mime: 'application/json',
    sourceSchema: 'A.v1', text: '{"a":1}' },
  { fileId: 'b', name: 'b.txt', role: 'SOURCE_TABLE', mime: 'text/plain',
    sourceSchema: 'B.v1', text: 'μ' },
];
const before = JSON.stringify(source);
const evidence = buildPipelineExportManifestEvidence(source);
assert.equal(evidence.schema, PIPELINE_EXPORT_MANIFEST_SCHEMA);
assert.equal(evidence.artifactCount, 2);
assert.deepEqual(evidence.artifacts.map((item) => item.order), [0, 1]);
assert.deepEqual(evidence.artifacts.map((item) => item.name), ['a.json', 'b.txt']);
assert.equal(evidence.artifacts[0].byteLength, 7);
assert.equal(evidence.artifacts[1].byteLength, 2);
assert.equal(Object.isFrozen(evidence), true);
assert.equal(Object.isFrozen(evidence.artifacts), true);
assert.equal(Object.isFrozen(evidence.artifacts[0]), true);

const artifact = buildPipelineExportManifestArtifact(source);
assert.equal(artifact.name, PIPELINE_EXPORT_MANIFEST_NAME);
assert.equal(artifact.sourceSchema, PIPELINE_EXPORT_MANIFEST_SCHEMA);
assert.equal(JSON.parse(artifact.text).artifactCount, 2);

const assembled = pipelineArtifactsWithManifest(source);
assert.deepEqual(assembled.map((item) => item.name),
  ['a.json', 'b.txt', PIPELINE_EXPORT_MANIFEST_NAME]);
assert.equal(JSON.stringify(source), before, 'manifest assembly must not mutate source artifacts');
const regenerated = pipelineArtifactsWithManifest([...assembled, {
  name: PIPELINE_EXPORT_MANIFEST_NAME, text: 'stale',
}]);
assert.equal(regenerated.filter((item) => item.name === PIPELINE_EXPORT_MANIFEST_NAME).length, 1);
assert.equal(JSON.parse(regenerated.at(-1).text).artifactCount, 2);
assert.deepEqual(JSON.parse(regenerated.at(-1).text).artifacts.map((item) => item.name),
  ['a.json', 'b.txt']);

console.log('pipeline-3d-model export manifest artifact: PASS');
