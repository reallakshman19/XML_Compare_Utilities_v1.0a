import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const production = path.join(root, 'tabs/pipeline-3d-model');
const names = ['pipeline-3d-model-inputxml-profile-authority.js',
  'pipeline-3d-model-inputxml-document.js', 'pipeline-3d-model-xml-builder.js'];
const sources = Object.fromEntries(names.map((name) => [name,
  fs.readFileSync(path.join(production, name), 'utf8')]));
for (const [name, source] of Object.entries(sources)) {
  const lines = source.trimEnd().split(/\r?\n/);
  assert.ok(lines.length < 300, `${name} must remain below 300 lines`);
  assert.ok(lines.length > 100, `${name} must remain normally formatted`);
  assert.ok(Math.max(...lines.map((line) => line.length)) < 320, `${name} contains an unreviewable physical line`);
  assert.doesNotMatch(source, /export\s+default/);
  assert.doesNotMatch(source, /\bDate\b|Math\.random|performance\.now|localeCompare/);
  assert.doesNotMatch(source, /pipeline-3d-model-(profile-propagation|project-adapter|export-context|tab)\.js/);
}
const authority = sources[names[0]], document = sources[names[1]], writer = sources[names[2]];
assert.match(authority, /createPipelineAnalysisSectionPlan/);
assert.match(authority, /createPipelineAnalysisDiameterPlan/);
assert.match(authority, /createPipelineNormalFittingPlan/);
assert.match(authority, /createPipelineB314RadiusPlan/);
assert.match(authority, /createPipelineGreVendorSeriesPlan/);
assert.match(authority, /bendGeometry/);
assert.match(authority, /greVendorSeriesAuthority/);
assert.match(document, /adoptedProfileBend/);
assert.match(document, /deepClone/);
assert.match(writer, /authorityStructureValid/);
assert.match(writer, /fittingStructureValid/);
assert.match(writer, /countStructureValid/);
assert.match(writer, /bendMatchesAuthority/);
assert.doesNotMatch(writer, /\b(PROFILE|PIPING_CODE|VENDOR|SERIES|QUALIFICATION|ANALYSIS_SECTION)\b.*attr\(/);
for (const runtimeName of ['pipeline-3d-model-profile-propagation.js', 'pipeline-3d-model-project-adapter.js',
  'pipeline-3d-model-export-context.js', 'pipeline-3d-model-tab.js']) {
  const runtimePath = path.join(production, runtimeName);
  if (fs.existsSync(runtimePath)) assert.equal(
    fs.readFileSync(runtimePath, 'utf8').includes('pipeline-3d-model-inputxml-profile-authority.js'), false);
}
console.log('pipeline-3d-model InputXML profile static: PASS');
