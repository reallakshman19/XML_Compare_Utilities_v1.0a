/** Workspace-owned transfer draft authority separated from presentation-only query state. */
import { deepFreeze } from './revision-contract-utils.js';

export const REVISION_COMPARE_TRANSFER_REVIEW_STATE_SCHEMA = 'RevisionCompareTransferReviewState.v1';
export const REVISION_COMPARE_TRANSFER_PAGE_SIZES = Object.freeze([25, 50, 100]);
export const REVISION_COMPARE_TRANSFER_ELIGIBILITY_FILTERS = Object.freeze(['ALL', 'ELIGIBLE', 'BLOCKED', 'SELECTED']);
export const REVISION_COMPARE_TRANSFER_POLICY_FILTERS = Object.freeze(['ALL', 'ALLOWED', 'CONTROLLED', 'PROTECTED']);
export const REVISION_COMPARE_TRANSFER_PROPERTY_GROUPS = Object.freeze([
  'ALL', 'DESCRIPTION', 'MATERIAL_AND_SPECIFICATION', 'RATING_AND_DIMENSIONS',
  'WEIGHT_AND_LENGTH', 'OTHER_ALLOWED', 'PROTECTED_OR_CONTROLLED',
]);
export const REVISION_COMPARE_TRANSFER_MATCH_FILTERS = Object.freeze(['ALL', 'EXACT', 'INFERRED', 'AMBIGUOUS']);
export const REVISION_COMPARE_TRANSFER_SORT_KEYS = Object.freeze([
  'DIFFERENCE_ID', 'SOURCE_ENTITY_ID', 'TARGET_ENTITY_ID', 'ELIGIBILITY', 'SELECTED_FIELD_COUNT',
]);

function text(value) { return String(value ?? ''); }
function member(value, values, fallback) { return values.includes(value) ? value : fallback; }
function pageSize(value) { const number = Number(value); return REVISION_COMPARE_TRANSFER_PAGE_SIZES.includes(number) ? number : 50; }
function page(value) { const number = Math.trunc(Number(value)); return Number.isSafeInteger(number) && number > 0 ? number : 1; }
function pairMap(draft) {
  return new Map((draft?.pairs ?? []).map((pair) => [pair.differenceId, {
    differenceId: pair.differenceId, fieldKeys: [...pair.fieldKeys],
  }]));
}
function compareText(left, right) { return left < right ? -1 : left > right ? 1 : 0; }
function freezeDraft(revision, pairs) {
  const values = [...pairs.values()].map((pair) => deepFreeze({
    differenceId: text(pair.differenceId), fieldKeys: Object.freeze([...new Set(pair.fieldKeys.map(text))].sort(compareText)),
  })).filter((pair) => pair.differenceId).sort((a, b) => compareText(a.differenceId, b.differenceId));
  return deepFreeze({ revision, pairs: Object.freeze(values) });
}
function presentationValue(input = {}) {
  return deepFreeze({
    search: text(input.search),
    eligibilityFilter: member(input.eligibilityFilter, REVISION_COMPARE_TRANSFER_ELIGIBILITY_FILTERS, 'ALL'),
    policyFilter: member(input.policyFilter, REVISION_COMPARE_TRANSFER_POLICY_FILTERS, 'ALL'),
    propertyGroupFilter: member(input.propertyGroupFilter, REVISION_COMPARE_TRANSFER_PROPERTY_GROUPS, 'ALL'),
    matchFilter: member(input.matchFilter, REVISION_COMPARE_TRANSFER_MATCH_FILTERS, 'ALL'),
    selectedOnly: Boolean(input.selectedOnly),
    sortKey: member(input.sortKey, REVISION_COMPARE_TRANSFER_SORT_KEYS, 'DIFFERENCE_ID'),
    sortDirection: input.sortDirection === 'DESC' ? 'DESC' : 'ASC',
    page: page(input.page), pageSize: pageSize(input.pageSize),
  });
}
export function createRevisionCompareTransferReviewState() {
  return deepFreeze({
    schema: REVISION_COMPARE_TRANSFER_REVIEW_STATE_SCHEMA,
    draft: freezeDraft(0, new Map()), presentation: presentationValue(),
  });
}
export function updateRevisionCompareTransferPresentation(state, patch = {}) {
  const current = state ?? createRevisionCompareTransferReviewState();
  const presentation = presentationValue({ ...current.presentation, ...patch });
  if (JSON.stringify(presentation) === JSON.stringify(current.presentation)) return current;
  return deepFreeze({ ...current, presentation });
}
export function replaceRevisionCompareTransferDraft(state, draft) {
  const current = state ?? createRevisionCompareTransferReviewState();
  if (draft === current.draft) return current;
  return deepFreeze({ ...current, draft });
}
function candidateValue(entry) { return entry?.candidate ?? entry; }
function visibleFields(entry) { return entry?.fields ?? candidateValue(entry)?.fields ?? []; }
function candidateMap(candidates) { return new Map((candidates ?? []).map((entry) => [candidateValue(entry).differenceId, candidateValue(entry)])); }
function eligibleField(field) { return field?.eligible && field.policy?.classification === 'ALLOWED'; }
function changedDraft(draft, pairs) {
  const next = freezeDraft((draft?.revision ?? 0) + 1, pairs);
  return JSON.stringify(next.pairs) === JSON.stringify(draft?.pairs ?? []) ? draft : next;
}
function updatePair(pairs, candidates, action) {
  const candidate = candidates.get(action.differenceId);
  if (action.checked && candidate?.eligible) pairs.set(action.differenceId, { differenceId: action.differenceId, fieldKeys: [] });
  else pairs.delete(action.differenceId);
}
function updateField(pairs, candidates, action) {
  const pair = pairs.get(action.differenceId); const candidate = candidates.get(action.differenceId);
  const field = candidate?.fields.find((item) => item.fieldKey === action.fieldKey);
  if (!pair || !eligibleField(field)) return;
  pair.fieldKeys = action.checked ? [...pair.fieldKeys, action.fieldKey] : pair.fieldKeys.filter((key) => key !== action.fieldKey);
}
function selectVisible(pairs, entries) {
  for (const entry of entries ?? []) {
    const candidate = candidateValue(entry); const keys = visibleFields(entry).filter(eligibleField).map((field) => field.fieldKey);
    if (!keys.length) continue;
    const pair = pairs.get(candidate.differenceId) ?? { differenceId: candidate.differenceId, fieldKeys: [] };
    pair.fieldKeys = [...pair.fieldKeys, ...keys]; pairs.set(candidate.differenceId, pair);
  }
}
function clearVisible(pairs, entries) {
  for (const entry of entries ?? []) {
    const candidate = candidateValue(entry); const pair = pairs.get(candidate.differenceId); if (!pair) continue;
    const visible = new Set(visibleFields(entry).map((field) => field.fieldKey));
    const retained = pair.fieldKeys.filter((key) => !visible.has(key));
    if (retained.length) pairs.set(candidate.differenceId, { differenceId: candidate.differenceId, fieldKeys: retained });
    else pairs.delete(candidate.differenceId);
  }
}
export function applyRevisionCompareTransferDraftAction(draft, candidates, action) {
  const current = draft ?? createRevisionCompareTransferReviewState().draft;
  if (action?.kind === 'CLEAR_ALL') return current.pairs.length ? freezeDraft(current.revision + 1, new Map()) : current;
  const pairs = pairMap(current); const indexed = candidateMap(candidates);
  if (action?.kind === 'PAIR') updatePair(pairs, indexed, action);
  else if (action?.kind === 'FIELD') updateField(pairs, indexed, action);
  else if (action?.kind === 'SELECT_VISIBLE') selectVisible(pairs, action.entries);
  else if (action?.kind === 'CLEAR_VISIBLE') clearVisible(pairs, action.entries);
  else return current;
  return changedDraft(current, pairs);
}
export function reconcileRevisionCompareTransferDraft(draft, candidates) {
  const current = draft ?? createRevisionCompareTransferReviewState().draft;
  const indexed = candidateMap(candidates); const pairs = new Map();
  for (const pair of current.pairs) {
    const candidate = indexed.get(pair.differenceId); if (!candidate?.eligible) continue;
    const allowed = new Set(candidate.fields.filter(eligibleField).map((field) => field.fieldKey));
    pairs.set(pair.differenceId, { differenceId: pair.differenceId, fieldKeys: pair.fieldKeys.filter((key) => allowed.has(key)) });
  }
  return changedDraft(current, pairs);
}
export function revisionCompareTransferDraftCounts(draft) {
  return deepFreeze({
    pairCount: draft?.pairs?.length ?? 0,
    fieldCount: (draft?.pairs ?? []).reduce((sum, pair) => sum + pair.fieldKeys.length, 0),
  });
}
export const _test = Object.freeze({ candidateMap, compareText, eligibleField, freezeDraft, presentationValue });
