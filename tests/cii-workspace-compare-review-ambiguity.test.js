import assert from 'assert';
import { buildCiiCompareReviewModel } from '../tabs/cii-workspace/cii-workspace-compare-review.js';

const source = { fileName: 'SOURCE.CII', summary: { nodeCount: 2, elementCount: 1 } };
const target = { fileName: 'TARGET.CII', summary: { nodeCount: 2, elementCount: 1 } };
const correspondence = {
  status: 'READY', nodeRows: [], componentRows: [], elementRows: [{
    correspondenceId: 'element:S:T', kind: 'ELEMENT', sourceElementId: 'S', targetElementIds: ['T'], status: 'REVIEW',
    evidence: { candidates: {
      status: 'AMBIGUOUS', winnerIdentityConfidence: 'HIGH', winnerTargetElementId: 'T', winnerGap: 2, requiredWinnerGap: 8,
      reasons: ['WINNER_GAP_NOT_SATISFIED'], methodWinners: { m1Spatial: 'T', m2Network: 'T', disagree: false },
      rankedCandidates: [{ targetElementId: 'T', identityConfidence: 'HIGH', score: 100, rankingScore: 95,
        methods: { m1Spatial: { pass: true, available: true, score: 100 }, m2Network: { pass: true, available: true, score: 90 } },
        dimensions: { diameter: { pass: true, available: true }, wall: { pass: true, available: true } } }],
    } },
  }],
};
const deltaSet = { rows: [], summary: { engineeringChangeCount: 0, changeFamilyCounts: {} }, limitations: [] };
const review = { reviewedCorrespondenceIds: [], rejectedCorrespondenceIds: [], lockedCorrespondenceIds: [] };
const model = buildCiiCompareReviewModel(source, target, correspondence, review, deltaSet);
assert.strictEqual(model.rows[0].confidence, 'REVIEW', 'candidate-set ambiguity must override the individual winner HIGH score');
assert.strictEqual(model.rows[0].identityBound, false);
assert.strictEqual(model.summary.correspondence.confidence.REVIEW, 1);
assert.strictEqual(model.summary.correspondence.confidence.HIGH, 0);
console.log('CII Compare Review ambiguity projection checks passed.');
