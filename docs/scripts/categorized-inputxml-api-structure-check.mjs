import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = [
  'xml-compare/categorized-inputxml-api/categorized-inputxml-api-contracts.js',
  'xml-compare/categorized-inputxml-api/categorized-inputxml-api-model.js',
  'xml-compare/categorized-inputxml-api/categorized-inputxml-api-diagnostics.js',
  'xml-compare/categorized-inputxml-api/categorized-inputxml-api-source-export.js',
  'xml-compare/categorized-inputxml-api/categorized-inputxml-api-service.js',
  'xml-compare/categorized-inputxml-api/index.js',
];
const forbiddenRuntime = [
  { label: 'DOM document API', pattern: /\bdocument\.(?:body|querySelector|querySelectorAll|getElementById|createElement|addEventListener)/ },
  { label: 'window global', pattern: /\bwindow\./ },
  { label: 'localStorage', pattern: /\blocalStorage\b/ },
  { label: 'sessionStorage', pattern: /\bsessionStorage\b/ },
  { label: 'Worker construction', pattern: /\bnew\s+Worker\b/ },
  { label: 'event listener', pattern: /\baddEventListener\s*\(/ },
  { label: 'network fetch', pattern: /\bfetch\s*\(/ },
  { label: 'XMLHttpRequest', pattern: /\bXMLHttpRequest\b/ },
];

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function functionLengths(text = '') {
  const lines = text.split('\n'), rows = [];
  for (let start = 0; start < lines.length; start += 1) {
    const match = lines[start].match(/^(?:export\s+)?function\s+([A-Za-z_$][\w$]*)\b/);
    if (!match) continue;
    const end = lines.findIndex((line, index) => index >= start && index > start && line === '}');
    assert.ok(end > start, `Unable to resolve function ${match[1]}`);
    rows.push({ name: match[1], lines: end - start + 1 });
    start = end;
  }
  return rows;
}

for (const path of files) {
  const text = source(path), lines = text.split('\n').length;
  assert.ok(lines <= 300, `${path} exceeds 300 lines (${lines})`);
  assert.equal(/export\s+default\b/.test(text), false, `${path} uses a default export`);
  assert.equal(/from\s+['"]\.\.\/\.\.\/tabs\//.test(text), false, `${path} imports a UI tab module`);
  for (const rule of forbiddenRuntime) assert.equal(rule.pattern.test(text), false, `${path} contains forbidden runtime: ${rule.label}`);
  for (const fn of functionLengths(text)) assert.ok(fn.lines <= 40, `${path}:${fn.name} exceeds 40 lines (${fn.lines})`);
}

const indexSource = source('xml-compare/categorized-inputxml-api/index.js');
for (const publicName of [
  'createCategorizedInputXmlService',
  'validateCategorizedInputXml',
  'inspectCategorizedInputXml',
  'serializeCategorizedInputXml',
  'exportCategorizedSourceInputXml',
]) assert.ok(indexSource.includes(publicName), `Public API export missing: ${publicName}`);

console.log('CategorizedInputXML API structure checks passed');
