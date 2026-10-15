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
  SEQUENTIAL_DRAFT_EDIT_BOUNDARY_REASONS,
  SEQUENTIAL_DRAFT_EDIT_DECISION_REJECTION,
  createSequentialDraftEditDecisionTarget,
  validateSequentialDraftEditDecisionTarget,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-decision-target.js';

const ADOPTED_AT = '2026-07-27T18:55:00.000Z';
const DECISION_ID = 'DECISION-00001';
function records(branchId) {
  return [{
    type: 'BRANCH', name: branchId,
    attributes: { NAME: branchId, HPOS: { x: 0, y: 0, z: 0 } },
    children: [{
      type: 'PIPE', name: 'P1',
      attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } },
    }],
  }];
}
function decision(reason, patch = {}) {
  return Object.freeze({
    schema: 'SequentialConnectionDecision.v1', decisionId: DECISION_ID,
    state: 'OPEN', reason, activePortId: null, candidates: Object.freeze([]),
    resolution: null, decisionScope: 'CONNECTION', junctionId: 'JUNCTION-3D',
    referenceTarget: '/MISSING/TARGET', ...patch,
  });
}
function session(branchId, reason, patch = {}) {
  return freezeConstructionSession({
    ...createEmptyConstructionSession(branchId),
    state: CONSTRUCTION_STATES.USER_DECISION_REQUIRED,
    currentDecisionRequest: decision(reason, patch),
  });
}
function fixture(options = {}) {
  const branchId = options.branchId || '/SSK/3D/BOUNDARY';
  const source = records(branchId);
  const evidence = buildSequentialEvidenceModel(source);
  const indexes = indexSequentialEvidence(evidence);
  const currentSession = options.noDecision
    ? freezeConstructionSession({ ...createEmptyConstructionSession(branchId), state: CONSTRUCTION_STATES.BUILDING })
    : session(branchId, options.reason || 'UNEXPLAINED_TERMINAL', options.decisionPatch);
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
    ownerSnapshot: Object.freeze({ revision: Object.freeze({ schema: 'EngineeringRevisionToken.v1', token: `REV-${branchId}` }) }),
    engineOptions: {},
  };
  return Object.freeze({ readModel, scene, currentState, ownerBridge });
}
function select(test) {
  return createSequentialDraftEditDecisionTarget({
    readModel: test.readModel, scene: test.scene, currentState: test.currentState,
  });
}

for (const reason of SEQUENTIAL_DRAFT_EDIT_BOUNDARY_REASONS) {
  const test = fixture({ reason });
  const target = select(test);
  assert.equal(target.branchId, '/SSK/3D/BOUNDARY');
  assert.equal(target.decisionId, DECISION_ID);
  assert.equal(target.reason, reason);
  assert.equal(target.decisionScope, 'CONNECTION');
  assert.equal(target.junctionId, 'JUNCTION-3D');
  assert.equal(target.referenceTarget, '/MISSING/TARGET');
  assert.match(target.decisionTargetId, /^fnv1a32-canonical-json-v1:SSK3DDECISION:/);
  assert.deepEqual(validateSequentialDraftEditDecisionTarget(target, {
    readModel: test.readModel, scene: test.scene, currentState: test.currentState,
  }), target);
  assert(Object.isFrozen(target));
  test.ownerBridge.destroy();
}

for (const [label, options, code] of [
  ['deferred', { decisionPatch: { state: 'DEFERRED' } }, SEQUENTIAL_DRAFT_EDIT_DECISION_REJECTION.DECISION_DEFERRED],
  ['candidate-bearing', { decisionPatch: { candidates: Object.freeze([{ candidateId: 'CAND-1' }]) } }, SEQUENTIAL_DRAFT_EDIT_DECISION_REJECTION.CANDIDATES_PRESENT],
  ['unsupported reason', { reason: 'AMBIGUOUS_BRANCH_START' }, SEQUENTIAL_DRAFT_EDIT_DECISION_REJECTION.REASON_UNSUPPORTED],
  ['missing decision', { noDecision: true }, SEQUENTIAL_DRAFT_EDIT_DECISION_REJECTION.DECISION_MISSING],
]) {
  const test = fixture(options);
  assert.throws(() => select(test), (error) => error.code === code, label);
  test.ownerBridge.destroy();
}

{
  const current = fixture({ reason: 'UNEXPLAINED_TERMINAL' });
  const changed = fixture({ reason: 'REFERENCE_TARGET_MISSING' });
  assert.throws(() => createSequentialDraftEditDecisionTarget({
    readModel: current.readModel, scene: current.scene, currentState: changed.currentState,
  }), (error) => error.code === SEQUENTIAL_DRAFT_EDIT_DECISION_REJECTION.AUTHORITY_STALE);
  current.ownerBridge.destroy(); changed.ownerBridge.destroy();
}

{
  const current = fixture({ branchId: '/SSK/3D/BOUNDARY/A' });
  const other = fixture({ branchId: '/SSK/3D/BOUNDARY/B' });
  assert.throws(() => createSequentialDraftEditDecisionTarget({
    readModel: current.readModel, scene: current.scene, currentState: other.currentState,
  }), (error) => error.code === SEQUENTIAL_DRAFT_EDIT_DECISION_REJECTION.BRANCH_MISMATCH);
  current.ownerBridge.destroy(); other.ownerBridge.destroy();
}

console.log('Sequential SSK-TS-3D exact boundary decision targeting: ok');
