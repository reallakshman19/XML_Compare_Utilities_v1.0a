import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../tabs/pipeline-3d-model/', import.meta.url));
const names = ['pipeline-3d-model-normal-fitting-contracts.js', 'pipeline-3d-model-normal-fitting-resolution.js'];
const sources = Object.fromEntries(names.map((name) => [name, fs.readFileSync(path.join(root, name), 'utf8')]));
for (const [name, source] of Object.entries(sources)) {
  assert.ok(source.trimEnd().split(/\r?\n/).length < 300, `${name} must remain below 300 lines`);
  assert.doesNotMatch(source, /export\s+default/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|\?v=|cache[-_ ]?token/i);
  assert.doesNotMatch(source, /pipeline-3d-model-(tab|canvas|project-adapter|inputxml-document|xml-builder|export-context)/);
  assert.doesNotMatch(source, /pipeline-3d-model-(bend-screening|bend-classification|bend-route|bend-resolution|elastic-bend|bend-policy|gre-)/);
  assert.doesNotMatch(source, /new\s+(Date|Map|Set)\b|Math\.random|performance\.now|localeCompare/);
  assert.doesNotMatch(source, /coordinateRows|geometryRows|deltaX|deltaY|deltaZ/);
}
const contracts = sources[names[0]], resolution = sources[names[1]];
assert.match(contracts, /normal-standard-elbow/);
assert.match(contracts, /normal-explicit-radius-bend/);
assert.match(resolution, /PIPELINE_ANALYSIS_SECTION_PLAN_SCHEMA/);
assert.match(resolution, /PIPELINE_ANALYSIS_DIAMETER_PLAN_SCHEMA/);
assert.match(resolution, /PIPELINE_BEND_RESOLUTION_SCHEMA/);
assert.match(resolution, /0\.000001/);
assert.doesNotMatch(resolution, /nominalPipeSizeNps\s*[*\/+-]|greVendorNominalBoreMm\s*[*\/+-]/);
assert.doesNotMatch(resolution, /candidate\.(?:bendClass|radiusBasis|classification|turnAngleDeg)\s*===\s*['"](?:standard|normal)/);
assert.doesNotMatch(resolution, /candidate\.(?:radiusMm|radiusD|status|incomingElementIndex|outgoingElementIndex|cornerNode)\s*=(?!=)/);
assert.doesNotMatch(resolution, /(?:analysisSectionPlan|analysisDiameterPlan)\.[A-Za-z_$][\w$]*\s*=(?!=)/);
const allJs = fs.readdirSync(root).filter((name) => name.endsWith('.js'));
for (const name of allJs.filter((name) => !names.includes(name))) {
  const source = fs.readFileSync(path.join(root, name), 'utf8');
  assert.doesNotMatch(source, /pipeline-3d-model-normal-fitting-(contracts|resolution)\.js/);
}
console.log('Pipeline Normal fitting static guards passed.');
