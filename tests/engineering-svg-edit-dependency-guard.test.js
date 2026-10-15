import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../core/engineering-svg');
const editFiles = new Set([
  'engineering-svg-command-gateway.js',
  'engineering-svg-property-provider.js',
  'engineering-svg-property-runtime.js',
  'engineering-svg-draft-store.js',
  'engineering-svg-edit-coordinator.js',
  'edit-runtime.js',
]);

function files(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  }).filter((path) => path.endsWith('.js') && editFiles.has(relative(root, path)));
}

for (const path of files(root)) {
  const source = readFileSync(path, 'utf8');
  const name = relative(root, path);
  const lines = source.split(/\r?\n/).length;
  assert.ok(lines <= 300, `${name} exceeds 300 lines (${lines})`);
  assert.doesNotMatch(source, /from\s+['"][^'"]*tabs\//, `${name} imports from tabs/`);
  assert.doesNotMatch(source, /export\s+default\b/, `${name} uses a default export`);
  assert.doesNotMatch(source, /\b(Canvas|WebGL|ReactDOM|React|THREE|localStorage)\b/, `${name} leaks a forbidden runtime or storage owner`);
  assert.doesNotMatch(source, /submitPropertyEdit/, `${name} introduces a second property mutation bridge`);
  assert.doesNotMatch(source, /document\.(addEventListener|dispatchEvent)/, `${name} uses a global document event bus`);
}
assert.equal(files(root).length, editFiles.size, 'all ESVG edit-runtime files must be covered by the guard');

console.log('engineering SVG edit dependency guards: ok');
