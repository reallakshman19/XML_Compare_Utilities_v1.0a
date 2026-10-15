import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (name) => fs.readFileSync(
  new URL(`../tabs/pipeline-3d-model/${name}`, import.meta.url),
  'utf8',
);
const context = read('pipeline-3d-model-export-context.js');
const documentPlan = read('pipeline-3d-model-inputxml-document.js');
const xml = read('pipeline-3d-model-xml-builder.js');
const adapter = read('pipeline-3d-model-project-adapter.js');
const profile = read('pipeline-3d-model-profile-propagation.js');
const runtime = read('pipeline-3d-model-profile-propagation-runtime.js');
const orchestrator = read('pipeline-3d-model-core-orchestrator.js');

for (const [name, source] of Object.entries({ context, documentPlan, xml, adapter, profile, runtime, orchestrator })) {
  assert.ok(source.split(/\r?\n/).length < 300, `${name} must stay below 300 lines`);
  assert.doesNotMatch(source, /export\s+default/);
  assert.doesNotMatch(source, /inputxml_to_cii2019|converters\/scripts/);
}

assert.match(context, /PipelineUtilityExportContext\.v1/);
assert.match(context, /PipelineUtilityExportQualification\.v1/);
assert.match(context, /baseGeometryReady: blockers\.length === 0/);
assert.match(context, /baseInputXmlReady: blockers\.length === 0/);
assert.match(context, /fittingInputXmlRequested/);
assert.match(context, /GRE_BEND_POLICY_NOT_IMPLEMENTED/);
assert.match(context, /documentPlan = null/);
assert.match(context, /documentBlockerCount/);
assert.match(context, /buildPipelineExportContextJson/);
assert.match(documentPlan, /PipelineInputXmlDocumentPlan\.v1/);
assert.match(documentPlan, /PIPELINE_GEOMETRY_SEGMENT_REQUIRED/);
assert.match(xml, /PIPELINE_INPUTXML_DOCUMENT_SCHEMA/);
assert.match(xml, /buildInputXmlPipingModelXml\(input/);
assert.match(xml, /XML_TYPE/);
assert.match(adapter, /pipeline-export-context\.json/);
assert.match(adapter, /output\.artifacts/);
assert.match(adapter, /PipelineUtilityExportContext\.v1/);
assert.match(adapter, /exportQualification/);
assert.match(adapter, /pipelineMode/);
assert.match(orchestrator, /pipeline-inputxml-document-plan\.json/);
assert.match(orchestrator, /InputXML\.Canonical\.v1/);
assert.match(orchestrator, /buildInputXmlXml/);
assert.match(profile, /resolvePipelineUtilityExportContext/);
assert.match(profile, /qualifyPipelineUtilityExport/);
assert.doesNotMatch(profile, /buildInputXmlPipingModelXml\(/);
assert.match(runtime, /CONFIG_FIELDS/);
assert.match(runtime, /CONFIG_KEYS = Object\.freeze\(CONFIG_FIELDS\.map/);
assert.match(runtime, /function readBranchInfo/);
assert.match(runtime, /Object\.fromEntries\(CONFIG_KEYS\.map/);
assert.match(runtime, /canonicalAnalysisSectionPlan/);
assert.doesNotMatch(runtime, /branchName: value\('lineNo'\)/);
assert.match(runtime, /project-adapter\.js\?v=20260724-p3d-hard-051-1/);

console.log('Pipeline export context and canonical document static guards: ok');