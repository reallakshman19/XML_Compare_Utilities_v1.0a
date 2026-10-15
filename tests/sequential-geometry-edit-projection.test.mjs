import assert from 'node:assert/strict';
import {
  createEngineeringRevisionToken,
  createEngineeringScene,
  createEngineeringSceneEntity,
  createSegmentGeometry,
} from '../core/engineering-scene/index.js';
import {
  appendSequentialGeometryEdit,
  createSequentialGeometryEditJournal,
  sequentialGeometryEditBaseFingerprint,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-journal.js';
import {
  applySequentialGeometryEditJournalToScene,
  applySequentialGeometryEditJournalToTopology,
  SEQUENTIAL_GEOMETRY_EDIT_PROJECTION_REJECTION,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-projection.js';

const pos = (x, y, z = 0) => ({ x, y, z });
const geom = (x, y = 0) => createSegmentGeometry(pos(x, y), pos(x + 10, y));
function topology() {
  return {
    schema: 'SequentialEditableTopologySnapshot.v1',
    authority: { confirmedConstructionFingerprint: 'CONFIRMED-PROJECTION' },
    branch: { branchId: '/GEOMETRY/PROJECTION' },
    components: [{ componentId: 'COMP-1', canonicalType: 'PIPE',
      geometryPartIds: ['PART-1'], portIds: ['PORT-1', 'PORT-2'],
      nodeIds: ['NODE-1', 'NODE-2'], supportAttachmentIds: [] }],
    geometryParts: [{ geometryPartId: 'PART-1', componentId: 'COMP-1', geometry: geom(0) }],
    ports: [{ portId: 'PORT-1', componentId: 'COMP-1', position: pos(0, 0) },
      { portId: 'PORT-2', componentId: 'COMP-1', position: pos(10, 0) }],
    nodes: [{ nodeId: 'NODE-1', incidentComponentIds: ['COMP-1'], position: pos(0, 0) },
      { nodeId: 'NODE-2', incidentComponentIds: ['COMP-1'], position: pos(10, 0) }],
    internalEdges: [], committedConnections: [], componentBoundaryCuts: [], repairs: [],
  };
}
function input(beforeX, delta, operationId) {
  const afterX = beforeX + delta.x;
  return {
    componentId: 'COMP-1', targetId: 'TARGET-1', operationId, eligibilityId: 'E-1',
    rawDelta: delta, delta, snapSelection: null, ancestry: {},
    operator: { actorId: 'A', reason: 'R', appliedAt: '2026-07-28T18:35:00.000Z' },
    before: { geometryParts: [{ geometryPartId: 'PART-1', geometry: geom(beforeX) }],
      ports: [{ portId: 'PORT-1', position: pos(beforeX, 0) },
        { portId: 'PORT-2', position: pos(beforeX + 10, 0) }],
      nodes: [{ nodeId: 'NODE-1', position: pos(beforeX, 0) },
        { nodeId: 'NODE-2', position: pos(beforeX + 10, 0) }] },
    after: { geometryParts: [{ geometryPartId: 'PART-1', geometry: geom(afterX, delta.y) }],
      ports: [{ portId: 'PORT-1', position: pos(afterX, delta.y) },
        { portId: 'PORT-2', position: pos(afterX + 10, delta.y) }],
      nodes: [{ nodeId: 'NODE-1', position: pos(afterX, delta.y) },
        { nodeId: 'NODE-2', position: pos(afterX + 10, delta.y) }] },
  };
}
const base = topology();
let journal = createSequentialGeometryEditJournal({ branchId: base.branch.branchId,
  confirmedConstructionFingerprint: base.authority.confirmedConstructionFingerprint,
  baseFingerprint: sequentialGeometryEditBaseFingerprint(base) });
journal = appendSequentialGeometryEdit(journal, input(0, pos(2, 0), 'MOVE-1'), base).journal;
const once = applySequentialGeometryEditJournalToTopology(base, journal);
journal = appendSequentialGeometryEdit(journal, input(2, pos(0, 3), 'MOVE-2'), base).journal;
const twice = applySequentialGeometryEditJournalToTopology(base, journal);
assert.deepEqual(twice.ports.map((row) => row.position), [pos(2, 3), pos(12, 3)]);
assert.deepEqual(twice.nodes.map((row) => row.nodeId), ['NODE-1', 'NODE-2']);
assert.equal(once.geometryParts[0].geometry.start.x, 2);
const revision = createEngineeringRevisionToken('BASE-R1');
const scene = createEngineeringScene({ sceneId: 'BASE-SCENE', revision, entities: [
  createEngineeringSceneEntity({ id: 'PART-1', kind: 'segment', geometry: geom(0),
    domainRef: { category: 'confirmed', componentId: 'COMP-1' } }),
] });
const effectiveScene = applySequentialGeometryEditJournalToScene(scene, journal);
assert.deepEqual(effectiveScene.entities[0].geometry.start, {
  schema: 'EngineeringPoint3D.v1', x: 2, y: 3, z: 0,
});
assert.equal(scene.entities[0].geometry.start.x, 0, 'base scene must remain immutable');
assert.throws(() => applySequentialGeometryEditJournalToTopology({
  ...base, componentBoundaryCuts: [{ componentId: 'COMP-1' }],
}, journal), (error) => error.code === SEQUENTIAL_GEOMETRY_EDIT_PROJECTION_REJECTION.TARGET_INVALID);
assert.throws(() => applySequentialGeometryEditJournalToTopology({
  ...base, components: [{ ...base.components[0], supportAttachmentIds: ['SUPPORT-1'] }],
}, journal), (error) => error.code === SEQUENTIAL_GEOMETRY_EDIT_PROJECTION_REJECTION.TARGET_INVALID);
console.log('Sequential geometry edit projection: ok');
