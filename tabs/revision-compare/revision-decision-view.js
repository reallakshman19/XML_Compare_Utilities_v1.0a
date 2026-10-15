/** RC-004 decision progress, filters, persisted-candidate inspector and ledger controls. */
import { activeTargetReservations, DECISION_RATIONALE_MAX_LENGTH, decisionEventIndex, decisionItemIndex, selectedPairEvidenceIndex, targetDifferenceIndex } from './revision-decision-contracts.js';
import { candidatePreview, resolvedRevisionReview } from './revision-decision-projection.js';
import { decisionLedgerMatchesAudit } from './revision-decision-ledger.js';

function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
function human(value) { return String(value ?? '').replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase()); }
function card(label, value, tone) { return `<div data-tone="${tone}"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`; }
function fact(label, value) { return `<div><dt>${escapeHtml(label)}</dt><dd><code>${escapeHtml(value ?? 'Unavailable')}</code></dd></div>`; }
export function decisionProgressMarkup(state) {
  const ledger = state.decision.ledger;
  if (!ledger) return '<section class="revc-decision-progress"><h2>Decision progress</h2><p class="revc-empty">No decision ledger yet.</p></section>';
  const summary = ledger.summary;
  return `<section class="revc-decision-progress"><header><h2>Decision progress</h2><strong data-status="${ledger.status.toLowerCase()}">${ledger.status}</strong></header><div>${card('Undecided', summary.undecided, 'undecided')}${card('Accepted candidate', summary.acceptedCandidate, 'accepted')}${card('Confirmed no match', summary.confirmedNoMatch, 'no-match')}${card('Deferred', summary.deferred, 'deferred')}${card('Remaining needs decision', summary.remainingNeedsDecision, 'remaining')}</div></section>`;
}
function ledgerDetails(ledger) {
  if (!ledger) return '';
  return `<details class="revc-decision-details"><summary>Decision ledger details</summary><dl>${fact('Audit ID', ledger.auditId)}${fact('Basis ID', ledger.basisId)}${fact('Ledger ID', ledger.ledgerId)}${fact('Status', ledger.status)}${fact('Revision', ledger.revision)}${fact('Active reservations', ledger.summary.activeTargetReservations)}${fact('Validation', ledger.validation?.status)}</dl></details>`;
}
export function decisionLedgerControlsMarkup(state, auditAvailable) {
  const ledger = state.decision.ledger; const audit = state.compare.audit;
  const mismatch = Boolean(auditAvailable && ledger && !decisionLedgerMatchesAudit(ledger, audit));
  return `<section class="revc-decision-ledger"><header><div><span>DECISION LEDGER</span><h2>${ledger ? escapeHtml(ledger.ledgerId) : 'Not started'}</h2></div>${ledger ? `<strong data-status="${ledger.status.toLowerCase()}">${ledger.status}</strong>` : ''}</header>${ledger?.status === 'STALE' ? '<p class="revc-stale-notice">This preserved decision ledger is read-only and remains downloadable.</p>' : ''}${mismatch ? '<p class="revc-session-mismatch">The current audit differs. Decision evidence was not remapped.</p>' : ''}${state.decision.importError ? `<p class="revc-decision-import-error">${escapeHtml(state.decision.importError)}</p>` : ''}<div class="revc-decision-controls">${ledger ? '<button type="button" data-revc-download-decision>Download decision ledger</button>' : ''}${auditAvailable ? '<label class="revc-import-button">Import decision ledger<input type="file" accept=".json,application/json" data-revc-decision-import></label>' : ''}${state.decision.replacementRequired && auditAvailable ? '<button type="button" class="revc-primary" data-revc-start-new-decision>Start new decision ledger</button>' : ''}</div>${ledgerDetails(ledger)}</section>`;
}
export function decisionFilterMarkup(state) {
  const active = new Set(state.decision.filters.decisionStates);
  const values = ['UNDECIDED', 'ACCEPTED_CANDIDATE', 'CONFIRMED_NO_MATCH', 'DEFERRED', 'REVOKED'];
  return `<div class="revc-filter-row revc-decision-filters" aria-label="Decision states">${values.map((value) => `<label><input type="checkbox" data-revc-decision-state-filter="${value}" ${active.has(value) ? 'checked' : ''}>${human(value)}</label>`).join('')}<label><input type="checkbox" data-revc-unresolved-ambiguity ${state.decision.filters.unresolvedOnly ? 'checked' : ''}>Unresolved ambiguous only</label></div>`;
}
export function decisionBadgeMarkup(entry) {
  if (entry.decisionItem) return `<strong data-decision-state="${entry.decisionItem.decisionState.toLowerCase()}">${human(entry.decisionItem.decisionState)}</strong>`;
  if (entry.consumedByDifferenceId) return '<strong data-decision-state="consumed">Consumed by manual correspondence</strong>';
  return '';
}
function candidateEvidence(audit, row) { return audit.candidateEvidence.find((item) => item.candidateEvidenceId === row.candidateEvidenceId) ?? null; }
function candidateList(state, row, item, preview, evidence, reservations) {
  if (!evidence?.rankedEvidence.length) return '<p class="revc-empty">Persisted candidate evidence is unavailable.</p>';
  return `<ol class="revc-candidate-list">${evidence.rankedEvidence.map((candidate, index) => {
    const owner = reservations.get(candidate.targetRecordId); const reserved = Boolean(owner && owner !== item.differenceId); const selected = preview?.candidateIndex === index;
    return `<li data-reserved="${reserved}"><button type="button" data-revc-preview-candidate-index="${index}" ${selected ? 'aria-current="true"' : ''}><b>#${index + 1} · ${escapeHtml(candidate.targetRecordId)}</b><span>score ${escapeHtml(candidate.score)} · ${escapeHtml(candidate.reasons.join(', ') || 'No passing reasons')}</span><small>${reserved ? `Reserved by ${escapeHtml(owner)}` : owner ? 'Reserved by this source' : 'Available'}</small></button></li>`;
  }).join('')}</ol>`;
}
function pairFacts(audit, row, preview) {
  const candidate = preview?.candidate; if (!candidate) return '<p class="revc-empty">No persisted candidate is available for preview.</p>';
  const target = targetDifferenceIndex(audit).get(candidate.targetRecordId);
  return `<dl class="revc-evidence-facts">${fact('Source record ID', row.sourceRecordId)}${fact('Candidate target record ID', candidate.targetRecordId)}${fact('Candidate target difference', target?.differenceId)}${fact('Source visual reference', row.visualRefs?.sourceObjectId)}${fact('Target visual reference', target?.visualRefs?.targetObjectId)}${fact('Score', candidate.score)}${fact('Geometry distance', candidate.geometryDistance)}</dl><p>${escapeHtml(candidate.reasons.join(', ') || 'Candidate reasons are unavailable.')}</p>`;
}
function persistedEvidenceFacts(evidence) {
  if (!evidence) return '<p class="revc-empty">Candidate evidence is unavailable.</p>';
  return `<dl class="revc-evidence-facts">${fact('Candidate count / cap', `${evidence.candidateCount} / ${evidence.candidateLimit}`)}${fact('Inferred threshold', evidence.thresholds?.inferredThreshold)}${fact('Winner gap threshold', evidence.thresholds?.winnerGap)}${fact('Decision basis', evidence.scoreGapOrDecisionBasis)}${fact('Reached cap', evidence.reachedCandidateLimit ? 'Yes' : 'No')}${fact('Rejection reasons', evidence.rejectionReasons.join(', ') || 'None')}</dl>`;
}
function selectedPairHistory(ledger, item) {
  const pairs = selectedPairEvidenceIndex(ledger); const events = decisionEventIndex(ledger);
  const history = item.eventIds.map((id) => events.get(id)).filter(Boolean);
  return history.length ? `<ol class="revc-decision-history">${history.map((event) => {
    const pair = event.selectedPairEvidenceId ? pairs.get(event.selectedPairEvidenceId) : null;
    return `<li><b>#${event.sequence} ${human(event.action)}</b><span>${human(event.previousDecisionState)} → ${human(event.nextDecisionState)}</span><code>${escapeHtml(event.nextTargetRecordId || 'No target')}</code><p>${escapeHtml(event.rationale)}</p>${pair ? `<small>Persisted pair rank ${pair.rank}, score ${pair.score}, evidence ${escapeHtml(pair.evidenceHash)}</small>` : ''}</li>`;
  }).join('')}</ol>` : '<p class="revc-empty">No decision events for this ambiguity.</p>';
}
function decisionButton(attribute, label, allowed, hasRationale, extra = '') {
  return `<button type="button" ${attribute} data-action-allowed="${allowed}" ${extra} ${!allowed || !hasRationale ? 'disabled' : ''}>${label}</button>`;
}
function actionButtons(state, item, preview, reservations) {
  const editable = state.decision.ledger.status === 'CURRENT' && !state.decision.replacementRequired;
  const owner = preview?.candidate ? reservations.get(preview.candidate.targetRecordId) : null;
  const conflict = Boolean(owner && owner !== item.differenceId); const hasRationale = Boolean(item.rationale.trim());
  const revocable = editable && !['UNDECIDED', 'REVOKED'].includes(item.decisionState);
  return `<div class="revc-decision-actions">${decisionButton('data-revc-accept-candidate', 'Accept candidate', editable && Boolean(preview?.candidate) && !conflict, hasRationale, `data-reservation-conflict="${conflict}"`)}${decisionButton('data-revc-confirm-no-match', 'Confirm no match', editable, hasRationale)}${decisionButton('data-revc-defer-decision', 'Defer', editable, hasRationale)}${decisionButton('data-revc-revoke-decision', 'Revoke decision', revocable, hasRationale)}</div>`;
}
export function decisionInspectorMarkup(state, row) {
  const audit = state.compare.audit; const ledger = state.decision.ledger;
  if (!audit || !decisionLedgerMatchesAudit(ledger, audit) || row?.matchCertainty !== 'AMBIGUOUS') return '';
  const item = decisionItemIndex(ledger).get(row.differenceId); if (!item) return '';
  const preview = candidatePreview(audit, ledger, row.differenceId, state.decision.preview.differenceId === row.differenceId ? state.decision.preview.candidateIndex : 0);
  const evidence = candidateEvidence(audit, row); const reservations = activeTargetReservations(ledger);
  const selectedOwner = preview?.candidate ? reservations.get(preview.candidate.targetRecordId) : null;
  return `<section class="revc-decision-inspector"><header><div><span>AMBIGUITY DECISION</span><h3>${human(item.decisionState)}</h3></div><strong>${selectedOwner ? `Target reserved by ${escapeHtml(selectedOwner)}` : 'Target available'}</strong></header>${persistedEvidenceFacts(evidence)}${candidateList(state, row, item, preview, evidence, reservations)}<div class="revc-candidate-navigation"><button type="button" data-revc-previous-candidate ${!preview?.candidate || preview.candidateIndex === 0 ? 'disabled' : ''}>Previous candidate</button><button type="button" data-revc-next-candidate ${!preview?.candidate || preview.candidateIndex >= preview.candidateCount - 1 ? 'disabled' : ''}>Next candidate</button></div><details open><summary>Selected-pair evidence</summary>${pairFacts(audit, row, preview)}</details><label class="revc-decision-rationale">Engineering rationale<textarea data-revc-decision-rationale maxlength="${DECISION_RATIONALE_MAX_LENGTH}">${escapeHtml(item.rationale)}</textarea><small data-revc-rationale-count>Required · ${item.rationale.length} / ${DECISION_RATIONALE_MAX_LENGTH}</small></label>${actionButtons(state, item, preview, reservations)}<details><summary>Decision event history</summary>${selectedPairHistory(ledger, item)}</details></section>`;
}
export function resolvedTargetState(state, row) {
  const ledger = state.decision.ledger; if (!state.compare.audit || !decisionLedgerMatchesAudit(ledger, state.compare.audit)) return null;
  const projection = resolvedRevisionReview(state.compare.audit, ledger); return projection.rows.find((entry) => entry.differenceId === row.differenceId) ?? null;
}
export const _test = Object.freeze({ escapeHtml, candidateEvidence, pairFacts });
