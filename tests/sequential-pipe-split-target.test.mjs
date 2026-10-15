import assert from 'node:assert/strict';
import { createConfirmedSequentialConstruction } from '../tabs/sequential-sketcher/construction/sequential-construction-acceptance.js';
import { createSequentialConstructionSession,
  runConstructionUntilBlocked } from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { buildSequentialEvidenceModel,
  indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import { createSequentialEngineeringSvgOwnerBridge } from '../tabs/sequential-sketcher/sequential-engineering-svg-owner-bridge.js';
import { createSequentialScopedEditReadModel } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-read-model.js';
import { buildSequentialScopedEditEngineeringScene } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-scene-adapter.js';
import { createSequentialEditableTopologySnapshot } from '../tabs/sequential-sketcher/scoped-edit/sequential-editable-topology-snapshot.js';
import { selectSequentialPipeSplitTarget,
  validateSequentialPipeSplitTarget,
  SEQUENTIAL_PIPE_SPLIT_TARGET_REJECTION } from '../tabs/sequential-sketcher/scoped-edit/sequential-pipe-split-target.js';
import { confirmedSupportSequentialFixture,
  repairedSequentialFixture } from './helpers/sequential-engineering-svg-fixture.js';

function complete(records, branchId) {
  const evidenceModel = buildSequentialEvidenceModel(records);
  const indexes = indexSequentialEvidence(evidenceModel);
  const result = runConstructionUntilBlocked(
    createSequentialConstructionSession(branchId), evidenceModel, indexes,
  );
  assert.equal(result.session.state, 'ROUTE_COMPLETE');
  return { evidenceModel, indexes, session: result.session,
    confirmedConstruction: createConfirmedSequentialConstruction(result.session, indexes) };
}
function authority(fixture) {
  const bridge = createSequentialEngineeringSvgOwnerBridge({ readOwnerState: () => ({
    session: fixture.session, evidenceModel: fixture.evidenceModel, indexes: fixture.indexes,
    confirmedConstruction: fixture.confirmedConstruction,
    supportProjection: fixture.supportProjection || null, visibleProjection: 'ISO',
  }) });
  const readModel = createSequentialScopedEditReadModel(bridge.getSnapshot());
  const scene = buildSequentialScopedEditEngineeringScene(readModel);
  const topology = createSequentialEditableTopologySnapshot(readModel);
  return { bridge, readModel, scene, topology };
}
function handle(topology, componentId) {
  return topology.selectionCandidates
    .find((row) => row.resolvedComponentId === componentId)?.sceneEntityId;
}

const branch = '/SPLIT/TARGET';
const base = authority(complete([{ type: 'BRANCH', name: branch,
  attributes: { NAME: branch, HPOS: { x: 0, y: 0, z: 0 } }, children: [
    { type: 'PIPE', name: 'P1', attributes: {
      APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 },
    } },
    { type: 'CAP', name: 'C1', attributes: { APOS: { x: 100, y: 0, z: 0 } } },
  ] }], branch));
const pipe = base.topology.components.find((row) => row.canonicalType === 'PIPE');
const target = selectSequentialPipeSplitTarget({ objectId: handle(base.topology, pipe.componentId),
  readModel: base.readModel, scene: base.scene });
assert.equal(target.parentComponentId, pipe.componentId);
assert.equal(target.canonicalType, 'PIPE');
assert.equal(target.parentGeometryPart.geometry.kind, 'segment');
assert.equal(target.portIds.length, 2);
assert.equal(target.nodeIds.length, 2);
assert.deepEqual(validateSequentialPipeSplitTarget(target, {
  readModel: base.readModel, scene: base.scene }), target);
assert(Object.isFrozen(target));
assert.throws(() => validateSequentialPipeSplitTarget({ ...target,
  geometryFingerprint: 'TAMPERED' }, { readModel: base.readModel, scene: base.scene }),
(error) => error.code === SEQUENTIAL_PIPE_SPLIT_TARGET_REJECTION.TARGET_STALE);
const cap = base.topology.components.find((row) => row.canonicalType === 'CAP');
assert.throws(() => selectSequentialPipeSplitTarget({ objectId: handle(base.topology, cap.componentId),
  readModel: base.readModel, scene: base.scene }),
(error) => error.code === SEQUENTIAL_PIPE_SPLIT_TARGET_REJECTION.COMPONENT_INVALID);
base.bridge.destroy();

const supported = authority(confirmedSupportSequentialFixture());
const carrier = supported.topology.supportAttachments[0]?.carrierId;
assert(carrier, 'support fixture must expose one certified carrier');
assert.throws(() => selectSequentialPipeSplitTarget({ objectId: handle(supported.topology, carrier),
  readModel: supported.readModel, scene: supported.scene }),
(error) => error.code === SEQUENTIAL_PIPE_SPLIT_TARGET_REJECTION.SUPPORT_ATTACHED);
supported.bridge.destroy();

const repaired = authority(repairedSequentialFixture());
const repairNode = repaired.topology.nodes.find((row) => row.boundaryClass === 'REPAIR_BOUNDARY');
const repairedPipe = repaired.topology.components.find((row) => row.canonicalType === 'PIPE'
  && row.nodeIds.includes(repairNode?.nodeId));
assert(repairedPipe, 'repair fixture must expose a pipe at the repair boundary');
assert.throws(() => selectSequentialPipeSplitTarget({ objectId: handle(repaired.topology,
  repairedPipe.componentId), readModel: repaired.readModel, scene: repaired.scene }),
(error) => error.code === SEQUENTIAL_PIPE_SPLIT_TARGET_REJECTION.REPAIR_BOUNDARY);
repaired.bridge.destroy();

console.log('Sequential pipe split target: ok');
