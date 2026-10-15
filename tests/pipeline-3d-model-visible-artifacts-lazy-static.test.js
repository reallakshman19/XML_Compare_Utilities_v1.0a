import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL(
  '../tabs/pipeline-3d-model/pipeline-3d-model-visible-artifacts.js', import.meta.url), 'utf8');
assert.match(source, /createPipelineOnDemandTextArtifact/);
assert.match(source, /buildPipelineEvidenceBundleArtifact/);
assert.match(source, /buildPipelineExportManifestArtifact/);
assert.doesNotMatch(source, /pipelineArtifactsWithEvidenceBundle/);
assert.doesNotMatch(source, /pipelineArtifactsWithManifest/);
assert.match(source, /bundleDescriptor\(artifacts\)/);
assert.match(source, /manifestDescriptor\(artifacts\)/);

console.log('pipeline-3d-model lazy visible artifacts static: PASS');
