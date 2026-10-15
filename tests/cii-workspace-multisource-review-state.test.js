import assert from 'node:assert/strict';
import {
  bulkAcceptCiiMultiSourceReview,
  ciiMultiSourceBulkAcceptOutcome,
  ciiMultiSourceBulkEligibleRows,
  ciiMultiSourceReviewState,
  ciiMultiSourceReviewSummaryMarkup,
} from '../tabs/cii-workspace/cii-workspace-multisource-review-ui.js';
import { ciiReviewControlProjection } from '../tabs/cii-workspace/cii-workspace-multisource-review-state-controls.js';

function row(id, confidence, overrides = {}) {
  return {
    correspondenceId: id,
    sourceId: 'S1', memberCorrespondenceId: id,
    confidence, identityBound: true, decision: 'REVIEW', workflowStatus: confidence,
    ...overrides,
  };
}

const preview = { compareReview: { rows: [
  row('high-pending', 'HIGH'),
  row('high-accepted', 'HIGH', { decision: 'ACCEPTED' }),
  row('high-unbound', 'HIGH', { identityBound: false }),
  row('high-locked', 'HIGH', { decision: 'LOCKED', workflowStatus: 'LOCKED' }),
  row('medium-pending', 'MEDIUM'),
] } };
const decisions = new Map();

const initial = ciiMultiSourceReviewState(preview, decisions);
assert.equal(initial.rowCount, 5);
assert.equal(initial.confidence.HIGH, 3, 'locked rows are counted separately from confidence totals');
assert.equal(initial.confidence.MEDIUM, 1);
assert.equal(initial.locked, 1);
assert.equal(initial.eligible.HIGH, 1, 'only HIGH rows whose decision would actually change are eligible');
assert.equal(initial.eligible.MEDIUM, 1);
assert.equal(initial.current.ACCEPT, 1, 'already-bound ACCEPTED remains visible but is not bulk-eligible');
assert.equal(initial.current.LOCK, 1);
assert.equal(initial.changedDecisionCount, 0);
assert.equal(initial.synchronized, true);
assert.deepEqual(ciiMultiSourceBulkEligibleRows(preview, decisions, 'HIGH').map((item) => item.correspondenceId), ['high-pending']);

const initialControls = ciiReviewControlProjection(initial, false);
assert.equal(initialControls.high.label, 'Accept eligible HIGH (1)');
assert.equal(initialControls.high.disabled, false);
assert.equal(initialControls.medium.label, 'Accept eligible MEDIUM (1)');
assert.equal(initialControls.apply.label, 'Review synchronized with Transfer Preview');
assert.equal(initialControls.apply.disabled, true);

const acceptedHigh = bulkAcceptCiiMultiSourceReview(preview, decisions, 'HIGH');
assert.equal(acceptedHigh, 1);
const afterHigh = ciiMultiSourceReviewState(preview, decisions);
assert.equal(afterHigh.eligible.HIGH, 0);
assert.equal(afterHigh.changedDecisionCount, 1);
assert.equal(afterHigh.changed.ACCEPT, 1);
assert.equal(afterHigh.current.ACCEPT, 2);
assert.equal(ciiMultiSourceBulkEligibleRows(preview, decisions, 'HIGH').length, 0);

const pendingControls = ciiReviewControlProjection(afterHigh, true);
assert.equal(pendingControls.high.label, 'Accept eligible HIGH (0)');
assert.equal(pendingControls.high.disabled, true);
assert.equal(pendingControls.apply.label, 'Apply 1 pending decision to Transfer Preview');
assert.equal(pendingControls.apply.disabled, false);

const secondHigh = ciiMultiSourceBulkAcceptOutcome(preview, decisions, 'HIGH');
assert.equal(secondHigh.count, 0);
assert.equal(secondHigh.changed, false, 'second bulk action must be a strict no-op');
assert.equal(secondHigh.state.changedDecisionCount, 1, 'existing pending decision remains pending; zero-op adds nothing');
assert.match(secondHigh.message, /No HIGH correspondence rows would change/);

const mediumOutcome = ciiMultiSourceBulkAcceptOutcome(preview, decisions, 'MEDIUM');
assert.equal(mediumOutcome.count, 1);
assert.equal(mediumOutcome.changed, true);
assert.equal(mediumOutcome.state.changedDecisionCount, 2);
assert.equal(mediumOutcome.state.eligible.MEDIUM, 0);
assert.match(mediumOutcome.message, /2 decision changes remain unapplied/);

// Revert the pending decisions to their preview baseline. The pure model must
// report synchronization even if an outer shell still has a stale dirty flag.
decisions.delete('high-pending');
decisions.delete('medium-pending');
const reverted = ciiMultiSourceReviewState(preview, decisions);
assert.equal(reverted.changedDecisionCount, 0);
assert.equal(reverted.synchronized, true);
const staleDirtyControls = ciiReviewControlProjection(reverted, true);
assert.equal(staleDirtyControls.apply.disabled, false);
assert.match(staleDirtyControls.apply.label, /Re-apply synchronized review/);

const summary = ciiMultiSourceReviewSummaryMarkup(preview, decisions);
assert.match(summary, /HIGH eligible/);
assert.match(summary, /MEDIUM eligible/);
assert.match(summary, /Unapplied/);
assert.match(summary, /Review decisions synchronized with the current Transfer Preview/);
assert.match(summary, /cii-ms-review-state-controls/);

console.log('CII multi-source review-state UX checks: PASS');
