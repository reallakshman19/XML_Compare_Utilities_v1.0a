import assert from 'node:assert/strict';
import {
  renderPipelineInputXmlDownloadControl,
  resolvePipelineInputXmlDownloadState,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-download-control.js';

function createButtonFixture() {
  const attributes = {};
  const button = {
    disabled: false,
    dataset: {},
    title: '',
    setAttribute(name, value) { attributes[name] = value; },
  };
  return { attributes, button, dialog: { querySelector: () => button } };
}

const blocked = resolvePipelineInputXmlDownloadState({
  orchestration: { blockerCodes: ['ORCHESTRATION_BLOCKER'] },
  exportQualification: { inputXmlAllowed: false, blockerCodes: ['EXPORT_BLOCKER'] },
  inputXmlDocumentPlan: { blockerCodes: ['DOCUMENT_BLOCKER'] },
});
assert.equal(blocked.state, 'BLOCKED');
assert.deepEqual(blocked.blockerCodes,
  ['ORCHESTRATION_BLOCKER', 'EXPORT_BLOCKER', 'DOCUMENT_BLOCKER']);

const fixture = createButtonFixture();
renderPipelineInputXmlDownloadControl(fixture.dialog, {
  exportQualification: { inputXmlAllowed: false, blockerCodes: ['EXPORT_BLOCKER'] },
});
assert.equal(fixture.button.disabled, true);
assert.equal(fixture.button.dataset.inputXmlState, 'BLOCKED');
assert.equal(fixture.attributes['aria-disabled'], 'true');
assert.match(fixture.button.title, /EXPORT_BLOCKER/);

const ready = renderPipelineInputXmlDownloadControl(fixture.dialog, {});
assert.equal(ready.state, 'READY');
assert.equal(fixture.button.disabled, false);
assert.equal(fixture.button.dataset.inputXmlState, 'READY');
assert.equal(fixture.attributes['aria-disabled'], 'false');
assert.equal(fixture.button.title, '');

const contradictory = resolvePipelineInputXmlDownloadState({
  xmlText: '<ROOT />',
  inputXmlDocumentPlan: { blockerCodes: ['DOCUMENT_BLOCKER'] },
});
assert.equal(contradictory.state, 'BLOCKED');

console.log('pipeline-3d-model InputXML download control: PASS');
