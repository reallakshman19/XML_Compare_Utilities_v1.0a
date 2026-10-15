import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-core-orchestrator.js', import.meta.url), 'utf8');
for (const name of ['pipeline-section-property-assignments.json',
  'pipeline-section-property-assignments.tsv', 'pipeline-section-profile-routing.json']) {
  assert.match(source, new RegExp(name.replaceAll('.', '\\.')));
}
assert.match(source, /if \(xmlText\) result\.push/);
assert.match(source, /plans\.sectionProfileRoutingPlan\?\.ready !== true/);
assert.match(source, /PIPELINE_CONFIGURATION_INPUTXML_BLOCKED/);
console.log('pipeline-3d-model P3D-HARD-051 artifacts static: PASS');
