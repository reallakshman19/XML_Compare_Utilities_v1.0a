import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createFindReplaceOperation, FIND_REPLACE_CSV_MODES } from '../tabs/cii-workspace/cii-workspace-find-replace-csv.js';
import { buildValidatedFindReplacePostimage } from '../tabs/cii-workspace/cii-workspace-find-replace-executor.js';
import { analyzeFindReplaceEditorRows } from '../tabs/cii-workspace/cii-workspace-find-replace-editor-model.js';
import { validateFindReplacePreimage } from '../tabs/cii-workspace/cii-workspace-find-replace-validator.js';

const target0 = fs.readFileSync(new URL('../Benchmark/T.CII', import.meta.url), 'utf8');

function approvedDocument(findText, replaceText) {
  return {
    ...createFindReplaceOperation({ findText, replaceText }, FIND_REPLACE_CSV_MODES.DOCUMENT),
    sequence: 1,
    status: 'APPROVED',
  };
}

test('DOCUMENT smart fixed-width replaces logical Node Name without user padding', () => {
  assert.ok(target0.includes('PS02302.1'));
  const operation = approvedDocument('PS02302.1', '/SL-123.7, /unset-, /SL-123.8, /SL-123.9');
  assert.equal(operation.replaceText, 'SL-123.7');
  assert.notEqual(operation.findText.length, operation.replaceText.length);

  const preimage = validateFindReplacePreimage(target0, [operation]);
  assert.equal(preimage.status, 'PASS', preimage.blockers.join('\n'));
  assert.equal(preimage.operationSummaries[0].semanticMode, 'AUTO_NODENAME_FIXED_WIDTH');
  assert.equal(preimage.operationSummaries[0].block, 'NODENAME');
  assert.ok(preimage.claims.length >= 1);
  for (const claim of preimage.claims) {
    assert.equal(claim.before.length, claim.after.length);
    assert.equal(claim.after.trim(), 'SL-123.7');
    assert.equal(claim.block, 'NODENAME');
  }

  const postimage = buildValidatedFindReplacePostimage(target0, preimage);
  assert.equal(postimage.status, 'QUALIFIED_POSTIMAGE', postimage.blockers.join('\n'));
  assert.equal(postimage.target1.length, target0.length);
  assert.equal((postimage.target1.match(/\r\n/g) || []).length, (target0.match(/\r\n/g) || []).length);
  assert.ok(postimage.target1.includes('SL-123.7'));
});

test('DOCUMENT smart fixed-width accepts a copied 25-byte padded Node Name Find value', () => {
  const paddedFind = 'PS02302.1'.padEnd(25, ' ');
  assert.equal(paddedFind.length, 25);
  const operation = approvedDocument(paddedFind, 'SL-123');
  assert.equal(operation.replaceText.length, 6);

  const preimage = validateFindReplacePreimage(target0, [operation]);
  assert.equal(preimage.status, 'PASS', preimage.blockers.join('\n'));
  assert.equal(preimage.operationSummaries[0].semanticMode, 'AUTO_NODENAME_FIXED_WIDTH');
  assert.equal(preimage.operationSummaries[0].block, 'NODENAME');
  assert.ok(preimage.claims.length >= 1);
  assert.ok(!preimage.operationSummaries[0].blockers.some((value) => value.startsWith('FIXED_WIDTH_LENGTH_MISMATCH:')));
  for (const claim of preimage.claims) {
    assert.equal(claim.before.length, claim.after.length);
    assert.equal(claim.after.trim(), 'SL-123');
  }
});

test('all-space fixed-width Find input remains fail-closed', () => {
  const operation = approvedDocument(' '.repeat(25), 'SL-123');
  const preimage = validateFindReplacePreimage(target0, [operation]);
  assert.equal(preimage.status, 'FAIL');
  assert.equal(preimage.claims.length, 0);
  assert.ok(preimage.operationSummaries[0].blockers.some((value) => value.startsWith('FIXED_WIDTH_LENGTH_MISMATCH:25:6')));
});

test('smart fixed-width blocks overflow with a human-readable capacity error', () => {
  const operation = approvedDocument('PS02302.1', 'X'.repeat(40));
  const preimage = validateFindReplacePreimage(target0, [operation]);
  assert.equal(preimage.status, 'FAIL');
  const summary = preimage.operationSummaries[0];
  assert.equal(summary.semanticMode, 'AUTO_NODENAME_FIXED_WIDTH');
  assert.ok(summary.blockers.some((value) => value.startsWith('NODENAME_REPLACEMENT_TOO_WIDE:40:')));
  const diagnostics = analyzeFindReplaceEditorRows([operation], preimage.operationSummaries);
  const overflow = diagnostics.entries.find((entry) => entry.code.startsWith('NODENAME_REPLACEMENT_TOO_WIDE:'));
  assert.ok(overflow);
  assert.match(overflow.message, /Enter only the logical value/);
  assert.match(overflow.message, /padding is automatic/i);
});

test('unknown unequal-length document text remains fail-closed instead of shifting CII columns', () => {
  const operation = approvedDocument('TOKEN_THAT_DOES_NOT_EXIST', 'X');
  const preimage = validateFindReplacePreimage(target0, [operation]);
  assert.equal(preimage.status, 'FAIL');
  assert.ok(preimage.operationSummaries[0].blockers.some((value) => value.startsWith('FIXED_WIDTH_LENGTH_MISMATCH:')));
  assert.equal(preimage.claims.length, 0);
  const diagnostics = analyzeFindReplaceEditorRows([operation], preimage.operationSummaries);
  const fixed = diagnostics.entries.find((entry) => entry.code.startsWith('FIXED_WIDTH_LENGTH_MISMATCH:'));
  assert.ok(fixed);
  assert.match(fixed.message, /Do not add spaces manually/);
});
