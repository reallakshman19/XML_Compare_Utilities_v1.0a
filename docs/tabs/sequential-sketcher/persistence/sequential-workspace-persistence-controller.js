import {
  restoreSequentialWorkspacePackageWithReceipts,
  serializeSequentialWorkspacePackageWithReceipts,
} from './sequential-workspace-package-receipts.js';
import {
  buildSequentialWorkspaceImportPreview,
  formatSequentialWorkspaceImportPreview,
  sequentialWorkspaceCurrentStateFingerprint,
  sequentialWorkspaceRestorationStateFingerprint,
} from './sequential-workspace-import-preview.js';
import {
  createSequentialWorkspaceApplicationReceipt,
  validateSequentialWorkspaceApplicationApproval,
} from './sequential-workspace-application-receipt.js';

function required(root, selector) {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Sequential persistence element missing: ${selector}`);
  return element;
}
function setSummary(element, message, state = 'info') {
  element.textContent = message;
  element.dataset.state = state;
}
function downloadText(documentRef, filename, content) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = documentRef.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  documentRef.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
function timestamp() { return new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/u, 'Z'); }
function createdAt() { return new Date().toISOString(); }
function postCommit(action) { try { action(); } catch {} }
function editSummary(value) {
  const summary = value?.summary || value?.draftEditExtension?.summary || null;
  if (!summary) return 'legacy package with no durable Draft Edit 3D state';
  return `${summary.supportAdjustmentCount} support adjustments across ${summary.supportBranchCount} branches and ${summary.geometryEditCount} geometry edits across ${summary.geometryBranchCount} branches`;
}
function hasDurableEditAuthority(state) {
  return Number(state?.supportBranchCount || 0) > 0
    || Number(state?.geometryBranchCount || 0) > 0;
}

export function mountSequentialWorkspacePersistenceController(root, workspace, context = {}) {
  const exportButton = required(root, '[data-ssk-workspace-export]');
  const importInput = required(root, '[data-ssk-workspace-import]');
  const applyButton = required(root, '[data-ssk-workspace-apply]');
  const cancelButton = required(root, '[data-ssk-workspace-cancel]');
  const receiptButton = required(root, '[data-ssk-workspace-receipt-export]');
  const reasonInput = required(root, '[data-ssk-workspace-apply-reason]');
  const evidenceInput = required(root, '[data-ssk-workspace-apply-evidence]');
  const summary = required(root, '[data-ssk-workspace-package-summary]');
  const editRuntime = context.draftEditPackageRuntime || null;
  let pendingRestoration = null;
  let pendingPreview = null;
  let pendingEditFingerprint = null;
  let lastReceipt = null;

  function currentEditExtension() {
    if (!editRuntime) return null;
    const model = workspace?.getModel?.() || {};
    const state = editRuntime.getState();
    if (!hasDurableEditAuthority(state)) return null;
    if (!model.journalState) throw new RangeError(
      'Durable Draft Edit 3D state requires accepted-command journal authority.');
    return editRuntime.createExtension();
  }
  function currentModelWithEdit() {
    const model = workspace?.getModel?.() || {};
    const draftEditExtension = currentEditExtension();
    return draftEditExtension ? { ...model, draftEditExtension } : model;
  }
  function currentEditFingerprint() {
    return currentEditExtension()?.extensionFingerprint || null;
  }
  function setPending(restoration, preview, editFingerprint = null) {
    pendingRestoration = restoration;
    pendingPreview = preview;
    pendingEditFingerprint = editFingerprint;
    applyButton.disabled = !pendingRestoration;
    cancelButton.disabled = !pendingRestoration;
  }
  function clearPending() { setPending(null, null, null); }
  function clearApproval() { reasonInput.value = ''; evidenceInput.value = ''; }
  function applicationReceipts() { return workspace?.getModel?.()?.workspaceApplicationReceipts || []; }

  function exportPackage() {
    const model = workspace?.getModel?.();
    workspace?.saveActiveBranch?.();
    if (!Array.isArray(model?.records) || !model?.evidence) {
      setSummary(summary, 'Load or restore source evidence before exporting a session package.', 'error');
      return null;
    }
    const draftEditExtension = currentEditExtension();
    const json = serializeSequentialWorkspacePackageWithReceipts({
      records: model.records,
      evidence: model.evidence,
      branchRegistry: model.branchRegistry,
      activeBranchId: model.session?.rootBranchId || null,
      reviewQueue: workspace?.getReviewQueue?.() || null,
      journalState: model.journalState,
      createdAt: createdAt(),
      applicationReceipts: applicationReceipts(),
      draftEditExtension,
    });
    const packageValue = JSON.parse(json);
    downloadText(root.ownerDocument, `sequential-workspace-${timestamp()}.json`, json);
    const saved = model.branchRegistry.savedCount();
    setSummary(summary, `Exported ${packageValue.schema} revision ${packageValue.revision}: ${saved} saved branch workspaces, journal authority ${model.journalState ? 'present' : 'absent'}, ${editSummary(packageValue)}, and ${applicationReceipts().length} application receipts.`, 'ok');
    const suffix = draftEditExtension ? ' with durable Draft Edit 3D state' : '';
    context.showToast?.(`${packageValue.schema} exported${suffix}.`, 'success');
    return json;
  }

  async function previewFile(file) {
    if (!file) return null;
    workspace?.saveActiveBranch?.();
    const currentModel = currentModelWithEdit();
    const editFingerprint = currentModel.draftEditExtension?.extensionFingerprint || null;
    const restoration = restoreSequentialWorkspacePackageWithReceipts(await file.text());
    const preview = buildSequentialWorkspaceImportPreview(restoration, currentModel);
    setPending(restoration, preview, editFingerprint);
    setSummary(summary, `${formatSequentialWorkspaceImportPreview(preview)} Package contains ${editSummary(restoration.draftEditExtension)} and ${restoration.applicationReceipts.length} application receipts.`, preview.hasDestructiveChanges ? 'warning' : 'ok');
    context.showToast?.(`${preview.packageSchema} verified; journal impact ${preview.journalImpact}.`, 'success');
    return Object.freeze({ restoration, preview });
  }

  function approval() {
    return validateSequentialWorkspaceApplicationApproval(pendingPreview, {
      reason: reasonInput.value,
      evidenceNote: evidenceInput.value,
    });
  }
  function preparedReceipt(restoration, preview, beforeFingerprint, approved) {
    const afterFingerprint = sequentialWorkspaceRestorationStateFingerprint(restoration);
    return createSequentialWorkspaceApplicationReceipt({
      preview,
      restoration,
      beforeFingerprint,
      afterFingerprint,
      reason: approved.reason,
      evidenceNote: approved.evidenceNote,
      sequence: restoration.applicationReceipts.length + 1,
    });
  }
  function settleApplied(restoration, preview, receipt) {
    lastReceipt = receipt;
    clearPending();
    postCommit(() => { receiptButton.disabled = false; });
    postCommit(clearApproval);
    postCommit(() => setSummary(summary, `Applied ${preview.packageSchema} revision ${preview.packageRevision}; journal impact ${preview.journalImpact}; restored ${editSummary(restoration.draftEditExtension)}; receipt ${receipt.receiptId}.`, 'ok'));
    const suffix = restoration.draftEditExtension ? ' with durable Draft Edit 3D state' : '';
    postCommit(() => context.showToast?.(`${preview.packageSchema} applied${suffix}.`, 'success'));
    return Object.freeze({ restoration, receipt });
  }
  function stalePreview() {
    const current = sequentialWorkspaceCurrentStateFingerprint(currentModelWithEdit());
    return current !== pendingPreview.currentStateFingerprint
      || currentEditFingerprint() !== pendingEditFingerprint;
  }
  function restoreDraftEdit(restoration) {
    if (!editRuntime) return null;
    return restoration.draftEditExtension
      ? editRuntime.restoreExtension(restoration.draftEditExtension)
      : editRuntime.clear();
  }
  function applyPending() {
    if (!pendingRestoration || !pendingPreview) {
      setSummary(summary, 'Select and verify a package before applying it.', 'info');
      return null;
    }
    workspace?.saveActiveBranch?.();
    const beforeFingerprint = sequentialWorkspaceCurrentStateFingerprint(currentModelWithEdit());
    if (stalePreview()) {
      clearPending();
      const message = 'WORKSPACE_IMPORT_PREVIEW_STALE: current source, branch, selection, journal, support, or geometry edit state changed after preview.';
      setSummary(summary, message, 'error');
      context.showToast?.(message, 'error');
      return Object.freeze({ outcome: 'WORKSPACE_IMPORT_PREVIEW_STALE' });
    }
    const approved = approval();
    const restoration = pendingRestoration;
    const preview = pendingPreview;
    const receipt = preparedReceipt(restoration, preview, beforeFingerprint, approved);
    const receipts = Object.freeze([...restoration.applicationReceipts, receipt]);
    workspace?.restorePackage?.(restoration, {
      applicationReceipts: receipts,
      expectedJournalImpact: preview.journalImpact,
    });
    restoreDraftEdit(restoration);
    return settleApplied(restoration, preview, receipt);
  }

  function cancelPending() {
    if (!pendingRestoration) {
      setSummary(summary, 'No verified package preview is pending.', 'info');
      return false;
    }
    clearPending();
    clearApproval();
    setSummary(summary, 'Verified package preview cancelled. No workspace, journal, support, or geometry authority was changed.', 'info');
    return true;
  }
  function exportLastReceipt() {
    if (!lastReceipt) return null;
    const json = JSON.stringify(lastReceipt, null, 2);
    downloadText(root.ownerDocument, `sequential-workspace-apply-receipt-${timestamp()}.json`, json);
    return json;
  }
  function onClick(event) {
    try {
      if (event.target?.closest?.('[data-ssk-workspace-export]')) exportPackage();
      else if (event.target?.closest?.('[data-ssk-workspace-apply]')) applyPending();
      else if (event.target?.closest?.('[data-ssk-workspace-cancel]')) cancelPending();
      else if (event.target?.closest?.('[data-ssk-workspace-receipt-export]')) exportLastReceipt();
      else return;
      event.preventDefault();
    } catch (error) {
      setSummary(summary, `Operation blocked: ${error.message || String(error)}`, 'error');
      context.showToast?.(error.message || String(error), 'error');
    }
  }
  async function onChange(event) {
    if (event.target !== importInput) return;
    clearPending();
    try { await previewFile(importInput.files?.[0]); } catch (error) {
      setSummary(summary, `Import preview blocked: ${error.message || String(error)}`, 'error');
      context.showToast?.(error.message || String(error), 'error');
    } finally { importInput.value = ''; }
  }

  exportButton.addEventListener('click', onClick);
  applyButton.addEventListener('click', onClick);
  cancelButton.addEventListener('click', onClick);
  receiptButton.addEventListener('click', onClick);
  importInput.addEventListener('change', onChange);
  clearPending();
  receiptButton.disabled = true;
  return Object.freeze({
    exportPackage, previewFile, applyPending, cancelPending, exportLastReceipt,
    getPendingPreview: () => pendingPreview,
    getLastReceipt: () => lastReceipt,
    destroy() {
      exportButton.removeEventListener('click', onClick);
      applyButton.removeEventListener('click', onClick);
      cancelButton.removeEventListener('click', onClick);
      receiptButton.removeEventListener('click', onClick);
      importInput.removeEventListener('change', onChange);
      clearPending();
    },
  });
}
