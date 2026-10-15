import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const directory = fileURLToPath(new URL('../tabs/topology-trace-validator/', import.meta.url));
const files = readdirSync(directory).filter((name) => name.endsWith('.js'));
const read = (name) => readFileSync(path.join(directory, name), 'utf8');
assert(files.length >= 20);
for (const name of files) {
  const fullPath = path.join(directory, name);
  const text = readFileSync(fullPath, 'utf8');
  assert(statSync(fullPath).size > 0);
  assert(text.split(/\r?\n/).length <= 300, `${name} exceeds 300 lines`);
  assert.doesNotMatch(text, /export\s+default/, `${name} must use named exports only`);
  assert.doesNotMatch(text, /(?:from\s+|import\s*)['"]node:|require\(|process\./, `${name} must remain browser-only`);
  assert.doesNotMatch(text, /rvm-pcf-topology|stagedjson_to_inputxml|TopologyBuilder/, `${name} must not import legacy production topology builders`);
}

const markup = read('topology-workspace-markup.js');
for (const label of [
  'Load Source JSON', 'Load Canonical Topology', 'Load Trace Ledger', 'Load Topology InputXML',
  'Spatial Overlay', 'Source ↔ Canonical', 'Junctions / Boundaries', 'Issues Only', 'Symbol Overlays',
  'Isolate Supports', 'Topology Parity', 'Load SVG Scene', 'Load Parsed InputXML Topology', 'Load Parity Report',
  'Fit All', 'Fit Branch', 'Fit Issue', 'ISO', 'Mismatch CSV', 'Topology SVG',
]) assert.match(markup, new RegExp(label));
assert.match(markup, /data-ttv-axis-compass/);
assert.match(markup, /data-ttv-canvas-projection="ISO"/);

for (const moduleName of [
  'topology-companion-loader.js', 'topology-component-validator.js', 'topology-ledger-validator.js',
  'topology-projection-geometry.js', 'topology-search-panel.js', 'topology-svg-component-symbols.js',
  'topology-svg-navigation.js', 'topology-svg-view-state.js', 'topology-svg-view-model-core.js',
  'topology-parity-artifact-reader.js', 'topology-parity-state.js', 'topology-scene-view-model.js',
  'topology-parity-svg-renderer.js', 'topology-parity-controller.js', 'topology-parity-panel.js',
  'topology-workspace-controller.js', 'topology-workspace-wiring.js',
]) assert(files.includes(moduleName), `${moduleName} is required`);

const controller = read('topology-validator-controller.js');
assert.doesNotMatch(controller, /render3dViewer|select3dObject|dispose3dViewer|topology-3d-viewer-bridge/,
  'Trace controller must remain native SVG-only for every projection');
assert.match(controller, /renderTopologySvg/);
assert.match(controller, /wireTopologySvgNavigation/);
const projections = read('topology-svg-projections.js');
assert.match(projections, /plane === 'ISO' \|\| plane === '3D'/);

const legacyRenderer = read('topology-svg-renderer.js');
assert.doesNotMatch(legacyRenderer, /topology-source-reader|topology-artifact-reader|DOMParser|JSON\.parse/);
const parityRenderer = read('topology-parity-svg-renderer.js');
const sceneView = read('topology-scene-view-model.js');
const parityState = read('topology-parity-state.js');
for (const text of [parityRenderer, sceneView]) {
  assert.doesNotMatch(text, /topology-source-reader|topology-artifact-reader|topology-connectivity|support-edge|nearest|localStorage|DOMParser|JSON\.parse/,
    'scene rendering path must not construct or repair topology from raw artifacts');
}
assert.doesNotMatch(parityState, /screen|clientX|clientY|getBBox/, 'parity state must not use screen coordinates');
for (const layer of [
  'grid', 'unaffected-branches', 'active-branches', 'component-envelopes', 'legal-connections',
  'supports', 'deferred-attachments', 'rigids', 'junctions', 'issues', 'nodes',
  'dimensions', 'labels', 'interaction-targets',
]) assert(parityRenderer.includes(`'${layer}'`) || parityRenderer.includes(`"${layer}"`), `missing SVG layer ${layer}`);
for (const attribute of [
  'data-canonical-edge-id', 'data-inputxml-element-id', 'data-from-canonical-node-id',
  'data-to-canonical-node-id', 'data-source-entity-ids', 'data-source-port-ids',
  'data-branch-id', 'data-segment-role', 'data-projection-cardinality', 'data-topology-operation',
  'data-canonical-node-id', 'data-inputxml-node-id', 'data-world-x', 'data-world-y', 'data-world-z',
]) assert(parityRenderer.includes(attribute), `missing SVG identity attribute ${attribute}`);

const utilityTab = readFileSync(new URL('../tabs/psnm-utility-tab.js', import.meta.url), 'utf8');
assert.match(utilityTab, /installTopologyTraceValidatorTile/);
await import('./topology-trace-native-svg-3d.test.js');
console.log('topology trace validator static architecture tests passed');
