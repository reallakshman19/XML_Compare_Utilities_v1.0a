import assert from 'assert';
import { createCiiTransferPreview } from '../tabs/cii-workspace/cii-workspace-transfer-plan.js';
import { createCiiWorkspaceReviewLedger } from '../tabs/cii-workspace/cii-workspace-review.js';

const sourceDocument = { fileName: 'source.cii', contentSha256: 's' };
const targetDocument = { fileName: 'target.cii', contentSha256: 't' };
const sourceGraph = { nodes: [{ id: '150', nodeName: 'VALVE-N1' }], edges: [] };
const targetGraph = { nodes: [{ id: '5010', nodeName: '' }], edges: [] };
const row = {
  correspondenceId: 'node:150:5010', kind: 'NODE', sourceNodeId: '150', targetNodeId: '5010',
  status: 'HIGH', authority: 'ADJACENT_MATCH_BOUNDARY',
};
const correspondence = { status: 'READY', correspondenceIdentity: 'corr-a', nodeRows: [row], elementRows: [] };
const ledger = (corr, decisions = {}) => createCiiWorkspaceReviewLedger(sourceDocument, targetDocument, [], corr, decisions);

const unreviewed = createCiiTransferPreview(sourceDocument, targetDocument, sourceGraph, targetGraph, correspondence, ledger(correspondence));
assert.strictEqual(unreviewed.operations.length, 0);
assert(unreviewed.blockers.includes('NO_REVIEWED_TRANSFER_PREVIEW_OPERATIONS'));

const reviewed = createCiiTransferPreview(sourceDocument, targetDocument, sourceGraph, targetGraph, correspondence, ledger(correspondence, {
  reviewedCorrespondenceIds: [row.correspondenceId],
}));
assert.strictEqual(reviewed.operations.length, 1);
assert.strictEqual(reviewed.operations[0].property, 'NodeName');
assert.strictEqual(reviewed.operations[0].proposed, 'VALVE-N1');
assert.strictEqual(reviewed.operations[0].matchAuthority.status, 'REVIEWED');
assert.strictEqual(reviewed.operations[0].matchAuthority.candidateStatus, 'HIGH');

const locked = createCiiTransferPreview(sourceDocument, targetDocument, sourceGraph, targetGraph, correspondence, ledger(correspondence, {
  lockedCorrespondenceIds: [row.correspondenceId],
}));
assert.strictEqual(locked.operations.length, 1);
assert.strictEqual(locked.operations[0].matchAuthority.status, 'LOCKED');
assert.strictEqual(locked.operations[0].matchAuthority.candidateStatus, 'HIGH', 'engineer LOCK is authority and must not rewrite computed confidence');

const stale = createCiiTransferPreview(sourceDocument, { ...targetDocument, contentSha256: 't2' }, sourceGraph, targetGraph, correspondence, ledger(correspondence, {
  lockedCorrespondenceIds: [row.correspondenceId],
}));
assert.strictEqual(stale.operations.length, 0);
assert(stale.blockers.includes('STALE_REVIEW_TARGET_IDENTITY'));

const insertedCorrespondence = {
  status: 'READY', correspondenceIdentity: 'corr-insert',
  nodeRows: [{ ...row, correspondenceId: 'insert:5010', sourceNodeId: null, status: 'INSERTED' }], elementRows: [],
};
const inserted = createCiiTransferPreview(sourceDocument, targetDocument, sourceGraph, targetGraph, insertedCorrespondence, ledger(insertedCorrespondence, {
  lockedCorrespondenceIds: ['insert:5010'],
}));
assert.strictEqual(inserted.operations.length, 0);

const conflictedCorrespondence = {
  status: 'CONFLICT', correspondenceIdentity: 'corr-conflict', nodeRows: [{ ...row, status: 'CONFLICT' }], elementRows: [],
};
const conflicted = createCiiTransferPreview(sourceDocument, targetDocument, sourceGraph, targetGraph, conflictedCorrespondence, ledger(conflictedCorrespondence, {
  lockedCorrespondenceIds: [row.correspondenceId],
}));
assert.strictEqual(conflicted.operations.length, 0);
assert(conflicted.blockers.includes('CORRESPONDENCE_CONTAINS_STRUCTURAL_CONFLICT'));

console.log('CII Workspace bound-review/LOCKED NodeName custody checks passed.');
