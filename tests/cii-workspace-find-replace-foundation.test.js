import assert from 'node:assert/strict';
import test from 'node:test';

import { buildFindReplaceOperationsFromCompareReview } from '../tabs/cii-workspace/cii-workspace-find-replace-review-adapter.js';
import { FIND_REPLACE_CSV_MODES, parseFindReplaceCsv } from '../tabs/cii-workspace/cii-workspace-find-replace-csv.js';
import {
  buildFindReplacePreview,
  setFindReplaceRowDecision,
  summarizeFindReplacePreview,
} from '../tabs/cii-workspace/cii-workspace-find-replace-preview.js';
import {
  createFindReplaceTransaction,
  validateMutationBoundary,
} from '../tabs/cii-workspace/cii-workspace-find-replace-contract.js';

test('review adapter promotes only identity-approved qualified scalar deltas', () => {
  const operations = buildFindReplaceOperationsFromCompareReview({
    rows: [
      {
        correspondenceId: 'node-1001',
        kind: 'NODE',
        source: '1001',
        target: '1001',
        identityBound: true,
        confidence: 'HIGH',
        decision: 'ACCEPTED',
        changes: [
          {
            changed: true,
            category: 'NODE_NAME',
            property: 'Node name / to-name',
            sourceValue: 'OLD_NODE',
            targetValue: 'NEW_NODE',
            evidenceStatus: 'QUALIFIED',
            authority: 'CII_NODENAME_FIXED_LAYOUT',
          },
        ],
      },
      {
        correspondenceId: 'node-1002',
        kind: 'NODE',
        source: '1002',
        target: '1002',
        identityBound: true,
        confidence: 'REVIEW',
        decision: 'REVIEW',
        changes: [
          {
            changed: true,
            category: 'RESTRAINT',
            property: 'Raw restraint records',
            sourceValue: [[1, 2]],
            targetValue: [[1, 3]],
            evidenceStatus: 'PARTIAL',
          },
        ],
      },
    ],
  });

  assert.equal(operations.length, 2);
  assert.equal(operations[0].status, 'PROPOSED');
  assert.equal(operations[0].findText, 'OLD_NODE');
  assert.equal(operations[0].replaceText, 'NEW_NODE');
  assert.deepEqual(operations[0].blockers, []);

  assert.equal(operations[1].status, 'BLOCKED');
  assert.ok(operations[1].blockers.includes('IDENTITY_NOT_APPROVED'));
  assert.ok(operations[1].blockers.includes('CHANGE_EVIDENCE_NOT_QUALIFIED'));
  assert.ok(operations[1].blockers.includes('NON_SCALAR_CHANGE_NOT_SUPPORTED'));
});

test('CSV intake supports document, element and qualified displacement schemas while FORCE fails closed', () => {
  const document = parseFindReplaceCsv('Find Text,Replace Text\nOLD,NEW\n', FIND_REPLACE_CSV_MODES.DOCUMENT);
  assert.equal(document.status, 'VALID');
  assert.equal(document.operations[0].scope, 'DOCUMENT');
  assert.equal(document.operations[0].status, 'PROPOSED');

  const element = parseFindReplaceCsv('From,To,Find Text,Replace Text\n100,120,10.0,12.0\n', FIND_REPLACE_CSV_MODES.ELEMENT);
  assert.equal(element.status, 'VALID');
  assert.equal(element.operations[0].from, 100);
  assert.equal(element.operations[0].to, 120);

  const displacement = parseFindReplaceCsv('From,To,Find Text,Replace Text,Block\n10,20,500,700,DISPLACEMENT\n', FIND_REPLACE_CSV_MODES.BLOCK);
  assert.equal(displacement.status, 'VALID');
  assert.equal(displacement.operations[0].block, 'DISPLACEMENT');
  assert.equal(displacement.operations[0].status, 'PROPOSED');

  const force = parseFindReplaceCsv('From,To,Find Text,Replace Text,Block\n10,20,500,700,FORCE\n', FIND_REPLACE_CSV_MODES.BLOCK);
  assert.equal(force.status, 'REVIEW');
  assert.equal(force.operations[0].status, 'BLOCKED');
  assert.ok(force.operations[0].blockers.includes('BLOCK_AUTHORITY_NOT_QUALIFIED:FORCE'));
});

test('CSV intake blocks invalid ranges without discarding preview evidence', () => {
  const result = parseFindReplaceCsv('From,To,Find Text,Replace Text\n20,10,A,B\n', FIND_REPLACE_CSV_MODES.ELEMENT);
  assert.equal(result.status, 'REVIEW');
  assert.equal(result.operations[0].status, 'BLOCKED');
  assert.ok(result.operations[0].blockers.includes('FROM_EXCEEDS_TO'));
});

test('preview approval state is explicit and blocked rows remain blocked', () => {
  let rows = buildFindReplacePreview([
    { scope: 'DOCUMENT', before: 'A', after: 'B', status: 'PROPOSED' },
    { scope: 'ELEMENT', before: 'C', after: 'D', status: 'BLOCKED', blockers: ['NOT_QUALIFIED'] },
  ]);

  rows = setFindReplaceRowDecision(rows, 1, 'APPROVED');
  rows = setFindReplaceRowDecision(rows, 2, 'APPROVED');
  const summary = summarizeFindReplacePreview(rows);

  assert.equal(rows[0].status, 'APPROVED');
  assert.equal(rows[1].status, 'BLOCKED');
  assert.deepEqual(summary, {
    total: 2,
    proposed: 0,
    approved: 1,
    rejected: 0,
    blocked: 1,
    readyForTransaction: false,
  });
});

test('mutation boundary remains disabled even when proposal review is complete', () => {
  const transaction = createFindReplaceTransaction({
    sourceHash: 'abc123',
    sourceFile: 'model-v14.cii',
    operations: [{
      source: 'CSV',
      scope: 'DOCUMENT',
      before: 'OLD',
      after: 'NEW',
      findText: 'OLD',
      replaceText: 'NEW',
      status: 'APPROVED',
    }],
  });
  const boundary = validateMutationBoundary(transaction);

  assert.equal(boundary.readyForMutationImplementation, true);
  assert.equal(boundary.canApply, false);
  assert.deepEqual(boundary.blockers, []);
});
