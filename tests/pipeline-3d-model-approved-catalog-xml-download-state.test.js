import assert from 'node:assert/strict';
import {
  renderPipelineApprovedCatalogStatus,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-approved-catalog-status.js';

function createControlFixture() {
  const attributes = {};
  const button = {
    disabled: false,
    dataset: {},
    title: '',
    setAttribute(name, value) { attributes[name] = value; },
    removeAttribute(name) {
      delete attributes[name];
      if (name === 'title') this.title = '';
    },
  };
  const statusElement = { id: '', dataset: {}, textContent: '', title: '' };
  const dialog = {
    ownerDocument: {},
    querySelector(selector) {
      if (selector === '[data-p3d-approved-catalog-status]') return statusElement;
      if (selector === '[data-p3d="download-xml"]') return button;
      return null;
    },
  };
  return { attributes, button, dialog, statusElement };
}

const fixture = createControlFixture();
const blocked = renderPipelineApprovedCatalogStatus(fixture.dialog, {
  diagnostics: {
    approvedCatalogAdoptionActive: true,
    approvedCatalogAdoptionReady: false,
    approvedCatalogBindingCount: 1,
  },
  orchestration: {
    blockerCodes: ['PIPELINE_APPROVED_CATALOG_REGISTRY_REQUIRED'],
  },
});
assert.equal(blocked.state, 'BLOCKED');
assert.equal(fixture.button.disabled, true);
assert.equal(fixture.button.dataset.approvedCatalogState, 'BLOCKED');
assert.equal(fixture.attributes['aria-disabled'], 'true');
assert.equal(fixture.attributes['aria-describedby'], 'p3d-approved-catalog-status');
assert.match(fixture.button.title, /PIPELINE_APPROVED_CATALOG_REGISTRY_REQUIRED/);
assert.match(fixture.statusElement.textContent, /PIPELINE_APPROVED_CATALOG_REGISTRY_REQUIRED/);

const ready = renderPipelineApprovedCatalogStatus(fixture.dialog, {
  diagnostics: {
    approvedCatalogAdoptionActive: true,
    approvedCatalogAdoptionReady: true,
    approvedCatalogRegistryReference: 'P3D-CATALOG@R1#sha256:abc',
    approvedCatalogBindingCount: 2,
  },
});
assert.equal(ready.state, 'READY');
assert.equal(fixture.button.disabled, false);
assert.equal(fixture.button.dataset.approvedCatalogState, 'READY');
assert.equal(fixture.attributes['aria-disabled'], 'false');
assert.equal(fixture.button.title, '');
assert.equal(fixture.statusElement.textContent,
  'Approved catalog: P3D-CATALOG@R1#sha256:abc — adopted — 2 bindings');

console.log('pipeline-3d-model approved catalog XML download state: PASS');
