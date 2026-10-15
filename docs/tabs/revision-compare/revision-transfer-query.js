/** Pure deterministic transfer search, filter, stable sort, paging and selection summaries. */
import { deepFreeze } from './revision-contract-utils.js';
import { revisionCompareTransferDraftCounts } from './revision-transfer-review-state.js';

function compareText(left, right) { return left < right ? -1 : left > right ? 1 : 0; }
function normalized(value) { return String(value ?? '').normalize('NFKC').trim().toLowerCase(); }
function selectedMap(draft) { return new Map((draft?.pairs ?? []).map((pair) => [pair.differenceId, new Set(pair.fieldKeys)])); }
function fieldText(field) {
  return normalized([field.propertyKey, field.targetFieldPath, ...(field.blockers ?? [])].join(' '));
}
function pairText(candidate) {
  return normalized([candidate.differenceId, candidate.sourceRecordId, candidate.targetRecordId, ...(candidate.blockers ?? [])].join(' '));
}
function policyFields(candidate, presentation) {
  return candidate.fields.filter((field) => (presentation.policyFilter === 'ALL' || field.policy.classification === presentation.policyFilter)
    && (presentation.propertyGroupFilter === 'ALL' || field.propertyGroup === presentation.propertyGroupFilter));
}
function searchFields(candidate, fields, search) {
  if (!search) return { pairMatch: true, fields };
  const pairMatch = pairText(candidate).includes(search);
  return { pairMatch, fields: pairMatch ? fields : fields.filter((field) => fieldText(field).includes(search)) };
}
function selectedCount(selected, candidate, fields = candidate.fields) {
  const keys = selected.get(candidate.differenceId); return keys ? fields.filter((field) => keys.has(field.fieldKey)).length : 0;
}
function eligibilityMatch(candidate, fields, presentation, selected) {
  if (presentation.eligibilityFilter === 'ELIGIBLE') return fields.some((field) => field.eligible);
  if (presentation.eligibilityFilter === 'BLOCKED') return Boolean(candidate.blockers.length || fields.some((field) => !field.eligible));
  if (presentation.eligibilityFilter === 'SELECTED') return selected.has(candidate.differenceId);
  return true;
}
function queryEntry(candidate, presentation, selected) {
  if (presentation.matchFilter !== 'ALL' && candidate.matchCertainty !== presentation.matchFilter) return null;
  const scoped = policyFields(candidate, presentation); const search = normalized(presentation.search);
  const matched = searchFields(candidate, scoped, search);
  if (search && !matched.pairMatch && !matched.fields.length) return null;
  if (!search && presentation.policyFilter !== 'ALL' && !matched.fields.length) return null;
  if (!search && presentation.propertyGroupFilter !== 'ALL' && !matched.fields.length) return null;
  if (!eligibilityMatch(candidate, matched.fields, presentation, selected)) return null;
  if (presentation.selectedOnly && !selected.has(candidate.differenceId)) return null;
  return deepFreeze({
    candidate, fields: Object.freeze(matched.fields), selectedPair: selected.has(candidate.differenceId),
    selectedFieldCount: selectedCount(selected, candidate),
  });
}
function sortValue(entry, key) {
  if (key === 'SOURCE_ENTITY_ID') return entry.candidate.sourceRecordId ?? '';
  if (key === 'TARGET_ENTITY_ID') return entry.candidate.targetRecordId ?? '';
  if (key === 'ELIGIBILITY') return entry.candidate.eligible ? 0 : 1;
  if (key === 'SELECTED_FIELD_COUNT') return entry.selectedFieldCount;
  return entry.candidate.differenceId;
}
function compareValue(left, right) {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return compareText(String(left), String(right));
}
function stableComparator(presentation) {
  const direction = presentation.sortDirection === 'DESC' ? -1 : 1;
  return (left, right) => {
    const primary = compareValue(sortValue(left, presentation.sortKey), sortValue(right, presentation.sortKey));
    if (primary) return primary * direction;
    const difference = compareText(left.candidate.differenceId, right.candidate.differenceId);
    if (difference) return difference;
    const source = compareText(left.candidate.sourceRecordId ?? '', right.candidate.sourceRecordId ?? '');
    if (source) return source;
    return compareText(left.candidate.targetRecordId ?? '', right.candidate.targetRecordId ?? '');
  };
}
function selectedGroupCounts(candidates, selected) {
  const counts = {};
  for (const candidate of candidates) {
    const keys = selected.get(candidate.differenceId); if (!keys) continue;
    for (const field of candidate.fields) if (keys.has(field.fieldKey)) counts[field.propertyGroup] = (counts[field.propertyGroup] ?? 0) + 1;
  }
  return deepFreeze(Object.fromEntries(Object.keys(counts).sort(compareText).map((key) => [key, counts[key]])));
}
function visibleSummary(entries, selected) {
  let eligiblePairs = 0; let blockedFields = 0; let selectable = 0;
  for (const entry of entries) {
    if (entry.fields.some((field) => field.eligible)) eligiblePairs += 1;
    blockedFields += entry.fields.filter((field) => !field.eligible).length;
    const keys = selected.get(entry.candidate.differenceId) ?? new Set();
    selectable += entry.fields.filter((field) => field.eligible && field.policy.classification === 'ALLOWED' && !keys.has(field.fieldKey)).length;
  }
  return { eligiblePairs, blockedFields, selectable };
}
export function queryRevisionCompareTransferCandidates(candidates, draft, presentation) {
  const selected = selectedMap(draft);
  const filtered = candidates.map((candidate) => queryEntry(candidate, presentation, selected)).filter(Boolean).sort(stableComparator(presentation));
  const pageSize = presentation.pageSize; const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(1, presentation.page), pageCount); const start = (page - 1) * pageSize;
  const entries = Object.freeze(filtered.slice(start, start + pageSize)); const visible = visibleSummary(entries, selected);
  const counts = revisionCompareTransferDraftCounts(draft);
  return deepFreeze({
    entries, presentation: deepFreeze({ ...presentation, page }), pageCount,
    summary: deepFreeze({
      totalCandidatePairs: candidates.length, filteredCandidatePairs: filtered.length, visibleCandidatePairs: entries.length,
      eligibleVisiblePairs: visible.eligiblePairs, blockedVisibleFields: visible.blockedFields,
      selectedPairs: counts.pairCount, selectedFields: counts.fieldCount,
      selectedFieldsByPropertyGroup: selectedGroupCounts(candidates, selected),
      selectableVisibleFields: visible.selectable,
    }),
  });
}
export const _test = Object.freeze({ compareText, fieldText, normalized, pairText, queryEntry, selectedGroupCounts, stableComparator });
