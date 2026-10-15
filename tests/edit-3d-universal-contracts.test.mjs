import assert from 'node:assert/strict';

import {
  EDIT_3D_CONSTRAINT_KIND,
  EDIT_3D_DRAG_REQUEST_V1,
  EDIT_3D_DRAG_RESULT_V1,
  EDIT_3D_DRAG_SESSION_V1,
  EDIT_3D_SESSION_STATUS,
  createEditDragSession,
  validateEdit3DDragRequest,
  validateEdit3DDragResult,
  validateEdit3DDragSession,
} from '../core/edit-3d/index.js';

let checked = 0;

function assertDeepFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child);
}

function planeRequest(kind = EDIT_3D_CONSTRAINT_KIND.CAMERA_PLANE) {
  return {
    schema: EDIT_3D_DRAG_REQUEST_V1,
    start: [1, 2, 3],
    maxDistance: 1000,
    constraint: { kind, planeNormal: [0, 0, 1] },
  };
}

function sessionRecord() {
  return {
    schema: EDIT_3D_DRAG_SESSION_V1,
    status: EDIT_3D_SESSION_STATUS.ACTIVE,
    start: [1, 2, 3],
    currentPoint: [1, 2, 3],
    lastValidPoint: [1, 2, 3],
    maxDistance: 1000,
    planeConstraint: { kind: EDIT_3D_CONSTRAINT_KIND.WORLD_PLANE, planeNormal: [0, 1, 0] },
    constraint: { kind: EDIT_3D_CONSTRAINT_KIND.AXIS, axis: [1, 0, 0] },
  };
}

assert.throws(() => validateEdit3DDragRequest({
  start: [0, 0, 0], maxDistance: 1,
  constraint: { kind: EDIT_3D_CONSTRAINT_KIND.CAMERA_PLANE, planeNormal: [0, 0, 1] },
}), TypeError);
checked += 1;

assert.throws(() => validateEdit3DDragRequest({
  ...planeRequest(), constraint: { kind: 'FREE_3D', planeNormal: [0, 0, 1] },
}), /Unknown Edit 3D constraint/);
checked += 1;

for (const request of [
  { ...planeRequest(), start: [0, Number.NaN, 0] },
  { ...planeRequest(), constraint: { kind: EDIT_3D_CONSTRAINT_KIND.WORLD_PLANE, planeNormal: [0, Infinity, 1] } },
]) {
  assert.throws(() => validateEdit3DDragRequest(request), TypeError);
  checked += 1;
}

assert.throws(() => validateEdit3DDragRequest({
  ...planeRequest(),
  constraint: {
    kind: EDIT_3D_CONSTRAINT_KIND.AXIS,
    axis: [0, 0, 0],
    planeKind: EDIT_3D_CONSTRAINT_KIND.CAMERA_PLANE,
    planeNormal: [0, 0, 1],
  },
}), RangeError);
checked += 1;

assert.throws(() => validateEdit3DDragRequest({
  ...planeRequest(), constraint: { kind: EDIT_3D_CONSTRAINT_KIND.CAMERA_PLANE, planeNormal: [0, 0, 0] },
}), RangeError);
checked += 1;

for (const maxDistance of [0, -1]) {
  assert.throws(() => validateEdit3DDragRequest({ ...planeRequest(), maxDistance }), RangeError);
  checked += 1;
}

const requests = [
  planeRequest(),
  planeRequest(EDIT_3D_CONSTRAINT_KIND.WORLD_PLANE),
  {
    ...planeRequest(),
    constraint: {
      kind: EDIT_3D_CONSTRAINT_KIND.AXIS,
      axis: [1, 0, 0],
      planeKind: EDIT_3D_CONSTRAINT_KIND.CAMERA_PLANE,
      planeNormal: [0, 0, 1],
    },
  },
];
for (const request of requests) {
  const validated = validateEdit3DDragRequest(request);
  assertDeepFrozen(validated);
  assertDeepFrozen(createEditDragSession(request));
  checked += 2;
}

const state = validateEdit3DDragSession(sessionRecord());
assertDeepFrozen(state);
checked += 1;

assert.throws(() => validateEdit3DDragResult({
  schema: EDIT_3D_DRAG_RESULT_V1,
  valid: true,
  reason: '',
  point: null,
  constraint: { kind: EDIT_3D_CONSTRAINT_KIND.AXIS, axis: [1, 0, 0] },
}), /valid result must contain a point/);
checked += 1;

const result = validateEdit3DDragResult({
  schema: EDIT_3D_DRAG_RESULT_V1,
  valid: false,
  reason: 'AXIS_PARALLEL',
  point: [1, 2, 3],
  constraint: { kind: EDIT_3D_CONSTRAINT_KIND.AXIS, axis: [1, 0, 0] },
});
assertDeepFrozen(result);
checked += 1;

console.log(`edit-3d-universal-contracts.test.mjs passed (${checked} contract cases)`);
