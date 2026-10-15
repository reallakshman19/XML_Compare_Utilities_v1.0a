import assert from 'node:assert/strict';
import {
  buildPipelineInputXmlDocumentPlan,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-document.js';
import {
  buildInputXmlPipingModelXml,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-xml-builder.js';
import {
  PIPELINE_APPROVED_CATALOG_ATTACHED_AUTHENTICATION_SCHEMA,
  resolvePipelineApprovedCatalogAttachedAuthentication,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-approved-catalog-attached-authentication.js';

const branchInfo = Object.freeze({
  branchName: 'BR-REGISTRY', lineNo: 'PL-REGISTRY', jobName: 'JOB-REGISTRY', issueNo: 'A',
  caesarVersion: '11.00', boreMm: '114.3', wallThickness: '6.02',
  insulationThickness: '0', corrosionAllowance: '0', t1: '100', p1: '1000',
  hydroPressure: '1500', insulationDensity: '0', fluidDensity: '0.000965', materialCode: '1',
});
const exportContext = Object.freeze({
  schema: 'PipelineUtilityExportContext.v1',
  profile: Object.freeze({ resolvedMode: 'NORMAL' }),
  branchInfo,
});
const coordinateRows = Object.freeze([
  Object.freeze({ nodeNumber: 100, x: 0, y: 0, z: 0, nodeName: 'NODE-A', lineNo: 'PL-REGISTRY' }),
  Object.freeze({ nodeNumber: 110, x: 1000, y: 0, z: 0, nodeName: 'NODE-B', lineNo: 'PL-REGISTRY' }),
]);
const bendResolution = Object.freeze({
  errors: Object.freeze([]),
  bendByIncomingElementIndex: Object.freeze({}),
});
const approvedCatalogRegistry = Object.freeze({
  source: Object.freeze({
    registryId: 'P3D-CATALOG',
    title: 'Approved Pipeline Catalog',
    revision: 'R1',
    approvalReference: 'APPROVAL-P3D-R1',
    sha256: 'a'.repeat(64),
    caesarVersion: '14.00',
  }),
  pipingCodeEntries: Object.freeze([]),
  materialAllowableEntries: Object.freeze([]),
});
const builderInput = Object.freeze({ exportContext, coordinateRows, bendResolution });

const legacy = buildPipelineInputXmlDocumentPlan(builderInput);
assert.equal(legacy.ready, true);
assert.equal(Object.hasOwn(legacy, 'approvedCatalogAdoption'), false);
const legacyAgain = buildPipelineInputXmlDocumentPlan(structuredClone(builderInput));
assert.deepEqual(legacyAgain, legacy);

const explicitNull = buildPipelineInputXmlDocumentPlan({
  ...builderInput,
  approvedCatalogRegistry: null,
});
assert.deepEqual(explicitNull, legacy);
assert.equal(Object.hasOwn(explicitNull, 'approvedCatalogAdoption'), false);

const adopted = buildPipelineInputXmlDocumentPlan({
  ...builderInput,
  approvedCatalogRegistry,
});
assert.equal(adopted.ready, true);
assert.equal(adopted.approvedCatalogAdoption.ready, true);
assert.equal(adopted.approvedCatalogAdoption.bindingCount, 0);
assert.equal(adopted.approvedCatalogRegistryBindingPlan.bindingCount, 0);
assert.deepEqual(adopted.elements, legacy.elements);
assert.deepEqual(adopted.metadata, legacy.metadata);
assert.deepEqual(adopted.counts, legacy.counts);
assert.equal(Object.isFrozen(adopted), true);
assert.equal(Object.isFrozen(adopted.approvedCatalogRegistryPlan), true);

const authentication = resolvePipelineApprovedCatalogAttachedAuthentication(adopted);
assert.equal(authentication.schema, PIPELINE_APPROVED_CATALOG_ATTACHED_AUTHENTICATION_SCHEMA);
assert.equal(authentication.active, true);
assert.equal(authentication.ready, true);
assert.deepEqual(authentication.blockerCodes, []);
assert.equal(Object.isFrozen(authentication), true);

const legacyXml = buildInputXmlPipingModelXml(legacy);
const adoptedXml = buildInputXmlPipingModelXml(adopted);
assert.equal(adoptedXml, legacyXml);
assert.equal(Buffer.byteLength(adoptedXml), Buffer.byteLength(legacyXml));

const inactiveAuthentication = resolvePipelineApprovedCatalogAttachedAuthentication(legacy);
assert.equal(inactiveAuthentication.active, false);
assert.equal(inactiveAuthentication.ready, true);

function writerBlocked(plan, expectedBlocker) {
  const authenticationResult = resolvePipelineApprovedCatalogAttachedAuthentication(plan);
  assert.equal(authenticationResult.ready, false);
  assert.ok(authenticationResult.blockerCodes.includes(expectedBlocker),
    `${expectedBlocker} not found in ${authenticationResult.blockerCodes}`);
  assert.throws(() => buildInputXmlPipingModelXml(plan), (error) =>
    error.code === 'PIPELINE_INPUTXML_WRITER_BLOCKED'
      && error.blockerCodes.includes(expectedBlocker));
}

const forgedCount = structuredClone(adopted);
forgedCount.approvedCatalogAdoption.bindingCount = 1;
writerBlocked(forgedCount, 'PIPELINE_APPROVED_CATALOG_WRITER_BINDING_COUNT_INVALID');

const forgedReference = structuredClone(adopted);
forgedReference.approvedCatalogAdoption.registryReference = 'FORGED@R9#sha256:' + 'f'.repeat(64);
writerBlocked(forgedReference, 'PIPELINE_APPROVED_CATALOG_WRITER_REFERENCE_MISMATCH');

const partial = structuredClone(adopted);
delete partial.approvedCatalogRegistryBindingPlanSchema;
writerBlocked(partial, 'PIPELINE_APPROVED_CATALOG_WRITER_SCHEMA_REFERENCE_INVALID');

const forgedRegistryEntry = structuredClone(adopted);
forgedRegistryEntry.approvedCatalogRegistryPlan.source.approvalReference = 'FORGED-APPROVAL';
writerBlocked(forgedRegistryEntry,
  'PIPELINE_APPROVED_CATALOG_WRITER_ATTACHED_ANCESTRY_MISMATCH');

const malformedBinding = structuredClone(adopted);
malformedBinding.approvedCatalogRegistryBindingPlan.bindings.push({
  schema: 'PipelineApprovedCatalogRegistrySectionBinding.v1',
  kind: 'PIPING_CODE',
  authorityIndex: 0,
  analysisSectionId: 'AS1',
  catalogEntryId: 'MISSING',
  registryReference: adopted.approvedCatalogAdoption.registryReference,
  inlineCatalogEntry: {},
  registryEntry: {},
});
malformedBinding.approvedCatalogRegistryBindingPlan.bindingCount = 1;
malformedBinding.approvedCatalogRegistryBindingPlan.pipingCodeBindingCount = 1;
malformedBinding.approvedCatalogAdoption.bindingCount = 1;
writerBlocked(malformedBinding, 'PIPELINE_APPROVED_CATALOG_WRITER_BINDING_INVALID');

assert.deepEqual(adopted, buildPipelineInputXmlDocumentPlan({
  ...structuredClone(builderInput),
  approvedCatalogRegistry: structuredClone(approvedCatalogRegistry),
}));

console.log('pipeline-3d-model approved catalog builder/writer integration: PASS');
