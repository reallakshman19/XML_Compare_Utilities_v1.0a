import assert from 'node:assert/strict';
import {
  SEQUENTIAL_MOVE_SNAP_MODE,
  SEQUENTIAL_MOVE_SNAP_REJECTION,
  createSequentialMoveSnapProfile,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-move-snap-contracts.js';
import { deriveSequentialMoveSnapIntersectionCandidates } from '../tabs/sequential-sketcher/scoped-edit/sequential-move-snap-intersections.js';

function segment(id, start, end, part = id) {
  return { segmentId: id, geometryPartId: part, componentId: `C-${id}`, start, end };
}
const profile = createSequentialMoveSnapProfile({
  enabledModes: [SEQUENTIAL_MOVE_SNAP_MODE.INTERSECTION], aperturePx: 20,
  maxIntersectionPairs: 10,
});
const crossing = [
  segment('A', { x: 0, y: 0, z: 0 }, { x: 10, y: 10, z: 0 }),
  segment('B', { x: 0, y: 10, z: 0 }, { x: 10, y: 0, z: 0 }),
];
const result = deriveSequentialMoveSnapIntersectionCandidates({
  segments: crossing, rawWorldPoint: { x: 4, y: 6, z: 0 }, constraint: 'XY', profile,
});
assert.equal(result.length, 1);
assert.deepEqual(result[0].metadata.sourceWorldPoint, { x: 5, y: 5, z: 0 });
assert.deepEqual(result[0].worldPoint, { x: 5, y: 5, z: 0 });
assert.equal(JSON.stringify(result), JSON.stringify(deriveSequentialMoveSnapIntersectionCandidates({
  segments: [...crossing].reverse(), rawWorldPoint: { x: 4, y: 6, z: 0 },
  constraint: 'XY', profile,
})));
const parallel = [
  segment('A', { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }),
  segment('B', { x: 0, y: 2, z: 0 }, { x: 10, y: 2, z: 0 }),
];
assert.equal(deriveSequentialMoveSnapIntersectionCandidates({
  segments: parallel, rawWorldPoint: { x: 0, y: 0, z: 0 }, constraint: 'XY', profile,
}).length, 0);
const outOfPlane = [crossing[0], segment('B', { x: 0, y: 10, z: 1 }, { x: 10, y: 0, z: 1 })];
assert.equal(deriveSequentialMoveSnapIntersectionCandidates({
  segments: outOfPlane, rawWorldPoint: { x: 0, y: 0, z: 0 }, constraint: 'XY', profile,
}).length, 0);
const smallEnvelope = createSequentialMoveSnapProfile({
  enabledModes: [SEQUENTIAL_MOVE_SNAP_MODE.INTERSECTION], aperturePx: 20,
  maxIntersectionPairs: 1,
});
assert.throws(() => deriveSequentialMoveSnapIntersectionCandidates({
  segments: [...crossing, segment('C', { x: 5, y: 0, z: 0 }, { x: 5, y: 10, z: 0 })],
  rawWorldPoint: { x: 0, y: 0, z: 0 }, constraint: 'XY', profile: smallEnvelope,
}), (error) => error.code === SEQUENTIAL_MOVE_SNAP_REJECTION.INTERSECTION_ENVELOPE);
assert.deepEqual(deriveSequentialMoveSnapIntersectionCandidates({
  segments: crossing, rawWorldPoint: { x: 0, y: 0, z: 0 }, constraint: 'X', profile,
}), []);

console.log('Sequential move snap intersections: ok');
