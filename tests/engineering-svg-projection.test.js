import assert from 'node:assert/strict';
import { createSegmentGeometry } from '../core/engineering-scene/index.js';
import {
  applyEngineeringSvgFit,
  createEngineeringSvgFit,
  createProjectedBounds,
  projectEngineeringGeometry,
  projectEngineeringPoint,
} from '../core/engineering-svg/index.js';

const point = { x: 10, y: 4, z: 2 };
assert.deepEqual(projectEngineeringPoint(point, 'XY'), { x: 10, y: 4, depth: 2 });
assert.deepEqual(projectEngineeringPoint(point, 'XZ'), { x: 10, y: 2, depth: 4 });
assert.deepEqual(projectEngineeringPoint(point, 'YZ'), { x: 4, y: 2, depth: 10 });
assert.deepEqual(projectEngineeringPoint(point, 'ISO'), {
  x: 6 * (Math.sqrt(3) / 2),
  y: 9,
  depth: 16,
});

const segment = projectEngineeringGeometry(
  createSegmentGeometry({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 5 }),
  'XZ',
);
assert.deepEqual(segment.points, [
  { x: 0, y: 0, depth: 0 },
  { x: 10, y: 5, depth: 0 },
]);

const bounds = createProjectedBounds([{ x: 0, y: 0 }, { x: 100, y: 50 }]);
const fit = createEngineeringSvgFit(bounds, { width: 200, height: 100 }, 10);
assert.equal(fit.scale, 1.6);
assert.deepEqual(applyEngineeringSvgFit({ x: 0, y: 0, depth: 0 }, fit), { x: 20, y: 90, depth: 0 });
assert.deepEqual(applyEngineeringSvgFit({ x: 100, y: 50, depth: 0 }, fit), { x: 180, y: 10, depth: 0 });

const degenerate = createEngineeringSvgFit(
  createProjectedBounds([{ x: 5, y: 7 }]),
  { width: 100, height: 100 },
  10,
);
assert.deepEqual(applyEngineeringSvgFit({ x: 5, y: 7, depth: 0 }, degenerate), { x: 50, y: 50, depth: 0 });
assert.throws(() => projectEngineeringPoint(point, 'PERSPECTIVE'), /Unsupported SVG projection/);

console.log('engineering SVG projection: ok');
