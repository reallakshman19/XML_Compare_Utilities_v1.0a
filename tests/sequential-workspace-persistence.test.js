import assert from 'node:assert/strict';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import { createSequentialBranchWorkspaceRegistry } from '../tabs/sequential-sketcher/sequential-branch-workspace-state.js';
import {
  applyConstructionDecision,
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { DECISION_ACTIONS } from '../tabs/sequential-sketcher/construction/sequential-construction-contract.js';
import { sequentialSessionFingerprint } from '../tabs/sequential-sketcher/construction/sequential-session-fingerprint.js';
import {
  createSequentialWorkspacePackage,
  restoreSequentialWorkspacePackage,
  sequentialWorkspacePackageFingerprint,
} from '../tabs/sequential-sketcher/persistence/sequential-workspace-package.js';
import { mountSequentialSketcherWorkspace } from '../tabs/sequential-sketcher/sequential-sketcher-workspace.js';

function pipe(name, start, end) {
  return { type: 'PIPE', name, attributes: { APOS: start, LPOS: end } };
}
function branch(name, attributes, children) {
  return { type: 'BRANCH', name, attributes: { NAME: name, ...attributes }, children };
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function refreshPackageFingerprint(value) {
  value.packageFingerprint = sequentialWorkspacePackageFingerprint(value);
  return value;
}
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
    this.throwOnValueSet = false;
  }
  set innerHTML(value) {
    this._innerHTML = String(value);
    const count = (this._innerHTML.match(/<option\b/gu) || []).length;
    if (count) this.options = Array.from({ length: count }, () => ({ value: '', textContent: '', title: '' }));
  }
  get innerHTML() { return this._innerHTML; }
  set value(value) {
    if (this.throwOnValueSet) throw new Error('INJECTED_UI_SYNC_FAILURE');
    this._value = value;
  }
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

const completeBranchId = '/PKG/COMPLETE';
const deferredBranchId = '/PKG/DEFER';
const records = [
  branch(completeBranchId, { HPOS: { x: 0, y: 0, z: 0 } }, [
    pipe('P1', { x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }),
    { type: 'CAP', name: 'C1', attributes: { APOS: { x: 100, y: 0, z: 0 } } },
  ]),
  branch(deferredBranchId, {
    HPOS: { x: 0, y: 100, z: 0 },
    TREF: '/PKG/MISSING/TARGET',
  }, [pipe('P2', { x: 0, y: 100, z: 0 }, { x: 100, y: 100, z: 0 })]),
];
const evidence = buildSequentialEvidenceModel(records);
const indexes = indexSequentialEvidence(evidence);

const completed = runConstructionUntilBlocked(
  createSequentialConstructionSession(completeBranchId),
  evidence,
  indexes,
  {},
);
assert.equal(completed.session.state, 'ROUTE_COMPLETE');
const completedThenUndone = applyConstructionDecision(
  completed.session,
  evidence,
  indexes,
  DECISION_ACTIONS.UNDO_LAST_TRANSACTION,
  { reason: 'Preserve a redo path in the package.' },
  {},
);
assert.equal(completedThenUndone.session.state, 'NOT_STARTED');
assert.equal(completedThenUndone.session.redoStack.length, 1);

const blocked = runConstructionUntilBlocked(
  createSequentialConstructionSession(deferredBranchId),
  evidence,
  indexes,
  {},
);
assert.equal(blocked.session.currentDecisionRequest.reason, 'REFERENCE_TARGET_MISSING');
const deferred = applyConstructionDecision(
  blocked.session,
  evidence,
  indexes,
  DECISION_ACTIONS.DEFER_DECISION,
  {
    reason: 'Await external boundary evidence.',
    evidenceNote: 'Package must preserve the open deferred decision and its audit history.',
  },
  {},
);
assert.equal(deferred.session.currentDecisionRequest.state, 'DEFERRED');
assert.equal(deferred.session.undoStack.length, 2);

const registry = createSequentialBranchWorkspaceRegistry();
registry.reset([completeBranchId, deferredBranchId]);
registry.save(completeBranchId, {
  session: completedThenUndone.session,
  selectedCandidateId: 'CANDIDATE-PRESERVED',
});
registry.save(deferredBranchId, { session: deferred.session });

const reviewQueue = {
  generatedAt: '2026-07-17T00:00:00.000Z',
  rows: [{
    branchId: deferredBranchId,
    lineKey: 'PKG',
    reviewStatus: 'DEFERRED',
    state: 'USER_DECISION_REQUIRED',
    expectedContinuationCategory: 'REFERENCE_TARGET',
    missingEvidenceClass: 'REFERENCE_NORMALIZATION_OR_EXTERNAL_SCOPE',
    activeEndpoint: { sourceComponentId: 'P2', portId: deferred.session.activeExitPortId },
    constructionFingerprint: sequentialSessionFingerprint(deferred.session),
  }],
  snapshots: [{ branchId: deferredBranchId, session: deferred.session }],
};

const workspacePackage = createSequentialWorkspacePackage({
  records,
  evidence,
  branchRegistry: registry,
  activeBranchId: deferredBranchId,
  reviewQueue,
});
assert.equal(workspacePackage.schema, 'SequentialWorkspacePackage.v1');
assert.equal(workspacePackage.workspaces.length, 2);
assert.ok(workspacePackage.packageFingerprint);
assert.equal(workspacePackage.decisionRegister.summary.unresolvedCount, 1);

const restoration = restoreSequentialWorkspacePackage(JSON.stringify(workspacePackage));
assert.equal(restoration.schema, 'SequentialWorkspaceRestoration.v1');
assert.equal(restoration.activeBranchId, deferredBranchId);
assert.deepEqual(restoration.branchIds, [completeBranchId, deferredBranchId]);
assert.equal(restoration.decisionRegister.summary.unresolvedCount, 1);
const restoredByBranch = new Map(restoration.workspaces.map((row) => [row.branchId, row.snapshot]));
const restoredComplete = restoredByBranch.get(completeBranchId);
const restoredDeferred = restoredByBranch.get(deferredBranchId);
assert.equal(restoredComplete.selectedCandidateId, 'CANDIDATE-PRESERVED');
assert.equal(restoredComplete.session.redoStack.length, 1);
assert.equal(restoredDeferred.session.currentDecisionRequest.state, 'DEFERRED');
assert.equal(restoredDeferred.session.currentDecisionRequest.deferral.reason, 'Await external boundary evidence.');
assert.equal(restoredDeferred.session.undoStack.length, 2);

const redone = applyConstructionDecision(
  restoredComplete.session,
  restoration.evidence,
  restoration.indexes,
  DECISION_ACTIONS.REDO_LAST_TRANSACTION,
  { reason: 'Verify restored redo execution.' },
  {},
);
assert.equal(redone.outcome, 'TRANSACTION_REDONE');
assert.equal(redone.session.state, 'ROUTE_COMPLETE');
assert.equal(sequentialSessionFingerprint(redone.session), sequentialSessionFingerprint(completed.session));

{
  const existing = createSequentialBranchWorkspaceRegistry();
  existing.reset([completeBranchId]);
  existing.save(completeBranchId, { session: completed.session });
  assert.throws(
    () => existing.replace([completeBranchId], [{ branchId: '/UNKNOWN', snapshot: { session: completed.session } }]),
    /Invalid Sequential Sketcher workspace entry/,
  );
  assert.equal(existing.savedCount(), 1, 'failed atomic replacement must preserve the current registry');
  assert.equal(existing.get(completeBranchId).session.state, 'ROUTE_COMPLETE');
  existing.replace(restoration.branchIds, restoration.workspaces);
  assert.equal(existing.savedCount(), 2);
}

{
  const tampered = clone(workspacePackage);
  tampered.source.records[0].attributes.NAME = '/PKG/TAMPERED';
  refreshPackageFingerprint(tampered);
  assert.throws(() => restoreSequentialWorkspacePackage(tampered), /WORKSPACE_SOURCE_FINGERPRINT_MISMATCH/);
}
{
  const tampered = clone(workspacePackage);
  tampered.workspaces[0].session.activeComponentId = 'UNTRACKED-COMPONENT';
  refreshPackageFingerprint(tampered);
  assert.throws(() => restoreSequentialWorkspacePackage(tampered), /WORKSPACE_SESSION_FINGERPRINT_MISMATCH/);
}
{
  const tampered = clone(workspacePackage);
  const completeRow = tampered.workspaces.find((row) => row.branchId === completeBranchId);
  completeRow.session.redoStack[0].afterSnapshot.state = 'FAILED';
  refreshPackageFingerprint(tampered);
  assert.throws(() => restoreSequentialWorkspacePackage(tampered), /WORKSPACE_HISTORY_AFTER_FINGERPRINT_MISMATCH/);
}
{
  const tampered = clone(workspacePackage);
  tampered.policies.tolerancePolicyFingerprint = 'tampered-policy';
  refreshPackageFingerprint(tampered);
  assert.throws(() => restoreSequentialWorkspacePackage(tampered), /WORKSPACE_TOLERANCE_POLICY_MISMATCH/);
}
{
  const tampered = clone(workspacePackage);
  tampered.activeBranchId = completeBranchId;
  assert.throws(() => restoreSequentialWorkspacePackage(tampered), /WORKSPACE_PACKAGE_FINGERPRINT_MISMATCH/);
}
assert.throws(() => restoreSequentialWorkspacePackage('{broken'), /WORKSPACE_PACKAGE_JSON_INVALID/);

const completedRegistry = createSequentialBranchWorkspaceRegistry();
completedRegistry.reset([completeBranchId]);
completedRegistry.save(completeBranchId, { session: completed.session, selectedCandidateId: 'COMPLETE-CANDIDATE' });
const completedPackage = createSequentialWorkspacePackage({
  records,
  evidence,
  branchRegistry: completedRegistry,
  activeBranchId: completeBranchId,
});
const completedRestoration = restoreSequentialWorkspacePackage(completedPackage);
assert.equal(completedRestoration.workspaces[0].snapshot.confirmedConstruction, null);
const workspaceRoot = fakeRoot();
const workspace = mountSequentialSketcherWorkspace(workspaceRoot);
workspace.restorePackage(completedRestoration, { expectedJournalImpact: 'ABSENT', applicationReceipts: [] });
const restoredModel = workspace.getModel();
assert.equal(restoredModel.session.state, 'ROUTE_COMPLETE');
assert.ok(restoredModel.confirmedConstruction, 'completed v1 active branch must regenerate confirmed construction');
assert.ok(restoredModel.supportProjection, 'completed v1 active branch must regenerate support projection');
assert.ok(restoredModel.branchRegistry.get(completeBranchId).confirmedConstruction,
  'completed v1 registry row must contain regenerated confirmed construction');
assert.ok(restoredModel.branchRegistry.get(completeBranchId).supportProjection,
  'completed v1 registry row must contain regenerated support projection');

const beforeFailure = {
  records: restoredModel.records,
  registry: restoredModel.branchRegistry,
  session: restoredModel.session,
  confirmedConstruction: restoredModel.confirmedConstruction,
  supportProjection: restoredModel.supportProjection,
  journalState: restoredModel.journalState,
  receipts: restoredModel.workspaceApplicationReceipts,
};
const invalidRestoration = {
  ...completedRestoration,
  workspaces: [{ branchId: '/UNKNOWN', snapshot: completedRestoration.workspaces[0].snapshot }],
};
assert.throws(
  () => workspace.restorePackage(invalidRestoration, { expectedJournalImpact: 'ABSENT', applicationReceipts: [] }),
  /Invalid Sequential Sketcher workspace entry/,
);
assert.strictEqual(restoredModel.records, beforeFailure.records);
assert.strictEqual(restoredModel.branchRegistry, beforeFailure.registry);
assert.strictEqual(restoredModel.session, beforeFailure.session);
assert.strictEqual(restoredModel.confirmedConstruction, beforeFailure.confirmedConstruction);
assert.strictEqual(restoredModel.supportProjection, beforeFailure.supportProjection);
assert.strictEqual(restoredModel.journalState, beforeFailure.journalState);
assert.strictEqual(restoredModel.workspaceApplicationReceipts, beforeFailure.receipts);

const uiFaultRoot = fakeRoot();
const uiFaultWorkspace = mountSequentialSketcherWorkspace(uiFaultRoot);
uiFaultRoot.querySelector('[data-ssk-source]').throwOnValueSet = true;
assert.doesNotThrow(
  () => uiFaultWorkspace.restorePackage(completedRestoration, { expectedJournalImpact: 'ABSENT', applicationReceipts: [] }),
  'post-commit UI synchronization failures must not surface as failed restoration',
);
assert.equal(uiFaultWorkspace.getModel().session.state, 'ROUTE_COMPLETE');

console.log('sequential workspace persistence tests passed');
