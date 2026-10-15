import assert from 'node:assert/strict';
import {
  isNonSemanticAttachmentPlaceholder,
  reconstructSupportFamilies,
} from '../tabs/sequential-sketcher/support/sj-pipe-support-family.js';

const branchId = '/SUPPORT/B1';
const placeholder = {
  type: 'SUPPORT',
  name: 'SUPPORT =1006649732/51286',
  sourceBranchId: branchId,
  sourceSequenceIndex: 1,
  path: ['children', 1],
  attributes: {
    NAME: '=1006649732/51286',
    TYPE: 'ATTA',
    RAW_TYPE: 'ATTA',
    OWNER: branchId,
    POS: { x: 0, y: 0, z: 0 },
    REF: '=1006649732/51286',
    SUPPORT_TAG: '=1006649732/51286',
    CMPSUPTYPE: '',
    DTXR: '---',
  },
};
const datum = {
  type: 'SUPPORT',
  name: 'SUPPORT PS-1',
  sourceBranchId: branchId,
  sourceSequenceIndex: 2,
  path: ['children', 2],
  attributes: {
    NAME: '/PS-1/DATUM',
    TYPE: 'ATTA',
    RAW_TYPE: 'ATTA',
    OWNER: branchId,
    POS: { x: 100, y: 0, z: 0 },
    REF: '=1006649732/51294',
    SUPPORT_TAG: 'PS-1',
    CMPSUPTYPE: 'REST',
    DTXR: 'Pipe Rest',
  },
};
const shoe = {
  type: 'SUPPORT',
  name: 'SUPPORT PS-1',
  sourceBranchId: branchId,
  sourceSequenceIndex: 3,
  path: ['children', 3],
  attributes: {
    NAME: '/PS-1.1',
    TYPE: 'ATTA',
    RAW_TYPE: 'ATTA',
    OWNER: branchId,
    POS: { x: 100, y: 0, z: 0 },
    REF: '=1006649732/51295',
    SUPPORT_TAG: 'PS-1',
    CMPSUPTYPE: 'SH-50',
    DTXR: 'PIPE SHOE',
  },
};

assert.equal(isNonSemanticAttachmentPlaceholder(placeholder), true);
assert.equal(isNonSemanticAttachmentPlaceholder(datum), false);
const diagnostics = [];
const families = reconstructSupportFamilies([placeholder, datum, shoe], { branchId, diagnostics });
assert.equal(families.length, 1);
assert.equal(families[0].familyId, '/PS-1');
assert.deepEqual(families[0].members.map((member) => member.semanticRole), ['DATUM', 'PIPE_SHOE']);
const excluded = diagnostics.filter((row) => row.code === 'NON_SEMANTIC_ATTACHMENT_EXCLUDED');
assert.equal(excluded.length, 1);
assert.equal(excluded[0].memberId, '=1006649732/51286');
assert.deepEqual(excluded[0].attributes, placeholder.attributes, 'complete placeholder evidence must be retained');
assert.equal(diagnostics.some((row) => row.code === 'SUPPORT_FAMILY_MEMBER_POSITION_DIVERGENCE'), false);

console.log('sequential support placeholder tests passed');
