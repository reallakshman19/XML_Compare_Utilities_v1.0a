/** Escaped paged presentation of transfer draft intent and retained immutable evidence. */
const DOWNLOADS = Object.freeze([
  ['data-revc-download-patched-json', 'Download patched target JSON'],
  ['data-revc-download-transfer-audit', 'Download transfer audit'],
  ['data-revc-download-transfer-proof', 'Download transfer proof'],
  ['data-revc-download-transfer-manifest', 'Download transfer manifest'],
]);
const GROUPS = Object.freeze([
  'DESCRIPTION', 'MATERIAL_AND_SPECIFICATION', 'RATING_AND_DIMENSIONS',
  'WEIGHT_AND_LENGTH', 'OTHER_ALLOWED', 'PROTECTED_OR_CONTROLLED',
]);
const TRANSFER_CSS = `.revc-transfer-section{display:grid;gap:1rem;padding:1rem;border:1px solid var(--border,#445);border-radius:.75rem}.revc-transfer-section>header,.revc-transfer-plan>header,.revc-transfer-result>header{display:flex;justify-content:space-between;gap:1rem}.revc-transfer-toolbar{display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:.65rem}.revc-transfer-toolbar label{display:grid;gap:.25rem}.revc-transfer-batch,.revc-transfer-page-controls{display:flex;gap:.5rem;flex-wrap:wrap;align-items:end}.revc-transfer-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));gap:.5rem}.revc-transfer-facts div{min-width:0}.revc-transfer-facts dd{overflow-wrap:anywhere}.revc-transfer-pair{display:grid;gap:.65rem;padding:.75rem;border:1px solid var(--border,#445);border-radius:.5rem}.revc-transfer-pair>label{display:grid;grid-template-columns:auto 1fr 1fr auto;gap:.75rem;align-items:start}.revc-transfer-field{display:flex;gap:.5rem;padding:.5rem}.revc-transfer-field span{display:grid;gap:.2rem;min-width:0}.revc-transfer-field code,.revc-transfer-operation-row code{overflow-wrap:anywhere}.revc-transfer-table-wrap{overflow:auto}.revc-transfer-section table{width:100%;border-collapse:collapse}.revc-transfer-section th,.revc-transfer-section td{padding:.5rem;text-align:left;vertical-align:top;border-bottom:1px solid var(--border,#445)}.revc-transfer-section td small{display:block}.revc-transfer-invariants{display:grid;grid-template-columns:repeat(auto-fit,minmax(13rem,1fr));gap:.4rem;list-style:none;padding:0}.revc-transfer-invariants li{display:flex;gap:.5rem}.revc-transfer-section pre{max-height:24rem;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}`;
const INVARIANTS = Object.freeze([
  ['jsonReparseSucceeded', 'JSON reparse succeeded'], ['supportedRootAndProfile', 'Root/profile preserved'],
  ['schemaAndEnvelopeUnchanged', 'Schema/envelope preserved'], ['entityCountUnchanged', 'Entity count preserved'],
  ['entityIdentitiesUnchanged', 'Entity identities preserved'], ['hierarchyAndTopologyUnchanged', 'Hierarchy/topology preserved'],
  ['arrayLengthsAndOrderUnchanged', 'Array lengths/order preserved'], ['objectKeyOrderPreserved', 'Object-key order preserved'],
  ['unknownFieldsRetained', 'Unknown fields retained'], ['unselectedValuesUnchanged', 'Unselected values unchanged'],
  ['everyMutationCoveredExactlyOnce', 'Every mutation covered exactly once'],
]);
export function escapeRevisionCompareTransferHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}
function valueText(value) { return value === undefined ? 'ABSENT' : typeof value === 'string' ? value : JSON.stringify(value); }
function selectedPair(model, differenceId) { return model?.draft?.pairs?.find((pair) => pair.differenceId === differenceId) ?? null; }
function messages(values, tone = 'blocker') {
  return values?.length ? `<ul class="revc-transfer-messages" data-tone="${tone}">${values.map((value) => `<li>${escapeRevisionCompareTransferHtml(value)}</li>`).join('')}</ul>` : '';
}
function options(values, selected, labels = {}) {
  return values.map((value) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${escapeRevisionCompareTransferHtml(labels[value] ?? String(value).replaceAll('_', ' '))}</option>`).join('');
}
function sortOptions(presentation) {
  const keys = ['DIFFERENCE_ID', 'SOURCE_ENTITY_ID', 'TARGET_ENTITY_ID', 'ELIGIBILITY', 'SELECTED_FIELD_COUNT'];
  return keys.flatMap((key) => ['ASC', 'DESC'].map((direction) => {
    const value = `${key}:${direction}`; const selected = presentation.sortKey === key && presentation.sortDirection === direction;
    return `<option value="${value}" ${selected ? 'selected' : ''}>${key.replaceAll('_', ' ')} · ${direction}</option>`;
  })).join('');
}
function toolbarMarkup(model) {
  const p = model.query.presentation; const summary = model.query.summary;
  return `<section class="revc-transfer-toolbar" aria-label="Transfer productivity controls"><label>Search transfer candidates<input type="search" data-revc-transfer-search value="${escapeRevisionCompareTransferHtml(p.search)}"></label><label>Eligibility<select data-revc-transfer-eligibility-filter>${options(['ALL','ELIGIBLE','BLOCKED','SELECTED'],p.eligibilityFilter)}</select></label><label>Policy<select data-revc-transfer-policy-filter>${options(['ALL','ALLOWED','CONTROLLED','PROTECTED'],p.policyFilter)}</select></label><label>Property group<select data-revc-transfer-property-group-filter>${options(['ALL',...GROUPS],p.propertyGroupFilter)}</select></label><label>Match<select data-revc-transfer-match-filter>${options(['ALL','EXACT','INFERRED','AMBIGUOUS'],p.matchFilter)}</select></label><label>Selected only<input type="checkbox" data-revc-transfer-selected-only ${p.selectedOnly ? 'checked' : ''}></label><label>Sort<select data-revc-transfer-sort>${sortOptions(p)}</select></label><label>Page size<select data-revc-transfer-page-size>${options([25,50,100],p.pageSize)}</select></label><div class="revc-transfer-page-controls"><button type="button" data-revc-transfer-page-action="PREVIOUS" ${p.page <= 1 ? 'disabled' : ''}>Previous page</button><label>Page<input type="number" min="1" max="${model.query.pageCount}" value="${p.page}" data-revc-transfer-page></label><button type="button" data-revc-transfer-page-action="NEXT" ${p.page >= model.query.pageCount ? 'disabled' : ''}>Next page</button></div></section><div class="revc-transfer-batch"><button type="button" data-revc-transfer-select-visible ${summary.selectableVisibleFields ? '' : 'disabled'}>Select ${summary.selectableVisibleFields} eligible visible fields</button><button type="button" data-revc-transfer-clear-visible ${summary.visibleCandidatePairs ? '' : 'disabled'}>Clear visible selection</button><button type="button" data-revc-transfer-clear-all ${summary.selectedPairs ? '' : 'disabled'}>Clear all transfer selection</button></div>`;
}
function fieldMarkup(field, pair, differenceId) {
  const checked = pair?.fieldKeys.includes(field.fieldKey); const disabled = !pair || !field.eligible;
  const current = field.targetState === 'PRESENT' ? valueText(field.targetValue) : 'ABSENT';
  return `<label class="revc-transfer-field" data-policy="${escapeRevisionCompareTransferHtml(field.policy.classification.toLowerCase())}" data-group="${escapeRevisionCompareTransferHtml(field.propertyGroup)}"><input type="checkbox" data-revc-transfer-field="${escapeRevisionCompareTransferHtml(field.fieldKey)}" data-revc-transfer-difference-id="${escapeRevisionCompareTransferHtml(differenceId)}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span><b>${escapeRevisionCompareTransferHtml(field.propertyKey)}</b><code>${escapeRevisionCompareTransferHtml(field.targetFieldPath || 'Unresolved path')}</code><small>Current: ${escapeRevisionCompareTransferHtml(current)} · Donor: ${escapeRevisionCompareTransferHtml(valueText(field.sourceValue))}</small><em>${escapeRevisionCompareTransferHtml(field.propertyGroup)} · ${escapeRevisionCompareTransferHtml(field.policy.classification)} · ${escapeRevisionCompareTransferHtml(field.policy.ruleId)}</em>${messages(field.blockers)}</span></label>`;
}
function pairMarkup(entry, model) {
  const candidate = entry.candidate; const pair = selectedPair(model, candidate.differenceId);
  return `<article class="revc-transfer-pair" data-revc-transfer-pair-row="${escapeRevisionCompareTransferHtml(candidate.differenceId)}"><label><input type="checkbox" data-revc-transfer-pair="${escapeRevisionCompareTransferHtml(candidate.differenceId)}" ${pair ? 'checked' : ''} ${candidate.eligible ? '' : 'disabled'}><span><b>${escapeRevisionCompareTransferHtml(candidate.sourceRecordId || 'Unresolved source')}</b><small>Rev A — donor</small></span><span><b>${escapeRevisionCompareTransferHtml(candidate.targetRecordId || 'Unresolved receiver')}</b><small>Rev B — receiver</small></span><em>${escapeRevisionCompareTransferHtml(candidate.matchCertainty)} · ${escapeRevisionCompareTransferHtml(candidate.decisionState)}</em></label>${messages(candidate.blockers)}<div class="revc-transfer-fields">${entry.fields.length ? entry.fields.map((field) => fieldMarkup(field, pair, candidate.differenceId)).join('') : '<p class="revc-empty">No fields match the current transfer query.</p>'}</div></article>`;
}
function candidateMarkup(model) {
  return model.query.entries.length ? `<div class="revc-transfer-candidates">${model.query.entries.map((entry) => pairMarkup(entry, model)).join('')}</div>` : '<p class="revc-empty">No transfer candidates match the current query.</p>';
}
function fact(label, value, selector = '') { return `<div><dt>${escapeRevisionCompareTransferHtml(label)}</dt><dd ${selector}>${escapeRevisionCompareTransferHtml(value ?? '—')}</dd></div>`; }
function selectedGroups(summary) {
  const values = Object.entries(summary.selectedFieldsByPropertyGroup);
  return values.length ? values.map(([group, count]) => `${group}: ${count}`).join(' · ') : 'None';
}
function productivitySummary(model) {
  const summary = model.query.summary;
  return `<dl class="revc-transfer-facts">${fact('Total candidate pairs', summary.totalCandidatePairs, 'data-revc-transfer-total-count')}${fact('Visible candidate pairs', summary.visibleCandidatePairs, 'data-revc-transfer-visible-count')}${fact('Filtered candidate pairs', summary.filteredCandidatePairs)}${fact('Eligible visible pairs', summary.eligibleVisiblePairs)}${fact('Blocked visible fields', summary.blockedVisibleFields)}${fact('Selected pairs across all pages', summary.selectedPairs)}${fact('Selected fields across all pages', summary.selectedFields, 'data-revc-transfer-selected-field-count')}${fact('Selected fields by group', selectedGroups(summary))}${fact('Page', `${model.query.presentation.page} / ${model.query.pageCount}`)}</dl>`;
}
function planSummary(plan) {
  const summary = plan.summary;
  return `<dl class="revc-transfer-facts">${fact('Selected items', summary.selectedItemCount)}${fact('Operations', summary.operationCount)}${fact('READY', summary.readyOperationCount)}${fact('BLOCKED', summary.blockedOperationCount)}${fact('Replace existing', summary.replaceExistingCount)}${fact('Add missing', summary.addMissingCount)}</dl>`;
}
function operationMarkup(operation) {
  const current = operation.expectedTargetState === 'PRESENT' ? valueText(operation.beforeValue) : 'ABSENT'; const evidence = operation.evidenceReferences ?? {};
  return `<tr data-revc-transfer-operation-row="${escapeRevisionCompareTransferHtml(operation.operationId)}"><td><code>${escapeRevisionCompareTransferHtml(operation.sourceEntityId)}</code></td><td><code>${escapeRevisionCompareTransferHtml(operation.targetEntityId)}</code><small>${escapeRevisionCompareTransferHtml(operation.targetCanonicalPath)}</small></td><td><code>${escapeRevisionCompareTransferHtml(operation.fieldPath)}</code></td><td>${escapeRevisionCompareTransferHtml(current)}</td><td>${escapeRevisionCompareTransferHtml(valueText(operation.afterValue))}</td><td>${escapeRevisionCompareTransferHtml(operation.operationType)}<small>${escapeRevisionCompareTransferHtml(operation.transferPolicy?.classification)} · ${escapeRevisionCompareTransferHtml(operation.transferPolicy?.ruleId)}</small></td><td>${escapeRevisionCompareTransferHtml(evidence.reviewSessionId || 'Review evidence unavailable')}<small>${escapeRevisionCompareTransferHtml(evidence.decisionEventId || 'Decision not required')}</small></td><td><b data-status="${escapeRevisionCompareTransferHtml(operation.status.toLowerCase())}">${escapeRevisionCompareTransferHtml(operation.status)}</b>${messages(operation.blockers)}</td></tr>`;
}
function planMarkup(transfer) {
  const plan = transfer.plan; if (!plan) return '';
  return `<section class="revc-transfer-plan"><header><h3>Immutable transfer plan</h3><strong data-status="${escapeRevisionCompareTransferHtml(plan.status.toLowerCase())}">${escapeRevisionCompareTransferHtml(plan.status)}</strong></header><dl class="revc-transfer-facts">${fact('Direction', plan.direction)}${fact('Plan ID', plan.planId, 'data-revc-transfer-plan-id')}${fact('Plan content SHA-256', plan.contentSha256, 'data-revc-transfer-plan-sha')}</dl>${planSummary(plan)}${messages(plan.blockers)}<div class="revc-transfer-table-wrap"><table><thead><tr><th>Source entity</th><th>Target entity/path</th><th>Field</th><th>Current</th><th>Proposed</th><th>Operation/policy</th><th>Evidence</th><th>Status</th></tr></thead><tbody>${plan.operations.map(operationMarkup).join('')}</tbody></table></div></section>`;
}
function invariantMarkup(proof) { return `<ul class="revc-transfer-invariants">${INVARIANTS.map(([key, label]) => `<li data-status="${proof.invariants?.[key] ? 'ready' : 'blocked'}"><b>${proof.invariants?.[key] ? 'PASS' : 'FAIL'}</b><span>${escapeRevisionCompareTransferHtml(label)}</span></li>`).join('')}</ul>`; }
function downloadMarkup(current) { return `<div class="revc-session-actions">${DOWNLOADS.map(([selector, label]) => `<button type="button" ${selector} ${current ? '' : 'disabled'}>${label}</button>`).join('')}</div>`; }
function resultMarkup(transfer) {
  const result = transfer.result; if (!result) return ''; const proof = transfer.proof; const current = transfer.status === 'APPLIED';
  return `<section class="revc-transfer-result"><header><h3>${current ? 'Applied transfer result' : 'Historical transfer result'}</h3><strong data-status="${escapeRevisionCompareTransferHtml(transfer.status.toLowerCase())}">${escapeRevisionCompareTransferHtml(transfer.status)}</strong></header><dl class="revc-transfer-facts">${fact('Result ID', result.resultId, 'data-revc-transfer-result-id')}${fact('Result content SHA-256', result.contentSha256, 'data-revc-transfer-result-sha')}${fact('Plan ID', result.planId)}${fact('Plan SHA-256', result.planContentSha256)}${fact('Original Rev B document', result.targetDocumentId)}${fact('Original Rev B SHA-256', result.originalTargetSha256)}${fact('Patched target document', result.patchedTargetDocumentId)}${fact('Patched target SHA-256', result.patchedTargetSha256, 'data-revc-transfer-patched-sha')}${fact('Created at', result.createdAt)}</dl><dl class="revc-transfer-facts">${fact('Plan operations', result.summary.planOperationCount)}${fact('Applied', result.summary.appliedOperationCount)}${fact('Skipped', result.summary.skippedOperationCount)}${fact('Blocked', result.summary.blockedOperationCount)}</dl><div data-revc-transfer-verification="${escapeRevisionCompareTransferHtml(proof?.status ?? 'UNAVAILABLE')}"><h4>Verification evidence</h4>${proof ? invariantMarkup(proof) : '<p>Verification proof unavailable.</p>'}${messages(proof?.errors)}</div><details><summary>Transfer audit details</summary><pre>${escapeRevisionCompareTransferHtml(JSON.stringify(transfer.audit, null, 2))}</pre></details><details><summary>Transfer proof details</summary><pre>${escapeRevisionCompareTransferHtml(JSON.stringify(proof, null, 2))}</pre></details>${current ? downloadMarkup(true) : `<p class="revc-stale-notice">Historical evidence is retained, but STALE transfer artifacts cannot download as current.</p>${downloadMarkup(false)}`}</section>`;
}
function transferStatus(transfer) { return transfer.request ? 'PLANNING' : transfer.status; }
export function revisionCompareTransferMarkup(state, model) {
  const transfer = state.transfer; const status = transferStatus(transfer); const summary = model.query.summary;
  const canPlan = summary.selectedFields > 0 && !transfer.request && transfer.status !== 'APPLYING';
  const canApply = transfer.status === 'PLANNED' && transfer.plan?.status === 'READY' && !transfer.applyRequest;
  return `<style>${TRANSFER_CSS}</style><section class="revc-transfer-section" data-revc-transfer-section><header><div><span>TRANSFER REVIEW</span><h2>Direct Staged-JSON transfer</h2><p>Search, filter and page current candidates. Draft intent is explicit, workspace-owned and never follows viewer focus.</p></div><strong data-revc-transfer-status="${escapeRevisionCompareTransferHtml(status)}" data-status="${escapeRevisionCompareTransferHtml(status.toLowerCase())}">${escapeRevisionCompareTransferHtml(status)}</strong></header><dl class="revc-transfer-facts">${fact('Direction', 'Rev A — donor → Rev B — receiver', 'data-revc-transfer-direction')}${fact('Eligible pairs', model.candidates.filter((candidate) => candidate.eligible).length, 'data-revc-transfer-eligible-count')}${fact('Selected pairs / fields', `${summary.selectedPairs} / ${summary.selectedFields}`, 'data-revc-transfer-selection-count')}</dl>${toolbarMarkup(model)}${productivitySummary(model)}${candidateMarkup(model)}<div class="revc-session-actions"><button type="button" class="revc-primary" data-revc-create-transfer-plan ${canPlan ? '' : 'disabled'}>Create transfer plan</button><button type="button" data-revc-apply-transfer ${canApply ? '' : 'disabled'}>Apply transfer plan</button></div>${transfer.error ? messages([transfer.error]) : ''}${planMarkup(transfer)}${resultMarkup(transfer)}</section>`;
}
export function renderRevisionCompareTransferSection(root, state, model) {
  const host = root.querySelector('.revc-review-side'); if (!host || !model) return null;
  host.insertAdjacentHTML('beforeend', revisionCompareTransferMarkup(state, model)); return host.querySelector('[data-revc-transfer-section]');
}
export const _test = Object.freeze({ candidateMarkup, fieldMarkup, operationMarkup, productivitySummary, resultMarkup, toolbarMarkup, transferStatus, valueText });
