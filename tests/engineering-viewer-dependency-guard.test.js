import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../core/engineering-viewer');
const files = readdirSync(root).filter((name) => name.endsWith('.js')).sort();

for (const name of files) {
  const source = readFileSync(join(root, name), 'utf8');
  const lines = source.split(/\r?\n/).length;
  assert.ok(lines <= 300, `${relative(root, name)} exceeds 300 lines (${lines})`);
  assert.doesNotMatch(source, /from\s+['"]\.\.\//, `${name} imports outside its shared core`);
  assert.doesNotMatch(source, /from\s+['"][^'"]*tabs\//, `${name} imports from tabs/`);
  assert.doesNotMatch(source, /export\s+default\b/, `${name} uses a default export`);
  assert.doesNotMatch(source, /\b(Canvas|WebGL|THREE|ReactDOM|React)\b/, `${name} names a renderer runtime`);
  assert.doesNotMatch(source, /\bdocument\./, `${name} accesses the DOM`);
  assert.doesNotMatch(source, /commandGateway|undoStack|redoStack/, `${name} owns command history`);
}

assert.equal(files.length, 3, 'all engineering viewer core files must be guarded');
console.log('engineering viewer dependency guard: ok');
