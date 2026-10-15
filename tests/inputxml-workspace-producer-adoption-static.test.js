import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tab = readFileSync(new URL('../tabs/inputxml-workspace/inputxml-workspace-tab.js', import.meta.url), 'utf8');
const adoption = readFileSync(new URL('../tabs/inputxml-workspace/inputxml-workspace-producer-adoption.js', import.meta.url), 'utf8');
const workerRunStart = tab.indexOf('async function runWorkspaceProducerCategorization');
const workerRunEnd = tab.indexOf('function ensureModalStyle', workerRunStart);
const workerRun = tab.slice(workerRunStart, workerRunEnd);

assert.match(tab, /createCategorizedInputXmlWorkerClient/);
assert.match(tab, /inputxml-workspace-producer-adoption\.js/);
assert.match(tab, /categorizedProducerAdoption: createWorkspaceProducerAdoptionState\(\)/);
assert.match(tab, /categorizedInputSource: ''/);
assert.ok(workerRunStart >= 0 && workerRunEnd > workerRunStart, 'worker categorization function boundary is missing');
assert.match(workerRun, /ensureWorkspaceProducerClient\(dialog\)\.producer\.categorizeInputXml/);
assert.doesNotMatch(workerRun, /convertCategorizedInputXml/);
assert.match(tab, /sourceKind: '5c'/);
assert.match(tab, /sourceKind: 'enriched'/);
assert.match(tab, /download-categorized-receipt/);
assert.match(tab, /workspaceProducerReceiptJson/);
assert.match(tab, /closeWorkspaceProducerRuntime/);
assert.match(tab, /abortController\?\.abort/);
assert.match(tab, /runtime\.client\?\.close\?\.\(\)/);
assert.match(tab, /async function handleAction/);
assert.match(tab, /void handleAction/);
assert.match(tab, /state\.categorizedDirection === 'categorized-to-input' \|\| !isWorkspaceGeneratedInputXml/);

assert.match(adoption, /InputXmlProducerCategorizeRequest\.v1/);
assert.match(adoption, /InputXmlWorkspaceProducerReceipt\.v1/);
assert.match(adoption, /WORKSPACE_RECEIPT_SOURCE_MISMATCH/);
assert.match(adoption, /workspaceProducerOwnsSource/);
assert.match(adoption, /workspaceProducerCategorizedText/);

console.log('InputXML Workspace producer adoption static integration passed.');
