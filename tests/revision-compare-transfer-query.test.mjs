import assert from 'node:assert/strict';
import { deriveRevisionCompareTransferCandidates } from '../tabs/revision-compare/revision-transfer-candidates.js';
import { applyRevisionCompareTransferDraftAction, createRevisionCompareTransferReviewState, updateRevisionCompareTransferPresentation } from '../tabs/revision-compare/revision-transfer-review-state.js';
import { queryRevisionCompareTransferCandidates } from '../tabs/revision-compare/revision-transfer-query.js';
import { revisionCompareTransferMarkup } from '../tabs/revision-compare/revision-transfer-view.js';
import { productivityState } from './revision-compare-transfer-productivity-fixtures.mjs';

const state = productivityState(75, { blocked: true }); const candidates = deriveRevisionCompareTransferCandidates(state);
let review = createRevisionCompareTransferReviewState();
let query = queryRevisionCompareTransferCandidates(candidates, review.draft, review.presentation);
assert.equal(query.entries.length, 50); assert.equal(query.summary.totalCandidatePairs, 75); assert.equal(query.pageCount, 2);
review = updateRevisionCompareTransferPresentation(review, { page: 2 });
query = queryRevisionCompareTransferCandidates(candidates, review.draft, review.presentation); assert.equal(query.entries.length, 25);
const firstPageId = candidates[0].differenceId; const searchReview = updateRevisionCompareTransferPresentation(review, { search: firstPageId, page: 2 });
query = queryRevisionCompareTransferCandidates(candidates, review.draft, searchReview.presentation); assert.equal(query.presentation.page, 1); assert.equal(query.entries.length, 1);
const blockerReview = updateRevisionCompareTransferPresentation(review, { search: 'parent path resolves', page: 1 });
const blockerQuery = queryRevisionCompareTransferCandidates(candidates, review.draft, blockerReview.presentation);
assert(blockerQuery.entries.some((entry) => entry.fields.some((field) => field.blockers.some((item) => /parent path resolves/.test(item)))));
let draft = applyRevisionCompareTransferDraftAction(review.draft, candidates, { kind: 'SELECT_VISIBLE', entries: query.entries });
assert.equal(draft.revision, 1); assert.equal(draft.pairs.length, 1);
const selected = updateRevisionCompareTransferPresentation(review, { eligibilityFilter: 'SELECTED', selectedOnly: true, search: '', page: 1 });
query = queryRevisionCompareTransferCandidates(candidates, draft, selected.presentation); assert.equal(query.entries.length, 1);
const allowed = updateRevisionCompareTransferPresentation(review, { policyFilter: 'ALLOWED', propertyGroupFilter: 'DESCRIPTION', matchFilter: 'EXACT', search: '', page: 1 });
query = queryRevisionCompareTransferCandidates(candidates, draft, allowed.presentation);
assert(query.entries.every((entry) => entry.candidate.matchCertainty === 'EXACT'));
assert(query.entries.every((entry) => entry.fields.every((field) => field.policy.classification === 'ALLOWED' && field.propertyGroup === 'DESCRIPTION')));
const descending = updateRevisionCompareTransferPresentation(review, { sortKey: 'SOURCE_ENTITY_ID', sortDirection: 'DESC', pageSize: 25 });
const first = queryRevisionCompareTransferCandidates(candidates, draft, descending.presentation);
const second = queryRevisionCompareTransferCandidates(candidates, draft, descending.presentation);
assert.deepEqual(first.entries.map((entry) => entry.candidate.differenceId), second.entries.map((entry) => entry.candidate.differenceId));
assert.equal(first.entries.length, 25); assert.equal(first.summary.selectedFields, 1);
assert.deepEqual(first.summary.selectedFieldsByPropertyGroup, { DESCRIPTION: 1 });
const tiedCandidates = Object.freeze([
  Object.freeze({ ...candidates[1], differenceId: 'difference:z', sourceRecordId: 'same-source' }),
  Object.freeze({ ...candidates[0], differenceId: 'difference:a', sourceRecordId: 'same-source' }),
]);
const tied = queryRevisionCompareTransferCandidates(tiedCandidates, review.draft, updateRevisionCompareTransferPresentation(review, { sortKey: 'SOURCE_ENTITY_ID', sortDirection: 'ASC' }).presentation);
assert.deepEqual(tied.entries.map((entry) => entry.candidate.differenceId), ['difference:a', 'difference:z']);
const markup = revisionCompareTransferMarkup({ ...state, transferReview: { ...review, draft }, transfer: state.transfer }, { candidates, draft, review: { ...review, draft }, query: first, counts: { pairCount: 1, fieldCount: 1 } });
for (const selector of ['data-revc-transfer-search','data-revc-transfer-eligibility-filter','data-revc-transfer-policy-filter','data-revc-transfer-property-group-filter','data-revc-transfer-match-filter','data-revc-transfer-selected-only','data-revc-transfer-sort','data-revc-transfer-page','data-revc-transfer-page-size','data-revc-transfer-select-visible','data-revc-transfer-clear-visible','data-revc-transfer-clear-all','data-revc-transfer-visible-count','data-revc-transfer-total-count','data-revc-transfer-selected-field-count']) assert.match(markup, new RegExp(selector));
assert.equal((markup.match(/data-revc-transfer-pair-row=/g) ?? []).length, 25, 'only current page renders');
const querySource = await (await import('node:fs/promises')).readFile(new URL('../tabs/revision-compare/revision-transfer-query.js', import.meta.url), 'utf8');
assert.doesNotMatch(querySource, /localeCompare|querySelector|innerHTML/);
console.log('revision-compare-transfer-query.test.mjs passed');
