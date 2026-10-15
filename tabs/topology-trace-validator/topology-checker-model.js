/** Dashboard view-model helpers for topology issues, filters, and selection. */

import { asArray, cleanText, objectRecord } from './topology-validator-values.js';

export const CHECKER_FILTER_DEFAULTS = Object.freeze({
  search: '', severity: '', category: '', code: '', branch: '', objectType: '',
  confidence: '', fixability: '', status: '', baseline: '', selectedOnly: false,
});

/** @param {Record<string,unknown>} canonical @returns {Readonly<Record<string,Map<string,Record<string,unknown>>>>} */
export function checkerObjectIndexes(canonical) {
  const index = (rows) => new Map(asArray(rows).map((row) => [cleanText(objectRecord(row).id), objectRecord(row)]));
  return Object.freeze({
    node: index(canonical.nodes), edge: index(canonical.edges), support: index(canonical.supports),
    junction: index(canonical.junctions), bend: index(canonical.bends),
  });
}

/** @param {Record<string,unknown>} details @returns {string} */
export function checkerMeasurement(details) {
  const fields = [
    ['gapMm', 'mm'], ['lengthMm', 'mm'], ['overlapMm', 'mm'], ['clearanceMm', 'mm'],
    ['requiredMm', 'mm required'], ['angleDeg', 'deg'], ['degree', 'connections'],
  ];
  const row = fields.find(([field]) => Number.isFinite(Number(details[field])));
  return row ? `${Number(details[row[0]]).toFixed(row[0] === 'degree' ? 0 : 3)} ${row[1]}` : '';
}

/** @param {Record<string,Map<string,Record<string,unknown>>>} indexes @param {string[]} objectIds @returns {{kind:string,row:Record<string,unknown>}|null} */
function firstIndexedObject(indexes, objectIds) {
  for (const id of objectIds) for (const [kind, index] of Object.entries(indexes)) {
    const row = index.get(id); if (row) return { kind, row };
  }
  return null;
}

/** @param {Record<string,unknown>} issue @param {Record<string,unknown>|null} suggestion @param {Record<string,unknown>} context @returns {Readonly<Record<string,unknown>>} */
export function checkerIssueRow(issue, suggestion, context) {
  const details = objectRecord(issue.details), objectIds = asArray(issue.objectIds).map(cleanText);
  const object = firstIndexedObject(context.indexes, objectIds);
  const branch = cleanText(details.branchId ?? object?.row.ownerBranchId ?? asArray(object?.row.branchIds)[0]);
  const status = cleanText(context.statusOverride ?? context.reviewState.issueStates?.[issue.id]?.status) || 'OPEN';
  return Object.freeze({
    ...issue, branch, status, objectType: object?.kind?.toUpperCase() || 'EVIDENCE',
    measurement: checkerMeasurement(details), fixability: suggestion?.fixability ?? issue.fixability,
    effectiveFixMode: cleanText(suggestion?.effectiveFixMode), executionState: cleanText(suggestion?.executionState),
    autoFixFailure: context.autoFixFailure ?? null, resolution: context.resolution ?? null,
    baselineState: context.baselineIssueIds.has(issue.id) ? 'BASELINE' : 'NEW',
    suggestionId: cleanText(suggestion?.id), searchText: [issue.code, issue.message, branch, context.autoFixFailure?.reasonCode, ...objectIds].join(' ').toLowerCase(),
  });
}

/** @param {Record<string,unknown>[]} rows @param {Record<string,unknown>} filters @param {Set<string>} selectedIds @returns {Record<string,unknown>[]} */
export function filterCheckerIssueRows(rows, filters, selectedIds) {
  const search = cleanText(filters.search).toLowerCase();
  const fields = ['severity', 'category', 'code', 'branch', 'objectType', 'confidence', 'fixability', 'status'];
  return rows.filter((row) => {
    if (search && !row.searchText.includes(search)) return false;
    if (fields.some((field) => cleanText(filters[field]) && cleanText(row[field]) !== cleanText(filters[field]))) return false;
    if (filters.baseline && row.baselineState !== filters.baseline) return false;
    if (filters.selectedOnly && !asArray(row.objectIds).some((id) => selectedIds.has(cleanText(id)))) return false;
    return true;
  });
}

/** @param {Record<string,unknown>[]} rows @param {string} field @returns {string[]} */
export function checkerFilterValues(rows, field) {
  return [...new Set(rows.map((row) => cleanText(row[field])).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

/** @param {Record<string,unknown>} canonical @param {Record<string,unknown>} issue @returns {ReadonlyArray<Record<string,string>>} */
export function checkerSelectionRows(canonical, issue) {
  const indexes = checkerObjectIndexes(canonical), rows = [];
  for (const id of asArray(issue.objectIds).map(cleanText)) for (const kind of ['node', 'edge', 'support', 'bend']) {
    if (indexes[kind].has(id)) rows.push({ kind, id });
  }
  const seen = new Set();
  return Object.freeze(rows.filter((row) => { const key = `${row.kind}:${row.id}`; if (seen.has(key)) return false; seen.add(key); return true; }));
}

/** @param {Record<string,unknown>[]} rows @returns {Readonly<Record<string,number>>} */
export function checkerCategoryCounts(rows) {
  const categories = ['CONNECTIVITY', 'GEOMETRY', 'FITTINGS', 'ATTACHMENTS', 'DATA_AUTHORITY', 'EXPORT_INTEGRITY'];
  return Object.freeze(Object.fromEntries(categories.map((category) => [category, rows.filter((row) => row.category === category).length])));
}

export const _test = Object.freeze({ firstIndexedObject });
