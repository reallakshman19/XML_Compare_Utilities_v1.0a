import assert from 'assert';
import {
  buildCiiSelectedBaseLoops, ciiApplyBaseSelection, ciiAutomaticBaseSelection, ciiBaseSelectionSummary,
  ciiQualifiedLoopsForSuggestion, ciiSelectedAnchorPairs, ciiSuggestionSelectionKey,
} from '../tabs/cii-workspace/cii-workspace-base-loop-selection.js';

function methodABase(baseId = 'A_LOCAL_1', pairs = [['10','110'],['20','120'],['30','130'],['40','140']], weight = 90) {
  return { status: 'READY', bestBase: { baseId, weight: { total: weight }, anchorPairs: pairs.map(([sourceNodeId, targetNodeId]) => ({ sourceNodeId, targetNodeId })) } };
}
function methodB(status = 'READY') { return { status }; }
function row(sourceNodeId, targetNodeId, basisMethod, overrides = {}) {
  const hasA = basisMethod === 'METHOD_A_SPATIAL' || basisMethod === 'METHOD_A_AND_B';
  const hasB = basisMethod === 'METHOD_B_NETWORK' || basisMethod === 'METHOD_A_AND_B';
  return {
    sourceNodeId, targetNodeId, basisMethod,
    methodA: hasA ? methodABase() : { status: 'UNAVAILABLE' },
    methodB: hasB ? methodB() : null,
    methodBWeight: hasB ? { total: 85 } : null,
    confidence: 'HIGH', winnerGap: 15, score: 90,
    candidateGeneration: { authorityRole: 'CANDIDATE_GENERATION_ONLY' },
    ...overrides,
  };
}

const ab = row('10', '110', 'METHOD_A_AND_B');
const abLoops = ciiQualifiedLoopsForSuggestion(ab);
assert.strictEqual(abLoops.length, 2, 'A+B acceptance must project two independent loops');
assert.strictEqual(abLoops[0].method, 'METHOD_A_SPATIAL');
assert.strictEqual(abLoops[0].anchorPairs.length, 4, 'Method A loop must carry the entire validated local base, not only clicked pair');
assert.strictEqual(abLoops[1].method, 'METHOD_B_NETWORK');
assert.deepStrictEqual(abLoops[1].anchorPairs, [{ sourceNodeId: '10', targetNodeId: '110' }]);

const aSibling = row('20', '120', 'METHOD_A_SPATIAL', { methodA: methodABase('A_LOCAL_1') });
const selectedSameA = new Set([ciiSuggestionSelectionKey(ab), ciiSuggestionSelectionKey(aSibling)]);
const deduped = buildCiiSelectedBaseLoops([ab, aSibling], selectedSameA);
assert.strictEqual(deduped.filter((loop) => loop.method === 'METHOD_A_SPATIAL').length, 1, 'same spatial base selected through two cards must dedupe once');
assert.strictEqual(deduped.filter((loop) => loop.method === 'METHOD_B_NETWORK').length, 1, 'A+B card must still retain its independent B loop');

const otherA = row('200', '1200', 'METHOD_A_SPATIAL', {
  methodA: methodABase('A_LOCAL_2', [['200','1200'],['210','1210'],['220','1220'],['230','1230']]),
});
const independent = buildCiiSelectedBaseLoops([ab, otherA], new Set([ciiSuggestionSelectionKey(ab), ciiSuggestionSelectionKey(otherA)]));
assert.strictEqual(independent.filter((loop) => loop.method === 'METHOD_A_SPATIAL').length, 2, 'different local Method A transforms must remain independent OR bases');

const bConflict1 = row('500', '1500', 'METHOD_B_NETWORK', { methodA: { status: 'UNAVAILABLE' }, methodB: methodB() });
const bConflict2 = row('500', '2500', 'METHOD_B_NETWORK', { methodA: { status: 'UNAVAILABLE' }, methodB: methodB() });
const conflictsPreserved = buildCiiSelectedBaseLoops([bConflict1, bConflict2], new Set([ciiSuggestionSelectionKey(bConflict1), ciiSuggestionSelectionKey(bConflict2)]));
assert.strictEqual(conflictsPreserved.length, 2, 'same SOURCE claiming two TARGETs must reach core conflict veto; UI must not majority-vote or dedupe it away');
assert.deepStrictEqual(conflictsPreserved.map((loop) => loop.anchorPairs[0].targetNodeId), ['1500','2500']);

const landmark = row('700', '1700', 'LANDMARK_ONLY', { methodA: { status: 'UNAVAILABLE' }, methodB: methodB('READY') });
assert.deepStrictEqual(ciiQualifiedLoopsForSuggestion(landmark), [], 'LANDMARK_ONLY must not silently become Method B even if local run math alone is READY');

const canonicalReviewOnly = row('800', '1800', 'METHOD_B_NETWORK', {
  methodA: { status: 'UNAVAILABLE' },
  methodB: methodB('READY'),
  candidateGeneration: {
    method: 'SMART_NODE_NAME_REVIEW_DISCOVERY',
    authorityRole: 'REVIEW_DISCOVERY_ONLY_NOT_IDENTITY_AUTHORITY',
    reviewDiscovery: {
      authority: 'EXISTING_NODE_NAME_REVIEW_DISCOVERY_ONLY',
      reviewOnly: true,
      sourceNodeName: 'SL-106.3',
      targetNodeName: 'SL-106.4',
      canonicalKey: 'SL-106',
    },
  },
  identityExclusions: ['NODE_NAME_USED_FOR_REVIEW_DISCOVERY_NOT_IDENTITY_AUTHORITY'],
});
assert.deepStrictEqual(
  ciiQualifiedLoopsForSuggestion(canonicalReviewOnly),
  [],
  'canonical Node Name review discovery must never project a Method A/B loop into correspondence authority',
);
assert.deepStrictEqual(
  buildCiiSelectedBaseLoops([canonicalReviewOnly], new Set([ciiSuggestionSelectionKey(canonicalReviewOnly)])),
  [],
  'selecting a review-only canonical name card must remain a manual-review fallback, never automatic anchor authority',
);
assert.strictEqual(
  ciiAutomaticBaseSelection([canonicalReviewOnly]).status,
  'REVIEW_REQUIRED',
  'Auto Anchor must never promote canonical/exact-name review discovery into physical identity authority',
);

const automaticStrong = row('900', '1900', 'METHOD_A_AND_B', {
  confidence: 'HIGH', winnerGap: 18, score: 94,
  methodA: methodABase('AUTO_STRONG', [['900','1900'],['910','1910'],['920','1920'],['930','1930']], 95),
  methodBWeight: { total: 92 },
});
const automaticWeaker = row('940', '1940', 'METHOD_B_NETWORK', {
  confidence: 'MEDIUM', winnerGap: 10, score: 88, methodA: { status: 'UNAVAILABLE' }, methodBWeight: { total: 72 },
});
const automatic = ciiAutomaticBaseSelection([automaticWeaker, automaticStrong]);
assert.strictEqual(automatic.status, 'READY');
assert.deepStrictEqual(automatic.selectionKeys, ['900=>1900'], 'Auto Anchor must deterministically choose strongest qualified topology evidence, independent of input order');
assert.strictEqual(automatic.baseLoops.length, 2, 'A+B Auto Anchor must retain both independently qualified loops');

const reviewConfidence = row('950', '1950', 'METHOD_A_SPATIAL', { confidence: 'REVIEW' });
assert.strictEqual(ciiAutomaticBaseSelection([reviewConfidence]).status, 'REVIEW_REQUIRED', 'REVIEW-confidence bases require human acceptance');

const tiedB1 = row('960', '1960', 'METHOD_B_NETWORK', {
  confidence: 'MEDIUM', winnerGap: 10, score: 80, methodA: { status: 'UNAVAILABLE' }, methodBWeight: { total: 75 },
});
const tiedB2 = row('970', '1970', 'METHOD_B_NETWORK', {
  confidence: 'MEDIUM', winnerGap: 10, score: 80, methodA: { status: 'UNAVAILABLE' }, methodBWeight: { total: 75 },
});
const ambiguousAuto = ciiAutomaticBaseSelection([tiedB2, tiedB1]);
assert.strictEqual(ambiguousAuto.status, 'AMBIGUOUS', 'equal-strength different physical topology outcomes must block automatic selection');
assert.deepStrictEqual(ambiguousAuto.selectionKeys, []);

const sameBase1 = row('980', '1980', 'METHOD_A_SPATIAL', {
  confidence: 'MEDIUM', winnerGap: 9, score: 82,
  methodA: methodABase('AUTO_EQUIVALENT', [['980','1980'],['981','1981'],['982','1982']], 80), methodBWeight: null,
});
const sameBase2 = row('981', '1981', 'METHOD_A_SPATIAL', {
  confidence: 'MEDIUM', winnerGap: 9, score: 82,
  methodA: methodABase('AUTO_EQUIVALENT', [['980','1980'],['981','1981'],['982','1982']], 80), methodBWeight: null,
});
const equivalentAuto = ciiAutomaticBaseSelection([sameBase2, sameBase1]);
assert.strictEqual(equivalentAuto.status, 'READY', 'equal-strength cards that project the same spatial base are equivalent, not ambiguous');
assert.strictEqual(equivalentAuto.outcomeSignature, 'A:AUTO_EQUIVALENT');

const threeAnchorReview = row('1', '101', 'METHOD_A_SPATIAL', {
  methodA: methodABase('A_REVIEW_3', [['1','101'],['2','102'],['3','103']]), methodB: null,
});
assert.strictEqual(ciiQualifiedLoopsForSuggestion(threeAnchorReview)[0].anchorPairs.length, 3, 'engineer may explicitly accept a mathematically READY 3-anchor REVIEW base');

const anchors = ciiSelectedAnchorPairs(independent);
assert.strictEqual(new Set(anchors.map((item) => `${item.sourceNodeId}:${item.targetNodeId}`)).size, anchors.length, 'accepted-anchor custody projection must dedupe duplicate A/B pair evidence');
const summary = ciiBaseSelectionSummary(independent);
assert.deepStrictEqual(summary, { loopCount: 3, methodA: 2, methodB: 1, combination: 'OR_WITH_CONFLICT_VETO' });

const fileInput = { sourceText: 'S', targetText: 'T', anchorPairs: [{ sourceNodeId: 'OLD', targetNodeId: 'OLD' }] };
const explicit = ciiApplyBaseSelection(fileInput, independent, []);
assert.strictEqual(explicit.anchorPairs, undefined, 'explicit base-loop mode must remove stale flat anchorPairs');
assert.strictEqual(explicit.baseLoops.length, 3);
const legacy = ciiApplyBaseSelection({ sourceText: 'S', targetText: 'T', baseLoops: independent }, [], [{ sourceNodeId: '9', targetNodeId: '99' }]);
assert.strictEqual(legacy.baseLoops, undefined, 'legacy/manual mode must remove stale explicit baseLoops');
assert.deepStrictEqual(legacy.anchorPairs, [{ sourceNodeId: '9', targetNodeId: '99' }]);

console.log('CII independent multi-base UI selection projection checks passed.');
