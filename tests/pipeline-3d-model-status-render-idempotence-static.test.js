import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../tabs/pipeline-3d-model/${name}`, import.meta.url), 'utf8');
const stateWrite = read('pipeline-3d-model-dom-state-write.js');
const approved = read('pipeline-3d-model-approved-catalog-status.js');
const inputXml = read('pipeline-3d-model-inputxml-download-control.js');
const warnings = read('pipeline-3d-model-warning-log.js');

assert.ok(stateWrite.split('\n').length <= 40, 'DOM state writer must remain below 40 lines');
assert.match(stateWrite, /export function writePipelineElementProperty/);
assert.match(stateWrite, /export function writePipelineElementDataset/);
assert.match(stateWrite, /export function writePipelineElementAttribute/);
for (const source of [approved, inputXml]) {
  assert.match(source, /pipeline-3d-model-dom-state-write\.js/);
  assert.match(source, /writePipelineElementText/);
  assert.doesNotMatch(source, /\.dataset\.state\s*=/);
  assert.doesNotMatch(source, /\.textContent\s*=/);
}
assert.match(warnings, /writePipelineElementText/);
assert.match(warnings, /writePipelineElementHtml/);
assert.doesNotMatch(warnings, /count\.textContent\s*=/);
assert.doesNotMatch(warnings, /body\.innerHTML\s*=/);
assert.ok(approved.split('\n').length <= 120);
assert.ok(inputXml.split('\n').length <= 90);
assert.ok(warnings.split('\n').length <= 100);

console.log('pipeline-3d-model status render idempotence static: PASS');
