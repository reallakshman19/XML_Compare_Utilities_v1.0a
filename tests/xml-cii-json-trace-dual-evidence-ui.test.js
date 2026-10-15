import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panel = readFileSync('tabs/model-converters/json-trace/json-trace-panel.js', 'utf8');
const model = readFileSync('converters/xml-cii2019-core/xml-node-wise-trace.js', 'utf8');

assert.match(panel, /buildXmlNodeWiseTraceRows/);
assert.match(panel, /JsonNodeNo\(DTXR_PS\)/);
assert.match(panel, /JsonNodeNo\(DTXR_POS\)/);
assert.match(panel, /POS Basis/);
assert.match(panel, /DTXR_PS\/NAME/);
assert.match(panel, /data-json-trace-export-tree-csv/);
assert.match(panel, /data-json-trace-export-xml-csv/);
assert.match(panel, /data-json-trace-copy-matched/);
assert.match(panel, /Matched Facts/);
assert.match(panel, /Evidence Tree CSV/);
assert.match(panel, /XML Node Wise Trace CSV/);
assert.match(model, /DTXR_POS_PRIMARY/);
assert.match(model, /DTXR_PS_FALLBACK/);
assert.match(model, /restraintSifBasis/);

console.log('xml-cii JSON Trace dual evidence UI tests passed');
