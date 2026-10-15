import assert from 'node:assert/strict';
import { renderPipelineApprovedCatalogStatus } from '../tabs/pipeline-3d-model/pipeline-3d-model-approved-catalog-status.js';
import { renderPipelineWarningLog } from '../tabs/pipeline-3d-model/pipeline-3d-model-warning-log.js';

function trackedElement(initial = {}) {
  const writes = {};
  const values = { ...initial };
  const attributes = new Map();
  const datasetValues = {};
  const dataset = new Proxy(datasetValues, {
    set(target, key, value) {
      writes[`dataset.${String(key)}`] = (writes[`dataset.${String(key)}`] || 0) + 1;
      target[key] = value;
      return true;
    },
  });
  const element = {
    dataset,
    getAttribute: (name) => attributes.get(name),
    setAttribute(name, value) {
      writes[`attribute.${name}`] = (writes[`attribute.${name}`] || 0) + 1;
      attributes.set(name, value);
    },
  };
  for (const name of ['id', 'textContent', 'title', 'disabled', 'innerHTML']) {
    Object.defineProperty(element, name, {
      get: () => values[name],
      set(value) {
        writes[name] = (writes[name] || 0) + 1;
        values[name] = value;
      },
    });
  }
  return { element, writes };
}

function writeCount(...records) {
  return records.reduce((total, record) => total
    + Object.values(record.writes).reduce((sum, value) => sum + value, 0), 0);
}

const approved = trackedElement();
const inputXml = trackedElement();
const button = trackedElement({ disabled: false });
const count = trackedElement();
const body = trackedElement();
const warningPanel = {
  querySelector(selector) {
    if (selector === '[data-p3d-warning-count]') return count.element;
    if (selector === '[data-p3d-warning-body]') return body.element;
    return null;
  },
};
const elements = new Map([
  ['[data-p3d-approved-catalog-status]', approved.element],
  ['[data-p3d-inputxml-status]', inputXml.element],
  ['[data-p3d="download-xml"]', button.element],
  ['[data-p3d-warning-log]', warningPanel],
]);
const dialog = {
  ownerDocument: { getElementById: () => ({}), createElement: () => trackedElement().element },
  querySelector: (selector) => elements.get(selector) || null,
};

renderPipelineApprovedCatalogStatus(dialog, {});
const statusFirst = writeCount(approved, inputXml, button);
renderPipelineApprovedCatalogStatus(dialog, {});
assert.equal(writeCount(approved, inputXml, button), statusFirst,
  'unchanged approved-catalog and InputXML state must not rewrite DOM');

const blockedOutput = {
  diagnostics: {
    approvedCatalogAdoptionActive: true,
    approvedCatalogAdoptionReady: false,
    approvedCatalogRegistryReference: 'REGISTRY-A',
    approvedCatalogBindingCount: 2,
  },
  orchestration: { blockerCodes: ['APPROVED_CATALOG_SOURCE_UNRESOLVED'] },
};
renderPipelineApprovedCatalogStatus(dialog, blockedOutput);
assert.ok(writeCount(approved, inputXml, button) > statusFirst,
  'changed approved-catalog state must update DOM');

const warnings = [{ code: 'W1', message: 'Warning one', details: { row: 2 } }];
renderPipelineWarningLog(dialog, warnings);
const warningFirst = writeCount(count, body);
renderPipelineWarningLog(dialog, structuredClone(warnings));
assert.equal(writeCount(count, body), warningFirst,
  'unchanged warning state must not rewrite count or body');
renderPipelineWarningLog(dialog, [...warnings, { code: 'W2', message: 'Warning two' }]);
assert.ok(writeCount(count, body) > warningFirst, 'changed warning state must update the panel');

console.log('pipeline-3d-model status render idempotence: PASS');
