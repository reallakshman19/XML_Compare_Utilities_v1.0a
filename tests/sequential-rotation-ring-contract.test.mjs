import assert from 'node:assert/strict';
import {
  assertSequentialRotationRingStart,
  createSequentialRotationRingModel,
  createSequentialRotationRingStart,
  SEQUENTIAL_ROTATION_RING_AXES,
  sequentialRotationTargetPivot,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-rotation-ring-contract.js';
import { SEQUENTIAL_ROTATION_TARGET_SCHEMA }
  from '../tabs/sequential-sketcher/scoped-edit/sequential-rotation-target.js';

const target = Object.freeze({
  schema: SEQUENTIAL_ROTATION_TARGET_SCHEMA,
  rotationTargetId: 'ROTATION-TARGET-1', authorityId: 'AUTH-1',
  sceneRevision: 'SCENE-1', geometryFingerprint: 'GEOMETRY-1',
  scope: 'COMPONENT_ONLY', affectedComponentIds: ['PIPE-1'],
  geometryParts: Object.freeze([
    Object.freeze({ geometryPartId: 'PART-1', componentId: 'PIPE-1',
      geometry: Object.freeze({ kind: 'segment',
        start: Object.freeze({ x: 0, y: 0, z: 0 }),
        end: Object.freeze({ x: 100, y: 0, z: 0 }) }) }),
    Object.freeze({ geometryPartId: 'PART-2', componentId: 'PIPE-1',
      geometry: Object.freeze({ kind: 'point', position: Object.freeze({ x: 50, y: 50, z: 0 }) }) }),
  ]),
});

assert.deepEqual(SEQUENTIAL_ROTATION_RING_AXES, ['X', 'Y', 'Z']);
assert.deepEqual(sequentialRotationTargetPivot(target), { x: 50, y: 50 / 3, z: 0 });
const first = createSequentialRotationRingModel(target);
const second = createSequentialRotationRingModel(target);
assert.equal(first.ringModelId, second.ringModelId);
assert.deepEqual(first.rings.map((ring) => ring.axisId), ['X', 'Y', 'Z']);
assert.deepEqual(first.rings.map((ring) => ring.planeAxes), [['Y', 'Z'], ['X', 'Z'], ['X', 'Y']]);

const editedPivot = { x: 25, y: 30, z: 5 };
const edited = createSequentialRotationRingModel(target, editedPivot);
assert.deepEqual(edited.pivot, editedPivot);
assert.notEqual(edited.ringModelId, first.ringModelId);
const start = createSequentialRotationRingStart({
  target, pivot: editedPivot, axisId: 'Y',
  pointer: { pointerId: 7, clientX: 120, clientY: 80 },
});
assert.equal(start.axisId, 'Y');
assert.deepEqual(start.axis, { x: 0, y: 1, z: 0 });
assert.equal(assertSequentialRotationRingStart(start, target, editedPivot).ringStartId,
  start.ringStartId);
assert.throws(() => assertSequentialRotationRingStart({ ...start, authorityId: 'OTHER' },
  target, editedPivot), /differs from current rotation authority/);
assert.throws(() => createSequentialRotationRingStart({
  target, pivot: editedPivot, axisId: 'XY',
  pointer: { pointerId: 1, clientX: 0, clientY: 0 },
}), /Unsupported rotation ring axis/);

console.log('Sequential rotation ring contract: ok');
