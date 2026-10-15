import assert from 'node:assert/strict';
import {
  assertSequentialMoveManipulatorHandleStart,
  createSequentialMoveManipulator,
  createSequentialMoveManipulatorHandleStart,
  SEQUENTIAL_MOVE_MANIPULATOR_HANDLES,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-move-manipulator-contract.js';
import { SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_SCHEMA }
  from '../tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-target.js';

const target = Object.freeze({
  schema: SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_SCHEMA,
  moveTargetId: 'MOVE-TARGET-1',
  componentId: 'PIPE-1',
  authorityId: 'AUTH-1',
  sceneRevision: 'SCENE-1',
  geometryFingerprint: 'GEOMETRY-1',
  geometryPartIds: ['PART-1'],
  geometryParts: Object.freeze([{
    geometryPartId: 'PART-1',
    role: 'primary',
    geometry: Object.freeze({
      kind: 'segment',
      start: Object.freeze({ x: 0, y: 0, z: 0 }),
      end: Object.freeze({ x: 100, y: 0, z: 0 }),
    }),
  }]),
});

const first = createSequentialMoveManipulator(target);
const second = createSequentialMoveManipulator(target);
assert.deepEqual(first, second);
assert.equal(first.manipulatorId, second.manipulatorId);
assert.deepEqual(first.pivot, { x: 50, y: 0, z: 0 });
assert.equal(first.projectionSpan, 50);
assert.deepEqual(first.handles.map((row) => row.handleId),
  SEQUENTIAL_MOVE_MANIPULATOR_HANDLES);
assert.equal(first.handles.length, 6);
assert.deepEqual(first.handles.find((row) => row.handleId === 'X').constraint,
  { schema: 'SequentialMoveConstraint.v1', kind: 'axis', axis: 'X' });
assert.deepEqual(first.handles.find((row) => row.handleId === 'YZ').constraint,
  { schema: 'SequentialMoveConstraint.v1', kind: 'plane', plane: 'YZ', axes: ['Y', 'Z'] });

const start = createSequentialMoveManipulatorHandleStart({
  target,
  handleId: 'XZ',
  pointer: { pointerId: 7, clientX: 120, clientY: 80 },
});
assert.equal(assertSequentialMoveManipulatorHandleStart(start, target).handleStartId,
  start.handleStartId);
assert.equal(start.handleId, 'XZ');
assert.deepEqual(start.constraint,
  { schema: 'SequentialMoveConstraint.v1', kind: 'plane', plane: 'XZ', axes: ['X', 'Z'] });

assert.throws(() => createSequentialMoveManipulatorHandleStart({
  target, handleId: 'SCALE', pointer: { pointerId: 1, clientX: 0, clientY: 0 },
}), /Unsupported translation manipulator handle/);
assert.throws(() => assertSequentialMoveManipulatorHandleStart({
  ...start, authorityId: 'OTHER',
}, target), /differs from current move authority/);
assert.throws(() => createSequentialMoveManipulator({ ...target, schema: 'Other.v1' }),
  /Manipulator target must use/);

console.log('Sequential move manipulator contract: ok');
