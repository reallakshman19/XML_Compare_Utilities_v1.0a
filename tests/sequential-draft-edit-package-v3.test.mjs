import assert from 'node:assert/strict';
import { createSequentialBranchWorkspaceRegistry } from '../tabs/sequential-sketcher/sequential-branch-workspace-state.js';
import { createConfirmedSequentialConstruction } from '../tabs/sequential-sketcher/construction/sequential-construction-acceptance.js';
import {
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import { buildConfirmedConstructionSupportProjection } from '../tabs/sequential-sketcher/support/sequential-confirmed-support-projection.js';
import { createSequentialEngineeringSvgOwnerBridge } from '../tabs/sequential-sketcher/sequential-engineering-svg-owner-bridge.js';
import { createSequentialJournalAdoption } from '../tabs/sequential-sketcher/scoped-edit/sequential-command-service.js';
import { sequentialBranchSetFingerprint } from '../tabs/sequential-sketcher/scoped-edit/sequential-edit-authority.js';
import { sequentialCommandJournalHeadFingerprint } from '../tabs/sequential-sketcher/scoped-edit/sequential-command-journal.js';
import { createSequentialSupportAdjustmentBoundary } from '../tabs/sequential-sketcher/scoped-edit/sequential-support-adjustment-boundary.js';
import { createSequentialGeometryEditBoundary } from '../tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-boundary.js';
import { selectSequentialDraftEditSupportMoveTarget } from '../tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-support-move-target.js';
import { createSequentialDraftEditSupportMoveDraftStore } from '../tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-support-move-draft.js';
import { createSequentialDraftEditSupportMoveApplyService } from '../tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-support-move-apply.js';
import { createSequentialEditableTopologySnapshot } from '../tabs/sequential-sketcher/scoped-edit/sequential-editable-topology-snapshot.js';
import { selectSequentialSingleEntityMoveTarget } from '../tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-target.js';
import { createSequentialSingleEntityMoveDraftStore } from '../tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-draft.js';
import { createSequentialSingleEntityMoveApplicationService } from '../tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-application.js';
import { createSequentialDraftEditPackageRuntime } from '../tabs/sequential-sketcher/persistence/sequential-draft-edit-package-runtime.js';
import { createSequentialDraftEditPackageExtension } from '../tabs/sequential-sketcher/persistence/sequential-draft-edit-package-extension.js';
import { sequentialSourceRecordsFingerprint } from '../tabs/sequential-sketcher/persistence/sequential-workspace-package.js';
import {
  createSequentialWorkspacePackageWithReceipts,
  restoreSequentialWorkspacePackageWithReceipts,
} from '../tabs/sequential-sketcher/persistence/sequential-workspace-package-receipts.js';
import { buildSequentialWorkspaceImportPreview } from '../tabs/sequential-sketcher/persistence/sequential-workspace-import-preview.js';
import {
  createSequentialWorkspaceApplicationReceipt,
  validateSequentialWorkspaceApplicationReceipt,
} from '../tabs/sequential-sketcher/persistence/sequential-workspace-application-receipt.js';

const AT = '2026-07-30T04:30:00.000Z';
const SUPPORT_BRANCH = '/P1/SUPPORT';
const GEOMETRY_BRANCH = '/P1/GEOMETRY';
const records = [
  { type: 'BRANCH', name: SUPPORT_BRANCH,
    attributes: { NAME: SUPPORT_BRANCH, HPOS: { x: 0, y: 0, z: 0 } },
    children: [
      { type: 'PIPE', name: 'SP1', attributes: { NAME: 'SP1', APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 1000, y: 0, z: 0 } } },
      { type: 'SUPPORT', name: 'SUPPORT FAMILY', attributes: { NAME: '/PS-P1/DATUM', TYPE: 'ATTA', OWNER: SUPPORT_BRANCH, POS: { x: 250, y: 0, z: 0 }, CMPSUPTYPE: 'REST' } },
      { type: 'SUPPORT', name: 'SUPPORT FAMILY', attributes: { NAME: '/PS-P1.1', TYPE: 'ATTA', OWNER: SUPPORT_BRANCH, POS: { x: 250, y: 0, z: 0 }, CMPSUPTYPE: 'SH-100' } },
      { type: 'CAP', name: 'SC1', attributes: { NAME: 'SC1', APOS: { x: 1000, y: 0, z: 0 } } },
    ] },
  { type: 'BRANCH', name: GEOMETRY_BRANCH,
    attributes: { NAME: GEOMETRY_BRANCH, HPOS: { x: 0, y: 0, z: 0 } },
    children: [{ type: 'PIPE', name: 'GP1',
      attributes: { NAME: 'GP1', APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } } }] },
];
const evidence = buildSequentialEvidenceModel(records);
const indexes = indexSequentialEvidence(evidence);
const sourceFingerprint = sequentialSourceRecordsFingerprint(records);

function branchState(branchId) {
  const session = runConstructionUntilBlocked(
    createSequentialConstructionSession(branchId), evidence, indexes, { commandIssuedAt: AT },
  ).session;
  assert.equal(session.state, 'ROUTE_COMPLETE');
  const confirmedConstruction = createConfirmedSequentialConstruction(session, indexes);
  const supportProjection = buildConfirmedConstructionSupportProjection(confirmedConstruction, indexes, {});
  return { branchId, session, confirmedConstruction, supportProjection };
}
const originalStates = new Map([
  [SUPPORT_BRANCH, branchState(SUPPORT_BRANCH)],
  [GEOMETRY_BRANCH, branchState(GEOMETRY_BRANCH)],
]);
const branchRegistry = createSequentialBranchWorkspaceRegistry();
branchRegistry.reset([SUPPORT_BRANCH, GEOMETRY_BRANCH]);
for (const state of originalStates.values()) branchRegistry.save(state.branchId, state);
const journalState = createSequentialJournalAdoption({
  documentId: `document:${sourceFingerprint}`,
  sessionId: `session:${sourceFingerprint}`,
  sourceFingerprint,
  branchRegistry,
  adoptedAt: AT,
});

function environment(states, registry, restoredJournal = journalState) {
  let active = states.get(SUPPORT_BRANCH);
  const ownerBridge = createSequentialEngineeringSvgOwnerBridge({
    readOwnerState: () => ({ ...active, evidenceModel: evidence, indexes, visibleProjection: 'ISO' }),
  });
  const baseState = () => ({
    sourceFingerprint, evidence, indexes, ...active, branchRegistry: registry,
    journalState: restoredJournal,
    ownerSnapshot: Object.freeze({ revision: ownerBridge.getSnapshot().revision }),
    engineOptions: {},
  });
  const supportBoundary = createSequentialSupportAdjustmentBoundary({
    readBaseState: baseState,
    readBaseOwnerSnapshot: ownerBridge.getSnapshot,
    onPublished: () => {},
  });
  const geometryBoundary = createSequentialGeometryEditBoundary({
    readBaseState: supportBoundary.readCurrentState,
    readBaseView: supportBoundary.readView,
    onPublished: () => {},
  });
  const workspace = {
    saveActiveBranch() { registry.save(active.branchId, active); },
    getModel() { return { records, evidence, indexes, branchRegistry: registry,
      session: active.session, journalState: restoredJournal }; },
  };
  const runtime = createSequentialDraftEditPackageRuntime({
    workspace, supportBoundary, geometryBoundary,
  });
  return Object.freeze({
    ownerBridge, supportBoundary, geometryBoundary, runtime,
    activate(branchId) { active = states.get(branchId); },
    destroy() { geometryBoundary.destroy(); supportBoundary.destroy(); ownerBridge.destroy(); },
  });
}

const first = environment(originalStates, branchRegistry);
const emptyState = {
  supportBranchCount: 0, supportAdjustmentCount: 0,
  geometryBranchCount: 0, geometryEditCount: 0,
};
assert.deepEqual(first.runtime.getState(), emptyState);
first.supportBoundary.readCurrentState();
first.activate(GEOMETRY_BRANCH);
first.geometryBoundary.readCurrentState();
assert.deepEqual(first.runtime.getState(), emptyState);
const noEditPackage = createSequentialWorkspacePackageWithReceipts({
  records, evidence, branchRegistry, activeBranchId: GEOMETRY_BRANCH,
  journalState, createdAt: AT, applicationReceipts: [],
});
assert.equal(noEditPackage.schema, 'SequentialWorkspacePackage.v2');
first.activate(SUPPORT_BRANCH);

const supportView = first.supportBoundary.readView();
const supportEntity = supportView.scene.entities.find((row) => row.domainRef.category === 'support');
const supportTarget = selectSequentialDraftEditSupportMoveTarget({
  objectId: supportEntity.id, readModel: supportView.readModel, scene: supportView.scene,
  currentState: first.supportBoundary.readCurrentState(),
});
const supportDraft = createSequentialDraftEditSupportMoveDraftStore().stage({
  target: supportTarget, position: { x: 300, y: 0, z: 0 }, actorId: 'P1_OPERATOR',
  reason: 'Durable support move.', evidenceNote: 'Carrier and branch checked.',
});
const supportService = createSequentialDraftEditSupportMoveApplyService({
  readCurrentState: first.supportBoundary.readCurrentState,
  publishCandidate: first.supportBoundary.publishCandidate,
  now: () => AT,
});
assert.equal(supportService.accept(supportService.prepare(supportDraft)).accepted, true);
assert.equal(first.supportBoundary.readHistory().undoStack.length, 1);

first.activate(GEOMETRY_BRANCH);
const geometryView = first.geometryBoundary.readView();
const topology = createSequentialEditableTopologySnapshot(geometryView.readModel);
const moveTarget = selectSequentialSingleEntityMoveTarget({
  objectId: topology.selectionCandidates[0].sceneEntityId,
  readModel: geometryView.readModel,
  scene: geometryView.scene,
});
const geometryDraft = createSequentialSingleEntityMoveDraftStore().stage({
  target: moveTarget, constraint: 'X', delta: { x: 25, y: 0, z: 0 },
  interaction: { kind: 'numeric', source: 'exact-xyz' },
});
const geometryService = createSequentialSingleEntityMoveApplicationService({
  readCurrentState: first.geometryBoundary.readCurrentState,
  readView: first.geometryBoundary.readView,
  readJournal: first.geometryBoundary.readJournal,
  publishCandidate: first.geometryBoundary.publishCandidate,
  now: () => AT,
});
assert.equal(geometryService.accept(geometryService.prepare(geometryDraft, {
  actorId: 'P1_OPERATOR', reason: 'Durable geometry move.', evidenceNote: 'Isolated pipe checked.',
})).accepted, true);

const extension = first.runtime.createExtension();
assert.equal(extension.summary.supportAdjustmentCount, 1);
assert.equal(extension.summary.geometryEditCount, 1);
assert.equal(extension.supportBranches.length, 1);
assert.equal(extension.geometryBranches.length, 1);
assert.equal(extension.branchSetFingerprint, sequentialBranchSetFingerprint(branchRegistry));
assert.equal(extension.commandJournalHeadFingerprint,
  sequentialCommandJournalHeadFingerprint(journalState));
const packageValue = createSequentialWorkspacePackageWithReceipts({
  records, evidence, branchRegistry, activeBranchId: GEOMETRY_BRANCH,
  journalState, createdAt: AT, applicationReceipts: [], draftEditExtension: extension,
});
assert.equal(packageValue.schema, 'SequentialWorkspacePackage.v3');
assert.equal(packageValue.revision, 3);
const restoration = restoreSequentialWorkspacePackageWithReceipts(packageValue);
assert.equal(restoration.schema, 'SequentialWorkspaceRestoration.v2');
assert.equal(restoration.packageSchema, 'SequentialWorkspacePackage.v3');
assert.equal(restoration.draftEditExtension.summary.geometryEditCount, 1);

const restoredRegistry = createSequentialBranchWorkspaceRegistry();
const restoredStates = new Map(restoration.workspaces.map(({ branchId, snapshot }) => {
  const state = branchState(branchId);
  return [branchId, { ...state, session: snapshot.session }];
}));
restoredRegistry.replace(restoration.branchIds,
  [...restoredStates.values()].map((state) => ({ branchId: state.branchId, snapshot: state })));
const reopened = environment(restoredStates, restoredRegistry, restoration.journalState);
reopened.activate(GEOMETRY_BRANCH);
reopened.runtime.restoreExtension(restoration.draftEditExtension);
const moved = reopened.geometryBoundary.readView().scene.entities
  .find((row) => row.id === moveTarget.geometryPartIds[0]);
assert.equal(moved.geometry.start.x, 25);
assert.equal(reopened.geometryBoundary.getState().branches
  .find((row) => row.branchId === GEOMETRY_BRANCH).consumedPreparedCount, 1);
reopened.activate(SUPPORT_BRANCH);
assert.equal(reopened.supportBoundary.readCurrentState()
  .supportProjection.supportGlyphs[0].centerlinePointGlobal.x, 300);
assert.equal(reopened.supportBoundary.readHistory().undoStack.length, 1);
assert.deepEqual(reopened.runtime.getState(), {
  supportBranchCount: 1, supportAdjustmentCount: 1,
  geometryBranchCount: 1, geometryEditCount: 1,
});

const preview = buildSequentialWorkspaceImportPreview(restoration, {});
assert.equal(preview.draftEditImpact, 'INSTALL');
assert.equal(preview.packageDraftEditSummary.geometryEditCount, 1);
const receipt = createSequentialWorkspaceApplicationReceipt({
  preview, restoration, beforeFingerprint: 'EMPTY-WORKSPACE', afterFingerprint: 'RESTORED-WORKSPACE',
  reason: 'Restore governed Draft Edit 3D package.', evidenceNote: 'Package and edit counts reviewed.',
});
assert.equal(receipt.packageSchema, 'SequentialWorkspacePackage.v3');
assert.equal(receipt.draftEditEvidence.extensionFingerprint,
  restoration.draftEditExtension.extensionFingerprint);
assert.equal(validateSequentialWorkspaceApplicationReceipt(receipt).receiptId, receipt.receiptId);
const staleExtension = createSequentialDraftEditPackageExtension({
  ...extension, branchSetFingerprint: 'STALE-BRANCH-SET',
});
assert.throws(() => createSequentialWorkspacePackageWithReceipts({
  records, evidence, branchRegistry, activeBranchId: GEOMETRY_BRANCH,
  journalState, createdAt: AT, applicationReceipts: [], draftEditExtension: staleExtension,
}), /EDIT_AUTHORITY_STALE/);
const tampered = structuredClone(packageValue);
tampered.draftEditExtension.geometryBranches[0].journal.headFingerprint = 'TAMPERED';
assert.throws(() => restoreSequentialWorkspacePackageWithReceipts(tampered));

function transactionBoundary(kind, failures = {}) {
  let value = 'BEFORE'; let discarded = 0;
  return Object.freeze({
    exportPackageState: () => ({ branchCount: 0, currentAdjustmentCount: 0,
      editCount: 0, branches: [] }),
    preparePackageState(state) {
      if (failures.prepare) throw new Error(`${kind} prepare failed`);
      return Object.freeze({ state });
    },
    readPackageStageView: () => Object.freeze({ readModel: null, scene: null }),
    commitPackageState(stage) {
      if (failures.commit) throw new Error(`${kind} commit failed`);
      const previous = value; value = 'RESTORED';
      return Object.freeze({ state: stage.state, previous });
    },
    rollbackPackageState(commit) {
      if (failures.rollback) throw new Error(`${kind} rollback failed`);
      value = commit.previous; return commit.state;
    },
    finalizePackageState: (commit) => commit.state,
    discardPackageState() { discarded += 1; return true; },
    inspect: () => Object.freeze({ value, discarded }),
  });
}
function transactionRuntime(supportBoundary, geometryBoundary, options = {}) {
  return createSequentialDraftEditPackageRuntime({
    workspace: { getModel: () => ({}), saveActiveBranch: () => {} },
    supportBoundary, geometryBoundary, ...options,
  });
}
const emptyRestoration = Object.freeze({
  schema: 'SequentialDraftEditPackageRestoration.v1',
  supportBranches: [], geometryBranches: [], summary: emptyState,
});
{
  const support = transactionBoundary('support');
  const geometry = transactionBoundary('geometry', { commit: true });
  let observed = 0;
  assert.throws(() => transactionRuntime(support, geometry, {
    onRestored: () => { observed += 1; },
  }).restoreExtension(emptyRestoration), /geometry commit failed/);
  assert.deepEqual([support.inspect().value, geometry.inspect().value], ['BEFORE', 'BEFORE']);
  assert.equal(observed, 0);
}
{
  const support = transactionBoundary('support', { rollback: true });
  const geometry = transactionBoundary('geometry', { commit: true });
  let caught = null;
  try { transactionRuntime(support, geometry).restoreExtension(emptyRestoration); }
  catch (error) { caught = error; }
  assert.ok(caught instanceof AggregateError);
  assert.equal(caught.cause.message, 'geometry commit failed');
}
{
  const support = transactionBoundary('support');
  const geometry = transactionBoundary('geometry', { prepare: true });
  assert.throws(() => transactionRuntime(support, geometry)
    .restoreExtension(emptyRestoration), /geometry prepare failed/);
  assert.deepEqual([support.inspect().value, geometry.inspect().value], ['BEFORE', 'BEFORE']);
  assert.equal(support.inspect().discarded, 1);
}
{
  const support = transactionBoundary('support');
  const geometry = transactionBoundary('geometry');
  let observedTogether = false;
  transactionRuntime(support, geometry, { onRestored: () => {
    observedTogether = support.inspect().value === 'RESTORED'
      && geometry.inspect().value === 'RESTORED';
  } }).restoreExtension(emptyRestoration);
  assert.equal(observedTogether, true);
}
{
  const support = transactionBoundary('support');
  const geometry = transactionBoundary('geometry');
  const diagnostics = [];
  const result = transactionRuntime(support, geometry, {
    onRestored: () => { throw new Error('refresh failed'); },
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  }).restoreExtension(emptyRestoration);
  assert.equal(result.diagnostic.stage, 'POST_COMMIT_RESTORATION_NOTIFICATION');
  assert.equal(diagnostics.length, 1);
  assert.deepEqual([support.inspect().value, geometry.inspect().value], ['RESTORED', 'RESTORED']);
}

first.destroy(); reopened.destroy();
console.log('[PASS] durable support and geometry package v3 round-trip');
