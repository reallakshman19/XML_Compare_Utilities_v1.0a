import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'tabs/topology-trace-validator/topology-engineering-svg-view-model.js',
  'tabs/topology-trace-validator/topology-engineering-svg-scene.js',
  'tabs/topology-trace-validator/topology-engineering-svg-properties.js',
  'tabs/topology-trace-validator/topology-engineering-svg-adapter.js',
];

for (const name of files) {
  const source = readFileSync(join(root, name), 'utf8');
  const lines = source.split(/\r?\n/).length;
  assert.ok(lines <= 300, `${name} exceeds 300 lines (${lines})`);
  assert.doesNotMatch(source, /export\s+default\b/, `${name} uses a default export`);
  assert.doesNotMatch(source, /\b(Canvas|WebGL|ReactDOM|React|THREE|localStorage|sessionStorage)\b/, `${name} leaks a forbidden runtime or storage owner`);
  assert.doesNotMatch(source, /document\.|window\.|innerHTML|new\s+CommandHistory|undoStack|redoStack/, `${name} owns DOM, storage or history`);
  assert.doesNotMatch(source, /toFixed|Math\.(round|floor|ceil|trunc)|parseInt/, `${name} rounds authoritative coordinates`);
  assert.doesNotMatch(source, /createEngineeringSvgCommandGateway|commandGateway\s*:/, `${name} introduces a Topology edit boundary`);
}

const sceneSource = readFileSync(join(root, 'tabs/topology-trace-validator/topology-engineering-svg-scene.js'), 'utf8');
assert.doesNotMatch(sceneSource, /projected(Start|End|Point|Position)/, 'shared TTV scene must not use projected coordinates as XYZ');
assert.match(sceneSource, /nodeMap\.get\(cleanText\(record\.fromNodeId\)\)/);
assert.match(sceneSource, /nodeMap\.get\(cleanText\(record\.toNodeId\)\)/);

const rendererSource = readFileSync(join(root, 'tabs/topology-trace-validator/topology-svg-renderer.js'), 'utf8');
assert.doesNotMatch(rendererSource, /engineering-svg|EngineeringScene/, 'current shipped TTV renderer must remain independent');

console.log('Topology Trace engineering SVG dependency guards: ok');
