import assert from 'node:assert/strict';

import { renderXmlCompareAutoMapPopupHtml } from '../xml-compare/XmlCompareAutoMapPopup.js';

// Checks Auto Map validation output for text rows. Inputs are selected source
// and target records; output is the validation panel HTML embedded in the popup.

const sourceRecord = {
  uid: 'source-node-1',
  levelId: 'node',
  displayName: 'Source 1',
  MATERIAL_NAME: ' A  B ',
};
const targetRecord = {
  uid: 'target-node-1',
  levelId: 'node',
  displayName: 'Target 1',
  MATERIAL_NAME: 'a b',
};

const html = renderXmlCompareAutoMapPopupHtml({
  source: { records: [sourceRecord] },
  target: { records: [targetRecord] },
  compareFields: ['MATERIAL_NAME'],
  matchMap: {
    request: {
      sourceUid: sourceRecord.uid,
      targetUid: targetRecord.uid,
      compareFields: ['MATERIAL_NAME'],
      textRules: { MATERIAL_NAME: { field: 'MATERIAL_NAME', mode: 'exact-normalized' } },
    },
  },
});

assert.match(html, /Validation Panel/);
assert.match(html, /Field compare/);
assert.match(html, /MATERIAL_NAME/);
assert.match(html, /exact-normalized/);
assert.match(html, /<td>OK<\/td>/);
assert.match(html, /download-validation-json/);
assert.match(html, /download-validation-csv/);

console.log('XML Compare automap popup tests passed');
