import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const modules = [
  'tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-read-model.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-scene-adapter.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-scope-adapter.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-read-only-host.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-production-shadow.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-read-only-index.js',
];

for (const relative of modules) {
  const source = readFileSync(fileURLToPath(new URL(`../${relative}`, import.meta.url)), 'utf8');
  assert(source.split(/\r?\n/).length <= 300, `${relative} must remain under 300 lines`);
  assert.doesNotMatch(source, /export\s+default/);
}

const host = readFileSync(fileURLToPath(new URL(
  '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-read-only-host.js',
  import.meta.url,
)), 'utf8');
assert.match(host, /SEQUENTIAL_READ_ONLY_COMMAND_DENIED/);
assert.match(host, /appendEditCommand\(\)/);
assert.doesNotMatch(host, /beginDrag|commitDrag|publishCandidate|localStorage|sessionStorage/);

const shadow = readFileSync(fileURLToPath(new URL(
  '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-production-shadow.js',
  import.meta.url,
)), 'utf8');
assert.match(shadow, /try \{ observe\(event\); \} catch \{\}/);
assert.doesNotMatch(shadow, /beginDrag|commitDrag|publishCandidate/);

console.log('Sequential SSK-TS-1B static containment: ok');
