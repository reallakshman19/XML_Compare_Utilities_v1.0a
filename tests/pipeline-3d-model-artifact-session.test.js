import assert from 'node:assert/strict';
import { createPipelineArtifactSession } from '../tabs/pipeline-3d-model/pipeline-3d-model-artifact-session.js';
import { createPipelineOnDemandTextArtifact } from '../tabs/pipeline-3d-model/pipeline-3d-model-on-demand-artifact.js';

let assemblies = 0;
let materializations = 0;
const session = createPipelineArtifactSession((output) => {
  assemblies += 1;
  return Object.freeze([createPipelineOnDemandTextArtifact({ name: `${output.id}.json` }, () => {
    materializations += 1;
    return JSON.stringify(output);
  })]);
});
const firstOutput = Object.freeze({ id: 'first' });
const first = session.resolve(firstOutput);
assert.equal(assemblies, 1);
assert.equal(session.resolve(firstOutput), first);
assert.equal(assemblies, 1, 'same output must reuse the artifact list');
assert.equal(first[0].text, '{"id":"first"}');
assert.equal(first[0].text, '{"id":"first"}');
assert.equal(materializations, 1, 'repeated downloads must reuse memoized artifact text');

session.reset();
const rebuilt = session.resolve(firstOutput);
assert.notEqual(rebuilt, first);
assert.equal(assemblies, 2);
assert.equal(rebuilt[0].text, '{"id":"first"}');
assert.equal(materializations, 2);

const second = session.resolve(Object.freeze({ id: 'second' }));
assert.equal(assemblies, 3);
assert.equal(second[0].name, 'second.json');
assert.throws(() => createPipelineArtifactSession(() => ({})).resolve({}), /must return an array/);
console.log('pipeline artifact session tests passed');
