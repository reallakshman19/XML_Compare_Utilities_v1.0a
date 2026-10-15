import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const scoped = 'tabs/sequential-sketcher/scoped-edit/';
const production = [
  'sequential-pipe-split-target.js', 'sequential-pipe-split-geometry.js',
  'sequential-pipe-split-identities.js', 'sequential-pipe-split-draft.js',
  'sequential-pipe-split-panel.js', 'sequential-pipe-split-feature.js',
  'sequential-pipe-split-application.js', 'sequential-pipe-split-application-panel.js',
  'sequential-topology-edit-journal.js', 'sequential-topology-edit-projection.js',
  'sequential-effective-topology-read-model.js', 'sequential-topology-edit-boundary.js',
  'sequential-topology-edit-history-panel.js', 'sequential-component-edit-operations.js',
  'sequential-scoped-edit-visual-model.js', 'sequential-scoped-edit-3d-controller.js',
  'sequential-scoped-edit-index.js', 'sequential-scoped-edit-read-model.js',
  'sequential-editable-topology-snapshot.js', 'sequential-scoped-edit-scene-adapter.js',
].map((name) => resolve(root, scoped, name));
const tab = resolve(root, 'tabs/sequential-sketcher/sequential-sketcher-tab.js');
const text = (path) => readFileSync(path, 'utf8');

function namedFunctionLengths(source) {
  const lines = source.split(/\r?\n/); const result = [];
  lines.forEach((line, index) => {
    const match = line.match(/^\s*(?:export\s+)?(?:async\s+)?function\s+([\w$]+)\s*\(/);
    if (!match) return;
    let depth = 0; let started = false; let end = index;
    for (let cursor = index; cursor < lines.length; cursor += 1) {
      for (const char of lines[cursor]) {
        if (char === '{') { depth += 1; started = true; }
        if (char === '}') depth -= 1;
      }
      if (started && depth === 0) { end = cursor; break; }
    }
    result.push({ name: match[1], length: end - index + 1 });
  });
  return result;
}
for (const path of [...production, tab]) {
  const source = text(path); const lines = source.split(/\r?\n/).length;
  assert(lines <= 300, `${basename(path)} exceeds 300 lines: ${lines}`);
  assert(!/export\s+default\b|module\.exports|\brequire\s*\(/.test(source),
    `${basename(path)} must remain named ESM only`);
  for (const fn of namedFunctionLengths(source)) {
    assert(fn.length <= 40, `${basename(path)} ${fn.name} exceeds 40 lines: ${fn.length}`);
  }
}
const restricted = production.filter((path) => !path.endsWith('sequential-scoped-edit-3d-controller.js'))
  .map(text).join('\n');
assert(!/localStorage|sessionStorage|indexedDB|fetch\s*\(|XMLHttpRequest|WebSocket/.test(restricted));
assert(!/automatic reconnection|autoReconnect|topologyRepair|insertFitting/.test(restricted));
assert(!/workbench-viewer|canvas|getContext\s*\(/.test(restricted));

const operations = text(resolve(root, scoped, 'sequential-component-edit-operations.js'));
assert.match(operations, /SPLIT_PIPE/);
assert.match(operations, /createSequentialPipeSplitFeature/);
assert.match(operations, /topologyEditBoundary\.readJournal/);
assert.match(operations, /Undo all active pipe splits/);
const controller = text(resolve(root, scoped, 'sequential-scoped-edit-3d-controller.js'));
assert.match(controller, /topologyEditBoundary\.readView/);
assert.match(controller, /createSequentialTopologyEditHistoryPanel/);
assert.match(controller, /splitDraft: state\.componentEdit\?\.getSplitDraft/);
assert.match(controller, /\['readCurrentState','readView','readJournal','publishCandidate','undo','redo'\]/);
const visual = text(resolve(root, scoped, 'sequential-scoped-edit-visual-model.js'));
assert.match(visual, /composeSequentialPipeSplitDraftScene/);
assert.match(visual, /input\.splitDraft/);
const tabSource = text(tab);
assert.match(tabSource, /createSequentialTopologyEditBoundary/);
assert.match(tabSource, /readBaseView: runtime\.geometryEditBoundary\.readView/);
assert.match(tabSource, /topologyEditBoundary: runtime\.topologyEditBoundary/);
assert(tabSource.indexOf('runtime.topologyEditBoundary?.destroy()')
  < tabSource.indexOf('runtime.geometryEditBoundary?.destroy()'));
const journal = text(resolve(root, scoped, 'sequential-topology-edit-journal.js'));
assert.match(journal, /cursor/); assert.match(journal, /slice\(0, journal\.cursor\)/);
assert.match(journal, /OPERATION_REPLAY/); assert.match(journal, /SPLIT_PIPE/);
const projection = text(resolve(root, scoped, 'sequential-topology-edit-projection.js'));
assert.match(projection, /topologySupersededComponents/);
assert.match(projection, /IDENTITY_COLLISION/);
const readModel = text(resolve(root, scoped, 'sequential-scoped-edit-read-model.js'));
assert(readModel.lastIndexOf('isSequentialEffectiveTopologyReadModel')
  < readModel.lastIndexOf('isSequentialEffectiveGeometryReadModel'));
const index = text(resolve(root, scoped, 'sequential-scoped-edit-index.js'));
for (const name of ['sequential-pipe-split-target.js', 'sequential-topology-edit-journal.js',
  'sequential-effective-topology-read-model.js', 'sequential-topology-edit-boundary.js']) {
  assert(index.includes(`export * from './${name}';`), `index missing ${name}`);
}
console.log('Sequential pipe split static containment: ok');
