import assert from 'node:assert/strict';
import { buildCiiCompareReviewModel } from '../tabs/cii-workspace/cii-workspace-compare-review.js';
import {
  ciiMultiSourceBulkEligibleRows,
  ciiMultiSourceReviewMarkup,
} from '../tabs/cii-workspace/cii-workspace-multisource-review-ui.js';

const source = { fileName: 'S3.CII', summary: { nodeCount: 2, elementCount: 2 } };
const target = { fileName: 'T.CII', summary: { nodeCount: 2, elementCount: 2 } };
const deltaSet = { rows: [], summary: { engineeringChangeCount: 0, changeFamilyCounts: {} }, limitations: [] };
const review = { reviewedCorrespondenceIds: [], rejectedCorrespondenceIds: [], lockedCorrespondenceIds: [] };

function unresolved(id, candidates, propagation, targetElementIds = []) {
  return {
    correspondenceId: id, kind: 'ELEMENT', sourceElementId: id,
    targetElementIds, status: 'UNRESOLVED', authority: 'ANCHOR_PROPAGATION_FRONTIER_BLOCKED',
    evidence: { ...(candidates ? { candidates } : {}), propagation },
  };
}
const correspondence = {
  status: 'UNRESOLVED', nodeRows: [{
    correspondenceId: 'locked', kind: 'NODE', sourceNodeId: '1560',
    targetNodeId: '7880', status: 'LOCKED', authority: 'USER_LOCKED_ANCHOR',
  }], componentRows: [], elementRows: [
    unresolved('E15', {
      status: 'AMBIGUOUS', winnerGap: 65.1, requiredWinnerGap: 8,
      winnerTargetElementId: 'T7', reasons: ['ALIGNMENT_TARGET_NOT_BEST_CANDIDATE'],
      rankedCandidates: [{ targetElementId: 'T7', identityConfidence: 'HIGH', identitySupported: true }],
    }, { blocker: 'NO_SUPPORTED_FRONTIER_ASSIGNMENT', assignmentGap: null, requiredGap: null }),
    unresolved('E29', {
      status: 'AMBIGUOUS', winnerGap: 4.9, requiredWinnerGap: 8,
      winnerTargetElementId: 'T9', reasons: ['WINNER_GAP_NOT_SATISFIED'],
      rankedCandidates: [{ targetElementId: 'T9', identityConfidence: 'HIGH', identitySupported: true }],
    }, { blocker: 'FRONTIER_WINNER_GAP_NOT_SATISFIED', assignmentGap: 4.9, requiredGap: 8 }),
    unresolved('E30', null, { blocker: 'FRONTIER_CARDINALITY_MISMATCH' }),
    unresolved('E16', {
      status: 'AMBIGUOUS', winnerGap: 60, requiredWinnerGap: 8,
      reasons: ['METHOD_A_B_DISAGREE', '<script>unsafe</script>'],
      rankedCandidates: [],
    }, { blocker: 'NO_SUPPORTED_FRONTIER_ASSIGNMENT' }),
  ],
};
const model = buildCiiCompareReviewModel(source, target, correspondence, review, deltaSet);
const byId = new Map(model.rows.map(row => [row.correspondenceId, row]));
assert.equal(byId.get('locked').workflowStatus, 'LOCKED');
assert.equal(byId.get('locked').identityBound, true, 'manual authority unchanged');
for (const id of ['E15', 'E29', 'E30', 'E16']) {
  assert.equal(byId.get(id).identityBound, false, 'diagnostics must not confer identity');
  assert.equal(byId.get(id).workflowStatus, 'UNRESOLVED');
}
assert.equal(byId.get('E15').frontierBlocker, 'NO_SUPPORTED_FRONTIER_ASSIGNMENT');
assert.deepEqual([byId.get('E29').frontierGap, byId.get('E29').frontierRequiredGap], [4.9, 8]);
assert.equal(byId.get('E30').frontierBlocker, 'FRONTIER_CARDINALITY_MISMATCH');
assert.equal(ciiMultiSourceBulkEligibleRows({ compareReview: { rows: model.rows } }, new Map(), 'HIGH').length, 0);
assert.equal(ciiMultiSourceBulkEligibleRows({ compareReview: { rows: model.rows } }, new Map(), 'MEDIUM').length, 0);

const preview = {
  compareReview: { rows: model.rows.map(row => ({ ...row, sourceId: 'S3', memberCorrespondenceId: row.correspondenceId })) },
};
const markup = ciiMultiSourceReviewMarkup(preview);
assert.match(markup, /candidate winner gap 65\.1 ≥ required 8/, 'sufficient gap must not be displayed as smaller');
assert.doesNotMatch(markup, /winner gap 65\.1 &lt; required 8/, 'regression: mathematically false ambiguity message');
assert.match(markup, /candidate winner gap 4\.9 &lt; required 8/, 'real candidate shortfall');
assert.match(markup, /frontier winner gap 4\.9 &lt; required 8/, 'real assignment shortfall');
assert.match(markup, /NO_SUPPORTED_FRONTIER_ASSIGNMENT/, 'show actual first frontier blocker');
assert.match(markup, /ALIGNMENT_TARGET_NOT_BEST_CANDIDATE/, 'show exact distinct candidate reason');
assert.match(markup, /FRONTIER_CARDINALITY_MISMATCH/, 'show frontier blocker without candidate list');
assert.match(markup, /no TARGET ELEMENT assigned at this frontier/, 'unassigned target is not a chosen winner');
assert.match(markup, /METHOD_A_B_DISAGREE/, 'distinguish independent method disagreement');
assert.match(markup, /&lt;script&gt;unsafe&lt;\/script&gt;/, 'always escape evidence text');
assert.doesNotMatch(markup, /<script>unsafe<\/script>/);
assert.match(markup, /Manual reviewed anchor authority/, 'retained lock authority');
console.log('CII Writer2 frontier diagnostics: truthful causes, gaps, custody and HTML escaping PASS');
