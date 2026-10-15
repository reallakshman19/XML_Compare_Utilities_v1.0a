import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createRevisionCompareTransferController, createRevisionCompareTransferSelectionFromDraft,
  deriveRevisionCompareTransferCandidates,
} from '../tabs/revision-compare/revision-transfer-controller.js';
import {
  applyRevisionCompareTransferDraftAction, createRevisionCompareTransferReviewState,
  replaceRevisionCompareTransferDraft,
} from '../tabs/revision-compare/revision-transfer-review-state.js';
import { queryRevisionCompareTransferCandidates } from '../tabs/revision-compare/revision-transfer-query.js';
import { revisionCompareTransferMarkup } from '../tabs/revision-compare/revision-transfer-view.js';
import { productivityState } from './revision-compare-transfer-productivity-fixtures.mjs';

const base = productivityState(6, { blocked: true, unreviewed: true });
const candidates = deriveRevisionCompareTransferCandidates(base); const candidate = candidates[0];
const description = candidate.fields.find((field) => field.propertyKey === 'description' && field.eligible);
let review = createRevisionCompareTransferReviewState();
let draft = applyRevisionCompareTransferDraftAction(review.draft, candidates, { kind: 'PAIR', differenceId: candidate.differenceId, checked: true });
assert.equal(createRevisionCompareTransferSelectionFromDraft(draft, candidates), null);
draft = applyRevisionCompareTransferDraftAction(draft, candidates, { kind: 'FIELD', differenceId: candidate.differenceId, fieldKey: description.fieldKey, checked: true });
review = replaceRevisionCompareTransferDraft(review, draft);
const query = queryRevisionCompareTransferCandidates(candidates, draft, review.presentation);
const model = Object.freeze({ candidates, draft, review, query, counts: Object.freeze({ pairCount: 1, fieldCount: 1 }) });
const markup = revisionCompareTransferMarkup({ ...base, transferReview: review }, model);
for (const selector of [
  'data-revc-transfer-section', 'data-revc-transfer-status', 'data-revc-transfer-direction',
  'data-revc-transfer-eligible-count', 'data-revc-transfer-selection-count',
  'data-revc-transfer-pair', 'data-revc-transfer-field', 'data-revc-create-transfer-plan',
  'data-revc-apply-transfer', 'data-revc-transfer-search', 'data-revc-transfer-select-visible',
]) assert.match(markup, new RegExp(selector));
assert.match(markup, /Rev A — donor/); assert.match(markup, /Rev B — receiver/);
assert.doesNotMatch(markup, /Import evidence package|Resume archived review evidence/);

let state = structuredClone({ ...base, transferReview: createRevisionCompareTransferReviewState() });
const calls = []; let renderCount = 0;
const selection = createRevisionCompareTransferSelectionFromDraft(draft, candidates);
const readyPlan = Object.freeze({
  schema: 'RevisionCompareTransferPlan.v1', planId: 'revision-transfer-plan:plan', contentSha256: 'a'.repeat(64),
  status: 'READY', selection, direction: 'REV_A_TO_REV_B', operations: Object.freeze([]), blockers: Object.freeze([]),
  summary: Object.freeze({ selectedItemCount: 1, operationCount: 0, readyOperationCount: 0, blockedOperationCount: 0, replaceExistingCount: 0, addMissingCount: 0 }),
});
const application = Object.freeze({ result: Object.freeze({ resultId: 'revision-transfer-result:1' }), audit: {}, proof: {}, manifest: {}, artifacts: Object.freeze([]), patchedSnapshot: {} });
const target = (attributes, values = {}) => ({ ...values, dataset: values.dataset ?? {}, hasAttribute: (name) => attributes.includes(name) });
const controller = createRevisionCompareTransferController({
  root: {}, cryptoRef: globalThis.crypto, now: () => '2026-07-24T12:00:00.000Z',
  readState: () => state, writeState: (next) => { state = next; }, render: () => { renderCount += 1; },
  reportFailure: (error) => { throw error; }, dependencies: {
    setReviewDraft(current, nextReview, nextSelection) { calls.push('draft'); return { ...current, transferReview: nextReview, transfer: { ...current.transfer, selection: nextSelection } }; },
    setPresentation(current, nextReview) { calls.push('presentation'); return { ...current, transferReview: nextReview }; },
    startPlan(current, nextSelection) { calls.push('startPlan'); return { ...current, transfer: { ...current.transfer, selection: nextSelection, requestGeneration: 1, request: { generation: 1 } } }; },
    createPlan: async () => { calls.push('createPlan'); return readyPlan; },
    completePlan(current) { calls.push('completePlan'); return { ...current, transfer: { ...current.transfer, status: 'PLANNED', plan: readyPlan, request: null } }; },
    failPlan: (current) => current,
    startApply(current, createdAt) { calls.push(`startApply:${createdAt}`); return { ...current, transfer: { ...current.transfer, status: 'APPLYING', applyGeneration: 1, applyRequest: { generation: 1, createdAt } } }; },
    createApplication: async () => { calls.push('createApplication'); return application; },
    completeApply(current) { calls.push('completeApply'); return { ...current, transfer: { ...current.transfer, status: 'APPLIED', result: application.result, applyRequest: null } }; },
    failApply: (current) => current,
  },
});
controller.handleChange(target([], { dataset: { revcTransferPair: candidate.differenceId }, checked: true }));
controller.handleChange(target([], { dataset: { revcTransferField: description.fieldKey, revcTransferDifferenceId: candidate.differenceId }, checked: true }));
await controller.handleClick(target(['data-revc-create-transfer-plan']));
assert.deepEqual(calls.filter((item) => item.includes('Plan')), ['startPlan', 'createPlan', 'completePlan']);
await controller.handleClick(target(['data-revc-apply-transfer']));
assert(calls.includes('startApply:2026-07-24T12:00:00.000Z')); assert(calls.includes('createApplication')); assert(calls.includes('completeApply'));
assert.equal(state.transfer.status, 'APPLIED'); assert(renderCount >= 4); controller.destroy();

for (const path of [
  '../tabs/revision-compare/revision-transfer-controller.js', '../tabs/revision-compare/revision-transfer-view.js',
  '../tabs/revision-compare/revision-transfer-workspace-bindings.js', '../tabs/revision-compare/revision-transfer-review-state.js',
  '../tabs/revision-compare/revision-transfer-candidate-index.js', '../tabs/revision-compare/revision-transfer-candidates.js',
  '../tabs/revision-compare/revision-transfer-query.js', '../tabs/revision-compare/revision-transfer-review-workspace-state.js',
]) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  assert(source.trimEnd().split('\n').length < 300, `${path} must remain below 300 lines`);
  assert.doesNotMatch(source, /export\s+default|xml-compare\/|tabs\/xml-compare-tab|DOMParser|revision-compare-viewer|viewerAdapter|THREE|Math\.random|Date\.now/);
}
const workspaceStateSource = await readFile(new URL('../tabs/revision-compare/revision-workspace-state.js', import.meta.url), 'utf8');
assert.match(workspaceStateSource, /RevisionCompareWorkspaceState\.v12/); assert.match(workspaceStateSource, /createRevisionCompareTransferReviewState/);
const signOffSource = await readFile(new URL('../tabs/revision-compare/revision-sign-off.js', import.meta.url), 'utf8');
assert.match(signOffSource, /transferReview\?\.draft\?\.pairs/);
console.log('revision-compare-transfer-workspace.test.mjs passed');
