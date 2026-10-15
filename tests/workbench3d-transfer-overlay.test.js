// Visual transfer workflow model layer: score bands, delta labels, pair drop,
// global property override round-trip, and excludeProperties in buildTransferPlan.
import assert from 'assert';
import {
  scoreBand, scoreBandColor, SCORE_BAND_COLORS, deltaLabel,
  transferPairsModel, globalPropertyModel, dropPairProperty, dropPropertyGlobally,
} from '../workbench3d/ui/transfer-overlay-models.js';
import { buildTransferPlan, batchApprove, GLOBAL_OVERRIDE_REASON } from '../workbench3d/compare/transfer-planner.js';
import { APPROVAL_STATUS, CONFIDENCE, TRANSFER_RULES, DIFF_STATUS } from '../workbench3d/contracts/contracts.js';

// ── score bands ───────────────────────────────────────────────────────────
assert.equal(scoreBand(95), 'high');
assert.equal(scoreBand(90), 'mid', '90 belongs to the 70–90 band');
assert.equal(scoreBand(90.01), 'high');
assert.equal(scoreBand(70), 'mid', '70 is inclusive lower bound of mid');
assert.equal(scoreBand(69.99), 'low');
assert.equal(scoreBand(null), null);
assert.equal(scoreBandColor(95), SCORE_BAND_COLORS.high);
assert.equal(scoreBandColor(80), SCORE_BAND_COLORS.mid);
assert.equal(scoreBandColor(10), SCORE_BAND_COLORS.low);
assert.equal(scoreBandColor(95, { basis: true }), SCORE_BAND_COLORS.basis, 'basis always gold');
assert.equal(scoreBandColor('n/a'), null);

// ── delta labels ──────────────────────────────────────────────────────────
assert.equal(deltaLabel({ kind: 'attribute', property: 'RATING', newValue: '150' }), 'RATING=150');
assert.equal(deltaLabel({ kind: 'packet', property: 'PACKET:RESTRAINT', newValue: '{"TYPE":"+Y"}' }), '+PACKET:RESTRAINT');
assert.equal(deltaLabel(null), '');

// ── synthetic audit/topos → plan fixture ──────────────────────────────────
const edge = (id, properties, packets = []) => ({ id, properties, packets, rawIndex: 0 });
const topoA = { edges: [
  edge('source:E1', { RATING: '150', BOREMM: '200', ELEMENTLENGTHMM: '1000' }),
  edge('source:E2', { RATING: '300', BOREMM: '250' }, [{ kind: 'RESTRAINT', attrs: { TYPE: '+Y' } }]),
] };
const topoB = { edges: [
  edge('target:E1', { RATING: '', BOREMM: '', ELEMENTLENGTHMM: '' }),
  edge('target:E2', { RATING: '', BOREMM: '' }),
] };
const audit = {
  objectDiff: { rows: [
    { diffId: 'D1', status: DIFF_STATUS.PROPERTY_CHANGED, sourceObjectId: 'source:E1', targetObjectId: 'target:E1', confidence: CONFIDENCE.HIGH, score: 96, reasons: [] },
    { diffId: 'D2', status: DIFF_STATUS.PROPERTY_CHANGED, sourceObjectId: 'source:E2', targetObjectId: 'target:E2', confidence: CONFIDENCE.HIGH, score: 82, reasons: [] },
  ] },
};

const plan = buildTransferPlan(audit, topoA, topoB, { rule: TRANSFER_RULES.FILL_BLANK_ONLY, minConfidence: CONFIDENCE.HIGH });
assert.ok(plan.rows.length >= 5, `plan rows built (got ${plan.rows.length})`);
batchApprove(plan, CONFIDENCE.HIGH);
assert.equal(plan.summary.approvedRows, plan.rows.length, 'all rows approved');

// ── transferPairsModel ────────────────────────────────────────────────────
const pairs = transferPairsModel(plan);
assert.equal(pairs.length, 2);
const pair1 = pairs.find((p) => p.pairKey === 'source:E1|target:E1');
assert.ok(pair1.deltaLabels.includes('RATING=150'), `deltas: ${pair1.deltaLabels}`);
assert.equal(pair1.score, 96, 'pair carries diff score');
const pair2 = pairs.find((p) => p.pairKey === 'source:E2|target:E2');
assert.ok(pair2.deltaLabels.some((l) => l.startsWith('+PACKET:RESTRAINT')), 'packet delta labelled');

// ── dropPairProperty (arrow "X") ──────────────────────────────────────────
const touched = dropPairProperty(plan, { sourceObjectId: 'source:E1', targetObjectId: 'target:E1', property: 'RATING' });
assert.equal(touched, 1);
const ratingRow1 = plan.rows.find((r) => r.sourceObjectId === 'source:E1' && r.property === 'RATING');
assert.equal(ratingRow1.approval, APPROVAL_STATUS.REJECTED);
const ratingRow2 = plan.rows.find((r) => r.sourceObjectId === 'source:E2' && r.property === 'RATING');
assert.equal(ratingRow2.approval, APPROVAL_STATUS.APPROVED, 'other pairs untouched');
assert.equal(transferPairsModel(plan).find((p) => p.pairKey === 'source:E1|target:E1').deltaLabels.includes('RATING=150'), false, 'dropped row leaves the labels');

// ── dropPropertyGlobally round-trip ("X(~)" / Global override) ────────────
const transferConfig = { excludeProperties: [] };
dropPropertyGlobally(plan, transferConfig, 'BOREMM', true);
assert.deepEqual(transferConfig.excludeProperties, ['BOREMM']);
for (const row of plan.rows.filter((r) => r.property === 'BOREMM')) {
  assert.equal(row.approval, APPROVAL_STATUS.BLOCKED);
  assert.equal(row.blockedReason, GLOBAL_OVERRIDE_REASON);
}
assert.equal(plan.summary.blockedRows >= 2, true);

// un-drop restores PENDING (not APPROVED), never resurrects REJECTED rows
dropPropertyGlobally(plan, transferConfig, 'BOREMM', false);
assert.deepEqual(transferConfig.excludeProperties, []);
for (const row of plan.rows.filter((r) => r.property === 'BOREMM')) {
  assert.equal(row.approval, APPROVAL_STATUS.PENDING);
  assert.equal(row.blockedReason, null);
}
assert.equal(ratingRow1.approval, APPROVAL_STATUS.REJECTED, 'individually rejected row stays rejected');

// globally exclude RATING: the REJECTED row must stay REJECTED, the approved one blocks
dropPropertyGlobally(plan, transferConfig, 'RATING', true);
assert.equal(ratingRow1.approval, APPROVAL_STATUS.REJECTED);
assert.equal(ratingRow2.approval, APPROVAL_STATUS.BLOCKED);
dropPropertyGlobally(plan, transferConfig, 'RATING', false);
assert.equal(ratingRow1.approval, APPROVAL_STATUS.REJECTED, 'restore does not resurrect rejected rows');

// ── fresh buildTransferPlan respects excludeProperties ────────────────────
const excludedPlan = buildTransferPlan(audit, topoA, topoB, {
  rule: TRANSFER_RULES.FILL_BLANK_ONLY, minConfidence: CONFIDENCE.HIGH, excludeProperties: ['ELEMENTLENGTHMM'],
});
const lengthRows = excludedPlan.rows.filter((r) => r.property === 'ELEMENTLENGTHMM');
assert.ok(lengthRows.length > 0);
for (const row of lengthRows) {
  assert.equal(row.approval, APPROVAL_STATUS.BLOCKED);
  assert.equal(row.blockedReason, GLOBAL_OVERRIDE_REASON);
}
batchApprove(excludedPlan, CONFIDENCE.HIGH);
for (const row of lengthRows) assert.equal(row.approval, APPROVAL_STATUS.BLOCKED, 'batch approve never lifts global override');

// ── globalPropertyModel ───────────────────────────────────────────────────
const globalModel = globalPropertyModel(excludedPlan, ['ELEMENTLENGTHMM']);
const lengthEntry = globalModel.find((e) => e.property === 'ELEMENTLENGTHMM');
assert.equal(lengthEntry.excluded, true);
assert.equal(lengthEntry.pairCount, 1);
const boreEntry = globalModel.find((e) => e.property === 'BOREMM');
assert.equal(boreEntry.excluded, false);
assert.equal(boreEntry.pairCount, 2);

console.log(`workbench3d-transfer-overlay.test.js passed — pairs=${pairs.length} globalProps=${globalModel.length}`);
