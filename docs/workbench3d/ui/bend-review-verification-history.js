/** Bounded page-memory history for Workbench package and receipt checks. */

export const BEND_REVIEW_HISTORY_AUTHORITY = 'SESSION_MEMORY_ONLY';
export const BEND_REVIEW_HISTORY_LIMIT = 12;
export const BEND_REVIEW_HISTORY_SEARCH_LIMIT = 160;
export const BEND_REVIEW_HISTORY_KIND = Object.freeze({
  PACKAGE: 'PACKAGE',
  RECEIPT: 'RECEIPT',
});
export const BEND_REVIEW_HISTORY_FILTER = Object.freeze({
  ALL: 'ALL',
  CURRENT_PACKAGE: 'CURRENT_PACKAGE',
});
export const BEND_REVIEW_HISTORY_STATUS_FILTER = Object.freeze({
  ALL: 'ALL',
  NEEDS_ATTENTION: 'NEEDS_ATTENTION',
});
export const BEND_REVIEW_HISTORY_KIND_FILTER = Object.freeze({
  ALL: 'ALL',
  PACKAGE: 'PACKAGE',
  RECEIPT: 'RECEIPT',
});

let historyEntries = Object.freeze([]);
let historySequence = 0;

function text(value) { return String(value ?? '').trim(); }
function array(value) { return Array.isArray(value) ? value : []; }
function kind(value) {
  return Object.values(BEND_REVIEW_HISTORY_KIND).includes(value)
    ? value : BEND_REVIEW_HISTORY_KIND.PACKAGE;
}
function filter(value) {
  return Object.values(BEND_REVIEW_HISTORY_FILTER).includes(value)
    ? value : BEND_REVIEW_HISTORY_FILTER.ALL;
}
function statusFilter(value) {
  return Object.values(BEND_REVIEW_HISTORY_STATUS_FILTER).includes(value)
    ? value : BEND_REVIEW_HISTORY_STATUS_FILTER.ALL;
}
function kindFilter(value) {
  return Object.values(BEND_REVIEW_HISTORY_KIND_FILTER).includes(value)
    ? value : BEND_REVIEW_HISTORY_KIND_FILTER.ALL;
}
function searchText(value) {
  return text(value).slice(0, BEND_REVIEW_HISTORY_SEARCH_LIMIT).toLowerCase()
    .replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}
function statusBucket(value) {
  const status = text(value).toUpperCase();
  if (status === 'MATCH') return 'match';
  if (status.startsWith('STALE_')) return 'stale';
  if (status.startsWith('INVALID_')) return 'invalid';
  return 'other';
}
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

export function buildBendReviewHistoryEntry({
  checkKind, verification, artifactSignature, currentManifest,
} = {}) {
  historySequence += 1;
  return Object.freeze({
    sequence: historySequence,
    kind: kind(checkKind),
    status: text(verification?.status) || 'UNAVAILABLE',
    code: text(verification?.code) || 'VERIFICATION_UNAVAILABLE',
    artifactSignature: text(artifactSignature),
    currentPackageSignature: text(currentManifest?.packageSignature),
    differenceCount: array(verification?.differences).length,
  });
}

export function recordBendReviewHistory(input = {}) {
  const entry = buildBendReviewHistoryEntry(input);
  historyEntries = Object.freeze([entry, ...historyEntries]
    .slice(0, BEND_REVIEW_HISTORY_LIMIT));
  return historyEntries;
}

export function getBendReviewHistory() {
  return historyEntries;
}

export function filterBendReviewHistory(
  entries = historyEntries,
  mode = BEND_REVIEW_HISTORY_FILTER.ALL,
  currentPackageSignature = '',
) {
  const rows = array(entries);
  if (filter(mode) === BEND_REVIEW_HISTORY_FILTER.ALL) return rows;
  const signature = text(currentPackageSignature);
  return rows.filter((entry) => signature && text(entry?.currentPackageSignature) === signature);
}

export function filterBendReviewHistoryByStatus(
  entries = historyEntries,
  mode = BEND_REVIEW_HISTORY_STATUS_FILTER.ALL,
) {
  const rows = array(entries);
  if (statusFilter(mode) === BEND_REVIEW_HISTORY_STATUS_FILTER.ALL) return rows;
  return rows.filter((entry) => statusBucket(entry?.status) !== 'match');
}

export function filterBendReviewHistoryByKind(
  entries = historyEntries,
  mode = BEND_REVIEW_HISTORY_KIND_FILTER.ALL,
) {
  const rows = array(entries);
  const selected = kindFilter(mode);
  if (selected === BEND_REVIEW_HISTORY_KIND_FILTER.ALL) return rows;
  return rows.filter((entry) => text(entry?.kind) === selected);
}

export function filterBendReviewHistoryByText(
  entries = historyEntries,
  query = '',
) {
  const rows = array(entries);
  const needle = searchText(query);
  if (!needle) return rows;
  return rows.filter((entry) => searchText([
    entry?.kind, entry?.status, entry?.code,
    entry?.artifactSignature, entry?.currentPackageSignature,
  ].join(' ')).includes(needle));
}

export function clearBendReviewHistory() {
  historyEntries = Object.freeze([]);
  historySequence = 0;
  return historyEntries;
}

export function bendReviewHistoryCount(entries = historyEntries, totalEntries = entries) {
  const count = array(entries).length;
  const total = array(totalEntries).length;
  if (count !== total) return `${count} of ${total} checks`;
  return `${count} check${count === 1 ? '' : 's'}`;
}

export function summarizeBendReviewHistory(entries = historyEntries) {
  const summary = { total: 0, match: 0, stale: 0, invalid: 0, other: 0 };
  for (const entry of array(entries)) {
    summary.total += 1;
    summary[statusBucket(entry?.status)] += 1;
  }
  return Object.freeze(summary);
}

function summaryBadge(label, count, style = '') {
  const className = style && count ? ` ${style}` : '';
  return `<span class="wb3d-badge${className}">${label} ${count}</span>`;
}

export function bendReviewHistorySummaryHtml(entries = historyEntries) {
  const summary = summarizeBendReviewHistory(entries);
  const other = summary.other ? summaryBadge('Other', summary.other) : '';
  return `<div class="wb3d-toolbar" data-verification-history-summary>${summaryBadge('Match', summary.match, 'is-ok')}${summaryBadge('Stale', summary.stale)}${summaryBadge('Invalid', summary.invalid, 'is-bad')}${other}</div>`;
}

function historyRow(entry) {
  const status = text(entry?.status).replaceAll('_', ' ');
  const artifact = text(entry?.artifactSignature) || '—';
  const current = text(entry?.currentPackageSignature) || '—';
  return `<tr><td>${entry.sequence}</td><td>${esc(entry.kind)}</td><td>${esc(status)}</td><td>${esc(entry.code)}</td><td><code>${esc(artifact)}</code></td><td><code>${esc(current)}</code></td><td>${entry.differenceCount}</td></tr>`;
}

export function bendReviewHistoryHtml(entries = historyEntries, emptyMessage = '') {
  const rows = array(entries);
  const summary = bendReviewHistorySummaryHtml(rows);
  if (!rows.length) {
    return `${summary}<p class="wb3d-muted">${esc(emptyMessage || 'No package or receipt checks in this browser session.')}</p>`;
  }
  return `${summary}<div class="wb3d-table-wrap"><table><thead><tr><th>#</th><th>Check</th><th>Status</th><th>Code</th><th>Artifact</th><th>Current package</th><th>Differences</th></tr></thead><tbody>${rows.map(historyRow).join('')}</tbody></table></div>`;
}
