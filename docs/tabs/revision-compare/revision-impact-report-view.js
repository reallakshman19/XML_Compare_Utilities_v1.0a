/**
 * This component enables the Revision Impact Report by connecting the report dashboard
 * model to the Stage 3 review-side production UI and its download actions.
 */
import { revisionImpactDashboardModel } from './revision-impact-report-model.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

function human(value) {
  return String(value ?? '').replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function card(label, value, tone) {
  return `<div data-tone="${tone}"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`;
}

function summaryCards(full, visible) {
  const summary = full.summary;
  return `<div class="revc-impact-cards">
    ${card('All impact rows', full.coverage.fullRowCount, 'total')}
    ${card('Visible now', visible.coverage.exportedRowCount, 'visible')}
    ${card('Affected branches', summary.branches.length, 'branches')}
    ${card('Geometry changes', summary.geometryChanged, 'geometry')}
    ${card('Unresolved review', summary.unresolvedReview, 'review')}
    ${card('Unresolved decisions', summary.unresolvedDecision, 'decision')}
  </div>`;
}

function countRows(values, limit = 8) {
  if (!values.length) return '<tr><td colspan="2">None</td></tr>';
  return values.slice(0, limit).map((entry) => `<tr><th>${escapeHtml(human(entry.key))}</th><td>${entry.count}</td></tr>`).join('');
}

function metricTable(title, values, limit = 8) {
  return `<section><h4>${escapeHtml(title)}</h4><table><thead><tr><th>Item</th><th>Count</th></tr></thead><tbody>${countRows(values, limit)}</tbody></table></section>`;
}

function filterNote(full, visible) {
  const hidden = full.coverage.fullRowCount - visible.coverage.exportedRowCount;
  if (!hidden) return '<p class="revc-impact-filter-note">The current queue shows the complete impact set.</p>';
  return `<p class="revc-impact-filter-note"><b>${hidden}</b> impact row(s) are hidden by the active review filters. Visible exports use exactly the current queue projection.</p>`;
}

function downloadButton(format, scope, label) {
  const attribute = format === 'JSON' ? 'data-revc-download-impact-json' : 'data-revc-download-impact-csv';
  return `<button type="button" ${attribute}="${scope}">${escapeHtml(label)}</button>`;
}

function downloadControls() {
  return `<div class="revc-impact-actions" aria-label="Impact report downloads">
    ${downloadButton('JSON', 'FULL', 'Download full JSON')}
    ${downloadButton('JSON', 'VISIBLE', 'Download visible JSON')}
    ${downloadButton('CSV', 'FULL', 'Download full CSV')}
    ${downloadButton('CSV', 'VISIBLE', 'Download visible CSV')}
  </div>`;
}

function authorityFacts(full) {
  const authority = full.authority;
  return `<dl class="revc-impact-authority">
    <div><dt>Audit</dt><dd><code>${escapeHtml(authority.auditId)}</code></dd></div>
    <div><dt>Review session</dt><dd><code>${escapeHtml(authority.reviewSessionId)}</code> · rev ${authority.reviewRevision}</dd></div>
    <div><dt>Decision ledger</dt><dd><code>${escapeHtml(authority.decisionLedgerId)}</code> · rev ${authority.decisionRevision}</dd></div>
    <div><dt>Revisions</dt><dd>${escapeHtml(authority.revAFileName)} ↔ ${escapeHtml(authority.revBFileName)}</dd></div>
  </dl>`;
}

function breakdownMarkup(full) {
  const summary = full.summary;
  return `<details class="revc-impact-breakdown">
    <summary>Impact breakdown</summary>
    <div class="revc-impact-grid">
      ${metricTable('Difference categories', summary.differenceCategories)}
      ${metricTable('Effective categories', summary.effectiveCategories)}
      ${metricTable('Match certainty', summary.matchCertainties)}
      ${metricTable('Review state', summary.reviewStates)}
      ${metricTable('Decision state', summary.decisionStates)}
      ${metricTable('Change reasons', summary.changeReasons)}
      ${metricTable('Most affected branches', full.highlights.topBranches)}
      ${metricTable('Component types', full.highlights.topComponentTypes)}
      ${metricTable('Changed properties', full.highlights.topChangedProperties)}
    </div>
  </details>`;
}

function blockedMarkup(model) {
  return `<section class="revc-impact-report" data-revc-impact-report="blocked">
    <header><div><span>REVISION IMPACT REPORT</span><h2>Impact dashboard</h2></div><strong data-status="blocked">BLOCKED</strong></header>
    <p>${escapeHtml(model.readiness.blockers[0])}</p>
  </section>`;
}

export function revisionImpactReportMarkup(state) {
  if (!state?.compare?.audit) return '';
  const model = revisionImpactDashboardModel(state);
  if (model.readiness.status !== 'READY') return blockedMarkup(model);
  const { full, visible } = model;
  return `<section class="revc-impact-report" data-revc-impact-report="ready">
    <header><div><span>REVISION IMPACT REPORT</span><h2>Impact dashboard</h2><p>Live engineering impact derived from the current audit, review session, decision ledger, and active queue filters.</p></div><strong data-status="ready">READY</strong></header>
    ${summaryCards(full, visible)}
    ${filterNote(full, visible)}
    ${authorityFacts(full)}
    ${breakdownMarkup(full)}
    ${downloadControls()}
  </section>`;
}

export const _test = Object.freeze({ authorityFacts, blockedMarkup, countRows, downloadControls, metricTable, summaryCards });
