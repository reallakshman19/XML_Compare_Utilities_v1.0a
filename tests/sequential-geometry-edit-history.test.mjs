import assert from 'node:assert/strict';
import {
  appendSequentialGeometryEdit,
  createSequentialGeometryEditJournal,
  sequentialGeometryEditBaseFingerprint,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-journal.js';
import {
  assertSequentialGeometryEditHistory,
  consumeSequentialGeometryHistoryTransition,
  createSequentialGeometryEditHistory,
  recordSequentialGeometryEditHistoryJournal,
  sequentialGeometryEditHistoryCapabilities,
  sequentialGeometryEditHistoryJournal,
  transitionSequentialGeometryEditHistory,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-history.js';
import {
  createSequentialGeometryEditPackageState,
  restoreGeometryEditPackageMaps,
} from '../tabs/sequential-sketcher/persistence/sequential-geometry-edit-package-state.js';

const position = (x, y, z = 0) => ({ x, y, z });
const geometryPoint = (x, y, z = 0) => ({ schema: 'EngineeringPoint3D.v1', x, y, z });
const segment = (x, y = 0) => ({ schema: 'EngineeringGeometry.v1', kind: 'segment',
  start: geometryPoint(x, y), end: geometryPoint(x + 10, y) });
function snapshot() {
  return Object.freeze({
    schema: 'SequentialEditableTopologySnapshot.v1',
    authority: { confirmedConstructionFingerprint: 'CONFIRMED-1' },
    branch: { branchId: '/GEOMETRY/HISTORY' },
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
      ports: [{ portId: 'PORT-1', position: position(beforeX, 0) },
        { portId: 'PORT-2', position: position(beforeX + 10, 0) }],
      nodes: [{ nodeId: 'NODE-1', position: position(beforeX, 0) },
        { nodeId: 'NODE-2', position: position(beforeX + 10, 0) }],
    },
    after: {
      geometryParts: [{ geometryPartId: 'PART-1', geometry: segment(beforeX + deltaX) }],
      ports: [{ portId: 'PORT-1', position: position(beforeX + deltaX, 0) },
        { portId: 'PORT-2', position: position(beforeX + deltaX + 10, 0) }],
      nodes: [{ nodeId: 'NODE-1', position: position(beforeX + deltaX, 0) },
        { nodeId: 'NODE-2', position: position(beforeX + deltaX + 10, 0) }],
    },
    ancestry: { authorityId: 'AUTH-1' },
    operator: { actorId: 'OPERATOR', reason: 'Reviewed exact isolated move.',
      evidenceNote: 'Geometry history proof.', appliedAt: '2026-07-30T10:00:00.000Z' },
  };
}

const base = snapshot();
let journal = createSequentialGeometryEditJournal({
  branchId: base.branch.branchId,
  confirmedConstructionFingerprint: base.authority.confirmedConstructionFingerprint,
  baseFingerprint: sequentialGeometryEditBaseFingerprint(base),
});
journal = appendSequentialGeometryEdit(journal, entry('MOVE-1', 0, 4), base).journal;
journal = appendSequentialGeometryEdit(journal, entry('MOVE-2', 4, 3), base).journal;
let history = createSequentialGeometryEditHistory({ journal });
assert.deepEqual(assertSequentialGeometryEditHistory(history, { snapshot: base }), history);
assert.deepEqual(sequentialGeometryEditHistoryCapabilities(history), {
  canUndo: true, canRedo: false, cursor: 2, totalCount: 2, activeCount: 2, redoCount: 0,
  undoEntry: history.entries[1], redoEntry: null,
  undoBlockedReason: null, redoBlockedReason: 'No inactive geometry edit is available to redo.',
  historyFingerprint: history.historyFingerprint, activeHeadFingerprint: history.activeHeadFingerprint,
});
const undone = transitionSequentialGeometryEditHistory(history, 'UNDO_GEOMETRY_EDIT');
assert.equal(undone.history.cursor, 1);
assert.equal(undone.affectedEntry.operationId, 'MOVE-2');
assert.equal(sequentialGeometryEditHistoryJournal(undone.history).entries.length, 1);
const redone = transitionSequentialGeometryEditHistory(undone.history, 'REDO_GEOMETRY_EDIT');
assert.deepEqual(redone.history.entries, history.entries);
assert.equal(redone.history.cursor, 2);
const consumed = consumeSequentialGeometryHistoryTransition(undone.history, 'PREPARED-1');
assert.deepEqual(consumed.consumedTransitionIds, ['PREPARED-1']);
assert.throws(() => consumeSequentialGeometryHistoryTransition(consumed, 'PREPARED-1'),
  /already consumed/);
const active = sequentialGeometryEditHistoryJournal(undone.history);
const replayedTail = appendSequentialGeometryEdit(active, entry('MOVE-2', 4, 2), base).journal;
assert.throws(() => recordSequentialGeometryEditHistoryJournal(undone.history, replayedTail),
  /already accepted/);
const replacement = appendSequentialGeometryEdit(active, entry('MOVE-3', 4, 2), base).journal;
history = recordSequentialGeometryEditHistoryJournal(undone.history, replacement);
assert.equal(history.cursor, 2);
assert.deepEqual(history.entries.map((item) => item.operationId), ['MOVE-1', 'MOVE-3']);
assert.equal(sequentialGeometryEditHistoryCapabilities(history).canRedo, false);
const packageState = createSequentialGeometryEditPackageState([{
  branchId: history.branchId, history, consumedPreparedIds: ['EDIT-PREP-1'],
}]);
assert.equal(packageState.editCount, 2);
assert.equal(packageState.activeEditCount, 2);
const restored = restoreGeometryEditPackageMaps(packageState);
assert.deepEqual(restored.byBranch.get(history.branchId), history);
assert.deepEqual([...restored.consumedByBranch.get(history.branchId)], ['EDIT-PREP-1']);
assert.throws(() => assertSequentialGeometryEditHistory({ ...history, cursor: 9 }),
  /cursor must be/);
assert.throws(() => assertSequentialGeometryEditHistory({ ...history,
  historyFingerprint: 'tampered' }), /canonical regeneration/);
console.log('Sequential geometry edit history: ok');