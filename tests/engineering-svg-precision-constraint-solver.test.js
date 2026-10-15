import assert from 'node:assert/strict';
import { createEngineeringGeometryConstraint } from '../core/engineering-scene/index.js';
import {
  projectEngineeringSvgDirection,
  solveEngineeringSvgConstraintDrag,
} from '../core/engineering-svg/precision-runtime.js';

const fit = Object.freeze({ scale: 2, offsetX: 100, offsetY: 100 });
const xVector = projectEngineeringSvgDirection({ x: 1, y: 0, z: 0 }, 'XY', fit);
const yVector = projectEngineeringSvgDirection({ x: 0, y: 1, z: 0 }, 'XY', fit);
assert.deepEqual(xVector, { x: 2, y: 0, length: 2, direction: { x: 1, y: 0, z: 0 } });
assert.deepEqual(yVector, { x: 0, y: -2, length: 2, direction: { x: 0, y: 1, z: 0 } });
assert.throws(
  () => projectEngineeringSvgDirection({ x: 0, y: 0, z: 1 }, 'XY', fit),
  /not visible in XY projection/,
);

const axis = solveEngineeringSvgConstraintDrag({
  start: { x: 0, y: 0 },
  current: { x: 20, y: 6 },
  projection: 'XY',
  fit,
  constraint: createEngineeringGeometryConstraint({ kind: 'axis', axis: 'X' }),
});
assert.deepEqual(axis.parameters, [10]);
assert.deepEqual(axis.worldDelta, { x: 10, y: 0, z: 0 });
assert.deepEqual(axis.screenResidual, { x: 0, y: 6 });

const plane = solveEngineeringSvgConstraintDrag({
  start: { x: 10, y: 10 },
  current: { x: 30, y: 0 },
  projection: 'XY',
  fit,
  constraint: createEngineeringGeometryConstraint({ kind: 'plane', axes: ['X', 'Y'] }),
});
assert.deepEqual(plane.parameters, [10, 5]);
assert.deepEqual(plane.worldDelta, { x: 10, y: 5, z: 0 });
assert.deepEqual(plane.screenResidual, { x: 0, y: 0 });
assert.throws(() => solveEngineeringSvgConstraintDrag({
  start: { x: 0, y: 0 }, current: { x: 1, y: 1 }, projection: 'XY', fit,
  constraint: createEngineeringGeometryConstraint({ kind: 'plane', axes: ['X', 'Z'] }),
}), /not visible in XY projection/);

let resolverCalls = 0;
const path = solveEngineeringSvgConstraintDrag({
  start: { x: 0, y: 0 },
  current: { x: 14, y: 0 },
  projection: 'XY',
  fit,
  constraint: createEngineeringGeometryConstraint({ kind: 'path', referenceId: 'route-1' }),
  resolveReferenceVector(request) {
    resolverCalls += 1;
    assert.deepEqual({ kind: request.kind, referenceId: request.referenceId }, {
      kind: 'path', referenceId: 'route-1',
    });
    return { x: 7, y: 0, z: 0 };
  },
});
assert.equal(resolverCalls, 1);
assert.deepEqual(path.worldDelta, { x: 7, y: 0, z: 0 });
assert.deepEqual(path.parameters, [7]);

const normal = solveEngineeringSvgConstraintDrag({
  start: { x: 0, y: 0 },
  current: { x: 0, y: -8 },
  projection: 'XZ',
  fit,
  constraint: createEngineeringGeometryConstraint({ kind: 'normal', referenceId: 'surface-1' }),
  resolveReferenceVector: () => ({ x: 0, y: 0, z: 10 }),
});
assert.deepEqual(normal.worldDelta, { x: 0, y: 0, z: 4 });
assert.deepEqual(normal.parameters, [4]);
assert.throws(() => solveEngineeringSvgConstraintDrag({
  start: { x: 0, y: 0 }, current: { x: 1, y: 0 }, projection: 'XY', fit,
  constraint: createEngineeringGeometryConstraint({ kind: 'path', referenceId: 'route-1' }),
}), /requires resolveReferenceVector/);
assert.throws(() => solveEngineeringSvgConstraintDrag({
  start: { x: 0, y: 0 }, current: { x: 1, y: 0 }, projection: 'XY', fit: { scale: 0 },
  constraint: createEngineeringGeometryConstraint({ kind: 'axis', axis: 'X' }),
}), /finite positive SVG fit/);
assert.deepEqual(JSON.parse(JSON.stringify(plane)), plane);
assert.equal(JSON.stringify(solveEngineeringSvgConstraintDrag({
  start: { x: 10, y: 10 }, current: { x: 30, y: 0 }, projection: 'XY', fit,
  constraint: createEngineeringGeometryConstraint({ kind: 'plane', axes: ['X', 'Y'] }),
})), JSON.stringify(plane));

console.log('engineering SVG precision constraint solver: ok');
