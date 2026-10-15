import assert from 'node:assert/strict';
import fs from 'node:fs';

const contracts = fs.readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-gre-bend-geometry-contracts.js', import.meta.url), 'utf8');
const planner = fs.readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-gre-bend-geometry-plan.js', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-core-runtime.js', import.meta.url), 'utf8');

for (const source of [contracts, planner, runtime]) {
  assert.doesNotMatch(source, /\bDate\b|Math\.random|performance\.now|localeCompare/);
}
assert.match(contracts, /EACH_LEG_FROM_CORNER/);
assert.match(contracts, /EACH_LEG_FROM_TANGENCY/);
assert.doesNotMatch(planner, /greVendorSeriesPlan.*\[0\]/s);
assert.match(planner, /application\.vendorId !== vendor\?\.vendorId/);
assert.match(planner, /GRE-BEND-SHARED:/);
assert.doesNotMatch(planner, /nodeNumber\s*=|geometryRows\s*\.\s*(push|splice|sort)\s*\(/);
assert.match(runtime, /pipeline-gre-bend-geometry-plan\.json/);
assert.match(runtime, /pipeline-gre-bend-geometry-plan\.tsv/);
assert.match(runtime, /buildPipelineCoreOrchestration/);
console.log('pipeline-3d-model GRE bend geometry static: PASS');
