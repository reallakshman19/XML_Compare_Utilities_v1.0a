import assert from 'node:assert/strict';
import { createPointGeometry, createPolylineGeometry, createSegmentGeometry } from '../core/engineering-scene/index.js';
import { createSequentialNodeStretchGeometry, regenerateSequentialNodeStretchPart } from '../tabs/sequential-sketcher/scoped-edit/sequential-node-stretch-geometry.js';
const p = (x, y = 0, z = 0) => ({ x, y, z });
const profile = { minimumLengthMm: 1, zeroLengthToleranceMm: 1e-9,
  collinearityTolerance: 1e-9 };
const segment = regenerateSequentialNodeStretchPart({ geometryPartId: 'G1', componentId: 'P1',
  canonicalType: 'PIPE', nodeId: 'N1', nodeIds: ['N0', 'N1'],
  geometry: createSegmentGeometry(p(0), p(10)) }, p(15), profile);
assert.deepEqual(segment.draftGeometry.end, p(15));
assert.deepEqual(segment.draftGeometry.start, p(0));
const point = regenerateSequentialNodeStretchPart({ geometryPartId: 'G2', componentId: 'C1',
  canonicalType: 'CAP', nodeId: 'N1', nodeIds: ['N1'], geometry: createPointGeometry(p(10)) },
 p(12, 1), profile);
assert.deepEqual(point.draftGeometry.position, p(12, 1));
const polyline = regenerateSequentialNodeStretchPart({ geometryPartId: 'G3', componentId: 'E1',
  canonicalType: 'ELBOW', nodeId: 'N1', nodeIds: ['N1', 'NI', 'N2'],
  geometry: createPolylineGeometry([p(10), p(12, 2), p(10, 10)]) }, p(11), profile);
assert.deepEqual(polyline.draftGeometry.points[0], p(11));
assert.deepEqual(polyline.draftGeometry.points.slice(1), [p(12, 2), p(10, 10)]);
const result = createSequentialNodeStretchGeometry({ nodeId: 'N1', originalPosition: p(10),
  targetPosition: p(11), profile, geometryParts: [{ geometryPartId: 'G1', componentId: 'P1',
    canonicalType: 'PIPE', nodeIds: ['N0', 'N1'], geometry: createSegmentGeometry(p(0), p(10)) }] });
assert.equal(result.delta.x, 1); assert.equal(result.noChange, false);
assert.throws(() => createSequentialNodeStretchGeometry({ nodeId: 'N1', originalPosition: p(10),
  targetPosition: p(0), profile, geometryParts: [{ geometryPartId: 'G1', componentId: 'P1',
    canonicalType: 'PIPE', nodeIds: ['N0', 'N1'], geometry: createSegmentGeometry(p(0), p(10)) }] }),
(error) => error.code === 'SEQUENTIAL_NODE_STRETCH_ZERO_LENGTH');
assert.throws(() => regenerateSequentialNodeStretchPart({ geometryPartId: 'G4', componentId: 'P2',
  canonicalType: 'PIPE', nodeId: 'N1', nodeIds: ['N0', 'N1', 'N2'],
  geometry: createPolylineGeometry([p(0), p(5), p(10)]) }, p(5, 1), profile),
(error) => error.code === 'SEQUENTIAL_NODE_STRETCH_COLLINEARITY');
assert.throws(() => createSequentialNodeStretchGeometry({ nodeId: 'N1', originalPosition: p(10),
  targetPosition: { x: '', y: 0, z: 0 }, profile, geometryParts: [] }), TypeError);
console.log('Sequential node stretch geometry: ok');
