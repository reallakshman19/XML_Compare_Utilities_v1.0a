import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const preview = read('tabs/sequential-sketcher/persistence/sequential-workspace-import-preview.js');
const receipt = read('tabs/sequential-sketcher/persistence/sequential-workspace-application-receipt.js');
const wrapper = read('tabs/sequential-sketcher/persistence/sequential-workspace-package-receipts.js');
const controller = read('tabs/sequential-sketcher/persistence/sequential-workspace-persistence-controller.js');
const contract = read('tabs/sequential-sketcher/construction/sequential-construction-contract.js');
const workspace = read('tabs/sequential-sketcher/sequential-sketcher-workspace.js');
const tab = read('tabs/sequential-sketcher/sequential-sketcher-tab.js');

assert.match(preview, /SequentialWorkspaceImportPreview\.v1/);
assert.match(preview, /requiresExplicitApply:\s*true/);
assert.match(preview, /Nothing has been applied/);
assert.match(preview, /sequentialWorkspaceCurrentStateFingerprint/);

assert.match(receipt, /SequentialWorkspaceApplicationReceipt\.v1/);
assert.match(receipt, /WORKSPACE_APPLY_REASON_REQUIRED/);
assert.match(receipt, /WORKSPACE_APPLY_EVIDENCE_REQUIRED/);
assert.match(receipt, /beforeWorkspaceFingerprint/);
assert.match(receipt, /afterWorkspaceFingerprint/);
assert.match(receipt, /receiptFingerprint/);

assert.match(wrapper, /createSequentialWorkspacePackageWithReceipts/);
assert.match(wrapper, /restoreSequentialWorkspacePackageWithReceipts/);
assert.match(wrapper, /applicationReceipts/);
assert.match(wrapper, /sequentialWorkspacePackageFingerprint/);

const approval = controller.indexOf('validateSequentialWorkspaceApplicationApproval(pendingPreview');
const restore = controller.indexOf('workspace?.restorePackage?.(restoration)');
const receiptCreation = controller.indexOf('const receipt = createSequentialWorkspaceApplicationReceipt');
assert.ok(approval >= 0 && approval < restore, 'approval must precede restoration');
assert.ok(restore >= 0 && restore < receiptCreation, 'receipt must follow restoration');
assert.equal((controller.match(/restorePackage\?\.\(/gu) || []).length, 1);
assert.match(controller, /WORKSPACE_IMPORT_PREVIEW_STALE/);
assert.match(controller, /serializeSequentialWorkspacePackageWithReceipts/);
assert.match(controller, /restoreSequentialWorkspacePackageWithReceipts/);
assert.doesNotMatch(controller, /advanceConstruction|runConstructionUntilBlocked/);

for (const action of ['MANUAL_CONNECT', 'DEFER_DECISION', 'RESUME_DECISION', 'UNDO_LAST_TRANSACTION', 'REDO_LAST_TRANSACTION']) {
  assert.match(contract, new RegExp(`${action}: '${action}'`), `${action} must survive integration syncs`);
}
assert.match(workspace, /createSequentialBranchWorkspaceRegistry/);
assert.match(workspace, /mountSequentialReviewQueueController/);
assert.match(workspace, /function restorePackage\(restoration\)/);
assert.match(tab, /20260717-ssk-workspace-apply-receipts-1/);

console.log('sequential workspace reconciliation guard passed');
