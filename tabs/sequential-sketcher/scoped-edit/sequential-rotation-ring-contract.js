/** Canonical three-ring manipulator contract for supervised rotation previews. */
import { immutableJson } from '../../../contracts/contract-values.js';
import {
  sameSequentialContractValue,
  sequentialSemanticFingerprint,
} from './sequential-command-contracts.js';
import { SEQUENTIAL_ROTATION_TARGET_SCHEMA } from './sequential-rotation-target.js';

export const SEQUENTIAL_ROTATION_RING_SCHEMA = 'SequentialRotationRing.v1';
export const SEQUENTIAL_ROTATION_RING_START_SCHEMA = 'SequentialRotationRingStart.v1';
export const SEQUENTIAL_ROTATION_RING_AXES = Object.freeze(['X', 'Y', 'Z']);

const AXIS_VECTORS = Object.freeze({
  X: Object.freeze({ x: 1, y: 0, z: 0 }),
  Y: Object.freeze({ x: 0, y: 1, z: 0 }),
  Z: Object.freeze({ x: 0, y: 0, z: 1 }),
});
const RING_PLANES = Object.freeze({
  X: Object.freeze(['Y', 'Z']),
  Y: Object.freeze(['X', 'Z']),
  Z: Object.freeze(['X', 'Y']),
});

function finite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${label} must be finite.`);
  return number;
}
function point(value, label) {
  return Object.freeze(Object.fromEntries(['x', 'y', 'z'].map((axis) => [
    axis, finite(value?.[axis], `${label}.${axis}`),
  ])));
}
function pointer(value = {}) {
  const result = {
    pointerId: finite(value.pointerId, 'Rotation ring pointerId'),
    clientX: finite(value.clientX, 'Rotation ring clientX'),
    clientY: finite(value.clientY, 'Rotation ring clientY'),
  };
  if (!Number.isInteger(result.pointerId)) {
    throw new TypeError('Rotation ring pointerId must be an integer.');
  }
  return Object.freeze(result);
}
function axisId(value) {
  const axis = String(value || '').trim().toUpperCase();
  if (!SEQUENTIAL_ROTATION_RING_AXES.includes(axis)) {
    throw new TypeError(`Unsupported rotation ring axis: ${value}`);
  }
  return axis;
}
function targetValue(value) {
  if (value?.schema !== SEQUENTIAL_ROTATION_TARGET_SCHEMA) {
    throw new TypeError(`Rotation ring target must use ${SEQUENTIAL_ROTATION_TARGET_SCHEMA}.`);
  }
  return value;
}
function geometryPoints(target) {
  return target.geometryParts.flatMap((part) => {
    const geometry = part.geometry;
    if (geometry?.kind === 'point') return [geometry.position];
    if (geometry?.kind === 'segment') return [geometry.start, geometry.end];
    if (geometry?.kind === 'polyline') return geometry.points || [];
    throw new TypeError(`Unsupported rotation-ring geometry kind: ${geometry?.kind}`);
  }).map((value) => point(value, 'Rotation geometry point'));
}
export function sequentialRotationTargetPivot(targetInput) {
  const target = targetValue(targetInput);
  const points = geometryPoints(target);
  if (!points.length) throw new RangeError('Rotation target has no geometry points.');
  const total = points.reduce((sum, value) => ({
    x: sum.x + value.x, y: sum.y + value.y, z: sum.z + value.z,
  }), { x: 0, y: 0, z: 0 });
  return immutableJson({
    x: total.x / points.length,
    y: total.y / points.length,
    z: total.z / points.length,
  }, 'Sequential rotation target pivot');
}
function targetSpan(target, pivot) {
  return Math.max(1, ...geometryPoints(target).map((value) => Math.hypot(
    value.x - pivot.x, value.y - pivot.y, value.z - pivot.z,
  )));
}
function ringMaterial(axis) {
  return {
    axisId: axis,
    axis: AXIS_VECTORS[axis],
    planeAxes: RING_PLANES[axis],
    label: `Rotate around ${axis} axis`,
  };
}
function targetIdentity(target, pivot, span) {
  return {
    rotationTargetId: target.rotationTargetId,
    authorityId: target.authorityId,
    sceneRevision: target.sceneRevision,
    geometryFingerprint: target.geometryFingerprint,
    scope: target.scope,
    affectedComponentIds: target.affectedComponentIds,
    pivot,
    projectionSpan: span,
  };
}
export function createSequentialRotationRingModel(targetInput, pivotInput = null) {
  const target = targetValue(targetInput);
  const pivot = pivotInput == null
    ? sequentialRotationTargetPivot(target) : point(pivotInput, 'Rotation ring pivot');
  const span = targetSpan(target, pivot);
  const rings = SEQUENTIAL_ROTATION_RING_AXES.map(ringMaterial);
  const identity = targetIdentity(target, pivot, span);
  return immutableJson({
    schema: SEQUENTIAL_ROTATION_RING_SCHEMA,
    ...identity,
    rings,
    ringModelId: sequentialSemanticFingerprint('SSK3DROTATIONRINGS', { ...identity, rings }),
  }, 'Sequential rotation ring model');
}
export function sequentialRotationRing(model, value) {
  if (model?.schema !== SEQUENTIAL_ROTATION_RING_SCHEMA) {
    throw new TypeError(`Rotation ring model must use ${SEQUENTIAL_ROTATION_RING_SCHEMA}.`);
  }
  const axis = axisId(value);
  const ring = model.rings.find((row) => row.axisId === axis);
  if (!ring) throw new RangeError(`Rotation ring is unavailable: ${axis}`);
  return ring;
}
export function createSequentialRotationRingStart(input = {}) {
  const target = targetValue(input.target);
  const model = createSequentialRotationRingModel(target, input.pivot);
  const ring = sequentialRotationRing(model, input.axisId);
  const startPointer = pointer(input.pointer);
  const material = {
    schema: SEQUENTIAL_ROTATION_RING_START_SCHEMA,
    ringModelId: model.ringModelId,
    rotationTargetId: target.rotationTargetId,
    authorityId: target.authorityId,
    sceneRevision: target.sceneRevision,
    axisId: ring.axisId,
    axis: ring.axis,
    pivot: model.pivot,
    pointer: startPointer,
  };
  return immutableJson({
    ...material,
    ringStartId: sequentialSemanticFingerprint('SSK3DROTATIONRINGSTART', material),
  }, 'Sequential rotation ring start');
}
export function assertSequentialRotationRingStart(value, target, pivot) {
  if (value?.schema !== SEQUENTIAL_ROTATION_RING_START_SCHEMA) {
    throw new TypeError(`Rotation ring start must use ${SEQUENTIAL_ROTATION_RING_START_SCHEMA}.`);
  }
  const rebuilt = createSequentialRotationRingStart({
    target, pivot, axisId: value.axisId, pointer: value.pointer,
  });
  if (!sameSequentialContractValue(rebuilt, value)) {
    throw new RangeError('Rotation ring start differs from current rotation authority.');
  }
  return rebuilt;
}

export const _test = Object.freeze({ axisId, geometryPoints, point, pointer, ringMaterial, targetSpan });
