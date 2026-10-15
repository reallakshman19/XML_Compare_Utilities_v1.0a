import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSequentialEvidenceModel } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import { createSequentialBranchWorkspaceRegistry } from '../tabs/sequential-sketcher/sequential-branch-workspace-state.js';
import { createEmptyConstructionSession } from '../tabs/sequential-sketcher/construction/sequential-construction-contract.js';
import { mountSequentialSketcherWorkspace } from '../tabs/sequential-sketcher/sequential-sketcher-workspace.js';
import { mountSequentialWorkspacePersistenceController } from '../tabs/sequential-sketcher/persistence/sequential-workspace-persistence-controller.js';
import {
  createSequentialWorkspacePackageWithReceipts,
  restoreSequentialWorkspacePackageWithReceipts,
} from '../tabs/sequential-sketcher/persistence/sequential-workspace-package-receipts.js';
import { sequentialSourceRecordsFingerprint } from '../tabs/sequential-sketcher/persistence/sequential-workspace-package.js';
import { createSequentialJournalAdoption } from '../tabs/sequential-sketcher/scoped-edit/sequential-command-service.js';
import { appendSequentialCommandJournal } from '../tabs/sequential-sketcher/scoped-edit/sequential-command-journal.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const clone = (value) => JSON.parse(JSON.stringify(value));

const receipt = read('tabs/sequential-sketcher/persistence/sequential-workspace-application-receipt.js');
assert.match(receipt, /SequentialWorkspaceApplicationReceipt\.v1/);
assert.match(receipt, /validateSequentialWorkspaceApplicationApproval/);
assert.match(receipt, /WORKSPACE_APPLY_REASON_REQUIRED/);
assert.match(receipt, /WORKSPACE_APPLY_EVIDENCE_REQUIRED/);
assert.match(receipt, /packageSchema/);
assert.match(receipt, /packageRevision/);
assert.match(receipt, /expectedPackageRevision/);
assert.match(receipt, /journalImpact/);
assert.match(receipt, /WORKSPACE_APPLY_RECEIPT_PACKAGE_IDENTITY_INVALID/);
assert.match(receipt, /WORKSPACE_APPLY_RECEIPT_JOURNAL_IMPACT_INVALID/);
assert.match(receipt, /beforeWorkspaceFingerprint/);
assert.match(receipt, /afterWorkspaceFingerprint/);
assert.match(receipt, /receiptFingerprint/);
assert.match(receipt, /externalBoundaryPolicyFingerprint/);
assert.match(receipt, /tolerancePolicyFingerprint/);
assert.doesNotMatch(receipt, /applyConstructionDecision|advanceConstruction|runConstructionUntilBlocked|DECISION_ACTIONS/);

const wrapper = read('tabs/sequential-sketcher/persistence/sequential-workspace-package-receipts.js');
assert.match(wrapper, /createSequentialWorkspacePackageWithReceipts/);
assert.match(wrapper, /restoreSequentialWorkspacePackageWithReceipts/);
assert.match(wrapper, /applicationReceipts/);
assert.match(wrapper, /validateSequentialWorkspaceApplicationReceipt/);
assert.match(wrapper, /sequentialWorkspacePackageFingerprint/);
assert.match(wrapper, /createSequentialWorkspacePackageV2/);
assert.match(wrapper, /restoreSequentialWorkspacePackageV2/);
assert.doesNotMatch(wrapper, /createSequentialJournalAdoption|createSequentialCommandJournalState/);

const controllerSource = read('tabs/sequential-sketcher/persistence/sequential-workspace-persistence-controller.js');
assert.match(controllerSource, /serializeSequentialWorkspacePackageWithReceipts/);
assert.match(controllerSource, /restoreSequentialWorkspacePackageWithReceipts/);
assert.match(controllerSource, /createSequentialWorkspaceApplicationReceipt/);
assert.match(controllerSource, /validateSequentialWorkspaceApplicationApproval/);
assert.match(controllerSource, /journal impact \$\{preview\.journalImpact\}/);
assert.match(controllerSource, /data-ssk-workspace-apply-reason/);
assert.match(controllerSource, /data-ssk-workspace-apply-evidence/);
assert.match(controllerSource, /data-ssk-workspace-receipt-export/);
assert.match(controllerSource, /applicationReceipts: receipts/);
assert.match(controllerSource, /sequence: restoration\.applicationReceipts\.length \+ 1/);
assert.match(controllerSource, /getLastReceipt/);
assert.match(controllerSource, /exportLastReceipt/);
const receiptIndex = controllerSource.indexOf('const receipt = preparedReceipt');
const restoreIndex = controllerSource.indexOf('workspace?.restorePackage?.(restoration');
const lastReceiptIndex = controllerSource.indexOf('lastReceipt = receipt');
assert.ok(receiptIndex >= 0 && restoreIndex > receiptIndex && lastReceiptIndex > restoreIndex,
  'receipt and success state must update only after restoration succeeds');
assert.doesNotMatch(controllerSource, /workspace\.getModel\(\)\.workspaceApplicationReceipts\s*=/,
  'controller must not mutate receipt state outside the atomic workspace boundary');
assert.doesNotMatch(controllerSource, /applyConstructionDecision|advanceConstruction|runConstructionUntilBlocked|DECISION_ACTIONS/);

const workspaceSource = read('tabs/sequential-sketcher/sequential-sketcher-workspace.js');
const prepareIndex = workspaceSource.indexOf('const registry = preparedRegistry(restoration)');
const commitIndex = workspaceSource.indexOf('Object.assign(model, nextState)');
assert.ok(prepareIndex >= 0 && commitIndex > prepareIndex,
  'fresh registry validation must complete before live workspace mutation');
assert.match(workspaceSource, /workspaceApplicationReceipts: receipts/);
assert.match(workspaceSource, /const incomingJournal = restoration\.journalState \?\? null/);
assert.match(workspaceSource, /journalState: incomingJournal/);
assert.doesNotMatch(workspaceSource, /restoration\.journalState \|\| null/);
assert.match(workspaceSource, /sequentialCommandJournalHeadFingerprint/);
assert.match(workspaceSource, /currentId === incomingId \? 'UNCHANGED' : 'REPLACE'/);
assert.match(workspaceSource, /expected !== 'REMOVE'/);
assert.match(workspaceSource, /UI synchronization blocked/);

const markup = read('tabs/sequential-sketcher/sequential-sketcher-markup.js');
for (const selector of [
  'data-ssk-workspace-apply-reason',
  'data-ssk-workspace-apply-evidence',
  'data-ssk-workspace-receipt-export',
]) assert.match(markup, new RegExp(selector));
assert.match(markup, /Every successful apply creates a fingerprinted receipt/);
assert.match(markup, /destructive changes also require an evidence note/);

const tab = read('tabs/sequential-sketcher/sequential-sketcher-tab.js');
const utility = read('tabs/psnm-utility-tab.js');
assert.match(tab, /20260717-ssk-workspace-apply-receipts-1/);
assert.match(utility, /20260718-ssk-geometry-order-1/);

class FakeElement {
  constructor() {
    this._innerHTML = '';
    this._value = '';
    this.options = [];
    this.dataset = {};
    this.disabled = false;
    this.textContent = '';
    this.title = '';
    this.classList = { toggle() {} };
  }
  set innerHTML(value) {
    this._innerHTML = String(value);
    const count = (this._innerHTML.match(/<option\b/gu) || []).length;
    if (count) this.options = Array.from({ length: count }, () => ({ value: '', textContent: '', title: '' }));
  }
  get innerHTML() { return this._innerHTML; }
  set value(value) { this._value = value; }
  get value() { return this._value; }
  addEventListener() {}
  removeEventListener() {}
  appendChild() {}
  click() {}
  remove() {}
}
function fakeRoot() {
  const elements = new Map();
  return {
    ownerDocument: { createElement: () => new FakeElement(), body: { appendChild() {} } },
    set innerHTML(value) { this._innerHTML = value; },
    get innerHTML() { return this._innerHTML || ''; },
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, new FakeElement());
      return elements.get(selector);
    },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {},
  };
}
function packageFile(value) {
  return Object.freeze({ text: async () => JSON.stringify(value) });
}
function setApproval(root, reason, evidenceNote = '') {
  root.querySelector('[data-ssk-workspace-apply-reason]').value = reason;
  root.querySelector('[data-ssk-workspace-apply-evidence]').value = evidenceNote;
}
function journalCommand(sourceFingerprint, issuedAt) {
  return {
    commandType: 'TEST',
    payload: {},
    basis: { documentHash: sourceFingerprint, revision: 'dynamic-revision-1' },
    origin: { kind: 'USER', actorId: 'DYNAMIC_BOUNDARY_TEST', issuedAt },
    transactionId: null,
    inverse: null,
  };
}

const branchId = '/DYNAMIC/APPLY';
const records = [{ type: 'BRANCH', name: branchId, attributes: { NAME: branchId }, children: [] }];
const evidence = buildSequentialEvidenceModel(records);
const sourceFingerprint = sequentialSourceRecordsFingerprint(records);
const seedRegistry = createSequentialBranchWorkspaceRegistry();
seedRegistry.reset([branchId]);
seedRegistry.save(branchId, { session: createEmptyConstructionSession(branchId) });
const journalOne = createSequentialJournalAdoption({
  documentId: 'dynamic-document-1',
  sessionId: 'dynamic-session-1',
  sourceFingerprint,
  branchRegistry: seedRegistry,
  adoptedAt: '2026-07-27T10:00:00.000Z',
});
function packageValue(registry, journalState, applicationReceipts = [], createdAt = '2026-07-27T10:01:00.000Z') {
  return createSequentialWorkspacePackageWithReceipts({
    records,
    evidence,
    branchRegistry: registry,
    activeBranchId: branchId,
    journalState,
    applicationReceipts,
    createdAt,
  });
}

const workspaceRoot = fakeRoot();
const workspace = mountSequentialSketcherWorkspace(workspaceRoot);
const controllerRoot = fakeRoot();
const controller = mountSequentialWorkspacePersistenceController(controllerRoot, workspace);
const installPackage = packageValue(seedRegistry, journalOne);
const installPackageBefore = clone(installPackage);
const install = await controller.previewFile(packageFile(installPackage));
assert.equal(install.preview.journalImpact, 'INSTALL');
assert.match(controllerRoot.querySelector('[data-ssk-workspace-package-summary]').textContent,
  /SequentialWorkspacePackage\.v2/);
setApproval(controllerRoot, 'Install reviewed journal authority.');
const installed = controller.applyPending();
assert.equal(installed.receipt.packageSchema, 'SequentialWorkspacePackage.v2');
assert.equal(installed.receipt.packageRevision, 2);
assert.equal(installed.receipt.impact.journalImpact, 'INSTALL');
assert.deepEqual(workspace.getModel().journalState, journalOne);
assert.equal(workspace.getModel().workspaceApplicationReceipts.length, 1);
assert.strictEqual(controller.getLastReceipt(), installed.receipt);
assert.deepEqual(installPackage, installPackageBefore, 'controller import must not mutate caller package values');

workspace.saveActiveBranch();
const preservedReceipt = workspace.getModel().workspaceApplicationReceipts[0];
const unchangedPackage = packageValue(
  workspace.getModel().branchRegistry,
  workspace.getModel().journalState,
  workspace.getModel().workspaceApplicationReceipts,
  '2026-07-27T10:02:00.000Z',
);
const unchanged = await controller.previewFile(packageFile(unchangedPackage));
assert.equal(unchanged.preview.journalImpact, 'UNCHANGED');
assert.equal(unchanged.preview.hasDestructiveChanges, false);
setApproval(controllerRoot, 'Reapply matching reviewed authority.');
const unchangedResult = controller.applyPending();
assert.equal(unchangedResult.receipt.impact.journalImpact, 'UNCHANGED');
assert.equal(workspace.getModel().workspaceApplicationReceipts.length, 2);
assert.equal(workspace.getModel().workspaceApplicationReceipts[0].receiptId, preservedReceipt.receiptId,
  'imported receipt history must be preserved before the new receipt');

const stalePackage = packageValue(
  workspace.getModel().branchRegistry,
  workspace.getModel().journalState,
  workspace.getModel().workspaceApplicationReceipts,
  '2026-07-27T10:03:00.000Z',
);
await controller.previewFile(packageFile(stalePackage));
setApproval(controllerRoot, 'Apply only if the preview remains current.');
const receiptsBeforeStale = workspace.getModel().workspaceApplicationReceipts;
const lastReceiptBeforeStale = controller.getLastReceipt();
workspace.getModel().journalState = appendSequentialCommandJournal(
  workspace.getModel().journalState,
  journalCommand(sourceFingerprint, '2026-07-27T10:04:00.000Z'),
  '2026-07-27T10:04:00.000Z',
);
const staleOutcome = controller.applyPending();
assert.equal(staleOutcome.outcome, 'WORKSPACE_IMPORT_PREVIEW_STALE');
assert.strictEqual(workspace.getModel().workspaceApplicationReceipts, receiptsBeforeStale);
assert.strictEqual(controller.getLastReceipt(), lastReceiptBeforeStale);
assert.equal(controller.getPendingPreview(), null);

const staleRestoration = restoreSequentialWorkspacePackageWithReceipts(stalePackage);
const stateBeforeIdentityMismatch = {
  records: workspace.getModel().records,
  registry: workspace.getModel().branchRegistry,
  journalState: workspace.getModel().journalState,
  receipts: workspace.getModel().workspaceApplicationReceipts,
};
assert.throws(
  () => workspace.restorePackage(staleRestoration, {
    expectedJournalImpact: 'UNCHANGED',
    applicationReceipts: staleRestoration.applicationReceipts,
  }),
  /WORKSPACE_RESTORE_JOURNAL_IMPACT_MISMATCH/,
  'UNCHANGED must compare exact schema, checkpoint, and journal head',
);
assert.strictEqual(workspace.getModel().records, stateBeforeIdentityMismatch.records);
assert.strictEqual(workspace.getModel().branchRegistry, stateBeforeIdentityMismatch.registry);
assert.strictEqual(workspace.getModel().journalState, stateBeforeIdentityMismatch.journalState);
assert.strictEqual(workspace.getModel().workspaceApplicationReceipts, stateBeforeIdentityMismatch.receipts);
for (const invalidJournalState of [false, 0, '']) {
  assert.throws(
    () => workspace.restorePackage({ ...staleRestoration, journalState: invalidJournalState }, {
      expectedJournalImpact: 'REMOVE',
      applicationReceipts: staleRestoration.applicationReceipts,
    }),
    /WORKSPACE_RESTORE_JOURNAL_IDENTITY_INVALID/,
    'falsey-but-present restoration authority must fail closed',
  );
  assert.strictEqual(workspace.getModel().records, stateBeforeIdentityMismatch.records);
  assert.strictEqual(workspace.getModel().branchRegistry, stateBeforeIdentityMismatch.registry);
  assert.strictEqual(workspace.getModel().journalState, stateBeforeIdentityMismatch.journalState);
  assert.strictEqual(workspace.getModel().workspaceApplicationReceipts, stateBeforeIdentityMismatch.receipts);
}

const journalTwo = createSequentialJournalAdoption({
  documentId: 'dynamic-document-2',
  sessionId: 'dynamic-session-2',
  sourceFingerprint,
  branchRegistry: workspace.getModel().branchRegistry,
  adoptedAt: '2026-07-27T10:05:00.000Z',
});
const replacementPackage = packageValue(
  workspace.getModel().branchRegistry,
  journalTwo,
  workspace.getModel().workspaceApplicationReceipts,
  '2026-07-27T10:06:00.000Z',
);
const replacement = await controller.previewFile(packageFile(replacementPackage));
assert.equal(replacement.preview.journalImpact, 'REPLACE');
assert.equal(replacement.preview.hasDestructiveChanges, true);
setApproval(controllerRoot, 'Replace reviewed authority.', 'Journal identity change reviewed against checkpoint evidence.');
const replaced = controller.applyPending();
assert.equal(replaced.receipt.impact.journalImpact, 'REPLACE');
assert.deepEqual(workspace.getModel().journalState, journalTwo);
const replacementRestoration = restoreSequentialWorkspacePackageWithReceipts(replacementPackage);
assert.throws(
  () => workspace.restorePackage(replacementRestoration, {
    expectedJournalImpact: 'REPLACE',
    applicationReceipts: replacementRestoration.applicationReceipts,
  }),
  /WORKSPACE_RESTORE_JOURNAL_IMPACT_MISMATCH/,
  'REPLACE must reject equal current and incoming journal identities',
);

workspace.saveActiveBranch();
const removalPackage = packageValue(
  workspace.getModel().branchRegistry,
  null,
  workspace.getModel().workspaceApplicationReceipts,
  '2026-07-27T10:07:00.000Z',
);
assert.equal(removalPackage.schema, 'SequentialWorkspacePackage.v1');
const removal = await controller.previewFile(packageFile(removalPackage));
assert.equal(removal.preview.journalImpact, 'REMOVE');
assert.equal(removal.preview.hasDestructiveChanges, true);
setApproval(controllerRoot, 'Remove reviewed journal authority.', 'Downgrade to package v1 explicitly approved.');
const removed = controller.applyPending();
assert.equal(removed.receipt.packageSchema, 'SequentialWorkspacePackage.v1');
assert.equal(removed.receipt.packageRevision, 1);
assert.equal(removed.receipt.impact.journalImpact, 'REMOVE');
assert.equal(workspace.getModel().journalState, null);
assert.match(controllerRoot.querySelector('[data-ssk-workspace-package-summary]').textContent,
  /SequentialWorkspacePackage\.v1 revision 1; journal impact REMOVE/);

const installAgainPackage = packageValue(
  workspace.getModel().branchRegistry,
  journalTwo,
  workspace.getModel().workspaceApplicationReceipts,
  '2026-07-27T10:08:00.000Z',
);
await controller.previewFile(packageFile(installAgainPackage));
const cancelState = {
  records: workspace.getModel().records,
  registry: workspace.getModel().branchRegistry,
  journalState: workspace.getModel().journalState,
  receipts: workspace.getModel().workspaceApplicationReceipts,
  lastReceipt: controller.getLastReceipt(),
};
assert.equal(controller.cancelPending(), true);
assert.strictEqual(workspace.getModel().records, cancelState.records);
assert.strictEqual(workspace.getModel().branchRegistry, cancelState.registry);
assert.strictEqual(workspace.getModel().journalState, cancelState.journalState);
assert.strictEqual(workspace.getModel().workspaceApplicationReceipts, cancelState.receipts);
assert.strictEqual(controller.getLastReceipt(), cancelState.lastReceipt);

const failingRoot = fakeRoot();
const failingWorkspace = Object.freeze({
  getModel: workspace.getModel,
  getReviewQueue: workspace.getReviewQueue,
  saveActiveBranch: workspace.saveActiveBranch,
  restorePackage() { throw new Error('INJECTED_RESTORE_FAILURE'); },
});
const failingController = mountSequentialWorkspacePersistenceController(failingRoot, failingWorkspace);
await failingController.previewFile(packageFile(installAgainPackage));
setApproval(failingRoot, 'Attempt an injected failing restore.');
const failureState = {
  records: workspace.getModel().records,
  registry: workspace.getModel().branchRegistry,
  registryEntries: clone(workspace.getModel().branchRegistry.entries()),
  journalState: workspace.getModel().journalState,
  receipts: workspace.getModel().workspaceApplicationReceipts,
};
assert.throws(() => failingController.applyPending(), /INJECTED_RESTORE_FAILURE/);
assert.strictEqual(workspace.getModel().records, failureState.records);
assert.strictEqual(workspace.getModel().branchRegistry, failureState.registry);
assert.deepEqual(workspace.getModel().branchRegistry.entries(), failureState.registryEntries);
assert.strictEqual(workspace.getModel().journalState, failureState.journalState);
assert.strictEqual(workspace.getModel().workspaceApplicationReceipts, failureState.receipts);
assert.equal(failingController.getLastReceipt(), null,
  'lastReceipt must not update when restoration fails');

console.log('sequential workspace application receipt UI tests passed');
