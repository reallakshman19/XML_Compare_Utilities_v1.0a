import assert from 'node:assert/strict';
import { createConfirmedSequentialConstruction } from '../tabs/sequential-sketcher/construction/sequential-construction-acceptance.js';
import {
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import {
  createSequentialEditableTopologySnapshot,
  assertSequentialEditableTopologySnapshot,
  SEQUENTIAL_EDITABLE_TOPOLOGY_SNAPSHOT_SCHEMA,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-editable-topology-snapshot.js';
import {
  resolveSequentialPortTopology,
  SEQUENTIAL_EDITABLE_TOPOLOGY_IDENTITY_REJECTION,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-editable-topology-identity.js';
import { createSequentialScopedEditReadModel } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-read-model.js';
import { createSequentialEngineeringSvgOwnerBridge } from '../tabs/sequential-sketcher/sequential-engineering-svg-owner-bridge.js';
import {
  buildSequentialEvidenceModel,
  indexSequentialEvidence,
} from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  confirmedSupportSequentialFixture,
  repairedSequentialFixture,
} from './helpers/sequential-engineering-svg-fixture.js';

function completeFixture(records, branchId, options = {}) {
  const evidenceModel = buildSequentialEvidenceModel(records);
  const indexes = indexSequentialEvidence(evidenceModel);
  const initial = createSequentialConstructionSession(branchId);
  const result = runConstructionUntilBlocked(initial, evidenceModel, indexes, options);
  assert.equal(result.session.state, 'ROUTE_COMPLETE');
  const confirmedConstruction = createConfirmedSequentialConstruction(result.session, indexes);
  return { evidenceModel, indexes, session: result.session, confirmedConstruction };
}
function readModel(fixture) {
  const bridge = createSequentialEngineeringSvgOwnerBridge({
    readOwnerState: () => ({
      session: fixture.session,
      evidenceModel: fixture.evidenceModel,
      indexes: fixture.indexes,
      confirmedConstruction: fixture.confirmedConstruction,
      supportProjection: fixture.supportProjection || null,
      visibleProjection: 'ISO',
    }),
  });
  const result = createSequentialScopedEditReadModel(bridge.getSnapshot());
  bridge.destroy();
  return result;
}
function teeFixture() {
  const main = '/EDIT/TEE/MAIN'; const side = '/EDIT/TEE/SIDE';
  return completeFixture([
    { type: 'BRANCH', name: main, attributes: { NAME: main, HPOS: { x: 0, y: 0, z: 0 } }, children: [
      { type: 'PIPE', name: 'M-P1', attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } } },
      { type: 'TEE', name: 'M-T1', attributes: { APOS: { x: 100, y: 0, z: 0 }, POS: { x: 120, y: 0, z: 0 }, LPOS: { x: 140, y: 0, z: 0 }, BPOS: { x: 120, y: 20, z: 0 }, CREF: side } },
      { type: 'CAP', name: 'M-C1', attributes: { APOS: { x: 140, y: 0, z: 0 } } },
    ] },
    { type: 'BRANCH', name: side, attributes: { NAME: side, HPOS: { x: 120, y: 20, z: 0 } }, children: [
      { type: 'PIPE', name: 'S-P1', attributes: { APOS: { x: 120, y: 20, z: 0 }, LPOS: { x: 0, y: 0, z: 0 } } },
      { type: 'CAP', name: 'S-C1', attributes: { APOS: { x: 0, y: 0, z: 0 } } },
    ] },
  ], main);
}
function oletFixture() {
  const main = '/EDIT/OLET/MAIN'; const side = '/EDIT/OLET/SIDE';
  return completeFixture([
    { type: 'BRANCH', name: main, attributes: { NAME: main, HPOS: { x: 0, y: 0, z: 0 } }, children: [
      { type: 'PIPE', name: 'P1', attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } } },
      { type: 'OLET', name: 'O1', attributes: { NAME: 'O1', POS: { x: 100, y: 0, z: 0 }, CREF: side } },
      { type: 'PIPE', name: 'P2', attributes: { APOS: { x: 100, y: 0, z: 0 }, LPOS: { x: 200, y: 0, z: 0 } } },
      { type: 'CAP', name: 'C1', attributes: { APOS: { x: 200, y: 0, z: 0 } } },
    ] },
    { type: 'BRANCH', name: side, attributes: { NAME: side, HPOS: { x: 100, y: 20, z: 0 } }, children: [
      { type: 'PIPE', name: 'SP1', attributes: { APOS: { x: 100, y: 20, z: 0 }, LPOS: { x: 100, y: 80, z: 0 } } },
      { type: 'CAP', name: 'SC1', attributes: { APOS: { x: 100, y: 80, z: 0 } } },
    ] },
  ], main);
}
function topology(fixture) {
  const model = readModel(fixture);
  const before = JSON.stringify(model.ownerSnapshot);
  const first = createSequentialEditableTopologySnapshot(model);
  const second = createSequentialEditableTopologySnapshot(model);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(JSON.stringify(model.ownerSnapshot), before, 'snapshot projection must not mutate authority input');
  assert.deepEqual(assertSequentialEditableTopologySnapshot(first, model), first);
  return { model, snapshot: first };
}

const tee = topology(teeFixture());
assert.equal(tee.snapshot.schema, SEQUENTIAL_EDITABLE_TOPOLOGY_SNAPSHOT_SCHEMA);
assert(Object.isFrozen(tee.snapshot));
assert(Object.isFrozen(tee.snapshot.nodes));
const teeComponent = tee.snapshot.components.find((row) => row.canonicalType === 'TEE');
assert.deepEqual(teeComponent.geometryPartIds.map((id) => id.split(':').at(-1)).sort(), ['branch', 'run']);
const teeParts = tee.snapshot.geometryParts.filter((row) => row.componentId === teeComponent.componentId);
assert.equal(teeParts.length, 2);
assert(teeParts.every((row) => row.sourceStrokeId === teeComponent.ancestry.strokeId));
assert.equal(teeComponent.geometryKinds.length, 1);
assert(teeComponent.ancestry.sessionFingerprint);
assert(teeComponent.ancestry.strokeId);
assert(teeParts[0].nodeIds.some((nodeId) => teeParts[1].nodeIds.includes(nodeId)),
  'tee run and branch parts must share one internal centre node');
const originNodes = tee.snapshot.nodes.filter((row) => (
  row.position.x === 0 && row.position.y === 0 && row.position.z === 0
));
assert(originNodes.length >= 2, 'coincident but unconnected topology nodes must remain distinct');
assert(new Set(originNodes.map((row) => row.nodeId)).size === originNodes.length);
assert(tee.snapshot.nodes.some((row) => row.boundaryClass === 'INTENTIONAL_TERMINAL'));
assert(tee.snapshot.nodes.some((row) => row.boundaryClass === 'EXTERNAL_BOUNDARY'));
assert(tee.snapshot.openBoundaries.some((row) => row.boundaryClass === 'INTENTIONAL_TERMINAL'));
assert(tee.snapshot.openBoundaries.some((row) => row.boundaryClass === 'EXTERNAL_BOUNDARY'));
assert(tee.snapshot.nodes.some((row) => row.positionAncestry.length));
assert(tee.snapshot.componentBoundaryCuts.length > 0);
assert(tee.snapshot.componentBoundaryCuts.every((row) => typeof row.currentCoincidence === 'boolean'));
const teeGroup = tee.snapshot.selectionGroups.find((row) => row.componentId === teeComponent.componentId);
assert.deepEqual([...teeGroup.geometryPartIds].sort(), [...teeComponent.geometryPartIds].sort());
assert.equal(teeGroup.selectionCandidateIds.length, 2);
const teeEligibility = tee.snapshot.eligibility.find((row) => row.targetId === teeComponent.componentId);
assert(!teeEligibility.capabilities.includes('RIGID_MOVE_ELIGIBLE'));
assert(!teeEligibility.capabilities.includes('ROTATE_ELIGIBLE'));
assert(teeEligibility.evidence.boundaryCutIds.length > 0);

for (const connection of tee.snapshot.committedConnections) {
  const fromPort = tee.snapshot.ports.find((row) => row.portId === connection.fromPortId);
  const toPort = tee.snapshot.ports.find((row) => row.portId === connection.toPortId);
  assert.equal(fromPort.nodeId, connection.fromNodeId);
  assert.equal(toPort.nodeId, connection.toNodeId);
  if (connection.nodeRelation === 'MERGED_BY_COMMITTED_IDENTITY') {
    assert.equal(connection.fromNodeId, connection.toNodeId);
  }
}
for (const part of tee.snapshot.geometryParts) {
  const owner = tee.snapshot.components.find((row) => row.componentId === part.componentId);
  assert(owner.geometryPartIds.includes(part.geometryPartId));
}

const olet = topology(oletFixture()).snapshot;
const oletComponent = olet.components.find((row) => row.canonicalType === 'OLET');
assert.equal(oletComponent.geometryPartIds.length, 1);
assert.equal(olet.ports.filter((row) => row.componentId === oletComponent.componentId).length, 2);
assert(olet.ports.filter((row) => row.componentId === oletComponent.componentId)
  .every((row) => row.position && row.nodeId));

const repaired = topology(repairedSequentialFixture()).snapshot;
assert(repaired.components.some((row) => row.canonicalType === 'ELBOW'));
assert.equal(repaired.repairs.length, 1);
assert(repaired.committedConnections.some((row) => row.nodeRelation === 'REPAIR_MEDIATED_CONTINUITY'));
assert(repaired.nodes.filter((row) => row.boundaryClass === 'REPAIR_BOUNDARY').length >= 2);
assert(repaired.eligibility.some((row) => row.locks.includes('LOCKED_CANDIDATE_OR_REPAIR')));

const supported = topology(confirmedSupportSequentialFixture()).snapshot;
assert.equal(supported.supportAttachments.length, 1);
const attachment = supported.supportAttachments[0];
const carrier = supported.supportCarriers.find((row) => row.carrierId === attachment.carrierId);
assert(carrier.supportAttachmentIds.includes(attachment.supportAttachmentId));
assert(supported.components.some((row) => row.canonicalType === 'PIPE'));
assert(supported.components.some((row) => row.canonicalType === 'CAP'));
assert(supported.selectionCandidates.every((row) => row.eligibilityId));
assert(supported.selectionCandidates.every((row) => row.resolvedComponentId));
assert(supported.selectionCandidates.every((row) => row.selectionGroupId));
assert.equal(supported.selectionGroups.length, supported.components.length);
assert(supported.selectionCandidates.every((row) => Array.isArray(row.boundaryCutIds)));
assert.match(supported.authority.sourceEvidenceFingerprint, /^fnv1a32-canonical-json-v1:SSKSOURCEEVIDENCE:/);
assert.match(supported.authority.sceneFingerprint, /^fnv1a32-canonical-json-v1:SSKEDITSCENE:/);
assert.match(supported.topologyFingerprint, /^fnv1a32-canonical-json-v1:SSKEDITTOPOLOGY:/);
assert.match(supported.geometryFingerprint, /^fnv1a32-canonical-json-v1:SSKEDITGEOMETRY:/);
assert.match(supported.ancestryFingerprint, /^fnv1a32-canonical-json-v1:SSKEDITANCESTRY:/);

const tampered = { ...tee.snapshot, nodes: tee.snapshot.nodes.slice(1) };
assert.throws(
  () => assertSequentialEditableTopologySnapshot(tampered, tee.model),
  /differs from deterministic authority regeneration/,
);
const stale = { ...tee.model, sessionFingerprint: 'stale-session' };
assert.throws(
  () => createSequentialEditableTopologySnapshot(stale),
  /differs from independent owner-snapshot regeneration/,
);

const conflictingPortAuthority = {
  confirmedComponents: [{
    componentId: 'COMP-CONFLICT', branchId: '/CONFLICT',
    ports: [{ portId: 'PORT-CONFLICT', sourcePosition: { x: 0, y: 0, z: 0 } }],
  }],
  committedConnections: [
    { connectionId: 'CONNECTION-A', fromPortId: 'PORT-CONFLICT', toPortId: 'PORT-A',
      fromPosition: { x: 0, y: 0, z: 0 }, toPosition: { x: 0, y: 0, z: 0 } },
    { connectionId: 'CONNECTION-B', fromPortId: 'PORT-CONFLICT', toPortId: 'PORT-B',
      fromPosition: { x: 1, y: 0, z: 0 }, toPosition: { x: 1, y: 0, z: 0 } },
  ],
  repairs: [],
};
assert.throws(
  () => resolveSequentialPortTopology(conflictingPortAuthority),
  (error) => error.code
    === SEQUENTIAL_EDITABLE_TOPOLOGY_IDENTITY_REJECTION.PORT_POSITION_CONFLICT,
);

console.log('Sequential editable topology snapshot: ok');
