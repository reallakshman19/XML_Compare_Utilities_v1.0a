/** Pure model and bounded action for restoring the complete Revision Compare review queue. */
import { cleanText, deepFreeze } from './revision-contract-utils.js';
import { createComparisonLifecycleState } from './revision-compare-lifecycle.js';
import { createDecisionFilters } from './revision-decision-projection.js';
import { createReviewFilters } from './revision-review-priority.js';

const DEFAULT_QUEUE = createComparisonLifecycleState().queue;
const DEFAULT_REVIEW_FILTERS = createReviewFilters();
const DEFAULT_DECISION_FILTERS = createDecisionFilters();

function sameValues(actual, expected) {
  const left = [...(actual ?? [])].sort();
  const right = [...expected].sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function activeDimensions(state) {
  const dimensions = [];
  if (cleanText(state?.review?.filters?.search)) dimensions.push('reviewSearch');
  if (!sameValues(state?.review?.filters?.reviewStates, DEFAULT_REVIEW_FILTERS.reviewStates)) dimensions.push('reviewStates');
  if (!sameValues(state?.compare?.queue?.categories, DEFAULT_QUEUE.categories)) dimensions.push('categories');
  if (!sameValues(state?.review?.filters?.certainties, DEFAULT_REVIEW_FILTERS.certainties)) dimensions.push('certainties');
  if (!sameValues(state?.compare?.queue?.changedReasons, DEFAULT_QUEUE.changedReasons)) dimensions.push('changedReasons');
  if (state?.compare?.queue?.needsDecisionOnly) dimensions.push('needsDecisionOnly');
  if (!sameValues(state?.decision?.filters?.decisionStates, DEFAULT_DECISION_FILTERS.decisionStates)) dimensions.push('decisionStates');
  if (state?.decision?.filters?.unresolvedOnly) dimensions.push('unresolvedOnly');
  return dimensions;
}

function clearedMessage(count) {
  return `Cleared ${count} review filter${count === 1 ? '' : 's'}.`;
}

export function revisionReviewFilterResetModel(state) {
  const active = Object.freeze(activeDimensions(state));
  const count = active.length;
  const imported = state?.evidencePackageImport?.status === 'VERIFIED';
  return deepFreeze({
    visible: count > 0 && !imported,
    activeCount: count,
    activeDimensions: active,
    label: count === 1 ? 'Clear 1 review filter' : `Clear ${count} review filters`,
    message: count === 1 ? 'Restore the complete review queue by clearing 1 active filter.'
      : `Restore the complete review queue by clearing ${count} active filters.`,
  });
}

export function clearRevisionReviewFilters(state) {
  const model = revisionReviewFilterResetModel(state);
  const message = clearedMessage(model.activeCount);
  if (!model.visible) return Object.freeze({ message, model, state });
  const compare = deepFreeze({ ...state.compare, queue: deepFreeze({ ...state.compare.queue,
    categories: DEFAULT_QUEUE.categories, changedReasons: DEFAULT_QUEUE.changedReasons, needsDecisionOnly: false }) });
  const reviewFilters = deepFreeze({ ...DEFAULT_REVIEW_FILTERS, categories: state.review.filters.categories });
  const review = deepFreeze({ ...state.review, filters: reviewFilters });
  const decision = deepFreeze({ ...state.decision, filters: DEFAULT_DECISION_FILTERS });
  const next = deepFreeze({ ...state, compare, review, decision, message });
  return Object.freeze({ message, model, state: next });
}

export function createRevisionReviewFilterResetAction(context) {
  return () => {
    const result = clearRevisionReviewFilters(context.readState());
    if (!result.model.visible) return;
    context.writeState(result.state);
    context.render(result.state);
    context.showToast?.(result.message, 'success');
  };
}

export function renderRevisionReviewFilterResetControl(root, state) {
  const model = revisionReviewFilterResetModel(state);
  const queue = root.querySelector('.revc-review-queue');
  if (!queue || !model.visible) return null;
  const documentRef = root.ownerDocument;
  const control = documentRef.createElement('div');
  control.className = 'revc-session-actions';
  control.setAttribute('data-revc-review-filter-reset-status', '');
  const guidance = documentRef.createElement('small');
  guidance.textContent = model.message;
  const button = documentRef.createElement('button');
  button.type = 'button';
  button.textContent = model.label;
  button.setAttribute('data-revc-clear-review-filters', '');
  button.setAttribute('data-revc-review-filter-count', String(model.activeCount));
  control.append(guidance, button);
  queue.querySelector('header')?.after(control);
  return control;
}

export const _test = Object.freeze({ activeDimensions, clearedMessage, sameValues });
