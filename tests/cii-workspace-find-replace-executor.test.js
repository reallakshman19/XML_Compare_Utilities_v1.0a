import assert from 'node:assert/strict';
import test from 'node:test';

import { validateFindReplacePreimage } from '../tabs/cii-workspace/cii-workspace-find-replace-validator.js';
import { buildValidatedFindReplacePostimage } from '../tabs/cii-workspace/cii-workspace-find-replace-executor.js';

test('executor assembles TARGET1 only from validated TARGET0-relative claims', () => {
  const target0 = 'AA OLD BB OLD CC';
  const preimage = validateFindReplacePreimage(target0, [{
    scope: 'DOCUMENT',
    findText: 'OLD',
    replaceText: 'NEW',
    expectedMatches: 2,
    status: 'APPROVED',
  }]);
  assert.equal(preimage.status, 'PASS');

  const result = buildValidatedFindReplacePostimage(target0, preimage);
  assert.equal(result.status, 'QUALIFIED_POSTIMAGE');
  assert.equal(result.target1, 'AA NEW BB NEW CC');
  assert.equal(result.audit.claimCount, 2);
  assert.equal(result.audit.sourceLength, result.audit.targetLength);
  assert.equal(result.audit.postimageValidation.status, 'PASS');
  assert.notEqual(result.audit.sourceHash, result.audit.targetHash);
});

test('executor rejects stale TARGET0 even when supplied validation once passed', () => {
  const target0 = 'AA OLD CC';
  const preimage = validateFindReplacePreimage(target0, [{
    scope: 'DOCUMENT', findText: 'OLD', replaceText: 'NEW', status: 'APPROVED',
  }]);
  assert.equal(preimage.status, 'PASS');

  const stale = buildValidatedFindReplacePostimage('AA XXX CC', preimage);
  assert.equal(stale.status, 'BLOCKED');
  assert.equal(stale.target1, null);
  assert.ok(stale.blockers.includes('TARGET0_HASH_MISMATCH'));
});

test('executor rejects handcrafted overlapping or width-changing claims', () => {
  const fakeValidation = {
    status: 'PASS',
    sourceHash: null,
    claims: [
      { operationIndex: 1, start: 0, end: 2, before: 'AA', after: 'XX' },
      { operationIndex: 2, start: 1, end: 3, before: 'AB', after: 'YYY' },
    ],
  };
  const result = buildValidatedFindReplacePostimage('AABC', fakeValidation);
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.blockers.includes('PREIMAGE_SOURCE_HASH_REQUIRED'));
  assert.ok(result.blockers.some((item) => item.startsWith('CLAIM_OVERLAP:')));
  assert.ok(result.blockers.some((item) => item.startsWith('CLAIM_REPLACEMENT_WIDTH_MISMATCH:')));
});
