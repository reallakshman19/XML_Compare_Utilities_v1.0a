import assert from 'node:assert/strict';
import {
  PIPELINE_ALLOWABLE_VALUE_AUTHORITY_PLAN_SCHEMA,
  PIPELINE_CODE_SOURCE_AUTHORITY_SCHEMA,
  PIPELINE_MATERIAL_ALLOWABLE_CATALOG_ENTRY_SCHEMA,
  approvedSourceReferenceKey,
  resolvePipelineAllowableValueAuthorityPlan,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-allowable-value-authority.js';

const digest = (character) => character.repeat(64);
const source = (sourceId, title, revision, character) => ({
  sourceId, title, revision, approvalReference: `APPROVAL-${sourceId}-${revision}`,
  sha256: digest(character),
});
const codeSources = [
  source('DB', 'Project Design Basis', 'R1', 'a'),
  source('B314', 'ASME B31.4 Selection Record', '2022', 'b'),
];
const allowableSource = source('MAT-SHEET', 'Approved Material Sheet', 'R3', 'c');
const profileAuthorityPlan = Object.freeze({
  schema: 'PipelineInputXmlProfileAuthorityPlan.v1', ready: true, blockerCodes: Object.freeze([]),
  sectionAuthorities: Object.freeze([
    Object.freeze({ analysisSectionId: 'AS1', profileId: 'normal-metallic', resolvedMode: 'NORMAL' }),
    Object.freeze({ analysisSectionId: 'AS2', profileId: 'asme-b31.4', resolvedMode: 'ASME_B31_4' }),
  ]),
});
const pipingCodeAuthorities = Object.freeze([
  Object.freeze({ analysisSectionId: 'AS1', caesarPipingCode: 101,
    sourceAuthority: codeSources[0].sourceId, sourceReference: approvedSourceReferenceKey(codeSources[0]),
    catalogEntry: Object.freeze({ codeFamily: 'PROJECT-CODE', codeEdition: 'DB-R1', caesarVersion: '14.00' }) }),
  Object.freeze({ analysisSectionId: 'AS2', caesarPipingCode: 202,
    sourceAuthority: codeSources[1].sourceId, sourceReference: approvedSourceReferenceKey(codeSources[1]),
    catalogEntry: Object.freeze({ codeFamily: 'ASME B31.4', codeEdition: '2022', caesarVersion: '14.00' }) }),
]);
const emptyCase = (num) => Object.freeze({ num, attributes: Object.freeze({
  HOT_ALLOW: null, HOT_SY: null, HOT_SU: null,
}) });
const allowable = (elementId, elementIndex, node, codeAuthority) => Object.freeze({
  elementId, elementIndex, node,
  attributes: Object.freeze({ COLD_ALLOW: null, SY: null, SU: null,
    PIPING_CODE: codeAuthority.caesarPipingCode }),
  cases: Object.freeze(Array.from({ length: 9 }, (_, index) => emptyCase(index + 1))),
  pipingCodeAuthority: codeAuthority,
});
const element = (id, index, section, profileId, resolvedMode, codeAuthority) => Object.freeze({
  id, index, analysisSectionId: section, profileId, resolvedMode,
  properties: Object.freeze({ materialNumber: section === 'AS1' ? 106 : 5,
    temperatures: Object.freeze([100, 200]) }),
  mechanicalProperties: Object.freeze({ materialName: section === 'AS1' ? 'A106 B' : 'PIPELINE STEEL' }),
  allowableStress: allowable(id, index, 110 + index * 10, codeAuthority),
});
const elements = Object.freeze([
  element('E1', 0, 'AS1', 'normal-metallic', 'NORMAL', pipingCodeAuthorities[0]),
  element('E2', 1, 'AS2', 'asme-b31.4', 'ASME_B31_4', pipingCodeAuthorities[1]),
]);
const pipingCodeAuthorityPlan = Object.freeze({
  schema: 'PipelinePipingCodeAuthorityPlan.v1', ready: true, blockerCodes: Object.freeze([]),
  authorities: pipingCodeAuthorities,
  elements: Object.freeze(elements.map((item) => Object.freeze({ elementId: item.id }))),
});
const authority = (section, profileId, resolvedMode, materialNumber, materialName, base, codeIndex) => ({
  analysisSectionId: section, profileId, resolvedMode, materialNumber, materialName,
  coldAllow: base, sy: base + 10, su: base + 20,
  sourceAuthority: allowableSource.sourceId,
  sourceReference: approvedSourceReferenceKey(allowableSource),
  codeFamily: codeIndex === 0 ? 'PROJECT-CODE' : 'ASME B31.4',
  codeEdition: codeIndex === 0 ? 'DB-R1' : '2022',
  codeSource: structuredClone(codeSources[codeIndex]),
  allowableSource: structuredClone(allowableSource),
  cases: [
    { num: 1, temperature: 100, hotAllow: base - 1, hotSy: base + 9, hotSu: base + 19 },
    { num: 2, temperature: 200, hotAllow: base - 2, hotSy: base + 8, hotSu: base + 18 },
  ],
});
const catalogEntry = (item, index) => ({
  catalogEntryId: index === 0 ? 'MAT-A106B-R3' : 'MAT-PIPELINE-R3',
  codeFamily: item.codeFamily, codeEdition: item.codeEdition, caesarVersion: '14.00',
  materialNumber: item.materialNumber, materialName: item.materialName,
  coldAllow: structuredClone(item.coldAllow), sy: structuredClone(item.sy), su: structuredClone(item.su),
  sourceAuthority: item.sourceAuthority, sourceReference: item.sourceReference,
  cases: structuredClone(item.cases),
});
const authorities = [
  authority('AS1', 'normal-metallic', 'NORMAL', 106, 'A106 B', 1000, 0),
  authority('AS2', 'asme-b31.4', 'ASME_B31_4', 5, 'PIPELINE STEEL', 2000, 1),
];
authorities[1].su = { disposition: 'SENTINEL' };
authorities[1].cases[0].hotSy = { disposition: 'SENTINEL' };
authorities[1].cases[0].hotSu = { disposition: 'ZERO' };
authorities.forEach((item, index) => { item.catalogEntry = catalogEntry(item, index); });

const resolve = (values = authorities, modelElements = elements) =>
  resolvePipelineAllowableValueAuthorityPlan({ profileAuthorityPlan, pipingCodeAuthorityPlan,
    elements: modelElements, allowableValueAuthorities: values });
const plan = resolve();
assert.equal(plan.schema, PIPELINE_ALLOWABLE_VALUE_AUTHORITY_PLAN_SCHEMA);
assert.equal(plan.ready, true);
assert.equal(plan.authorityCount, 2);
assert.equal(plan.requiredSectionCount, 2);
assert.equal(plan.authorities[0].codeSourceAuthority.schema, PIPELINE_CODE_SOURCE_AUTHORITY_SCHEMA);
assert.equal(plan.authorities[0].catalogEntry.schema,
  PIPELINE_MATERIAL_ALLOWABLE_CATALOG_ENTRY_SCHEMA);
assert.equal(plan.authorities[0].catalogEntryId, 'MAT-A106B-R3');
assert.equal(plan.authorities[0].catalogEntry.values.COLD_ALLOW.value, 1000);
assert.equal(plan.authorities[1].catalogEntry.values.SU.disposition, 'SENTINEL');
assert.equal(plan.authorities[1].catalogEntry.cases[0].values.HOT_SU.disposition, 'ZERO');
assert.equal(plan.elements[0].allowableStress.attributes.COLD_ALLOW, 1000);
assert.equal(plan.elements[0].allowableStress.cases[1].attributes.HOT_SU, 1018);
assert.equal(plan.elements[1].allowableStress.attributes.SU, null);
assert.equal(Object.isFrozen(plan.authorities[0].catalogEntry.cases), true);
assert.deepEqual(plan, resolve(structuredClone(authorities)));

assert.ok(resolve(authorities.slice(0, 1)).blockerCodes
  .includes('PIPELINE_ALLOWABLE_VALUE_AUTHORITY_REQUIRED'));
assert.ok(resolve([authorities[0], authorities[0], authorities[1]]).blockerCodes
  .includes('PIPELINE_ALLOWABLE_VALUE_AUTHORITY_DUPLICATE'));
const missingCatalog = structuredClone(authorities); delete missingCatalog[0].catalogEntry;
assert.ok(resolve(missingCatalog).blockerCodes
  .includes('PIPELINE_MATERIAL_ALLOWABLE_CATALOG_ENTRY_REQUIRED'));
const wrongVersion = structuredClone(authorities); wrongVersion[0].catalogEntry.caesarVersion = '13.00';
assert.ok(resolve(wrongVersion).blockerCodes
  .includes('PIPELINE_MATERIAL_ALLOWABLE_CATALOG_VERSION_INVALID'));
const catalogValueConflict = structuredClone(authorities); catalogValueConflict[0].catalogEntry.coldAllow = 999;
assert.ok(resolve(catalogValueConflict).blockerCodes
  .includes('PIPELINE_MATERIAL_ALLOWABLE_CATALOG_CONFLICT'));
const catalogMaterialConflict = structuredClone(authorities);
catalogMaterialConflict[0].catalogEntry.materialName = 'WRONG';
assert.ok(resolve(catalogMaterialConflict).blockerCodes
  .includes('PIPELINE_MATERIAL_ALLOWABLE_CATALOG_CONFLICT'));
const duplicateCatalog = structuredClone(authorities);
duplicateCatalog[1].catalogEntry.catalogEntryId = duplicateCatalog[0].catalogEntry.catalogEntryId;
assert.ok(resolve(duplicateCatalog).blockerCodes
  .includes('PIPELINE_MATERIAL_ALLOWABLE_CATALOG_ID_DUPLICATE'));
const wrongMaterial = structuredClone(authorities);
wrongMaterial[0].materialName = 'WRONG'; wrongMaterial[0].catalogEntry.materialName = 'WRONG';
assert.ok(resolve(wrongMaterial).blockerCodes.includes('PIPELINE_ALLOWABLE_VALUE_MATERIAL_MISMATCH'));
const wrongTemperature = structuredClone(authorities);
wrongTemperature[0].cases[0].temperature = 101;
wrongTemperature[0].catalogEntry.cases[0].temperature = 101;
assert.ok(resolve(wrongTemperature).blockerCodes.includes('PIPELINE_ALLOWABLE_VALUE_TEMPERATURE_MISMATCH'));
const extraCase = structuredClone(authorities);
const third = { num: 3, temperature: 300, hotAllow: 1, hotSy: 1, hotSu: 1 };
extraCase[0].cases.push(structuredClone(third)); extraCase[0].catalogEntry.cases.push(structuredClone(third));
assert.ok(resolve(extraCase).blockerCodes.includes('PIPELINE_ALLOWABLE_VALUE_CASE_UNUSED'));
const conflictingElements = structuredClone(elements);
conflictingElements[0].allowableStress.attributes.COLD_ALLOW = 9999;
assert.ok(resolve(authorities, conflictingElements).blockerCodes.includes('PIPELINE_ALLOWABLE_VALUE_CONFLICT'));
const explicitZeroValue = structuredClone(authorities);
explicitZeroValue[0].coldAllow = { disposition: 'VALUE', value: 0 };
assert.ok(resolve(explicitZeroValue).blockerCodes.includes('PIPELINE_ALLOWABLE_VALUE_FIELD_INVALID'));
const ungovernedHotValueElements = structuredClone(elements);
ungovernedHotValueElements[0].allowableStress.cases[2].attributes.HOT_ALLOW = 123;
assert.ok(resolve(authorities, ungovernedHotValueElements).blockerCodes
  .includes('PIPELINE_ALLOWABLE_VALUE_UNGOVERNED_CASE_VALUE'));
const missingEdition = structuredClone(authorities); missingEdition[0].codeEdition = '';
assert.ok(resolve(missingEdition).blockerCodes.includes('PIPELINE_CODE_SOURCE_FIELD_INVALID'));
const badDigest = structuredClone(authorities); badDigest[0].codeSource.sha256 = 'bad';
assert.ok(resolve(badDigest).blockerCodes.includes('PIPELINE_APPROVED_SOURCE_SHA256_INVALID'));
const wrongPipingSource = structuredClone(authorities); wrongPipingSource[0].codeSource.sourceId = 'OTHER';
assert.ok(resolve(wrongPipingSource).blockerCodes
  .includes('PIPELINE_CODE_SOURCE_PIPING_PROVENANCE_MISMATCH'));
const wrongCodeFamily = structuredClone(authorities); wrongCodeFamily[0].codeFamily = 'OTHER';
wrongCodeFamily[0].catalogEntry.codeFamily = 'OTHER';
assert.ok(resolve(wrongCodeFamily).blockerCodes
  .includes('PIPELINE_CODE_SOURCE_PIPING_CATALOG_MISMATCH')); 
const wrongAllowableSource = structuredClone(authorities); wrongAllowableSource[0].sourceReference = 'OTHER';
assert.ok(resolve(wrongAllowableSource).blockerCodes
  .includes('PIPELINE_CODE_SOURCE_ALLOWABLE_PROVENANCE_MISMATCH'));
const nonProfile = resolvePipelineAllowableValueAuthorityPlan({ profileAuthorityPlan: null,
  pipingCodeAuthorityPlan: null, elements: [], allowableValueAuthorities: authorities });
assert.ok(nonProfile.blockerCodes.includes('PIPELINE_ALLOWABLE_VALUE_PROFILE_AUTHORITY_REQUIRED'));

console.log('pipeline-3d-model allowable-value authority: PASS');
