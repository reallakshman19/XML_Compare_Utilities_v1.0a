import assert from 'node:assert/strict';
import { createSequentialRotationRingStart }
  from '../tabs/sequential-sketcher/scoped-edit/sequential-rotation-ring-contract.js';
import {
  createSequentialRotationDragSession,
  solveSequentialRotationDrag,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-rotation-drag.js';
import { SEQUENTIAL_ROTATION_TARGET_SCHEMA }
  from '../tabs/sequential-sketcher/scoped-edit/sequential-rotation-target.js';

const target = Object.freeze({
  schema: SEQUENTIAL_ROTATION_TARGET_SCHEMA,
  rotationTargetId: 'ROTATION-TARGET-1', authorityId: 'AUTH-1',
  sceneRevision: 'SCENE-1', geometryFingerprint: 'GEOMETRY-1',
  scope: 'COMPONENT_ONLY', affectedComponentIds: ['PIPE-1'],
  geometryParts: Object.freeze([{ geometry: Object.freeze({ kind: 'segment',
    start: Object.freeze({ x: -1, y: 0, z: 0 }),
    end: Object.freeze({ x: 1, y: 0, z: 0 }) }) }]),
});
const pivot = Object.freeze({ x: 0, y: 0, z: 0 });
const zSolution = solveSequentialRotationDrag({
  pivot, axis: { x: 0, y: 0, z: 1 },
  startRay: { origin: { x: 1, y: 0, z: 10 }, direction: { x: 0, y: 0, z: -1 } },
  currentRay: { origin: { x: 0, y: 1, z: 10 }, direction: { x: 0, y: 0, z: -1 } },
  profile: { boundaryTolerance: 1e-9 },
});
assert.equal(zSolution.transform.angleDegrees, 90);
const wrapped = solveSequentialRotationDrag({
  pivot, axis: { x: 0, y: 0, z: 1 },
  startRay: { origin: { x: -1, y: .01, z: 10 }, direction: { x: 0, y: 0, z: -1 } },
  currentRay: { origin: { x: -1, y: -.01, z: 10 }, direction: { x: 0, y: 0, z: -1 } },
  profile: { boundaryTolerance: 1e-9 },
});
assert.ok(wrapped.transform.angleDegrees > 0 && wrapped.transform.angleDegrees < 2);
assert.throws(() => solveSequentialRotationDrag({
  pivot, axis: { x: 1, y: 0, z: 0 },
  startRay: { origin: { x: 0, y: 1, z: 0 }, direction: { x: 0, y: 0, z: -1 } },
  currentRay: { origin: { x: 0, y: 0, z: 1 }, direction: { x: 0, y: 0, z: -1 } },
}), /parallel to the selected rotation plane/);

let rayIndex = 0; let locks = 0; let releases = 0; let pickCalls = 0;
const rays = [
  { origin: { x: 1, y: 0, z: 10 }, direction: { x: 0, y: 0, z: -1 } },
  { origin: { x: 0, y: 1, z: 10 }, direction: { x: 0, y: 0, z: -1 } },
];
const viewer = {
  pickAt() { pickCalls += 1; return null; },
  screenRay() { return rays[Math.min(rayIndex++, rays.length - 1)]; },
  acquireNavigationLock(owner) {
    assert.match(owner, /^ssk-3d-rotation:/); locks += 1;
    let released = false; return () => { if (!released) { released = true; releases += 1; } };
  },
};
const previews = [];
const session = createSequentialRotationDragSession({
  readViewer: () => viewer,
  onPreview(input) {
    const preview = Object.freeze({ operationId: input.operationId,
      transform: Object.freeze({ pivot: input.pivot, axis: input.axis,
        angleDegrees: input.angleDegrees, profile: input.profile }) });
    previews.push({ input, preview }); return preview;
  },
});
const ringStart = createSequentialRotationRingStart({
  target, pivot, axisId: 'Z', pointer: { pointerId: 3, clientX: 10, clientY: 20 },
});
const begun = session.begin({ target, pivot, ringStart,
  profile: { boundaryTolerance: 1e-9 }, pointerId: 3, clientX: 10, clientY: 20 });
assert.equal(begun.status, 'dragging'); assert.equal(locks, 1); assert.equal(pickCalls, 0);
const update = session.update({ pointerId: 3, clientX: 30, clientY: 40 });
assert.equal(update.preview.transform.angleDegrees, 90);
assert.equal(previews[0].input.interaction.source, 'rotation-ring');
assert.equal(session.end(3).status, 'review'); assert.equal(releases, 1);
assert.equal(previews.length, 1, 'pointer release must not prepare, accept or restage rotation');
assert.equal(session.destroy(), true); assert.equal(session.destroy(), false);

console.log('Sequential rotation drag: ok');
