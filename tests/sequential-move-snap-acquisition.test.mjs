import assert from 'node:assert/strict';
import { createConfirmedSequentialConstruction } from '../tabs/sequential-sketcher/construction/sequential-construction-acceptance.js';
import {
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { createSequentialScopedEditReadModel } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-read-model.js';
import { buildSequentialScopedEditEngineeringScene } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-scene-adapter.js';
import { createSequentialEditableTopologySnapshot } from '../tabs/sequential-sketcher/scoped-edit/sequential-editable-topology-snapshot.js';
import { selectSequentialSingleEntityMoveTarget } from '../tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-target.js';
import {
  acquireSequentialMoveSnapCandidates,
  validateSequentialMoveSnapAcquisition,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-move-snap-acquisition.js';
import { SEQUENTIAL_MOVE_SNAP_MODE } from '../tabs/sequential-sketcher/scoped-edit/sequential-move-snap-contracts.js';
import { createSequentialEngineeringSvgOwnerBridge } from '../tabs/sequential-sketcher/sequential-engineering-svg-owner-bridge.js';
import {
  buildSequentialEvidenceModel,
  indexSequentialEvidence,
} from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';

function context() {
  const branch = '/SNAP/MAIN';
  const records = [{ type: 'BRANCH', name: branch,
    attributes: { NAME: branch, HPOS: { x: 0, y: 0, z: 0 } }, children: [
      { type: 'PIPE', name: 'P1', attributes: {
        APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 },
      } },
      { type: 'PIPE', name: 'P2', attributes: {
        APOS: { x: 100, y: 0, z: 0 }, LPOS: { x: 100, y: 100, z: 0 },
      } },
      { type: 'CAP', name: 'C1', attributes: { APOS: { x: 100, y: 100, z: 0 } } },
    ] }];
  const evidenceModel = buildSequentialEvidenceModel(records);
  const indexes = indexSequentialEvidence(evidenceModel);
  const result = runConstructionUntilBlocked(
    createSequentialConstructionSession(branch), evidenceModel, indexes,
  );
  assert.equal(result.session.state, 'ROUTE_COMPLETE');
  const confirmedConstruction = createConfirmedSequentialConstruction(result.session, indexes);
  const bridge = createSequentialEngineeringSvgOwnerBridge({ readOwnerState: () => ({
    session: result.session, evidenceModel, indexes, confirmedConstruction, visibleProjection: 'ISO',
  }) });
  const readModel = createSequentialScopedEditReadModel(bridge.getSnapshot());
  bridge.destroy();
  const scene = buildSequentialScopedEditEngineeringScene(readModel);
  const snapshot = createSequentialEditableTopologySnapshot(readModel);
  const pipe = snapshot.components.find((row) => row.canonicalType === 'PIPE');
  const handle = snapshot.selectionCandidates.find((row) => row.resolvedComponentId === pipe.componentId);
  const target = selectSequentialSingleEntityMoveTarget({
    objectId: handle.sceneEntityId, readModel, scene,
  });
  return { readModel, scene, target };
}

const current = context();
const profile = {
  enabledModes: [SEQUENTIAL_MOVE_SNAP_MODE.ENDPOINT, SEQUENTIAL_MOVE_SNAP_MODE.MIDPOINT,
    SEQUENTIAL_MOVE_SNAP_MODE.CENTERLINE, SEQUENTIAL_MOVE_SNAP_MODE.AXIS_X,
    SEQUENTIAL_MOVE_SNAP_MODE.AXIS_Y, SEQUENTIAL_MOVE_SNAP_MODE.INTERSECTION],
  aperturePx: 200,
  grid: { enabled: false, origin: { x: 0, y: 0, z: 0 } },
};
const input = {
  ...current, constraint: 'XY', profile,
  rawWorldPoint: { x: 105, y: 40, z: 0 }, rawScreenPoint: { x: 105, y: 40 },
  projectPoint: ([x, y]) => ({ x, y }),
};
const acquisition = acquireSequentialMoveSnapCandidates(input);
assert.equal(acquisition.schema, 'SequentialMoveSnapAcquisition.v1');
assert(acquisition.candidates.length > 0);
assert.equal(acquisition.selectedCandidateId, null);
assert(acquisition.suggestedCandidateId);
assert.equal(acquisition.suggestedCandidateId, acquisition.candidates[0].id);
assert(acquisition.candidates.every((row) => !row.sourceEntityIds
  .some((id) => current.target.geometryPartIds.includes(id))));
assert.deepEqual(acquireSequentialMoveSnapCandidates(input), acquisition,
  'identical authority and view evidence must produce byte-equivalent acquisition');
assert.deepEqual(validateSequentialMoveSnapAcquisition(acquisition, input), acquisition);
const tampered = { ...acquisition, acquisitionFingerprint: 'tampered' };
assert.throws(() => validateSequentialMoveSnapAcquisition(tampered, input),
  (error) => error.code === 'SEQUENTIAL_MOVE_SNAP_ACQUISITION_STALE');
assert(Object.isFrozen(acquisition));

console.log('Sequential move snap acquisition: ok');
