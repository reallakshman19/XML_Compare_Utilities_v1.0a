import assert from 'node:assert/strict';
import { resolvePipelinePipingCodeAuthorityPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-piping-code-authority.js';

const sections = [
  ['AS1', 'normal-metallic', 'NORMAL'],
  ['AS2', 'asme-b31.4', 'ASME_B31_4'],
  ['AS3', 'gre', 'GRE'],
];
const profileAuthorityPlan = Object.freeze({
  schema: 'PipelineInputXmlProfileAuthorityPlan.v1',
  ready: true,
  blockerCodes: Object.freeze([]),
  sectionAuthorities: Object.freeze(sections.map(([analysisSectionId, profileId, resolvedMode]) =>
    Object.freeze({ analysisSectionId, profileId, resolvedMode }))),
  elementAuthorities: Object.freeze(sections.map(([analysisSectionId, profileId, resolvedMode], index) =>
    Object.freeze({ elementId: `E${index + 1}`, elementIndex: index, analysisSectionId, profileId, resolvedMode }))),
});
const allowableStressPlan = Object.freeze({
  schema: 'PipelineAllowableStressPlan.v1',
  active: true,
  ready: true,
  blockerCodes: Object.freeze([]),
  elements: Object.freeze(sections.map((_, index) => Object.freeze({
    elementId: `E${index + 1}`,
    elementIndex: index,
    allowableStress: Object.freeze({
      elementId: `E${index + 1}`,
      elementIndex: index,
      attributes: Object.freeze({ PIPING_CODE: null }),
      cases: Object.freeze([]),
    }),
  }))),
});
const catalog = (catalogEntryId, codeFamily, codeEdition, caesarPipingCode, sourceAuthority) => ({
  catalogEntryId,
  codeFamily,
  codeEdition,
  caesarVersion: '14.00',
  caesarPipingCode,
  sourceAuthority,
  sourceReference: `${sourceAuthority}@${codeEdition}`,
});
const shared = catalog('CODE-SHARED-R1', 'PROJECT-CODE', 'DB-R1', 101, 'PROJECT-BASIS');
const unique = catalog('CODE-GRE-R2', 'GRE VENDOR BASIS', 'R2', 303, 'VENDOR-QUALIFICATION');
const authority = ([analysisSectionId, profileId, resolvedMode], entry) => ({
  analysisSectionId,
  profileId,
  resolvedMode,
  caesarPipingCode: entry.caesarPipingCode,
  sourceAuthority: entry.sourceAuthority,
  sourceReference: entry.sourceReference,
  catalogEntry: structuredClone(entry),
});
const authorities = [
  authority(sections[0], shared),
  authority(sections[1], shared),
  authority(sections[2], unique),
];
const resolve = (inputs = authorities) => resolvePipelinePipingCodeAuthorityPlan({
  profileAuthorityPlan,
  allowableStressPlan,
  pipingCodeAuthorities: inputs,
});

const plan = resolve();
assert.equal(plan.ready, true);
assert.equal(plan.authorityCount, 3);
assert.deepEqual(plan.authorities.slice(0, 2).map((item) => item.catalogEntryId),
  ['CODE-SHARED-R1', 'CODE-SHARED-R1']);
assert.deepEqual(plan.authorities[0].catalogEntry, plan.authorities[1].catalogEntry);
assert.equal(Object.isFrozen(plan.authorities[0].catalogEntry), true);
assert.deepEqual(plan, resolve(structuredClone(authorities)));

const conflicting = structuredClone(authorities);
conflicting[1].catalogEntry.codeEdition = 'DB-R2';
const conflictPlan = resolve(conflicting);
assert.equal(conflictPlan.ready, false);
assert.ok(conflictPlan.blockerCodes.includes('PIPELINE_PIPING_CODE_CATALOG_ID_CONFLICT'));
assert.ok(conflictPlan.blockerCodes.includes('PIPELINE_PIPING_CODE_CATALOG_ID_DUPLICATE'));

const duplicateSection = resolve([...authorities, structuredClone(authorities[0])]);
assert.equal(duplicateSection.ready, false);
assert.ok(duplicateSection.blockerCodes.includes('PIPELINE_PIPING_CODE_AUTHORITY_DUPLICATE'));

console.log('pipeline-3d-model piping-code reusable catalog identity: PASS');
