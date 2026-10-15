import assert from 'node:assert/strict';
import { createPolylineGeometry, createSegmentGeometry } from '../core/engineering-scene/index.js';
import { createSequentialGeometryEditJournal, appendSequentialGeometryEdit,
  assertSequentialGeometryEditJournal, sequentialGeometryEditBaseFingerprint } from '../tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-journal.js';
import { applySequentialGeometryEditJournalToTopology } from '../tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-projection.js';
import { createSequentialNodeStretchGeometry } from '../tabs/sequential-sketcher/scoped-edit/sequential-node-stretch-geometry.js';
const p = (x, y = 0, z = 0) => ({ x, y, z });
const base = Object.freeze({ schema: 'SequentialEditableTopologySnapshot.v1',
  branch: { branchId: 'B1' }, authority: { confirmedConstructionFingerprint: 'CF1' },
  components: [
    { componentId: 'M1', canonicalType: 'PIPE', portIds: ['MA', 'MB'],
      nodeIds: ['MN0', 'MN1'], geometryPartIds: ['GM'], supportAttachmentIds: [] },
    { componentId: 'P1', canonicalType: 'PIPE', portIds: ['PA', 'PB'],
      nodeIds: ['N0', 'N1'], geometryPartIds: ['GP'], supportAttachmentIds: [] },
    { componentId: 'E1', canonicalType: 'ELBOW', portIds: ['EA', 'EB'],
      nodeIds: ['N1', 'NI', 'N2'], geometryPartIds: ['GE'], supportAttachmentIds: [] },
  ],
  ports: [{ portId: 'MA', componentId: 'M1', nodeId: 'MN0', position: p(100) },
    { portId: 'MB', componentId: 'M1', nodeId: 'MN1', position: p(110) },
    { portId: 'PA', componentId: 'P1', nodeId: 'N0', position: p(0) },
    { portId: 'PB', componentId: 'P1', nodeId: 'N1', position: p(10) },
    { portId: 'EA', componentId: 'E1', nodeId: 'N1', position: p(10) },
    { portId: 'EB', componentId: 'E1', nodeId: 'N2', position: p(10, 10) }],
  nodes: [{ nodeId: 'MN0', position: p(100), portIds: ['MA'], incidentComponentIds: ['M1'],
    incidentGeometryPartIds: ['GM'], committedConnectionIds: [], boundaryClass: 'OPEN_TERMINAL',
    positionAncestry: [] },
  { nodeId: 'MN1', position: p(110), portIds: ['MB'], incidentComponentIds: ['M1'],
    incidentGeometryPartIds: ['GM'], committedConnectionIds: [], boundaryClass: 'OPEN_TERMINAL',
    positionAncestry: [] },
  { nodeId: 'N0', position: p(0), portIds: ['PA'], incidentComponentIds: ['P1'],
    incidentGeometryPartIds: ['GP'], committedConnectionIds: [], boundaryClass: 'OPEN_TERMINAL',
    positionAncestry: [] },
  { nodeId: 'N1', position: p(10), portIds: ['PB', 'EA'], incidentComponentIds: ['P1', 'E1'],
    incidentGeometryPartIds: ['GP', 'GE'], committedConnectionIds: ['C1'], boundaryClass: 'CONNECTED',
    positionAncestry: [{ portId: 'PB', resolvedPosition: p(10) },
      { portId: 'EA', resolvedPosition: p(10) }] },
  { nodeId: 'N2', position: p(10, 10), portIds: ['EB'], incidentComponentIds: ['E1'],
    incidentGeometryPartIds: ['GE'], committedConnectionIds: [], boundaryClass: 'OPEN_TERMINAL',
    positionAncestry: [] }],
  geometryParts: [
    { geometryPartId: 'GM', componentId: 'M1', nodeIds: ['MN0', 'MN1'],
      geometry: createSegmentGeometry(p(100), p(110)) },
    { geometryPartId: 'GP', componentId: 'P1', nodeIds: ['N0', 'N1'],
      geometry: createSegmentGeometry(p(0), p(10)) },
    { geometryPartId: 'GE', componentId: 'E1', nodeIds: ['N1', 'NI', 'N2'],
      geometry: createPolylineGeometry([p(10), p(12, 2), p(10, 10)]) },
  ],
  internalEdges: [], componentBoundaryCuts: [], repairs: [], supportAttachments: [],
  committedConnections: [{ connectionId: 'C1', fromPortId: 'PB', toPortId: 'EA',
    fromPosition: p(10), toPosition: p(10), nodeRelation: 'MERGED_BY_COMMITTED_IDENTITY' }],
});
const target = p(12); const profile = { minimumLengthMm: 1,
  zeroLengthToleranceMm: 1e-9, collinearityTolerance: 1e-9 };
const stretchBaseParts = base.geometryParts.filter((part) => ['GP', 'GE'].includes(part.geometryPartId));
const draftParts = stretchBaseParts.map((part) => createSequentialNodeStretchGeometry({
  nodeId: 'N1', originalPosition: p(10), targetPosition: target, profile,
  geometryParts: [{ ...part, canonicalType: part.componentId === 'P1' ? 'PIPE' : 'ELBOW' }],
}).geometryParts[0]);
let journal = createSequentialGeometryEditJournal({ branchId: 'B1',
  confirmedConstructionFingerprint: 'CF1', baseFingerprint: sequentialGeometryEditBaseFingerprint(base) });
({ journal } = appendSequentialGeometryEdit(journal, { componentId: 'M1', targetId: 'TM',
  operationId: 'MOVE-1', eligibilityId: 'EL-M', rawDelta: p(5), delta: p(5), snapSelection: null,
  before: { geometryParts: [{ geometryPartId: 'GM', geometry: createSegmentGeometry(p(100), p(110)) }],
    ports: [{ portId: 'MA', position: p(100) }, { portId: 'MB', position: p(110) }],
    nodes: [{ nodeId: 'MN0', position: p(100) }, { nodeId: 'MN1', position: p(110) }] },
  after: { geometryParts: [{ geometryPartId: 'GM', geometry: createSegmentGeometry(p(105), p(115)) }],
    ports: [{ portId: 'MA', position: p(105) }, { portId: 'MB', position: p(115) }],
    nodes: [{ nodeId: 'MN0', position: p(105) }, { nodeId: 'MN1', position: p(115) }] },
  ancestry: {}, operator: { actorId: 'A', reason: 'R', appliedAt: '2026-07-28T19:19:00.000Z' },
}, base));
const input = { type: 'STRETCH_NODE', componentId: 'P1', nodeId: 'N1',
  affectedComponentIds: ['P1', 'E1'], targetId: 'T1', operationId: 'OP1', eligibilityId: 'EL1',
  rawDelta: p(2), delta: p(2), targetPosition: target, profile, snapSelection: null,
  before: { geometryParts: stretchBaseParts.map((row) => ({ geometryPartId: row.geometryPartId,
    geometry: row.geometry, nodeIds: row.nodeIds })), ports: base.ports.filter((row) => row.nodeId === 'N1')
    .map((row) => ({ portId: row.portId, position: row.position })),
  nodes: [{ nodeId: 'N1', position: p(10) }] },
  after: { geometryParts: draftParts.map((row) => ({ geometryPartId: row.geometryPartId,
    geometry: row.draftGeometry, nodeIds: row.nodeIds })),
  ports: [{ portId: 'PB', position: target }, { portId: 'EA', position: target }],
  nodes: [{ nodeId: 'N1', position: target }] }, ancestry: {},
  operator: { actorId: 'A', reason: 'R', appliedAt: '2026-07-28T19:20:00.000Z' } };
({ journal } = appendSequentialGeometryEdit(journal, input, base));
assert.deepEqual(assertSequentialGeometryEditJournal(journal, base), journal);
const projected = applySequentialGeometryEditJournalToTopology(base, journal);
assert.deepEqual(projected.geometryParts.find((row) => row.geometryPartId === 'GM').geometry,
  createSegmentGeometry(p(105), p(115)));
assert.deepEqual(projected.nodes.find((row) => row.nodeId === 'N1').position, target);
assert.deepEqual(projected.geometryParts.find((row) => row.geometryPartId === 'GP').geometry.end,
  target);
assert.deepEqual(projected.geometryParts.find((row) => row.geometryPartId === 'GE').geometry.points[0],
  target);
assert.deepEqual(projected.committedConnections[0].fromPosition, target);
assert.deepEqual(projected.committedConnections[0].toPosition, target);
assert.equal(projected.geometryParts.find((row) => row.geometryPartId === 'GP').geometryPartId, 'GP');
const omitted = structuredClone(input); omitted.operationId = 'OP2'; omitted.before.ports.pop();
omitted.after.ports.pop();
const omittedJournal = appendSequentialGeometryEdit(journal, omitted, base).journal;
assert.throws(() => applySequentialGeometryEditJournalToTopology(base, omittedJournal),
  (error) => error.code === 'SEQUENTIAL_GEOMETRY_EDIT_ENTRY_STALE');
console.log('Sequential node stretch projection: ok');
