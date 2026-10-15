import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const production = [
  'pipeline-3d-model-cad-markup-interaction-contracts.js',
  'pipeline-3d-model-cad-markup-anchor-acquisition.js',
  'pipeline-3d-model-cad-markup-interaction-session.js',
  'pipeline-3d-model-cad-markup-interaction-view.js',
  'pipeline-3d-model-cad-markup-interaction-runtime.js',
  'pipeline-3d-model-cad-markup-interaction-renderer.js',
].map((name) => `tabs/pipeline-3d-model/${name}`);
const read = (name) => readFileSync(path.join(root, name), 'utf8');
for (const file of production) {
  const source = read(file);
  assert(source.split('\n').length < 300, `${file} must remain below 300 lines`);
  assert.doesNotMatch(source, /export\s+default/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.body|globalThis\.addEventListener/,
    `${file} must not use browser persistence or a global event bus`);
  assert.doesNotMatch(source, /InputXML|inputXml|bend|rawSynchronization|engineeringHistory/);
}
const acquisition = read(production[1]);
assert.match(acquisition, /buildPipelineCadSnapPrimitives/);
assert.match(acquisition, /acquirePipelineCadObjectSnap/);
assert.match(acquisition, /candidate\.sourceIds/);
assert.doesNotMatch(acquisition, /nearest.*entity|displayText|textContent|arrayIndex|sourceOrder|svg/i);
const runtime = read(production[4]);
assert.match(runtime, /markup\.createDimension/);
assert.match(runtime, /markup\.createAnnotation/);
assert.match(runtime, /markup\.updateDimension/);
assert.match(runtime, /markup\.updateAnnotation/);
assert.match(runtime, /markup\.deleteDimension/);
assert.match(runtime, /markup\.deleteAnnotation/);
assert.match(runtime, /markup\.undo/);
assert.match(runtime, /markup\.redo/);
assert.doesNotMatch(runtime, /controller\.|model\.|hitTest\s*=|setWorldBounds|setMarkupProjection/);
const workspace = read('tabs/pipeline-3d-model/pipeline-3d-model-cad-workspace.js');
assert.match(workspace, /mountPipelineCadMarkupInteractionRuntime/);
assert.match(workspace, /handleSourceReplacement/);
const persistentRenderer = read('tabs/pipeline-3d-model/pipeline-3d-model-cad-markup-renderer.js');
assert.match(persistentRenderer, /drawPipelineCadMarkupInteractionOverlay/);
const table2 = read('tabs/pipeline-3d-model/pipeline-3d-model-table2x-canvas.js');
const table3 = read('tabs/pipeline-3d-model/pipeline-3d-model-table3x-canvas.js');
assert.doesNotMatch(table2, /MarkupInteraction|hitTestPipelineCadMarkupProjection/);
assert.doesNotMatch(table3, /MarkupInteraction|hitTestPipelineCadMarkupProjection/);
console.log('Pipeline CAD markup interaction static guards: ok');
