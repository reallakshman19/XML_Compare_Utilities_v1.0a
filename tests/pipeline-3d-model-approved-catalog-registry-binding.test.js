import assert from 'node:assert/strict';
import {
  resolvePipelineApprovedCatalogRegistry,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-approved-catalog-registry.js';
import {
  PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_PLAN_SCHEMA,
  PIPELINE_APPROVED_CATALOG_REGISTRY_SECTION_BINDING_SCHEMA,
  resolvePipelineApprovedCatalogRegistryBindingPlan,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-approved-catalog-registry-binding.js';

const digest = (character) => character.repeat(64);
const piping = (id, code) => ({
  schema: 'PipelinePipingCodeCatalogEntry.v1', catalogEntryId: id,
  codeFamily: 'ASME B31.4', codeEdition: '2022', caesarVersion: '14.00',
  caesarPipingCode: code, sourceAuthority: 'CODE-SOURCE', sourceReference: `CODE-${code}`,
});
const material = (id, number, name) => ({
  schema: 'PipelineMaterialAllowableCatalogEntry.v1', catalogEntryId: id,
  codeFamily: 'ASME B31.4', codeEdition: '2022', caesarVersion: '14.00',
  materialNumber: number, materialName: name,
  values: { COLD_ALLOW: { disposition: 'VALUE', value: 1000 },
    SY: { disposition: 'VALUE', value: 1100 }, SU: { disposition: 'SENTINEL', value: null } },
  sourceAuthority: 'MAT-SOURCE', sourceReference: 'MAT-R1',
  cases: [{ schema: 'PipelineAllowableValueCaseAuthority.v1', num: 1, temperature: 100,
    values: { HOT_ALLOW: { disposition: 'VALUE', value: 900 },
      HOT_SY: { disposition: 'VALUE', value: 1000 },
      HOT_SU: { disposition: 'ZERO', value: 0 } },
    sourceAuthority: 'MAT-SOURCE', sourceReference: 'MAT-R1' }],
});

const sharedPiping = piping('SHARED-ID', 202);
const extraPiping = piping('UNUSED-CODE', 303);
const sharedMaterial = material('SHARED-ID', 5, 'PIPELINE STEEL');
const secondMaterial = material('MAT-SECOND', 106, 'A106 B');
const extraMaterial = material('UNUSED-MAT', 7, 'UNUSED');
const registryPlan = resolvePipelineApprovedCatalogRegistry({
  source: { registryId: 'APPROVED-CATALOG', title: 'Approved Pipeline Catalog', revision: 'R1',
    approvalReference: 'APP-REG-001', sha256: digest('a'), caesarVersion: '14.00' },
  pipingCodeEntries: [extraPiping, sharedPiping],
  materialAllowableEntries: [extraMaterial, secondMaterial, sharedMaterial],
});
assert.equal(registryPlan.ready, true);

const pipingAuthority = (section) => ({
  analysisSectionId: section, catalogEntryId: sharedPiping.catalogEntryId,
  catalogEntry: structuredClone(sharedPiping),
});
const materialAuthority = (section, entry) => ({
  analysisSectionId: section, catalogEntryId: entry.catalogEntryId,
  catalogEntry: structuredClone(entry),
});
const pipingCodeAuthorityPlan = {
  schema: 'PipelinePipingCodeAuthorityPlan.v1', active: true, ready: true, blockerCodes: [],
  authorities: [pipingAuthority('AS2'), pipingAuthority('AS1')],
};
const allowableValueAuthorityPlan = {
  schema: 'PipelineAllowableValueAuthorityPlan.v1', active: true, ready: true, blockerCodes: [],
  authorities: [materialAuthority('AS3', secondMaterial), materialAuthority('AS1', sharedMaterial)],
};
const resolve = (overrides = {}) => resolvePipelineApprovedCatalogRegistryBindingPlan({
  registryPlan, pipingCodeAuthorityPlan, allowableValueAuthorityPlan, ...overrides,
});

const plan = resolve();
assert.equal(plan.schema, PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_PLAN_SCHEMA);
assert.equal(plan.ready, true);
assert.equal(plan.active, true);
assert.equal(plan.bindingCount, 4);
assert.equal(plan.pipingCodeBindingCount, 2);
assert.equal(plan.materialAllowableBindingCount, 2);
assert.deepEqual(plan.bindings.map((item) => `${item.kind}:${item.analysisSectionId}`), [
  'PIPING_CODE:AS1', 'PIPING_CODE:AS2', 'MATERIAL_ALLOWABLE:AS1', 'MATERIAL_ALLOWABLE:AS3',
]);
assert.equal(plan.bindings[0].schema,
  PIPELINE_APPROVED_CATALOG_REGISTRY_SECTION_BINDING_SCHEMA);
assert.equal(plan.bindings[0].registryReference, registryPlan.registryReference);
assert.deepEqual(plan.bindings[0].inlineCatalogEntry, plan.bindings[0].registryEntry);
assert.equal(plan.bindings[0].catalogEntryId, 'SHARED-ID');
assert.equal(plan.bindings[2].catalogEntryId, 'SHARED-ID');
assert.equal(Object.isFrozen(plan), true);
assert.equal(Object.isFrozen(plan.registrySource), true);
assert.equal(Object.isFrozen(plan.bindings[0].registryEntry), true);
assert.equal(Object.isFrozen(plan.bindings[2].inlineCatalogEntry.cases), true);
assert.deepEqual(plan, resolve({
  registryPlan: structuredClone(registryPlan),
  pipingCodeAuthorityPlan: structuredClone(pipingCodeAuthorityPlan),
  allowableValueAuthorityPlan: structuredClone(allowableValueAuthorityPlan),
}));

const onlyPiping = resolvePipelineApprovedCatalogRegistryBindingPlan({
  registryPlan, pipingCodeAuthorityPlan,
});
assert.equal(onlyPiping.ready, true);
assert.equal(onlyPiping.bindingCount, 2);

const registryOnly = resolvePipelineApprovedCatalogRegistryBindingPlan({ registryPlan });
assert.equal(registryOnly.ready, true);
assert.equal(registryOnly.bindingCount, 0);

const missingRegistry = resolvePipelineApprovedCatalogRegistryBindingPlan({
  pipingCodeAuthorityPlan,
});
assert.equal(missingRegistry.ready, false);
assert.ok(missingRegistry.blockerCodes.includes(
  'PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_REGISTRY_REQUIRED'));

const invalidRegistry = resolve({ registryPlan: { ...registryPlan, ready: false } });
assert.equal(invalidRegistry.ready, false);
assert.ok(invalidRegistry.blockerCodes.includes(
  'PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_REGISTRY_INVALID'));

const invalidPlan = resolve({
  pipingCodeAuthorityPlan: { ...pipingCodeAuthorityPlan, schema: 'Wrong.v1' },
});
assert.equal(invalidPlan.ready, false);
assert.ok(invalidPlan.blockerCodes.includes(
  'PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_AUTHORITY_PLAN_INVALID'));

const missingEntryPlan = structuredClone(pipingCodeAuthorityPlan);
missingEntryPlan.authorities[0].catalogEntryId = 'MISSING';
missingEntryPlan.authorities[0].catalogEntry.catalogEntryId = 'MISSING';
const missingEntry = resolve({ pipingCodeAuthorityPlan: missingEntryPlan });
assert.equal(missingEntry.ready, false);
assert.ok(missingEntry.blockerCodes.includes(
  'PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_ENTRY_MISSING'));

const mismatchedPlan = structuredClone(pipingCodeAuthorityPlan);
mismatchedPlan.authorities[0].catalogEntry.caesarPipingCode = 999;
const mismatchedEntry = resolve({ pipingCodeAuthorityPlan: mismatchedPlan });
assert.equal(mismatchedEntry.ready, false);
assert.ok(mismatchedEntry.blockerCodes.includes(
  'PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_ENTRY_MISMATCH'));

const invalidAuthority = structuredClone(pipingCodeAuthorityPlan);
delete invalidAuthority.authorities[0].analysisSectionId;
const invalidAuthorityResult = resolve({ pipingCodeAuthorityPlan: invalidAuthority });
assert.equal(invalidAuthorityResult.ready, false);
assert.ok(invalidAuthorityResult.blockerCodes.includes(
  'PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_AUTHORITY_INVALID'));

const duplicateSectionPlan = structuredClone(pipingCodeAuthorityPlan);
duplicateSectionPlan.authorities[1].analysisSectionId = duplicateSectionPlan.authorities[0].analysisSectionId;
const duplicateSection = resolve({ pipingCodeAuthorityPlan: duplicateSectionPlan });
assert.equal(duplicateSection.ready, false);
assert.ok(duplicateSection.blockerCodes.includes(
  'PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_SECTION_DUPLICATE'));

const inactive = resolvePipelineApprovedCatalogRegistryBindingPlan();
assert.equal(inactive.active, false);
assert.equal(inactive.ready, true);
assert.deepEqual(inactive.bindings, []);

console.log('pipeline-3d-model approved catalog registry binding: PASS');
