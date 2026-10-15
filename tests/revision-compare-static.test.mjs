import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('../tabs/revision-compare/', import.meta.url));
const files = readdirSync(directory).filter((name) => name.endsWith('.js')).sort();
const forbidden = [
  'workbench3d/compare/', 'topology-trace-validator/', 'vendor/3d-converters/',
  'runCompare', 'buildTransferPlan', 'applyTransferPlan', 'ConnectorModel', 'registrationTranslation',
  'Download updated target XML', 'Build transfer plan', 'Batch approve', 'PipeStressExport',
];
const rendererImport = 'workbench3d/viewer/workbench-viewer.js';
for (const name of files) {
  const source = readFileSync(path.join(directory, name), 'utf8');
  assert(source.split(/\r?\n/).length <= 300, `${name} exceeds 300 lines`);
  assert.doesNotMatch(source, /export\s+default/, `${name} uses a default export`);
  assert.doesNotMatch(source, /Date\.now\(|Math\.random\(/, `${name} uses nondeterministic identity input`);
  assert.doesNotMatch(source, /MutationObserver\s*\(|document\.body\.addEventListener/, `${name} uses broad DOM observation`);
  if (source.includes(rendererImport)) assert.equal(name, 'revision-compare-viewer-adapter.js');
  for (const token of forbidden) assert(!source.includes(token), `${name} contains forbidden authority: ${token}`);
  await import(new URL(`../tabs/revision-compare/${name}`, import.meta.url));
}
const actionSource = readFileSync(path.join(directory, 'revision-compare-actions.js'), 'utf8');
assert.doesNotMatch(actionSource, /approve-row|downloadUpdated|connector|transfer/i);
const viewSource = readFileSync(path.join(directory, 'revision-compare-view.js'), 'utf8');
assert.doesNotMatch(viewSource, /Connectors|updated target XML|Build transfer plan|Batch approve/i);
console.log('revision-compare-static.test.mjs passed');
