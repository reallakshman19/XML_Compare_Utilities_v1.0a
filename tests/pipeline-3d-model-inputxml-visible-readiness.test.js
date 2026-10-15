import assert from 'node:assert/strict';
import {
  renderPipelineInputXmlDownloadControl,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-download-control.js';

function createFixture() {
  const attributes = {};
  const button = {
    disabled: false,
    dataset: {},
    title: '',
    setAttribute(name, value) { attributes[name] = value; },
  };
  let statusElement = null;
  let insertionCount = 0;
  const parentElement = {
    insertBefore(element) {
      statusElement = element;
      insertionCount += 1;
    },
  };
  const xmlOutput = { parentElement };
  const dialog = {
    ownerDocument: {
      createElement: () => ({ id: '', dataset: {}, className: '', textContent: '', title: '' }),
    },
    querySelector(selector) {
      if (selector === '[data-p3d="download-xml"]') return button;
      if (selector === '[data-p3d-inputxml-status]') return statusElement;
      if (selector === '[data-p3d="xml-output"]') return xmlOutput;
      return null;
    },
  };
  return { attributes, button, dialog,
    insertionCount: () => insertionCount,
    statusElement: () => statusElement };
}

const fixture = createFixture();
renderPipelineInputXmlDownloadControl(fixture.dialog, {
  exportQualification: { inputXmlAllowed: false, blockerCodes: ['EXPORT_BLOCKER'] },
});
assert.equal(fixture.insertionCount(), 1);
assert.equal(fixture.statusElement().id, 'p3d-inputxml-download-status');
assert.equal(fixture.statusElement().dataset.state, 'BLOCKED');
assert.equal(fixture.statusElement().textContent,
  'InputXML export: blocked — EXPORT_BLOCKER');
assert.equal(fixture.statusElement().title, 'EXPORT_BLOCKER');
assert.equal(fixture.button.disabled, true);

renderPipelineInputXmlDownloadControl(fixture.dialog, {});
assert.equal(fixture.insertionCount(), 1);
assert.equal(fixture.statusElement().dataset.state, 'READY');
assert.equal(fixture.statusElement().textContent, 'InputXML export: ready');
assert.equal(fixture.statusElement().title, '');
assert.equal(fixture.button.disabled, false);
assert.equal(fixture.attributes['aria-disabled'], 'false');

console.log('pipeline-3d-model visible InputXML readiness: PASS');
