import assert from 'node:assert/strict';
import {
  bulkAcceptCiiMultiSourceReview,
  ciiMultiSourceReviewBySource,
  ciiMultiSourceReviewMarkup,
  seedCiiMultiSourceReviewDecisions,
} from '../tabs/cii-workspace/cii-workspace-multisource-review-ui.js';

const preview = {
  compareReview: { rows: [
    { correspondenceId: 'ms1', memberCorrespondenceId: 'm1', sourceId: 'S1', source: '3870', target: '870', kind: 'NODE', confidence: 'REVIEW', workflowStatus: 'REVIEW', decision: 'REVIEW', identityBound: true, changeCount: 1, changeFamilies: ['NODE_NAME'] },
    { correspondenceId: 'ms2', memberCorrespondenceId: 'm2', sourceId: 'S2', source: '120', target: '40070', kind: 'NODE', confidence: 'HIGH', workflowStatus: 'READY', decision: 'REVIEW', identityBound: true, changeCount: 0, changeFamilies: [] },
    { correspondenceId: 'ms3', memberCorrespondenceId: 'm3', sourceId: 'S3', source: '1890', target: '21890', kind: 'NODE', confidence: 'MEDIUM', workflowStatus: 'LOCKED', decision: 'LOCKED', identityBound: true, changeCount: 1, changeFamilies: ['NODE_NAME'] },
    { correspondenceId: 'ms4', memberCorrespondenceId: 'm4', sourceId: 'S1', source: '4000', target: '900', kind: 'NODE', confidence: 'HIGH', workflowStatus: 'UNRESOLVED', decision: 'REVIEW', identityBound: false, changeCount: 0, changeFamilies: [] },
  ] },
};

const decisions = seedCiiMultiSourceReviewDecisions(preview, new Map());
assert.equal(decisions.get('ms3'), 'LOCK');
assert.equal(bulkAcceptCiiMultiSourceReview(preview, decisions, 'HIGH'), 1, 'bulk HIGH must skip identity-unbound rows');
assert.equal(decisions.get('ms2'), 'ACCEPT');
decisions.set('ms1', 'LOCK');

const reviewBySource = ciiMultiSourceReviewBySource(preview, decisions);
assert.deepEqual(reviewBySource.S1.lockedCorrespondenceIds, ['m1']);
assert.deepEqual(reviewBySource.S1.reviewedCorrespondenceIds, []);
assert.deepEqual(reviewBySource.S2.reviewedCorrespondenceIds, ['m2']);
assert.deepEqual(reviewBySource.S3.lockedCorrespondenceIds, ['m3']);
assert.ok(!reviewBySource.S2.reviewedCorrespondenceIds.includes('ms2'), 'member review ledger must never receive prefixed multi-source IDs');

const markup = ciiMultiSourceReviewMarkup(preview, decisions, { confidence: 'ALL', search: '', changedOnly: false });
for (const token of ['3870', '870', '120', '40070', '1890', '21890', 'data-ciiw-ms-decision']) assert.ok(markup.includes(token), token);
assert.ok(ciiMultiSourceReviewMarkup(preview, decisions, { confidence: 'REVIEW', search: 'does-not-exist', changedOnly: false }).includes('No correspondence rows match'));

console.log('CII Writer2 multi-source correspondence review routing: PASS');
