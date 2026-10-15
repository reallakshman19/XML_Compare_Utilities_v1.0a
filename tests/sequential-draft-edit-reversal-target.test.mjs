import assert from 'node:assert/strict';
import { stableToken } from '../tabs/sequential-sketcher/sequential-sketcher-contract.js';
import { createSequentialBranchWorkspaceRegistry } from '../tabs/sequential-sketcher/sequential-branch-workspace-state.js';
import { createSequentialConstructionSession } from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { freezeConstructionSession } from '../tabs/sequential-sketcher/construction/sequential-construction-contract.js';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import { createSequentialEngineeringSvgOwnerBridge } from '../tabs/sequential-sketcher/sequential-engineering-svg-owner-bridge.js';
import { createSequentialJournalAdoption } from '../tabs/sequential-sketcher/scoped-edit/sequential-command-service.js';
import { createSequentialScopedEditReadModel } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-read-model.js';
import { buildSequentialScopedEditEngineeringScene } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-scene-adapter.js';
import {
  SEQUENTIAL_DRAFT_EDIT_REVERSAL_REJECTION,
  selectSequentialDraftEditReversalTarget,
  validateSequentialDraftEditReversalTarget,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-reversal-target.js';

const BRANCH = '/SSK/3G/REVERSAL';
const ADOPTED_AT = '2026-07-28T04:12:00.000Z';
function records() {
  return [{
    type: 'BRANCH', name: BRANCH,
    attributes: { NAME: BRANCH, HPOS: { x: 0, y: 0, z: 0 } },
    children: [{
      type: 'PIPE', name: 'P1',
      attributes: { NAME: 'P1', APOS: { x: -100, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } },
    }],
  }];
}
function decisionSession(component, patch = {}) {
  const initial = createSequentialConstructionSession(BRANCH);
  return freezeConstructionSession({
    ...initial, state: 'USER_DECISION_REQUIRED',
    currentDecisionRequest: Object.freeze({
      schema: 'SequentialConnectionDecision.v1', decisionId: 'DECISION-3G',
      state: 'OPEN', reason: 'AMBIGUOUS_BRANCH_START', candidates: Object.freeze([]),
      resolution: null, branchId: BRANCH, decisionScope: 'COMPONENT_TRAVERSAL',
      componentId: component.componentId, startComponentId: component.componentId,
      entryPortId: null, ...patch,
    }),
  });
}
function fixture(options = {}) {
  const source = records();
  const evidence = buildSequentialEvidenceModel(source);
  const indexes = indexSequentialEvidence(evidence);
  const component = [...indexes.components.values()][0];
  const session = decisionSession(component, options.decisionPatch);
  const branchRegistry = createSequentialBranchWorkspaceRegistry();
  branchRegistry.reset([BRANCH]); branchRegistry.save(BRANCH, { session });
  const sourceFingerprint = `SOURCE-${stableToken(JSON.stringify(source))}`;
  const journalState = createSequentialJournalAdoption({
    documentId: `document:${sourceFingerprint}`, sessionId: `session:${sourceFingerprint}`,
    sourceFingerprint, branchRegistry, adoptedAt: ADOPTED_AT,
  });
  const ownerBridge = createSequentialEngineeringSvgOwnerBridge({
    readOwnerState: () => ({
      session, evidenceModel: evidence, indexes,
      confirmedConstruction: null, supportProjection: null, visibleProjection: 'ISO',
    }),
  });
  const readModel = createSequentialScopedEditReadModel(ownerBridge.getSnapshot());
  const scene = buildSequentialScopedEditEngineeringScene(readModel);
  const currentState = {
    sourceFingerprint, evidence, indexes, session, branchRegistry, journalState,
    confirmedConstruction: null, supportProjection: null,
    ownerSnapshot: Object.freeze({
      revision: Object.freeze({ schema: 'EngineeringRevisionToken.v1', token: 'REV-3G' }),
    }),
    engineOptions: {},
  };
  const entity = scene.entities.find((row) => row.domainRef.category === 'reversalCandidate');
  return { component, indexes, session, readModel, scene, currentState, ownerBridge, entity };
}
function select(test, patch = {}) {
  return selectSequentialDraftEditReversalTarget({
    objectId: test.entity.id, readModel: test.readModel, scene: test.scene,
    currentState: test.currentState, ...patch,
  });
}

{
  const test = fixture();
  const target = select(test);
  assert.equal(target.branchId, BRANCH);
  assert.equal(target.decisionId, 'DECISION-3G');
  assert.equal(target.entityId, test.entity.id);
  assert.equal(target.candidateId, test.entity.domainRef.candidateId);
  assert.equal(target.componentId, test.component.componentId);
  assert.equal(target.entryPortId, test.entity.domainRef.entryPortId);
  assert.deepEqual(target.sourcePosition, test.entity.geometry.position);
  assert.match(target.reversalTargetId, /^fnv1a32-canonical-json-v1:SSK3DREVERSAL:/);
  assert.deepEqual(validateSequentialDraftEditReversalTarget(target, {
    readModel: test.readModel, scene: test.scene, currentState: test.currentState,
  }), target);
  assert(Object.isFrozen(target));
  test.ownerBridge.destroy();
}

{
  const test = fixture();
  assert.throws(() => selectSequentialDraftEditReversalTarget({
    objectId: 'ssk:missing:reversal', readModel: test.readModel,
    scene: test.scene, currentState: test.currentState,
  }), (error) => error.code === SEQUENTIAL_DRAFT_EDIT_REVERSAL_REJECTION.ENTITY_MISSING);
  test.ownerBridge.destroy();
}

{
  const current = fixture();
  const changed = fixture({ decisionPatch: { decisionId: 'DECISION-3G-CHANGED' } });
  assert.throws(() => selectSequentialDraftEditReversalTarget({
    objectId: current.entity.id, readModel: current.readModel,
    scene: current.scene, currentState: changed.currentState,
  }), (error) => error.code === SEQUENTIAL_DRAFT_EDIT_REVERSAL_REJECTION.AUTHORITY_STALE);
  current.ownerBridge.destroy(); changed.ownerBridge.destroy();
}

{
  const test = fixture({ decisionPatch: { state: 'DEFERRED' } });
  assert.throws(() => select(test),
    (error) => error.code === SEQUENTIAL_DRAFT_EDIT_REVERSAL_REJECTION.DECISION_MISSING);
  test.ownerBridge.destroy();
}

{
  const test = fixture();
  const target = select(test);
  const ports = new Map(test.currentState.indexes.ports);
  ports.delete(target.entryPortId);
  const staleState = { ...test.currentState, indexes: { ...test.currentState.indexes, ports } };
  assert.throws(() => validateSequentialDraftEditReversalTarget(target, {
    readModel: test.readModel, scene: test.scene, currentState: staleState,
  }), (error) => [
    SEQUENTIAL_DRAFT_EDIT_REVERSAL_REJECTION.ENTRY_PORT_MISMATCH,
    SEQUENTIAL_DRAFT_EDIT_REVERSAL_REJECTION.AUTHORITY_STALE,
  ].includes(error.code));
  test.ownerBridge.destroy();
}

console.log('Sequential SSK-TS-3G exact reversal target authority: ok');