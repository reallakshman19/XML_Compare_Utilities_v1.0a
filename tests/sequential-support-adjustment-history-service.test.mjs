import assert from 'node:assert/strict';
import { stableToken } from '../tabs/sequential-sketcher/sequential-sketcher-contract.js';
import { createSequentialBranchWorkspaceRegistry } from '../tabs/sequential-sketcher/sequential-branch-workspace-state.js';
import { createSequentialConstructionSession, runConstructionUntilBlocked } from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { createConfirmedSequentialConstruction } from '../tabs/sequential-sketcher/construction/sequential-construction-acceptance.js';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import { buildConfirmedConstructionSupportProjection } from '../tabs/sequential-sketcher/support/sequential-confirmed-support-projection.js';
import { createSequentialEngineeringSvgOwnerBridge } from '../tabs/sequential-sketcher/sequential-engineering-svg-owner-bridge.js';
import { createSequentialJournalAdoption } from '../tabs/sequential-sketcher/scoped-edit/sequential-command-service.js';
import { createSequentialSupportAdjustmentBoundary } from '../tabs/sequential-sketcher/scoped-edit/sequential-support-adjustment-boundary.js';
import { selectSequentialDraftEditSupportMoveTarget } from '../tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-support-move-target.js';
import { createSequentialDraftEditSupportMoveDraftStore } from '../tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-support-move-draft.js';
import { createSequentialDraftEditSupportMoveApplyService } from '../tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-support-move-apply.js';
import {
  createSequentialSupportAdjustmentHistoryService,
  SEQUENTIAL_SUPPORT_HISTORY_REJECTION,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-support-adjustment-history-service.js';

const BRANCH = '/SSK/3J/HISTORY';
const AT = '2026-07-28T08:25:00.000Z';
function records() {
  return [{
    type: 'BRANCH', name: BRANCH, attributes: { NAME: BRANCH, HPOS: { x: 0, y: 0, z: 0 } },
    children: [
      { type: 'PIPE', name: 'P1', attributes: { NAME: 'P1', APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 1000, y: 0, z: 0 } } },
      { type: 'SUPPORT', name: 'SUPPORT FAMILY', attributes: { NAME: '/PS-1/DATUM', TYPE: 'ATTA', OWNER: BRANCH, POS: { x: 250, y: 0, z: 0 }, CMPSUPTYPE: 'REST' } },
      { type: 'SUPPORT', name: 'SUPPORT FAMILY', attributes: { NAME: '/PS-1.1', TYPE: 'ATTA', OWNER: BRANCH, POS: { x: 250, y: 0, z: 0 }, CMPSUPTYPE: 'SH-100' } },
      { type: 'CAP', name: 'C1', attributes: { NAME: 'C1', APOS: { x: 1000, y: 0, z: 0 } } },
    ],
  }];
}
function fixture() {
  const source = records();
  const evidence = buildSequentialEvidenceModel(source);
  const indexes = indexSequentialEvidence(evidence);
  const session = runConstructionUntilBlocked(
    createSequentialConstructionSession(BRANCH), evidence, indexes, { commandIssuedAt: AT },
  ).session;
  const confirmedConstruction = createConfirmedSequentialConstruction(session, indexes);
  const supportProjection = buildConfirmedConstructionSupportProjection(confirmedConstruction, indexes, {});
  const branchRegistry = createSequentialBranchWorkspaceRegistry();
  branchRegistry.reset([BRANCH]);
  branchRegistry.save(BRANCH, { session, confirmedConstruction, supportProjection });
  const sourceFingerprint = `SOURCE-${stableToken(JSON.stringify(source))}`;
  const journalState = createSequentialJournalAdoption({
    documentId: `document:${sourceFingerprint}`,
    sessionId: `session:${sourceFingerprint}`,
    sourceFingerprint, branchRegistry, adoptedAt: AT,
  });
  const ownerBridge = createSequentialEngineeringSvgOwnerBridge({
    readOwnerState: () => ({ session, evidenceModel: evidence, indexes,
      confirmedConstruction, supportProjection, visibleProjection: 'ISO' }),
  });
  const baseState = {
    sourceFingerprint, evidence, indexes, session, branchRegistry, journalState,
    confirmedConstruction, supportProjection,
    ownerSnapshot: Object.freeze({ revision: ownerBridge.getSnapshot().revision }),
    engineOptions: {},
  };
  const publications = [];
  const boundary = createSequentialSupportAdjustmentBoundary({
    readBaseState: () => baseState,
    readBaseOwnerSnapshot: ownerBridge.getSnapshot,
    onPublished: (publication) => publications.push(publication),
  });
  const moveService = createSequentialDraftEditSupportMoveApplyService({
    readCurrentState: boundary.readCurrentState,
    publishCandidate: boundary.publishCandidate,
    now: () => AT,
  });
  const historyService = createSequentialSupportAdjustmentHistoryService({
    readCurrentState: boundary.readCurrentState,
    readHistory: boundary.readHistory,
    publishHistoryCandidate: boundary.publishHistoryCandidate,
    now: () => AT,
  });
  function previewAt(x) {
    const view = boundary.readView();
    const entity = view.scene.entities.find((row) => row.domainRef.category === 'support');
    const target = selectSequentialDraftEditSupportMoveTarget({
      objectId: entity.id, readModel: view.readModel, scene: view.scene,
      currentState: boundary.readCurrentState(),
    });
    const store = createSequentialDraftEditSupportMoveDraftStore();
    return store.stage({ target, position: { x, y: 0, z: 0 }, actorId: 'operator-3j',
      reason: 'Apply exact support adjustment.', evidenceNote: 'Carrier checked.' });
  }
  function applyMove(x) {
    const prepared = moveService.prepare(previewAt(x));
    const acceptance = moveService.accept(prepared);
    assert.equal(acceptance.accepted, true);
    return acceptance;
  }
  return { source, evidence, session, confirmedConstruction, journalState,
    ownerBridge, boundary, moveService, historyService, previewAt, applyMove, publications };
}
function historyInput(action) {
  return { action, actorId: 'operator-3j', reason: 'Review support history transition.',
    evidenceNote: 'Register, support and carrier evidence checked.' };
}

const left = fixture();
const right = fixture();
left.applyMove(300); right.applyMove(300);
const leftPrepared = left.historyService.prepare(historyInput('UNDO_SUPPORT_ADJUSTMENT'));
const rightPrepared = right.historyService.prepare(historyInput('UNDO_SUPPORT_ADJUSTMENT'));
assert.deepEqual(leftPrepared, rightPrepared, 'support history preparation must be deterministic');
assert.equal(left.publications.length, 1, 'prepare must not publish');
assert.equal(leftPrepared.candidate.action, 'UNDO_SUPPORT_ADJUSTMENT');
assert.equal(leftPrepared.candidate.affectedEntry.toPosition.x, 300);
assert.equal(leftPrepared.candidate.supportProjection.supportGlyphs[0].centerlinePointGlobal.x, 250);
assert.equal(leftPrepared.candidate.provenance.actorId, 'operator-3j');
assert.equal(leftPrepared.candidate.provenance.issuedAt, AT);

const sourceBefore = JSON.stringify(left.source);
const evidenceBefore = JSON.stringify(left.evidence);
const sessionBefore = JSON.stringify(left.session);
const confirmedBefore = JSON.stringify(left.confirmedConstruction);
const journalBefore = JSON.stringify(left.journalState);
const acceptedUndo = left.historyService.accept(leftPrepared);
assert.equal(acceptedUndo.accepted, true);
assert.equal(acceptedUndo.publication.action, 'UNDO_SUPPORT_ADJUSTMENT');
assert.equal(left.publications.length, 2);
assert.equal(left.boundary.readCurrentState().supportProjection.supportGlyphs[0].centerlinePointGlobal.x, 250);
assert.equal(left.boundary.readHistory().redoStack.length, 1);
assert.equal(JSON.stringify(left.source), sourceBefore);
assert.equal(JSON.stringify(left.evidence), evidenceBefore);
assert.equal(JSON.stringify(left.session), sessionBefore);
assert.equal(JSON.stringify(left.confirmedConstruction), confirmedBefore);
assert.equal(JSON.stringify(left.journalState), journalBefore);

const preparedRedo = left.historyService.prepare(historyInput('REDO_SUPPORT_ADJUSTMENT'));
assert.equal(preparedRedo.candidate.supportProjection.supportGlyphs[0].centerlinePointGlobal.x, 300);
const acceptedRedo = left.historyService.accept(preparedRedo);
assert.equal(acceptedRedo.accepted, true);
assert.equal(left.boundary.readCurrentState().supportProjection.supportGlyphs[0].centerlinePointGlobal.x, 300);
assert.equal(left.boundary.readHistory().redoStack.length, 0);
assert.throws(() => left.historyService.accept(leftPrepared),
  (error) => error.code === SEQUENTIAL_SUPPORT_HISTORY_REJECTION.PUBLICATION_FAILED
    && /already been consumed/.test(error.message),
  'accepted history preparation must remain single-shot after an undo-redo round trip');
assert.equal(left.publications.length, 3);

const stale = fixture();
stale.applyMove(300);
const staleA = stale.historyService.prepare(historyInput('UNDO_SUPPORT_ADJUSTMENT'));
const staleB = stale.historyService.prepare(historyInput('UNDO_SUPPORT_ADJUSTMENT'));
assert.equal(stale.historyService.accept(staleA).accepted, true);
const staleResult = stale.historyService.accept(staleB);
assert.equal(staleResult.accepted, false);
assert.equal(staleResult.reasonCode, SEQUENTIAL_SUPPORT_HISTORY_REJECTION.AUTHORITY_STALE);
assert.equal(stale.publications.length, 2);

const tamper = fixture();
tamper.applyMove(300);
const preparedTamper = tamper.historyService.prepare(historyInput('UNDO_SUPPORT_ADJUSTMENT'));
assert.throws(() => tamper.historyService.accept({
  ...preparedTamper,
  candidate: { ...preparedTamper.candidate, action: 'REDO_SUPPORT_ADJUSTMENT' },
}), (error) => error.code === SEQUENTIAL_SUPPORT_HISTORY_REJECTION.PREPARED_INVALID);
assert.equal(tamper.publications.length, 1);

const diverged = fixture();
diverged.applyMove(300);
const undo = diverged.historyService.prepare(historyInput('UNDO_SUPPORT_ADJUSTMENT'));
assert.equal(diverged.historyService.accept(undo).accepted, true);
diverged.applyMove(325);
assert.equal(diverged.boundary.readHistory().redoStack.length, 0,
  'new adjustment after undo must clear redo history');
assert.throws(() => diverged.historyService.prepare(historyInput('REDO_SUPPORT_ADJUSTMENT')),
  /No support adjustment is available to redo/);

for (const test of [left, right, stale, tamper, diverged]) {
  test.boundary.destroy(); test.ownerBridge.destroy();
}
console.log('Sequential SSK-TS-3J supervised support history prepare and accept: ok');
