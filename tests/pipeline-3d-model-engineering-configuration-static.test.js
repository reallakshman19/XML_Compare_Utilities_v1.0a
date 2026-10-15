import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['pipeline-3d-model-engineering-configuration-contracts.js',
  'pipeline-3d-model-engineering-configuration-fields.js',
  'pipeline-3d-model-engineering-configuration-storage.js',
  'pipeline-3d-model-engineering-configuration.js'].map((name) => path.join(root, 'tabs/pipeline-3d-model', name));
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  assert.ok(source.trimEnd().split(/\r?\n/).length < 300, `${path.basename(file)} must remain below 300 lines`);
  assert.doesNotMatch(source, /export\s+default|\bDate\b|Math\.random|performance\.now|localeCompare/);
}
const combined = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
assert.doesNotMatch(combined, /207000|practicalRadiusMultiplierD:\s*500|normalRadiusD:\s*1\.5/);
console.log('pipeline-3d-model engineering configuration static: PASS');
