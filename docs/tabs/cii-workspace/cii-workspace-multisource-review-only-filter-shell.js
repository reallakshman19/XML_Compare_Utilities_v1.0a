import { mountCiiWriter2MultiSourceReviewRouter as mountReviewRouter } from './cii-workspace-multisource-review-only-router.js?v=20260909-ms-review-decisions-1';

function genericReviewActive(container) {
  return Boolean(container.querySelector('[data-ciiw-ms-review-only-transfer="1"]') && container.querySelector('[data-ciiw-ms-review-table="1"]'));
}
function confidenceForRow(row) {
  if (String(row?.children?.[0]?.textContent || '').toUpperCase().includes('LOCKED')) return 'LOCKED';
  return String(row?.querySelector?.('.ciiw-confidence')?.textContent || '').trim().toUpperCase();
}
function changedRow(row) {
  const cell = row?.children?.[7];
  return Boolean(cell && String(cell.textContent || '').trim() && String(cell.textContent || '').trim() !== '—');
}
function rowMatches(row, filters = {}) {
  const confidence = String(filters.confidence || 'ALL').toUpperCase();
  if (confidence !== 'ALL' && confidenceForRow(row) !== confidence) return false;
  if (filters.changedOnly && !changedRow(row)) return false;
  const search = String(filters.search || '').trim().toLowerCase();
  return !search || String(row?.textContent || '').toLowerCase().includes(search);
}
export function applyCiiGenericReviewDomFilters(container) {
  if (!genericReviewActive(container)) return Object.freeze({ active: false, total: 0, visible: 0 });
  const confidence = container.querySelector('[data-ciiw-confidence-filter]')?.value || 'ALL';
  const search = container.querySelector('[data-ciiw-search]')?.value || '';
  const changedOnly = Boolean(container.querySelector('[data-ciiw-changed-only]')?.checked);
  const rows = [...container.querySelectorAll('[data-ciiw-ms-review-table="1"] tbody tr')];
  let visible = 0;
  for (const row of rows) {
    const matches = rowMatches(row, { confidence, search, changedOnly });
    row.hidden = !matches; if (matches) visible += 1;
  }
  return Object.freeze({ active: true, total: rows.length, visible, filters: Object.freeze({ confidence, search, changedOnly }) });
}

export function mountCiiWriter2MultiSourceReviewRouter(container, options = {}) {
  const core = mountReviewRouter(container, options);
  const confidence = container.querySelector('[data-ciiw-confidence-filter]');
  const search = container.querySelector('[data-ciiw-search]');
  const changedOnly = container.querySelector('[data-ciiw-changed-only]');
  const results = container.querySelector('[data-ciiw-results]');
  let disposed = false; let queued = false;
  const apply = () => {
    if (disposed || !genericReviewActive(container)) return;
    applyCiiGenericReviewDomFilters(container);
  };
  const queueApply = () => {
    if (queued || disposed) return; queued = true;
    queueMicrotask(() => { queued = false; apply(); });
  };
  const onChange = (event) => {
    if (!genericReviewActive(container) || (event.target !== confidence && event.target !== changedOnly)) return;
    event.stopImmediatePropagation(); apply();
  };
  const onInput = (event) => {
    if (!genericReviewActive(container) || event.target !== search) return;
    event.stopImmediatePropagation(); apply();
  };
  container.addEventListener('change', onChange, true);
  container.addEventListener('input', onInput, true);
  const observer = results && typeof MutationObserver !== 'undefined' ? new MutationObserver(queueApply) : null;
  observer?.observe(results, { childList: true, subtree: true });
  return {
    ...core,
    destroy() {
      disposed = true; observer?.disconnect();
      container.removeEventListener('change', onChange, true); container.removeEventListener('input', onInput, true);
      core?.destroy?.();
    },
  };
}

export const _test = Object.freeze({ genericReviewActive, confidenceForRow, changedRow, rowMatches });
