import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const POLICY = Object.freeze({ maxLines: 300 });
const SCOPES = Object.freeze([
  'tabs/ps-family-clash-audit',
  'tests',
]);

function jsFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return jsFiles(path);
    if (!entry.name.endsWith('.js')) return [];
    if (root === 'tests' && !entry.name.startsWith('ps-family')) return [];
    return [path.replaceAll('\\', '/')];
  });
}

const files = SCOPES.flatMap(jsFiles);
assert.ok(files.length > 0);

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  assert.ok(lines.length <= POLICY.maxLines, `${file} has ${lines.length} lines`);
  assert.ok(!/export\s+default\b/.test(text), `${file} uses default export`);
}

console.log(`ps-family-implementation-compliance tests passed for ${files.length} files`);
