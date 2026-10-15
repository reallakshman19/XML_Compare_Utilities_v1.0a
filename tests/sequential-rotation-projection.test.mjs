import assert from 'node:assert/strict';
import { createSequentialRotationBoundaryDiagnosis, createSequentialRotationTransform,
  rotateSequentialGeometry, rotateSequentialPoint } from '../tabs/sequential-sketcher/scoped-edit/sequential-rotation-geometry.js';
import { appendSequentialGeometryEdit, createSequentialGeometryEditJournal,
  sequentialGeometryEditBaseFingerprint } from '../tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-journal.js';
import { applySequentialGeometryEditJournalToTopology } from '../tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-projection.js';

const point = (x, y, z = 0) => ({ x, y, z });
const partA = { geometryPartId: 'PA', componentId: 'A', nodeIds: ['N0', 'N1'],
  geometry: { kind: 'segment', start: point(0, 0), end: point(10, 0) } };
const partB = { geometryPartId: 'PB', componentId: 'B', nodeIds: ['N1', 'N2'],
  geometry: { kind: 'segment', start: point(10, 0), end: point(20, 0) } };
const topology = {
  schema: 'SequentialEditableTopologySnapshot.v1', branch: { branchId: '/ROTATE/PROJECTION' },
  authority: { confirmedConstructionFingerprint: 'CONFIRMED' },
  components: [
    { componentId: 'A', portIds: ['A0', 'A1'], nodeIds: ['N0', 'N1'],
      geometryPartIds: ['PA'], supportAttachmentIds: [] },
    { componentId: 'B', portIds: ['B0', 'B1'], nodeIds: ['N1', 'N2'],
      geometryPartIds: ['PB'], supportAttachmentIds: [] },
  ],
  ports: [
    { portId: 'A0', componentId: 'A', nodeId: 'N0', position: point(0, 0) },
    { portId: 'A1', componentId: 'A', nodeId: 'N1', position: point(10, 0) },
    { portId: 'B0', componentId: 'B', nodeId: 'N1', position: point(10, 0) },
    { portId: 'B1', componentId: 'B', nodeId: 'N2', position: point(20, 0) },
  ],
  nodes: [
    { nodeId: 'N0', incidentComponentIds: ['A'], position: point(0, 0), positionAncestry: [] },
    { nodeId: 'N1', incidentComponentIds: ['A', 'B'], position: point(10, 0),
      positionAncestry: [{ portId: 'A1' }, { portId: 'B0' }] },
    { nodeId: 'N2', incidentComponentIds: ['B'], position: point(20, 0), positionAncestry: [] },
  ],
  geometryParts: [partA, partB], internalEdges: [], repairs: [], componentBoundaryCuts: [],
  committedConnections: [{ connectionId: 'CAB', fromPortId: 'A1', toPortId: 'B0',
    fromPosition: point(10, 0), toPosition: point(10, 0) }],
};
const transform = createSequentialRotationTransform({
  pivot: point(0, 0), axis: point(0, 0, 1), angleDegrees: 90,
});
const before = {
  geometryParts: [partA, partB].map((row) => ({ geometryPartId: row.geometryPartId,
    geometry: row.geometry, nodeIds: row.nodeIds })),
  ports: topology.ports.map((row) => ({ portId: row.portId, position: row.position })),
  nodes: topology.nodes.map((row) => ({ nodeId: row.nodeId, position: row.position })),
};
const after = {
  geometryParts: before.geometryParts.map((row) => ({ ...row,
    geometry: rotateSequentialGeometry(row.geometry, transform) })),
  ports: before.ports.map((row) => ({ ...row,
    position: rotateSequentialPoint(row.position, transform) })),
  nodes: before.nodes.map((row) => ({ ...row,
    position: rotateSequentialPoint(row.position, transform) })),
};
let journal = createSequentialGeometryEditJournal({ branchId: topology.branch.branchId,
  confirmedConstructionFingerprint: topology.authority.confirmedConstructionFingerprint,
  baseFingerprint: sequentialGeometryEditBaseFingerprint(topology) });
const appended = appendSequentialGeometryEdit(journal, {
  type: 'ROTATE_SUBGRAPH', componentId: 'A', seedComponentId: 'A',
  scope: 'CONNECTED_SUBGRAPH', affectedComponentIds: ['A', 'B'],
  targetId: 'TARGET', operationId: 'ROTATE-1', eligibilityId: 'EA',
  rawDelta: point(0, 0), delta: point(0, 0), pivot: transform.pivot, axis: transform.axis,
  angleDegrees: transform.angleDegrees, angleRadians: transform.angleRadians,
  transformFingerprint: transform.transformFingerprint, profile: transform.profile,
  boundaryDiagnosis: createSequentialRotationBoundaryDiagnosis([], transform),
  before, after, ancestry: {}, operator: { actorId: 'TEST', reason: 'Qualified rotation.',
    appliedAt: '2026-07-29T02:31:00.000Z' },
}, topology);
journal = appended.journal;
const effective = applySequentialGeometryEditJournalToTopology(topology, journal);
assert.deepEqual(effective.nodes.find((row) => row.nodeId === 'N1').position, point(0, 10));
assert.deepEqual(effective.committedConnections[0].fromPosition, point(0, 10));
assert.deepEqual(effective.committedConnections[0].toPosition, point(0, 10));
assert.deepEqual(effective.components.map((row) => row.componentId), ['A', 'B']);
assert.throws(() => applySequentialGeometryEditJournalToTopology({ ...topology,
  components: topology.components.map((row) => row.componentId === 'B'
    ? { ...row, supportAttachmentIds: ['SUPPORT'] } : row) }, journal), /supported component/);
console.log('Sequential rotation projection: ok');
