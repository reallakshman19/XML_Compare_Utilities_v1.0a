import assert from 'node:assert/strict';
import { ciiMultiSourceReviewBySource } from '../tabs/cii-workspace/cii-workspace-multisource-review-ui.js';

function ledger(sourceId) {
  return {
    schema: 'CIIWorkspaceReview.v1',
    sourceContentSha256: `${sourceId}-source-sha`,
    targetContentSha256: 'target-sha',
    anchorIdentity: `${sourceId}-anchor-id`,
    correspondenceIdentity: `${sourceId}-correspondence-id`,
    reviewedCorrespondenceIds: [],
    lockedCorrespondenceIds: [],
    rejectedCorrespondenceIds: [],
  };
}
const preview = {
  memberPreviews: [
    { sourceId: 'S1', preview: { review: ledger('S1') } },
    { sourceId: 'S2', preview: { review: ledger('S2') } },
  ],
  compareReview: {
    rows: [
      { correspondenceId: 'ms-s1-a', memberCorrespondenceId: 's1-a', sourceId: 'S1', decision: 'REVIEW' },
      { correspondenceId: 'ms-s1-b', memberCorrespondenceId: 's1-b', sourceId: 'S1', decision: 'REVIEW' },
      { correspondenceId: 'ms-s2-a', memberCorrespondenceId: 's2-a', sourceId: 'S2', decision: 'REVIEW' },
    ],
  },
};
const decisions = new Map([
  ['ms-s1-a', 'ACCEPT'],
  ['ms-s1-b', 'LOCK'],
  ['ms-s2-a', 'REJECT'],
]);

const result = ciiMultiSourceReviewBySource(preview, decisions);
assert.deepEqual(result.S1.reviewedCorrespondenceIds, ['s1-a']);
assert.deepEqual(result.S1.lockedCorrespondenceIds, ['s1-b']);
assert.deepEqual(result.S1.rejectedCorrespondenceIds, []);
assert.deepEqual(result.S2.reviewedCorrespondenceIds, []);
assert.deepEqual(result.S2.lockedCorrespondenceIds, []);
assert.deepEqual(result.S2.rejectedCorrespondenceIds, ['s2-a']);

for (const sourceId of ['S1', 'S2']) {
  const original = preview.memberPreviews.find((item) => item.sourceId === sourceId).preview.review;
  assert.equal(result[sourceId].schema, original.schema);
  assert.equal(result[sourceId].sourceContentSha256, original.sourceContentSha256);
  assert.equal(result[sourceId].targetContentSha256, original.targetContentSha256);
  assert.equal(result[sourceId].anchorIdentity, original.anchorIdentity);
  assert.equal(result[sourceId].correspondenceIdentity, original.correspondenceIdentity,
    'projecting decisions must preserve the bound member correspondence ledger identity');
}

console.log('CII multi-source review ledger binding checks passed.');
