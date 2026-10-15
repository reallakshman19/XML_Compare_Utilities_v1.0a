import assert from 'node:assert/strict';

import { inputXmlToCategorizedInputXml } from '../xml-compare/CategorizedInputXmlConverter.js';
import {
  applyCategorizedInputXmlChangeSet,
  deriveCategorizedInputXmlChangeSet,
} from '../xml-compare/inputxml-changeset-api/index.js';

const inputXml = `<?xml version="1.0" encoding="UTF-8"?>
<CAESARII XML_TYPE="Input"><PIPINGMODEL>
<PIPINGELEMENT FROM_NODE="10" TO_NODE="20" LINE_ID="L-100" DELTA_X="100" DELTA_Y="0" DELTA_Z="0" DIAMETER="219.1" WALL_THICK="8.18" INSUL_THICK="25" />
</PIPINGMODEL></CAESARII>`;

let categorized = inputXmlToCategorizedInputXml(inputXml, { sourceName: 'line-id.input.xml' });
categorized = categorized
  .replace('<Line id="L-100">', '<Line id="L-200">')
  .replace('<LINE_ID>L-100</LINE_ID>', '<LINE_ID>L-200</LINE_ID>');

const source = { filename: 'line-id_categorized_enriched.xml', content: categorized };
const derived = deriveCategorizedInputXmlChangeSet({ source });
assert.equal(derived.success, true);
assert.equal(derived.changeSet.applyReady, true);
assert.equal(derived.changeSet.conflicts.length, 0);
assert.equal(derived.changeSet.changes.length, 1);
const lineChange = derived.changeSet.changes[0];
assert.equal(lineChange.field, 'LINE_ID');
assert.equal(lineChange.operation, 'replace');
assert.equal(lineChange.beforeValue, 'L-100');
assert.equal(lineChange.afterValue, 'L-200');
assert.equal(lineChange.risk, 'line-identity');

const result = applyCategorizedInputXmlChangeSet({
  source,
  changeSet: derived.changeSet,
  approvedChangeIds: [lineChange.changeId],
});
assert.equal(result.success, true);
assert.equal(result.receipt.applied, 1);
assert.equal(result.outputValidation.success, true);
const inputArtifact = result.artifacts.find((item) => item.id === 'reconciled-inputxml');
const categorizedArtifact = result.artifacts.find((item) => item.id === 'reconciled-categorized-xml');
assert.ok(inputArtifact?.text.includes('LINE_ID="L-200"'));
assert.ok(categorizedArtifact?.text.includes('<Line id="L-200">'));
assert.ok(categorizedArtifact?.text.includes('LINE_ID="L-200"'));

console.log('InputXmlChangeSet.v1 LINE_ID reconciliation test passed');
