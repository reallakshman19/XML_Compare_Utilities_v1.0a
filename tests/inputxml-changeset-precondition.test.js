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
const generated = inputXmlToCategorizedInputXml(inputXml, { sourceName: 'definition.input.xml' });
const categorized = generated.replace('<DELTA_X>100</DELTA_X>', '<DELTA_X>150</DELTA_X>');
const source = { filename: 'definition_categorized_enriched.xml', content: categorized };
const derived = deriveCategorizedInputXmlChangeSet({ source });
const originalChange = derived.changeSet.changes.find((item) => item.field === 'DELTA_X');
assert.ok(originalChange);

const altered = {
  ...derived.changeSet,
  changes: derived.changeSet.changes.map((item) => item.changeId === originalChange.changeId
    ? { ...item, afterValue: '175' }
    : item),
};
assert.equal(altered.changes[0].changeId, originalChange.changeId, 'test preserves the approved identifier');

const result = applyCategorizedInputXmlChangeSet({
  source,
  changeSet: altered,
  approvedChangeIds: [originalChange.changeId],
});
assert.equal(result.success, false);
assert.equal(result.reason, 'approval-precondition-failed');
assert.ok(result.receipt.rows.some((row) => row.reason === 'change-definition-mismatch'));
assert.equal(result.artifacts.length, 0);

console.log('InputXmlChangeSet.v1 definition precondition test passed');
