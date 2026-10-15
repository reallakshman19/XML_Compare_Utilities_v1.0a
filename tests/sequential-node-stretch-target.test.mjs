import assert from 'node:assert/strict';
import { createConfirmedSequentialConstruction } from '../tabs/sequential-sketcher/construction/sequential-construction-acceptance.js';
import { createSequentialConstructionSession, runConstructionUntilBlocked } from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import { createSequentialEngineeringSvgOwnerBridge } from '../tabs/sequential-sketcher/sequential-engineering-svg-owner-bridge.js';
import { createSequentialScopedEditReadModel } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-read-model.js';
import { buildSequentialScopedEditEngineeringScene } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-scene-adapter.js';
import { createSequentialEditableTopologySnapshot } from '../tabs/sequential-sketcher/scoped-edit/sequential-editable-topology-snapshot.js';
import { selectSequentialNodeStretchComponent, createSequentialNodeStretchTarget,
  validateSequentialNodeStretchTarget } from '../tabs/sequential-sketcher/scoped-edit/sequential-node-stretch-target.js';

const BRANCH = '/STRETCH/TARGET';
const records = [{ type: 'BRANCH', name: BRANCH,
  attributes: { NAME: BRANCH, HPOS: { x: 0, y: 0, z: 0 } }, children: [
    { type: 'PIPE', name: 'P1', attributes: {
      APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 },
    } },
    { type: 'CAP', name: 'C1', attributes: { APOS: { x: 100, y: 0, z: 0 } } },
  ] }];
const evidenceModel = buildSequentialEvidenceModel(records);
const indexes = indexSequentialEvidence(evidenceModel);
const result = runConstructionUntilBlocked(createSequentialConstructionSession(BRANCH), evidenceModel, indexes);
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
const selection = selectSequentialNodeStretchComponent({ objectId: handle, readModel, scene });
assert.equal(selection.componentId, pipe.componentId);
assert(selection.nodes.length >= 1);
assert(selection.nodes.every((row) => row.portIds.length));
assert(selection.nodes.every((row) => !['EXTERNAL_BOUNDARY', 'REPAIR_BOUNDARY'].includes(row.boundaryClass)));
const connected = selection.nodes.find((row) => row.affectedComponentIds.length > 1)
  || selection.nodes[0];
const target = createSequentialNodeStretchTarget({ selection, nodeId: connected.nodeId,
  readModel, scene });
assert.deepEqual(validateSequentialNodeStretchTarget(target, { selection, readModel, scene }), target);
assert(target.geometryParts.every((row) => row.nodeIds.includes(target.nodeId)));
assert.deepEqual([...target.portIds].sort(), [...connected.portIds].sort());
assert(Object.isFrozen(target));
assert.throws(() => createSequentialNodeStretchTarget({ selection, nodeId: 'MISSING', readModel, scene }),
  (error) => error.code === 'SEQUENTIAL_NODE_STRETCH_NODE_MISSING');
bridge.destroy();
console.log('Sequential node stretch target: ok');
