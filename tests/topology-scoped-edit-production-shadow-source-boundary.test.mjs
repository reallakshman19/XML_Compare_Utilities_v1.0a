import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const productionFiles = [
  'topology-scoped-edit-production-snapshot.js',
  'topology-scoped-edit-production-shadow.js',
  'topology-scoped-edit-production-shadow-index.js',
];
const forbidden = [
  'topology-draft-recovery', 'topology-scoped-edit-acceptance', 'topology-edit-journal-service',
  './topology-edit-controller.js', 'topology-edit-drag-solver', 'topology-edit-3d-gestures',
  'topology-edit-canvas-renderer', 'topology-svg-editor-overlay', 'localStorage', 'navigator.locks',
];
for (const name of productionFiles) {
  const source = readFileSync(new URL(`../tabs/topology-trace-validator/${name}`, import.meta.url), 'utf8');
  assert(source.split(/\r?\n/).length <= 300, `${name} exceeds 300 lines.`);
  assert(!/\bexport\s+default\b/.test(source), `${name} contains a default export.`);
  for (const fragment of forbidden) assert(!source.includes(fragment), `${name} references ${fragment}.`);
}
const extensions = readFileSync(new URL('../tabs/topology-trace-validator/topology-edit-extensions.js', import.meta.url), 'utf8');
assert(extensions.includes('productionShadow.observe()'));
assert(extensions.includes('productionShadow.destroy()'));
assert(extensions.includes('topology-shadow-diagnostic'));
assert(!extensions.includes('acceptPrepared('));
assert(!extensions.includes('acquireWriter('));
console.log('[PASS] P4B is a read-only fail-open production observer with no acceptance or writer path');
