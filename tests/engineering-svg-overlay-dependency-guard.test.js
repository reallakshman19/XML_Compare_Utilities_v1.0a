import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../core/engineering-svg');
const files = [
  'engineering-svg-geometry-analysis.js',
  'engineering-svg-draft-overlay.js',
  'engineering-svg-inspector-model.js',
  'overlay-runtime.js',
];

for (const name of files) {
  const source = readFileSync(join(root, name), 'utf8');
  const lines = source.split(/\r?\n/).length;
  assert.ok(lines <= 300, `${name} exceeds 300 lines (${lines})`);
  assert.doesNotMatch(source, /from\s+['"][^'"]*tabs\//, `${name} imports from tabs/`);
  assert.doesNotMatch(source, /export\s+default\b/, `${name} uses a default export`);
  assert.doesNotMatch(source, /\b(Canvas|WebGL|ReactDOM|React|THREE|localStorage|sessionStorage)\b/, `${name} leaks a forbidden runtime or storage owner`);
  assert.doesNotMatch(source, /commandGateway|\.execute\s*\(/, `${name} executes commands`);
  assert.doesNotMatch(source, /document\.|window\.|innerHTML/, `${name} introduces DOM or global UI ownership`);
  assert.doesNotMatch(source, /submitPropertyEdit|saveConfigValues/, `${name} writes properties directly`);
}

console.log('engineering SVG overlay dependency guards: ok');
