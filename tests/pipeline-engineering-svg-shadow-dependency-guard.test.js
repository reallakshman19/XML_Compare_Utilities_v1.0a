import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const name = 'tabs/pipeline-3d-model/pipeline-engineering-svg-shadow-workspace.js';
const source = readFileSync(join(root, name), 'utf8');
const lines = source.split(/\r?\n/).length;

function filesUnder(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

assert.ok(lines <= 300, `${name} exceeds 300 lines (${lines})`);
assert.doesNotMatch(source, /export\s+default\b/, `${name} uses a default export`);
assert.doesNotMatch(source, /pipeline-3d-model-(cad|table2x|table3x|elastic-bend|preview|tab|controller|commands)/);
assert.doesNotMatch(source, /buildPipelineProjectOutputs|buildAuthoritativePipelineOutputs|buildCoordinateRows|buildInputXml/);
assert.doesNotMatch(source, /createEngineeringSvgCommandGateway|commandGateway\s*:|draftStore\s*:|snapProviders?\s*:/);
assert.doesNotMatch(source, /\b(localStorage|sessionStorage|CustomEvent|EventTarget|THREE|Three|React|WebGL|CanvasRenderingContext2D)\b/);
assert.doesNotMatch(source, /document\.|window\.|globalThis\.|dispatchEvent|innerHTML/);
assert.doesNotMatch(source, /toFixed|Math\.(round|floor|ceil|trunc)|parseInt/);
assert.match(source, /createPipelineEngineeringSvgAdapter/);
assert.match(source, /createEngineeringSvgAdapterBridge/);
assert.match(source, /createEngineeringSvgWorkspaceShellFromAdapterBridge/);
assert.match(source, /assertEngineeringRevisionToken/);
assert.match(source, /if \(destroyed\) return false/);

const coreFiles = filesUnder(join(root, 'core')).filter((path) => path.endsWith('.js'));
for (const path of coreFiles) {
  const coreSource = readFileSync(path, 'utf8');
  assert.doesNotMatch(coreSource, /pipeline-engineering-svg-shadow-workspace/, `shared core imports Pipeline shadow: ${relative(root, path)}`);
}

const pipelineFiles = filesUnder(join(root, 'tabs/pipeline-3d-model'))
  .filter((path) => path.endsWith('.js') && relative(root, path) !== name);
for (const path of pipelineFiles) {
  const pipelineSource = readFileSync(path, 'utf8');
  assert.doesNotMatch(pipelineSource, /pipeline-engineering-svg-shadow-workspace/, `existing Pipeline production file mounts shadow: ${relative(root, path)}`);
}

const packageSource = readFileSync(join(root, 'package.json'), 'utf8');
assert.doesNotMatch(packageSource, /pipeline-engineering-svg-shadow/, 'package.json must remain independent of the test-only shadow');

console.log('Pipeline engineering SVG shadow dependency and production-mount guards: ok');
