import assert from 'node:assert/strict';
import {
  writePipelineElementAttribute,
  writePipelineElementDataset,
  writePipelineElementProperty,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-dom-state-write.js';

const attributes = new Map([['aria-disabled', 'false']]);
const element = {
  dataset: { state: 'READY' },
  disabled: false,
  getAttribute: (name) => attributes.get(name),
  setAttribute: (name, value) => attributes.set(name, value),
};

assert.equal(writePipelineElementProperty(element, 'disabled', false), false);
assert.equal(writePipelineElementProperty(element, 'disabled', true), true);
assert.equal(element.disabled, true);
assert.equal(writePipelineElementDataset(element, 'state', 'READY'), false);
assert.equal(writePipelineElementDataset(element, 'state', 'BLOCKED'), true);
assert.equal(element.dataset.state, 'BLOCKED');
assert.equal(writePipelineElementAttribute(element, 'aria-disabled', false), false);
assert.equal(writePipelineElementAttribute(element, 'aria-disabled', true), true);
assert.equal(attributes.get('aria-disabled'), 'true');
assert.equal(writePipelineElementProperty(null, 'disabled', true), false);
assert.equal(writePipelineElementDataset(null, 'state', 'READY'), false);
assert.equal(writePipelineElementAttribute(null, 'aria-disabled', true), false);

console.log('pipeline-3d-model DOM state write: PASS');
