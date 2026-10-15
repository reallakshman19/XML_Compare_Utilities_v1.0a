/**
 * Static dashboard markup and safe issue-row/detail rendering.
 * Inputs are checker report view records; output is inert HTML consumed by
 * the controller. Missing measurements and authority remain visibly unknown.
 */

import { topologyCheckerIconMarkup, topologyCheckerIconUrl } from './topology-checker-icons.js';
import { asArray, cleanText, escapeMarkup, objectRecord } from './topology-validator-values.js';

const KPI_FIELDS = Object.freeze([
  ['openCount', 'Open'], ['acknowledgedCount', 'Known'], ['warningCount', 'Warning'],
  ['autoApprovedCount', 'Auto-approved'], ['needsConfirmationCount', 'Confirm'],
  ['resolvedCount', 'Resolved'], ['suppressedCount', 'Suppressed'],
]);

/** @returns {string} */
export function topologyCheckerPanelMarkup() {
  return `<aside class="ttv-checker-panel" data-ttv-checker-panel hidden aria-label="Topology Checker">
    <header class="ttv-checker-header" data-ttv-checker-drag>
      ${topologyCheckerIconMarkup('scan-search', '', 'ttv-checker-title-icon')}
      <div><strong>Topology Checker</strong><span data-ttv-checker-subtitle>No report</span></div>
      <div class="ttv-checker-window-actions">
        <button type="button" data-ttv-font-zoom="in" title="Increase font size (F+)" style="color: #94a3b8; font-weight: bold; font-size: 13px;">F+</button>
        <button type="button" data-ttv-font-zoom="out" title="Decrease font size (F-)" style="color: #94a3b8; font-weight: bold; font-size: 13px;">F−</button>
        <button type="button" data-ttv-checker-layout="right" title="Dock right">${topologyCheckerIconMarkup('panel-right', 'Dock right', '')}</button>
        <button type="button" data-ttv-checker-layout="bottom" title="Dock bottom">${topologyCheckerIconMarkup('panel-bottom', 'Dock bottom', '')}</button>
        <button type="button" data-ttv-checker-layout="float" title="Float panel">${topologyCheckerIconMarkup('maximize-2', 'Float panel', '')}</button>
        <button type="button" data-ttv-checker-layout="reset" title="Reset layout">${topologyCheckerIconMarkup('rotate-ccw', 'Reset layout', '')}</button>
        <button type="button" data-ttv-checker-settings title="Topology Checker settings">${topologyCheckerIconMarkup('settings', 'Settings', '')}</button>
        <button type="button" data-ttv-checker-collapse title="Collapse">${topologyCheckerIconMarkup('chevron-up', 'Collapse', '')}</button>
        <button type="button" data-ttv-checker-close title="Close">${topologyCheckerIconMarkup('x', 'Close', '')}</button>
      </div>
    </header>
    <section class="ttv-checker-settings" data-ttv-checker-settings-panel hidden></section>
    <div class="ttv-checker-body" data-ttv-checker-body>
      <section class="ttv-checker-kpis" data-ttv-checker-kpis></section>
      <section class="ttv-checker-filters" aria-label="Topology issue filters">
        <label class="ttv-checker-search">${topologyCheckerIconMarkup('filter', '', '')}<input type="search" data-ttv-checker-filter="search" placeholder="Search issue, branch, object…"></label>
        ${filterSelect('severity', 'Severity')}${filterSelect('category', 'Bucket')}${filterSelect('code', 'Issue code')}
        ${filterSelect('branch', 'Branch / line')}${filterSelect('objectType', 'Object type')}${filterSelect('confidence', 'Confidence')}
        ${filterSelect('fixability', 'Fixability')}${filterSelect('status', 'Status')}${filterSelect('baseline', 'Baseline / new')}
        <label class="ttv-checker-selected-filter"><input type="checkbox" data-ttv-checker-filter="selectedOnly"> Selected objects only</label>
      </section>
      <section class="ttv-checker-buckets" data-ttv-checker-buckets></section>
      <section class="ttv-checker-table" aria-label="Topology issues">
        <div class="ttv-checker-table-head" role="row"><span>Severity</span><span>Issue</span><span>Measurement</span><span>Branch</span><span>Confidence</span><span>Fix</span></div>
        <div class="ttv-checker-scroll" data-ttv-checker-scroll role="rowgroup"><div data-ttv-checker-spacer><div data-ttv-checker-rows></div></div></div>
      </section>
      <section class="ttv-checker-detail" data-ttv-checker-detail><p>Select an issue to inspect evidence and a proposed operation.</p></section>
      <footer class="ttv-checker-actions">
        <button type="button" data-ttv-checker-refresh>${topologyCheckerIconMarkup('scan-search', '', '')} Run checks</button>
        <button type="button" class="is-primary" data-ttv-checker-auto-fix>${topologyCheckerIconMarkup('wand-sparkles', '', '')} Auto fix <b data-ttv-checker-auto-count>0</b></button>
        <button type="button" data-ttv-checker-apply-selected>${topologyCheckerIconMarkup('wand-sparkles', '', '')} Apply selected</button>
        <button type="button" data-ttv-checker-export>${topologyCheckerIconMarkup('check-check', '', '')} Export report</button>
      </footer>
    </div>
    <div class="ttv-checker-resize" data-ttv-checker-resize aria-hidden="true"></div>
    <div class="ttv-sr-only" aria-live="polite" data-ttv-checker-live></div>
  </aside>`;
}

/** @param {string} name @param {string} label @returns {string} */
function filterSelect(name, label) {
  return `<label><span>${label}</span><select data-ttv-checker-filter="${name}"><option value="">All</option></select></label>`;
}

/** @param {Record<string,number>} summary @returns {string} */
export function checkerKpiMarkup(summary) {
  return KPI_FIELDS.map(([field, label]) => `<button type="button" data-ttv-checker-kpi="${field}"><b>${Number(summary[field] ?? 0).toLocaleString()}</b><span>${label}</span></button>`).join('');
}

/** @param {Record<string,number>} counts @param {string} active @returns {string} */
export function checkerBucketMarkup(counts, active) {
  return Object.entries(counts).map(([category, count]) => `<div class="ttv-checker-bucket-group" style="display:contents"><button type="button" class="${category === active ? 'is-active' : ''}" data-ttv-checker-bucket="${escapeMarkup(category)}"><span class="ttv-checker-bucket-shape"></span>${escapeMarkup(category.replaceAll('_', ' '))}<b>${Number(count).toLocaleString()}</b></button><button type="button" data-ttv-checker-skip-bucket="${escapeMarkup(category)}" title="Skip this bucket; export remains allowed">Skip</button></div>`).join('');
}

/** @param {Element} select @param {string[]} values @param {string} selected @returns {void} */
export function renderCheckerFilterOptions(select, values, selected) {
  const first = select.querySelector('option')?.outerHTML ?? '<option value="">All</option>';
  select.innerHTML = `${first}${values.map((value) => `<option value="${escapeMarkup(value)}">${escapeMarkup(value.replaceAll('_', ' '))}</option>`).join('')}`;
  select.value = selected;
}

/** @param {Record<string,unknown>} issue @returns {string} */
export function checkerIssueRowMarkup(issue) {
  const selected = issue.selected ? ' is-selected' : '';
  return `<div role="row" style="display:flex;align-items:center;padding-left:4px;">
    <input type="checkbox" class="ttv-checker-bulk-select" data-ttv-checker-bulk-id="${escapeMarkup(issue.id)}" title="Select for bulk apply" style="margin-right:4px;" ${issue.status === 'RESOLVED' ? 'disabled' : ''}>
    <button type="button" class="ttv-checker-row${selected}" data-ttv-checker-issue="${escapeMarkup(issue.id)}" style="--ttv-issue-color:${escapeMarkup(issue.color)};flex:1;">
    <span class="ttv-checker-severity" data-severity="${escapeMarkup(issue.severity)}">${topologyCheckerIconMarkup(issue.icon, '', '')}<small>${escapeMarkup(issue.severity)}</small></span>
    <span><b>${escapeMarkup(issue.code.replaceAll('_', ' '))}</b><small>${escapeMarkup(issue.message)}</small></span>
    <span>${escapeMarkup(issue.measurement || '—')}</span><span title="${escapeMarkup(issue.branch)}">${escapeMarkup(issue.branch || '—')}</span>
    <span>${escapeMarkup(issue.confidence)}</span><span data-fixability="${escapeMarkup(issue.fixability)}" title="${escapeMarkup(issue.executionState || '')}">${escapeMarkup(fixLabel(issue.fixability, issue.executionState))}</span>
  </button></div>`;
}

/** @param {string} value @returns {string} */
function fixLabel(value, executionState) {
  if (value === 'AUTO_APPROVED' && executionState === 'UNAVAILABLE') return 'Auto unavailable';
  if (value === 'AUTO_APPROVED') return 'Auto';
  if (value === 'NEEDS_CONFIRMATION') return 'Confirm';
  return 'Manual';
}

/** Render one candidate; large-model manual/confirmation cases remain documented but non-interactive. */
export function checkerDetailMarkup(issue, suggestion, status, nonInteractive) {
  if (!issue) return '<p>Select an issue to inspect evidence and a proposed operation.</p>';
  const details = objectRecord(issue.details), preview = objectRecord(suggestion?.preview);
  const evidence = asArray(issue.evidence).length ? asArray(issue.evidence) : Object.entries(details).map(([name, value]) => ({ name, value }));
  return `<div class="ttv-checker-detail-title" style="--ttv-issue-color:${escapeMarkup(issue.color)}">${topologyCheckerIconMarkup(issue.icon, '', '')}<div><b>${escapeMarkup(issue.code.replaceAll('_', ' '))}</b><span>${escapeMarkup(status)} · ${escapeMarkup(issue.confidence)} confidence</span></div></div>
    <p>${escapeMarkup(issue.message)}</p>
    <dl><dt>Affected</dt><dd>${asArray(issue.objectIds).map((id) => `<code>${escapeMarkup(id)}</code>`).join(' ')}</dd>
    <dt>Evidence</dt><dd>${evidence.map((row) => `${escapeMarkup(cleanText(row.name ?? row.field ?? 'value'))}: <b>${escapeMarkup(formatEvidence(row.value ?? row))}</b>`).join('<br>') || 'No evidence supplied'}</dd>
    <dt>Proposed operation</dt><dd>${suggestion ? `<b>${escapeMarkup(suggestion.title)}</b><br>${escapeMarkup(suggestion.rationale)}<br><code>${escapeMarkup(JSON.stringify(preview))}</code>` : 'Manual engineering review required.'}</dd>
    <dt>Engineering impact</dt><dd>${suggestion ? `${escapeMarkup(suggestion.risk)} risk · ${asArray(suggestion.preconditions).map((row) => escapeMarkup(row)).join(', ')}` : 'No deterministic fix operation.'}</dd>
    ${issue.autoFixFailure ? `<dt>Auto fix status</dt><dd><b>${escapeMarkup(issue.autoFixFailure.reasonCode)}</b> · ${escapeMarkup(issue.autoFixFailure.message)}</dd>` : ''}
    ${issue.resolution ? `<dt>Resolution</dt><dd><b>${escapeMarkup(issue.resolution.outcome)}</b> · run ${escapeMarkup(issue.resolution.runId)} · transaction ${escapeMarkup(issue.resolution.transactionId)}</dd>` : ''}</dl>
    ${nonInteractive && suggestion?.fixability !== 'AUTO_APPROVED' ? '<p><b>Large-model policy: recorded as a known issue; export remains allowed.</b></p>' : ''}
    ${status === 'RESOLVED' ? '' : `<div class="ttv-checker-detail-actions">
      <button type="button" data-ttv-checker-status="OPEN">Reopen</button><button type="button" data-ttv-checker-status="RESOLVED">Mark resolved</button><button type="button" data-ttv-checker-status="SUPPRESSED">Skip…</button>
      ${suggestion?.operations?.length && (!nonInteractive || suggestion.fixability === 'AUTO_APPROVED') ? `<button type="button" class="is-primary" data-ttv-checker-apply="${escapeMarkup(suggestion.id)}">Preview & apply</button>` : ''}
    </div>`}`;
}

/** @param {unknown} value @returns {string} */
function formatEvidence(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(3);
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export const _test = Object.freeze({ KPI_FIELDS, filterSelect, fixLabel, formatEvidence, topologyCheckerIconUrl });
