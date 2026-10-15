/** Viewer-ray drag lifecycle for one supervised rotation ring. */
import { immutableJson } from '../../../contracts/contract-values.js';
import { sequentialSemanticFingerprint } from './sequential-command-contracts.js';
import { createSequentialRotationTransform } from './sequential-rotation-geometry.js';
import { assertSequentialRotationRingStart } from './sequential-rotation-ring-contract.js';
import { SEQUENTIAL_ROTATION_TARGET_SCHEMA } from './sequential-rotation-target.js';

export const SEQUENTIAL_ROTATION_DRAG_SCHEMA = 'SequentialRotationDrag.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function finite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${label} must be finite.`);
  return number;
}
function pointerInput(input, label) {
  const value = {
    pointerId: finite(input?.pointerId, `${label} pointerId`),
    clientX: finite(input?.clientX, `${label} clientX`),
    clientY: finite(input?.clientY, `${label} clientY`),
  };
  if (!Number.isInteger(value.pointerId)) throw new TypeError(`${label} pointerId must be an integer.`);
  return value;
}
function vector(value, label) {
  return Object.fromEntries(['x', 'y', 'z'].map((axis) => [
    axis, finite(value?.[axis], `${label}.${axis}`),
  ]));
}
function assertTarget(target) {
  if (target?.schema !== SEQUENTIAL_ROTATION_TARGET_SCHEMA) {
    throw new TypeError(`Rotation drag target must use ${SEQUENTIAL_ROTATION_TARGET_SCHEMA}.`);
  }
  return target;
}
function viewerMethods(viewer) {
  for (const name of ['screenRay', 'acquireNavigationLock']) {
    if (typeof viewer?.[name] !== 'function') throw new TypeError(`Rotation drag viewer.${name} is required.`);
  }
  return viewer;
}
function initialState() {
  return {
    schema: SEQUENTIAL_ROTATION_DRAG_SCHEMA,
    status: 'idle', pointerId: null, operationId: null,
    targetId: null, axisId: null, pivot: null, angleDegrees: null,
    startRay: null, previewOperationId: null,
  };
}
function dot(left, right) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}
function subtract(left, right) {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
}
function scale(value, amount) {
  return { x: value.x * amount, y: value.y * amount, z: value.z * amount };
}
function add(left, right) {
  return { x: left.x + right.x, y: left.y + right.y, z: left.z + right.z };
}
function cross(left, right) {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
}
function unit(value, label) {
  const length = Math.hypot(value.x, value.y, value.z);
  if (!(length > 1e-12)) throw new RangeError(`${label} is degenerate.`);
  return scale(value, 1 / length);
}
function ray(value, label) {
  return { origin: vector(value?.origin, `${label}.origin`),
    direction: unit(vector(value?.direction, `${label}.direction`), `${label}.direction`) };
}
function intersectRotationPlane(rayValue, pivot, axis) {
  const denominator = dot(rayValue.direction, axis);
  if (Math.abs(denominator) < 1e-12) {
    throw new RangeError('Pointer ray is parallel to the selected rotation plane.');
  }
  const amount = dot(subtract(pivot, rayValue.origin), axis) / denominator;
  return add(rayValue.origin, scale(rayValue.direction, amount));
}
export function solveSequentialRotationDrag(input = {}) {
  const pivot = vector(input.pivot, 'Rotation pivot');
  const axis = unit(vector(input.axis, 'Rotation axis'), 'Rotation axis');
  const startPoint = intersectRotationPlane(ray(input.startRay, 'Start ray'), pivot, axis);
  const currentPoint = intersectRotationPlane(ray(input.currentRay, 'Current ray'), pivot, axis);
  const start = unit(subtract(startPoint, pivot), 'Rotation start radius');
  const current = unit(subtract(currentPoint, pivot), 'Rotation current radius');
  const signed = Math.atan2(dot(axis, cross(start, current)), dot(start, current)) * 180 / Math.PI;
  const transform = createSequentialRotationTransform({
    pivot, axis, angleDegrees: signed, profile: input.profile,
  });
  return immutableJson({ transform, startPoint, currentPoint }, 'Sequential rotation drag solution');
}
function assertLive(runtime) {
  if (runtime.disposed) throw new Error('Rotation drag session is disposed.');
}
function releaseNavigation(runtime) {
  try { runtime.releaseNavigation?.(); } finally { runtime.releaseNavigation = null; }
}
function beginDrag(runtime, input = {}) {
  assertLive(runtime);
  if (runtime.state.status === 'dragging') throw new Error('A rotation ring drag is already active.');
  const pointer = pointerInput(input, 'Rotation drag start');
  const target = assertTarget(input.target);
  const start = assertSequentialRotationRingStart(input.ringStart, target, input.pivot);
  const viewer = viewerMethods(runtime.readViewer());
  const startRay = viewer.screenRay(pointer.clientX, pointer.clientY);
  const operationId = sequentialSemanticFingerprint('SSK3DROTATIONDRAG', {
    ringStartId: start.ringStartId, startRay, profile: input.profile || {},
  });
  runtime.releaseNavigation = viewer.acquireNavigationLock(`ssk-3d-rotation:${operationId}`);
  runtime.active = { target, start, profile: input.profile || {} };
  runtime.state = { ...initialState(), status: 'dragging', pointerId: pointer.pointerId,
    operationId, targetId: target.rotationTargetId, axisId: start.axisId,
    pivot: start.pivot, startRay };
  return immutableJson(runtime.state, 'Sequential rotation drag state');
}
function updateDrag(runtime, input = {}) {
  assertLive(runtime);
  const pointer = pointerInput(input, 'Rotation drag update');
  if (runtime.state.status !== 'dragging' || pointer.pointerId !== runtime.state.pointerId) {
    throw new Error('Rotation drag update does not match the active pointer.');
  }
  const currentRay = viewerMethods(runtime.readViewer()).screenRay(pointer.clientX, pointer.clientY);
  const solution = solveSequentialRotationDrag({
    pivot: runtime.active.start.pivot, axis: runtime.active.start.axis,
    startRay: runtime.state.startRay, currentRay, profile: runtime.active.profile,
  });
  const preview = runtime.onPreview({
    target: runtime.active.target, operationId: runtime.state.operationId,
    pivot: solution.transform.pivot, axis: solution.transform.axis,
    angleDegrees: solution.transform.angleDegrees, profile: solution.transform.profile,
    interaction: { kind: 'pointer', source: 'rotation-ring', axisId: runtime.active.start.axisId },
  });
  runtime.state = { ...runtime.state, angleDegrees: solution.transform.angleDegrees,
    previewOperationId: preview.operationId };
  return immutableJson({ state: runtime.state, preview, solution }, 'Sequential rotation drag update');
}
function endDrag(runtime, pointerId) {
  assertLive(runtime);
  if (runtime.state.status !== 'dragging' || Number(pointerId) !== runtime.state.pointerId) {
    return immutableJson(runtime.state, 'Sequential rotation drag state');
  }
  releaseNavigation(runtime); runtime.active = null;
  runtime.state = { ...runtime.state, status: 'review' };
  return immutableJson(runtime.state, 'Sequential rotation drag state');
}
function cancelDrag(runtime, reason = 'cancelled') {
  assertLive(runtime); releaseNavigation(runtime); runtime.active = null;
  runtime.state = { ...initialState(), status: 'cancelled', reason: String(reason) };
  return immutableJson(runtime.state, 'Sequential rotation drag state');
}
function destroyDrag(runtime) {
  if (runtime.disposed) return false;
  cancelDrag(runtime, 'destroy'); runtime.disposed = true; return true;
}
export function createSequentialRotationDragSession(options = {}) {
  const runtime = {
    readViewer: requiredFunction(options.readViewer, 'readViewer'),
    onPreview: requiredFunction(options.onPreview, 'onPreview'),
    state: initialState(), releaseNavigation: null, active: null, disposed: false,
  };
  return Object.freeze({
    schema: SEQUENTIAL_ROTATION_DRAG_SCHEMA,
    begin: (input) => beginDrag(runtime, input),
    update: (input) => updateDrag(runtime, input),
    end: (pointerId) => endDrag(runtime, pointerId),
    cancel: (reason) => cancelDrag(runtime, reason),
    getState: () => immutableJson(runtime.state, 'Sequential rotation drag state'),
    destroy: () => destroyDrag(runtime),
  });
}

export const _test = Object.freeze({ intersectRotationPlane, pointerInput, unit });
