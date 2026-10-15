import assert from 'node:assert/strict';
import { createConfirmedSequentialConstruction } from '../tabs/sequential-sketcher/construction/sequential-construction-acceptance.js';
import { createSequentialConstructionSession, runConstructionUntilBlocked } from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import { createSequentialEngineeringSvgOwnerBridge } from '../tabs/sequential-sketcher/sequential-engineering-svg-owner-bridge.js';
import { createSequentialScopedEditReadModel } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-read-model.js';
import { buildSequentialScopedEditEngineeringScene } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-scene-adapter.js';
import { createSequentialEditableTopologySnapshot } from '../tabs/sequential-sketcher/scoped-edit/sequential-editable-topology-snapshot.js';
import { SEQUENTIAL_ROTATION_SCOPE, selectSequentialRotationTarget,
  validateSequentialRotationTarget } from '../tabs/sequential-sketcher/scoped-edit/sequential-rotation-target.js';

const BRANCH = '/ROTATION/TARGET';
const records = [{ type: 'BRANCH', name: BRANCH,
  attributes: { NAME: BRANCH, HPOS: { x: 0, y: 0, z: 0 } }, children: [
    { type: 'PIPE', name: 'P1', attributes: {
      APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 },
    } },
    { type: 'CAP', name: 'C1', attributes: { APOS: { x: 100, y: 0, z: 0 } } },
  ] }];
const evidenceModel = buildSequentialEvidenceModel(records);
const indexes = indexSequentialEvidence(evidenceModel);
const result = runConstructionUntilBlocked(
  createSequentialConstructionSession(BRANCH), evidenceModel, indexes,
);
assert.equal(result.session.state, 'ROUTE_COMPLETE');
const confirmedConstruction = createConfirmedSequentialConstruction(result.session, indexes);
const bridge = createSequentialEngineeringSvgOwnerBridge({ readOwnerState: () => ({
  session: result.session, evidenceModel, indexes, confirmedConstruction, visibleProjection: 'ISO',
}) });
const readModel = createSequentialScopedEditReadModel(bridge.getSnapshot());
const scene = buildSequentialScopedEditEngineeringScene(readModel);
const topology = createSequentialEditableTopologySnapshot(readModel);
const pipe = topology.components.find((row) => row.canonicalType === 'PIPE');
const handle = topology.selectionCandidates.find((row) => row.resolvedComponentId === pipe.componentId)
  .sceneEntityId;
const component = selectSequentialRotationTarget({ objectId: handle,
  scope: SEQUENTIAL_ROTATION_SCOPE.COMPONENT_ONLY, readModel, scene });
assert.deepEqual(component.affectedComponentIds, [pipe.componentId]);
assert(component.geometryParts.every((row) => row.nodeIds.length));
assert.deepEqual(validateSequentialRotationTarget(component, { readModel, scene }), component);
const subgraph = selectSequentialRotationTarget({ objectId: handle,
  scope: SEQUENTIAL_ROTATION_SCOPE.CONNECTED_SUBGRAPH, readModel, scene });
assert(subgraph.affectedComponentIds.includes(pipe.componentId));
assert(subgraph.affectedComponentIds.length >= component.affectedComponentIds.length);
assert.equal(subgraph.rotationTargetId,
  selectSequentialRotationTarget({ objectId: handle,
    scope: SEQUENTIAL_ROTATION_SCOPE.CONNECTED_SUBGRAPH, readModel, scene }).rotationTargetId);
assert(Object.isFrozen(subgraph));
assert.throws(() => selectSequentialRotationTarget({ objectId: handle,
  scope: 'INVALID', readModel, scene }),
(error) => error.code === 'SEQUENTIAL_ROTATION_SCOPE_INVALID');
bridge.destroy();
console.log('Sequential rotation target: ok');
