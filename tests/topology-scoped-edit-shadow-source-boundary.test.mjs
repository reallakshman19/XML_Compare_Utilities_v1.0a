import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const productionFiles = [
  'topology-scoped-edit-shadow-runtime.js',
  'topology-scoped-edit-shadow-comparison.js',
  'topology-scoped-edit-shadow-conformance.js',
  'topology-scoped-edit-shadow-index.js',
];
const forbiddenImports = [
  'topology-edit-controller', 'topology-edit-journal-service', 'topology-draft-recovery',
  'topology-scoped-edit-acceptance', 'topology-edit-autofix-service',
  'topology-edit-3d-gestures', 'topology-edit-drag-solver', 'topology-edit-3d-canvas',
  'topology-edit-canvas-renderer', 'topology-svg-editor-overlay',
];
const forbiddenRuntimeReferences = [
  /\blocalStorage\b/, /\bnavigator\s*\.\s*locks\b/, /\bdocument\s*\.\s*querySelector\b/,
  /\bnew\s+THREE\b/, /\bproductionAcceptance\s*\(/,
];
const importPattern = /(?:from\s*|import\s*(?:\(\s*)?)["']([^"']+)["']/g;
let inspected = 0;
for (const name of productionFiles) {
  const source = readFileSync(new URL(`../tabs/topology-trace-validator/${name}`, import.meta.url), 'utf8');
  const lines = source.split(/\r?\n/).length;
  assert(lines <= 300, `${name} exceeds the 300-line production gate: ${lines}`);
  assert(!/\bexport\s+default\b/.test(source), `${name} contains a default export.`);
  for (const match of source.matchAll(importPattern)) {
    assert(!forbiddenImports.some((fragment) => match[1].includes(fragment)),
      `${name} imports forbidden production authority ${match[1]}.`);
  }
  for (const pattern of forbiddenRuntimeReferences) {
    assert(!pattern.test(source), `${name} contains forbidden runtime reference ${pattern}.`);
  }
  inspected += 1;
}
assert.equal(inspected, 4);
console.log('[PASS] Topology shadow source boundary preserves read-only adapter containment');
