import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const packageSource = read('tabs/sequential-sketcher/persistence/sequential-workspace-package.js');
assert.match(packageSource, /SequentialWorkspacePackage\.v1/);
assert.match(packageSource, /SequentialWorkspaceRestoration\.v1/);
assert.match(packageSource, /sequentialSourceRecordsFingerprint/);
assert.match(packageSource, /sequentialWorkspacePackageFingerprint/);
assert.match(packageSource, /externalBoundaryPolicyFingerprint/);
assert.match(packageSource, /tolerancePolicyFingerprint/);
assert.match(packageSource, /sessionFingerprint/);
assert.match(packageSource, /WORKSPACE_HISTORY_BEFORE_FINGERPRINT_MISMATCH/);
assert.match(packageSource, /WORKSPACE_HISTORY_AFTER_FINGERPRINT_MISMATCH/);
assert.match(packageSource, /buildSequentialEvidenceModel/);
assert.match(packageSource, /indexSequentialEvidence/);
assert.match(packageSource, /buildSequentialDecisionRegister/);
assert.doesNotMatch(packageSource, /applyConstructionDecision|advanceConstruction|runConstructionUntilBlocked|DECISION_ACTIONS|acceptAll|bulkAccept/i,
  'workspace package code must validate and hydrate state without executing construction decisions');
assert.doesNotMatch(packageSource, /sj-pipe-support|buildPipeSupportProjectionBundle/);

const wrapper = read('tabs/sequential-sketcher/persistence/sequential-workspace-package-receipts.js');
assert.match(wrapper, /createSequentialWorkspacePackageWithReceipts/);
assert.match(wrapper, /restoreSequentialWorkspacePackageWithReceipts/);
assert.match(wrapper, /createSequentialWorkspacePackageV2/);
assert.match(wrapper, /restoreSequentialWorkspacePackageV2/);
assert.match(wrapper, /validateSequentialCommandJournalState/);
assert.match(wrapper, /WORKSPACE_COMMAND_JOURNAL_INVALID/);
assert.match(wrapper, /WORKSPACE_PACKAGE_SCHEMA_UNSUPPORTED/);
assert.match(wrapper, /applicationReceipts/);
assert.match(wrapper, /validateSequentialWorkspaceApplicationReceipt/);
assert.match(wrapper, /sequentialWorkspacePackageFingerprint/);
assert.doesNotMatch(wrapper, /createSequentialJournalAdoption|createSequentialCommandJournalState/);

const preview = read('tabs/sequential-sketcher/persistence/sequential-workspace-import-preview.js');
for (const value of ['ABSENT', 'INSTALL', 'UNCHANGED', 'REPLACE', 'REMOVE']) assert.match(preview, new RegExp(value));
assert.match(preview, /journalHeadFingerprint/);
assert.match(preview, /adoptionCheckpointId/);
assert.match(preview, /WORKSPACE_IMPORT_JOURNAL_STATE_INVALID/);
assert.match(preview, /sourceRelation/);
assert.match(preview, /packageTotals/);

const controller = read('tabs/sequential-sketcher/persistence/sequential-workspace-persistence-controller.js');
assert.match(controller, /mountSequentialWorkspacePersistenceController/);
assert.match(controller, /serializeSequentialWorkspacePackageWithReceipts/);
assert.match(controller, /restoreSequentialWorkspacePackageWithReceipts/);
assert.match(controller, /workspace\?\.saveActiveBranch/);
assert.match(controller, /workspace\?\.restorePackage/);
assert.match(controller, /journalState: model\.journalState/);
assert.match(controller, /expectedJournalImpact: preview\.journalImpact/);
assert.match(controller, /sequentialWorkspaceRestorationStateFingerprint/);
assert.match(controller, /WORKSPACE_IMPORT_PREVIEW_STALE/);
assert.match(controller, /function postCommit\(action\)/);
assert.match(controller, /function settleApplied\(restoration, preview, receipt\)/);
assert.match(controller, /postCommit\(clearApproval\)/);
assert.match(controller, /postCommit\(\(\) => context\.showToast/);
assert.ok(
  controller.indexOf('workspace?.restorePackage?.(restoration')
    < controller.indexOf('return settleApplied(restoration, preview, receipt)'),
  'post-commit controller state and UI synchronization must occur only after restoration succeeds',
);
assert.match(controller, /data-ssk-workspace-export/);
assert.match(controller, /data-ssk-workspace-import/);
assert.match(controller, /data-ssk-workspace-apply/);
assert.match(controller, /data-ssk-workspace-cancel/);
assert.doesNotMatch(controller, /applyConstructionDecision|advanceConstruction|runConstructionUntilBlocked|DECISION_ACTIONS/,
  'persistence controller must not mutate construction topology');

const registry = read('tabs/sequential-sketcher/sequential-branch-workspace-state.js');
assert.match(registry, /function replace\(ids = \[\], entries = \[\]\)/);
assert.match(registry, /const nextSnapshots = new Map\(\)/);
assert.match(registry, /snapshots\.clear\(\)/);
assert.match(registry, /replace,/);

const markup = read('tabs/sequential-sketcher/sequential-sketcher-markup.js');
for (const selector of [
  'data-ssk-workspace-export',
  'data-ssk-workspace-import',
  'data-ssk-workspace-apply',
  'data-ssk-workspace-cancel',
  'data-ssk-workspace-package-summary',
]) assert.match(markup, new RegExp(selector));
assert.match(markup, /creates a non-mutating preview/);
assert.match(markup, /Every successful apply creates a fingerprinted receipt/);

const workspace = read('tabs/sequential-sketcher/sequential-sketcher-workspace.js');
assert.match(workspace, /function restorePackage\(restoration, options = \{\}\)/);
assert.match(workspace, /SequentialWorkspaceRestoration\.v1/);
assert.match(workspace, /SequentialWorkspaceRestoration\.v2/);
assert.match(workspace, /function restoredDownstream/);
assert.match(workspace, /createConfirmedSequentialConstruction/);
assert.match(workspace, /buildConfirmedConstructionSupportProjection/);
assert.match(workspace, /const registry = preparedRegistry\(restoration\)/);
assert.ok(workspace.indexOf('const registry = preparedRegistry(restoration)') < workspace.indexOf('Object.assign(model, nextState)'));
assert.match(workspace, /sequentialCommandJournalHeadFingerprint/);
assert.match(workspace, /WORKSPACE_RESTORE_JOURNAL_IDENTITY_INVALID/);
assert.match(workspace, /WORKSPACE_RESTORE_JOURNAL_IMPACT_MISMATCH/);
assert.match(workspace, /WORKSPACE_RESTORE_JOURNAL_DOWNGRADE_UNAPPROVED/);
assert.match(workspace, /workspaceApplicationReceipts: receipts/);
assert.match(workspace, /reviewController\?\.reset\(\)/);
assert.match(workspace, /restoredDecisionRegister/);
assert.match(workspace, /refreshDownstream\(\)/);
assert.match(workspace, /saveActiveBranch,/);
assert.match(workspace, /restorePackage,/);
assert.doesNotMatch(workspace, /createSequentialJournalAdoption|createSequentialCommandJournalState/);
assert.ok(workspace.split('\n').length - 1 <= 486,
  'approved 446-line workspace baseline exception must remain within the +40-line cap');

for (const path of [
  'tabs/sequential-sketcher/persistence/sequential-workspace-package-receipts.js',
  'tabs/sequential-sketcher/persistence/sequential-workspace-import-preview.js',
  'tabs/sequential-sketcher/persistence/sequential-workspace-application-receipt.js',
  'tabs/sequential-sketcher/persistence/sequential-workspace-persistence-controller.js',
]) {
  const source = read(path);
  assert.ok(source.split('\n').length - 1 < 300, `${path} must remain below 300 lines`);
  assert.doesNotMatch(source, /export\s+default|module\.exports|exports\./);
}

const css = read('tabs/sequential-sketcher/sequential-sketcher.css');
assert.match(css, /\.ssk-workspace-package/);
assert.match(css, /\.ssk-workspace-package-actions/);
assert.match(css, /\.ssk-workspace-package-summary/);

const tab = read('tabs/sequential-sketcher/sequential-sketcher-tab.js');
assert.match(tab, /mountSequentialWorkspacePersistenceController/);
assert.match(tab, /persistenceController\?\.destroy\(\)/);
assert.match(tab, /20260717-ssk-workspace-apply-receipts-1/);

const utility = read('tabs/psnm-utility-tab.js');
assert.match(utility, /20260718-ssk-geometry-order-1/);

console.log('sequential workspace persistence UI tests passed');
