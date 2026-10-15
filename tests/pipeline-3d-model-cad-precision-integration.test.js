import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CommandHistory } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-commands.js';
import { PipelineProfileModel } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-model.js';
import { createPipelineCadPrecisionSessionController } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-precision-session.js';
import {
  PIPELINE_CANVAS_GEOMETRY_UPDATED_SCHEMA,
  PIPELINE_CANVAS_NODE_MOVED_SCHEMA,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-canvas-contracts.js';

const raw = {
  table2a: `H(coor)\tV(coor)\t[H vs V] Length\tStation Text\tElevation Text
659.791\t—\t—\t0+000.0\t231.32
668.540\t—\t—\t0+006.7\t230.95
680.803\t—\t—\t0+019.0\t230.82
732.683\t—\t—\t0+070.8\t233.00`,
  table3a: `From H(coor)\tTo H(coor)\tText Position X\tHLength Text
661.791\t682.337\t671.704\t20.5
682.337\t716.683\t700.435\t34.3
716.683\t732.683\t723.927\t16.0`,
  table3b: `From H(coor)\tTo H(coor)\tText Position X\tZ Text
—\t—\t665.621\tA/G
682.337\t732.683\t708.374\t1.5M`,
  table3c: `Text Position X\tMarker Text
688.135\tPM-001`,
};

class FakeGraph extends EventTarget {
  constructor(name) {
    super();
    this.name = name;
    this.markerRailY = 0.75;
    this.previews = new Map();
    this.grip = null;
  }
  setPrecisionPreview(id, point) { this.previews.set(id, Object.freeze({ ...point })); }
  clearPrecisionPreview() { this.previews.clear(); }
  setPrecisionGrip(id) { this.grip = id; }
  dispatchGraphEvent(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
}

const model = PipelineProfileModel.fromRaw(raw);
const history = new CommandHistory();
const captures = [];
let executes = 0;
const controller = {
  model,
  history,
  canvasManager: { captureCommit(detail) { captures.push(detail); } },
  execute(command) { history.execute(command); executes += 1; return true; },
};
const graphs = { table2x: new FakeGraph('table2x'), table3x: new FakeGraph('table3x') };
const sessions = createPipelineCadPrecisionSessionController({ controller, graphs });
const identity = { graph: 'table2x', entityId: 'table2a-0003', entityType: 'elevation-node' };
const opened = sessions.begin(identity);
assert.equal(opened.before.station, 19);
const previewEvents = [];
graphs.table2x.addEventListener('nodePreviewMoved', (event) => previewEvents.push(event.detail));
const staged = sessions.stage({ inputMode: 'absolute', coordinateMode: 'cumulative', x: '20', y: '231.25' });
assert.equal(model.findRow(identity.entityId).stationValue, 19, 'preview must not mutate authoritative model');
assert.deepEqual(graphs.table2x.previews.get(identity.entityId), { x: 20, y: 231.25 });
assert.equal(previewEvents.length, 1);
assert.deepEqual(previewEvents[0].after, { stationValue: 20, elevationValue: 231.25 });
const result = sessions.commit();
assert.equal(result.after.station, 20);
assert.equal(executes, 1);
assert.equal(history.undoStack.length, 1);
assert.equal(captures.length, 1);
assert.deepEqual(captures[0].after, { stationValue: 20, elevationValue: 231.25 });
assert.equal(model.findRow(identity.entityId).stationValue, 20);
history.undo();
assert.equal(model.findRow(identity.entityId).stationValue, 19);
history.redo();
assert.equal(model.findRow(identity.entityId).stationValue, 20);

sessions.begin(identity);
sessions.stage({ inputMode: 'relative', coordinateMode: 'cumulative', x: '1', y: '0.1' });
sessions.cancel();
assert.equal(history.undoStack.length, 1, 'cancel must not create a command');
assert.equal(graphs.table2x.previews.size, 0);
sessions.close();
assert.equal(graphs.table2x.grip, null);

assert.equal(PIPELINE_CANVAS_NODE_MOVED_SCHEMA, 'PipelineCanvasNodeMoved.v1');
assert.equal(PIPELINE_CANVAS_GEOMETRY_UPDATED_SCHEMA, 'PipelineCanvasGeometryUpdated.v1');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'tabs/pipeline-3d-model');
const NEW_FILES = [
  'pipeline-3d-model-cad-precision-contracts.js',
  'pipeline-3d-model-cad-precision-parser.js',
  'pipeline-3d-model-cad-precision-adapters.js',
  'pipeline-3d-model-cad-precision-session.js',
  'pipeline-3d-model-cad-precision-runtime.js',
  'pipeline-3d-model-cad-precision-view.js',
];
const EDITED_VIEW_FILES = [
  'pipeline-3d-model-table2x-canvas.js',
  'pipeline-3d-model-table3x-canvas.js',
  'pipeline-3d-model-cad-workspace.js',
];
function spans(source) {
  const lines = source.split(/\r?\n/); const values = [];
  lines.forEach((line, start) => {
    if (!/\bfunction\s+\w+\s*\(|\b(?:destroy|setMode|commit|cancel|reset|refresh|begin|stage)\s*\([^)]*\)\s*\{/.test(line)) return;
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
for (const name of [...NEW_FILES, ...EDITED_VIEW_FILES]) {
  const source = fs.readFileSync(path.join(DIR, name), 'utf8');
  assert.ok(source.split(/\r?\n/).length < 300, `${name} must remain below 300 lines`);
  assert.doesNotMatch(source, /export\s+default\b/);
  assert.doesNotMatch(source, /MutationObserver|observe\s*\(\s*(?:document|doc)\.body/);
}
for (const name of NEW_FILES) {
  const source = fs.readFileSync(path.join(DIR, name), 'utf8');
  assert.ok(spans(source).every((span) => span <= 40), `${name} functions must remain at or below 40 lines`);
  assert.doesNotMatch(source, /core\/workbench-viewport|xml-compare|pipeline-3d-model-canvas-(?:contracts|runtime)\.js/);
}
const workspace = fs.readFileSync(path.join(DIR, 'pipeline-3d-model-cad-workspace.js'), 'utf8');
assert.match(workspace, /mountPipelineCadPrecisionEditing/);
assert.match(workspace, /parts\.precision\?\.destroy/);
const objectSnap = fs.readFileSync(path.join(DIR, 'pipeline-3d-model-cad-object-snap-runtime.js'), 'utf8');
assert.doesNotMatch(objectSnap, /precision/i, 'PCAD-002 Object Snap implementation must remain unchanged');

const browserSpec = fs.readFileSync(path.join(ROOT, 'tests/browser/pipeline-cad-precision.spec.mjs'), 'utf8');
const browserFixture = fs.readFileSync(path.join(ROOT, 'tests/browser/pipeline-cad-precision-fixture.html'), 'utf8');
const browserConfig = fs.readFileSync(path.join(ROOT, 'playwright.pipeline-cad.config.mjs'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
for (let index = 1; index <= 18; index += 1) {
  assert.match(browserSpec, new RegExp(`PCAD-PE-B${String(index).padStart(2, '0')}`));
}
assert.match(browserFixture, /__pcadPrecision/);
assert.match(browserFixture, /mountPipelineCadWorkspace/);
assert.match(browserConfig, /pipeline-cad-precision\.spec\.mjs/);
assert.match(packageJson.scripts['test:pipeline-cad-precision'], /precision-contracts/);
assert.match(packageJson.scripts['test:static'], /test:pipeline-cad-precision/);

console.log('Pipeline CAD precision integration and source-guard tests passed');
