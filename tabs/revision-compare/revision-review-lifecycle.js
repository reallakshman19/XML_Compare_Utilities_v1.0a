/** Workspace lifecycle for current, stale, and replacement-gated review sessions. */
import { deepFreeze } from './revision-contract-utils.js';
import { createReviewFilters } from './revision-review-priority.js';
import { createReviewSession, markReviewSessionStale, reattachReviewSession, reviewSessionMatchesAudit } from './revision-review-session.js';

export function createReviewLifecycleState() {
  return deepFreeze({
    schema: 'RevisionReviewLifecycle.v1', session: null, replacementRequired: false,
    importError: null, filters: createReviewFilters(),
  });
}
export function staleReviewLifecycle(review, updatedAt) {
  if (!review?.session) return review;
  return deepFreeze({ ...review, session: markReviewSessionStale(review.session, updatedAt), importError: null });
}
export function attachReviewAudit(review, audit, updatedAt) {
  if (!review.session) return deepFreeze({ ...review, session: createReviewSession(audit, updatedAt), replacementRequired: false, importError: null });
  if (reviewSessionMatchesAudit(review.session, audit)) {
    const session = review.session.status === 'STALE' ? reattachReviewSession(review.session, audit, updatedAt) : review.session;
    return deepFreeze({ ...review, session, replacementRequired: false, importError: null });
  }
  return deepFreeze({ ...review, session: markReviewSessionStale(review.session, updatedAt), replacementRequired: true, importError: null });
}
export function startNewReviewForAudit(review, audit, createdAt) {
  return deepFreeze({ ...review, session: createReviewSession(audit, createdAt), replacementRequired: false, importError: null });
}
export function setReviewLifecycleSession(review, session) {
  return deepFreeze({ ...review, session, replacementRequired: false, importError: null });
}
export function setReviewImportError(review, error) {
  return deepFreeze({ ...review, importError: error ? String(error?.message ?? error) : null });
}
function toggleValue(values, value) {
  const next = new Set(values); if (next.has(value)) next.delete(value); else next.add(value);
  return [...next].sort();
}
export function toggleReviewFilter(review, group, value) {
  if (!['reviewStates', 'categories', 'certainties'].includes(group)) return review;
  return deepFreeze({ ...review, filters: { ...review.filters, [group]: toggleValue(review.filters[group], value) } });
}
export function setReviewSearch(review, value) {
  return deepFreeze({ ...review, filters: { ...review.filters, search: String(value ?? '') } });
}
