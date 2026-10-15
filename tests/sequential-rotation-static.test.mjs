import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const production = [
  'sequential-rotation-target.js', 'sequential-rotation-geometry.js',
  'sequential-rotation-draft.js', 'sequential-rotation-panel.js',
  'sequential-rotation-feature.js', 'sequential-rotation-application.js',
  'sequential-rotation-application-panel.js', 'sequential-rotation-projection.js',
  'sequential-component-edit-operations.js', 'sequential-geometry-edit-journal.js',
  'sequential-geometry-edit-projection.js', 'sequential-geometry-edit-boundary.js',
  'sequential-scoped-edit-visual-model.js', 'sequential-scoped-edit-3d-controller.js',
  'sequential-scoped-edit-index.js',
].map((name) => `tabs/sequential-sketcher/scoped-edit/${name}`);
function source(path) { return readFileSync(`${root}${path}`, 'utf8'); }
function functionLengths(text) {
  const rows = [];
  const pattern = /^\s*(?:export\s+)?(?:async\s+)?function\s+([\w$]+)\s*\(/gm;
  for (const match of text.matchAll(pattern)) {
    const brace = text.indexOf('{', match.index + match[0].length); let depth = 0;
    let end = brace;
    for (; end < text.length; end += 1) {
      if (text[end] === '{') depth += 1;
      else if (text[end] === '}' && --depth === 0) break;
    }
    rows.push([match[1], text.slice(0, match.index).split('\n').length,
      text.slice(match.index, end + 1).split('\n').length]);
  }
  return rows;
}
for (const path of production) {
  const text = source(path); const lines = text.split('\n').length;
  assert(lines <= 300, `${path} exceeds 300 lines: ${lines}`);
  assert(!/export\s+default|module\.exports|\brequire\s*\(/.test(text),
    `${path} must retain named ESM exports only`);
  for (const [name, line, length] of functionLengths(text)) {
    assert(length <= 40, `${path}:${line} ${name} exceeds 40 lines: ${length}`);
  }
}
const aggregate = production.map(source).join('\n');
assert(!/localStorage|sessionStorage|indexedDB|fetch\s*\(|XMLHttpRequest|WebSocket/.test(aggregate));
assert(!/auto.?reconnect|automatic.?reconnect|topology.?repair/i.test(aggregate));
const operations = source('tabs/sequential-sketcher/scoped-edit/sequential-component-edit-operations.js');
assert.match(operations, /ROTATE_SUBGRAPH/);
assert.match(operations, /createSequentialRotationFeature/);
assert.match(operations, /getRotationDraft/);
const controller = source('tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-3d-controller.js');
assert.match(controller, /rotationDraft: state\.componentEdit\?\.getRotationDraft\(\)/);
const visual = source('tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-visual-model.js');
assert.match(visual, /composeSequentialRotationDraftScene/);
const journal = source('tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-journal.js');
assert.match(journal, /ROTATE_SUBGRAPH/);
const boundary = source('tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-boundary.js');
assert.match(boundary, /SequentialSubgraphRotationPublication\.v1/);
const index = source('tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-index.js');
for (const name of ['target', 'geometry', 'draft', 'panel', 'feature', 'application',
  'application-panel', 'projection']) assert.match(index, new RegExp(`sequential-rotation-${name}\\.js`));
console.log('Sequential rotation static containment: ok');
