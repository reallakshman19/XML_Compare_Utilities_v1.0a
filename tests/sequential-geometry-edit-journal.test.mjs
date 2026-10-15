import assert from 'node:assert/strict';
import {
  appendSequentialGeometryEdit,
  assertSequentialGeometryEditJournal,
  createSequentialGeometryEditJournal,
  sequentialGeometryEditBaseFingerprint,
  SEQUENTIAL_GEOMETRY_EDIT_REJECTION,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-journal.js';

const position = (x, y, z = 0) => ({ x, y, z });
const geometryPoint = (x, y, z = 0) => ({ schema: 'EngineeringPoint3D.v1', x, y, z });
const segment = (x, y = 0) => ({
  schema: 'EngineeringGeometry.v1', kind: 'segment',
  start: geometryPoint(x, y), end: geometryPoint(x + 10, y),
});
function snapshot() {
  return Object.freeze({
    schema: 'SequentialEditableTopologySnapshot.v1',
    authority: { confirmedConstructionFingerprint: 'CONFIRMED-1' },
    branch: { branchId: '/GEOMETRY/JOURNAL' },
    components: [{ componentId: 'COMP-1', canonicalType: 'PIPE',
      portIds: ['PORT-1', 'PORT-2'], nodeIds: ['NODE-1', 'NODE-2'],
      geometryPartIds: ['PART-1'] }],
    ports: [
      { portId: 'PORT-1', componentId: 'COMP-1', nodeId: 'NODE-1', position: position(0, 0) },
      { portId: 'PORT-2', componentId: 'COMP-1', nodeId: 'NODE-2', position: position(10, 0) },
    ],
    nodes: [
      { nodeId: 'NODE-1', incidentComponentIds: ['COMP-1'], position: position(0, 0) },
      { nodeId: 'NODE-2', incidentComponentIds: ['COMP-1'], position: position(10, 0) },
    ],
    geometryParts: [{ geometryPartId: 'PART-1', componentId: 'COMP-1', geometry: segment(0) }],
    internalEdges: [], committedConnections: [], repairs: [],
  });
}
function entry(operationId, beforeX, deltaX) {
  return {
    componentId: 'COMP-1', targetId: 'TARGET-1', operationId, eligibilityId: 'ELIGIBLE-1',
    rawDelta: position(deltaX, 0), delta: position(deltaX, 0), snapSelection: null,
    before: {
      geometryParts: [{ geometryPartId: 'PART-1', geometry: segment(beforeX) }],
      ports: [
        { portId: 'PORT-1', position: position(beforeX, 0) },
        { portId: 'PORT-2', position: position(beforeX + 10, 0) },
      ],
      nodes: [
        { nodeId: 'NODE-1', position: position(beforeX, 0) },
        { nodeId: 'NODE-2', position: position(beforeX + 10, 0) },
      ],
    },
    after: {
      geometryParts: [{ geometryPartId: 'PART-1', geometry: segment(beforeX + deltaX) }],
      ports: [
        { portId: 'PORT-1', position: position(beforeX + deltaX, 0) },
        { portId: 'PORT-2', position: position(beforeX + deltaX + 10, 0) },
      ],
      nodes: [
        { nodeId: 'NODE-1', position: position(beforeX + deltaX, 0) },
        { nodeId: 'NODE-2', position: position(beforeX + deltaX + 10, 0) },
      ],
    },
    ancestry: { authorityId: 'AUTH-1' },
    operator: { actorId: 'OPERATOR', reason: 'Reviewed exact isolated move.',
      evidenceNote: 'Journal unit proof.', appliedAt: '2026-07-28T18:30:00.000Z' },
  };
}

const base = snapshot();
let journal = createSequentialGeometryEditJournal({
  branchId: base.branch.branchId,
  confirmedConstructionFingerprint: base.authority.confirmedConstructionFingerprint,
  baseFingerprint: sequentialGeometryEditBaseFingerprint(base),
});
const first = appendSequentialGeometryEdit(journal, entry('MOVE-1', 0, 4), base);
journal = first.journal;
const second = appendSequentialGeometryEdit(journal, entry('MOVE-2', 4, 3), base);
journal = second.journal;
assert.equal(journal.entries.length, 2);
assert.equal(journal.entries[1].previousHeadFingerprint, first.journal.headFingerprint);
assert.deepEqual(assertSequentialGeometryEditJournal(journal, base), journal);
assert.deepEqual(
  appendSequentialGeometryEdit(createSequentialGeometryEditJournal({
    branchId: base.branch.branchId,
    confirmedConstructionFingerprint: base.authority.confirmedConstructionFingerprint,
    baseFingerprint: sequentialGeometryEditBaseFingerprint(base),
  }), entry('MOVE-1', 0, 4), base),
  first,
  'journal append must be deterministic',
);
assert.throws(
  () => appendSequentialGeometryEdit(journal, entry('MOVE-2', 7, 1), base),
  (error) => error.code === SEQUENTIAL_GEOMETRY_EDIT_REJECTION.OPERATION_REPLAY,
);
assert.throws(() => appendSequentialGeometryEdit(journal, {
  ...entry('MOVE-3', 7, 1),
  after: { ...entry('MOVE-3', 7, 1).after,
    ports: [...entry('MOVE-3', 7, 1).after.ports,
      { portId: 'HIDDEN-PORT', position: position(0, 0) }] },
}, base), /identity sets must match/);
const tampered = { ...journal, entries: [...journal.entries.slice(0, -1),
  { ...journal.entries.at(-1), delta: position(99, 0) }] };
assert.throws(
  () => assertSequentialGeometryEditJournal(tampered, base),
  (error) => error.code === SEQUENTIAL_GEOMETRY_EDIT_REJECTION.JOURNAL_INVALID,
);
console.log('Sequential geometry edit journal: ok');
