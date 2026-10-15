import assert from 'node:assert/strict';
import { buildPipelineInputXmlDocumentPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-document.js';
import { buildInputXmlPipingModelXml } from '../tabs/pipeline-3d-model/pipeline-3d-model-xml-builder.js';
import { approvedSourceReferenceKey } from '../tabs/pipeline-3d-model/pipeline-3d-model-allowable-value-authority.js';
import { profileDocumentInput } from './pipeline-3d-model-inputxml-profile-document.test.js';

const digest = (character) => character.repeat(64);
const source = (sourceId, title, revision, character) => ({ sourceId, title, revision,
  approvalReference: `APPROVAL-${sourceId}-${revision}`, sha256: digest(character) });
const codeSources = [
  source('PROJECT-DESIGN-BASIS', 'Project Design Basis', 'R1', 'a'),
  source('APPROVED-CODE-SELECTION', 'ASME B31.4 Code Selection', '2022', 'b'),
  source('VENDOR-QUALIFICATION', 'GRE Vendor Qualification', 'R2', 'c'),
];
const allowableSource = source('APPROVED-MATERIAL-SHEET', 'Approved Material Sheet', 'R4', 'd');
const codeCatalogEntries = [
  { catalogEntryId: 'CODE-NORMAL-R1', codeFamily: 'PROJECT-CODE', codeEdition: 'DB-R1',
    caesarVersion: '14.00', caesarPipingCode: 101, sourceAuthority: codeSources[0].sourceId,
    sourceReference: approvedSourceReferenceKey(codeSources[0]) },
  { catalogEntryId: 'CODE-B314-2022', codeFamily: 'ASME B31.4', codeEdition: '2022',
    caesarVersion: '14.00', caesarPipingCode: 202, sourceAuthority: codeSources[1].sourceId,
    sourceReference: approvedSourceReferenceKey(codeSources[1]) },
  { catalogEntryId: 'CODE-GRE-R2', codeFamily: 'GRE VENDOR BASIS', codeEdition: 'R2',
    caesarVersion: '14.00', caesarPipingCode: 303, sourceAuthority: codeSources[2].sourceId,
    sourceReference: approvedSourceReferenceKey(codeSources[2]) },
];
const pipingCodeAuthorities = [
  { analysisSectionId: 'AS1', profileId: 'normal-metallic', resolvedMode: 'NORMAL',
    caesarPipingCode: 101, sourceAuthority: codeSources[0].sourceId,
    sourceReference: approvedSourceReferenceKey(codeSources[0]), catalogEntry: codeCatalogEntries[0] },
  { analysisSectionId: 'AS2', profileId: 'asme-b31.4', resolvedMode: 'ASME_B31_4',
    caesarPipingCode: 202, sourceAuthority: codeSources[1].sourceId,
    sourceReference: approvedSourceReferenceKey(codeSources[1]), catalogEntry: codeCatalogEntries[1] },
  { analysisSectionId: 'AS3', profileId: 'gre', resolvedMode: 'GRE',
    caesarPipingCode: 303, sourceAuthority: codeSources[2].sourceId,
    sourceReference: approvedSourceReferenceKey(codeSources[2]), catalogEntry: codeCatalogEntries[2] },
];
const caseValues = (num, temperature, hotAllow, hotSy, hotSu) => ({
  num, temperature, hotAllow, hotSy, hotSu,
});
const authority = (analysisSectionId, profileId, resolvedMode, base, index) => ({
  analysisSectionId, profileId, resolvedMode,
  materialNumber: 1, materialName: 'TEST MATERIAL',
  coldAllow: base, sy: base + 100, su: base + 200,
  sourceAuthority: allowableSource.sourceId,
  sourceReference: approvedSourceReferenceKey(allowableSource),
  codeFamily: codeCatalogEntries[index].codeFamily,
  codeEdition: codeCatalogEntries[index].codeEdition,
  codeSource: structuredClone(codeSources[index]),
  allowableSource: structuredClone(allowableSource),
  cases: [
    caseValues(1, 100, base - 10, base + 90, base + 190),
    caseValues(2, 200, base - 20, base + 80, base + 180),
  ],
});
const materialCatalogEntry = (item, index) => ({
  catalogEntryId: ['MAT-NORMAL-R4', 'MAT-B314-R4', 'MAT-GRE-R4'][index],
  codeFamily: item.codeFamily, codeEdition: item.codeEdition, caesarVersion: '14.00',
  materialNumber: item.materialNumber, materialName: item.materialName,
  coldAllow: structuredClone(item.coldAllow), sy: structuredClone(item.sy), su: structuredClone(item.su),
  sourceAuthority: item.sourceAuthority, sourceReference: item.sourceReference,
  cases: structuredClone(item.cases),
});
const allowableValueAuthorities = [
  authority('AS1', 'normal-metallic', 'NORMAL', 1000, 0),
  authority('AS2', 'asme-b31.4', 'ASME_B31_4', 2000, 1),
  authority('AS3', 'gre', 'GRE', 3000, 2),
];
allowableValueAuthorities[1].su = { disposition: 'SENTINEL' };
allowableValueAuthorities[1].cases[0].hotAllow = { disposition: 'SENTINEL' };
allowableValueAuthorities[1].cases[0].hotSy = { disposition: 'ZERO' };
allowableValueAuthorities[1].cases[0].hotSu = { disposition: 'ZERO' };
allowableValueAuthorities.forEach((item, index) => {
  item.catalogEntry = materialCatalogEntry(item, index);
});

function profileInput() {
  const input = structuredClone(profileDocumentInput());
  input.exportContext.branchInfo.caesarVersion = '14.00';
  input.exportContext.branchInfo.materialName = 'TEST MATERIAL';
  input.exportContext.branchInfo.t1 = 100;
  input.exportContext.branchInfo.t2 = 200;
  input.allowableStresses = [
    { elementIndex: 0, cases: [] },
    { elementIndex: 2, PIPING_CODE: 202, cases: [] },
    { elementIndex: 4, cases: [] },
  ];
  input.pipingCodeAuthorities = structuredClone(pipingCodeAuthorities);
  input.allowableValueAuthorities = structuredClone(allowableValueAuthorities);
  return input;
}

const plan = buildPipelineInputXmlDocumentPlan(profileInput());
assert.equal(plan.ready, true);
assert.equal(plan.allowableValueAuthorityPlan.ready, true);
assert.equal(plan.allowableValueAuthorityPlan.authorityCount, 3);
assert.equal(plan.allowableValueAuthorityPlan.requiredSectionCount, 3);
assert.deepEqual(plan.elements.filter((item) => item.allowableStress)
  .map((item) => item.allowableStress.attributes.COLD_ALLOW), [1000, 2000, 3000]);
assert.equal(plan.elements[2].allowableStress.attributes.SU, null);
assert.equal(plan.elements[2].allowableStress.cases[0].attributes.HOT_ALLOW, null);
assert.equal(plan.elements[2].allowableStress.cases[0].attributes.HOT_SY, 0);
assert.equal(plan.elements[2].allowableStress.cases[0].attributes.HOT_SU, 0);
assert.equal(plan.elements[0].allowableStress.allowableValueAuthority.catalogEntryId,
  'MAT-NORMAL-R4');
assert.equal(plan.elements[2].allowableStress.allowableValueAuthority
  .catalogEntry.values.SU.disposition, 'SENTINEL');
assert.equal(plan.elements[2].allowableStress.allowableValueAuthority
  .catalogEntry.cases[0].values.HOT_SU.disposition, 'ZERO');
assert.equal(Object.isFrozen(plan.allowableValueAuthorityPlan.authorities[0].catalogEntry), true);
assert.equal(Object.isFrozen(plan.pipingCodeAuthorityPlan.authorities[0].catalogEntry), true);

const xml = buildInputXmlPipingModelXml(plan);
assert.match(xml, /NUMALLOW="3"/);
assert.equal((xml.match(/COLD_ALLOW="1000\.000000"/g) || []).length, 1);
assert.equal((xml.match(/COLD_ALLOW="2000\.000000"/g) || []).length, 1);
assert.equal((xml.match(/COLD_ALLOW="3000\.000000"/g) || []).length, 1);
assert.match(xml, /PIPING_CODE="202\.000000"/);
assert.match(xml, /HOT_ALLOW="-1\.010100" HOT_SY="0\.000000" HOT_SU="0\.000000"/);
assert.equal(xml, buildInputXmlPipingModelXml(buildPipelineInputXmlDocumentPlan(profileInput())));

function writerBlocked(mutator) {
  const forged = structuredClone(plan); mutator(forged);
  assert.throws(() => buildInputXmlPipingModelXml(forged),
    (error) => error.code === 'PIPELINE_INPUTXML_WRITER_BLOCKED');
}
writerBlocked((value) => { value.elements[0].allowableStress.attributes.COLD_ALLOW = 999; });
writerBlocked((value) => { value.elements[0].allowableStress.cases[0].attributes.HOT_ALLOW = 999; });
writerBlocked((value) => { value.elements[0].properties.materialNumber = 5; });
writerBlocked((value) => { delete value.elements[0].allowableStress.allowableValueAuthority; });
writerBlocked((value) => { value.allowableValueAuthorityPlan.authorities[0].values.COLD_ALLOW.disposition = 'SENTINEL'; });
writerBlocked((value) => { delete value.elements[0].allowableStress.allowableValueAuthority.catalogEntry; });
writerBlocked((value) => { value.allowableValueAuthorityPlan.authorities[0]
  .catalogEntry.values.COLD_ALLOW.value = 999; });
writerBlocked((value) => { value.allowableValueAuthorityPlan.elements[0]
  .allowableStress.allowableValueAuthority.catalogEntry.catalogEntryId = 'FORGED'; });

const missingInput = profileInput();
missingInput.allowableValueAuthorities.pop();
const missing = buildPipelineInputXmlDocumentPlan(missingInput);
assert.equal(missing.ready, false);
assert.ok(missing.blockerCodes.includes('PIPELINE_ALLOWABLE_VALUE_AUTHORITY_REQUIRED'));
const missingCatalogInput = profileInput();
delete missingCatalogInput.allowableValueAuthorities[0].catalogEntry;
const missingCatalog = buildPipelineInputXmlDocumentPlan(missingCatalogInput);
assert.equal(missingCatalog.ready, false);
assert.ok(missingCatalog.blockerCodes
  .includes('PIPELINE_MATERIAL_ALLOWABLE_CATALOG_ENTRY_REQUIRED'));
const duplicateCatalogInput = profileInput();
duplicateCatalogInput.allowableValueAuthorities[1].catalogEntry.catalogEntryId =
  duplicateCatalogInput.allowableValueAuthorities[0].catalogEntry.catalogEntryId;
const duplicateCatalog = buildPipelineInputXmlDocumentPlan(duplicateCatalogInput);
assert.equal(duplicateCatalog.ready, false);
assert.ok(duplicateCatalog.blockerCodes
  .includes('PIPELINE_MATERIAL_ALLOWABLE_CATALOG_ID_DUPLICATE'));
const wrongVersionInput = profileInput();
wrongVersionInput.allowableValueAuthorities[0].catalogEntry.caesarVersion = '13.00';
const wrongVersion = buildPipelineInputXmlDocumentPlan(wrongVersionInput);
assert.equal(wrongVersion.ready, false);
assert.ok(wrongVersion.blockerCodes
  .includes('PIPELINE_MATERIAL_ALLOWABLE_CATALOG_VERSION_INVALID'));
const catalogConflictInput = profileInput();
catalogConflictInput.allowableValueAuthorities[0].catalogEntry.coldAllow = 999;
const catalogConflict = buildPipelineInputXmlDocumentPlan(catalogConflictInput);
assert.equal(catalogConflict.ready, false);
assert.ok(catalogConflict.blockerCodes
  .includes('PIPELINE_MATERIAL_ALLOWABLE_CATALOG_CONFLICT'));
const conflictInput = profileInput();
conflictInput.allowableStresses[0].COLD_ALLOW = 999;
const conflict = buildPipelineInputXmlDocumentPlan(conflictInput);
assert.equal(conflict.ready, false);
assert.ok(conflict.blockerCodes.includes('PIPELINE_ALLOWABLE_VALUE_CONFLICT'));
const invalidSourceInput = profileInput();
invalidSourceInput.allowableValueAuthorities[0].codeSource.sha256 = 'bad';
const invalidSource = buildPipelineInputXmlDocumentPlan(invalidSourceInput);
assert.equal(invalidSource.ready, false);
assert.ok(invalidSource.blockerCodes.includes('PIPELINE_APPROVED_SOURCE_SHA256_INVALID'));
const noAllowable = buildPipelineInputXmlDocumentPlan(profileDocumentInput());
assert.equal(Object.hasOwn(noAllowable, 'allowableValueAuthorityPlan'), false);
const nonProfile = buildPipelineInputXmlDocumentPlan({
  exportContext: { branchInfo: { lineNo: 'PL-1', caesarVersion: '14.00' } },
  coordinateRows: [
    { nodeNumber: 100, x: 0, y: 0, z: 0 },
    { nodeNumber: 110, x: 1000, y: 0, z: 0 },
  ],
  bendResolution: { errors: [], bendByIncomingElementIndex: {} },
  allowableValueAuthorities: [allowableValueAuthorities[0]],
});
assert.equal(nonProfile.ready, false);
assert.ok(nonProfile.blockerCodes.includes('PIPELINE_ALLOWABLE_VALUE_PROFILE_AUTHORITY_REQUIRED'));

console.log('pipeline-3d-model allowable-value authority integration: PASS');
