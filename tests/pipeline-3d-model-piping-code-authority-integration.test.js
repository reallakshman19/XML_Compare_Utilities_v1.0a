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
const authorities = [
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
const allowableValueAuthorities = authorities.map((item, index) => ({
  analysisSectionId: item.analysisSectionId, profileId: item.profileId,
  resolvedMode: item.resolvedMode, materialNumber: 1, materialName: 'TEST MATERIAL',
  coldAllow: 1000 + index * 1000, sy: 1100 + index * 1000, su: 1200 + index * 1000,
  sourceAuthority: allowableSource.sourceId,
  sourceReference: approvedSourceReferenceKey(allowableSource),
  codeFamily: codeCatalogEntries[index].codeFamily,
  codeEdition: codeCatalogEntries[index].codeEdition,
  codeSource: structuredClone(codeSources[index]), allowableSource: structuredClone(allowableSource),
  cases: [
    { num: 1, temperature: 100, hotAllow: 900 + index * 1000,
      hotSy: 1000 + index * 1000, hotSu: 1100 + index * 1000 },
    { num: 2, temperature: 200, hotAllow: 800 + index * 1000,
      hotSy: 900 + index * 1000, hotSu: 1000 + index * 1000 },
  ],
}));
const materialCatalogEntry = (item, index) => ({
  catalogEntryId: ['MAT-NORMAL-R4', 'MAT-B314-R4', 'MAT-GRE-R4'][index],
  codeFamily: item.codeFamily, codeEdition: item.codeEdition, caesarVersion: '14.00',
  materialNumber: item.materialNumber, materialName: item.materialName,
  coldAllow: structuredClone(item.coldAllow), sy: structuredClone(item.sy), su: structuredClone(item.su),
  sourceAuthority: item.sourceAuthority, sourceReference: item.sourceReference,
  cases: structuredClone(item.cases),
});
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
  input.pipingCodeAuthorities = structuredClone(authorities);
  input.allowableValueAuthorities = structuredClone(allowableValueAuthorities);
  return input;
}

const plan = buildPipelineInputXmlDocumentPlan(profileInput());
assert.equal(plan.ready, true);
assert.equal(plan.pipingCodeAuthorityPlan.ready, true);
assert.equal(plan.pipingCodeAuthorityPlan.authorityCount, 3);
assert.equal(plan.pipingCodeAuthorityPlan.requiredSectionCount, 3);
assert.deepEqual(plan.elements.filter((item) => item.allowableStress)
  .map((item) => item.allowableStress.attributes.PIPING_CODE), [101, 202, 303]);
assert.equal(plan.pipingCodeAuthorityPlan.authorities[1].catalogEntryId, 'CODE-B314-2022');
assert.equal(plan.elements[2].allowableStress.pipingCodeAuthority.catalogEntry.codeEdition, '2022');
assert.equal(plan.allowableValueAuthorityPlan.authorities[1].catalogEntryId, 'MAT-B314-R4');
assert.equal(plan.elements[2].allowableStress.allowableValueAuthority
  .catalogEntry.values.COLD_ALLOW.value, 2000);
assert.equal(Object.isFrozen(plan.allowableValueAuthorityPlan.authorities[0].catalogEntry), true);

const xml = buildInputXmlPipingModelXml(plan);
assert.match(xml, /NUMALLOW="3"/);
assert.equal((xml.match(/<ALLOWABLESTRESS /g) || []).length, 3);
assert.equal((xml.match(/<CASE /g) || []).length, 27);
assert.equal((xml.match(/PIPING_CODE="101\.000000"/g) || []).length, 1);
assert.equal((xml.match(/PIPING_CODE="202\.000000"/g) || []).length, 1);
assert.equal((xml.match(/PIPING_CODE="303\.000000"/g) || []).length, 1);
assert.equal(xml, buildInputXmlPipingModelXml(buildPipelineInputXmlDocumentPlan(profileInput())));

function writerBlocked(mutator) {
  const forged = structuredClone(plan); mutator(forged);
  assert.throws(() => buildInputXmlPipingModelXml(forged),
    (error) => error.code === 'PIPELINE_INPUTXML_WRITER_BLOCKED');
}
writerBlocked((value) => { value.elements[0].allowableStress.attributes.PIPING_CODE = 999; });
writerBlocked((value) => { value.pipingCodeAuthorityPlan.authorities[0].caesarPipingCode = 999; });
writerBlocked((value) => { delete value.pipingCodeAuthorityPlan; delete value.pipingCodeAuthorityPlanSchema; });
writerBlocked((value) => { delete value.elements[0].allowableStress.pipingCodeAuthority.catalogEntry; });
writerBlocked((value) => { value.pipingCodeAuthorityPlan.authorities[0].catalogEntry.codeEdition = 'FORGED'; });
writerBlocked((value) => { delete value.elements[0].allowableStress.allowableValueAuthority.catalogEntry; });
writerBlocked((value) => { value.allowableValueAuthorityPlan.authorities[0]
  .catalogEntry.cases[0].temperature = 999; });

const missingInput = profileInput();
missingInput.pipingCodeAuthorities.pop();
const missing = buildPipelineInputXmlDocumentPlan(missingInput);
assert.equal(missing.ready, false);
assert.ok(missing.blockerCodes.includes('PIPELINE_PIPING_CODE_AUTHORITY_REQUIRED'));
const missingMaterialCatalogInput = profileInput();
delete missingMaterialCatalogInput.allowableValueAuthorities[0].catalogEntry;
const missingMaterialCatalog = buildPipelineInputXmlDocumentPlan(missingMaterialCatalogInput);
assert.equal(missingMaterialCatalog.ready, false);
assert.ok(missingMaterialCatalog.blockerCodes
  .includes('PIPELINE_MATERIAL_ALLOWABLE_CATALOG_ENTRY_REQUIRED'));
const materialConflictInput = profileInput();
materialConflictInput.allowableValueAuthorities[0].catalogEntry.materialName = 'WRONG';
const materialConflict = buildPipelineInputXmlDocumentPlan(materialConflictInput);
assert.equal(materialConflict.ready, false);
assert.ok(materialConflict.blockerCodes
  .includes('PIPELINE_MATERIAL_ALLOWABLE_CATALOG_CONFLICT'));
const missingCatalogInput = profileInput();
delete missingCatalogInput.pipingCodeAuthorities[0].catalogEntry;
const missingCatalog = buildPipelineInputXmlDocumentPlan(missingCatalogInput);
assert.equal(missingCatalog.ready, false);
assert.ok(missingCatalog.blockerCodes.includes('PIPELINE_PIPING_CODE_CATALOG_ENTRY_REQUIRED'));
const conflictInput = profileInput();
conflictInput.allowableStresses[0].PIPING_CODE = 999;
const conflict = buildPipelineInputXmlDocumentPlan(conflictInput);
assert.equal(conflict.ready, false);
assert.ok(conflict.blockerCodes.includes('PIPELINE_PIPING_CODE_CONFLICT'));
const noAllowable = buildPipelineInputXmlDocumentPlan(profileDocumentInput());
assert.equal(Object.hasOwn(noAllowable, 'pipingCodeAuthorityPlan'), false);
const nonProfile = buildPipelineInputXmlDocumentPlan({
  exportContext: { branchInfo: { lineNo: 'PL-1', caesarVersion: '14.00' } },
  coordinateRows: [
    { nodeNumber: 100, x: 0, y: 0, z: 0 },
    { nodeNumber: 110, x: 1000, y: 0, z: 0 },
  ],
  bendResolution: { errors: [], bendByIncomingElementIndex: {} },
  pipingCodeAuthorities: [authorities[0]],
});
assert.equal(nonProfile.ready, false);
assert.ok(nonProfile.blockerCodes.includes('PIPELINE_PIPING_CODE_PROFILE_AUTHORITY_REQUIRED'));

console.log('pipeline-3d-model piping-code authority integration: PASS');
