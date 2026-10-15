import assert from 'node:assert/strict';
import {
  approvedSourceReferenceKey,
  resolvePipelineAllowableValueAuthorityPlan,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-allowable-value-authority.js';

const digest = (character) => character.repeat(64);
const source = (sourceId, title, revision, character) => ({
  sourceId,
  title,
  revision,
  approvalReference: `APPROVAL-${sourceId}-${revision}`,
  sha256: digest(character),
});
const codeSource = source('DB', 'Project Design Basis', 'R1', 'a');
const allowableSource = source('MAT-SHEET', 'Approved Material Sheet', 'R3', 'b');
const sections = [
  ['AS1', 'normal-metallic', 'NORMAL'],
  ['AS2', 'asme-b31.4', 'ASME_B31_4'],
];
const profileAuthorityPlan = Object.freeze({
  schema: 'PipelineInputXmlProfileAuthorityPlan.v1',
  ready: true,
  blockerCodes: Object.freeze([]),
  sectionAuthorities: Object.freeze(sections.map(([analysisSectionId, profileId, resolvedMode]) =>
    Object.freeze({ analysisSectionId, profileId, resolvedMode }))),
});
const pipingCodeAuthorities = Object.freeze(sections.map(([analysisSectionId]) => Object.freeze({
  analysisSectionId,
  caesarPipingCode: 101,
  sourceAuthority: codeSource.sourceId,
  sourceReference: approvedSourceReferenceKey(codeSource),
  catalogEntry: Object.freeze({
    codeFamily: 'PROJECT-CODE',
    codeEdition: 'DB-R1',
    caesarVersion: '14.00',
  }),
})));
const pipingCodeAuthorityPlan = Object.freeze({
  schema: 'PipelinePipingCodeAuthorityPlan.v1',
  ready: true,
  blockerCodes: Object.freeze([]),
  authorities: pipingCodeAuthorities,
  elements: Object.freeze([]),
});
const emptyCase = (num) => Object.freeze({
  num,
  attributes: Object.freeze({ HOT_ALLOW: null, HOT_SY: null, HOT_SU: null }),
});
const elements = Object.freeze(sections.map(([analysisSectionId, profileId, resolvedMode], index) =>
  Object.freeze({
    id: `E${index + 1}`,
    index,
    analysisSectionId,
    profileId,
    resolvedMode,
    properties: Object.freeze({ materialNumber: 106, temperatures: Object.freeze([100, 200]) }),
    mechanicalProperties: Object.freeze({ materialName: 'A106 B' }),
    allowableStress: Object.freeze({
      elementId: `E${index + 1}`,
      elementIndex: index,
      attributes: Object.freeze({ COLD_ALLOW: null, SY: null, SU: null, PIPING_CODE: 101 }),
      cases: Object.freeze(Array.from({ length: 9 }, (_, caseIndex) => emptyCase(caseIndex + 1))),
      pipingCodeAuthority: pipingCodeAuthorities[index],
    }),
  })));
const cases = [
  { num: 1, temperature: 100, hotAllow: 999, hotSy: 1009, hotSu: 1019 },
  { num: 2, temperature: 200, hotAllow: 998, hotSy: 1008, hotSu: 1018 },
];
const baseAuthority = ([analysisSectionId, profileId, resolvedMode]) => ({
  analysisSectionId,
  profileId,
  resolvedMode,
  materialNumber: 106,
  materialName: 'A106 B',
  coldAllow: 1000,
  sy: 1010,
  su: 1020,
  sourceAuthority: allowableSource.sourceId,
  sourceReference: approvedSourceReferenceKey(allowableSource),
  codeFamily: 'PROJECT-CODE',
  codeEdition: 'DB-R1',
  codeSource: structuredClone(codeSource),
  allowableSource: structuredClone(allowableSource),
  cases: structuredClone(cases),
});
const catalogFor = (authority) => ({
  catalogEntryId: 'MAT-A106B-R3',
  codeFamily: authority.codeFamily,
  codeEdition: authority.codeEdition,
  caesarVersion: '14.00',
  materialNumber: authority.materialNumber,
  materialName: authority.materialName,
  coldAllow: structuredClone(authority.coldAllow),
  sy: structuredClone(authority.sy),
  su: structuredClone(authority.su),
  sourceAuthority: authority.sourceAuthority,
  sourceReference: authority.sourceReference,
  cases: structuredClone(authority.cases),
});
const authorities = sections.map((section) => {
  const item = baseAuthority(section);
  item.catalogEntry = catalogFor(item);
  return item;
});
const resolve = (inputs = authorities) => resolvePipelineAllowableValueAuthorityPlan({
  profileAuthorityPlan,
  pipingCodeAuthorityPlan,
  elements,
  allowableValueAuthorities: inputs,
});

const plan = resolve();
assert.equal(plan.ready, true);
assert.equal(plan.authorityCount, 2);
assert.deepEqual(plan.authorities.map((item) => item.catalogEntryId),
  ['MAT-A106B-R3', 'MAT-A106B-R3']);
assert.deepEqual(plan.authorities[0].catalogEntry, plan.authorities[1].catalogEntry);
assert.equal(Object.isFrozen(plan.authorities[1].catalogEntry.cases), true);
assert.deepEqual(plan, resolve(structuredClone(authorities)));

const conflicting = structuredClone(authorities);
conflicting[1].coldAllow = 1001;
conflicting[1].catalogEntry.coldAllow = 1001;
const conflictPlan = resolve(conflicting);
assert.equal(conflictPlan.ready, false);
assert.ok(conflictPlan.blockerCodes.includes('PIPELINE_MATERIAL_ALLOWABLE_CATALOG_ID_CONFLICT'));
assert.ok(conflictPlan.blockerCodes.includes('PIPELINE_MATERIAL_ALLOWABLE_CATALOG_ID_DUPLICATE'));

const duplicateSection = resolve([...authorities, structuredClone(authorities[0])]);
assert.equal(duplicateSection.ready, false);
assert.ok(duplicateSection.blockerCodes.includes('PIPELINE_ALLOWABLE_VALUE_AUTHORITY_DUPLICATE'));

console.log('pipeline-3d-model material/allowable reusable catalog identity: PASS');
