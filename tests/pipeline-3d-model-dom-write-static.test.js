import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime = fs.readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-profile-propagation-runtime.js', import.meta.url), 'utf8');
const svg = fs.readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-svg-reference.js', import.meta.url), 'utf8');
const writes = fs.readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-dom-write.js', import.meta.url), 'utf8');

for (const token of ['writePipelineElementValue', 'writePipelineElementHtml', 'writePipelineElementText']) {
  assert.match(runtime, new RegExp(token));
}
assert.doesNotMatch(runtime, /table2Grid\.innerHTML|table3Grid\.innerHTML|table1Out\.textContent|coordinateOut\.textContent|xmlOut\.textContent/);
assert.match(svg, /writePipelineElementHtml/);
assert.doesNotMatch(svg, /target\.innerHTML\s*=/);
assert.ok(runtime.split(/\r?\n/).length < 300);
assert.ok(writes.split(/\r?\n/).length < 80);
assert.doesNotMatch(writes, /export\s+default|setTimeout|setInterval/);

console.log('pipeline-3d-model idempotent DOM writes static: PASS');
