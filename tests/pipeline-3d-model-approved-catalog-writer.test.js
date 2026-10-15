import assert from 'node:assert/strict';
import {
  PIPELINE_APPROVED_CATALOG_WRITER_QUALIFICATION_SCHEMA,
  buildPipelineApprovedCatalogQualifiedInputXml,
  resolvePipelineApprovedCatalogWriterQualification,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-approved-catalog-writer.js';
import { buildInputXmlPipingModelXml } from '../tabs/pipeline-3d-model/pipeline-3d-model-xml-builder.js';

const pipingEntry = Object.freeze({
  schema: 'PipelinePipingCodeCatalogEntry.v1',
  catalogEntryId: 'CODE-R1',
  codeFamily: 'PROJECT-CODE',
  codeEdition: 'R1',
  caesarVersion: '14.00',
  caesarPipingCode: 101,
  sourceAuthority: 'PROJECT-BASIS',
  sourceReference: 'PROJECT-BASIS@R1',
});
const materialEntry = Object.freeze({
  schema: 'PipelineMaterialAllowableCatalogEntry.v1',
  catalogEntryId: 'MAT-R1',
  codeFamily: 'PROJECT-CODE',
  codeEdition: 'R1',
  caesarVersion: '14.00',
  materialNumber: 1,
  materialName: 'TEST MATERIAL',
  values: Object.freeze({
    COLD_ALLOW: Object.freeze({ disposition: 'VALUE', value: 1000 }),
    SY: Object.freeze({ disposition: 'VALUE', value: 1100 }),
    SU: Object.freeze({ disposition: 'VALUE', value: 1200 }),
  }),
  sourceAuthority: 'MATERIAL-SHEET',
  sourceReference: 'MATERIAL-SHEET@R1',
  cases: Object.freeze([]),
});
const registry = Object.freeze({
  source: Object.freeze({
    registryId: 'P3D-CATALOG',
    title: 'Approved Pipeline Catalog',
    revision: 'R1',
    approvalReference: 'APPROVAL-P3D-R1',
    sha256: 'a'.repeat(64),
    caesarVersion: '14.00',
  }),
  pipingCodeEntries: Object.freeze([pipingEntry]),
  materialAllowableEntries: Object.freeze([materialEntry]),
});
const pipingCodeAuthorityPlan = Object.freeze({
  schema: 'PipelinePipingCodeAuthorityPlan.v1', active: true, ready: true,
  diagnostics: Object.freeze([]), blockerCodes: Object.freeze([]),
  authorities: Object.freeze([Object.freeze({
    authorityIndex: 0, analysisSectionId: 'AS1',
    catalogEntryId: pipingEntry.catalogEntryId, catalogEntry: pipingEntry,
  })]),
});
const allowableValueAuthorityPlan = Object.freeze({
  schema: 'PipelineAllowableValueAuthorityPlan.v1', active: true, ready: true,
  diagnostics: Object.freeze([]), blockerCodes: Object.freeze([]),
  authorities: Object.freeze([Object.freeze({
    authorityIndex: 0, analysisSectionId: 'AS1',
    catalogEntryId: materialEntry.catalogEntryId, catalogEntry: materialEntry,
  })]),
});
const zeroCounts = Object.freeze({
  numElt: 0, numNoz: 0, noHgrs: 0, numBend: 0, numRigid: 0,
  numExpJnt: 0, numRest: 0, numForcMnt: 0, numUnfLoad: 0,
  numWind: 0, numEleOff: 0, numAllow: 0, numISect: 0,
});
const metadata = Object.freeze({
  caesarVersion: '14.00', jobName: 'TEST', issueNo: '', timeText: '',
  northX: 0, northY: 1, northZ: 0,
});
function documentPlan(overrides = {}) {
  return Object.freeze({
    schema: 'PipelineInputXmlDocumentPlan.v1',
    namespace: 'COADE',
    extensionNamespace: 'urn:reallaksh19:inputxml:extension:v1',
    xmlType: 'Input', version: '14.00', metadata, counts: zeroCounts,
    elements: Object.freeze([]),
    pipingCodeAuthorityPlan,
    allowableValueAuthorityPlan,
    diagnostics: Object.freeze([]), blockerCodes: Object.freeze([]), ready: true,
    ...overrides,
  });
}

const base = documentPlan();
const valid = resolvePipelineApprovedCatalogWriterQualification({
  documentPlan: base, approvedCatalogRegistry: registry,
});
assert.equal(valid.schema, PIPELINE_APPROVED_CATALOG_WRITER_QUALIFICATION_SCHEMA);
assert.equal(valid.active, true);
assert.equal(valid.ready, true);
assert.equal(valid.bindingCount, 2);
assert.equal(valid.documentPlan.approvedCatalogAdoption.ready, true);
assert.equal(valid.documentPlan.approvedCatalogRegistryPlan.ready, true);
assert.equal(valid.documentPlan.approvedCatalogRegistryBindingPlan.ready, true);
assert.equal(Object.isFrozen(valid), true);
assert.equal(Object.isFrozen(valid.documentPlan), true);
assert.equal(Object.isFrozen(valid.documentPlan.approvedCatalogRegistryBindingPlan.bindings[0]), true);
assert.deepEqual(valid, resolvePipelineApprovedCatalogWriterQualification({
  documentPlan: structuredClone(base),
  approvedCatalogRegistry: structuredClone(registry),
}));

const attachedValid = resolvePipelineApprovedCatalogWriterQualification({
  documentPlan: valid.documentPlan, approvedCatalogRegistry: registry,
});
assert.equal(attachedValid.ready, true);
assert.deepEqual(attachedValid.documentPlan.approvedCatalogAdoption,
  valid.documentPlan.approvedCatalogAdoption);

const missing = resolvePipelineApprovedCatalogWriterQualification({ documentPlan: base });
assert.equal(missing.ready, false);
assert.ok(missing.blockerCodes.includes(
  'PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_REGISTRY_REQUIRED'));
assert.ok(missing.blockerCodes.includes('PIPELINE_APPROVED_CATALOG_WRITER_ADOPTION_INVALID'));

const mismatchRegistry = structuredClone(registry);
mismatchRegistry.pipingCodeEntries[0].caesarPipingCode = 999;
const mismatch = resolvePipelineApprovedCatalogWriterQualification({
  documentPlan: base, approvedCatalogRegistry: mismatchRegistry,
});
assert.equal(mismatch.ready, false);
assert.ok(mismatch.blockerCodes.includes(
  'PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_ENTRY_MISMATCH'));

const noAuthorities = documentPlan({
  pipingCodeAuthorityPlan: null,
  allowableValueAuthorityPlan: null,
});
const inactive = resolvePipelineApprovedCatalogWriterQualification({ documentPlan: noAuthorities });
assert.equal(inactive.active, false);
assert.equal(inactive.ready, true);
assert.equal(inactive.documentPlan, noAuthorities);
assert.equal(inactive.bindingCount, 0);

const registryOnly = resolvePipelineApprovedCatalogWriterQualification({
  documentPlan: noAuthorities, approvedCatalogRegistry: registry,
});
assert.equal(registryOnly.active, true);
assert.equal(registryOnly.ready, true);
assert.equal(registryOnly.bindingCount, 0);
assert.equal(registryOnly.documentPlan.approvedCatalogAdoption.ready, true);
const legacyXml = buildInputXmlPipingModelXml(noAuthorities);
const qualifiedXml = buildPipelineApprovedCatalogQualifiedInputXml({
  documentPlan: noAuthorities, approvedCatalogRegistry: registry,
});
assert.equal(qualifiedXml, legacyXml);
assert.equal(Buffer.byteLength(qualifiedXml), Buffer.byteLength(legacyXml));

const blockedBase = documentPlan({
  diagnostics: Object.freeze([{ severity: 'BLOCKING', code: 'BASE_BLOCKER', details: {} }]),
  blockerCodes: Object.freeze(['BASE_BLOCKER']),
  ready: false,
});
const blocked = resolvePipelineApprovedCatalogWriterQualification({
  documentPlan: blockedBase, approvedCatalogRegistry: registry,
});
assert.equal(blocked.ready, false);
assert.ok(blocked.blockerCodes.includes('BASE_BLOCKER'));

const forgedAdoption = structuredClone(valid.documentPlan);
forgedAdoption.approvedCatalogAdoption.bindingCount = 99;
const forgedAdoptionResult = resolvePipelineApprovedCatalogWriterQualification({
  documentPlan: forgedAdoption, approvedCatalogRegistry: registry,
});
assert.equal(forgedAdoptionResult.ready, false);
assert.ok(forgedAdoptionResult.blockerCodes.includes(
  'PIPELINE_APPROVED_CATALOG_WRITER_ATTACHED_ANCESTRY_MISMATCH'));
assert.ok(forgedAdoptionResult.blockerCodes.includes(
  'PIPELINE_APPROVED_CATALOG_WRITER_BINDING_COUNT_INVALID'));

const forgedBinding = structuredClone(valid.documentPlan);
forgedBinding.approvedCatalogRegistryBindingPlan.bindings[0].authorityIndex = 7;
const forgedBindingResult = resolvePipelineApprovedCatalogWriterQualification({
  documentPlan: forgedBinding, approvedCatalogRegistry: registry,
});
assert.equal(forgedBindingResult.ready, false);
assert.ok(forgedBindingResult.blockerCodes.includes(
  'PIPELINE_APPROVED_CATALOG_WRITER_ATTACHED_ANCESTRY_MISMATCH'));
assert.ok(forgedBindingResult.blockerCodes.includes(
  'PIPELINE_APPROVED_CATALOG_WRITER_BINDING_INVALID'));
assert.ok(forgedBindingResult.blockerCodes.includes(
  'PIPELINE_APPROVED_CATALOG_WRITER_BINDING_COVERAGE_INVALID'));

const duplicateBinding = structuredClone(valid.documentPlan);
duplicateBinding.approvedCatalogRegistryBindingPlan.bindings.push(
  structuredClone(duplicateBinding.approvedCatalogRegistryBindingPlan.bindings[0]));
duplicateBinding.approvedCatalogRegistryBindingPlan.bindingCount = 3;
duplicateBinding.approvedCatalogRegistryBindingPlan.pipingCodeBindingCount = 2;
duplicateBinding.approvedCatalogAdoption.bindingCount = 3;
const duplicateResult = resolvePipelineApprovedCatalogWriterQualification({
  documentPlan: duplicateBinding, approvedCatalogRegistry: registry,
});
assert.equal(duplicateResult.ready, false);
assert.ok(duplicateResult.blockerCodes.includes(
  'PIPELINE_APPROVED_CATALOG_WRITER_BINDING_DUPLICATE'));
assert.ok(duplicateResult.blockerCodes.includes(
  'PIPELINE_APPROVED_CATALOG_WRITER_BINDING_COVERAGE_INVALID'));

const wrongNamespace = structuredClone(valid.documentPlan);
wrongNamespace.approvedCatalogRegistryBindingPlan.bindings[0].kind = 'MATERIAL_ALLOWABLE';
wrongNamespace.approvedCatalogRegistryBindingPlan.pipingCodeBindingCount = 0;
wrongNamespace.approvedCatalogRegistryBindingPlan.materialAllowableBindingCount = 2;
const wrongNamespaceResult = resolvePipelineApprovedCatalogWriterQualification({
  documentPlan: wrongNamespace, approvedCatalogRegistry: registry,
});
assert.equal(wrongNamespaceResult.ready, false);
assert.ok(wrongNamespaceResult.blockerCodes.includes(
  'PIPELINE_APPROVED_CATALOG_WRITER_BINDING_INVALID'));

const partial = structuredClone(noAuthorities);
partial.approvedCatalogAdoption = structuredClone(valid.documentPlan.approvedCatalogAdoption);
const partialResult = resolvePipelineApprovedCatalogWriterQualification({
  documentPlan: partial, approvedCatalogRegistry: registry,
});
assert.equal(partialResult.ready, false);
assert.ok(partialResult.blockerCodes.includes(
  'PIPELINE_APPROVED_CATALOG_WRITER_SCHEMA_REFERENCE_INVALID'));
assert.ok(partialResult.blockerCodes.includes(
  'PIPELINE_APPROVED_CATALOG_WRITER_ATTACHED_ANCESTRY_MISMATCH'));

assert.throws(() => buildPipelineApprovedCatalogQualifiedInputXml({
  documentPlan: forgedBinding, approvedCatalogRegistry: registry,
}), (error) => error.blockerCodes.includes(
  'PIPELINE_APPROVED_CATALOG_WRITER_ATTACHED_ANCESTRY_MISMATCH'));

const builderInput = resolvePipelineApprovedCatalogWriterQualification({ documentInput: {} });
assert.equal(builderInput.documentPlan.schema, 'PipelineInputXmlDocumentPlan.v1');
assert.equal(builderInput.ready, false);

console.log('pipeline-3d-model approved catalog writer qualification: PASS');
