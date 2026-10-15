import assert from 'node:assert/strict';
import {
  PIPELINE_APPROVED_CATALOG_REGISTRY_SCHEMA,
  PIPELINE_APPROVED_CATALOG_REGISTRY_SOURCE_SCHEMA,
  approvedCatalogRegistryReferenceKey,
  buildPipelineApprovedCatalogRegistryJson,
  resolvePipelineApprovedCatalogRegistry,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-approved-catalog-registry.js';

const digest = (character) => character.repeat(64);
const source = {
  registryId: 'P3D-APPROVED-CATALOG',
  title: 'Pipeline 3D Approved CAESAR Catalog',
  revision: 'R1',
  approvalReference: 'ENG-APPROVAL-001',
  sha256: digest('A'),
  caesarVersion: '14.00',
};
const piping = (catalogEntryId, code) => ({
  schema: 'PipelinePipingCodeCatalogEntry.v1',
  catalogEntryId,
  codeFamily: 'PROJECT-CODE',
  codeEdition: 'DB-R1',
  caesarVersion: '14.00',
  caesarPipingCode: code,
  sourceAuthority: 'PROJECT-BASIS',
  sourceReference: 'PROJECT-BASIS@R1',
});
const material = (catalogEntryId, materialNumber) => ({
  schema: 'PipelineMaterialAllowableCatalogEntry.v1',
  catalogEntryId,
  codeFamily: 'PROJECT-CODE',
  codeEdition: 'DB-R1',
  caesarVersion: '14.00',
  materialNumber,
  materialName: `MATERIAL-${materialNumber}`,
  values: {
    COLD_ALLOW: { disposition: 'VALUE', value: 1000 },
    SY: { disposition: 'VALUE', value: 1100 },
    SU: { disposition: 'VALUE', value: 1200 },
  },
  sourceAuthority: 'APPROVED-MATERIAL-SHEET',
  sourceReference: 'APPROVED-MATERIAL-SHEET@R1',
  cases: [{
    schema: 'PipelineAllowableValueCaseAuthority.v1',
    num: 1,
    temperature: 100,
    values: {
      HOT_ALLOW: { disposition: 'VALUE', value: 900 },
      HOT_SY: { disposition: 'VALUE', value: 1000 },
      HOT_SU: { disposition: 'VALUE', value: 1100 },
    },
    sourceAuthority: 'APPROVED-MATERIAL-SHEET',
    sourceReference: 'APPROVED-MATERIAL-SHEET@R1',
  }],
});
const registry = {
  source,
  pipingCodeEntries: [piping('Z-CODE', 303), piping('A-CODE', 101), piping('SHARED-ID', 202)],
  materialAllowableEntries: [material('Z-MAT', 5), material('A-MAT', 1), material('SHARED-ID', 9)],
};

const plan = resolvePipelineApprovedCatalogRegistry(registry);
assert.equal(plan.schema, PIPELINE_APPROVED_CATALOG_REGISTRY_SCHEMA);
assert.equal(plan.ready, true);
assert.equal(plan.active, true);
assert.equal(plan.source.schema, PIPELINE_APPROVED_CATALOG_REGISTRY_SOURCE_SCHEMA);
assert.equal(plan.source.sha256, digest('a'));
assert.equal(plan.registryReference, 'P3D-APPROVED-CATALOG@R1#sha256:' + digest('a'));
assert.equal(plan.registryReference, approvedCatalogRegistryReferenceKey(source));
assert.equal(plan.entryCount, 6);
assert.equal(plan.pipingCodeEntryCount, 3);
assert.equal(plan.materialAllowableEntryCount, 3);
assert.deepEqual(plan.pipingCodeEntries.map((item) => item.catalogEntryId),
  ['A-CODE', 'SHARED-ID', 'Z-CODE']);
assert.deepEqual(plan.materialAllowableEntries.map((item) => item.catalogEntryId),
  ['A-MAT', 'SHARED-ID', 'Z-MAT']);
assert.equal(Object.isFrozen(plan), true);
assert.equal(Object.isFrozen(plan.source), true);
assert.equal(Object.isFrozen(plan.materialAllowableEntries[0].values), true);
assert.equal(Object.isFrozen(registry.pipingCodeEntries[0]), false);
assert.deepEqual(plan, resolvePipelineApprovedCatalogRegistry(structuredClone(registry)));
assert.equal(buildPipelineApprovedCatalogRegistryJson(plan),
  buildPipelineApprovedCatalogRegistryJson(resolvePipelineApprovedCatalogRegistry({
    ...structuredClone(registry),
    pipingCodeEntries: structuredClone(registry.pipingCodeEntries).reverse(),
    materialAllowableEntries: structuredClone(registry.materialAllowableEntries).reverse(),
  })));

function blocked(value, code) {
  const result = resolvePipelineApprovedCatalogRegistry(value);
  assert.equal(result.ready, false);
  assert.ok(result.blockerCodes.includes(code), `${code} not found in ${result.blockerCodes}`);
}

const duplicatePiping = structuredClone(registry);
duplicatePiping.pipingCodeEntries.push(structuredClone(duplicatePiping.pipingCodeEntries[0]));
blocked(duplicatePiping, 'PIPELINE_APPROVED_CATALOG_REGISTRY_ENTRY_ID_DUPLICATE');
const duplicateMaterial = structuredClone(registry);
duplicateMaterial.materialAllowableEntries.push(structuredClone(duplicateMaterial.materialAllowableEntries[0]));
blocked(duplicateMaterial, 'PIPELINE_APPROVED_CATALOG_REGISTRY_ENTRY_ID_DUPLICATE');
const wrongSchema = structuredClone(registry);
wrongSchema.pipingCodeEntries[0].schema = 'Wrong.v1';
blocked(wrongSchema, 'PIPELINE_APPROVED_CATALOG_REGISTRY_ENTRY_INVALID');
const missingId = structuredClone(registry);
missingId.materialAllowableEntries[0].catalogEntryId = '';
blocked(missingId, 'PIPELINE_APPROVED_CATALOG_REGISTRY_ENTRY_INVALID');
const badDigest = structuredClone(registry);
badDigest.source.sha256 = 'bad';
blocked(badDigest, 'PIPELINE_APPROVED_CATALOG_REGISTRY_SOURCE_SHA256_INVALID');
const wrongVersion = structuredClone(registry);
wrongVersion.source.caesarVersion = '13.00';
blocked(wrongVersion, 'PIPELINE_APPROVED_CATALOG_REGISTRY_VERSION_INVALID');
const missingTitle = structuredClone(registry);
missingTitle.source.title = '';
blocked(missingTitle, 'PIPELINE_APPROVED_CATALOG_REGISTRY_SOURCE_FIELD_INVALID');
const invalidPipingArray = structuredClone(registry);
invalidPipingArray.pipingCodeEntries = {};
blocked(invalidPipingArray, 'PIPELINE_APPROVED_CATALOG_REGISTRY_PIPING_ENTRIES_INVALID');
const invalidMaterialArray = structuredClone(registry);
invalidMaterialArray.materialAllowableEntries = null;
blocked(invalidMaterialArray, 'PIPELINE_APPROVED_CATALOG_REGISTRY_MATERIAL_ENTRIES_INVALID');
blocked([], 'PIPELINE_APPROVED_CATALOG_REGISTRY_INVALID');

const inactive = resolvePipelineApprovedCatalogRegistry();
assert.equal(inactive.active, false);
assert.equal(inactive.ready, true);
assert.equal(inactive.entryCount, 0);
assert.deepEqual(inactive.pipingCodeEntries, []);
assert.deepEqual(inactive.materialAllowableEntries, []);

console.log('pipeline-3d-model approved catalog registry: PASS');
