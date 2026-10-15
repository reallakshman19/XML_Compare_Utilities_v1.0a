import assert from 'node:assert/strict';
import {
  writePipelineElementHtml,
  writePipelineElementText,
  writePipelineElementValue,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-dom-write.js';
import { renderPipelineSvgPreview } from '../tabs/pipeline-3d-model/pipeline-3d-model-svg-reference.js';

class FakeEvent { constructor(type, options) { this.type = type; this.bubbles = options?.bubbles; } }
const field = { value: 'same', events: [], dispatchEvent(event) { this.events.push(event); } };
assert.equal(writePipelineElementValue(field, 'same', FakeEvent), false);
assert.equal(field.events.length, 0);
assert.equal(writePipelineElementValue(field, 'next', FakeEvent), true);
assert.equal(field.value, 'next');
assert.equal(field.events.length, 1);
assert.equal(field.events[0].bubbles, true);

const html = { innerHTML: '<b>same</b>' };
assert.equal(writePipelineElementHtml(html, '<b>same</b>'), false);
assert.equal(writePipelineElementHtml(html, '<b>next</b>'), true);
assert.equal(html.innerHTML, '<b>next</b>');

const output = { textContent: 'same' };
assert.equal(writePipelineElementText(output, 'same'), false);
assert.equal(writePipelineElementText(output, 'next'), true);
assert.equal(output.textContent, 'next');

const reference = { innerHTML: '<svg>same</svg>' };
const holder = { querySelector: () => reference };
assert.equal(renderPipelineSvgPreview(holder, '<svg>same</svg>'), false);
assert.equal(renderPipelineSvgPreview(holder, '<svg>next</svg>'), true);
assert.equal(reference.innerHTML, '<svg>next</svg>');

console.log('pipeline-3d-model idempotent DOM writes: PASS');
