import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const enrichment = readFileSync('tabs/model-converters/converters/xmltocii2019_helper/enrichment-core.js', 'utf8');
const panel = readFileSync('tabs/model-converters/json-trace/json-trace-panel.js', 'utf8');

assert.match(enrichment, /globalThis\.xmlCiiDtxrResolutionLedger/);
assert.match(enrichment, /getSnapshot:\s*\(\)\s*=>\s*dtxrResolutionLedgerAudit/);
assert.match(panel, /function ledgerDiagnosticsFromSnapshot/);
assert.match(panel, /function currentDtxrLedgerSnapshot/);
assert.match(panel, /getDtxrResolutionLedger/);
assert.match(panel, /globalThis\.xmlCiiDtxrResolutionLedger/);
assert.match(panel, /ledgerDiagnostics\.length/);
assert.match(panel, /buildXmlNodeWiseTraceRows/);

console.log('xml-cii DTXR runtime bridge tests passed');
