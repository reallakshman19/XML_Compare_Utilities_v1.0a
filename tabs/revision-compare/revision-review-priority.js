/** Pure deterministic RC-003 priority and visibility projection. */
import { deepFreeze } from './revision-contract-utils.js';
import { REVIEW_STATES, reviewItemIndex } from './revision-review-contracts.js';

export function createReviewFilters() {
  return deepFreeze({
    reviewStates: [...REVIEW_STATES], categories: ['CHANGED', 'ADDED', 'REMOVED'],
    certainties: ['EXACT', 'INFERRED', 'AMBIGUOUS', 'NOT_APPLICABLE'], search: '',
  });
}
function rankOf(row, item) {
  if (item.reviewState === 'UNREVIEWED' && row.matchCertainty === 'AMBIGUOUS') return 1;
  if (item.reviewState === 'NEEDS_CLARIFICATION') return 2;
  if (item.reviewState === 'UNRESOLVED') return 3;
  if (item.reviewState === 'UNREVIEWED' && row.differenceCategory === 'REMOVED') return 4;
  if (item.reviewState === 'UNREVIEWED' && row.differenceCategory === 'ADDED') return 5;
  if (item.reviewState === 'UNREVIEWED' && row.changeReasons.includes('GEOMETRY')) return 6;
  if (item.reviewState === 'UNREVIEWED') return 7;
  return 8;
}
function primaryIdentity(row) {
  return row.context?.revBIdentity || row.context?.revAIdentity || row.targetRecordId || row.sourceRecordId || '';
}
function priorityCompare(left, right) {
  return left.priorityRank - right.priorityRank
    || String(left.row.context?.branchId ?? '').localeCompare(String(right.row.context?.branchId ?? ''))
    || String(left.row.context?.componentType ?? '').localeCompare(String(right.row.context?.componentType ?? ''))
    || primaryIdentity(left.row).localeCompare(primaryIdentity(right.row))
    || left.row.differenceId.localeCompare(right.row.differenceId);
}
function searchText(row, item) {
  return [row.differenceId, row.differenceCategory, row.matchCertainty, row.sourceRecordId, row.targetRecordId,
    row.context?.branchId, row.context?.componentType, row.context?.revAIdentity, row.context?.revBIdentity,
    row.evidenceSummary?.primary, item.reviewState, item.note].join(' ').toLowerCase();
}
function visible(entry, filters) {
  if (!filters.reviewStates.includes(entry.item.reviewState)) return false;
  if (filters.needsDecisionOnly && entry.row.matchCertainty !== 'AMBIGUOUS') return false;
  if (!filters.categories.includes(entry.row.differenceCategory)) return false;
  if (!filters.certainties.includes(entry.row.matchCertainty)) return false;
  if (entry.row.differenceCategory === 'CHANGED' && entry.row.changeReasons.length && filters.changedReasons
    && !entry.row.changeReasons.some((reason) => filters.changedReasons.includes(reason))) return false;
  const search = String(filters.search ?? '').trim().toLowerCase();
  return !search || searchText(entry.row, entry.item).includes(search);
}
export function projectReviewPriority(audit, session, filters = createReviewFilters()) {
  const items = reviewItemIndex(session); const entries = [];
  for (const row of audit?.differenceRows ?? []) {
    if (row.differenceCategory === 'UNCHANGED') continue;
    const item = items.get(row.differenceId); if (!item) continue;
    entries.push({ row, item, priorityRank: rankOf(row, item) });
  }
  entries.sort(priorityCompare);
  const all = Object.freeze(entries.map((entry) => deepFreeze(entry)));
  const visibleEntries = Object.freeze(all.filter((entry) => visible(entry, filters)));
  return deepFreeze({ all, visible: visibleEntries, visibleCount: visibleEntries.length, hiddenCount: all.length - visibleEntries.length });
}
export function nextPriorityDifferenceId(projection, currentId) {
  const ids = projection.visible.map((entry) => entry.row.differenceId);
  if (!ids.length) return null; if (!currentId) return ids[0];
  const index = ids.indexOf(currentId);
  if (index < 0) return ids[0];
  return ids[index + 1] ?? (ids.length > 1 ? ids[0] : null);
}
export function previousPriorityDifferenceId(projection, currentId) {
  const ids = projection.visible.map((entry) => entry.row.differenceId);
  if (!ids.length) return null; const index = ids.indexOf(currentId);
  return index <= 0 ? null : ids[index - 1];
}
export function selectionAfterReviewMutation(before, after, currentId) {
  if (after.visible.some((entry) => entry.row.differenceId === currentId)) return currentId;
  const visibleIds = new Set(after.visible.map((entry) => entry.row.differenceId));
  const priorIds = before.visible.map((entry) => entry.row.differenceId); const index = priorIds.indexOf(currentId);
  for (let cursor = Math.max(index + 1, 0); cursor < priorIds.length; cursor += 1) if (visibleIds.has(priorIds[cursor])) return priorIds[cursor];
  return after.visible[0]?.row.differenceId ?? null;
}
export const _test = Object.freeze({ rankOf, priorityCompare, searchText });
