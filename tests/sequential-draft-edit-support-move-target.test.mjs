import assert from 'node:assert/strict';
import { stableToken } from '../tabs/sequential-sketcher/sequential-sketcher-contract.js';
import { createSequentialBranchWorkspaceRegistry } from '../tabs/sequential-sketcher/sequential-branch-workspace-state.js';
import {
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { createConfirmedSequentialConstruction } from '../tabs/sequential-sketcher/construction/sequential-construction-acceptance.js';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import { buildConfirmedConstructionSupportProjection } from '../tabs/sequential-sketcher/support/sequential-confirmed-support-projection.js';
import { createSequentialEngineeringSvgOwnerBridge } from '../tabs/sequential-sketcher/sequential-engineering-svg-owner-bridge.js';
import { createSequentialJournalAdoption } from '../tabs/sequential-sketcher/scoped-edit/sequential-command-service.js';
import { createSequentialScopedEditReadModel } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-read-model.js';
import { buildSequentialScopedEditEngineeringScene } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-scene-adapter.js';
import {
  SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_REJECTION,
  selectSequentialDraftEditSupportMoveTarget,
  validateSequentialDraftEditSupportMoveTarget,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-support-move-target.js';

const BRANCH = '/SSK/3H/SUPPORT';
const ADOPTED_AT = '2026-07-28T05:40:00.000Z';
function records() {
  return [{
    type: 'BRANCH', name: BRANCH,
    attributes: { NAME: BRANCH, HPOS: { x: 0, y: 0, z: 0 } },
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
    createSequentialConstructionSession(BRANCH), evidence, indexes, { commandIssuedAt: ADOPTED_AT },
  ).session;
  const confirmedConstruction = createConfirmedSequentialConstruction(session, indexes);
  const supportProjection = buildConfirmedConstructionSupportProjection(confirmedConstruction, indexes, {});
  const branchRegistry = createSequentialBranchWorkspaceRegistry();
  branchRegistry.reset([BRANCH]); branchRegistry.save(BRANCH, { session });
  const sourceFingerprint = `SOURCE-${stableToken(JSON.stringify(source))}`;
  const journalState = createSequentialJournalAdoption({
    documentId: `document:${sourceFingerprint}`, sessionId: `session:${sourceFingerprint}`,
    sourceFingerprint, branchRegistry, adoptedAt: ADOPTED_AT,
  });
  const ownerBridge = createSequentialEngineeringSvgOwnerBridge({
    readOwnerState: () => ({
      session, evidenceModel: evidence, indexes, confirmedConstruction,
      supportProjection, visibleProjection: 'ISO',
    }),
  });
  const readModel = createSequentialScopedEditReadModel(ownerBridge.getSnapshot());
  const scene = buildSequentialScopedEditEngineeringScene(readModel);
  const currentState = {
    sourceFingerprint, evidence, indexes, session, branchRegistry, journalState,
    confirmedConstruction, supportProjection,
    ownerSnapshot: Object.freeze({
      revision: Object.freeze({ schema: 'EngineeringRevisionToken.v1', token: 'REV-3H' }),
    }),
    engineOptions: {},
  };
  const entity = scene.entities.find((row) => row.domainRef.category === 'support');
  return { ownerBridge, readModel, scene, currentState, entity, supportProjection };
}
function select(test, patch = {}) {
  return selectSequentialDraftEditSupportMoveTarget({
    objectId: test.entity.id, readModel: test.readModel,
    scene: test.scene, currentState: test.currentState, ...patch,
  });
}

{
  const test = fixture();
  const target = select(test);
  assert.equal(target.entityId, test.entity.id);
  assert.equal(target.supportId, test.entity.domainRef.supportId);
  assert.equal(target.familyId, test.entity.domainRef.familyId);
  assert.equal(target.carrierId, test.entity.domainRef.carrierId);
  assert.deepEqual(target.originalPosition, test.entity.geometry.position);
  assert.deepEqual(test.entity.editCapabilities, ['MOVE_DRAFT']);
  assert.match(target.supportMoveTargetId, /^fnv1a32-canonical-json-v1:SSK3DSUPPORTMOVE:/);
  assert.deepEqual(validateSequentialDraftEditSupportMoveTarget(target, {
    readModel: test.readModel, scene: test.scene, currentState: test.currentState,
  }), target);
  assert(Object.isFrozen(target));
  test.ownerBridge.destroy();
}

{
  const test = fixture();
  const component = test.scene.entities.find((row) => row.domainRef.category === 'confirmed');
  assert.throws(() => selectSequentialDraftEditSupportMoveTarget({
    objectId: component.id, readModel: test.readModel,
    scene: test.scene, currentState: test.currentState,
  }), (error) => error.code === SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_REJECTION.ENTITY_NOT_SUPPORT);
  test.ownerBridge.destroy();
}

for (const mutate of [
  (projection) => ({ ...projection, supportGlyphs: [] }),
  (projection) => ({
    ...projection,
    supportGlyphs: projection.supportGlyphs.map((glyph) => ({ ...glyph, carrierId: `${glyph.carrierId}-OTHER` })),
  }),
  (projection) => ({
    ...projection,
    supportGlyphs: projection.supportGlyphs.map((glyph) => ({
      ...glyph, centerlinePointGlobal: { ...glyph.centerlinePointGlobal, z: glyph.centerlinePointGlobal.z + 5 },
    })),
  }),
]) {
  const test = fixture();
  const stale = { ...test.currentState, supportProjection: mutate(test.supportProjection) };
  assert.throws(() => selectSequentialDraftEditSupportMoveTarget({
    objectId: test.entity.id, readModel: test.readModel, scene: test.scene, currentState: stale,
  }), (error) => [
    SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_REJECTION.SUPPORT_MISSING,
    SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_REJECTION.SUPPORT_MISMATCH,
  ].includes(error.code));
  test.ownerBridge.destroy();
}

{
  const test = fixture();
  const target = select(test);
  const stale = {
    ...test.currentState,
    ownerSnapshot: Object.freeze({
      revision: Object.freeze({ schema: 'EngineeringRevisionToken.v1', token: 'REV-3H-STALE' }),
    }),
  };
  assert.throws(() => validateSequentialDraftEditSupportMoveTarget(target, {
    readModel: test.readModel, scene: test.scene, currentState: stale,
  }), (error) => error.code === SEQUENTIAL_DRAFT_EDIT_SUPPORT_MOVE_REJECTION.AUTHORITY_STALE);
  test.ownerBridge.destroy();
}

console.log('Sequential SSK-TS-3H exact support move target: ok');
