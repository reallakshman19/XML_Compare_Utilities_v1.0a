import assert from 'node:assert/strict';
import { buildTable2PipelineCadSnapPrimitives, buildTable3PipelineCadSnapPrimitives } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-object-snap-adapters.js';

const table2 = {
  currentNodes: () => [
    { id: 'a', x: 0, y: 0 }, { id: 'b', x: 10, y: 10 },
    { id: 'c', x: 0, y: 10 }, { id: 'd', x: 10, y: 0 },
  ],
};
const two = buildTable2PipelineCadSnapPrimitives(table2);
assert.equal(two.segments.length, 3);
assert.equal(two.points.filter((item) => item.mode === 'endpoint').length, 4);
assert.equal(two.points.filter((item) => item.mode === 'station').length, 4);
assert.ok(two.points.some((item) => item.mode === 'intersection' && Math.abs(item.worldPoint.x - 5) < 1e-9));
assert.ok(Object.isFrozen(two.points));

const table3 = {
  bounds: { minX: 0, maxX: 20 },
  model: { coordinateMap: { anchors: [{ cumulative: 0, absoluteH: 100 }, { cumulative: 20, absoluteH: 120 }] } },
  depthNodes: () => [{ id: 'z1', x: 0, y: 1 }, { id: 'z2', x: 10, y: -1 }, { id: 'z3', x: 20, y: -2 }],
  markerNodes: () => [{ id: 'm1', x: 8, y: 0.75 }],
};
const three = buildTable3PipelineCadSnapPrimitives(table3);
assert.equal(three.points.filter((item) => item.mode === 'endpoint').length, 3);
assert.equal(three.points.filter((item) => item.mode === 'marker').length, 1);
assert.equal(three.points.filter((item) => item.mode === 'station').length, 2);
assert.ok(three.points.some((item) => item.mode === 'intersection' && Math.abs(item.worldPoint.x - 5) < 1e-9));
console.log('Pipeline CAD Object Snap adapter tests passed');
