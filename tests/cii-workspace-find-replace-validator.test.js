import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateFindReplacePostimage,
  validateFindReplacePreimage,
} from '../tabs/cii-workspace/cii-workspace-find-replace-validator.js';

test('document validator derives TARGET0-relative claims and verifies exact postimage', () => {
  const target0 = 'AA OLD BB OLD CC';
  const preimage = validateFindReplacePreimage(target0, [{
    sequence: 1,
    scope: 'DOCUMENT',
    findText: 'OLD',
    replaceText: 'NEW',
    expectedMatches: 2,
    status: 'APPROVED',
  }]);

  assert.equal(preimage.status, 'PASS');
  assert.equal(preimage.claims.length, 2);
  assert.deepEqual(preimage.claims.map((claim) => [claim.start, claim.end]), [[3, 6], [10, 13]]);

  const postimage = validateFindReplacePostimage(target0, 'AA NEW BB NEW CC', preimage);
  assert.equal(postimage.status, 'PASS');
  assert.deepEqual(postimage.unexpected, []);
});

test('postimage validator detects unrelated byte changes independently of writer claims', () => {
  const target0 = 'AA OLD BB OLD CC';
  const preimage = validateFindReplacePreimage(target0, [{
    scope: 'DOCUMENT',
    findText: 'OLD',
    replaceText: 'NEW',
    status: 'APPROVED',
  }]);
  const postimage = validateFindReplacePostimage(target0, 'AA NEW XX NEW CC', preimage);

  assert.equal(postimage.status, 'FAIL');
  assert.ok(postimage.blockers.some((item) => item.startsWith('UNEXPECTED_POSTIMAGE_BYTES:')));
});

test('preimage validator fails closed on width change, unresolved physical scope and overlapping claims', () => {
  const width = validateFindReplacePreimage('OLD', [{
    scope: 'DOCUMENT',
    findText: 'OLD',
    replaceText: 'LONG',
    status: 'APPROVED',
  }]);
  assert.equal(width.status, 'FAIL');
  assert.ok(width.blockers.some((item) => item.includes('FIXED_WIDTH_LENGTH_MISMATCH')));

  const scope = validateFindReplacePreimage('ABC', [{
    scope: 'ELEMENT',
    from: 10,
    to: 20,
    findText: 'A',
    replaceText: 'Z',
    status: 'APPROVED',
  }]);
  assert.equal(scope.status, 'FAIL');
  assert.ok(scope.blockers.some((item) => item.includes('SECTION_NOT_FOUND:ELEMENTS')));

  const overlap = validateFindReplacePreimage('ABC', [
    { sequence: 1, scope: 'DOCUMENT', findText: 'AB', replaceText: 'XY', status: 'APPROVED' },
    { sequence: 2, scope: 'DOCUMENT', findText: 'BC', replaceText: 'YZ', status: 'APPROVED' },
  ]);
  assert.equal(overlap.status, 'FAIL');
  assert.ok(overlap.blockers.some((item) => item.startsWith('OVERLAPPING_CLAIMS:')));
});
