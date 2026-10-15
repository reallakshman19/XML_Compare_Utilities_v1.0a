import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../tabs/pipeline-3d-model/', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');
const planner = read('pipeline-3d-model-inputxml-document.js');
const sections = read('pipeline-3d-model-property-sections.js');
const writer = read('pipeline-3d-model-xml-builder.js');
const context = read('pipeline-3d-model-export-context.js');
const adapter = read('pipeline-3d-model-project-adapter.js');
const profile = read('pipeline-3d-model-profile-propagation.js');
const config = read('pipeline-3d-model-config.js');
const runtime = read('pipeline-3d-model-profile-propagation-runtime.js');
const orchestrator = read('pipeline-3d-model-core-orchestrator.js');

for (const [name, source] of Object.entries({ planner, sections, writer, context, adapter, profile, runtime, orchestrator })) {
  assert.ok(source.split(/\r?\n/).length < 300, `${name} must remain below 300 lines`);
  assert.doesNotMatch(source, /export\s+default/);
  assert.doesNotMatch(source, /inputxml_to_cii2019|converters\/scripts/);
}

assert.match(planner, /PipelineInputXmlDocumentPlan\.v1/);
assert.match(planner, /PIPELINE_LINE_NUMBER_REQUIRED/);
assert.match(planner, /PIPELINE_GEOMETRY_NONFINITE/);
assert.match(planner, /PIPELINE_ZERO_LENGTH_ELEMENT/);
assert.match(planner, /PIPELINE_NODE_PAIR_INVALID/);
assert.match(planner, /contextDiagnostics/);
assert.match(planner, /exportContext\?\.readiness\?\.blockerCodes/);
assert.match(planner, /id: `E\$\{index \+ 1\}`/);
assert.match(planner, /fromX, fromY, fromZ, toX, toY, toZ/);
assert.match(planner, /resolvePipelinePropertySectionPlan/);
assert.match(sections, /PIPELINE_DIAMETER_REQUIRED/);
assert.match(sections, /PIPELINE_WALL_THICKNESS_REQUIRED/);
assert.match(writer, /xmlns:ext/);
assert.match(writer, /XML_TYPE/);
assert.match(writer, /NUMELT/);
assert.match(writer, /NUMBEND/);
assert.match(writer, /element\.emittedProperties/);
assert.doesNotMatch(writer, /NUMELEMENTS/);
assert.doesNotMatch(writer, /SENTINEL_MISSING|-1\.010100/);
assert.match(context, /documentPlan = null/);
assert.match(context, /documentBlockerCount/);
assert.match(adapter, /output\.artifacts/);
assert.match(orchestrator, /pipeline-inputxml-document-plan\.json/);
assert.match(orchestrator, /InputXML\.Canonical\.v1/);
assert.match(profile, /propertySectionPlanText/);
assert.match(config, /field\('jobName', 'Job Name'\)/);
assert.match(config, /const field = \(key, label, unit = ''\) => Object\.freeze\(\{ key, label, unit, default: '' \}\)/);
assert.match(runtime, /CONFIG_FIELDS\.map/);
assert.match(runtime, /hasAuthoritativeProfile\(dialog\) \? readProfileRaw\(dialog\) : null/);
assert.match(runtime, /inputxml_blocked/);
assert.doesNotMatch(runtime, /branchName:\s*value\('lineNo'\)/);

await import('./pipeline-3d-model-inputxml-document.test.js');
await import('./pipeline-3d-model-property-sections-static.test.js');
console.log('Pipeline canonical InputXML document static guards passed.');