/** Revision Compare workspace lifecycle over trusted compare, review, decisions and transfer. */
import { createRevisionActions } from './revision-compare-actions.js';
import {
  bindRevisionCompareWorkspaceEvents,
  routeRevisionCompareActionClick as actionClick,
  routeRevisionCompareInputChange as inputChange,
  syncRevisionDecisionButtons as syncDecisionButtons,
} from './revision-compare-event-routing.js';
import { revisionCompareWorkspaceMarkup } from './revision-compare-view.js';
import { createRevisionCompareViewerAdapter } from './revision-compare-viewer-adapter.js';
import { revisionCompareViewerBackendLabel } from './revision-compare-viewer-backend.js';
import { createRevisionViewerSceneMonitor } from './revision-viewer-scene-monitor.js';
import { createComparisonLifecycleState } from './revision-compare-lifecycle.js';
import { REVISION_COMPARE_DEFAULT_VIEWER_POLICY, createRevisionCompareViewerPolicy } from './revision-compare-viewer-policy.js';
import { createRevisionCompareService } from './revision-compare-service.js';
import { downloadRevisionArtifact, downloadRevisionTextArtifact } from './revision-manifests.js';
import { createRevisionLoadService } from './revision-load-service.js';
import { revisionComparisonPreflight } from './revision-preflight.js';
import { createRevisionImpactReportDownloadActions } from './revision-impact-report-download.js';
import { createRevisionReviewFilterResetAction, renderRevisionReviewFilterResetControl } from './revision-review-filter-reset.js';
import { createRevisionScopeFilterResetAction } from './revision-scope-filter-reset.js';
import {
  createRevisionResponsivenessObservationReceipt,
  revisionResponsivenessObservationReceiptFileName,
  revisionResponsivenessObservationReceiptMatches,
} from './revision-responsiveness-observation-receipt.js';
import { createRevisionResponsivenessReceiptVerificationWorkspace } from './revision-responsiveness-receipt-verification-workspace.js';
import {
  REVISION_EVIDENCE_PACKAGE_IMPORT_STATUS, completeWorkspaceEvidencePackageImport,
  completeWorkspaceTrustReceiptImport, createRevisionWorkspaceState,
  failWorkspaceEvidencePackageImport, failWorkspaceSignOff, failWorkspaceTrustReceiptImport,
  setWorkspaceSearch, setWorkspaceSignOffReport, startWorkspaceEvidencePackageImport, startWorkspaceTrustReceiptImport,
} from './revision-workspace-state.js';
import { candidatePreview } from './revision-decision-projection.js';
import { decisionLedgerMatchesAudit } from './revision-decision-ledger.js';
import { createRevisionComparePropertyInspector } from './revision-compare-property-inspector.js';
import {
  createRevisionCompareEvidencePackage, revisionCompareEvidencePackageFileName,
  revisionCompareEvidencePackageReadiness,
} from './revision-evidence-package.js';
import { verifyRevisionCompareEvidencePackageJson } from './revision-evidence-package-import.js';
import {
  createRevisionCompareSignOffReport, renderRevisionCompareSignOffSection,
  revisionCompareSignOffAuthorityMatches, revisionCompareSignOffFileName,
  revisionCompareSignOffInput, syncRevisionCompareSignOffControls,
} from './revision-sign-off.js';
import {
  REVISION_COMPARE_TRUST_MAX_BYTES, REVISION_COMPARE_TRUST_STATUS,
  renderRevisionCompareTrustReceiptSection, verifyRevisionCompareTrustReceiptJson,
} from './revision-trust-receipt.js';
import { createRevisionCompareTransferWorkspaceBindings } from './revision-transfer-workspace-bindings.js';

const IMPORTED_RESTRICTED_SELECTORS = Object.freeze([
  '[data-revc-file]', '[data-revc-cancel]', '[data-revc-swap-revisions]', '[data-revc-edit-scope]', '[data-revc-approve-basis]',
  '[data-revc-apply-visual-metadata]', '[data-revc-clear-visual-metadata]', '[data-revc-clear-scope-filters]', '[data-revc-clear-review-filters]',
  '[data-revc-run-compare]', '[data-revc-cancel-comparison]', '[data-revc-download-session]', '[data-revc-download-scope]',
  '[data-revc-review-import]', '[data-revc-decision-import]', '[data-revc-start-new-review]', '[data-revc-start-new-decision]',
]);
function defaultNow() { return new Date().toISOString(); }
function defaultClock() { return globalThis.performance?.now?.() ?? 0; }
function sessionId(now) { return `revision-session-${String(now).replace(/[^0-9]/g, '')}`; }
function previewFor(state) {
  const audit = state.compare.audit; const ledger = state.decision.ledger; const preview = state.decision.preview;
  return audit && decisionLedgerMatchesAudit(ledger, audit) ? candidatePreview(audit, ledger, preview.differenceId, preview.candidateIndex) : null;
}
function preparePropertyHost(root, state) {
  if (!state.compare.reviewVisible || !state.compare.audit || !state.compare.selectedDifferenceId) return null;
  const section = root.querySelector('.revc-inspector [data-level="2"] > section'); const heading = section?.querySelector('h3');
  if (!section || heading?.textContent !== 'Changed properties') return null;
  while (heading.nextSibling) heading.nextSibling.remove();
  const host = root.ownerDocument.createElement('div'); host.setAttribute('data-revc-property-inspector-host', state.compare.selectedDifferenceId);
  section.appendChild(host); return host;
}
function appendTextElement(documentRef, parent, tag, text) { const element = documentRef.createElement(tag); element.textContent = text; parent.appendChild(element); return element; }
function prepareEvidencePackageControl(root, state, responsivenessAttachment = null) {
  const host = root.querySelector('.revc-review-side') ?? root.querySelector('.revc-body'); if (!host) return null;
  const readiness = revisionCompareEvidencePackageReadiness(state); const documentRef = root.ownerDocument;
  const section = documentRef.createElement('section'); section.className = 'revc-review-session'; section.setAttribute('data-revc-evidence-package', readiness.status.toLowerCase());
  const header = documentRef.createElement('header'); const title = documentRef.createElement('div');
  appendTextElement(documentRef, title, 'span', 'REVIEW EVIDENCE EXPORT'); appendTextElement(documentRef, title, 'h2', 'Authority chain export');
  const status = appendTextElement(documentRef, header, 'strong', readiness.status); status.setAttribute('data-status', readiness.status.toLowerCase());
  header.appendChild(title); header.appendChild(status);
  const readyMessage = responsivenessAttachment
    ? 'Current authorities are ready. The verified-current responsiveness receipt will be attached to a versioned evidence package.'
    : 'Current session, scope, audit, review and decision authorities are ready for deterministic export.';
  const message = appendTextElement(documentRef, section, 'p', readiness.status === 'READY' ? readyMessage : readiness.blockers[0]);
  message.setAttribute('data-revc-evidence-package-status', readiness.status);
  const controls = documentRef.createElement('div'); controls.className = 'revc-session-actions';
  const button = appendTextElement(documentRef, controls, 'button', 'Download evidence package'); button.type = 'button';
  button.setAttribute('data-revc-download-evidence-package', ''); button.disabled = readiness.status !== 'READY';
  section.prepend(header); section.appendChild(controls); host.appendChild(section); return section;
}
function enforceImportedModeRestrictions(root, state) {
  if (state.evidencePackageImport.status !== REVISION_EVIDENCE_PACKAGE_IMPORT_STATUS.VERIFIED) return;
  for (const selector of IMPORTED_RESTRICTED_SELECTORS) root.querySelectorAll(selector).forEach((element) => {
    if (element.matches('input[type="file"]')) element.closest('label')?.remove(); else element.remove();
  });
}
function initialWorkspaceState(session, createdAt, policy) { const state = createRevisionWorkspaceState(session, createdAt); return Object.freeze({ ...state, compare: createComparisonLifecycleState(policy) }); }
function syncBackendButtons(root, evidence) {
  root.querySelectorAll('[data-revc-viewer-backend]').forEach((button) => button.setAttribute('aria-pressed', 'false'));
  if (evidence.failed || !evidence.activeBackend) return;
  root.querySelectorAll(`[data-revc-viewer-backend="${evidence.activeBackend}"]`).forEach((button) => button.setAttribute('aria-pressed', 'true'));
}
function recoveryMarkup(compare) {
  const backend = compare.viewerBackend === 'SVG' ? compare.viewerPolicy.recoveryBackendForSvgFailure : compare.viewerPolicy.recoveryBackendForWebglFailure;
  return `<button type="button" data-revc-viewer-backend="${backend}">Return to ${revisionCompareViewerBackendLabel(backend)}</button>`;
}
function reportFailure(root, options, error) {
  const message = error?.message || String(error); const live = root.querySelector('[data-revc-live]');
  if (live) live.textContent = message; options.showToast?.(message, 'error');
}
function responsivenessReceiptInput(currentState, sceneEvidence) {
  return {
    session: currentState.session,
    audit: currentState.compare.audit,
    revA: currentState.slots.baseline.document,
    revB: currentState.slots.candidate.document,
    sceneEvidence,
  };
}
export function mountRevisionCompareWorkspace(root, options = {}) {
  if (!root) throw new TypeError('Revision Compare workspace root is required.');
  const now = options.now ?? defaultNow; const clock = options.clock ?? defaultClock;
  const cryptoRef = options.cryptoRef ?? root.ownerDocument.defaultView?.crypto;
  const service = options.service ?? createRevisionLoadService(cryptoRef, options.loadServiceOptions);
  const compareService = options.compareService ?? createRevisionCompareService(options.compareServiceOptions);
  const downloadArtifact = options.downloadArtifact ?? downloadRevisionArtifact;
  const downloadText = options.downloadText ?? downloadRevisionTextArtifact; const cleanups = [];
  const policy = createRevisionCompareViewerPolicy(options.viewerPolicy ?? options.viewerAdapterOptions?.viewerPolicy ?? REVISION_COMPARE_DEFAULT_VIEWER_POLICY);
  let state = initialWorkspaceState(options.sessionId ?? sessionId(now()), now(), policy);
  let actions = null; let renderSequence = 0; let viewerAdapter = options.viewerAdapter ?? null; let destroyed = false; let signOffBusy = false;
  let trustImportGeneration = 0; let transferBindings = null; let receiptVerificationBindings = null;
  if (!viewerAdapter) viewerAdapter = createRevisionCompareViewerAdapter({
    ...options.viewerAdapterOptions, viewerPolicy: policy,
    onPick: (differenceId) => { if (differenceId) actions?.selectDifference(differenceId); },
    onError: (error) => options.showToast?.(`${revisionCompareViewerBackendLabel(viewerAdapter?.evidence().viewerBackend)} unavailable: ${error.message}`, 'warning'),
  });
  const sceneMonitor = options.sceneMonitor ?? createRevisionViewerSceneMonitor(options.sceneMonitorOptions);
  const propertyInspector = options.propertyInspector ?? createRevisionComparePropertyInspector(options.propertyInspectorOptions);
  function preflight() { return revisionComparisonPreflight(state.slots.baseline, state.slots.candidate, state.proposal, state.visualMetadataDeclaration); }
  async function syncViewer(sequence) {
    if (destroyed || sequence !== renderSequence) return;
    if (!state.compare.reviewVisible || !state.compare.audit) {
      sceneMonitor.stop();
      if (!state.compare.audit) viewerAdapter.clear();
      return;
    }
    const host = root.querySelector('[data-revc-viewer-host]');
    if (!host) { sceneMonitor.stop(); return; }
    viewerAdapter.setBackend?.(state.compare.viewerBackend);
    const mounted = await viewerAdapter.render(host, state.compare.audit); if (destroyed || sequence !== renderSequence) return;
    viewerAdapter.setPresentationMode(state.compare.presentationMode); viewerAdapter.selectDifference(state.compare.selectedDifferenceId);
    const preview = previewFor(state);
    if (preview?.candidate && preview.differenceId === state.compare.selectedDifferenceId) viewerAdapter.previewPair(preview.differenceId, preview.targetDifferenceId); else viewerAdapter.clearPreview();
    const evidence = viewerAdapter.evidence(); syncBackendButtons(root, evidence); const renderedFailure = root.querySelector('.revc-viewer-failure');
    if (mounted) renderedFailure?.remove();
    else if (!renderedFailure) host.innerHTML = `<div class="revc-viewer-fallback"><b>${revisionCompareViewerBackendLabel(state.compare.viewerBackend)} unavailable.</b><span>Use the queue and inspector to continue review. Recovery requires explicit user action.</span>${recoveryMarkup(state.compare)}</div>`;
    sceneMonitor.start(root, state.compare.audit, viewerAdapter);
  }
  async function syncPropertyInspector(sequence, host) {
    if (destroyed || sequence !== renderSequence) return;
    if (!host || !state.compare.audit || !state.compare.selectedDifferenceId) { propertyInspector.clear(); return; }
    await propertyInspector.render(host, state.compare.audit, state.compare.selectedDifferenceId);
  }
  function rerunResponsiveness() {
    try {
      if (!state.compare.reviewVisible || !state.compare.audit) throw new Error('Open the current visual review before rerunning responsiveness.');
      if (state.compare.viewerBackend !== 'WEBGL') throw new Error('Select 3D (WebGL) before rerunning responsiveness.');
      if (typeof viewerAdapter.resetResponsivenessEvidence !== 'function') throw new Error('The active viewer adapter does not support responsiveness reruns.');
      if (typeof sceneMonitor.resetResponsiveness !== 'function') throw new Error('The active scene monitor does not support responsiveness reruns.');
      viewerAdapter.resetResponsivenessEvidence();
      sceneMonitor.resetResponsiveness();
      render();
      options.showToast?.('WebGL responsiveness measurement restarted.', 'success');
      return true;
    } catch (error) {
      reportFailure(root, options, error);
      return false;
    }
  }
  async function downloadResponsivenessReceipt() {
    const captured = state;
    const input = responsivenessReceiptInput(captured, sceneMonitor.evidence());
    try {
      const receipt = await createRevisionResponsivenessObservationReceipt(input, cryptoRef);
      if (destroyed) return;
      const current = responsivenessReceiptInput(state, sceneMonitor.evidence());
      if (!revisionResponsivenessObservationReceiptMatches(receipt, current)) {
        throw new Error('Responsiveness authority changed while the receipt was being created. Download the current run again.');
      }
      downloadArtifact(root, revisionResponsivenessObservationReceiptFileName(receipt), receipt);
      options.showToast?.('Responsiveness observation receipt downloaded.', 'success');
    } catch (error) { if (!destroyed) reportFailure(root, options, error); }
  }
  async function downloadEvidencePackage() {
    const captured = state; const attachment = receiptVerificationBindings?.attachment();
    try {
      const currentPreflight = revisionComparisonPreflight(captured.slots.baseline, captured.slots.candidate, captured.proposal, captured.visualMetadataDeclaration);
      const artifact = await createRevisionCompareEvidencePackage(captured, currentPreflight, cryptoRef, attachment);
      if (destroyed) return;
      if (attachment && !receiptVerificationBindings.matchesAttachment(attachment)) {
        throw new Error('Responsiveness receipt authority changed while the evidence package was being created. Export the current evidence again.');
      }
      downloadArtifact(root, revisionCompareEvidencePackageFileName(captured.session.sessionId), artifact);
      options.showToast?.(attachment ? 'Evidence package downloaded with verified responsiveness receipt.' : 'Evidence package downloaded.', 'success');
    } catch (error) { reportFailure(root, options, error); }
  }
  async function createSignOff() {
    if (signOffBusy) return; const captured = state; const input = revisionCompareSignOffInput(root); signOffBusy = true; actions.syncSignOffControls();
    try {
      if (!input.confirmed) throw new Error('Confirm the fixed completion declaration before creating the report.');
      const currentPreflight = revisionComparisonPreflight(captured.slots.baseline, captured.slots.candidate, captured.proposal, captured.visualMetadataDeclaration);
      const report = await createRevisionCompareSignOffReport(captured, currentPreflight, input, now(), cryptoRef);
      if (destroyed) return;
      if (!revisionCompareSignOffAuthorityMatches(captured, state)) throw new Error('Review evidence changed while the completion report was being created. Create the declaration again.');
      state = setWorkspaceSignOffReport(state, report); render(); options.showToast?.('Completion declaration created.', 'success');
    } catch (error) { if (!destroyed) { state = failWorkspaceSignOff(state, error); render(); reportFailure(root, options, error); } }
    finally { signOffBusy = false; if (!destroyed) actions.syncSignOffControls(); }
  }
  function downloadSignOff() {
    try {
      if (state.signOff.status !== 'CREATED' || !state.signOff.report) throw new Error('The current completion report is unavailable.');
      downloadArtifact(root, revisionCompareSignOffFileName(state.session.sessionId, state.signOff.report.reportId), state.signOff.report);
      options.showToast?.('Completion report downloaded.', 'success');
    } catch (error) { reportFailure(root, options, error); }
  }
  async function importEvidencePackage(file) {
    const generation = state.evidencePackageImport.requestGeneration + 1; state = startWorkspaceEvidencePackageImport(state, generation, file.name); render();
    if (state.evidencePackageImport.status !== REVISION_EVIDENCE_PACKAGE_IMPORT_STATUS.IMPORTING) { reportFailure(root, options, state.evidencePackageImport.error); return; }
    try {
      const text = await file.text(); const verified = await verifyRevisionCompareEvidencePackageJson(text, file.name, now(), cryptoRef); if (destroyed) return;
      const current = state; const next = completeWorkspaceEvidencePackageImport(current, generation, verified);
      if (next === current) return; state = next; render(); options.showToast?.('Evidence package imported.', 'success');
    } catch (error) {
      if (destroyed) return; const current = state; const next = failWorkspaceEvidencePackageImport(current, generation, error);
      if (next === current) return; state = next; render(); reportFailure(root, options, error);
    }
  }
  async function importTrustReceipt(file) {
    const generation = ++trustImportGeneration; const report = state.signOff?.report;
    state = startWorkspaceTrustReceiptImport(state, generation, file.name); render();
    if (state.trustReceipt.status !== REVISION_COMPARE_TRUST_STATUS.IMPORTING) { reportFailure(root, options, state.trustReceipt.error); return; }
    try {
      if (file.size > REVISION_COMPARE_TRUST_MAX_BYTES) throw new RangeError('External signature receipt is limited to 256 KiB.');
      const receipt = await verifyRevisionCompareTrustReceiptJson(await file.text(), report, cryptoRef); if (destroyed) return;
      const current = state; const next = completeWorkspaceTrustReceiptImport(current, generation, receipt);
      if (next === current) return; state = next; render(); options.showToast?.('External signature receipt verified.', 'success');
    } catch (error) {
      if (destroyed) return; const current = state; const next = failWorkspaceTrustReceiptImport(current, generation, error);
      if (next === current) return; state = next; render(); reportFailure(root, options, error);
    }
  }
  function render(next = state) {
    if (destroyed) return; state = next; renderSequence += 1; const sequence = renderSequence;
    sceneMonitor.stop();
    root.innerHTML = revisionCompareWorkspaceMarkup(state, preflight(), viewerAdapter.evidence());
    const propertyHost = root && preparePropertyHost(root, state);
    prepareEvidencePackageControl(root, state, receiptVerificationBindings?.attachment()); receiptVerificationBindings?.render(); transferBindings?.render(state);
    renderRevisionReviewFilterResetControl(root, state); renderRevisionCompareSignOffSection(root, state); renderRevisionCompareTrustReceiptSection(root, state);
    enforceImportedModeRestrictions(root, state); syncDecisionButtons(root); syncRevisionCompareSignOffControls(root, state, signOffBusy);
    Promise.resolve().then(() => syncViewer(sequence)); Promise.resolve().then(() => syncPropertyInspector(sequence, propertyHost));
  }
  const baseActions = createRevisionActions({ root, options, service, compareService, viewerAdapter, cryptoRef, clock, readState: () => state, writeState: (next) => { state = next; }, render, now, downloadArtifact });
  const clearScopeFilters = createRevisionScopeFilterResetAction({ readState: () => state, writeState: (next) => { state = next; }, render, setSearch: setWorkspaceSearch, showToast: options.showToast });
  const clearReviewFilters = createRevisionReviewFilterResetAction({ readState: () => state, writeState: (next) => { state = next; }, render, showToast: options.showToast });
  const impactActions = createRevisionImpactReportDownloadActions({
    root, readState: () => state, cryptoRef, downloadArtifact, downloadText,
    showToast: options.showToast, reportFailure: (error) => reportFailure(root, options, error),
  });
  receiptVerificationBindings = createRevisionResponsivenessReceiptVerificationWorkspace({
    root, cryptoRef, readCurrentInput: () => responsivenessReceiptInput(state, sceneMonitor.evidence()), renderWorkspace: render,
    showToast: options.showToast, reportFailure: (error) => reportFailure(root, options, error),
  });
  transferBindings = createRevisionCompareTransferWorkspaceBindings({ root, readState: () => state, writeState: (next) => { state = next; }, render, now, cryptoRef, showToast: options.showToast, reportFailure: (error) => reportFailure(root, options, error) });
  actions = Object.freeze({
    ...baseActions, ...impactActions, clearReviewFilters, clearScopeFilters, downloadEvidencePackage, downloadResponsivenessReceipt,
    importEvidencePackage, importTrustReceipt, importResponsivenessReceipt: receiptVerificationBindings.importFile, createSignOff, downloadSignOff, rerunResponsiveness,
    transferClick: transferBindings.handleClick, transferChange: transferBindings.handleChange,
    syncSignOffControls: () => syncRevisionCompareSignOffControls(root, state, signOffBusy),
  });
  bindRevisionCompareWorkspaceEvents(root, actions, cleanups); render();
  return Object.freeze({
    evidence: () => Object.freeze({
      state, preflight: preflight(), viewer: viewerAdapter.evidence(), scene: sceneMonitor.evidence(),
      property: propertyInspector.evidence(), transfer: transferBindings.model(), responsivenessReceiptVerification: receiptVerificationBindings.model(), compareRunId: compareService.activeRunId(),
    }),
    destroy: () => {
      destroyed = true; renderSequence += 1; cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
      sceneMonitor.destroy(); receiptVerificationBindings.destroy(); transferBindings.destroy(); compareService.dispose(); propertyInspector.dispose();
      viewerAdapter.dispose(); service.dispose(); root.innerHTML = '';
    },
  });
}
export const _test = Object.freeze({ actionClick, enforceImportedModeRestrictions, initialWorkspaceState, inputChange, prepareEvidencePackageControl, preparePropertyHost, responsivenessReceiptInput, sessionId, syncBackendButtons, syncDecisionButtons });
