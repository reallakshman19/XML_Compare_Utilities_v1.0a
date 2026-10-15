/** Modeless Topology Checker controller with policy-driven, audited Auto fix. */

import { loadTopologyProducerCore } from './topology-producer-loader.js';
import { wireTopologyCheckerLayout } from './topology-checker-layout.js';
import { checkerBucketMarkup, checkerDetailMarkup, checkerIssueRowMarkup, checkerKpiMarkup, renderCheckerFilterOptions } from './topology-checker-panel.js';
import { CHECKER_FILTER_DEFAULTS, checkerCategoryCounts, checkerFilterValues, checkerIssueRow, checkerObjectIndexes, checkerSelectionRows, filterCheckerIssueRows } from './topology-checker-model.js';
import { clearTopologyCheckerOverlay, renderTopologyCheckerOverlay } from './topology-checker-overlay.js';
import {
  defaultTopologyCheckerPolicy, loadTopologyCheckerPolicy, parseTopologyCheckerPolicy, saveTopologyCheckerPolicy,
  topologyCheckerOptions, topologyCheckerPolicyHash, topologyCheckerPolicyJson,
} from './topology-checker-policy.js';
import { buildEffectiveTopologySuggestions } from './topology-checker-short-fix.js';
import { activeTopologyAutoFixRuns, latestAutoFixFailures, loadTopologyAutoFixRuns, mergeTopologyAutoFixRuns, resolvedTopologyIssues, saveTopologyAutoFixRun } from './topology-checker-history.js';
import { readTopologyCheckerPolicyForm, topologyCheckerSettingsMarkup } from './topology-checker-settings-panel.js';
import { asArray, cleanText, objectRecord } from './topology-validator-values.js';

const FILTER_KEY = 'xml-compare.topology-checker.filters.v1';
const ROW_HEIGHT = 54;

/** @param {Record<string,Element>} elements @param {Record<string,Function>} dependencies @returns {Readonly<Record<string,Function>>} */
export function createTopologyCheckerController(elements, dependencies) {
  const storage = elements.panel.ownerDocument.defaultView?.localStorage ?? null;
  const layout = wireTopologyCheckerLayout(elements.panel, storage);
  let core = null, canonical = null, report = null, suggestions = [], reviewState = null;
  let policy = loadTopologyCheckerPolicy(storage), storedRuns = [], autoFixRuns = [], resolvedIssues = [], historyBasis = '';
  let rows = [], filteredRows = [], selectedIssueId = '', filters = readFilters(storage), destroyed = false, autoBusy = false;

  function announce(message) { elements.live.textContent = message; elements.subtitle.textContent = message; }
  function nonInteractiveMode() { return cleanText(objectRecord(dependencies.modeEvidence?.()).kind) === 'LARGE_SCOPED'; }
  function persistReviewState() { storage?.setItem(reviewKey(report.canonicalTopologyHash), JSON.stringify(reviewState)); dependencies.onReviewChange?.(); }
  function currentEvidence() { return objectRecord(dependencies.evidence()); }
  function currentCanonical() {
    const evidence = currentEvidence(), edit = objectRecord(evidence.edit), trace = objectRecord(evidence.trace);
    const edited = objectRecord(objectRecord(edit.editedArtifacts).canonicalTopology), loaded = objectRecord(objectRecord(trace.artifacts).canonical);
    const value = edited.schema === 'CanonicalTopology.v1' ? edited : loaded;
    if (value.schema !== 'CanonicalTopology.v1') throw new Error('Build or load CanonicalTopology.v1 before running the checker.');
    return value;
  }
  function baseCanonical() {
    const evidence = currentEvidence(), edit = objectRecord(evidence.edit), trace = objectRecord(evidence.trace);
    const base = objectRecord(objectRecord(edit.baseArtifacts).canonicalTopology);
    return base.schema === 'CanonicalTopology.v1' ? base : objectRecord(objectRecord(trace.artifacts).canonical);
  }
  function currentDraft() { return objectRecord(objectRecord(currentEvidence().edit).draft); }
  function selectedObjectIds() { return new Set(asArray(objectRecord(currentEvidence().edit).selection).map((row) => cleanText(objectRecord(row).id)).filter(Boolean)); }
  function restoreReviewState(nextReport) {
    const raw = storage?.getItem(reviewKey(nextReport.canonicalTopologyHash));
    if (!raw) return core.createTopologyReviewState(nextReport);
    const parsed = JSON.parse(raw);
    if (parsed.schema !== 'TopologyReviewState.v1' || parsed.canonicalTopologyHash !== nextReport.canonicalTopologyHash) throw new Error(`Stored topology review state does not match ${nextReport.canonicalTopologyHash}.`);
    return parsed;
  }
  function syncRunEvidence() {
    const basis = cleanText(baseCanonical().canonicalTopologyHash);
    if (historyBasis !== basis) { historyBasis = basis; storedRuns = loadTopologyAutoFixRuns(storage, basis); }
    autoFixRuns = mergeTopologyAutoFixRuns(storedRuns, currentDraft());
    resolvedIssues = resolvedTopologyIssues(currentDraft(), report.issues);
  }
  function reconcileReviewPolicy() {
    let changed = false; const byIssue = new Map(suggestions.map((row) => [row.issueId, row]));
    for (const issue of report.issues) {
      const suggestion = byIssue.get(issue.id), mode = cleanText(suggestion?.effectiveFixMode);
      const review = objectRecord(reviewState.issueStates?.[issue.id]); let status = cleanText(review.status) || 'OPEN';
      const autoSuppressed = status === 'SUPPRESSED' && cleanText(review.reason).startsWith('AUTO:');
      const largeBypass = status === 'ACKNOWLEDGED' && cleanText(review.reason).includes('bypassed by large-model');
      if ((autoSuppressed && mode !== 'AUTO_SUPPRESS') || (largeBypass && (!nonInteractiveMode() || mode === 'AUTO' || mode === 'AUTO_SUPPRESS'))) {
        reviewState = core.setTopologyIssueStatus(report, reviewState, issue.id, 'OPEN', ''); status = 'OPEN'; changed = true;
      }
      if (status !== 'OPEN') continue;
      if (mode === 'AUTO_SUPPRESS') {
        reviewState = core.setTopologyIssueStatus(report, reviewState, issue.id, 'SUPPRESSED', 'AUTO: informational policy rule has no geometry operation.'); changed = true;
      } else if (nonInteractiveMode() && mode !== 'AUTO') {
        const reason = mode === 'CONFIRM' ? 'USER_CONFIRMATION_PENDING: bypassed by large-model non-interactive policy.' : 'KNOWN_ISSUE: bypassed by large-model non-interactive policy.';
        reviewState = core.setTopologyIssueStatus(report, reviewState, issue.id, 'ACKNOWLEDGED', reason); changed = true;
      }
    }
    if (changed) persistReviewState();
  }
  async function refresh() {
    core ??= await loadTopologyProducerCore(); canonical = currentCanonical();
    const started = performance.now(), options = topologyCheckerOptions(canonical, policy);
    report = core.runTopologyChecks(canonical, options);
    suggestions = [...buildEffectiveTopologySuggestions(canonical, report, core.buildTopologyFixSuggestions(canonical, report, {}), policy)];
    reviewState = restoreReviewState(report); reconcileReviewPolicy(); syncRunEvidence();
    const base = baseCanonical(), baseReport = base.canonicalTopologyHash === canonical.canonicalTopologyHash ? report : core.runTopologyChecks(base, topologyCheckerOptions(base, policy));
    rebuildRows(new Set(baseReport.issues.map((issue) => issue.id)));
    announce(`${report.issues.length.toLocaleString()} active findings · ${(performance.now() - started).toFixed(1)} ms`);
    return report;
  }
  function rebuildRows(baselineIssueIds) {
    const indexes = checkerObjectIndexes(canonical), byIssue = new Map(suggestions.map((row) => [row.issueId, row]));
    const failures = latestAutoFixFailures(autoFixRuns);
    const active = report.issues.map((issue) => checkerIssueRow(issue, byIssue.get(issue.id) ?? null,
      { indexes, reviewState, baselineIssueIds, autoFixFailure: failures.get(issue.id) ?? null }));
    const resolved = resolvedIssues.map((record) => checkerIssueRow(record.issue, record.suggestion,
      { indexes, reviewState, baselineIssueIds, statusOverride: 'RESOLVED', resolution: record }));
    rows = [...active, ...resolved]; applyFilters(); updateSummary(); renderFilterLists(); renderDetail();
  }
  function applyFilters() {
    filteredRows = filterCheckerIssueRows(rows, filters, selectedObjectIds());
    if (selectedIssueId && !filteredRows.some((row) => row.id === selectedIssueId)) selectedIssueId = '';
    elements.scroll.scrollTop = 0; renderVisibleRows();
  }
  function renderVisibleRows() {
    const visible = Math.max(12, Math.ceil((elements.scroll.clientHeight || 360) / ROW_HEIGHT) + 12);
    const start = Math.max(0, Math.floor(elements.scroll.scrollTop / ROW_HEIGHT) - 6);
    const slice = filteredRows.slice(start, start + visible).map((row) => ({ ...row, selected: row.id === selectedIssueId }));
    elements.spacer.style.height = `${filteredRows.length * ROW_HEIGHT}px`; elements.rows.style.transform = `translateY(${start * ROW_HEIGHT}px)`;
    elements.rows.innerHTML = slice.map(checkerIssueRowMarkup).join('');
  }
  function autoEligibleRows() { return rows.filter((row) => row.status === 'OPEN' && row.confidence === 'HIGH' && row.effectiveFixMode === 'AUTO'); }
  function updateSummary() {
    const open = rows.filter((row) => row.status === 'OPEN'), autoCount = autoEligibleRows().length;
    const summary = { ...report.summary, openCount: open.length, blockingCount: open.filter((row) => row.blocking).length,
      warningCount: open.filter((row) => row.severity === 'WARNING').length, autoApprovedCount: autoCount,
      needsConfirmationCount: open.filter((row) => row.effectiveFixMode === 'CONFIRM').length,
      acknowledgedCount: rows.filter((row) => row.status === 'ACKNOWLEDGED').length,
      resolvedCount: rows.filter((row) => row.status === 'RESOLVED').length, suppressedCount: rows.filter((row) => row.status === 'SUPPRESSED').length };
    elements.kpis.innerHTML = checkerKpiMarkup(summary); elements.buckets.innerHTML = checkerBucketMarkup(checkerCategoryCounts(rows), filters.category);
    elements.badge.textContent = String(summary.openCount); elements.badge.hidden = summary.openCount === 0;
    elements.autoCount.textContent = String(autoCount); elements.autoFix.disabled = autoBusy || autoCount === 0;
    elements.launcher.classList.toggle('has-known-issues', summary.acknowledgedCount + summary.suppressedCount > 0);
  }
  function renderFilterLists() {
    for (const field of ['severity', 'category', 'code', 'branch', 'objectType', 'confidence', 'fixability', 'status']) renderCheckerFilterOptions(elements.panel.querySelector(`[data-ttv-checker-filter="${field}"]`), checkerFilterValues(rows, field), cleanText(filters[field]));
    renderCheckerFilterOptions(elements.panel.querySelector('[data-ttv-checker-filter="baseline"]'), ['BASELINE', 'NEW'], cleanText(filters.baseline));
    elements.panel.querySelector('[data-ttv-checker-filter="search"]').value = cleanText(filters.search);
    elements.panel.querySelector('[data-ttv-checker-filter="selectedOnly"]').checked = filters.selectedOnly === true;
  }
  function renderDetail() {
    const issue = rows.find((row) => row.id === selectedIssueId) ?? null;
    const resolved = resolvedIssues.find((row) => cleanText(row.issue.id) === selectedIssueId);
    const suggestion = resolved?.suggestion ?? (issue ? suggestions.find((row) => row.issueId === issue.id) ?? null : null);
    elements.detail.innerHTML = checkerDetailMarkup(issue, suggestion, issue?.status ?? '', nonInteractiveMode());
    clearTopologyCheckerOverlay(elements.workspace); if (issue) renderTopologyCheckerOverlay(elements.workspace, issue, suggestion);
  }
  function selectIssue(issueId) {
    const issue = rows.find((row) => row.id === issueId); if (!issue) return;
    selectedIssueId = issue.id; renderVisibleRows(); renderDetail();
    const selection = checkerSelectionRows(canonical, issue); dependencies.select(selection); dependencies.focus(selection); announce(`${issue.code}: ${issue.message}`);
  }
  function setFilter(name, value) {
    filters = { ...filters, [name]: name === 'selectedOnly' ? value === true : cleanText(value) };
    storage?.setItem(FILTER_KEY, JSON.stringify(filters)); applyFilters(); updateSummary(); renderDetail();
  }
  function setReviewStatus(status) {
    const reason = status === 'SUPPRESSED' ? elements.panel.ownerDocument.defaultView?.prompt('Skip reason (required; recorded in export log):', '') : '';
    if (status === 'SUPPRESSED' && reason === null) return;
    reviewState = core.setTopologyIssueStatus(report, reviewState, selectedIssueId, status, reason ?? ''); persistReviewState(); rebuildRows(baselineIds());
  }
  function baselineIds() { return new Set(rows.filter((row) => row.baselineState === 'BASELINE').map((row) => row.id)); }
  function skipIssues(issueIds, label) {
    const reason = elements.panel.ownerDocument.defaultView?.prompt(`Skip ${label} reason (required; recorded in export log):`, 'Accepted for documented export');
    if (reason === null) return;
    for (const issueId of issueIds) reviewState = core.setTopologyIssueStatus(report, reviewState, issueId, 'SUPPRESSED', reason);
    persistReviewState(); rebuildRows(baselineIds());
  }
  async function applySuggestions(selected, approvedOnly) {
    if (!selected.length) { announce('No executable topology fix matches the current selection.'); return; }
    if (nonInteractiveMode() && selected.some((row) => row.effectiveFixMode !== 'AUTO')) { announce('Manual/confirmation fixes are documented as known issues in large-model mode; export remains allowed.'); return; }
    if (!approvedOnly && selected.some((row) => row.effectiveFixMode !== 'AUTO') && !elements.panel.ownerDocument.defaultView?.confirm('Apply this reviewed topology fix as one reversible Edit Draft transaction?')) return;
    await dependencies.applySuggestions(selected, approvedOnly); await refresh();
  }
  async function runAutoFix() {
    const eligible = autoEligibleRows(), byIssue = new Map(suggestions.map((row) => [row.issueId, row]));
    if (!eligible.length) { announce('No Open + High + Auto issues are pending.'); return; }
    autoBusy = true; updateSummary(); announce(`Auto fix: preflighting ${eligible.length} candidate(s)…`);
    try {
      const run = await dependencies.applyAutoFixes({ suggestions: eligible.map((row) => byIssue.get(row.id)).filter(Boolean),
        issueIds: eligible.map((row) => row.id), report, policy, policyHash: topologyCheckerPolicyHash(policy), checkOptions: topologyCheckerOptions(canonical, policy),
        onProgress: ({ completed, total }) => announce(`Auto fix: validated ${completed} of ${total} candidate(s)...`) });
      if (!run) { announce('Auto fix cancelled before an edit scope was selected.'); return; }
      storedRuns = saveTopologyAutoFixRun(storage, historyBasis, storedRuns, run); await refresh(); await dependencies.onReviewChange?.();
      announce(`Auto fix complete: ${run.applied.length} applied, ${run.related.length} related, ${run.rejected.length} left Open.`);
      showAutoFixToast(run);
    } finally { autoBusy = false; updateSummary(); }
  }
  function showAutoFixToast(run) {
    const fixed = asArray(run.applied).length + asArray(run.related).length;
    const operations = Number.isFinite(Number(run.operationCount)) ? Number(run.operationCount) : asArray(run.applied).length;
    elements.toastTitle.textContent = `Auto fixed ${fixed}`;
    elements.toastDetail.textContent = `${operations} ID-wise change(s) recorded in Edit Draft · ${asArray(run.rejected).length} left Open.`;
    elements.toast.hidden = false;
  }
  function forwardToastExport(kind) {
    const selector = kind === 'bundle' ? '[data-ttv-edit-export]' : '[data-ttv-edit-export-staged]';
    const action = elements.workspace.querySelector(selector);
    if (!action || action.disabled) { announce('Export bytes are still being prepared. Please retry when the header action is enabled.'); return; }
    action.click();
  }
  function renderSettings() { elements.settings.innerHTML = topologyCheckerSettingsMarkup(policy, report, suggestions); elements.settings.hidden = false; }
  function closeSettings() { elements.settings.hidden = true; elements.settings.innerHTML = ''; }
  async function setPolicy(next) { policy = saveTopologyCheckerPolicy(storage, next); closeSettings(); await refresh(); dependencies.onReviewChange?.(); }
  function policyError(message) { const target = elements.settings.querySelector('[data-ttv-policy-error]'); if (target) target.textContent = message; }
  function downloadJson(name, text) { const blob = new Blob([text], { type: 'application/json' }), link = elements.panel.ownerDocument.createElement('a'); link.href = URL.createObjectURL(blob); link.download = name; link.click(); URL.revokeObjectURL(link.href); }
  function exportReport() { downloadJson('topology-check-report.json', `${JSON.stringify({ ...report, exportPolicy: 'ALWAYS_ALLOWED', modelMode: dependencies.modeEvidence?.(), reviewState,
    suggestions, policy, policyHash: topologyCheckerPolicyHash(policy), autoFixRuns, resolvedIssues, filteredIssueIds: filteredRows.map((row) => row.id) }, null, 2)}\n`); }
  async function open() { elements.panel.hidden = false; elements.launcher.setAttribute('aria-expanded', 'true'); if (!report || report.canonicalTopologyHash !== currentCanonical().canonicalTopologyHash) await refresh(); }
  function close() { elements.panel.hidden = true; elements.launcher.setAttribute('aria-expanded', 'false'); clearTopologyCheckerOverlay(elements.workspace); }

  const onClick = (event) => handleClick(event).catch((error) => announce(`Checker error: ${error?.message || String(error)}`));
  const onInput = (event) => { if (event.target.matches?.('[data-ttv-checker-filter="search"]')) setFilter('search', event.target.value); };
  const onChange = (event) => handleChange(event).catch((error) => policyError(error?.message || String(error)));
  async function handleChange(event) {
    const filter = event.target.closest?.('[data-ttv-checker-filter]'); if (filter) { setFilter(filter.dataset.ttvCheckerFilter, filter.type === 'checkbox' ? filter.checked : filter.value); return; }
    if (!event.target.matches?.('[data-ttv-policy-file]') || !event.target.files?.[0]) return;
    const next = parseTopologyCheckerPolicy(await event.target.files[0].text()); await setPolicy(next);
  }
  async function handleClick(event) {
    const target = event.target.closest?.('button'); if (!target) return;
    if (target.matches('[data-ttv-autofix-toast-close]')) { elements.toast.hidden = true; return; }
    if (target.dataset.ttvAutofixToastExport) { forwardToastExport(target.dataset.ttvAutofixToastExport); return; }
    if (target === elements.launcher) { await open(); return; }
    if (target.matches('[data-ttv-checker-close]')) { close(); return; }
    if (target.matches('[data-ttv-checker-collapse]')) { layout.toggleCollapsed(); return; }
    if (target.dataset.ttvCheckerLayout) { target.dataset.ttvCheckerLayout === 'reset' ? layout.reset() : layout.setMode(target.dataset.ttvCheckerLayout); return; }
    if (target.matches('[data-ttv-checker-settings]')) { renderSettings(); return; }
    if (target.matches('[data-ttv-policy-close]')) { closeSettings(); return; }
    if (target.matches('[data-ttv-policy-save]')) { await setPolicy(readTopologyCheckerPolicyForm(elements.settings, policy)); return; }
    if (target.matches('[data-ttv-policy-reset]')) { await setPolicy(defaultTopologyCheckerPolicy()); return; }
    if (target.matches('[data-ttv-policy-import]')) { elements.settings.querySelector('[data-ttv-policy-file]').click(); return; }
    if (target.matches('[data-ttv-policy-export]')) { downloadJson('topology-checker-policy.json', topologyCheckerPolicyJson(policy)); return; }
    if (target.dataset.ttvCheckerIssue) { selectIssue(target.dataset.ttvCheckerIssue); return; }
    if (target.dataset.ttvCheckerSkipBucket) { const category = target.dataset.ttvCheckerSkipBucket; skipIssues(rows.filter((row) => row.category === category && row.status !== 'RESOLVED').map((row) => row.id), `bucket ${category}`); return; }
    if (target.dataset.ttvCheckerBucket) { setFilter('category', filters.category === target.dataset.ttvCheckerBucket ? '' : target.dataset.ttvCheckerBucket); renderFilterLists(); return; }
    if (target.matches('[data-ttv-checker-refresh]')) { await refresh(); return; }
    if (target.matches('[data-ttv-checker-auto-fix]')) { await runAutoFix(); return; }
    if (target.matches('[data-ttv-checker-apply-selected]')) { const selected = new Set([...elements.panel.querySelectorAll('.ttv-checker-bulk-select:checked')].map((row) => row.dataset.ttvCheckerBulkId)); await applySuggestions(suggestions.filter((row) => selected.has(row.issueId) && row.operations?.length), false); return; }
    if (target.dataset.ttvCheckerApply) { await applySuggestions(suggestions.filter((row) => row.id === target.dataset.ttvCheckerApply), false); return; }
    if (target.dataset.ttvCheckerStatus) { setReviewStatus(target.dataset.ttvCheckerStatus); return; }
    if (target.matches('[data-ttv-checker-export]')) exportReport();
  }

  elements.workspace.addEventListener('click', onClick); elements.panel.addEventListener('change', onChange);
  elements.panel.addEventListener('input', onInput); elements.scroll.addEventListener('scroll', renderVisibleRows);
  return Object.freeze({ open, close, refresh, selectIssue, evidence: () => Object.freeze({ report, suggestions, reviewState, filters, policy,
    policyHash: topologyCheckerPolicyHash(policy), autoFixRuns, resolvedIssues, autoEligibleCount: autoEligibleRows().length, filteredCount: filteredRows.length }), destroy: () => {
    if (destroyed) return; destroyed = true; elements.workspace.removeEventListener('click', onClick); elements.panel.removeEventListener('change', onChange);
    elements.panel.removeEventListener('input', onInput); elements.scroll.removeEventListener('scroll', renderVisibleRows); layout.destroy(); clearTopologyCheckerOverlay(elements.workspace);
  } });
}

function readFilters(storage) { const raw = storage?.getItem(FILTER_KEY); return raw ? { ...CHECKER_FILTER_DEFAULTS, ...JSON.parse(raw) } : { ...CHECKER_FILTER_DEFAULTS }; }
function reviewKey(hash) { return `xml-compare.topology-checker.review.${cleanText(hash)}`; }
export const _test = Object.freeze({ FILTER_KEY, ROW_HEIGHT, readFilters, reviewKey, topologyCheckerOptions, activeTopologyAutoFixRuns });
