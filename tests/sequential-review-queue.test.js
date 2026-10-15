import assert from 'node:assert/strict';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import { createSequentialBranchWorkspaceRegistry } from '../tabs/sequential-sketcher/sequential-branch-workspace-state.js';
import {
  adjacentSequentialReviewRow,
  buildSequentialBlockedReviewQueue,
  filterSequentialBlockedReviewQueue,
  refreshSequentialBlockedReviewQueue,
} from '../tabs/sequential-sketcher/review/sequential-blocked-review-queue.js';
import { applyConstructionDecision } from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { DECISION_ACTIONS } from '../tabs/sequential-sketcher/construction/sequential-construction-contract.js';

function pipe(name, start, end) {
  return { type: 'PIPE', name, attributes: { APOS: start, LPOS: end } };
}
function branch(name, attributes, children) {
  return { type: 'BRANCH', name, attributes: { NAME: name, ...attributes }, children };
}

const completeId = '/QUEUE/S100/B1';
const ambiguousId = '/QUEUE/S200/B1';
const missingId = '/QUEUE/S300/B1';
const records = [
  branch(completeId, { HPOS: { x: 0, y: 0, z: 0 } }, [
    pipe('COMPLETE-P1', { x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }),
    { type: 'CAP', name: 'COMPLETE-C1', attributes: { APOS: { x: 100, y: 0, z: 0 } } },
  ]),
  branch(ambiguousId, { HPOS: { x: 0, y: 0, z: 0 } }, [
    pipe('AMBIG-P1', { x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }),
  ]),
  branch(missingId, {
    HPOS: { x: 0, y: 0, z: 0 },
    TREF: '/QUEUE/MISSING/TARGET',
  }, [
    pipe('MISSING-P1', { x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }),
  ]),
];
const evidence = buildSequentialEvidenceModel(records);
const indexes = indexSequentialEvidence(evidence);
const queue = buildSequentialBlockedReviewQueue(evidence, indexes, {});

assert.equal(queue.schema, 'SequentialBlockedBranchReviewQueue.v1');
assert.equal(queue.rows.length, 3);
assert.equal(queue.snapshots.length, 3);
assert.equal(queue.summary.branchCount, 3);
assert.equal(queue.summary.unresolvedCount, 2);
assert.equal(queue.summary.completeCount, 1);
assert.equal(queue.summary.manuallyResolvedCount, 0);
assert.equal(queue.summary.deferredCount, 0);
assert.equal(queue.summary.failedCount, 0);
assert.deepEqual(
  queue.groups.map((row) => [row.reason, row.count]).sort(),
  [
    ['AMBIGUOUS_BRANCH_START', 1],
    ['REFERENCE_TARGET_MISSING', 1],
  ],
);

const ambiguous = queue.rows.find((row) => row.branchId === ambiguousId);
const missing = queue.rows.find((row) => row.branchId === missingId);
const complete = queue.rows.find((row) => row.branchId === completeId);
assert.equal(ambiguous.reviewStatus, 'UNRESOLVED');
assert.equal(ambiguous.blockedReason, 'AMBIGUOUS_BRANCH_START');
assert.equal(ambiguous.expectedContinuationCategory, 'HEAD_BOUNDARY');
assert.equal(ambiguous.missingEvidenceClass, 'SOURCE_BOUNDARY_AMBIGUITY');
assert.equal(missing.blockedReason, 'REFERENCE_TARGET_MISSING');
assert.equal(missing.expectedContinuationCategory, 'REFERENCE_TARGET');
assert.equal(missing.missingEvidenceClass, 'REFERENCE_NORMALIZATION_OR_EXTERNAL_SCOPE');
assert.equal(complete.reviewStatus, 'COMPLETE');
assert.equal(complete.state, 'ROUTE_COMPLETE');
assert.ok(complete.constructionFingerprint);

const unresolvedRows = filterSequentialBlockedReviewQueue(queue, { status: 'UNRESOLVED' });
assert.equal(unresolvedRows.length, 2);
assert.deepEqual(
  filterSequentialBlockedReviewQueue(queue, { status: 'UNRESOLVED', reason: 'REFERENCE_TARGET_MISSING' }).map((row) => row.branchId),
  [missingId],
);
assert.deepEqual(
  filterSequentialBlockedReviewQueue(queue, { status: 'ALL', search: 's200' }).map((row) => row.branchId),
  [ambiguousId],
);
assert.equal(adjacentSequentialReviewRow(unresolvedRows, unresolvedRows[0].reviewId, 1).reviewId, unresolvedRows[1].reviewId);
assert.equal(adjacentSequentialReviewRow(unresolvedRows, unresolvedRows[0].reviewId, -1).reviewId, unresolvedRows[0].reviewId);

const registry = createSequentialBranchWorkspaceRegistry();
registry.reset(evidence.branches.map((row) => row.branchId));
for (const snapshot of queue.snapshots) registry.save(snapshot.branchId, { session: snapshot.session });
const ambiguousSession = registry.get(ambiguousId).session;
const deferred = applyConstructionDecision(
  ambiguousSession,
  evidence,
  indexes,
  DECISION_ACTIONS.DEFER_DECISION,
  {
    reason: 'Await approved flow direction',
    evidenceNote: 'Field arrow and line-list confirmation are pending.',
  },
  {},
);
registry.save(ambiguousId, { session: deferred.session });
const refreshed = refreshSequentialBlockedReviewQueue(queue, registry, evidence, indexes);
const refreshedAmbiguous = refreshed.rows.find((row) => row.branchId === ambiguousId);
assert.equal(refreshedAmbiguous.reviewStatus, 'DEFERRED');
assert.equal(refreshedAmbiguous.deferredReason, 'Await approved flow direction');
assert.equal(refreshed.summary.unresolvedCount, 1);
assert.equal(refreshed.summary.deferredCount, 1);
assert.equal(filterSequentialBlockedReviewQueue(refreshed, { status: 'DEFERRED' })[0].branchId, ambiguousId);

assert.equal(queue.rows.find((row) => row.branchId === ambiguousId).reviewStatus, 'UNRESOLVED', 'refresh must not mutate the original queue');
assert.equal(queue.snapshots.find((row) => row.branchId === ambiguousId).session.currentDecisionRequest.state, 'OPEN');

console.log('sequential blocked review queue tests passed');
