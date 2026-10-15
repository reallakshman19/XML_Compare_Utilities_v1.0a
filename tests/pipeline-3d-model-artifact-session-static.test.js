import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime = fs.readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-profile-propagation-runtime.js', import.meta.url), 'utf8');
const session = fs.readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-artifact-session.js', import.meta.url), 'utf8');
assert.match(runtime, /createPipelineArtifactSession\(pipelineVisibleArtifacts\)/);
assert.match(runtime, /instance\.artifactSession\.resolve\(output\)/);
assert.match(runtime, /instance\.artifactSession\.reset\(\)/);
assert.doesNotMatch(runtime, /pipelineVisibleArtifacts\(output\)\[index\]/);
assert.ok(session.split(/\r?\n/).length < 60);
console.log('pipeline artifact session static tests passed');
