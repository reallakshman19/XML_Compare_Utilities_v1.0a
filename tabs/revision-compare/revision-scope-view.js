/** Scope confirmation markup for common and one-sided branches. */
import { revisionBasisApprovalReadiness } from './revision-compare-readiness.js';
import { revisionScopeBatchModel } from './revision-scope-filter-batch.js';
import { revisionScopeFilterResetModel } from './revision-scope-filter-reset.js';
import { revisionScopeResetModel } from './revision-scope-reset.js';
import { revisionVisualMetadataRecoveryModel } from './revision-visual-metadata-navigation.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

function rowSelected(proposal, group, branchId) {
  if (group === 'revBOnly') return proposal.includedBranchIdsB.includes(branchId);
  return proposal.includedBranchIdsA.includes(branchId);
}

function countText(entry, group) {
  if (group === 'common') return `${entry.componentCountA} / ${entry.componentCountB} components`;
  return `${entry.componentCount} components`;
}

function branchRow(entry, group, proposal) {
  const checked = rowSelected(proposal, group, entry.branchId) ? 'checked' : '';
  return `<label class="revc-scope-row" data-revc-scope-row>
    <input type="checkbox" data-revc-branch-id="${escapeHtml(entry.branchId)}" ${checked}>
    <span><b>${escapeHtml(entry.label)}</b><small>${escapeHtml(entry.site || 'No site')} · ${escapeHtml(entry.owner || 'No owner')}</small></span>
    <em>${escapeHtml(countText(entry, group))}</em>
  </label>`;
}

function batchButtons(batch) {
  const disabled = batch.visibleCount ? '' : 'disabled';
  return `<div class="revc-group-actions">
    <button type="button" data-revc-group="${batch.group}" data-revc-include="all" data-revc-batch-count="${batch.visibleCount}" ${disabled}>${batch.selectLabel}</button>
    <button type="button" data-revc-group="${batch.group}" data-revc-include="none" data-revc-batch-count="${batch.visibleCount}" ${disabled}>${batch.clearLabel}</button>
  </div>`;
}

function filterNote(batch) {
  if (!batch.filtered) return '';
  return `<p class="revc-filter-note">${batch.visibleCount} of ${batch.totalCount} branch(es) visible; batch actions preserve ${batch.hiddenCount} hidden row(s).</p>`;
}

function emptyText(batch) {
  return batch.totalCount ? 'No branches match this filter.' : 'No branches in this group.';
}

function groupMarkup(group, title, description, state) {
  const batch = revisionScopeBatchModel(state, group);
  return `<section class="revc-scope-group" data-revc-scope-group="${group}">
    <header>
      <div><h3>${escapeHtml(title)} <span>${batch.visibleCount} visible · ${batch.hiddenCount} hidden</span></h3><p>${escapeHtml(description)}</p></div>
      ${batchButtons(batch)}
    </header>
    <label class="revc-search">Filter ${escapeHtml(title)}
      <input type="search" value="${escapeHtml(state.search?.[group] ?? '')}" data-revc-search="${group}" placeholder="Branch, site, or owner">
    </label>
    ${filterNote(batch)}
    <div class="revc-scope-list">${batch.entries.length ? batch.entries.map((entry) => branchRow(entry, group, state.proposal)).join('') : `<p class="revc-empty">${emptyText(batch)}</p>`}</div>
  </section>`;
}

function approvalStatusMarkup(state, readiness) {
  if (readiness.status === 'READY') return '<small data-revc-basis-approval-status="ready">Visual metadata is complete.</small>';
  const recovery = revisionVisualMetadataRecoveryModel(state, readiness);
  if (!recovery.visible) return `<small data-revc-basis-approval-status="blocked">${escapeHtml(readiness.blockers.join(' '))}</small>`;
  const missing = `Missing visual metadata: ${recovery.missingFields.join(', ')}.`;
  const guidance = `${readiness.blockers.join(' ')} ${missing}`;
  return `<div class="revc-session-actions"><small data-revc-basis-approval-status="blocked">${escapeHtml(guidance)}</small><button type="button" data-revc-resolve-visual-metadata aria-controls="${recovery.targetId}">Resolve visual metadata</button></div>`;
}

function filterResetMarkup(state) {
  const reset = revisionScopeFilterResetModel(state);
  const imported = state.evidencePackageImport?.status === 'VERIFIED';
  if (!reset.visible || imported) return '';
  return `<div class="revc-session-actions" data-revc-filter-reset-status>
    <small>${escapeHtml(reset.message)}</small>
    <button type="button" data-revc-clear-scope-filters data-revc-filter-count="${reset.activeCount}">${escapeHtml(reset.label)}</button>
  </div>`;
}

function scopeResetMarkup(state) {
  const reset = revisionScopeResetModel(state);
  const imported = state.evidencePackageImport?.status === 'VERIFIED';
  if (!reset.visible || imported) return '';
  return `<div class="revc-session-actions" data-revc-scope-reset-status>
    <small>${escapeHtml(reset.message)}</small>
    <button type="button" data-revc-group="reset" data-revc-include="all" data-revc-reset-count="${reset.decisionCount}">${escapeHtml(reset.label)}</button>
  </div>`;
}

export function revisionScopeMarkup(state, preflight) {
  const proposal = state.proposal;
  if (!proposal) return '';
  const summary = proposal.summary;
  const approval = revisionBasisApprovalReadiness(preflight);
  const disabled = approval.status !== 'READY' ? 'disabled' : '';
  return `<section class="revc-scope-stage" aria-labelledby="revc-scope-title">
    <header class="revc-stage-head">
      <div><span>STAGE 2</span><h2 id="revc-scope-title">Confirm branch scope</h2><p>Common and one-sided branches are selected by default. Exclusions are deliberate and recorded.</p></div>
      <strong data-status="${escapeHtml(state.basisStatus.toLowerCase())}">${escapeHtml(state.basisStatus)}</strong>
    </header>
    <div class="revc-scope-summary">
      <div><b>${summary.commonBranchCount}</b><span>Common</span></div>
      <div><b>${summary.revAOnlyBranchCount}</b><span>Rev A only</span></div>
      <div><b>${summary.revBOnlyBranchCount}</b><span>Rev B only</span></div>
      <div><b>${summary.includedBranchCountA} / ${summary.includedBranchCountB}</b><span>Included A / B</span></div>
      <div><b>${summary.retainedComponentCountA} / ${summary.retainedComponentCountB}</b><span>Components A / B</span></div>
    </div>
    <div class="revc-scope-groups">
      ${groupMarkup('common', 'Common branches', 'Exact branch identity exists in both revisions.', state)}
      ${groupMarkup('revAOnly', 'Rev A only', 'Included as future removal candidates.', state)}
      ${groupMarkup('revBOnly', 'Rev B only', 'Included as future addition candidates.', state)}
    </div>
    <div class="revc-scope-footer">
      <div><b>Active basis</b><span>${summary.includedBranchCountA} Rev A branches · ${summary.includedBranchCountB} Rev B branches · ${summary.excludedBranchCount} excluded</span>${approvalStatusMarkup(state, approval)}${filterResetMarkup(state)}${scopeResetMarkup(state)}</div>
      <div class="revc-actions">
        <button type="button" data-revc-download-scope>Download scope/basis manifest</button>
        <button type="button" class="revc-primary" data-revc-approve-basis ${disabled}>Approve comparison basis</button>
      </div>
    </div>
  </section>`;
}

export const _test = Object.freeze({ approvalStatusMarkup, batchButtons, branchRow, emptyText, escapeHtml, filterNote, filterResetMarkup, groupMarkup, scopeResetMarkup });