/**
 * This component enables the Revision Impact Report by connecting current review filters
 * and decision authority to the shared deterministic review projection used by the UI.
 */
import { deepFreeze } from './revision-contract-utils.js';
import { filterDecisionAwareProjection } from './revision-decision-projection.js';
import { projectReviewPriority } from './revision-review-priority.js';
import { reviewSessionMatchesAudit } from './revision-review-session.js';

const EMPTY_PROJECTION = deepFreeze({
  all: Object.freeze([]),
  visible: Object.freeze([]),
  visibleCount: 0,
  hiddenCount: 0,
});

export function revisionReviewCombinedFilters(state) {
  return deepFreeze({
    ...state.review.filters,
    categories: state.compare.queue.categories,
    search: state.review.filters.search,
    needsDecisionOnly: state.compare.queue.needsDecisionOnly,
    changedReasons: state.compare.queue.changedReasons,
  });
}

export function revisionReviewProjectionReadiness(state) {
  const audit = state?.compare?.audit;
  const session = state?.review?.session;
  const blockers = [];
  if (!audit) blockers.push('Run the visual comparison before projecting review rows.');
  else if (!reviewSessionMatchesAudit(session, audit)) blockers.push('The review session does not match the current comparison audit.');
  return deepFreeze({
    status: blockers.length ? 'BLOCKED' : 'READY',
    blockers: Object.freeze(blockers),
  });
}

export function reviewPriorityProjection(state) {
  const readiness = revisionReviewProjectionReadiness(state);
  if (readiness.status !== 'READY') return EMPTY_PROJECTION;
  const audit = state.compare.audit;
  const base = projectReviewPriority(audit, state.review.session, revisionReviewCombinedFilters(state));
  return filterDecisionAwareProjection(base, audit, state.decision);
}

export const _test = Object.freeze({ EMPTY_PROJECTION });
