import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ExplicitPipelineCanvasManager } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-workspace-bindings.js';
import { PipelineProfileModel } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-model.js';
import { Table2XCanvas } from '../tabs/pipeline-3d-model/pipeline-3d-model-table2x-canvas.js';
import { Table3XCanvas } from '../tabs/pipeline-3d-model/pipeline-3d-model-table3x-canvas.js';
import {
  SAMPLE_TABLE_2A_RAW,
  SAMPLE_TABLE_3A_RAW,
  SAMPLE_TABLE_3B_RAW,
  SAMPLE_TABLE_3C_RAW,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-samples.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tabs = path.join(ROOT, 'tabs/pipeline-3d-model');
const read = (name) => fs.readFileSync(path.join(tabs, name), 'utf8');

function functionSpans(source) {
  const lines = source.split(/\r?\n/);
  const spans = [];
  lines.forEach((line, start) => {
    if (!/\bfunction\s+\w+\s*\(|\b(?:constructor|destroy|setMode)\s*\([^)]*\)\s*\{/.test(line)) return;
    let depth = 0;
    let opened = false;
    for (let index = start; index < lines.length; index += 1) {
      for (const character of lines[index]) {
        if (character === '{') { depth += 1; opened = true; }
        if (character === '}') depth -= 1;
      }
      if (opened && depth <= 0) { spans.push(index - start + 1); break; }
    }
  });
  return spans;
}

const workspace = read('pipeline-3d-model-cad-workspace.js');
const preview = read('pipeline-3d-model-cad-preview-modes.js');
const authoring = read('pipeline-3d-model-cad-authoring.js');
const config = read('pipeline-3d-model-config.js');
const engineering = read('pipeline-3d-model-cad-engineering-review.js');
const diagnostics = read('pipeline-3d-model-cad-diagnostics-lifecycle.js');
assert.ok(workspace.split(/\r?\n/).length < 300);
assert.ok(preview.split(/\r?\n/).length < 300);
assert.doesNotMatch(workspace, /MutationObserver|observe\s*\(\s*doc\.body/);
assert.match(workspace, /pipeline3d\.cad\.soak\.install-state\.v1/);
assert.doesNotMatch(preview, /MutationObserver|\.prototype\.attachGraphs|PipelineCadController\.prototype/);
assert.doesNotMatch(authoring, /PipelineCadController\.prototype|observe\s*\(\s*doc\.body/);
assert.ok(engineering.split(/\r?\n/).length < 300);
assert.doesNotMatch(engineering, /MutationObserver|PipelineCadController\.prototype|\.prototype\.(?:render|setModel)/);
assert.doesNotMatch(diagnostics, /MutationObserver|PipelineCadController\.prototype|cad-soak-evidence\.js/);
assert.doesNotMatch(config, /canvas-audit-hardening|preview-modes-hardening|cad-soak-evidence/);
assert.match(workspace, /installPipelineCadWorkspaceComposition/);
assert.match(workspace, /mountPipelineCadWorkspace/);
assert.match(workspace, /mountPipelineCadDiagnosticsLifecycle/);

const approved = [
  'pipeline-3d-model-cad-viewport-host.js',
  'pipeline-3d-model-cad-viewport-state.js',
  'pipeline-3d-model-cad-viewport-runtime.js',
  'pipeline-3d-model-cad-viewport-shell.js',
  'pipeline-3d-model-cad-viewport-shell-view.js',
  'pipeline-3d-model-cad-engineering-grid.js',
  'pipeline-3d-model-cad-preview-mode-state.js',
  'pipeline-3d-model-cad-preview-mode-overlay.js',
  'pipeline-3d-model-cad-preview-mode-view.js',
  'pipeline-3d-model-cad-workspace-view.js',
  'pipeline-3d-model-cad-workspace-bindings.js',
  'pipeline-3d-model-cad-diagnostics-lifecycle.js',
];
for (const name of approved) {
  const source = read(name);
  assert.ok(source.split(/\r?\n/).length < 300, `${name} must be below 300 lines`);
  assert.doesNotMatch(source, /export\s+default\b/, `${name} must use named exports`);
  assert.ok(functionSpans(source).every((lines) => lines <= 90), `${name} function exceeds lifecycle limit`);
  for (const match of source.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)) {
    const resolved = path.resolve(tabs, match[1]);
    assert.ok(fs.existsSync(resolved), `${name} has dangling import ${match[1]}`);
  }
}

class FakeController extends EventTarget {
  constructor(model) {
    super();
    this.model = model;
    this.dialog = new EventTarget();
  }
}
const model = PipelineProfileModel.fromRaw({
  table2a: SAMPLE_TABLE_2A_RAW,
  table3a: SAMPLE_TABLE_3A_RAW,
  table3b: SAMPLE_TABLE_3B_RAW,
  table3c: SAMPLE_TABLE_3C_RAW,
});
const graphs = {
  table2x: new Table2XCanvas(null, { width: 800, height: 400 }),
  table3x: new Table3XCanvas(null, { width: 800, height: 400 }),
};
Object.values(graphs).forEach((graph) => graph.setModel(model));
const controller = new FakeController(model);
const manager = new ExplicitPipelineCanvasManager(controller, graphs);
manager.syncGeometry();
const nodes = manager.nodes;
const edges = manager.edges;
graphs.table2x.dispatchEvent(new CustomEvent('viewportChanged', { detail: { reason: 'pan-x' } }));
assert.equal(manager.nodes, nodes, 'viewport-only operations must preserve nodes identity');
assert.equal(manager.edges, edges, 'viewport-only operations must preserve edges identity');
let moveCount = 0;
manager.addEventListener('canvas:nodeMoved', () => { moveCount += 1; });
const detail = { graph: 'table2x', entityId: model.table2Rows[0].id, entityType: 'elevation-node', after: { elevationValue: 232 } };
graphs.table2x.dispatchEvent(new CustomEvent('nodeMoved', { detail }));
controller.dispatchEvent(new CustomEvent('commandCommitted', { detail: { reason: 'move-table2-node' } }));
assert.equal(moveCount, 1, 'committed movement must dispatch once');
assert.equal(manager.destroy(), true);
assert.equal(manager.destroy(), false);
Object.values(graphs).forEach((graph) => graph.destroy());
console.log('pipeline-3d-model CAD lifecycle integration tests passed');
