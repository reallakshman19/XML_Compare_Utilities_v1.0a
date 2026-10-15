import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'core/engineering-scene/engineering-adapter-contracts.js',
  'core/engineering-svg/engineering-svg-adapter.js',
  'core/engineering-svg/engineering-svg-adapter-bridge.js',
  'core/engineering-svg/engineering-svg-adapter-conformance.js',
  'core/engineering-svg/adapter-runtime.js',
];

for (const name of files) {
  const source = readFileSync(join(root, name), 'utf8');
  const lines = source.split(/\r?\n/).length;
  assert.ok(lines <= 300, `${name} exceeds 300 lines (${lines})`);
  assert.doesNotMatch(source, /from\s+['"][^'"]*tabs\//, `${name} imports from tabs/`);
  assert.doesNotMatch(source, /export\s+default\b/, `${name} uses a default export`);
  assert.doesNotMatch(source, /\b(Pipeline|Topology|Sequential|Categorizer|XML Builder|station|marker|support-restraint|support-carrier)\b/i, `${name} leaks adopter semantics`);
  assert.doesNotMatch(source, /\b(Canvas|WebGL|ReactDOM|React|THREE|localStorage|sessionStorage)\b/, `${name} leaks a forbidden runtime or storage owner`);
  assert.doesNotMatch(source, /globalThis|window\.|document\.|new\s+CommandHistory|undoStack|redoStack/, `${name} owns global state, DOM or history`);
  assert.doesNotMatch(source, /submitPropertyEdit|saveConfigValues/, `${name} introduces a second property mutation path`);
}

const adapterSource = readFileSync(join(root, 'core/engineering-svg/engineering-svg-adapter.js'), 'utf8');
assert.match(adapterSource, /Read-only engineering SVG adapters cannot expose a command gateway/);
assert.match(adapterSource, /Editable engineering SVG adapters require EngineeringSvgCommandGateway\.v1/);

console.log('engineering SVG adapter dependency guards: ok');
