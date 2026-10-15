import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { composePipelineCadSnapPoint } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-object-snap-engine.js';
import {
  DEFAULT_PIPELINE_CAD_SNAP_SETTINGS,
  loadPipelineCadSnapSettings,
  normalizePipelineCadSnapSettings,
  snapTable3CommittedDepth,
  snapTable3Depth,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-snap.js';
import { PipelineCadShortcut, resolvePipelineCadShortcut } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-shortcuts.js';

const storage = {
  value: JSON.stringify({ table2x: { gridEnabled: true, elevationStep: 0.1 } }),
  getItem() { return this.value; },
  setItem(key, value) { this.value = value; },
};
const migrated = loadPipelineCadSnapSettings('table2x', storage);
assert.equal(migrated.gridEnabled, true);
assert.equal(migrated.objectEnabled, false, 'legacy scalar settings must preserve scalar-only behavior');
assert.equal(migrated.objectAperture, DEFAULT_PIPELINE_CAD_SNAP_SETTINGS.objectAperture);
assert.equal(resolvePipelineCadShortcut({ key: 'F3', code: 'F3' }, 'table2x'), PipelineCadShortcut.TOGGLE_OBJECT_SNAP);
assert.equal(resolvePipelineCadShortcut({ key: 'F3', code: 'F3', target: { tagName: 'INPUT' } }, 'table2x'), null);

const acquisition = Object.freeze({
  acquiredWorldPoint: Object.freeze({ x: 10, y: -0.04 }),
  lockedAxes: Object.freeze({ x: true, y: false }),
});
const preview = composePipelineCadSnapPoint({ x: 9.7, y: -0.04 }, acquisition, { x: Math.round, y: (value) => snapTable3Depth(value, normalizePipelineCadSnapSettings()) });
const commit = composePipelineCadSnapPoint({ x: 9.7, y: -0.04 }, acquisition, { x: Math.round, y: (value) => snapTable3Depth(value, normalizePipelineCadSnapSettings()) });
assert.deepEqual(preview, commit, 'preview and commit composition must be identical');
assert.equal(preview.x, 10, 'object-locked X must bypass scalar rounding');
assert.equal(preview.y, 0.75, 'unlocked Y must preserve Above-Ground Z behavior');
assert.equal(snapTable3CommittedDepth(-0.375, {}), -0.4, 'Table 3 preview must use raw-table depth precision');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tabs = path.join(ROOT, 'tabs/pipeline-3d-model');
const names = [
  'pipeline-3d-model-cad-object-snap-contracts.js',
  'pipeline-3d-model-cad-object-snap-primitives.js',
  'pipeline-3d-model-cad-object-snap-engine.js',
  'pipeline-3d-model-cad-object-snap-adapters.js',
  'pipeline-3d-model-cad-object-snap-runtime.js',
  'pipeline-3d-model-cad-object-snap-view.js',
];
function spans(source) {
  const lines = source.split(/\r?\n/); const values = [];
  lines.forEach((line, start) => {
    if (!/\bfunction\s+\w+\s*\(|\b(?:destroy|setMode)\s*\([^)]*\)\s*\{/.test(line)) return;
    let depth = 0; let opened = false;
    for (let index = start; index < lines.length; index += 1) {
      for (const character of lines[index]) {
        if (character === '{') { depth += 1; opened = true; }
        if (character === '}') depth -= 1;
      }
      if (opened && depth <= 0) { values.push(index - start + 1); break; }
    }
  });
  return values;
}
for (const name of names) {
  const source = fs.readFileSync(path.join(tabs, name), 'utf8');
  assert.ok(source.split(/\r?\n/).length < 300, `${name} must remain below 300 lines`);
  assert.ok(spans(source).every((span) => span <= 40), `${name} function must remain at or below 40 lines`);
  assert.doesNotMatch(source, /export\s+default\b/);
  assert.doesNotMatch(source, /MutationObserver|observe\s*\(\s*(?:document|doc)\.body/);
  assert.doesNotMatch(source, /pipeline-3d-model-cad-(?:model|controller|commands|canvas-contracts|canvas-runtime)\.js/);
}
const runtime = fs.readFileSync(path.join(tabs, 'pipeline-3d-model-cad-object-snap-runtime.js'), 'utf8');
const authoring = fs.readFileSync(path.join(tabs, 'pipeline-3d-model-cad-authoring.js'), 'utf8');
const workspace = fs.readFileSync(path.join(tabs, 'pipeline-3d-model-cad-workspace.js'), 'utf8');
assert.match(runtime, /cancelAnimationFrame/);
assert.match(runtime, /excludeIds/);
assert.match(authoring, /composePipelineCadPointerWorld/);
assert.doesNotMatch(runtime, /\.prototype\./);
assert.match(workspace, /mountPipelineCadObjectSnap/);

const browserSpec = fs.readFileSync(path.join(ROOT, 'tests/browser/pipeline-cad-object-snap.spec.mjs'), 'utf8');
const browserFixture = fs.readFileSync(path.join(ROOT, 'tests/browser/pipeline-cad-object-snap-fixture.html'), 'utf8');
for (let index = 1; index <= 16; index += 1) {
  assert.match(browserSpec, new RegExp(`PCAD-OS-B${String(index).padStart(2, '0')}`));
}
assert.match(browserFixture, /__pcadObjectSnap/);
assert.match(browserFixture, /mountPipelineCadWorkspace/);
assert.match(browserSpec, /screenDistance/);
assert.match(browserSpec, /controller\.undo/);

console.log('Pipeline CAD Object Snap integration and source-guard tests passed');
