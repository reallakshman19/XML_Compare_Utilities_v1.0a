import assert from 'node:assert/strict';
import { createConfirmedSequentialConstruction } from '../tabs/sequential-sketcher/construction/sequential-construction-acceptance.js';
import {
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { createSequentialEditableTopologySnapshot } from '../tabs/sequential-sketcher/scoped-edit/sequential-editable-topology-snapshot.js';
import { createSequentialScopedEditReadModel } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-read-model.js';
import { buildSequentialScopedEditEngineeringScene } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-scene-adapter.js';
import {
  selectSequentialSingleEntityMoveTarget,
  validateSequentialSingleEntityMoveTarget,
  SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_REJECTION,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-target.js';
import { createSequentialEngineeringSvgOwnerBridge } from '../tabs/sequential-sketcher/sequential-engineering-svg-owner-bridge.js';
import {
  buildSequentialEvidenceModel,
  indexSequentialEvidence,
} from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import { repairedSequentialFixture } from './helpers/sequential-engineering-svg-fixture.js';

function completeFixture(records, branchId, options = {}) {
  const evidenceModel = buildSequentialEvidenceModel(records);
  const indexes = indexSequentialEvidence(evidenceModel);
  const result = runConstructionUntilBlocked(
    createSequentialConstructionSession(branchId), evidenceModel, indexes, options,
  );
  assert.equal(result.session.state, 'ROUTE_COMPLETE');
  return {
    evidenceModel, indexes, session: result.session,
    confirmedConstruction: createConfirmedSequentialConstruction(result.session, indexes),
  };
}
function readModel(fixture) {
  const bridge = createSequentialEngineeringSvgOwnerBridge({ readOwnerState: () => ({
    session: fixture.session,
    evidenceModel: fixture.evidenceModel,
    indexes: fixture.indexes,
    confirmedConstruction: fixture.confirmedConstruction,
    visibleProjection: 'ISO',
  }) });
  const model = createSequentialScopedEditReadModel(bridge.getSnapshot());
  bridge.destroy();
  return model;
}
function teeFixture() {
  const main = '/MOVE/TEE/MAIN'; const side = '/MOVE/TEE/SIDE';
  return completeFixture([
    { type: 'BRANCH', name: main, attributes: { NAME: main, HPOS: { x: 0, y: 0, z: 0 } }, children: [
      { type: 'PIPE', name: 'P1', attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } } },
      { type: 'TEE', name: 'T1', attributes: { APOS: { x: 100, y: 0, z: 0 }, POS: { x: 120, y: 0, z: 0 }, LPOS: { x: 140, y: 0, z: 0 }, BPOS: { x: 120, y: 20, z: 0 }, CREF: side } },
      { type: 'CAP', name: 'C1', attributes: { APOS: { x: 140, y: 0, z: 0 } } },
    ] },
    { type: 'BRANCH', name: side, attributes: { NAME: side, HPOS: { x: 120, y: 20, z: 0 } }, children: [
      { type: 'PIPE', name: 'SP1', attributes: { APOS: { x: 120, y: 20, z: 0 }, LPOS: { x: 120, y: 80, z: 0 } } },
      { type: 'CAP', name: 'SC1', attributes: { APOS: { x: 120, y: 80, z: 0 } } },
    ] },
  ], main);
}
function targetContext(fixture) {
  const model = readModel(fixture);
  return { model, scene: buildSequentialScopedEditEngineeringScene(model) };
}

const teeContext = targetContext(teeFixture());
const snapshot = createSequentialEditableTopologySnapshot(teeContext.model);
const tee = snapshot.components.find((row) => row.canonicalType === 'TEE');
const handles = snapshot.selectionCandidates
  .filter((row) => row.resolvedComponentId === tee.componentId)
  .map((row) => row.sceneEntityId).sort();
assert.equal(handles.length, 2);
const runTarget = selectSequentialSingleEntityMoveTarget({
  objectId: handles[0], readModel: teeContext.model, scene: teeContext.scene,
});
const branchTarget = selectSequentialSingleEntityMoveTarget({
  objectId: handles[1], readModel: teeContext.model, scene: teeContext.scene,
});
assert.equal(runTarget.componentId, tee.componentId);
assert.equal(branchTarget.componentId, tee.componentId);
assert.equal(runTarget.moveTargetId, branchTarget.moveTargetId,
  'tee run and branch handles must resolve to one whole-component target identity');
assert.equal(runTarget.geometryParts.length, 2);
assert.deepEqual([...runTarget.geometryPartIds].sort(), handles);
assert(runTarget.boundaryCuts.length > 0);
assert.equal(runTarget.rigidMoveEligible, false);
assert.equal(runTarget.previewDisposition, 'BOUNDARY_DISCONNECTION_REVIEW_REQUIRED');
assert(Object.isFrozen(runTarget));
assert.deepEqual(validateSequentialSingleEntityMoveTarget(runTarget, {
  readModel: teeContext.model, scene: teeContext.scene,
}), runTarget);

const stale = { ...teeContext.model, sessionFingerprint: 'stale-session' };
assert.throws(
  () => validateSequentialSingleEntityMoveTarget(runTarget, {
    readModel: stale, scene: teeContext.scene,
  }),
  /differs from independent owner-snapshot regeneration|differs from current topology authority/,
);
assert.throws(
  () => selectSequentialSingleEntityMoveTarget({
    objectId: 'missing-part', readModel: teeContext.model, scene: teeContext.scene,
  }),
  (error) => error.code === SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_REJECTION.TARGET_NOT_FOUND,
);

const repairContext = targetContext(repairedSequentialFixture());
const repairSnapshot = createSequentialEditableTopologySnapshot(repairContext.model);
const lockedComponentId = repairSnapshot.eligibility.find((row) => (
  row.targetKind === 'COMPONENT' && row.locks.includes('LOCKED_CANDIDATE_OR_REPAIR')
))?.componentId;
const lockedHandle = repairSnapshot.selectionCandidates
  .find((row) => row.resolvedComponentId === lockedComponentId)?.sceneEntityId;
assert(lockedHandle);
assert.throws(
  () => selectSequentialSingleEntityMoveTarget({
    objectId: lockedHandle, readModel: repairContext.model, scene: repairContext.scene,
  }),
  (error) => error.code === SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_REJECTION.TARGET_LOCKED,
);

console.log('Sequential single-entity move target: ok');
