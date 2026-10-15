import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const productionFiles = [
  'tabs/pipeline-3d-model/pipeline-engineering-svg-view-model.js',
  'tabs/pipeline-3d-model/pipeline-engineering-svg-scene.js',
  'tabs/pipeline-3d-model/pipeline-engineering-svg-properties.js',
  'tabs/pipeline-3d-model/pipeline-engineering-svg-adapter.js',
];

function filesUnder(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

for (const name of productionFiles) {
  const source = readFileSync(join(root, name), 'utf8');
  const lines = source.split(/\r?\n/).length;
  assert.ok(lines <= 300, `${name} exceeds 300 lines (${lines})`);
  assert.doesNotMatch(source, /export\s+default\b/, `${name} uses a default export`);
  assert.doesNotMatch(source, /\b(Canvas|WebGL|ReactDOM|React|THREE|localStorage|sessionStorage|CustomEvent)\b/, `${name} leaks a forbidden runtime or storage owner`);
  assert.doesNotMatch(source, /document\.|window\.|innerHTML|dispatchEvent|addEventListener|removeEventListener/, `${name} owns DOM or a global event path`);
  assert.doesNotMatch(source, /toFixed|Math\.(round|floor|ceil|trunc)|parseInt/, `${name} rounds authoritative coordinates`);
  assert.doesNotMatch(source, /createEngineeringSvgCommandGateway|\.execute\s*\(|new\s+CommandHistory|undoStack|redoStack/, `${name} introduces command or history execution`);
  assert.doesNotMatch(source, /pipeline-3d-model-(table2x|table3x|preview|cad-|profile-propagation-runtime|tab)\.js/, `${name} imports Pipeline UI, renderer or editor ownership`);
  assert.doesNotMatch(source, /pipeline-3d-model-(project-adapter|xml-builder|elastic-bend(?:-settings)?)\.js/, `${name} executes an owner writer or bend subsystem`);
  assert.doesNotMatch(source, /window\.dispatchEvent|globalThis\.dispatchEvent|new\s+Event\(/, `${name} introduces a global event bus`);
}

const viewModel = readFileSync(join(root, productionFiles[0]), 'utf8');
assert.match(viewModel, /reviewRows/);
assert.match(viewModel, /geometryRows/);
assert.match(viewModel, /inputXmlCoordinateRows/);
assert.match(viewModel, /ledgerMode/);
assert.match(viewModel, /'dual'/);
assert.match(viewModel, /'legacy-single'/);
assert.match(viewModel, /reviewPointSource:\s*'coordinateRows'/);
assert.match(viewModel, /inputXmlParitySource:\s*'xmlText'/);
assert.doesNotMatch(viewModel, /samePoint\([^)]*review/i, 'cross-ledger identity must not use coordinate equality');

const sceneSource = readFileSync(join(root, productionFiles[1]), 'utf8');
assert.match(sceneSource, /viewModel\.geometryRows/);
assert.match(sceneSource, /viewModel\.reviewRows/);
assert.match(sceneSource, /inputXmlCountMismatches/);
assert.match(sceneSource, /inputXmlValueMismatches/);

const adapterSource = readFileSync(join(root, productionFiles[3]), 'utf8');
assert.doesNotMatch(adapterSource, /commandGateway\s*:/, 'read-only Pipeline adapter must not pass a command gateway');
assert.match(adapterSource, /accessMode:\s*'read-only'/);
assert.match(adapterSource, /editing:\s*false/);

const coreFiles = filesUnder(join(root, 'core')).filter((path) => path.endsWith('.js'));
for (const path of coreFiles) {
  const source = readFileSync(path, 'utf8');
  assert.doesNotMatch(source, /from\s+['"][^'"]*pipeline-3d-model\//, `shared core imports Pipeline module: ${relative(root, path)}`);
}

const pipelineFiles = filesUnder(join(root, 'tabs/pipeline-3d-model'))
  .filter((path) => path.endsWith('.js') && !path.includes('pipeline-engineering-svg-'));
for (const path of pipelineFiles) {
  const source = readFileSync(path, 'utf8');
  assert.doesNotMatch(source, /pipeline-engineering-svg-/, `existing Pipeline production file mounts the adapter: ${relative(root, path)}`);
}

const workflowPath = join(root, '.github/workflows/pipeline-engineering-svg-adapter.yml');
if (existsSync(workflowPath)) {
  const workflow = readFileSync(workflowPath, 'utf8');
  assert.doesNotMatch(workflow, /playwright|chromium|browser|shadow/i, 'PCAD-ESVG-001B must not modify or mount the downstream shadow workflow');
  assert.match(workflow, /pipeline-engineering-svg-dual-ledger-marker-invariance\.test\.js/);
  assert.match(workflow, /pipeline-engineering-svg-dual-ledger-legacy\.test\.js/);
  assert.match(workflow, /pipeline-3d-model-elastic-bend\.test\.js/);
  assert.match(workflow, /npm test/);
}

for (const mergedBaseline of [
  'tests/browser/revision-compare-svg-preview.spec.mjs',
  'tests/browser/sequential-engineering-svg-shadow.spec.mjs',
]) {
  assert.equal(statSync(join(root, mergedBaseline)).isFile(), true, `current-main baseline is missing: ${mergedBaseline}`);
}

console.log('Pipeline engineering SVG dual-ledger dependency and deployment guards: ok');
