/** RC-003 guided review extended in place with RC-004 decision evidence. */
import { REVIEW_NOTE_MAX_LENGTH, reviewEventIndex, reviewItemIndex } from './revision-review-contracts.js';
import { nextPriorityDifferenceId, previousPriorityDifferenceId } from './revision-review-priority.js';
import { reviewSessionMatchesAudit } from './revision-review-session.js';
import {
  decisionBadgeMarkup, decisionFilterMarkup, decisionInspectorMarkup, decisionLedgerControlsMarkup,
  decisionProgressMarkup,
} from './revision-decision-view.js';
import { revisionImpactReportMarkup } from './revision-impact-report-view.js';
import { reviewPriorityProjection } from './revision-review-projection.js';

export { reviewPriorityProjection } from './revision-review-projection.js';

function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
function human(value) { return String(value ?? '').replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase()); }
function titleText(row) { return row.context?.revBIdentity || row.context?.revAIdentity || row.context?.componentType || row.differenceId; }
function primaryReason(row) {
  if (row.matchCertainty === 'AMBIGUOUS') return 'Multiple bounded candidates require an explicit engineering decision.';
  if (row.changeReasons.includes('GEOMETRY')) return 'Supported geometry changed.';
  if (row.changeReasons.includes('PROPERTIES')) return 'Engineering properties changed.';
  if (row.differenceCategory === 'ADDED') return 'Present only in Rev B.';
  if (row.differenceCategory === 'REMOVED') return 'Present only in Rev A.';
  return row.evidenceSummary?.primary || 'Comparison evidence is unavailable.';
}
function progressCard(label, value, tone) { return `<div data-tone="${tone}"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`; }
export function reviewProgressMarkup(session) {
  if (!session) return '<section class="revc-review-progress"><h2>Review progress</h2><p class="revc-empty">No review session yet.</p></section>';
  const summary = session.summary;
  return `<section class="revc-review-progress"><header><h2>Review progress</h2><strong data-status="${session.status.toLowerCase()}">${session.status}</strong></header><div>${progressCard('Reviewed', summary.reviewed, 'reviewed')}${progressCard('Unreviewed', summary.unreviewed, 'unreviewed')}${progressCard('Needs clarification', summary.needsClarification, 'clarification')}${progressCard('Unresolved', summary.unresolved, 'unresolved')}${progressCard('Completion %', summary.completionPercent, 'completion')}</div></section>`;
}
function sessionFact(label, value) { return `<div><dt>${escapeHtml(label)}</dt><dd><code>${escapeHtml(value ?? 'Unavailable')}</code></dd></div>`; }
function sessionDetails(session) {
  if (!session) return '';
  return `<details class="revc-session-details"><summary>Session details</summary><dl>${sessionFact('Audit ID', session.auditId)}${sessionFact('Review session ID', session.reviewSessionId)}${sessionFact('Status', session.status)}${sessionFact('Revision', session.revision)}${sessionFact('Basis ID', session.basisId)}${sessionFact('Rev A document', session.revADocumentId)}${sessionFact('Rev B document', session.revBDocumentId)}${sessionFact('Created', session.createdAt)}${sessionFact('Updated', session.updatedAt)}${sessionFact('Validation', session.validation?.status)}</dl></details>`;
}
export function reviewSessionControlsMarkup(state, auditAvailable) {
  const session = state.review.session; const mismatch = Boolean(auditAvailable && session && !reviewSessionMatchesAudit(session, state.compare.audit));
  const stale = session?.status === 'STALE';
  return `<section class="revc-review-session"><header><div><span>REVIEW SESSION</span><h2>${session ? escapeHtml(session.reviewSessionId) : 'Not started'}</h2></div>${session ? `<strong data-status="${session.status.toLowerCase()}">${session.status}</strong>` : ''}</header>${stale ? '<p class="revc-stale-notice">This preserved review session is read-only and remains downloadable.</p>' : ''}${mismatch ? '<p class="revc-session-mismatch">The current comparison audit differs. Review state was not remapped.</p>' : ''}${state.review.importError ? `<p class="revc-import-error">${escapeHtml(state.review.importError)}</p>` : ''}<div class="revc-session-actions">${session ? '<button type="button" data-revc-download-review>Download review session</button>' : ''}${auditAvailable ? '<label class="revc-import-button">Import review session<input type="file" accept=".json,application/json" data-revc-review-import></label>' : ''}${state.review.replacementRequired && auditAvailable ? '<button type="button" class="revc-primary" data-revc-start-new-review>Start new review session</button>' : ''}</div>${sessionDetails(session)}</section>`;
}
function pressed(value) { return value ? 'aria-pressed="true"' : 'aria-pressed="false"'; }
function stateFilters(state) {
  const active = new Set(state.review.filters.reviewStates);
  return `<div class="revc-filter-row" aria-label="Review states">${['UNREVIEWED', 'REVIEWED', 'NEEDS_CLARIFICATION', 'UNRESOLVED'].map((value) => `<label><input type="checkbox" data-revc-review-state-filter="${value}" ${active.has(value) ? 'checked' : ''}>${human(value)}</label>`).join('')}</div>`;
}
function certaintyFilters(state) {
  const active = new Set(state.review.filters.certainties);
  return `<div class="revc-filter-row" aria-label="Match certainty">${['EXACT', 'INFERRED', 'AMBIGUOUS', 'NOT_APPLICABLE'].map((value) => `<label><input type="checkbox" data-revc-certainty-filter="${value}" ${active.has(value) ? 'checked' : ''}>${human(value)}</label>`).join('')}</div>`;
}
function categoryFilters(state) {
  const active = new Set(state.compare.queue.categories);
  return `<div class="revc-filter-row" aria-label="Difference categories">${['CHANGED', 'ADDED', 'REMOVED'].map((value) => `<button type="button" data-revc-category="${value}" ${pressed(active.has(value))}>${human(value)}</button>`).join('')}<label><input type="checkbox" data-revc-needs-decision ${state.compare.queue.needsDecisionOnly ? 'checked' : ''}>Original needs decision</label></div>`;
}
function reasonFilters(state) {
  const active = new Set(state.compare.queue.changedReasons); const labels = { GEOMETRY: 'Geometry', PROPERTIES: 'Properties', CONNECTIVITY: 'Connectivity', SUPPORT_HIERARCHY: 'Support / hierarchy' };
  return `<div class="revc-filter-row revc-reason-filters">${Object.entries(labels).map(([value, label]) => `<label><input type="checkbox" data-revc-changed-reason="${value}" ${active.has(value) ? 'checked' : ''}>${label}</label>`).join('')}</div>`;
}
function queueRow(entry, selected) {
  const { row, item } = entry;
  return `<button type="button" class="revc-queue-row" data-revc-difference-id="${escapeHtml(row.differenceId)}" ${selected ? 'aria-current="true"' : ''}><span><b>${escapeHtml(titleText(row))}</b><small>${escapeHtml(row.context?.branchId)} · ${escapeHtml(row.context?.componentType)}</small></span><em data-category="${row.differenceCategory.toLowerCase()}">${human(row.differenceCategory)}</em><strong data-review-state="${item.reviewState.toLowerCase()}">${human(item.reviewState)}</strong>${decisionBadgeMarkup(entry)}<span class="revc-queue-reason">${escapeHtml(primaryReason(row))}</span><small>${human(row.matchCertainty)}</small></button>`;
}
export function reviewQueueMarkup(state) {
  if (state.review.replacementRequired) return '<section class="revc-review-queue"><h2>Change queue</h2><p class="revc-empty">Start a new review session explicitly for this different audit.</p></section>';
  const projection = reviewPriorityProjection(state); const selected = state.compare.selectedDifferenceId;
  const hiddenSelected = Boolean(selected && !projection.visible.some((entry) => entry.row.differenceId === selected));
  return `<section class="revc-review-queue"><header><div><h2>Change queue</h2><small>Deterministic review priority</small></div><span>${projection.visibleCount} shown · ${projection.hiddenCount} hidden</span></header><label class="revc-review-search">Search review<input type="search" data-revc-review-search value="${escapeHtml(state.review.filters.search)}" placeholder="Object, branch, type, state, note"></label>${stateFilters(state)}${categoryFilters(state)}${certaintyFilters(state)}${reasonFilters(state)}${decisionFilterMarkup(state)}${hiddenSelected ? '<p class="revc-filter-note">The selected row is hidden by the active filters; its inspector remains authoritative.</p>' : ''}<div class="revc-queue-list">${projection.visible.length ? projection.visible.map((entry) => queueRow(entry, entry.row.differenceId === selected)).join('') : '<p class="revc-empty">No review rows match the active filters.</p>'}</div></section>`;
}
function propertyRows(row) {
  if (!row.changedProperties.length) return '<p class="revc-empty">No supported scalar property changes.</p>';
  return `<table class="revc-property-table"><thead><tr><th>Property</th><th>Rev A</th><th>Rev B</th></tr></thead><tbody>${row.changedProperties.map((item) => `<tr><th>${escapeHtml(item.propertyKey)}</th><td>${escapeHtml(item.revAValue)}</td><td>${escapeHtml(item.revBValue)}</td></tr>`).join('')}</tbody></table>`;
}
function sourcePaths(row) {
  const paths = [...row.changedProperties.flatMap((item) => [item.revAEvidencePath, item.revBEvidencePath]), ...(row.geometryDelta?.revAEvidencePaths ?? []), ...(row.geometryDelta?.revBEvidencePaths ?? [])].filter(Boolean);
  return paths.length ? `<ul>${[...new Set(paths)].map((path) => `<li><code>${escapeHtml(path)}</code></li>`).join('')}</ul>` : '<p class="revc-empty">Source evidence paths are unavailable.</p>';
}
function candidateMarkup(audit, row) {
  if (!row.candidateEvidenceId) return '<p class="revc-empty">Candidate evidence was not required.</p>';
  const evidence = audit.candidateEvidence.find((item) => item.candidateEvidenceId === row.candidateEvidenceId);
  if (!evidence) return '<p class="revc-empty">Candidate evidence is unavailable.</p>';
  return `<dl class="revc-evidence-facts">${sessionFact('Candidate count / cap', `${evidence.candidateCount} / ${evidence.candidateLimit}`)}${sessionFact('Decision basis', evidence.scoreGapOrDecisionBasis)}${sessionFact('Accepted candidate', evidence.acceptedCandidateId || 'None')}</dl><ol>${evidence.rankedEvidence.map((item) => `<li><code>${escapeHtml(item.targetRecordId)}</code> · score ${escapeHtml(item.score)} · ${escapeHtml(item.reasons.join(', ') || 'No passing evidence')}</li>`).join('')}</ol>`;
}
function eventHistory(session, item) {
  const events = reviewEventIndex(session); const selected = item.eventIds.map((id) => events.get(id)).filter(Boolean);
  return selected.length ? `<ol>${selected.map((event) => `<li><b>#${event.sequence} ${human(event.action)}</b><span>${human(event.previousState)} → ${human(event.nextState)}</span><code>${escapeHtml(event.occurredAt)}</code></li>`).join('')}</ol>` : '<p class="revc-empty">No review events for this item.</p>';
}
function stateActions(item, stale) {
  const disabled = stale ? 'disabled' : '';
  return `<div class="revc-review-actions"><button type="button" data-revc-review-state="REVIEWED" ${pressed(item.reviewState === 'REVIEWED')} ${disabled}>Mark reviewed</button><button type="button" data-revc-review-state="NEEDS_CLARIFICATION" ${pressed(item.reviewState === 'NEEDS_CLARIFICATION')} ${disabled}>Needs clarification</button><button type="button" data-revc-review-state="UNRESOLVED" ${pressed(item.reviewState === 'UNRESOLVED')} ${disabled}>Mark unresolved</button><button type="button" data-revc-review-state="UNREVIEWED" ${pressed(item.reviewState === 'UNREVIEWED')} ${disabled}>Reset to unreviewed</button></div>`;
}
export function reviewInspectorMarkup(state) {
  const audit = state.compare.audit; const session = state.review.session;
  if (!audit) return '<section class="revc-inspector"><h2>Selected change</h2><p class="revc-empty">Run visual comparison first.</p></section>';
  if (!reviewSessionMatchesAudit(session, audit)) return '<section class="revc-inspector"><h2>Selected change</h2><p class="revc-empty">The preserved review session belongs to another audit. Start a new session explicitly.</p></section>';
  const row = audit.differenceRows.find((entry) => entry.differenceId === state.compare.selectedDifferenceId);
  const item = reviewItemIndex(session).get(row?.differenceId); if (!row || !item) return '<section class="revc-inspector"><h2>Selected change</h2><p class="revc-empty">Select a prioritized review row.</p></section>';
  const projection = reviewPriorityProjection(state); const previous = previousPriorityDifferenceId(projection, row.differenceId); const next = nextPriorityDifferenceId(projection, row.differenceId); const stale = session.status === 'STALE';
  return `<section class="revc-inspector"><header><div><span>${human(row.differenceCategory)}</span><h2>${escapeHtml(titleText(row))}</h2></div><strong>${human(row.matchCertainty)}</strong></header><div class="revc-explanation"><b>Engineering explanation</b><p>${escapeHtml(primaryReason(row))}</p></div><dl class="revc-inspector-facts"><div><dt>Review state</dt><dd>${human(item.reviewState)}</dd></div><div><dt>Original certainty</dt><dd>${human(row.matchCertainty)}</dd></div><div><dt>Rev A identity</dt><dd>${escapeHtml(row.context?.revAIdentity || 'Not applicable')}</dd></div><div><dt>Rev B identity</dt><dd>${escapeHtml(row.context?.revBIdentity || 'Not applicable')}</dd></div><div><dt>Branch</dt><dd>${escapeHtml(row.context?.branchId || 'Unavailable')}</dd></div><div><dt>Component type</dt><dd>${escapeHtml(row.context?.componentType || 'Unavailable')}</dd></div></dl>${decisionInspectorMarkup(state, row)}<details class="revc-evidence-level" data-level="2"><summary>Level 2 · Engineering details and review action</summary><section><h3>Changed properties</h3>${propertyRows(row)}</section><section><h3>Geometry</h3><p>${escapeHtml(row.geometryDelta?.reason || 'Geometry evidence is unavailable.')}</p></section><section><h3>Change reasons</h3><p>${escapeHtml(row.changeReasons.join(', ') || 'Unavailable')}</p></section><section><h3>Review note</h3><textarea data-revc-review-note maxlength="${REVIEW_NOTE_MAX_LENGTH}" ${stale ? 'disabled' : ''}>${escapeHtml(item.note)}</textarea><small>${item.note.length} / ${REVIEW_NOTE_MAX_LENGTH}</small><button type="button" data-revc-save-review-note ${stale ? 'disabled' : ''}>Save note</button></section>${stateActions(item, stale)}</details><details class="revc-evidence-level revc-evidence" data-level="3"><summary>Level 3 · Source and audit evidence</summary><p>${escapeHtml(row.evidenceSummary?.primary || 'Comparison evidence is unavailable.')}</p><dl class="revc-evidence-facts">${sessionFact('Source record ID', row.sourceRecordId)}${sessionFact('Target record ID', row.targetRecordId)}${sessionFact('Source visual object', row.visualRefs?.sourceObjectId)}${sessionFact('Target visual object', row.visualRefs?.targetObjectId)}${sessionFact('Audit ID', audit.auditId)}${sessionFact('Basis ID', audit.basisId)}${sessionFact('Engine version', audit.engineVersion)}${sessionFact('Configuration', JSON.stringify(audit.configuration))}</dl><h3>Source evidence paths</h3>${sourcePaths(row)}<h3>Candidate evidence</h3>${candidateMarkup(audit, row)}<h3>Selected-item review history</h3>${eventHistory(session, item)}</details><div class="revc-review-navigation"><button type="button" data-revc-previous-priority ${previous ? '' : 'disabled'}>Previous</button><button type="button" class="revc-primary" data-revc-next-priority ${next ? '' : 'disabled'}>Next priority</button></div></section>`;
}
export function revisionReviewSideMarkup(state) {
  return `${reviewProgressMarkup(state.review.session)}${decisionProgressMarkup(state)}${revisionImpactReportMarkup(state)}${reviewSessionControlsMarkup(state, Boolean(state.compare.audit))}${decisionLedgerControlsMarkup(state, Boolean(state.compare.audit))}${reviewQueueMarkup(state)}${reviewInspectorMarkup(state)}`;
}
export const _test = Object.freeze({ escapeHtml, primaryReason, sourcePaths, titleText });
