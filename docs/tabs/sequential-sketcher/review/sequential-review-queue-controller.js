import {
  adjacentSequentialReviewRow,
  buildSequentialBlockedReviewQueue,
  filterSequentialBlockedReviewQueue,
  refreshSequentialBlockedReviewQueue,
} from './sequential-blocked-review-queue.js';
import { createSequentialDecisionRegisterExports } from './sequential-review-queue-export.js';

function required(root, selector) {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Sequential review queue element missing: ${selector}`);
  return element;
}
function saveTextFile(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
function statusLabel(status) {
  if (status === 'UNRESOLVED') return '⚠';
  if (status === 'DEFERRED') return '⏸';
  if (status === 'MANUALLY_RESOLVED') return '✓';
  if (status === 'COMPLETE') return '●';
  if (status === 'FAILED') return '×';
  return '○';
}

export function mountSequentialReviewQueueController(root, options = {}) {
  const elements = {
    build: required(root, '[data-ssk-review-build]'),
    summary: required(root, '[data-ssk-review-summary]'),
    status: required(root, '[data-ssk-review-status]'),
    reason: required(root, '[data-ssk-review-reason]'),
    search: required(root, '[data-ssk-review-search]'),
    list: required(root, '[data-ssk-review-list]'),
    previous: required(root, '[data-ssk-review-prev]'),
    next: required(root, '[data-ssk-review-next]'),
    position: required(root, '[data-ssk-review-position]'),
    exports: [...root.querySelectorAll('[data-ssk-review-export]')],
  };
  let queue = null;
  let filteredRows = Object.freeze([]);
  let currentReviewId = '';

  function registry() { return options.getBranchRegistry?.(); }
  function evidence() { return options.getEvidence?.(); }
  function indexes() { return options.getIndexes?.(); }
  function refreshFromRegistry() {
    if (!queue) return null;
    queue = refreshSequentialBlockedReviewQueue(queue, registry(), evidence(), indexes());
    return queue;
  }
  function syncReasons() {
    const selected = elements.reason.value || 'ALL';
    elements.reason.innerHTML = '<option value="ALL">All reasons</option>'
      + (queue?.groups || []).map((group) => `<option></option>`).join('');
    [...elements.reason.options].slice(1).forEach((option, index) => {
      const group = queue.groups[index];
      option.value = group.reason;
      option.textContent = `${group.reason} (${group.count})`;
    });
    elements.reason.value = [...elements.reason.options].some((option) => option.value === selected)
      ? selected : 'ALL';
  }
  function syncList() {
    if (!queue) {
      filteredRows = Object.freeze([]);
      elements.summary.textContent = 'Queue not built.';
      elements.list.innerHTML = '<option value="">Build queue to analyze branches</option>';
      elements.position.textContent = '0 / 0';
      elements.previous.disabled = true;
      elements.next.disabled = true;
      elements.exports.forEach((button) => { button.disabled = true; });
      return;
    }
    refreshFromRegistry();
    syncReasons();
    filteredRows = filterSequentialBlockedReviewQueue(queue, {
      status: elements.status.value,
      reason: elements.reason.value,
      search: elements.search.value,
    });
    if (!filteredRows.some((row) => row.reviewId === currentReviewId)) {
      currentReviewId = filteredRows[0]?.reviewId || '';
    }
    const summary = queue.summary;
    elements.summary.textContent = `${summary.unresolvedCount} unresolved · ${summary.deferredCount} deferred · ${summary.manuallyResolvedCount} manually resolved · ${summary.completeCount} complete · ${summary.failedCount} failed`;
    elements.list.innerHTML = filteredRows.length
      ? filteredRows.map(() => '<option></option>').join('')
      : '<option value="">No branches match the current filters</option>';
    if (filteredRows.length) {
      [...elements.list.options].forEach((option, index) => {
        const row = filteredRows[index];
        option.value = row.reviewId;
        option.textContent = `${statusLabel(row.reviewStatus)} ${row.branchId} · ${row.blockedReason || row.reviewStatus}`;
        option.title = `${row.branchId}\n${row.blockedReason || row.reviewStatus}\n${row.candidateCount} candidates · ${row.missingEvidenceClass}`;
      });
      elements.list.value = currentReviewId;
    }
    const index = filteredRows.findIndex((row) => row.reviewId === currentReviewId);
    elements.position.textContent = index >= 0 ? `${index + 1} / ${filteredRows.length}` : `0 / ${filteredRows.length}`;
    elements.previous.disabled = index <= 0;
    elements.next.disabled = index < 0 || index >= filteredRows.length - 1;
    elements.exports.forEach((button) => { button.disabled = false; });
  }
  function selectReview(reviewId, open = false) {
    const row = filteredRows.find((candidate) => candidate.reviewId === reviewId)
      || queue?.rows?.find((candidate) => candidate.reviewId === reviewId);
    if (!row) return null;
    currentReviewId = row.reviewId;
    syncList();
    if (open) options.openBranch?.(row.branchId);
    return row;
  }
  function selectBranch(branchId) {
    const row = queue?.rows?.find((candidate) => candidate.branchId === branchId);
    if (!row) return null;
    currentReviewId = row.reviewId;
    syncList();
    return row;
  }
  function navigate(delta) {
    const row = adjacentSequentialReviewRow(filteredRows, currentReviewId, delta);
    if (row) selectReview(row.reviewId, true);
  }
  function build() {
    options.ensureEvidence?.();
    options.saveActiveBranch?.();
    queue = buildSequentialBlockedReviewQueue(evidence(), indexes(), {
      engineOptions: options.getEngineOptions?.() || {},
    });
    const branchRegistry = registry();
    for (const snapshot of queue.snapshots) {
      if (branchRegistry.get(snapshot.branchId)) continue;
      branchRegistry.save(snapshot.branchId, {
        session: snapshot.session,
        confirmedConstruction: null,
        supportProjection: null,
        selectedCandidateId: '',
      });
    }
    refreshFromRegistry();
    elements.status.value = 'UNRESOLVED';
    elements.reason.value = 'ALL';
    elements.search.value = '';
    currentReviewId = '';
    syncList();
    const first = filteredRows[0];
    if (first) selectReview(first.reviewId, true);
    options.setStatus?.(`Review queue built explicitly: ${queue.summary.unresolvedCount} unresolved, ${queue.summary.completeCount} complete. No branch was approved or bulk-resolved.`, 'ok');
    options.onQueueUpdated?.(queue);
    return queue;
  }
  function exportRegister(kind) {
    if (!queue) return;
    refreshFromRegistry();
    const exports = createSequentialDecisionRegisterExports(queue);
    if (kind === 'unresolved-csv') saveTextFile('sequential-unresolved-decision-register.csv', exports.unresolvedCsv, 'text/csv');
    if (kind === 'manual-csv') saveTextFile('sequential-manual-resolution-register.csv', exports.manualCsv, 'text/csv');
    if (kind === 'register-json') saveTextFile('sequential-decision-register.json', exports.registerJson, 'application/json');
  }
  function reset() {
    queue = null;
    filteredRows = Object.freeze([]);
    currentReviewId = '';
    elements.status.value = 'UNRESOLVED';
    elements.reason.innerHTML = '<option value="ALL">All reasons</option>';
    elements.search.value = '';
    syncList();
  }
  function onClick(event) {
    try {
      if (event.target?.closest?.('[data-ssk-review-build]')) { build(); return; }
      if (event.target?.closest?.('[data-ssk-review-prev]')) { navigate(-1); return; }
      if (event.target?.closest?.('[data-ssk-review-next]')) { navigate(1); return; }
      const exportKind = event.target?.closest?.('[data-ssk-review-export]')?.dataset?.sskReviewExport;
      if (exportKind) exportRegister(exportKind);
    } catch (error) {
      options.setStatus?.(error.message || String(error), 'error');
      options.showToast?.(error.message || String(error), 'error');
    }
  }
  function onChange(event) {
    if (event.target === elements.list) { selectReview(elements.list.value, true); return; }
    if ([elements.status, elements.reason].includes(event.target)) syncList();
  }
  function onInput(event) {
    if (event.target === elements.search) syncList();
  }

  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  root.addEventListener('input', onInput);
  reset();
  return Object.freeze({
    build,
    refresh: syncList,
    reset,
    selectBranch,
    getQueue: () => queue,
    getFilteredRows: () => filteredRows,
    destroy() {
      root.removeEventListener('click', onClick);
      root.removeEventListener('change', onChange);
      root.removeEventListener('input', onInput);
    },
  });
}
