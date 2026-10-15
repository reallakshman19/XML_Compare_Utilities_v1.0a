import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const adapters = [
  'tabs/topology-trace-validator/topology-engineering-svg-adapter.js',
  'tabs/pipeline-3d-model/pipeline-engineering-svg-adapter.js',
  'tabs/sequential-sketcher/sequential-engineering-svg-adapter.js',
];

for (const adapter of adapters) {
  assert.ok(existsSync(join(root, adapter)), `Engineering SVG adopter baseline is missing: ${adapter}`);
}

console.log('Engineering SVG adopter integration baseline: ok');
