import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../tabs/pipeline-3d-model/', import.meta.url));
const names = ['pipeline-3d-model-diameter-contracts.js', 'pipeline-3d-model-diameter-resolution.js'];
const sources = Object.fromEntries(names.map((name) => [name, fs.readFileSync(path.join(root, name), 'utf8')]));
for (const [name, source] of Object.entries(sources)) {
  assert.ok(source.trimEnd().split(/\r?\n/).length < 300, `${name} must remain below 300 lines`);
  assert.doesNotMatch(source, /export\s+default|localStorage|sessionStorage|\?v=|cache[-_ ]?token/i);
  assert.doesNotMatch(source, /pipeline-3d-model-(tab|canvas|project-adapter|inputxml-document|xml-builder)/);
  assert.doesNotMatch(source, /pipeline-3d-model-(bend-policy|bend-screening|elastic-bend|gre-)/);
  assert.doesNotMatch(source, /new\s+(Date|Map|Set)\b|Math\.random|performance\.now|localeCompare/);
  assert.doesNotMatch(source, /coordinateRows|geometryRows|fromNode|toNode|deltaX|deltaY|deltaZ/);
}
const contracts = sources[names[0]], resolution = sources[names[1]];
assert.match(contracts, /parsePipelinePositiveScalar/);
assert.match(contracts, /npsToOutsideDiameterConversionApplied:\s*false/);
assert.match(contracts, /greVendorBoreToOutsideDiameterConversionApplied:\s*false/);
assert.match(contracts, /getPipelineEngineeringProfile/);
assert.match(contracts, /Element ownership must follow analysis-section intervals/);
assert.match(resolution, /PIPELINE_DIAMETER_CHANGE_REQUIRES_ANALYSIS_SECTION/);
assert.match(resolution, /PIPELINE_DIAMETER_PROPERTY_MISMATCH/);
assert.doesNotMatch(resolution, /nominalPipeSizeNps\s*[*\/+\-]/);
assert.doesNotMatch(resolution, /gre(?:VendorNominalBoreMm|NominalBoreMm)\s*[*\/+\-]/);
assert.doesNotMatch(resolution, /outsideDiameterMm\s*=\s*(?:nominalPipeSizeNps|gre)/);
const allJs = fs.readdirSync(root).filter((name) => name.endsWith('.js'));
for (const name of allJs.filter((name) => !names.includes(name))) {
  const source = fs.readFileSync(path.join(root, name), 'utf8');
  assert.doesNotMatch(source, /pipeline-3d-model-diameter-(contracts|resolution)\.js/);
}
console.log('Pipeline diameter semantic static guards passed.');
