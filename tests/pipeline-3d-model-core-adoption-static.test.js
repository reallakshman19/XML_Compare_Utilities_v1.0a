import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, 'tabs/pipeline-3d-model', name), 'utf8');
const propagation = read('pipeline-3d-model-profile-propagation.js');
const adapter = read('pipeline-3d-model-project-adapter.js');
const elasticUi = read('pipeline-3d-model-elastic-bend-ui.js');
const runtime = read('pipeline-3d-model-core-runtime.js');
assert.match(propagation, /buildPipelineCoreOutputs/);
assert.match(adapter, /buildPipelineNativeOutputBundle/);
assert.match(elasticUi, /installPipelineEngineeringConfigurationUi/);
for (const name of ['resolveExplicitPipelineAnalysisSectionPlan', 'resolvePipelineAnalysisDiameterPlan',
  'resolvePipelineNormalFittingPlan', 'resolvePipelineB314RadiusPlan',
  'resolvePipelineGreVendorSeriesPlan', 'buildExplicitPipelineInputXmlDocumentPlan']) assert.match(runtime, new RegExp(name));
assert.doesNotMatch(runtime, /resolvePipelineAnalysisSectionPlan|buildPipelineInputXmlDocumentPlan/);
assert.doesNotMatch(propagation + adapter, /loadElasticBendSettings|buildInputXmlPipingModelXml\(/);
assert.doesNotMatch(adapter, /buildLegacyOutputs|effectiveElasticSettings/);
console.log('pipeline-3d-model core adoption static: PASS');
