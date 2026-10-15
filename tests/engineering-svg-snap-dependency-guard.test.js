import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'core/engineering-scene/engineering-snap-contracts.js',
  'core/engineering-svg/engineering-svg-snap-provider.js',
  'core/engineering-svg/engineering-svg-snap-ranking.js',
  'core/engineering-svg/engineering-svg-snap-acquisition.js',
  'core/engineering-svg/snap-runtime.js',
];

for (const name of files) {
  const source = readFileSync(join(repositoryRoot, name), 'utf8');
  const lines = source.split(/\r?\n/).length;
  assert.ok(lines <= 300, `${name} exceeds 300 lines (${lines})`);
  assert.doesNotMatch(source, /from\s+['"][^'"]*tabs\//, `${name} imports from tabs/`);
  assert.doesNotMatch(source, /export\s+default\b/, `${name} uses a default export`);
  assert.doesNotMatch(source, /\b(Pipeline|Topology|Sequential|Categorizer|XML Builder|station|marker|active-port)\b/i, `${name} leaks adopter snap semantics`);
  assert.doesNotMatch(source, /\b(Canvas|WebGL|ReactDOM|React|THREE|localStorage|sessionStorage)\b/, `${name} leaks a forbidden runtime or storage owner`);
  assert.doesNotMatch(source, /toFixed|Math\.(round|floor|ceil|trunc)|parseInt/, `${name} rounds snap identity or geometry`);
  assert.doesNotMatch(source, /document\.|window\.|innerHTML/, `${name} introduces DOM or global UI ownership`);
  assert.doesNotMatch(source, /commandGateway|\.execute\s*\(|saveConfigValues|submitPropertyEdit/, `${name} mutates domain or property state`);
}

console.log('engineering SVG snap dependency guards: ok');
