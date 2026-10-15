import assert from 'node:assert/strict';
import {
  PIPELINE_ARTIFACT_MATERIALIZATION_ON_DOWNLOAD,
  createPipelineOnDemandTextArtifact,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-on-demand-artifact.js';

let builds = 0;
const metadata = { name: 'large.json', role: 'ENGINEERING_EVIDENCE', text: 'stale' };
const before = JSON.stringify(metadata);
const artifact = createPipelineOnDemandTextArtifact(metadata, () => {
  builds += 1;
  return '{"large":true}';
});
assert.equal(builds, 0, 'artifact text must not be built at descriptor creation');
assert.equal(artifact.materialization, PIPELINE_ARTIFACT_MATERIALIZATION_ON_DOWNLOAD);
assert.equal(Object.isFrozen(artifact), true);
assert.equal(JSON.stringify(metadata), before, 'descriptor creation must not mutate metadata');
assert.equal(artifact.text, '{"large":true}');
assert.equal(builds, 1);
assert.equal(artifact.text, '{"large":true}');
assert.equal(builds, 1, 'artifact text must be memoized per descriptor');
assert.throws(() => createPipelineOnDemandTextArtifact({}, null), TypeError);
const invalid = createPipelineOnDemandTextArtifact({}, () => 42);
assert.throws(() => invalid.text, TypeError);

console.log('pipeline-3d-model on-demand artifact: PASS');
