/** Bounded bridge from the Revision Compare shell to transfer and handover engines. */
import { createRevisionCompareTransferController } from './revision-transfer-controller.js';
import { renderRevisionCompareTransferSection } from './revision-transfer-view.js';
import { createRevisionCompareTransferPlan } from './revision-transfer-plan.js';
import { createRevisionCompareTransferApplication } from './revision-transfer-result.js';
import { createRevisionCompareEvidencePackage } from './revision-evidence-package.js';
import { revisionComparisonPreflight } from './revision-preflight.js';
import { captureRevisionCompareTransferAuthority, revisionCompareTransferPlanAuthority } from './revision-transfer-contracts.js';
import { createRevisionCompareTransferCompletionController } from './revision-transfer-completion-controller.js';
import { renderRevisionCompareTransferCompletionSection } from './revision-transfer-completion-view.js';
import { completeWorkspaceTransferCompletion, failWorkspaceTransferCompletion } from './revision-transfer-completion-workspace-state.js';
import { createRevisionCompareTransferArchiveController } from './revision-transfer-archive-controller.js';
import { renderRevisionCompareTransferArchiveSection } from './revision-transfer-archive-view.js';
import { adoptRevisionCompareTransferArchiveWorkspace, completeWorkspaceTransferArchive, failWorkspaceTransferArchive } from './revision-transfer-archive-workspace-state.js';
import { createRevisionCompareHandoverInspectionController } from './revision-transfer-handover-inspection-controller.js';
import { renderRevisionCompareHandoverInspectionSection } from './revision-transfer-handover-inspection-view.js';
import { adoptRevisionCompareHandoverInspectionWorkspace, revisionCompareHandoverInspectionLocksAuthority } from './revision-transfer-handover-inspection-workspace-state.js';
import {
  completeWorkspaceTransferApply, completeWorkspaceTransferPlan, failWorkspaceTransferApply,
  failWorkspaceTransferPlan, setWorkspaceTransferReviewDraft, setWorkspaceTransferReviewPresentation,
  startWorkspaceTransferApply, startWorkspaceTransferPlan,
} from './revision-workspace-state.js';
import { reconcileWorkspaceTransferReviewState } from './revision-transfer-review-workspace-state.js';

export const REVISION_COMPARE_HANDOVER_AUTHORITY_SELECTORS = Object.freeze([
  '[data-revc-file]', '[data-revc-evidence-package-import]', '[data-revc-review-import]',
  '[data-revc-decision-import]', '[data-revc-approve-basis]', '[data-revc-run-compare]',
  '[data-revc-transfer-pair]', '[data-revc-transfer-field]', '[data-revc-transfer-select-visible]',
  '[data-revc-transfer-clear-visible]', '[data-revc-transfer-clear-all]',
  '[data-revc-create-transfer-plan]', '[data-revc-apply-transfer]',
  '[data-revc-create-transfer-completion]', '[data-revc-create-new-transfer-completion]',
  '[data-revc-create-transfer-archive]', '[data-revc-create-new-transfer-archive]',
  '[data-revc-create-sign-off]', '[data-revc-create-new-sign-off]', '[data-revc-trust-import]',
]);
const authorityControlState = new WeakMap();
export function revisionCompareHandoverTargetCreatesAuthority(target) {
  return Boolean(target?.closest?.(REVISION_COMPARE_HANDOVER_AUTHORITY_SELECTORS.join(',')));
}
function restoreAttribute(control, name, value) {
  if (value === null) control.removeAttribute(name); else control.setAttribute(name, value);
}
function syncAuthorityControls(root, locked) {
  root.querySelectorAll(REVISION_COMPARE_HANDOVER_AUTHORITY_SELECTORS.join(',')).forEach((control) => {
    if (locked) {
      if (!authorityControlState.has(control)) {
        authorityControlState.set(control, {
          disabled: 'disabled' in control ? control.disabled : null,
          ariaDisabled: control.getAttribute('aria-disabled'), title: control.getAttribute('title'),
        });
      }
      if ('disabled' in control) control.disabled = true;
      control.setAttribute('aria-disabled', 'true');
      control.setAttribute('title', 'Clear the transfer handover inspection before changing Revision Compare authority.');
      return;
    }
    const prior = authorityControlState.get(control); if (!prior) return;
    if (prior.disabled !== null) control.disabled = prior.disabled;
    restoreAttribute(control, 'aria-disabled', prior.ariaDisabled);
    restoreAttribute(control, 'title', prior.title); authorityControlState.delete(control);
  });
}
function transferController(options) {
  return createRevisionCompareTransferController({
    ...options,
    dependencies: {
      setReviewDraft: setWorkspaceTransferReviewDraft, reconcileReview: reconcileWorkspaceTransferReviewState,
      setPresentation: setWorkspaceTransferReviewPresentation,
      startPlan: startWorkspaceTransferPlan, createPlan: createRevisionCompareTransferPlan,
      completePlan: completeWorkspaceTransferPlan, failPlan: failWorkspaceTransferPlan,
      startApply: startWorkspaceTransferApply, createApplication: createRevisionCompareTransferApplication,
      completeApply: completeWorkspaceTransferApply, failApply: failWorkspaceTransferApply,
    },
  });
}
function completionController(options) {
  return createRevisionCompareTransferCompletionController({
    ...options,
    dependencies: {
      preflight: (state) => revisionComparisonPreflight(state.slots.baseline, state.slots.candidate, state.proposal),
      createEvidencePackage: createRevisionCompareEvidencePackage,
      captureTransferAuthority: captureRevisionCompareTransferAuthority,
      planTransferAuthority: revisionCompareTransferPlanAuthority,
      complete: completeWorkspaceTransferCompletion, fail: failWorkspaceTransferCompletion,
    },
  });
}
function archiveController(options, completion) {
  return createRevisionCompareTransferArchiveController({
    ...options, isCompletionBusy: completion.busy,
    dependencies: { complete: completeWorkspaceTransferArchive, fail: failWorkspaceTransferArchive },
  });
}
function importBusy(value) {
  return Boolean(value?.request || value?.importRequest || value?.importing || value?.status === 'IMPORTING');
}
function bindingActivity(options, completion, archive) {
  const state = options.readState();
  return {
    reviewImportBusy: importBusy(state?.review), decisionImportBusy: importBusy(state?.decision),
    completionBusy: completion.busy(), archiveBusy: archive.busy(),
  };
}
function bindingContext(options) {
  const common = {
    root: options.root, readState: options.readState, writeState: options.writeState,
    render: options.render, now: options.now, cryptoRef: options.cryptoRef,
    showToast: options.showToast, reportFailure: options.reportFailure,
  };
  const transfer = transferController(common); const completion = completionController(common);
  const archive = archiveController(common, completion);
  const activity = () => bindingActivity(options, completion, archive);
  const inspection = createRevisionCompareHandoverInspectionController({ ...common, readActivity: activity });
  return { options, transfer, completion, archive, inspection, activity };
}
function inspectionLocked(context) {
  return revisionCompareHandoverInspectionLocksAuthority(context.options.readState());
}
function blockAuthorityTarget(context, target) {
  if (!inspectionLocked(context) || !revisionCompareHandoverTargetCreatesAuthority(target)) return false;
  context.options.reportFailure(new Error('Clear the transfer handover inspection before changing Revision Compare authority.'));
  return true;
}
function bindEvents(context) {
  const input = (event) => {
    if (blockAuthorityTarget(context, event.target)) return;
    context.transfer.handleInput(event.target); context.completion.handleInput(event.target);
  };
  const guard = (event) => {
    if (!blockAuthorityTarget(context, event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation();
  };
  context.options.root.addEventListener('click', guard, true);
  context.options.root.addEventListener('change', guard, true);
  context.options.root.addEventListener('input', input);
  return { input, guard };
}
async function handleClick(context, button) {
  if (await context.inspection.handleClick(button)) return true;
  if (blockAuthorityTarget(context, button)) return true;
  context.transfer.handleClick(button); context.completion.handleClick(button);
  return context.archive.handleClick(button);
}
async function handleChange(context, target) {
  if (target?.matches?.('[data-revc-handover-file]')) return context.inspection.handleChange(target);
  if (blockAuthorityTarget(context, target)) return true;
  context.transfer.handleChange(target); context.completion.handleInput(target); return false;
}
function render(context, state) {
  let current = adoptRevisionCompareTransferArchiveWorkspace(state);
  current = adoptRevisionCompareHandoverInspectionWorkspace(current);
  if (current !== state) context.options.writeState(current);
  const reconciled = context.transfer.reconcileState(current);
  if (reconciled !== current) { current = reconciled; context.options.writeState(current); }
  const section = renderRevisionCompareTransferSection(context.options.root, current, context.transfer.model(current));
  renderRevisionCompareTransferCompletionSection(context.options.root, current);
  renderRevisionCompareTransferArchiveSection(context.options.root, current);
  renderRevisionCompareHandoverInspectionSection(context.options.root, current, { activity: context.activity() });
  context.completion.sync(); context.archive.sync(); syncAuthorityControls(context.options.root, inspectionLocked(context));
  return section;
}
function destroy(context, listeners) {
  const root = context.options.root;
  root.removeEventListener('click', listeners.guard, true);
  root.removeEventListener('change', listeners.guard, true);
  root.removeEventListener('input', listeners.input);
  context.inspection.destroy(); context.archive.destroy(); context.completion.destroy(); context.transfer.destroy();
}
export function createRevisionCompareTransferWorkspaceBindings(options) {
  const context = bindingContext(options); const listeners = bindEvents(context);
  return Object.freeze({
    handleClick: (button) => handleClick(context, button),
    handleChange: (target) => handleChange(context, target),
    handleInput: listeners.input, render: (state) => render(context, state),
    destroy: () => destroy(context, listeners),
    blockAuthorityTarget: (target) => blockAuthorityTarget(context, target),
    inspectionLocked: () => inspectionLocked(context), model: () => context.transfer.model(),
  });
}
