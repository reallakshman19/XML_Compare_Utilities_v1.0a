import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  PIPELINE_APPROVED_CATALOG_PRODUCTION_INPUT_FIELDS,
  PIPELINE_APPROVED_CATALOG_PRODUCTION_INPUT_SCHEMA,
  buildPipelineApprovedCatalogProductionSourceEvidence,
  pipelineApprovedCatalogProductionInputs,
  resolvePipelineApprovedCatalogProductionOutputState,
  withPipelineApprovedCatalogProductionInputs,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-approved-catalog-production-input.js';
import {
  buildPipelineCoreRuntimeDependencies,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-core-runtime.js';
import {
  buildExplicitPipelineInputXmlDocumentPlan,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-explicit-inputxml.js';
import {
  buildInputXmlPipingModelXml,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-xml-builder.js';

const registry = Object.freeze({ source: Object.freeze({
  registryId: 'P3D', title: 'Approved Pipeline Catalog', revision: 'R1',
  approvalReference: 'APPROVAL-P3D-R1', sha256: 'a'.repeat(64), caesarVersion: '14.00',
}), pipingCodeEntries: Object.freeze([]), materialAllowableEntries: Object.freeze([]) });
const pipingCodeAuthorities = Object.freeze([{ analysisSectionId: 'AS1' }]);
const allowableValueAuthorities = Object.freeze([{ analysisSectionId: 'AS1' }]);
const allowableStresses = Object.freeze([{ elementIndex: 0 }]);
const source = Object.freeze({ registryIgnored: true, approvedCatalogRegistry: registry,
  pipingCodeAuthorities, allowableValueAuthorities, allowableStresses });
const recognizedSource = Object.freeze({ approvedCatalogRegistry: registry,
  pipingCodeAuthorities, allowableValueAuthorities, allowableStresses });

assert.deepEqual(PIPELINE_APPROVED_CATALOG_PRODUCTION_INPUT_FIELDS, [
  'approvedCatalogRegistry', 'pipingCodeAuthorities',
  'allowableValueAuthorities', 'allowableStresses',
]);
const inputs = pipelineApprovedCatalogProductionInputs(source);
assert.deepEqual(Object.keys(inputs), PIPELINE_APPROVED_CATALOG_PRODUCTION_INPUT_FIELDS);
assert.equal(inputs.approvedCatalogRegistry, registry);
assert.equal(inputs.pipingCodeAuthorities, pipingCodeAuthorities);
assert.equal(inputs.allowableValueAuthorities, allowableValueAuthorities);
assert.equal(inputs.allowableStresses, allowableStresses);
assert.equal(Object.hasOwn(inputs, 'registryIgnored'), false);
assert.equal(Object.isFrozen(inputs), true);

const absent = pipelineApprovedCatalogProductionInputs({ registryIgnored: true });
assert.deepEqual(absent, {});
assert.deepEqual(pipelineApprovedCatalogProductionInputs(null), {});
assert.deepEqual(pipelineApprovedCatalogProductionInputs([]), {});
assert.equal(buildPipelineApprovedCatalogProductionSourceEvidence(null).active, false);
const explicitNull = pipelineApprovedCatalogProductionInputs({ approvedCatalogRegistry: null });
assert.equal(Object.hasOwn(explicitNull, 'approvedCatalogRegistry'), true);
assert.equal(explicitNull.approvedCatalogRegistry, null);

const base = Object.freeze({ exportContext: Object.freeze({ id: 'CTX' }) });
const combined = withPipelineApprovedCatalogProductionInputs(base, source);
assert.equal(combined.exportContext, base.exportContext);
assert.equal(combined.approvedCatalogRegistry, registry);
assert.equal(combined.pipingCodeAuthorities, pipingCodeAuthorities);
assert.equal(Object.hasOwn(base, 'approvedCatalogRegistry'), false);

const evidence = buildPipelineApprovedCatalogProductionSourceEvidence(source);
assert.equal(evidence.schema, PIPELINE_APPROVED_CATALOG_PRODUCTION_INPUT_SCHEMA);
assert.equal(evidence.active, true);
assert.deepEqual(evidence.suppliedFields, PIPELINE_APPROVED_CATALOG_PRODUCTION_INPUT_FIELDS);
assert.deepEqual(evidence.inputs, recognizedSource);
assert.equal(Object.hasOwn(evidence.inputs, 'registryIgnored'), false);
assert.notEqual(evidence.inputs.approvedCatalogRegistry, registry);
assert.equal(Object.isFrozen(evidence), true);
assert.equal(Object.isFrozen(evidence.inputs.approvedCatalogRegistry.source), true);
assert.deepEqual(evidence, buildPipelineApprovedCatalogProductionSourceEvidence(structuredClone(source)));
const inactiveEvidence = buildPipelineApprovedCatalogProductionSourceEvidence({});
assert.equal(inactiveEvidence.active, false);
assert.deepEqual(inactiveEvidence.suppliedFields, []);

assert.deepEqual(resolvePipelineApprovedCatalogProductionOutputState(null), {
  approvedCatalogAdoptionActive: false,
  approvedCatalogAdoptionReady: false,
  approvedCatalogRegistryReference: null,
  approvedCatalogBindingCount: 0,
});
assert.deepEqual(resolvePipelineApprovedCatalogProductionOutputState({
  approvedCatalogAdoption: { active: true, ready: true, registryReference: 'P3D@R1' },
  approvedCatalogRegistryBindingPlan: { bindingCount: 3 },
}), {
  approvedCatalogAdoptionActive: true,
  approvedCatalogAdoptionReady: true,
  approvedCatalogRegistryReference: 'P3D@R1',
  approvedCatalogBindingCount: 3,
});

let received = null;
const baseDependencies = Object.freeze({
  marker: Object.freeze({ id: 'BASE' }),
  buildInputXmlDocumentPlan: (value) => { received = value; return value; },
});
const runtimeDependencies = buildPipelineCoreRuntimeDependencies(source, baseDependencies);
const documentInput = Object.freeze({ exportContext: Object.freeze({ id: 'DOC' }) });
const forwarded = runtimeDependencies.buildInputXmlDocumentPlan(documentInput);
assert.equal(runtimeDependencies.marker, baseDependencies.marker);
assert.equal(received.exportContext, documentInput.exportContext);
assert.equal(received.approvedCatalogRegistry, registry);
assert.equal(received.pipingCodeAuthorities, pipingCodeAuthorities);
assert.equal(received.allowableValueAuthorities, allowableValueAuthorities);
assert.equal(received.allowableStresses, allowableStresses);
assert.equal(forwarded, received);
assert.equal(Object.isFrozen(runtimeDependencies), true);

let legacyReceived = null;
const legacyDependencies = buildPipelineCoreRuntimeDependencies({}, {
  buildInputXmlDocumentPlan: (value) => { legacyReceived = value; return value; },
});
legacyDependencies.buildInputXmlDocumentPlan(documentInput);
for (const field of PIPELINE_APPROVED_CATALOG_PRODUCTION_INPUT_FIELDS) {
  assert.equal(Object.hasOwn(legacyReceived, field), false);
}

const branchInfo = Object.freeze({ branchName: 'BR-PROD', lineNo: 'PL-PROD',
  jobName: 'JOB-PROD', issueNo: 'A', caesarVersion: '11.00', boreMm: '114.3',
  wallThickness: '6.02', insulationThickness: '0', corrosionAllowance: '0',
  t1: '100', p1: '1000', hydroPressure: '1500', insulationDensity: '0',
  fluidDensity: '0.000965', materialCode: '1' });
const productionDocumentInput = Object.freeze({
  exportContext: Object.freeze({ schema: 'PipelineUtilityExportContext.v1',
    profile: Object.freeze({ resolvedMode: 'NORMAL' }), branchInfo }),
  coordinateRows: Object.freeze([
    Object.freeze({ nodeNumber: 100, x: 0, y: 0, z: 0, nodeName: 'A' }),
    Object.freeze({ nodeNumber: 110, x: 1000, y: 0, z: 0, nodeName: 'B' }),
  ]),
  bendResolution: Object.freeze({ errors: Object.freeze([]),
    bendByIncomingElementIndex: Object.freeze({}) }),
});
const actualLegacyDependencies = buildPipelineCoreRuntimeDependencies({}, {
  buildInputXmlDocumentPlan: buildExplicitPipelineInputXmlDocumentPlan,
});
const legacyPlan = actualLegacyDependencies.buildInputXmlDocumentPlan(productionDocumentInput);
assert.equal(legacyPlan.ready, true);
assert.equal(Object.hasOwn(legacyPlan, 'approvedCatalogAdoption'), false);
const actualRegistryDependencies = buildPipelineCoreRuntimeDependencies({
  approvedCatalogRegistry: registry,
}, { buildInputXmlDocumentPlan: buildExplicitPipelineInputXmlDocumentPlan });
const adoptedPlan = actualRegistryDependencies.buildInputXmlDocumentPlan(productionDocumentInput);
assert.equal(adoptedPlan.ready, true);
assert.equal(adoptedPlan.approvedCatalogAdoption.ready, true);
assert.equal(adoptedPlan.approvedCatalogRegistryBindingPlan.bindingCount, 0);
assert.equal(buildInputXmlPipingModelXml(adoptedPlan), buildInputXmlPipingModelXml(legacyPlan));

const invalidRegistry = structuredClone(registry);
invalidRegistry.source.sha256 = 'invalid';
const invalidDependencies = buildPipelineCoreRuntimeDependencies({
  approvedCatalogRegistry: invalidRegistry,
}, { buildInputXmlDocumentPlan: buildExplicitPipelineInputXmlDocumentPlan });
const blockedPlan = invalidDependencies.buildInputXmlDocumentPlan(productionDocumentInput);
assert.equal(blockedPlan.ready, false);
assert.ok(blockedPlan.blockerCodes.includes(
  'PIPELINE_APPROVED_CATALOG_REGISTRY_SOURCE_SHA256_INVALID'));
assert.throws(() => buildInputXmlPipingModelXml(blockedPlan));

const profileSource = readFileSync(fileURLToPath(new URL(
  '../tabs/pipeline-3d-model/pipeline-3d-model-profile-propagation.js', import.meta.url)), 'utf8');
assert.match(profileSource,
  /buildPipelineCoreOutputs\(withPipelineApprovedCatalogProductionInputs\(/);
assert.match(profileSource, /resolvePipelineApprovedCatalogProductionOutputState\(inputXmlDocumentPlan\)/);
const projectSource = readFileSync(fileURLToPath(new URL(
  '../tabs/pipeline-3d-model/pipeline-3d-model-project-adapter.js', import.meta.url)), 'utf8');
assert.match(projectSource,
  /approvedCatalogProductionInputs:\s*buildPipelineApprovedCatalogProductionSourceEvidence\(input\)/);
assert.match(projectSource, /approvedCatalogRegistryReference:/);
assert.match(projectSource, /approvedCatalogBindingCount:/);

console.log('pipeline-3d-model approved catalog production input transport: PASS');
