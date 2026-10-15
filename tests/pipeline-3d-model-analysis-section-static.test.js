import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  PIPELINE_ENGINEERING_PROFILE_REGISTRY,
  resolvePipelineEngineeringProfile,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-engineering-profile-registry.js';
import {
  createPipelineAnalysisSectionPlan,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-analysis-section-contracts.js';

const root = new URL('../tabs/pipeline-3d-model/', import.meta.url);
const names = [
  'pipeline-3d-model-engineering-profile-registry.js',
  'pipeline-3d-model-analysis-section-contracts.js',
];
const sources = Object.fromEntries(names.map((name) => [name, fs.readFileSync(new URL(name, root), 'utf8')]));

for (const [name, source] of Object.entries(sources)) {
  const lines = source.split(/\r?\n/).length;
  assert.ok(lines < 300, `${name} must stay below 300 lines, got ${lines}`);
  assert.doesNotMatch(source, /export\s+default/);
  assert.doesNotMatch(source, /\?v=/, `${name} must not require a browser cache token`);
  assert.doesNotMatch(source, /pipeline-3d-model-(tab|ui|canvas|xml-builder|inputxml-document|gre-|bend-)/);
  assert.doesNotMatch(source, /Math\.random|localeCompare|performance\.now/);
}

assert.doesNotMatch(sources[names[0]], /^import\s/m, 'registry must be dependency-free');
assert.match(sources[names[1]], /engineering-profile-registry\.js/);
assert.doesNotMatch(sources[names[1]], /project-adapter|export-context|property-sections|profile-propagation|elastic-bend/);
assert.match(sources[names[0]], /PipelineEngineeringProfileRegistry\.v1/);
assert.match(sources[names[0]], /PipelineEngineeringProfile\.v1/);
assert.match(sources[names[0]], /PipelineEngineeringProfileResolution\.v1/);
assert.match(sources[names[1]], /PipelineAnalysisSectionPlan\.v1/);
assert.match(sources[names[1]], /PipelineAnalysisSection\.v1/);
assert.match(sources[names[1]], /PipelineElementSectionResolution\.v1/);
assert.doesNotMatch(sources[names[0]], /default-metallic['"]\s*:\s*['"]NORMAL/);
assert.doesNotMatch(sources[names[1]], /coordinateRows|routeLength|geometryRows|node creation/i);

function assertPlainJson(value) {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return;
  assert.notEqual(value instanceof Date, true);
  assert.notEqual(value instanceof Map, true);
  assert.notEqual(value instanceof Set, true);
  assert.equal(typeof value, 'object');
  if (!Array.isArray(value)) {
    const prototype = Object.getPrototypeOf(value);
    assert.ok(prototype === Object.prototype || prototype === null);
  }
  for (const item of Object.values(value)) assertPlainJson(item);
}

assertPlainJson(PIPELINE_ENGINEERING_PROFILE_REGISTRY);
assertPlainJson(resolvePipelineEngineeringProfile('gre'));
assertPlainJson(createPipelineAnalysisSectionPlan());

const directory = new URL('../tabs/pipeline-3d-model/', import.meta.url);
for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.js') || names.includes(entry.name)) continue;
  const source = fs.readFileSync(new URL(entry.name, directory), 'utf8');
  for (const contractName of names) {
    assert.equal(source.includes(contractName), false, `${entry.name} must not adopt ${contractName}`);
  }
}

const thisFile = path.basename(new URL(import.meta.url).pathname);
assert.ok(thisFile.endsWith('-static.test.js'));
console.log('Pipeline analysis-section static contract guards passed.');
