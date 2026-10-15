/** Delegated event routing for the Revision Compare workspace. */

function trackedListener(cleanups, target, type, handler) {
  target.addEventListener(type, handler);
  cleanups.push(() => target.removeEventListener(type, handler));
}

function fileChange(actions, target) {
  const file = target.files?.[0];
  if (file) actions.load(target.dataset.revcFile, file);
}

function packageFileChange(actions, target) {
  const file = target.files?.[0];
  target.value = '';
  if (file) actions.importEvidencePackage(file);
}

function trustFileChange(actions, target) {
  const file = target.files?.[0];
  target.value = '';
  if (file) actions.importTrustReceipt(file);
}

function responsivenessReceiptFileChange(actions, target) {
  const file = target.files?.[0];
  target.value = '';
  if (file) actions.importResponsivenessReceipt(file);
}

function responsivenessSignatureFileChange(actions, target) {
  const file = target.files?.[0];
  target.value = '';
  if (file) actions.importResponsivenessReceipt(file, 'signature');
}

function comparisonButton(actions, button) {
  if (button.hasAttribute('data-revc-run-compare')) actions.runVisualComparison();
  if (button.hasAttribute('data-revc-cancel-comparison')) actions.cancelComparison();
  if (button.hasAttribute('data-revc-open-review')) actions.showReview();
  if (button.hasAttribute('data-revc-edit-scope')) actions.showSetup();
  if (button.dataset.revcCategory) actions.toggleCategory(button.dataset.revcCategory);
  if (button.dataset.revcPresentation) actions.setPresentation(button.dataset.revcPresentation);
  if (button.dataset.revcViewerBackend) actions.setViewerBackend(button.dataset.revcViewerBackend);
  if (button.hasAttribute('data-revc-rerun-responsiveness')) actions.rerunResponsiveness();
  if (button.hasAttribute('data-revc-download-responsiveness-receipt')) actions.downloadResponsivenessReceipt();
  if (button.hasAttribute('data-revc-fit-all')) actions.fitAll();
  if (button.hasAttribute('data-revc-fit-selected')) actions.fitSelected();
  if (button.dataset.revcDifferenceId) actions.selectDifference(button.dataset.revcDifferenceId);
}

function reviewButton(actions, button) {
  if (button.dataset.revcReviewState) actions.setReviewState(button.dataset.revcReviewState);
  if (button.hasAttribute('data-revc-save-review-note')) actions.saveReviewNote();
  if (button.hasAttribute('data-revc-next-priority')) actions.nextPriority();
  if (button.hasAttribute('data-revc-previous-priority')) actions.previousPriority();
  if (button.hasAttribute('data-revc-download-review')) actions.downloadReviewSession();
  if (button.hasAttribute('data-revc-start-new-review')) actions.startNewReviewSession();
}

function decisionButton(actions, button) {
  if (button.dataset.revcPreviewCandidateIndex !== undefined) actions.previewCandidate(button.dataset.revcPreviewCandidateIndex);
  if (button.hasAttribute('data-revc-previous-candidate')) actions.previousCandidate();
  if (button.hasAttribute('data-revc-next-candidate')) actions.nextCandidate();
  if (button.hasAttribute('data-revc-accept-candidate')) actions.acceptCandidate();
  if (button.hasAttribute('data-revc-confirm-no-match')) actions.confirmNoMatch();
  if (button.hasAttribute('data-revc-defer-decision')) actions.deferDecision();
  if (button.hasAttribute('data-revc-revoke-decision')) actions.revokeDecision();
  if (button.hasAttribute('data-revc-download-decision')) actions.downloadDecisionLedger();
  if (button.hasAttribute('data-revc-start-new-decision')) actions.startNewDecisionLedger();
}

function impactReportButton(actions, button) {
  if (button.dataset.revcDownloadImpactJson) actions.downloadImpactJson(button.dataset.revcDownloadImpactJson);
  if (button.dataset.revcDownloadImpactCsv) actions.downloadImpactCsv(button.dataset.revcDownloadImpactCsv);
}

export function routeRevisionCompareActionClick(actions, target) {
  const button = target.closest('button');
  if (!button) return;
  if (button.dataset.revcCancel) actions.cancel(button.dataset.revcCancel);
  if (button.hasAttribute('data-revc-swap-revisions')) actions.swapRevisions();
  if (button.hasAttribute('data-revc-apply-visual-metadata')) actions.applyVisualMetadata();
  if (button.hasAttribute('data-revc-clear-visual-metadata')) actions.clearVisualMetadata();
  if (button.hasAttribute('data-revc-clear-scope-filters')) actions.clearScopeFilters();
  if (button.hasAttribute('data-revc-clear-review-filters')) actions.clearReviewFilters();
  if (button.dataset.revcGroup) actions.setGroupIncluded(button.dataset.revcGroup, button.dataset.revcInclude === 'all');
  if (button.hasAttribute('data-revc-approve-basis')) actions.approveBasis();
  if (button.hasAttribute('data-revc-download-session')) actions.downloadSession();
  if (button.hasAttribute('data-revc-download-scope')) actions.downloadScope();
  if (button.hasAttribute('data-revc-download-evidence-package')) actions.downloadEvidencePackage();
  if (button.hasAttribute('data-revc-create-sign-off') || button.hasAttribute('data-revc-create-new-sign-off')) actions.createSignOff();
  if (button.hasAttribute('data-revc-download-sign-off')) actions.downloadSignOff();
  if (button.hasAttribute('data-revc-close')) actions.close();
  comparisonButton(actions, button);
  reviewButton(actions, button);
  decisionButton(actions, button);
  impactReportButton(actions, button);
  actions.transferClick(button);
}

function reviewInput(actions, target) {
  if (target.matches('[data-revc-review-search]')) actions.setReviewSearch(target.value);
  if (target.matches('[data-revc-review-state-filter]')) actions.toggleReviewFilter('reviewStates', target.dataset.revcReviewStateFilter);
  if (target.matches('[data-revc-certainty-filter]')) actions.toggleReviewFilter('certainties', target.dataset.revcCertaintyFilter);
  if (target.matches('[data-revc-review-import]')) {
    const file = target.files?.[0];
    if (file) actions.importReviewSession(file);
  }
}

function decisionInput(actions, target) {
  if (target.matches('[data-revc-decision-state-filter]')) actions.toggleDecisionFilter(target.dataset.revcDecisionStateFilter);
  if (target.matches('[data-revc-unresolved-ambiguity]')) actions.setUnresolvedAmbiguity(target.checked);
  if (target.matches('[data-revc-decision-import]')) {
    const file = target.files?.[0];
    if (file) actions.importDecisionLedger(file);
  }
}

export function routeRevisionCompareInputChange(actions, target) {
  if (target.matches('[data-revc-responsiveness-signature-import]')) responsivenessSignatureFileChange(actions, target);
  if (target.matches('[data-revc-responsiveness-receipt-import]')) responsivenessReceiptFileChange(actions, target);
  if (target.matches('[data-revc-trust-import]')) trustFileChange(actions, target);
  if (target.matches('[data-revc-evidence-package-import]')) packageFileChange(actions, target);
  if (target.matches('[data-revc-file]')) fileChange(actions, target);
  if (target.matches('[data-revc-search]')) actions.setSearch(target.dataset.revcSearch, target.value);
  if (target.matches('[data-revc-branch-id]')) actions.setBranchIncluded(target.dataset.revcBranchId, target.checked);
  if (target.matches('[data-revc-queue-search]')) actions.setQueueSearch(target.value);
  if (target.matches('[data-revc-changed-reason]')) actions.toggleChangedReason(target.dataset.revcChangedReason);
  if (target.matches('[data-revc-needs-decision]')) actions.setNeedsDecision(target.checked);
  reviewInput(actions, target);
  decisionInput(actions, target);
  actions.transferChange(target);
  actions.syncSignOffControls();
}

export function syncRevisionDecisionButtons(root) {
  const field = root.querySelector('[data-revc-decision-rationale]');
  if (!field) return;
  const hasRationale = Boolean(field.value.trim());
  const count = root.querySelector('[data-revc-rationale-count]');
  if (count) count.textContent = `Required · ${field.value.length} / ${field.maxLength}`;
  root.querySelectorAll('[data-action-allowed]').forEach((button) => {
    button.disabled = button.dataset.actionAllowed !== 'true' || !hasRationale;
  });
}

export function bindRevisionCompareWorkspaceEvents(root, actions, cleanups) {
  trackedListener(cleanups, root, 'click', (event) => routeRevisionCompareActionClick(actions, event.target));
  trackedListener(cleanups, root, 'change', (event) => routeRevisionCompareInputChange(actions, event.target));
  trackedListener(cleanups, root, 'input', (event) => {
    if (event.target.matches('[data-revc-queue-search]')) actions.setQueueSearch(event.target.value);
    if (event.target.matches('[data-revc-review-search]')) actions.setReviewSearch(event.target.value);
    if (event.target.matches('[data-revc-decision-rationale]')) syncRevisionDecisionButtons(root);
    actions.syncSignOffControls();
  });
}

export const _test = Object.freeze({ comparisonButton, decisionButton, impactReportButton, reviewButton, trackedListener });
