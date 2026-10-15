import assert from 'assert';
import { evaluateCiiSpatialMethod } from '../tabs/cii-workspace/cii-workspace-match-methods.js';

function edge(fromX, toX) {
  return {
    fromPos: { x: fromX, y: 0, z: 0 },
    toPos: { x: toX, y: 0, z: 0 },
  };
}

// Benchmark-faithful 205 geometry concept:
// source 200→205 = 0 → -1213.79
// target 20200→20205 = 0 → -1013.79
// One endpoint is unchanged and node 205 moves 200 mm. A midpoint-only method
// would see 100 mm and incorrectly pass at a 100 mm tolerance. M1 is node-
// coordinate based and therefore uses the maximum matched-endpoint displacement.
const source = edge(0, -1213.79);
const target = edge(0, -1013.79);
const result = evaluateCiiSpatialMethod(source, target, { spatialToleranceMm: 100 });
assert.strictEqual(result.available, true);
assert.strictEqual(result.orientation, 'DIRECT');
assert.deepStrictEqual(result.endpointDistancesMm, [0, 200]);
assert.strictEqual(result.distanceMm, 200);
assert.strictEqual(result.pass, false);

// Endpoint correspondence is orientation-independent for reversed element
// storage; reversing target FROM/TO must recover the same physical evidence.
const reversed = evaluateCiiSpatialMethod(source, edge(-1013.79, 0), { spatialToleranceMm: 100 });
assert.strictEqual(reversed.orientation, 'REVERSED');
assert.deepStrictEqual(reversed.endpointDistancesMm, [0, 200]);
assert.strictEqual(reversed.distanceMm, 200);
assert.strictEqual(reversed.pass, false);

console.log('CII M1 endpoint-coordinate spatial checks passed.');
