import assert from 'node:assert/strict';
import {
  createSequentialRotationBoundaryDiagnosis,
  createSequentialRotationTransform,
  rotateSequentialGeometry,
  rotateSequentialPoint,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-rotation-geometry.js';

const point = (x, y, z = 0) => ({ x, y, z });
const z90 = createSequentialRotationTransform({
  pivot: point(0, 0), axis: point(0, 0, 1), angleDegrees: 90,
});
assert.deepEqual(rotateSequentialPoint(point(1, 0), z90), point(0, 1));
assert.deepEqual(rotateSequentialGeometry({ kind: 'point', position: point(2, 0) }, z90),
  { kind: 'point', position: point(0, 2) });
assert.deepEqual(rotateSequentialGeometry({ kind: 'segment',
  start: point(1, 0), end: point(2, 0) }, z90),
{ kind: 'segment', start: point(0, 1), end: point(0, 2) });
assert.deepEqual(rotateSequentialGeometry({ kind: 'polyline',
  points: [point(1, 0), point(2, 0), point(2, 1)] }, z90),
{ kind: 'polyline', points: [point(0, 1), point(0, 2), point(-1, 2)] });
const arbitrary = createSequentialRotationTransform({
  pivot: point(0, 0), axis: point(1, 1, 1), angleDegrees: 120,
});
const cycled = rotateSequentialPoint(point(1, 0, 0), arbitrary);
assert(Math.abs(cycled.x) < 2e-12 && Math.abs(cycled.y - 1) < 2e-12 && cycled.z === 0);
assert.throws(() => createSequentialRotationTransform({
  pivot: point(0, 0), axis: point(0, 0, 0), angleDegrees: 10,
}), (error) => error.code === 'SEQUENTIAL_ROTATION_AXIS_INVALID');
assert.throws(() => createSequentialRotationTransform({
  pivot: point(0, 0), axis: point(0, 0, 1), angleDegrees: 360,
}), (error) => error.code === 'SEQUENTIAL_ROTATION_ANGLE_NO_CHANGE');
const boundary = [{ boundaryId: 'B1', connectionId: 'C1',
  selectedPortId: 'P1', stationaryPortId: 'P2',
  selectedPosition: point(10, 0), stationaryPosition: point(10, 0) }];
assert.equal(createSequentialRotationBoundaryDiagnosis(boundary,
  createSequentialRotationTransform({ pivot: point(10, 0), axis: point(0, 0, 1),
    angleDegrees: 90 })).aggregateDisposition, 'PRESERVED');
assert.equal(createSequentialRotationBoundaryDiagnosis(boundary, z90)
  .aggregateDisposition, 'WOULD_DISCONNECT');
console.log('Sequential rotation geometry: ok');
