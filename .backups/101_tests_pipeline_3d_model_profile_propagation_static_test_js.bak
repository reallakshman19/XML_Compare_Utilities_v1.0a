import assert from 'node:assert/strict'; import fs from 'node:fs';
const read = (name) => fs.readFileSync(new URL(`../tabs/pipeline-3d-model/${name}`, import.meta.url), 'utf8');
const names = ['pipeline-3d-model-profile-coordinate-map.js', 'pipeline-3d-model-profile-events.js',
  'pipeline-3d-model-profile-output.js', 'pipeline-3d-model-profile-propagation.js',
  'pipeline-3d-model-profile-propagation-runtime.js', 'pipeline-3d-model-export-context.js',
  'pipeline-3d-model-inputxml-document.js', 'pipeline-3d-model-identity.js',
  'pipeline-3d-model-warning-log.js', 'pipeline-3d-model-core-orchestrator.js',
  'pipeline-3d-model-core-runtime.js', 'pipeline-3d-model-explicit-analysis-section-planner.js'];
const sources = Object.fromEntries(names.map((name) => [name, read(name)]));
for (const [name, source] of Object.entries(sources)) {
  assert.ok(source.split(/\r?\n/).length < 300, `${name} must stay below 300 lines`);
  assert.doesNotMatch(source, /export\s+default|core\/workbench-viewport|inputxml_to_cii2019|converters\/scripts|setInterval/);
}
const propagation = sources['pipeline-3d-model-profile-propagation.js'];
for (const token of ['PipelineProfileModel.fromRaw', 'buildDepthRules', 'materializeProfileEvents',
  'assertPlausibleProfileSegments', 'sanitizeTable1Label', 'buildPipelineCoreOutputs',
  'configurationPlan', 'orchestration', 'inputXmlDocumentPlanText']) assert.match(propagation, new RegExp(token.replace('.', '\\.')));
assert.doesNotMatch(propagation, /resolvePipelineElasticBends|buildInputXmlPipingModelXml\(/);
const exportContext = sources['pipeline-3d-model-export-context.js'];
assert.match(exportContext, /PipelineUtilityExportContext\.v1/);
assert.match(exportContext, /PIPELINE_CONFIGURATION_PROFILE_REQUIRED/);
assert.doesNotMatch(exportContext, /UNRECOGNIZED_PROFILE_FALLBACK|resolvedMode:\s*'NORMAL'/);
const identity = sources['pipeline-3d-model-identity.js'];
assert.match(identity, /DEFAULT_PIPELINE_BRANCH_NAME = ''/);
assert.doesNotMatch(identity, /branchFallbackApplied:\s*true/);
const runtime = sources['pipeline-3d-model-profile-propagation-runtime.js'];
assert.match(runtime, /new AbortController\(\)/); assert.match(runtime, /buildPipelineProjectOutputs/);
assert.match(runtime, /data-p3d-core-artifacts/); assert.match(runtime, /inputxml_blocked/);
assert.match(runtime, /PIPELINE_PROFILE_RAW_INCOMPLETE/);
assert.match(runtime, /pipelineSourceInput/);
assert.match(runtime, /instance\.output = null/);
assert.match(runtime, /instance\.rendering/);
assert.doesNotMatch(runtime, /new Date|pipeline-3d-model-config-v1|MutationObserver/);
const explicitSectionPlanner = sources['pipeline-3d-model-explicit-analysis-section-planner.js'];
assert.match(explicitSectionPlanner, /resolveExplicitPipelineAnalysisSectionPlan/);
const coreRuntime = sources['pipeline-3d-model-core-runtime.js'];
assert.match(coreRuntime, /buildExplicitPipelineInputXmlDocumentPlan/);
const adapter = read('pipeline-3d-model-project-adapter.js');
assert.match(adapter, /buildPipelineNativeOutputBundle/);
assert.match(adapter, /configuration: output\.configurationPlan/);
assert.match(adapter, /configurationSchema: output\.configurationPlan\.schema/);
assert.match(adapter, /orchestrationBlockerCount/);
assert.match(adapter, /resolvePipelineProjectMigrationBlockers/);
assert.match(adapter, /migrationBlockerCount/);
const addon = read('pipeline-3d-model-table-paste-addon.js');
assert.match(addon, /installPipelineProfilePropagation\(dialog\)/);
assert.match(addon, /installPipelineElasticBendSettingsUi\(dialog\)/);
const elasticUi = read('pipeline-3d-model-elastic-bend-ui.js');
assert.match(elasticUi, /installPipelineEngineeringConfigurationUi/);
const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.match(packageJson.scripts['test:pipeline-table-paste'], /test:pipeline-profile-propagation/);

const runtimeModule = await import('../tabs/pipeline-3d-model/pipeline-3d-model-profile-propagation-runtime.js');
function fakeDialog(values = {}) {
  return {
    pipelineCanonicalAnalysisSectionPlan: null,
    querySelector(selector) {
      const split = selector.match(/data-p3d-split="([^"]+)"/)?.[1];
      if (split) return { value: values[split] || '' };
      const p3d = selector.match(/data-p3d="([^"]+)"/)?.[1];
      if (p3d) return { value: values[p3d] || '' };
      const field = selector.match(/data-p3d-field="([^"]+)"/)?.[1];
      if (field) return { value: values[`field:${field}`] || '' };
      return null;
    },
  };
}
const runtimeTest = runtimeModule._test;
assert.equal(runtimeTest.buildInput(fakeDialog()).profileRaw, null);
assert.throws(() => runtimeTest.buildInput(fakeDialog({ 'table2a-raw': 'H\n1' })),
  (error) => error?.code === 'PIPELINE_PROFILE_RAW_INCOMPLETE'
    && error.details.table2aReady === true && error.details.table3aReady === false);
assert.throws(() => runtimeTest.buildInput(fakeDialog({ 'table3b-raw': 'marker text only' })),
  (error) => error?.code === 'PIPELINE_PROFILE_RAW_INCOMPLETE'
    && error.details.suppliedTables.includes('table3b'));
const completeProfile = runtimeTest.buildInput(fakeDialog({
  'table2a-raw': 'H\n1', 'table3a-raw': 'H\n2',
})).profileRaw;
assert.equal(completeProfile.table2a, 'H\n1');
assert.equal(completeProfile.table3a, 'H\n2');
assert.equal(runtimeTest.pipelineSourceInput({ dataset: { p3dField: 'lineNo' } }), true);
assert.equal(runtimeTest.pipelineSourceInput({ dataset: { p3d: 'table1' } }), true);
assert.equal(runtimeTest.pipelineSourceInput({ dataset: { p3dSplit: 'table3c-raw' } }), true);
assert.equal(runtimeTest.pipelineSourceInput({ dataset: { p3d: 'download-xml' } }), false);

const { resolvePipelineProjectMigrationBlockers } = await import(
  '../tabs/pipeline-3d-model/pipeline-3d-model-project-adapter.js');
assert.deepEqual(resolvePipelineProjectMigrationBlockers({
  orchestration: { blockerCodes: ['ORCHESTRATION_BLOCKER', 'SHARED_BLOCKER'] },
  exportQualification: { inputXmlAllowed: false, blockerCodes: ['EXPORT_BLOCKER', 'SHARED_BLOCKER'] },
  inputXmlDocumentPlan: { blockerCodes: ['DOCUMENT_BLOCKER'] },
}), ['ORCHESTRATION_BLOCKER', 'SHARED_BLOCKER', 'EXPORT_BLOCKER', 'DOCUMENT_BLOCKER']);
assert.deepEqual(resolvePipelineProjectMigrationBlockers({
  exportQualification: { inputXmlAllowed: false, blockerCodes: [] },
}), ['PIPELINE_PROJECT_MIGRATION_INPUTXML_NOT_ALLOWED']);
assert.deepEqual(resolvePipelineProjectMigrationBlockers({
  exportQualification: { inputXmlAllowed: true, blockerCodes: [] },
}), []);

await import('./pipeline-3d-model-identity-static.test.js');
await import('./pipeline-3d-model-identity.test.js');
await import('./pipeline-3d-model-export-context-static.test.js');
await import('./pipeline-3d-model-export-context.test.js');
await import('./pipeline-3d-model-inputxml-document-static.test.js');
await import('./pipeline-3d-model-inputxml-gre-projection-contracts.test.js');
await import('./pipeline-3d-model-inputxml-gre-projection.test.js');
await import('./pipeline-3d-model-inputxml-gre-projection-adversarial.test.js');
await import('./pipeline-3d-model-inputxml-gre-projection-static.test.js');
await import('./pipeline-3d-model-inputxml-gre-document-adoption-contracts.test.js');
await import('./pipeline-3d-model-inputxml-gre-document-adoption.test.js');
await import('./pipeline-3d-model-inputxml-gre-document-adoption-mixed.test.js');
await import('./pipeline-3d-model-inputxml-gre-document-adoption-adversarial.test.js');
await import('./pipeline-3d-model-inputxml-gre-document-adoption-static.test.js');
await import('./pipeline-gre-caesar-fixture-evidence.test.js');
await import('./pipeline-gre-caesar-bend-field-mapping.test.js');
await import('./pipeline-gre-caesar-bend-topology-mapping.test.js');
await import('./pipeline-gre-caesar-bend-qualification.test.js');
await import('./pipeline-gre-caesar-bend-qualification-static.test.js');
console.log('Pipeline profile propagation explicit-authority static guards passed.');
