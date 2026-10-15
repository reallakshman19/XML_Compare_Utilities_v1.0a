import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../tabs/pipeline-3d-model/', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');
const sections = read('pipeline-3d-model-property-sections.js');
const planner = read('pipeline-3d-model-inputxml-document.js');
const writer = read('pipeline-3d-model-xml-builder.js');
const adapter = read('pipeline-3d-model-project-adapter.js');
const profile = read('pipeline-3d-model-profile-propagation.js');
const config = read('pipeline-3d-model-config.js');
const runtime = read('pipeline-3d-model-profile-propagation-runtime.js');

for (const [name, source] of Object.entries({ sections, planner, writer, adapter, profile, config, runtime })) {
  assert.ok(source.split(/\r?\n/).length < 300, `${name} must remain below 300 lines`);
  assert.doesNotMatch(source, /export\s+default/);
  assert.doesNotMatch(source, /inputxml_to_cii2019|converters\/scripts/);
}

assert.match(sections, /PipelinePropertySectionPlan\.v1/);
assert.match(sections, /PipelinePropertySection\.v1/);
assert.match(sections, /PipelineElementPropertyResolution\.v1/);
assert.match(sections, /PIPELINE_PROPERTY_SECTION_START_INVALID/);
assert.match(sections, /PIPELINE_PROPERTY_SECTION_DUPLICATE/);
assert.match(sections, /PIPELINE_PROPERTY_SECTION_NO_CHANGE/);
assert.match(sections, /PIPELINE_PROPERTY_VALUE_INVALID/);
assert.match(sections, /BASE_BRANCH_INFO/);
assert.match(sections, /SECTION_OVERRIDE/);
assert.match(sections, /buildPipelinePropertySectionLedgerText/);
assert.match(planner, /resolvePipelinePropertySectionPlan/);
assert.match(planner, /propertySectionPlan/);
assert.match(planner, /emittedProperties/);
assert.match(writer, /element\.emittedProperties \?\? element\.properties/);
assert.match(adapter, /for \(const item of output\.artifacts \|\| \[\]\)/);
assert.match(profile, /propertySectionPlanText/);
assert.match(profile, /propertySectionLedgerText/);
assert.match(profile, /propertySectionCount: propertySectionPlan\.sectionCount/);
assert.match(config, /Array\.from\(\{ length: 9 \}/);
assert.match(config, /`p\$\{index \+ 1\}`/);
assert.match(config, /`t\$\{index \+ 1\}`/);
assert.match(runtime, /CONFIG_FIELDS\.map\(\(field\) => field\.key\)/);
assert.match(runtime, /project-adapter\.js\?v=20260724-p3d-hard-051-1/);

await import('./pipeline-3d-model-property-sections.test.js');
console.log('Pipeline property-section static guards passed.');