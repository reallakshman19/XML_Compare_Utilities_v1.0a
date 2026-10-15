import assert from 'node:assert/strict';
import {
  applyRevisionCompareTransferDraftAction, createRevisionCompareTransferReviewState,
  reconcileRevisionCompareTransferDraft, replaceRevisionCompareTransferDraft,
  updateRevisionCompareTransferPresentation,
} from '../tabs/revision-compare/revision-transfer-review-state.js';
import { deriveRevisionCompareTransferCandidates } from '../tabs/revision-compare/revision-transfer-candidates.js';
import { createRevisionCompareTransferSelectionFromDraft } from '../tabs/revision-compare/revision-transfer-controller.js';
import { productivityState } from './revision-compare-transfer-productivity-fixtures.mjs';

const state = productivityState(4, { blocked: true, unreviewed: true });
const candidates = deriveRevisionCompareTransferCandidates(state);
const review = createRevisionCompareTransferReviewState();
assert.equal(review.schema, 'RevisionCompareTransferReviewState.v1');
assert.equal(review.presentation.pageSize, 50); assert.equal(Object.isFrozen(review), true);
const first = candidates[0]; const allowed = first.fields.find((field) => field.eligible);
const controlled = first.fields.find((field) => field.policy.classification === 'CONTROLLED');
const protectedField = first.fields.find((field) => field.policy.classification === 'PROTECTED');
const missingParent = first.fields.find((field) => field.blockers.some((item) => /parent path/.test(item)));
const arrayField = first.fields.find((field) => field.blockers.some((item) => /array insertion|array-member/.test(item)));
for (const field of [controlled, protectedField, missingParent, arrayField]) assert(field && !field.eligible);
let draft = applyRevisionCompareTransferDraftAction(review.draft, candidates, { kind: 'PAIR', differenceId: first.differenceId, checked: true });
assert.equal(draft.revision, 1); assert.deepEqual(draft.pairs[0].fieldKeys, []);
const retained = replaceRevisionCompareTransferDraft(review, draft);
assert.equal(retained.draft, draft, 'workspace-owned pair-only intent survives rerender state reuse');
assert.equal(createRevisionCompareTransferSelectionFromDraft(draft, candidates), null);
draft = applyRevisionCompareTransferDraftAction(draft, candidates, { kind: 'FIELD', differenceId: first.differenceId, fieldKey: allowed.fieldKey, checked: true });
assert.equal(draft.revision, 2); assert.equal(draft.pairs[0].fieldKeys.length, 1);
const selection = createRevisionCompareTransferSelectionFromDraft(draft, candidates);
assert.equal(selection.schema, 'RevisionCompareTransferSelection.v1'); assert.equal(selection.selectionRevision, 2);
const same = applyRevisionCompareTransferDraftAction(draft, candidates, { kind: 'FIELD', differenceId: first.differenceId, fieldKey: allowed.fieldKey, checked: true });
assert.equal(same, draft, 'no-op does not advance revision');
const pageEntries = candidates.slice(0, 3).map((candidate) => ({ candidate, fields: candidate.fields }));
const batched = applyRevisionCompareTransferDraftAction(draft, candidates, { kind: 'SELECT_VISIBLE', entries: pageEntries });
assert.equal(batched.revision, 3, 'one batch action advances once');
assert(batched.pairs.some((pair) => pair.differenceId === candidates[0].differenceId));
assert.equal(batched.pairs.some((pair) => pair.differenceId === candidates[1].differenceId), false, 'unreviewed blocked pair never batch-selects');
const keys = new Set(batched.pairs.flatMap((pair) => pair.fieldKeys));
for (const field of [controlled, protectedField, missingParent, arrayField]) assert.equal(keys.has(field.fieldKey), false);
const offPage = applyRevisionCompareTransferDraftAction(batched, candidates, { kind: 'PAIR', differenceId: candidates[3].differenceId, checked: true });
const offField = candidates[3].fields.find((field) => field.eligible);
const withOffPage = applyRevisionCompareTransferDraftAction(offPage, candidates, { kind: 'FIELD', differenceId: candidates[3].differenceId, fieldKey: offField.fieldKey, checked: true });
const authorityCandidates = candidates.filter((candidate) => candidate.differenceId !== first.differenceId);
const reconciled = reconcileRevisionCompareTransferDraft(withOffPage, authorityCandidates);
assert.equal(reconciled.revision, withOffPage.revision + 1, 'authority reconciliation advances draft revision once');
assert.equal(reconciled.pairs.some((pair) => pair.differenceId === first.differenceId), false, 'obsolete authority intent is removed');
assert(reconciled.pairs.some((pair) => pair.differenceId === candidates[3].differenceId), 'still-valid off-page intent is preserved');
assert.equal(reconcileRevisionCompareTransferDraft(reconciled, authorityCandidates), reconciled, 'stable authority reconciliation is a no-op');
const clearedVisible = applyRevisionCompareTransferDraftAction(withOffPage, candidates, { kind: 'CLEAR_VISIBLE', entries: pageEntries });
assert.equal(clearedVisible.revision, withOffPage.revision + 1); assert(clearedVisible.pairs.some((pair) => pair.differenceId === candidates[3].differenceId));
const clearedAll = applyRevisionCompareTransferDraftAction(clearedVisible, candidates, { kind: 'CLEAR_ALL' });
assert.equal(clearedAll.pairs.length, 0); assert.equal(clearedAll.revision, clearedVisible.revision + 1);
const presentation = updateRevisionCompareTransferPresentation(retained, { search: 'pipe', eligibilityFilter: 'ELIGIBLE', page: 9 });
assert.equal(presentation.draft, retained.draft); assert.equal(presentation.presentation.search, 'pipe');
console.log('revision-compare-transfer-review-state.test.mjs passed');

const { createRevisionCompareTransferController } = await import('../tabs/revision-compare/revision-transfer-controller.js');
let controllerState = structuredClone(state); controllerState.transferReview = createRevisionCompareTransferReviewState();
controllerState.transfer = { ...controllerState.transfer, status: 'PLANNED', plan: { planId: 'plan:old' } };
let draftTransitions = 0; let presentationTransitions = 0; let reconciliationTransitions = 0; let renders = 0;
const target = (attributes, values = {}) => ({
  ...values, dataset: values.dataset ?? {}, hasAttribute: (name) => attributes.includes(name),
});
const controller = createRevisionCompareTransferController({
  root: {}, now: () => '2026-07-24T18:00:00.000Z', cryptoRef: globalThis.crypto,
  readState: () => controllerState, writeState: (next) => { controllerState = next; }, render: () => { renders += 1; },
  reportFailure: (error) => { throw error; }, dependencies: {
    setReviewDraft(current, nextReview, nextSelection) {
      draftTransitions += 1; return { ...current, transferReview: nextReview,
        transfer: { ...current.transfer, status: current.transfer.plan ? 'STALE' : 'IDLE', selection: nextSelection } };
    },
    reconcileReview(current, nextReview) { reconciliationTransitions += 1; return { ...current, transferReview: nextReview }; },
    setPresentation(current, nextReview) { presentationTransitions += 1; return { ...current, transferReview: nextReview }; },
    startPlan: (current) => current, createPlan: async () => null, completePlan: (current) => current, failPlan: (current) => current,
    startApply: (current) => current, createApplication: async () => null, completeApply: (current) => current, failApply: (current) => current,
  },
});
controller.handleChange(target([], { dataset: { revcTransferPair: first.differenceId }, checked: true }));
assert.equal(draftTransitions, 1); assert.equal(controllerState.transferReview.draft.revision, 1); assert.equal(controllerState.transfer.status, 'STALE');
const staleTransfer = controllerState.transfer;
controller.handleInput(target(['data-revc-transfer-search'], { value: 'PIPE-3' }));
assert.equal(presentationTransitions, 1); assert.equal(controllerState.transfer, staleTransfer, 'search does not stale or replace transfer evidence');
controller.handleChange(target(['data-revc-transfer-page-size'], { value: '25' }));
assert.equal(presentationTransitions, 2); assert.equal(controllerState.transfer, staleTransfer);
controllerState = { ...controllerState, review: { ...controllerState.review, session: {
  ...controllerState.review.session,
  items: controllerState.review.session.items.map((item) => item.differenceId === first.differenceId ? { ...item, reviewState: 'UNREVIEWED' } : item),
} } };
const reconciledState = controller.reconcileState(controllerState);
assert.equal(reconciliationTransitions, 1); assert.equal(reconciledState.transferReview.draft.pairs.length, 0);
assert.equal(reconciledState.transfer, staleTransfer, 'authority reconciliation does not stale transfer evidence a second time');
assert(renders >= 3); controller.destroy();
