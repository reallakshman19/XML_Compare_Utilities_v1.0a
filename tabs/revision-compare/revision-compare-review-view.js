/** Fixed viewer + queue + authoritative inspector markup for RC-002 through RC-SVG-003. */
import { revisionReviewSideMarkup } from './revision-review-view.js';
import { revisionCompareViewerBackendLabel } from './revision-compare-viewer-backend.js';
import {
  revisionViewerSceneStatus,
  revisionViewerSceneStatusMarkup,
} from './revision-viewer-scene-status.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}
function rowSearchText(row) {
  return [row.context?.revBIdentity, row.context?.revAIdentity, row.context?.branchId, row.context?.componentType,
    row.differenceCategory, row.matchCertainty, row.evidenceSummary?.primary].join(' ').toLowerCase();
}
function rowMatchesReason(row, selectedReasons) {
  if (row.differenceCategory !== 'CHANGED' || !row.changeReasons.length) return true;
  return row.changeReasons.some((reason) => selectedReasons.has(reason));
}
export function visibleRevisionDifferenceRows(audit, queue) {
  const categories = new Set(queue.categories); const reasons = new Set(queue.changedReasons);
  const search = String(queue.search ?? '').trim().toLowerCase();
  return audit.differenceRows.filter((row) => {
    if (row.differenceCategory === 'UNCHANGED') return false;
    if (queue.needsDecisionOnly && row.matchCertainty !== 'AMBIGUOUS') return false;
    if (!queue.needsDecisionOnly && !categories.has(row.differenceCategory)) return false;
    if (!rowMatchesReason(row, reasons)) return false;
    return !search || rowSearchText(row).includes(search);
  });
}
function summaryCard(label, value, tone) { return `<div data-tone="${tone}"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`; }
function summaryMarkup(audit) {
  return `<section class="revc-review-summary"><h2>Change summary</h2><div>${summaryCard('Changed', audit.summary.changed, 'changed')}${summaryCard('Added', audit.summary.added, 'added')}${summaryCard('Removed', audit.summary.removed, 'removed')}${summaryCard('Needs decision', audit.summary.needsDecision, 'decision')}</div></section>`;
}
function pressed(value) { return value ? 'aria-pressed="true"' : 'aria-pressed="false"'; }
function failureMatches(compare, evidence) {
  return Boolean(evidence.failed && evidence.viewerBackend === compare.viewerBackend);
}
function displayedBackend(compare, evidence) {
  if (evidence.viewerBackend && evidence.viewerBackend !== compare.viewerBackend) return null;
  if (failureMatches(compare, evidence)) return null;
  return evidence.activeBackend ?? compare.viewerBackend;
}
function viewerToolbar(compare, evidence) {
  const active = displayedBackend(compare, evidence);
  return `<div class="revc-view-toolbar"><div><span class="revc-backend-selector" role="group" aria-label="Viewer backend"><button type="button" data-revc-viewer-backend="WEBGL" ${pressed(active === 'WEBGL')}>3D (WebGL)</button><button type="button" data-revc-viewer-backend="SVG" ${pressed(active === 'SVG')}>Engineering SVG</button></span><button type="button" data-revc-presentation="overlay" ${pressed(compare.presentationMode === 'overlay')}>Overlay</button><button type="button" data-revc-presentation="side-by-side" ${pressed(compare.presentationMode === 'side-by-side')}>Side-by-side</button></div><div><button type="button" data-revc-fit-all>Fit all</button><button type="button" data-revc-fit-selected>Fit selected</button><button type="button" data-revc-edit-scope>Change scope</button></div></div>`;
}
function recoveryMarkup(compare) {
  const backend = compare.viewerBackend === 'SVG'
    ? compare.viewerPolicy.recoveryBackendForSvgFailure
    : compare.viewerPolicy.recoveryBackendForWebglFailure;
  return `<button type="button" data-revc-viewer-backend="${backend}">Return to ${revisionCompareViewerBackendLabel(backend)}</button>`;
}
export function revisionCompareReviewMarkup(state, viewerEvidence = {}) {
  const audit = state.compare.audit;
  const svg = state.compare.viewerBackend === 'SVG';
  const label = revisionCompareViewerBackendLabel(state.compare.viewerBackend);
  const viewerLabel = svg
    ? `Revision comparison Engineering SVG ${state.compare.presentationMode === 'side-by-side' ? 'linked panes' : 'overlay'}`
    : 'Revision comparison 3D context';
  const failure = failureMatches(state.compare, viewerEvidence)
    ? `<div class="revc-viewer-failure"><b>${label} unavailable.</b><p>${escapeHtml(viewerEvidence.error)}</p><span>The change queue and inspector remain available. Recovery requires explicit user action.</span>${recoveryMarkup(state.compare)}</div>`
    : '';
  const sceneStatus = revisionViewerSceneStatus(audit, viewerEvidence);
  return `<main class="revc-review-workspace"><section class="revc-view-column"><header class="revc-review-context"><div><span>REV A ↔ REV B</span><h2>${escapeHtml(state.slots.baseline.fileName)} ↔ ${escapeHtml(state.slots.candidate.fileName)}</h2><p>${state.basis.scopeSummary.includedBranchCountA} Rev A branches · ${state.basis.scopeSummary.includedBranchCountB} Rev B branches · current basis</p></div></header>${viewerToolbar(state.compare, viewerEvidence)}${revisionViewerSceneStatusMarkup(sceneStatus)}${failure}<div class="revc-viewer-host" data-revc-viewer-host aria-label="${viewerLabel}"></div></section><aside class="revc-review-side">${summaryMarkup(audit)}${revisionReviewSideMarkup(state)}</aside></main>`;
}
export const _test = Object.freeze({ displayedBackend, failureMatches, rowSearchText });
