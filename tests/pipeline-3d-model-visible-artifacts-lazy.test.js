import assert from 'node:assert/strict';
import {
  PIPELINE_EVIDENCE_BUNDLE_NAME,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-evidence-bundle-artifact.js';
import {
  PIPELINE_EXPORT_MANIFEST_NAME,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-export-manifest-artifact.js';
import {
  pipelineVisibleArtifacts,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-visible-artifacts.js';

const source = [{ fileId: 'status', name: 'status.json', role: 'ENGINEERING_EVIDENCE',
  mime: 'application/json', sourceSchema: 'Status.v1', text: '{"ok":true}' }];
const before = JSON.stringify(source);
const artifacts = pipelineVisibleArtifacts({ artifacts: source });
const bundleIndex = artifacts.findIndex((item) => item.name === PIPELINE_EVIDENCE_BUNDLE_NAME);
const manifestIndex = artifacts.findIndex((item) => item.name === PIPELINE_EXPORT_MANIFEST_NAME);
assert.ok(bundleIndex > 0);
assert.equal(manifestIndex, bundleIndex + 1);
assert.equal(artifacts[bundleIndex].materialization, 'ON_DOWNLOAD');
assert.equal(artifacts[manifestIndex].materialization, 'ON_DOWNLOAD');
assert.equal(Object.getOwnPropertyDescriptor(artifacts[bundleIndex], 'text').get instanceof Function, true);
assert.equal(JSON.stringify(source), before, 'visible assembly must not mutate source artifacts');
const bundle = JSON.parse(artifacts[bundleIndex].text);
assert.equal(bundle.artifactCount, bundleIndex);
assert.equal(bundle.artifacts.some((item) => item.name === PIPELINE_EVIDENCE_BUNDLE_NAME), false);
const manifest = JSON.parse(artifacts[manifestIndex].text);
assert.equal(manifest.artifactCount, manifestIndex);
assert.equal(manifest.artifacts.at(-1).name, PIPELINE_EVIDENCE_BUNDLE_NAME);
assert.equal(manifest.artifacts.at(-1).byteLength,
  new TextEncoder().encode(artifacts[bundleIndex].text).byteLength);
assert.equal(Object.isFrozen(artifacts), true);

console.log('pipeline-3d-model lazy visible artifacts: PASS');
