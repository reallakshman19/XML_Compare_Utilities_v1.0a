import assert from 'node:assert/strict';
import {
  PIPELINE_APPROVED_CATALOG_DOCUMENT_ADOPTION_SCHEMA,
  adoptPipelineApprovedCatalogRegistryIntoInputXmlDocumentPlan,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-approved-catalog-document.js';

const pipingEntry = Object.freeze({
  schema: 'PipelinePipingCodeCatalogEntry.v1',
  catalogEntryId: 'CODE-SHARED-R1',
  codeFamily: 'PROJECT-CODE',
  codeEdition: 'R1',
  caesarVersion: '14.00',
  caesarPipingCode: 101,
  sourceAuthority: 'PROJECT-BASIS',
  sourceReference: 'PROJECT-BASIS@R1',
});
const materialEntry = Object.freeze({
  schema: 'PipelineMaterialAllowableCatalogEntry.v1',
  catalogEntryId: 'MAT-SHARED-R1',
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
  schema: 'PipelinePipingCodeAuthorityPlan.v1',
  active: true,
  ready: true,
  blockerCodes: Object.freeze([]),
  authorities: Object.freeze([
    Object.freeze({
      authorityIndex: 0,
      analysisSectionId: 'AS1',
      catalogEntryId: pipingEntry.catalogEntryId,
      catalogEntry: pipingEntry,
    }),
  ]),
});
const allowableValueAuthorityPlan = Object.freeze({
  schema: 'PipelineAllowableValueAuthorityPlan.v1',
  active: true,
  ready: true,
  blockerCodes: Object.freeze([]),
  authorities: Object.freeze([
    Object.freeze({
      authorityIndex: 0,
      analysisSectionId: 'AS1',
      catalogEntryId: materialEntry.catalogEntryId,
      catalogEntry: materialEntry,
    }),
  ]),
});

function documentPlan(overrides = {}) {
  return Object.freeze({
    schema: 'PipelineInputXmlDocumentPlan.v1',
    namespace: 'COADE',
    version: '14.00',
    metadata: Object.freeze({ jobName: 'TEST' }),
    counts: Object.freeze({ numElt: 1, numAllow: 1 }),
    elements: Object.freeze([
      Object.freeze({ id: 'E1', fromNode: 100, toNode: 110,
        allowableStress: Object.freeze({ attributes: Object.freeze({ PIPING_CODE: 101 }) }) }),
    ]),
    pipingCodeAuthorityPlan,
    allowableValueAuthorityPlan,
    diagnostics: Object.freeze([]),
    blockerCodes: Object.freeze([]),
    ready: true,
    ...overrides,
  });
}

const base = documentPlan();
const adopted = adoptPipelineApprovedCatalogRegistryIntoInputXmlDocumentPlan({
  documentPlan: base,
  approvedCatalogRegistry: registry,
});
assert.equal(adopted.schema, 'PipelineInputXmlDocumentPlan.v1');
assert.equal(adopted.ready, true);
assert.equal(adopted.approvedCatalogAdoption.schema,
  PIPELINE_APPROVED_CATALOG_DOCUMENT_ADOPTION_SCHEMA);
assert.equal(adopted.approvedCatalogAdoption.registryReady, true);
assert.equal(adopted.approvedCatalogAdoption.bindingReady, true);
assert.equal(adopted.approvedCatalogAdoption.bindingCount, 2);
assert.equal(adopted.approvedCatalogRegistryPlan.ready, true);
assert.equal(adopted.approvedCatalogRegistryBindingPlan.ready, true);
assert.equal(adopted.approvedCatalogRegistryBindingPlan.bindingCount, 2);
assert.deepEqual(adopted.elements, base.elements);
assert.deepEqual(adopted.metadata, base.metadata);
assert.deepEqual(adopted.counts, base.counts);
assert.deepEqual(adopted.pipingCodeAuthorityPlan, base.pipingCodeAuthorityPlan);
assert.deepEqual(adopted.allowableValueAuthorityPlan, base.allowableValueAuthorityPlan);
assert.equal(Object.isFrozen(adopted), true);
assert.equal(Object.isFrozen(adopted.approvedCatalogRegistryBindingPlan.bindings[0].registryEntry), true);
assert.deepEqual(adopted, adoptPipelineApprovedCatalogRegistryIntoInputXmlDocumentPlan({
  documentPlan: structuredClone(base),
  approvedCatalogRegistry: structuredClone(registry),
}));

const missingRegistry = adoptPipelineApprovedCatalogRegistryIntoInputXmlDocumentPlan({
  documentPlan: base,
});
assert.equal(missingRegistry.ready, false);
assert.ok(missingRegistry.blockerCodes.includes(
  'PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_REGISTRY_REQUIRED'));

const mismatchedRegistry = structuredClone(registry);
mismatchedRegistry.pipingCodeEntries[0].caesarPipingCode = 999;
const mismatch = adoptPipelineApprovedCatalogRegistryIntoInputXmlDocumentPlan({
  documentPlan: base,
  approvedCatalogRegistry: mismatchedRegistry,
});
assert.equal(mismatch.ready, false);
assert.ok(mismatch.blockerCodes.includes(
  'PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_ENTRY_MISMATCH'));

const missingEntryRegistry = structuredClone(registry);
missingEntryRegistry.materialAllowableEntries = [];
const missingEntry = adoptPipelineApprovedCatalogRegistryIntoInputXmlDocumentPlan({
  documentPlan: base,
  approvedCatalogRegistry: missingEntryRegistry,
});
assert.equal(missingEntry.ready, false);
assert.ok(missingEntry.blockerCodes.includes(
  'PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_ENTRY_MISSING'));

const blockedBase = documentPlan({
  diagnostics: Object.freeze([{ severity: 'BLOCKING', code: 'BASE_BLOCKER', details: {} }]),
  blockerCodes: Object.freeze(['BASE_BLOCKER']),
  ready: false,
});
const blocked = adoptPipelineApprovedCatalogRegistryIntoInputXmlDocumentPlan({
  documentPlan: blockedBase,
  approvedCatalogRegistry: registry,
});
assert.equal(blocked.ready, false);
assert.ok(blocked.blockerCodes.includes('BASE_BLOCKER'));
assert.equal(blocked.approvedCatalogRegistryBindingPlan.ready, true);

const noAuthorities = documentPlan({
  pipingCodeAuthorityPlan: null,
  allowableValueAuthorityPlan: null,
  elements: Object.freeze([]),
});
assert.equal(adoptPipelineApprovedCatalogRegistryIntoInputXmlDocumentPlan({
  documentPlan: noAuthorities,
}), noAuthorities);
const registryOnly = adoptPipelineApprovedCatalogRegistryIntoInputXmlDocumentPlan({
  documentPlan: noAuthorities,
  approvedCatalogRegistry: registry,
});
assert.equal(registryOnly.ready, true);
assert.equal(registryOnly.approvedCatalogRegistryBindingPlan.bindingCount, 0);
assert.equal(registryOnly.approvedCatalogAdoption.active, true);

const invalid = adoptPipelineApprovedCatalogRegistryIntoInputXmlDocumentPlan({
  documentPlan: { schema: 'Wrong.v1' },
  approvedCatalogRegistry: registry,
});
assert.equal(invalid.ready, false);
assert.ok(invalid.blockerCodes.includes('PIPELINE_APPROVED_CATALOG_DOCUMENT_INVALID'));

const sharedPiping = { ...pipingEntry, catalogEntryId: 'SHARED-ID' };
const sharedMaterial = { ...materialEntry, catalogEntryId: 'SHARED-ID' };
const sharedDocument = documentPlan({
  pipingCodeAuthorityPlan: Object.freeze({ ...pipingCodeAuthorityPlan,
    authorities: Object.freeze([Object.freeze({ analysisSectionId: 'AS1',
      catalogEntryId: 'SHARED-ID', catalogEntry: Object.freeze(sharedPiping) })]) }),
  allowableValueAuthorityPlan: Object.freeze({ ...allowableValueAuthorityPlan,
    authorities: Object.freeze([Object.freeze({ analysisSectionId: 'AS1',
      catalogEntryId: 'SHARED-ID', catalogEntry: Object.freeze(sharedMaterial) })]) }),
});
const shared = adoptPipelineApprovedCatalogRegistryIntoInputXmlDocumentPlan({
  documentPlan: sharedDocument,
  approvedCatalogRegistry: {
    source: structuredClone(registry.source),
    pipingCodeEntries: [sharedPiping],
    materialAllowableEntries: [sharedMaterial],
  },
});
assert.equal(shared.ready, true);
assert.equal(shared.approvedCatalogRegistryBindingPlan.bindingCount, 2);
assert.deepEqual(shared.approvedCatalogRegistryBindingPlan.bindings.map((item) => item.kind),
  ['PIPING_CODE', 'MATERIAL_ALLOWABLE']);

console.log('pipeline-3d-model approved catalog document adoption: PASS');
