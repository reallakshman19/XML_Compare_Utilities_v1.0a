import assert from 'node:assert/strict';
import {
  createEngineeringRevisionToken,
  createEngineeringScene,
  createEngineeringSceneEntity,
  createPointGeometry,
  createPolylineGeometry,
  createSegmentGeometry,
} from '../core/engineering-scene/index.js';
import {
  composeSequentialSingleEntityMoveDraftScene,
  createSequentialSingleEntityMoveDraftStore,
  SEQUENTIAL_SINGLE_ENTITY_MOVE_DRAFT_SCHEMA,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-draft.js';
import {
  constrainSequentialMoveDelta,
  createSequentialMoveConstraint,
  diagnoseSequentialMoveBoundaries,
  sequentialMovePivot,
  solveSequentialMoveDrag,
  translateSequentialMoveGeometry,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-geometry.js';
import { SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_SCHEMA } from '../tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-target.js';

const revision = createEngineeringRevisionToken('ssk-3l-draft-r1');
const target = Object.freeze({
  schema: SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_SCHEMA,
  moveTargetId: 'MOVE-TARGET-1',
  componentId: 'COMP-1',
  canonicalType: 'TEE',
  geometryPartIds: ['part-run', 'part-branch'],
  geometryParts: Object.freeze([
    Object.freeze({
      geometryPartId: 'part-run', role: 'run',
      geometry: createSegmentGeometry({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }),
    }),
    Object.freeze({
      geometryPartId: 'part-branch', role: 'branch',
      geometry: createPolylineGeometry([
        { x: 5, y: 0, z: 0 }, { x: 5, y: 5, z: 0 }, { x: 5, y: 10, z: 0 },
      ], false),
    }),
  ]),
  boundaryCuts: Object.freeze([{ boundaryCutId: 'CUT-1', connectionId: 'CONNECTION-1',
    selectedPortId: 'PORT-A', stationaryPortId: 'PORT-B', stationaryComponentId: 'COMP-2',
    nodeRelation: 'MERGED_BY_COMMITTED_IDENTITY',
    selectedPosition: { x: 0, y: 0, z: 0 }, stationaryPosition: { x: 0, y: 0, z: 0 } }]),
  sceneRevision: revision,
  snapshotFingerprint: 'SNAPSHOT-1',
});
const before = JSON.stringify(target);

assert.deepEqual(createSequentialMoveConstraint('X'), {
  schema: 'SequentialMoveConstraint.v1', kind: 'axis', axis: 'X',
});
assert.deepEqual(createSequentialMoveConstraint('YZ'), {
  schema: 'SequentialMoveConstraint.v1', kind: 'plane', plane: 'YZ', axes: ['Y', 'Z'],
});
assert.deepEqual(constrainSequentialMoveDelta({ x: 4, y: 5, z: 6 }, 'X'), {
  x: 4, y: 0, z: 0, magnitude: 4,
});
assert.deepEqual(constrainSequentialMoveDelta({ x: 4, y: 5, z: 6 }, 'YZ'), {
  x: 0, y: 5, z: 6, magnitude: Math.hypot(5, 6),
});
assert.throws(
  () => constrainSequentialMoveDelta({ x: '', y: 0, z: 0 }, 'X'),
  /Move delta X is required/,
);
assert.deepEqual(sequentialMovePivot(target.geometryParts), { x: 5, y: 3, z: 0 });

const translated = translateSequentialMoveGeometry(target.geometryParts, { x: 2, y: 3, z: 4 });
assert.deepEqual(translated[0].draftGeometry.start, {
  schema: 'EngineeringPoint3D.v1', x: 2, y: 3, z: 4,
});
assert.deepEqual(translated[1].draftGeometry.points.at(-1), {
  schema: 'EngineeringPoint3D.v1', x: 7, y: 13, z: 4,
});
assert.equal(JSON.stringify(target), before, 'translation must not mutate target authority');

const diagnosis = diagnoseSequentialMoveBoundaries(target, { x: 2, y: 0, z: 0 });
assert.equal(diagnosis.aggregateDisposition, 'WOULD_DISCONNECT');
assert.deepEqual(diagnosis.rows[0].separation, { x: 2, y: 0, z: 0, magnitude: 2 });
const preserved = diagnoseSequentialMoveBoundaries(target, { x: 0, y: 0, z: 0 });
assert.equal(preserved.aggregateDisposition, 'PRESERVED');
const repaired = diagnoseSequentialMoveBoundaries({ ...target, boundaryCuts: [{
  ...target.boundaryCuts[0], nodeRelation: 'REPAIR_MEDIATED_CONTINUITY',
}] }, { x: 0, y: 0, z: 0 });
assert.equal(repaired.aggregateDisposition, 'REPAIR_BOUNDARY_LOCKED');

const axisSolution = solveSequentialMoveDrag({
  constraint: 'X', pivot: { x: 0, y: 0, z: 0 },
  startRay: { origin: { x: 0, y: 10, z: 0 }, direction: { x: 0, y: -1, z: 0 } },
  currentRay: { origin: { x: 5, y: 10, z: 0 }, direction: { x: 0, y: -1, z: 0 } },
});
assert.deepEqual(axisSolution.delta, { x: 5, y: 0, z: 0, magnitude: 5 });
const planeSolution = solveSequentialMoveDrag({
  constraint: 'XY', pivot: { x: 0, y: 0, z: 0 },
  startRay: { origin: { x: 0, y: 0, z: 10 }, direction: { x: 0, y: 0, z: -1 } },
  currentRay: { origin: { x: 3, y: 4, z: 10 }, direction: { x: 0, y: 0, z: -1 } },
});
assert.deepEqual(planeSolution.delta, { x: 3, y: 4, z: 0, magnitude: 5 });

const store = createSequentialSingleEntityMoveDraftStore();
const preview = store.stage({
  target, constraint: 'XY', delta: { x: 2, y: 3, z: 99 },
  interaction: { kind: 'numeric', source: 'exact-xyz' },
});
assert.equal(preview.schema, SEQUENTIAL_SINGLE_ENTITY_MOVE_DRAFT_SCHEMA);
assert.equal(preview.publicationState, 'NOT_PUBLISHED');
assert.deepEqual(preview.delta, { x: 2, y: 3, z: 0, magnitude: Math.hypot(2, 3) });
assert.equal(Object.keys(preview.draft.geometry).length, 2);
assert.equal(preview.previewDisposition, 'PREVIEW_ONLY_BOUNDARY_DISCONNECTION');
assert(Object.isFrozen(preview));
assert.deepEqual(store.stage({
  target, constraint: 'XY', delta: { x: 2, y: 3, z: 99 },
  interaction: { kind: 'numeric', source: 'exact-xyz' },
}), preview, 'identical preview input must be deterministic');

const scene = createEngineeringScene({ sceneId: 'move-preview-scene', revision, entities: [
  createEngineeringSceneEntity({ id: 'part-run', kind: 'segment', geometry: target.geometryParts[0].geometry,
    domainRef: { category: 'confirmed', componentId: 'COMP-1' } }),
  createEngineeringSceneEntity({ id: 'part-branch', kind: 'polyline', geometry: target.geometryParts[1].geometry,
    domainRef: { category: 'confirmed', componentId: 'COMP-1' } }),
  createEngineeringSceneEntity({ id: 'point-fitting', kind: 'point', geometry: createPointGeometry({ x: 20, y: 0, z: 0 }),
    domainRef: { category: 'confirmed', componentId: 'COMP-3' } }),
] });
const overlay = composeSequentialSingleEntityMoveDraftScene(scene, preview.draft);
assert.equal(overlay.entities.filter((row) => row.metadata?.engineeringSvgOverlay?.type === 'ghost').length, 2);
assert.equal(overlay.entities.filter((row) => row.metadata?.engineeringSvgOverlay?.type === 'draft').length, 2);
store.cancel('test-complete');
assert.equal(store.getPreview(), null);
assert.equal(store.getDraft().operationId, null);
assert.equal(store.destroy(), true);

console.log('Sequential single-entity move geometry and draft: ok');
