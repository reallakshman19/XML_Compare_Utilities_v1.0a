import assert from 'node:assert/strict';
import { stableToken } from '../tabs/sequential-sketcher/sequential-sketcher-contract.js';
import { createSequentialBranchWorkspaceRegistry } from '../tabs/sequential-sketcher/sequential-branch-workspace-state.js';
import {
  CONSTRUCTION_STATES,
  createEmptyConstructionSession,
  freezeConstructionSession,
} from '../tabs/sequential-sketcher/construction/sequential-construction-contract.js';
import {
  buildSequentialEvidenceModel,
  indexSequentialEvidence,
} from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import { createSequentialEngineeringSvgOwnerBridge } from '../tabs/sequential-sketcher/sequential-engineering-svg-owner-bridge.js';
import { createSequentialJournalAdoption } from '../tabs/sequential-sketcher/scoped-edit/sequential-command-service.js';
import { createSequentialScopedEditReadModel } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-read-model.js';
import { buildSequentialScopedEditEngineeringScene } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-scene-adapter.js';
import {
  SEQUENTIAL_DRAFT_EDIT_TARGET_REJECTION,
  selectSequentialDraftEditCandidateTarget,
  validateSequentialDraftEditCandidateTarget,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-target-selection.js';

const BRANCH_ID = '/SSK/3C/TARGET';
const CANDIDATE_ID = 'CANDIDATE-3C-001';
const DECISION_ID = 'DECISION-00001';
const ADOPTED_AT = '2026-07-27T18:30:00.000Z';

function records(branchId = BRANCH_ID) {
  return [{
    type: 'BRANCH', name: branchId,
    attributes: { NAME: branchId, HPOS: { x: 0, y: 0, z: 0 } },
    children: [{
      type: 'PIPE', name: 'P1',
      attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } },
    }],
  }];
}
function candidate() {
  return Object.freeze({
    candidateId: CANDIDATE_ID,
    fromPortId: `${BRANCH_ID}/P1:LPOS`, toPortId: '/TARGET/P9:APOS',
    fromPosition: Object.freeze({ x: 100, y: 0, z: 0 }),
    toPosition: Object.freeze({ x: 120, y: 0, z: 0 }),
    targetPortId: `${BRANCH_ID}/P1:LPOS`, connectedPortId: '/TARGET/P9:APOS',
    targetPosition: Object.freeze({ x: 100, y: 0, z: 0 }),
    connectedPosition: Object.freeze({ x: 120, y: 0, z: 0 }),
  });
}
function session(branchId, evidence) {
  const component = evidence.branches[0].components[0];
  const positioned = component.ports.filter((port) => port.sourcePosition);
  const entry = positioned[0]; const exit = positioned.at(-1);
  return freezeConstructionSession({
    ...createEmptyConstructionSession(branchId),
    state: CONSTRUCTION_STATES.USER_DECISION_REQUIRED,
    activeComponentId: component.componentId,
    activeEntryPortId: entry.portId,
    activeExitPortId: exit.portId,
    confirmedComponentIds: [component.componentId],
    strokeLedger: [Object.freeze({
      op: 'DRAW_PIPE', componentId: component.componentId,
      entryPosition: entry.sourcePosition, exitPosition: exit.sourcePosition,
    })],
    currentDecisionRequest: Object.freeze({
      schema: 'SequentialConnectionDecision.v1', decisionId: DECISION_ID,
      state: 'OPEN', reason: 'AMBIGUOUS_CONNECTION', activePortId: exit.portId,
      candidates: Object.freeze([candidate()]), resolution: null, decisionScope: 'CONNECTION',
    }),
  });
}
function fixture(branchId = BRANCH_ID) {
  const source = records(branchId);
  const evidence = buildSequentialEvidenceModel(source);
  const indexes = indexSequentialEvidence(evidence);
  const currentSession = session(branchId, evidence);
  const branchRegistry = createSequentialBranchWorkspaceRegistry();
  branchRegistry.reset([branchId]); branchRegistry.save(branchId, { session: currentSession });
  const sourceFingerprint = `SOURCE-${stableToken(JSON.stringify(source))}`;
  const journalState = createSequentialJournalAdoption({
    documentId: `document:${sourceFingerprint}`, sessionId: `session:${sourceFingerprint}`,
    sourceFingerprint, branchRegistry, adoptedAt: ADOPTED_AT,
  });
  const ownerBridge = createSequentialEngineeringSvgOwnerBridge({
    readOwnerState: () => ({
      session: currentSession, evidence, indexes,
      confirmedConstruction: null, supportProjection: null, visibleProjection: 'ISO',
    }),
  });
  const readModel = createSequentialScopedEditReadModel(ownerBridge.getSnapshot());
  const scene = buildSequentialScopedEditEngineeringScene(readModel);
  const currentState = {
    sourceFingerprint, evidence, indexes, session: currentSession, branchRegistry, journalState,
    confirmedConstruction: null, supportProjection: null,
    ownerSnapshot: Object.freeze({ revision: Object.freeze({ schema: 'EngineeringRevisionToken.v1', token: 'REV-3C' }) }),
    engineOptions: {},
  };
  return Object.freeze({ readModel, scene, currentState, ownerBridge, evidence });
}

{
  const test = fixture();
  const target = selectSequentialDraftEditCandidateTarget({
    objectId: `ssk:candidate:${CANDIDATE_ID}`,
    readModel: test.readModel, scene: test.scene, currentState: test.currentState,
  });
  assert.equal(target.branchId, BRANCH_ID);
  assert.equal(target.decisionId, DECISION_ID);
  assert.equal(target.candidateId, CANDIDATE_ID);
  assert.equal(target.entityId, `ssk:candidate:${CANDIDATE_ID}`);
  assert.match(target.targetSelectionId, /^fnv1a32-canonical-json-v1:SSK3DTARGET:/);
  assert.deepEqual(validateSequentialDraftEditCandidateTarget(target, {
    readModel: test.readModel, scene: test.scene, currentState: test.currentState,
  }), target);
  assert(Object.isFrozen(target));
  test.ownerBridge.destroy();
}

{
  const test = fixture();
  const componentId = test.scene.entities.find((row) => row.domainRef.category === 'confirmed')?.id;
  assert(componentId, 'fixture must contain one certified non-candidate scene entity');
  assert.throws(() => selectSequentialDraftEditCandidateTarget({
    objectId: componentId, readModel: test.readModel, scene: test.scene, currentState: test.currentState,
  }), (error) => error.code === SEQUENTIAL_DRAFT_EDIT_TARGET_REJECTION.ENTITY_NOT_CANDIDATE);
  test.ownerBridge.destroy();
}

{
  const test = fixture();
  assert.throws(() => selectSequentialDraftEditCandidateTarget({
    objectId: 'ssk:candidate:NOT-CURRENT',
    readModel: test.readModel, scene: test.scene, currentState: test.currentState,
  }), (error) => error.code === SEQUENTIAL_DRAFT_EDIT_TARGET_REJECTION.ENTITY_MISSING);
  test.ownerBridge.destroy();
}

{
  const test = fixture();
  const staleSession = freezeConstructionSession({
    ...test.currentState.session,
    deferredDecisionIds: [DECISION_ID],
  });
  assert.throws(() => selectSequentialDraftEditCandidateTarget({
    objectId: `ssk:candidate:${CANDIDATE_ID}`,
    readModel: test.readModel, scene: test.scene,
    currentState: { ...test.currentState, session: staleSession },
  }), (error) => error.code === SEQUENTIAL_DRAFT_EDIT_TARGET_REJECTION.AUTHORITY_STALE);
  test.ownerBridge.destroy();
}

{
  const test = fixture();
  const otherEvidence = buildSequentialEvidenceModel(records('/OTHER/BRANCH'));
  assert.throws(() => selectSequentialDraftEditCandidateTarget({
    objectId: `ssk:candidate:${CANDIDATE_ID}`,
    readModel: test.readModel, scene: test.scene,
    currentState: { ...test.currentState, session: session('/OTHER/BRANCH', otherEvidence) },
  }), (error) => error.code === SEQUENTIAL_DRAFT_EDIT_TARGET_REJECTION.BRANCH_MISMATCH);
  test.ownerBridge.destroy();
}

console.log('Sequential SSK-TS-3C exact Draft Edit candidate targeting: ok');
