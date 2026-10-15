import assert from 'node:assert/strict';

import {
  EDIT_3D_CONSTRAINT_KIND,
  EDIT_3D_DRAG_REQUEST_V1,
  EDIT_3D_FAILURE_REASON,
  createEditDragSession,
  solveEditDrag,
} from '../core/edit-3d/index.js';

const START = Object.freeze([20, -30, 10]);
const NORMAL = Object.freeze([0, 0, 1]);
const MAX_DISTANCE = 10000;
let planeCases = 0, axisCases = 0, transitionCases = 0, cancellationCases = 0, retentionCases = 0;

function deepFrozen(value) {
  if (!value || typeof value !== 'object') return true;
  return Object.isFrozen(value) && Object.values(value).every(deepFrozen);
}

function assertKernelValue(value) {
  assert.equal(deepFrozen(value), true);
  assert.doesNotThrow(() => JSON.stringify(value));
  const visit = (entry) => {
    if (!entry || typeof entry !== 'object') return;
    assert.equal(entry instanceof Map || entry instanceof Set, false);
    for (const child of Object.values(entry)) {
      assert.notEqual(typeof child, 'function');
      visit(child);
    }
  };
  visit(value);
}

function ray(index) {
  return {
    origin: [index % 97, (index * 7) % 89, 100 + (index % 83)],
    direction: [1 + (index % 3), (index % 5) - 2, -1 - (index % 7)],
  };
}

function planeRequest(index) {
  return {
    schema: EDIT_3D_DRAG_REQUEST_V1,
    start: [...START],
    maxDistance: MAX_DISTANCE,
    constraint: {
      kind: index % 2 ? EDIT_3D_CONSTRAINT_KIND.CAMERA_PLANE
        : EDIT_3D_CONSTRAINT_KIND.WORLD_PLANE,
      planeNormal: [...NORMAL],
    },
  };
}

function axisFor(index) {
  return index % 2 ? [1, 0, 0] : [0, 1, 0];
}

function axisRequest(index) {
  return {
    schema: EDIT_3D_DRAG_REQUEST_V1,
    start: [...START],
    maxDistance: MAX_DISTANCE,
    constraint: {
      kind: EDIT_3D_CONSTRAINT_KIND.AXIS,
      axis: axisFor(index),
      planeKind: EDIT_3D_CONSTRAINT_KIND.WORLD_PLANE,
      planeNormal: [...NORMAL],
    },
  };
}

function baseline(rayValue, axis, lastValid = START) {
  return solveEditDrag({
    ray: rayValue,
    start: START,
    planeNormal: NORMAL,
    axis,
    maxDistance: MAX_DISTANCE,
    lastValid,
  });
}

function assertPreserved(actual, expected) {
  assert.equal(actual.valid, expected.valid);
  assert.equal(actual.reason, expected.reason);
  assert.deepEqual(actual.point, expected.point);
}

function solveDeterministically(request, rayValue, expected) {
  const before = JSON.stringify({ request, rayValue });
  const first = createEditDragSession(request);
  const second = createEditDragSession(request);
  const result = first.solve(rayValue);
  const repeated = first.solve(rayValue);
  const twin = second.solve(rayValue);
  assertPreserved(result, expected);
  assert.deepEqual(repeated, result);
  assert.deepEqual(twin, result);
  assert.deepEqual(first.getState(), second.getState());
  assertKernelValue(result);
  assertKernelValue(first.getState());
  assert.equal(JSON.stringify({ request, rayValue }), before);
}

for (let index = 0; index < 5000; index += 1) {
  const request = planeRequest(index), rayValue = ray(index);
  solveDeterministically(request, rayValue, baseline(rayValue, null));
  planeCases += 1;
}

for (let index = 0; index < 5000; index += 1) {
  const request = axisRequest(index), rayValue = ray(index);
  solveDeterministically(request, rayValue, baseline(rayValue, axisFor(index)));
  axisCases += 1;
}

function assertFailureRetention(session, rayValue, reason) {
  const before = session.getState();
  const first = session.solve(rayValue);
  const repeated = session.solve(rayValue);
  assert.equal(first.valid, false);
  assert.equal(first.reason, reason);
  assert.deepEqual(first.point, before.lastValidPoint);
  assert.deepEqual(repeated, first);
  assert.deepEqual(session.getState(), before);
  assertKernelValue(first);
  retentionCases += 1;
}

const retentionSession = createEditDragSession(planeRequest(1));
retentionSession.solve(ray(404));
assertFailureRetention(retentionSession,
  { origin: [0, 0, 100], direction: [1, 0, 0] }, 'RAY_PARALLEL');
retentionSession.setAxis([1, 0, 0]);
assertFailureRetention(retentionSession,
  { origin: [0, 0, 100], direction: [1, 0, 0] }, 'AXIS_PARALLEL');
assertFailureRetention(retentionSession,
  { origin: [0, Number.NaN, 0], direction: [0, 0, -1] }, 'NON_FINITE_INPUT');

function runTransition(request, axis, axisRay, planeRay) {
  const session = createEditDragSession(request);
  const originalPlane = session.getState().planeConstraint;
  const axisState = session.setAxis(axis);
  assertKernelValue(axisState);
  assert.deepEqual(axisState.planeConstraint, originalPlane);
  const axisResult = session.solve(axisRay);
  assertPreserved(axisResult, baseline(axisRay, axis));
  const planeState = session.clearAxis();
  assertKernelValue(planeState);
  assert.deepEqual(planeState.constraint, originalPlane);
  assert.deepEqual(planeState.planeConstraint, originalPlane);
  const planeExpected = baseline(planeRay, null, axisResult.valid ? axisResult.point : START);
  const planeResult = session.solve(planeRay);
  assertPreserved(planeResult, planeExpected);
  assertKernelValue(axisResult);
  assertKernelValue(planeResult);
  assertKernelValue(session.getState());
  return { axisState, axisResult, planeState, planeResult, state: session.getState() };
}

for (let index = 0; index < 1000; index += 1) {
  const request = planeRequest(index), axis = axisFor(index);
  const axisRay = ray(index + 101), planeRay = ray(index + 202);
  const before = JSON.stringify({ request, axis, axisRay, planeRay });
  assert.deepEqual(runTransition(request, axis, axisRay, planeRay),
    runTransition(request, axis, axisRay, planeRay));
  assert.equal(JSON.stringify({ request, axis, axisRay, planeRay }), before);
  transitionCases += 1;
}

for (let index = 0; index < 1000; index += 1) {
  const request = planeRequest(index), rayValue = ray(index + 303);
  const before = JSON.stringify({ request, rayValue });
  const session = createEditDragSession(request);
  const solved = session.solve(rayValue);
  const cancelled = session.cancel();
  const repeatedCancel = session.cancel();
  const failed = session.solve(rayValue);
  const repeatedFailure = session.solve(rayValue);
  assert.deepEqual(repeatedCancel, cancelled);
  assert.equal(failed.valid, false);
  assert.equal(failed.reason, EDIT_3D_FAILURE_REASON.SESSION_CANCELLED);
  assert.deepEqual(failed.point, solved.point);
  assert.deepEqual(repeatedFailure, failed);
  assert.deepEqual(session.setAxis([1, 0, 0]), cancelled);
  assert.deepEqual(session.clearAxis(), cancelled);
  assert.deepEqual(session.getState(), cancelled);
  assertKernelValue(cancelled);
  assertKernelValue(failed);
  assert.equal(JSON.stringify({ request, rayValue }), before);
  cancellationCases += 1;
}

assert.deepEqual({ planeCases, axisCases, transitionCases, cancellationCases, retentionCases }, {
  planeCases: 5000, axisCases: 5000, transitionCases: 1000, cancellationCases: 1000,
  retentionCases: 3,
});
console.log('edit-3d-universal-session.test.mjs passed '
  + `(${planeCases} plane, ${axisCases} axis, ${transitionCases} transitions, `
  + `${cancellationCases} cancellations, ${retentionCases} retention cases)`);
