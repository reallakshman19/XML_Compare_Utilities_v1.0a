import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const production = [
  'tabs/sequential-sketcher/scoped-edit/sequential-node-stretch-target.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-node-stretch-geometry.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-node-stretch-draft.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-node-stretch-panel.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-node-stretch-feature.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-node-stretch-application.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-node-stretch-application-panel.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-node-stretch-projection.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-component-edit-operations.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-journal.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-projection.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-boundary.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-visual-model.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-3d-controller.js',
];
function source(path) { return readFileSync(`${root}/${path}`, 'utf8'); }
function namedFunctionLengths(text) {
  const lines = text.split('\n'); const lengths = [];
  lines.forEach((line, index) => {
    const match = line.trim().match(/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/);
    if (!match) return;
    let depth = 0; let started = false;
    for (let row = index; row < lines.length; row += 1) {
      for (const char of lines[row]) {
        if (char === '{') { depth += 1; started = true; }
        if (char === '}') depth -= 1;
      }
      if (started && depth === 0) { lengths.push([match[1], row - index + 1]); break; }
    }
  });
  return lengths;
}
for (const path of production) {
  const text = source(path); const lines = text.split('\n');
  assert(lines.length - 1 < 300, `${path} must remain below 300 lines`);
  assert(!/\bmodule\.exports\b|\brequire\s*\(/.test(text), `${path} must remain named ESM`);
  for (const [name, length] of namedFunctionLengths(text)) {
    assert(length <= 40, `${path}:${name} must remain at or below 40 lines`);
  }
  assert(!/localStorage|sessionStorage|indexedDB|fetch\s*\(|XMLHttpRequest/.test(text),
    `${path} must not add persistence or network authority`);
  if (path.includes('node-stretch') || path.includes('component-edit-operations')) {
    assert(!/canvas|getContext\s*\(|requestAnimationFrame/.test(text),
      `${path} must not add canvas or viewer-runtime authority`);
  }
}
const controller = source('tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-3d-controller.js');
assert.match(controller, /createSequentialComponentEditOperations/);
assert.match(controller, /nodeStretchDraft: state\.componentEdit\?\.getStretchDraft\(\)/);
assert.doesNotMatch(controller, /createSequentialNodeStretchFeature/,
  'controller must depend on bounded operation orchestration');
const operations = source('tabs/sequential-sketcher/scoped-edit/sequential-component-edit-operations.js');
assert.match(operations, /MOVE_COMPONENT/); assert.match(operations, /STRETCH_NODE/);
assert.match(operations, /mode: SEQUENTIAL_COMPONENT_EDIT_MODE\.MOVE_COMPONENT/);
assert.match(operations, /state\.mode === SEQUENTIAL_COMPONENT_EDIT_MODE\.STRETCH_NODE/);
const journal = source('tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-journal.js');
assert.match(journal, /STRETCH_NODE/); assert.match(journal, /MOVE_COMPONENT/);
const projection = source('tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-projection.js');
assert.match(projection, /projectSequentialStretchConnections/);
assert.match(projection, /committedConnections: snapshot\.committedConnections/);
const boundary = source('tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-boundary.js');
assert.match(boundary, /SEQUENTIAL_PREPARED_GEOMETRY_EDIT_CANDIDATE_SCHEMA/);
assert.match(boundary, /SequentialNodeStretchPublication\.v1/);
const index = source('tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-index.js');
for (const name of ['sequential-node-stretch-target', 'sequential-node-stretch-geometry',
  'sequential-node-stretch-draft', 'sequential-node-stretch-feature',
  'sequential-node-stretch-application', 'sequential-component-edit-operations']) {
  assert.match(index, new RegExp(name));
}
console.log('Sequential node stretch static containment: ok');
