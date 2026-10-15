import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const files = [
  'xml-compare/inputxml-producer-api/inputxml-producer-contracts.js',
  'xml-compare/inputxml-producer-api/inputxml-producer-service.js',
  'xml-compare/inputxml-producer-api/index.js',
  'xml-compare/categorized-inputxml-worker/worker-contracts.js',
  'xml-compare/categorized-inputxml-worker/worker-dispatcher.js',
  'xml-compare/categorized-inputxml-worker/worker-runtime.js',
  'xml-compare/categorized-inputxml-worker/worker-client.js',
  'xml-compare/categorized-inputxml-worker/categorized-inputxml.worker.js',
  'xml-compare/categorized-inputxml-worker/index.js',
];
const forbidden = [
  { label: 'DOM document', pattern: /\bdocument\./ },
  { label: 'window global', pattern: /\bwindow\./ },
  { label: 'localStorage', pattern: /\blocalStorage\b/ },
  { label: 'sessionStorage', pattern: /\bsessionStorage\b/ },
  { label: 'network fetch', pattern: /\bfetch\s*\(/ },
  { label: 'XMLHttpRequest', pattern: /\bXMLHttpRequest\b/ },
  { label: 'Pyodide', pattern: /\bpyodide\b/i },
  { label: 'CII conversion', pattern: /\bconvert\w*ToCii\b|\bcii2019\b/i },
];

function source(path) {
  return fs.readFileSync(new URL(path, root), 'utf8');
}

function closingLine(lines, start, indent) {
  const close = `${indent}}`;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index] === close) return index;
  }
  return -1;
}

function functionLengths(text = '') {
  const lines = text.split('\n'), rows = [];
  for (let start = 0; start < lines.length; start += 1) {
    const top = lines[start].match(/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\b/);
    const method = lines[start].match(/^  (?:async\s+)?(constructor|[A-Za-z_$][\w$]*)\([^)]*\)\s*\{/);
    const match = top || method;
    if (!match) continue;
    const indent = method ? '  ' : '';
    const end = closingLine(lines, start, indent);
    assert.ok(end > start, `Unable to resolve function ${match[1]}`);
    rows.push({ name: match[1], lines: end - start + 1 });
    start = end;
  }
  return rows;
}

for (const path of files) {
  const text = source(path), lineCount = text.split('\n').length;
  assert.ok(lineCount <= 300, `${path} exceeds 300 lines (${lineCount})`);
  assert.equal(/export\s+default\b/.test(text), false, `${path} uses a default export`);
  assert.equal(/from\s+['"][^'"]*(?:tabs|converters)\//.test(text), false, `${path} imports a UI or converter runtime`);
  for (const rule of forbidden) assert.equal(rule.pattern.test(text), false, `${path} contains forbidden runtime: ${rule.label}`);
  for (const item of functionLengths(text)) assert.ok(item.lines <= 40, `${path}:${item.name} exceeds 40 lines (${item.lines})`);
}

const workerIndex = source('xml-compare/categorized-inputxml-worker/index.js');
for (const name of [
  'createCategorizedInputXmlWorkerClient',
  'createCategorizedInputXmlBrowserWorker',
  'createCategorizedInputXmlWorkerDispatcher',
  'installCategorizedInputXmlWorkerRuntime',
  'createWorkerRequest',
  'createWorkerCancel',
]) assert.ok(workerIndex.includes(name), `Public worker export missing: ${name}`);

const producerIndex = source('xml-compare/inputxml-producer-api/index.js');
for (const name of [
  'createInputXmlProducerService',
  'categorizeProducerInputXml',
  'validateInputXmlProducerRequest',
]) assert.ok(producerIndex.includes(name), `Public producer export missing: ${name}`);

const client = source('xml-compare/categorized-inputxml-worker/worker-client.js');
assert.ok(client.includes("type: 'module'"), 'Browser worker must be created as a module worker.');
assert.ok(client.includes('AbortSignal') || client.includes('signal'), 'Client abort handling is missing.');
assert.ok(client.includes('timeoutMs'), 'Client timeout handling is missing.');
assert.ok(client.includes('producer.categorizeInputXml'), 'Producer categorization client route is missing.');

const producer = source('xml-compare/inputxml-producer-api/inputxml-producer-service.js');
assert.ok(producer.includes('inputXmlToCategorizedInputXml'), 'Producer adapter does not use the existing converter authority.');
assert.ok(producer.includes('validateCategorizedInputXml'), 'Producer adapter does not validate categorized output.');
assert.ok(producer.includes("role: 'categorized-review-document'"), 'Producer artifact role is missing.');

const entry = source('xml-compare/categorized-inputxml-worker/categorized-inputxml.worker.js');
assert.ok(entry.includes('installCategorizedInputXmlWorkerRuntime'), 'Worker entrypoint does not install the runtime.');
assert.ok(entry.includes('scope: globalThis'), 'Worker entrypoint does not bind the worker scope.');

console.log('CategorizedInputXML worker structure checks passed');
