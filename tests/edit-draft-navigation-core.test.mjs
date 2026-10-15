/** Pure navigation and Edit Draft drag-solver regressions at plant coordinates. */

import assert from 'node:assert/strict';
import {
  createViewerNavigationState, sameViewerNavigationState, validateViewerNavigationState,
  viewToWorldCoordinates, worldToViewCoordinates,
} from '../workbench3d/viewer/workbench-navigation-state.js';
import {
  closestLineParameter, EDIT_DRAG_THRESHOLD_PX, pointerTravel, rayPlaneIntersection, solveEditDrag,
} from '../tabs/topology-trace-validator/topology-edit-drag-solver.js';

const origin = [438000, -1139000, 1000];
const world = [438023.221, -1139222.202, 1184.15];
const local = worldToViewCoordinates(world, origin);
assert.deepEqual(local.map((value) => Number(value.toFixed(6))), [23.221, -222.202, 184.15]);
assert.deepEqual(viewToWorldCoordinates(local, origin), world);

const state = createViewerNavigationState({
  cameraPositionWorld: [438023.221, -1138222.202, 2184.15],
  cameraTargetWorld: world, pivotWorld: null,
  cameraType: 'Perspective', verticalAxis: 'Z', projectionScale: 55,
});
assert.deepEqual(validateViewerNavigationState(state), []);
assert.ok(validateViewerNavigationState({ ...state, cameraTargetWorld: state.cameraPositionWorld }).length > 0);
assert.ok(validateViewerNavigationState({ ...state, projectionScale: Number.NaN }).length > 0);
const pivotState = createViewerNavigationState({ ...state, pivotWorld: world });
assert.equal(sameViewerNavigationState(state, pivotState, 1e-6), false);

assert.equal(EDIT_DRAG_THRESHOLD_PX, 5);
assert.equal(pointerTravel([10, 10], { clientX: 13, clientY: 14 }), 5);
assert.ok(pointerTravel([10, 10], { clientX: 13, clientY: 13 }) < EDIT_DRAG_THRESHOLD_PX);

const ray = { origin: [438023.221, -1139222.202, 2184.15], direction: [0, 0, -1] };
const plane = rayPlaneIntersection(ray, world, [0, 0, 1], 5000);
assert.equal(plane.valid, true);
assert.deepEqual(plane.point, world);
assert.equal(rayPlaneIntersection({ ...ray, direction: [1, 0, 0] }, world, [0, 0, 1], 5000).reason, 'RAY_PARALLEL');
assert.equal(rayPlaneIntersection({ ...ray, direction: [0, 0, 1] }, world, [0, 0, 1], 5000).reason, 'BEHIND_CAMERA');
assert.equal(rayPlaneIntersection(ray, world, [0, 0, 1], 100).reason, 'RAY_DISTANCE_LIMIT');
assert.equal(rayPlaneIntersection({ ...ray, origin: [Number.NaN, 0, 0] }, world, [0, 0, 1], 5000).reason, 'NON_FINITE_INPUT');

const retained = solveEditDrag({
  ray: { ...ray, direction: [1, 0, 0] }, start: world, planeNormal: [0, 0, 1],
  axis: null, maxDistance: 5000, lastValid: [1, 2, 3],
});
assert.equal(retained.valid, false);
assert.deepEqual(retained.point, [1, 2, 3]);

const fraction = closestLineParameter(
  { origin: [438028.221, -1139212.202, 1189.15], direction: [0, -1, -0.5] },
  world, [10, 0, 0],
);
assert.ok(fraction !== null && fraction >= 0 && fraction <= 1);
assert.equal(closestLineParameter({ origin: world, direction: [1, 0, 0] }, world, [10, 0, 0]), null);

console.log('edit-draft-navigation-core.test.mjs passed');
