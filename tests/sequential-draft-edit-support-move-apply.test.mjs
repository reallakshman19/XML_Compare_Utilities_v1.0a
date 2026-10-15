import assert from 'node:assert/strict';
import { stableToken } from '../tabs/sequential-sketcher/sequential-sketcher-contract.js';
import { createSequentialBranchWorkspaceRegistry } from '../tabs/sequential-sketcher/sequential-branch-workspace-state.js';
import { createSequentialConstructionSession, runConstructionUntilBlocked } from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { createConfirmedSequentialConstruction } from '../tabs/sequential-sketcher/construction/sequential-construction-acceptance.js';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import { buildConfirmedConstructionSupportProjection } from '../tabs/sequential-sketcher/support/sequential-confirmed-support-projection.js';
import { createSequentialEngineeringSvgOwnerBridge } from '../tabs/sequential-sketcher/sequential-engineering-svg-owner-bridge.js';
import { createSequentialJournalAdoption } from '../tabs/sequential-sketcher/scoped-edit/sequential-command-service.js';
import { deriveSequentialEditAuthority } from '../tabs/sequential-sketcher/scoped-edit/sequential-edit-authority.js';
import { createSequentialSupportAdjustmentBoundary } from '../tabs/sequential-sketcher/scoped-edit/sequential-support-adjustment-boundary.js';
import { selectSequentialDraftEditSupportMoveTarget } from '../tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-support-move-target.js';
import { createSequentialDraftEditSupportMoveDraftStore } from '../tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-support-move-draft.js';
import {
  createSequentialDraftEditSupportMoveApplyService,
  SEQUENTIAL_SUPPORT_ADJUSTMENT_REJECTION,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-support-move-apply.js';

const BRANCH = '/SSK/3I/APPLY';
const ADOPTED_AT = '2026-07-28T06:58:00.000Z';
const APPLIED_AT = '2026-07-28T06:59:00.000Z';
function records() {
  return [{
    type: 'BRANCH', name: BRANCH, attributes: { NAME: BRANCH, HPOS: { x: 0, y: 0, z: 0 } },
    children: [
      { type: 'PIPE', name: 'P1', attributes: { NAME: 'P1', APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 1000, y: 0, z: 0 } } },
      { type: 'SUPPORT', name: 'SUPPORT FAMILY', attributes: { NAME: '/PS-1/DATUM', TYPE: 'ATTA', OWNER: BRANCH, POS: { x: 250, y: 0, z: 0 }, CMPSUPTYPE: 'REST' } },
      { type: 'SUPPORT', name: 'SUPPORT FAMILY', attributes: { NAME: '/PS-1.1', TYPE: 'ATTA', OWNER: BRANCH, POS: { x: 250, y: 0, z: 0 }, CMPSUPTYPE: 'SH-100', DTXR: 'PIPE SHOE' } },
      { type: 'CAP', name: 'C1', attributes: { NAME: 'C1', APOS: { x: 1000, y: 0, z: 0 } } },
    ],
  }];
}
function fixture() {
  const source = records();
  const evidence = buildSequentialEvidenceModel(source);
  const indexes = indexSequentialEvidence(evidence);
  const session = runConstructionUntilBlocked(
    createSequentialConstructionSession(BRANCH), evidence, indexes,
    { commandIssuedAt: ADOPTED_AT },
  ).session;
  const confirmedConstruction = createConfirmedSequentialConstruction(session, indexes);
  const supportProjection = buildConfirmedConstructionSupportProjection(confirmedConstruction, indexes, {});
  const branchRegistry = createSequentialBranchWorkspaceRegistry();
  branchRegistry.reset([BRANCH]); branchRegistry.save(BRANCH, { session, confirmedConstruction, supportProjection });
  const sourceFingerprint = `SOURCE-${stableToken(JSON.stringify(source))}`;
  const journalState = createSequentialJournalAdoption({
    documentId: `document:${sourceFingerprint}`, sessionId: `session:${sourceFingerprint}`,
    sourceFingerprint, branchRegistry, adoptedAt: ADOPTED_AT,
  });
  const ownerBridge = createSequentialEngineeringSvgOwnerBridge({
    readOwnerState: () => ({ session, evidenceModel: evidence, indexes,
      confirmedConstruction, supportProjection, visibleProjection: 'ISO' }),
  });
  const baseState = {
    sourceFingerprint, evidence, indexes, session, branchRegistry, journalState,
    confirmedConstruction, supportProjection,
    ownerSnapshot: Object.freeze({
      schema: 'SequentialCommandOwnerRevision.v1', revision: ownerBridge.getSnapshot().revision,
    }),
    engineOptions: {},
  };
  let publications = 0;
  const boundary = createSequentialSupportAdjustmentBoundary({
    readBaseState: () => baseState,
    readBaseOwnerSnapshot: ownerBridge.getSnapshot,
    onPublished: () => { publications += 1; },
  });
  function targetAndPreview(position) {
    const view = boundary.readView();
    const entity = view.scene.entities.find((row) => row.domainRef.category === 'support');
    const target = selectSequentialDraftEditSupportMoveTarget({
      objectId: entity.id, readModel: view.readModel, scene: view.scene,
      currentState: boundary.readCurrentState(),
    });
    const store = createSequentialDraftEditSupportMoveDraftStore();
    const preview = store.stage({
      target, position,
      actorId: 'operator-3i', reason: 'Approved exact same-carrier move.',
      evidenceNote: 'Support and carrier geometry independently checked.',
    });
    return { target, preview, store, entity };
  }
  const service = createSequentialDraftEditSupportMoveApplyService({
    readCurrentState: boundary.readCurrentState,
    publishCandidate: boundary.publishCandidate,
    now: () => APPLIED_AT,
  });
  return { source, evidence, indexes, session, confirmedConstruction, supportProjection,
    journalState, ownerBridge, boundary, targetAndPreview, service,
    publications: () => publications };
}

const left = fixture(); const right = fixture();
const leftInput = left.targetAndPreview({ x: 300, y: 0, z: 0 });
const rightInput = right.targetAndPreview({ x: 300, y: 0, z: 0 });
const leftPrepared = left.service.prepare(leftInput.preview);
const rightPrepared = right.service.prepare(rightInput.preview);
assert.deepEqual(leftPrepared, rightPrepared, 'support adjustment preparation must be deterministic');
assert.equal(left.publications(), 0, 'prepare must not publish');
assert.equal(leftPrepared.candidate.entry.fromPosition.x, 250);
assert.equal(leftPrepared.candidate.entry.toPosition.x, 300);
assert.equal(leftPrepared.candidate.entry.carrierId, leftInput.target.carrierId);
assert.equal(leftPrepared.candidate.entry.appliedAt, APPLIED_AT);
assert.equal(leftPrepared.candidate.entry.resolvedPosition.positionStatus, 'ON_CENTERLINE');
assert.equal(leftPrepared.candidate.supportProjection.supportGlyphs[0].centerlinePointGlobal.x, 300);
assert.equal(left.supportProjection.supportGlyphs[0].centerlinePointGlobal.x, 250);

const sourceBefore = JSON.stringify(left.source);
const evidenceBefore = JSON.stringify(left.evidence);
const sessionBefore = JSON.stringify(left.session);
const confirmedBefore = JSON.stringify(left.confirmedConstruction);
const journalBefore = JSON.stringify(left.journalState);
const editAuthorityBefore = deriveSequentialEditAuthority(left.boundary.readCurrentState()).authorityId;
const readAuthorityBefore = left.boundary.readView().readModel.authorityId;
const accepted = left.service.accept(leftPrepared);
assert.equal(accepted.accepted, true); assert.equal(accepted.publicationState, 'COMMITTED');
assert.equal(left.publications(), 1);
assert.equal(left.boundary.readCurrentState().supportProjection.supportGlyphs[0].centerlinePointGlobal.x, 300);
assert.notEqual(deriveSequentialEditAuthority(left.boundary.readCurrentState()).authorityId, editAuthorityBefore);
assert.notEqual(left.boundary.readView().readModel.authorityId, readAuthorityBefore);
assert.equal(JSON.stringify(left.source), sourceBefore);
assert.equal(JSON.stringify(left.evidence), evidenceBefore);
assert.equal(JSON.stringify(left.session), sessionBefore);
assert.equal(JSON.stringify(left.confirmedConstruction), confirmedBefore);
assert.equal(JSON.stringify(left.journalState), journalBefore);

const staleFixture = fixture();
const staleInput = staleFixture.targetAndPreview({ x: 300, y: 0, z: 0 });
const staleA = staleFixture.service.prepare(staleInput.preview);
const staleB = staleFixture.service.prepare(staleInput.preview);
assert.equal(staleFixture.service.accept(staleA).accepted, true);
const staleResult = staleFixture.service.accept(staleB);
assert.equal(staleResult.accepted, false);
assert.equal(staleResult.reasonCode, SEQUENTIAL_SUPPORT_ADJUSTMENT_REJECTION.AUTHORITY_STALE);
assert.equal(staleFixture.publications(), 1);

for (const row of [
  [{ x: 300, y: 0, z: 10 }, SEQUENTIAL_SUPPORT_ADJUSTMENT_REJECTION.NOT_SAME_CARRIER],
  [{ x: 300, y: 0.0000001, z: 0 }, SEQUENTIAL_SUPPORT_ADJUSTMENT_REJECTION.HIDDEN_SNAP],
]) {
  const test = fixture(); const input = test.targetAndPreview(row[0]);
  assert.throws(() => test.service.prepare(input.preview), (error) => error.code === row[1]);
  assert.equal(test.publications(), 0); test.ownerBridge.destroy();
}

const tamper = fixture();
const exact = tamper.targetAndPreview({ x: 300, y: 0, z: 0 });
assert.throws(() => tamper.service.prepare({
  ...exact.preview,
  target: { ...exact.preview.target, supportMoveTargetId: 'TAMPERED-TARGET' },
}), (error) => error.code === SEQUENTIAL_SUPPORT_ADJUSTMENT_REJECTION.PREVIEW_INVALID);
const canonicalPrepared = tamper.service.prepare(exact.preview);
assert.throws(() => tamper.service.accept({ ...canonicalPrepared, preparedId: 'TAMPERED-PREPARED' }),
  (error) => error.code === SEQUENTIAL_SUPPORT_ADJUSTMENT_REJECTION.PREPARED_INVALID);
assert.equal(tamper.publications(), 0);

for (const test of [left, right, staleFixture, tamper]) test.ownerBridge.destroy();
console.log('Sequential SSK-TS-3I support adjustment prepare and accept: ok');
