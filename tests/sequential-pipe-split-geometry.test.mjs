import assert from 'node:assert/strict';
import {
  createSequentialPipeSplitGeometry,
  createSequentialPipeSplitLocation,
  SEQUENTIAL_PIPE_SPLIT_GEOMETRY_REJECTION,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-pipe-split-geometry.js';

const segment = { kind: 'segment', start: { x: 0, y: 0, z: 0 },
  end: { x: 100, y: 0, z: 0 } };
const parameter = createSequentialPipeSplitGeometry({ geometry: segment,
  mode: 'PARAMETER', parameter: 0.25, minimumEndDistance: 10 });
assert.deepEqual(parameter.location.position, { x: 25, y: 0, z: 0 });
assert.equal(parameter.location.upstreamLength, 25);
assert.equal(parameter.location.downstreamLength, 75);
assert.deepEqual(parameter.upstream.end, parameter.location.position);
assert.deepEqual(parameter.downstream.start, parameter.location.position);
assert(Object.isFrozen(parameter.location));

const acquired = createSequentialPipeSplitLocation({ geometry: segment,
  mode: 'ACQUIRED_POINT', acquiredPoint: { x: 40, y: 0.0001, z: 0 },
  projectionTolerance: 0.001, minimumEndDistance: 5 });
assert.equal(acquired.parameter, 0.4);
assert.deepEqual(acquired.position, { x: 40, y: 0, z: 0 });
assert(acquired.projectionResidual > 0);
assert.equal(createSequentialPipeSplitLocation({ geometry: segment,
  mode: 'PARAMETER', parameter: 0.25, minimumEndDistance: 10 }).locationFingerprint,
parameter.location.locationFingerprint);

assert.throws(() => createSequentialPipeSplitLocation({ geometry: segment,
  mode: 'PARAMETER', parameter: 0, minimumEndDistance: 1 }),
(error) => error.code === SEQUENTIAL_PIPE_SPLIT_GEOMETRY_REJECTION.END_DISTANCE);
assert.throws(() => createSequentialPipeSplitLocation({ geometry: segment,
  mode: 'PARAMETER', parameter: 0.02, minimumEndDistance: 5 }),
(error) => error.code === SEQUENTIAL_PIPE_SPLIT_GEOMETRY_REJECTION.END_DISTANCE);
assert.throws(() => createSequentialPipeSplitLocation({ geometry: segment,
  mode: 'ACQUIRED_POINT', acquiredPoint: { x: 50, y: 2, z: 0 },
  projectionTolerance: 0.1, minimumEndDistance: 1 }),
(error) => error.code === SEQUENTIAL_PIPE_SPLIT_GEOMETRY_REJECTION.PROJECTION_MISS);
assert.throws(() => createSequentialPipeSplitLocation({ geometry: {
  kind: 'segment', start: { x: 1, y: 1, z: 1 }, end: { x: 1, y: 1, z: 1 },
}, mode: 'PARAMETER', parameter: 0.5 }),
(error) => error.code === SEQUENTIAL_PIPE_SPLIT_GEOMETRY_REJECTION.SEGMENT_INVALID);
assert.throws(() => createSequentialPipeSplitLocation({ geometry: segment,
  mode: 'PARAMETER', parameter: '' }), /must be finite/);

console.log('Sequential pipe split geometry: ok');
