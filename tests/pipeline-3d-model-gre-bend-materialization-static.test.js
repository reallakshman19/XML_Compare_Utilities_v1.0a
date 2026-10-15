import assert from 'node:assert/strict';
import fs from 'node:fs';

const production = [
  'tabs/pipeline-3d-model/pipeline-3d-model-gre-bend-materialization-contracts.js',
  'tabs/pipeline-3d-model/pipeline-3d-model-gre-bend-node-allocation.js',
  'tabs/pipeline-3d-model/pipeline-3d-model-gre-bend-lineage.js',
  'tabs/pipeline-3d-model/pipeline-3d-model-gre-bend-materialized-route.js',
  'tabs/pipeline-3d-model/pipeline-3d-model-gre-bend-materialization.js',
  'tabs/pipeline-3d-model/pipeline-3d-model-core-runtime.js',
];
const sources = Object.fromEntries(production.map((path) => [path, fs.readFileSync(path, 'utf8')]));
for (const [path, source] of Object.entries(sources)) {
  assert.ok(source.split(/\r?\n/).length < 300, `${path} exceeds 299 physical lines`);
  assert.doesNotMatch(source, /\bDate\b|Math\.random|performance\.now|localeCompare/);
}
for (const path of production.filter((item) => item.includes('gre-bend-'))) {
  assert.doesNotMatch(sources[path], /inputxml|xml-builder|canvas|cad-workspace|engineering-configuration-ui/i);
}
const materialization = sources['tabs/pipeline-3d-model/pipeline-3d-model-gre-bend-materialization.js'];
const route = sources['tabs/pipeline-3d-model/pipeline-3d-model-gre-bend-materialized-route.js'];
const lineage = sources['tabs/pipeline-3d-model/pipeline-3d-model-gre-bend-lineage.js'];
const runtime = sources['tabs/pipeline-3d-model/pipeline-3d-model-core-runtime.js'];
assert.match(materialization, /materializedModel: model/);
assert.match(materialization, /if \(errors\.length\) return aborted/);
assert.match(route, /COINCIDENT_ENVELOPE_CONTACT/);
assert.match(lineage, /indexes\.forEach\(\(index\) => bySource\[index\]\.push\(element\)\)/);
assert.match(runtime, /pipeline-gre-bend-materialization-plan\.json/);
assert.match(runtime, /pipeline-gre-bend-materialized-model\.json/);
assert.doesNotMatch(runtime, /buildInputXmlDocumentPlan\([^)]*greBendMaterialized/s);
assert.doesNotMatch(runtime, /coordinateRows\s*:/);

console.log('pipeline-3d-model GRE bend materialization static containment: PASS');
