import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'core/engineering-scene/engineering-precision-contracts.js',
  'core/engineering-svg/engineering-svg-precision-parser.js',
  'core/engineering-svg/engineering-svg-precision-geometry.js',
  'core/engineering-svg/engineering-svg-constraint-solver.js',
  'core/engineering-svg/precision-runtime.js',
];

for (const name of files) {
  const source = readFileSync(join(repositoryRoot, name), 'utf8');
  const lines = source.split(/\r?\n/).length;
  assert.ok(lines <= 300, `${name} exceeds 300 lines (${lines})`);
  assert.doesNotMatch(source, /from\s+['"][^'"]*tabs\//, `${name} imports from tabs/`);
  assert.doesNotMatch(source, /export\s+default\b/, `${name} uses a default export`);
  assert.doesNotMatch(source, /\b(Pipeline|Topology|Sequential|Categorizer|XML Builder)\b/, `${name} leaks adopter semantics`);
  assert.doesNotMatch(source, /\b(Canvas|WebGL|ReactDOM|React|THREE|localStorage|sessionStorage)\b/, `${name} leaks a forbidden runtime or storage owner`);
  assert.doesNotMatch(source, /toFixed|Math\.(round|floor|ceil|trunc)|parseInt/, `${name} rounds or quantizes precision values`);
  assert.doesNotMatch(source, /object.?snap/i, `${name} introduces object snap before its Work Pack`);
  assert.doesNotMatch(source, /document\.|window\.|innerHTML/, `${name} introduces DOM or global UI ownership`);
}

console.log('engineering SVG precision dependency guards: ok');
