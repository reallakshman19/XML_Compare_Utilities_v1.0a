import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../core/engineering-svg');

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  }).filter((path) => path.endsWith('.js'));
}

for (const path of sourceFiles(root)) {
  const source = readFileSync(path, 'utf8');
  const name = relative(root, path);
  const lines = source.split(/\r?\n/).length;
  assert.ok(lines <= 300, `${name} exceeds 300 lines (${lines})`);
  assert.doesNotMatch(source, /from\s+['"][^'"]*tabs\//, `${name} imports from tabs/`);
  assert.doesNotMatch(source, /export\s+default\b/, `${name} uses a default export`);
  assert.doesNotMatch(source, /\b(Canvas|WebGL|ReactDOM|React|THREE)\b/, `${name} leaks a forbidden runtime`);
  assert.doesNotMatch(source, /document\.(addEventListener|dispatchEvent)/, `${name} uses a global document event bus`);
}

console.log('engineering SVG dependency guards: ok');
