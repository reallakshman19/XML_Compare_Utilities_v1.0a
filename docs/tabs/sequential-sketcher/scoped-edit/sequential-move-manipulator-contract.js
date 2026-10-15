/**
 * Canonical six-handle translation manipulator contract for supervised component moves.
 */
import { immutableJson } from '../../../contracts/contract-values.js';
import {
  sameSequentialContractValue,
  sequentialSemanticFingerprint,
} from './sequential-command-contracts.js';
import {
  createSequentialMoveConstraint,
  sequentialMovePivot,
} from './sequential-single-entity-move-geometry.js';
import { SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_SCHEMA } from './sequential-single-entity-move-target.js';

export const SEQUENTIAL_MOVE_MANIPULATOR_SCHEMA =
  'SequentialMoveManipulator.v1';
export const SEQUENTIAL_MOVE_MANIPULATOR_HANDLE_START_SCHEMA =
  'SequentialMoveManipulatorHandleStart.v1';
export const SEQUENTIAL_MOVE_MANIPULATOR_HANDLES = Object.freeze([
  'X', 'Y', 'Z', 'XY', 'XZ', 'YZ',
]);

const AXES = Object.freeze({
  X: Object.freeze({ x: 1, y: 0, z: 0 }),
  Y: Object.freeze({ x: 0, y: 1, z: 0 }),
  Z: Object.freeze({ x: 0, y: 0, z: 1 }),
});
const HANDLE_LABELS = Object.freeze({
  X: 'Move along X axis',
  Y: 'Move along Y axis',
  Z: 'Move along Z axis',
  XY: 'Move in XY plane',
  XZ: 'Move in XZ plane',
  YZ: 'Move in YZ plane',
});

function finite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${label} must be finite.`);
  return number;
}
function pointer(value = {}) {
  const result = {
    pointerId: finite(value.pointerId, 'Manipulator pointerId'),
    clientX: finite(value.clientX, 'Manipulator clientX'),
    clientY: finite(value.clientY, 'Manipulator clientY'),
  };
  if (!Number.isInteger(result.pointerId)) {
    throw new TypeError('Manipulator pointerId must be an integer.');
  }
  return Object.freeze(result);
}
function targetValue(value) {
  if (value?.schema !== SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_SCHEMA) {
    throw new TypeError(
      `Manipulator target must use ${SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_SCHEMA}.`,
    );
  }
  return value;
}
function handleId(value) {
  const id = String(value || '').trim().toUpperCase();
  if (!SEQUENTIAL_MOVE_MANIPULATOR_HANDLES.includes(id)) {
    throw new TypeError(`Unsupported translation manipulator handle: ${value}`);
  }
  return id;
}
function axesFor(id) {
  return id.length === 1 ? [id] : [...id];
}
function handleMaterial(id) {
  const axes = axesFor(id);
  return {
    handleId: id,
    kind: id.length === 1 ? 'axis' : 'plane',
    constraint: createSequentialMoveConstraint(id),
    axes,
    axisVectors: axes.map((axis) => AXES[axis]),
    label: HANDLE_LABELS[id],
  };
}
function geometryPoints(parts) {
  return parts.flatMap((part) => {
    const geometry = part.geometry;
    if (geometry?.kind === 'point') return [geometry.position];
    if (geometry?.kind === 'segment') return [geometry.start, geometry.end];
    if (geometry?.kind === 'polyline') return geometry.points || [];
    throw new TypeError(`Unsupported manipulator geometry kind: ${geometry?.kind}`);
  });
}
function projectionSpan(target, pivot) {
  const distances = geometryPoints(target.geometryParts).map((point) => Math.hypot(
    Number(point.x) - pivot.x, Number(point.y) - pivot.y, Number(point.z) - pivot.z,
  ));
  return Math.max(1, ...distances);
}
function targetIdentity(target, pivot, span) {
  return {
    moveTargetId: target.moveTargetId,
    componentId: target.componentId,
    authorityId: target.authorityId,
    sceneRevision: target.sceneRevision,
    geometryFingerprint: target.geometryFingerprint,
    pivot,
    projectionSpan: span,
  };
}

export function createSequentialMoveManipulator(targetInput) {
  const target = targetValue(targetInput);
  const pivot = sequentialMovePivot(target.geometryParts);
  const span = projectionSpan(target, pivot);
  const handles = SEQUENTIAL_MOVE_MANIPULATOR_HANDLES.map(handleMaterial);
  const identity = targetIdentity(target, pivot, span);
  return immutableJson({
    schema: SEQUENTIAL_MOVE_MANIPULATOR_SCHEMA,
    ...identity,
    handles,
    manipulatorId: sequentialSemanticFingerprint('SSK3DTRANSLATEMANIPULATOR', {
      ...identity,
      handles,
    }),
  }, 'Sequential translation manipulator');
}

export function sequentialMoveManipulatorHandle(model, value) {
  if (model?.schema !== SEQUENTIAL_MOVE_MANIPULATOR_SCHEMA) {
    throw new TypeError(`Manipulator must use ${SEQUENTIAL_MOVE_MANIPULATOR_SCHEMA}.`);
  }
  const id = handleId(value);
  const handle = model.handles.find((row) => row.handleId === id);
  if (!handle) throw new RangeError(`Manipulator handle is unavailable: ${id}`);
  return handle;
}

export function createSequentialMoveManipulatorHandleStart(input = {}) {
  const target = targetValue(input.target);
  const model = createSequentialMoveManipulator(target);
  const handle = sequentialMoveManipulatorHandle(model, input.handleId);
  const startPointer = pointer(input.pointer);
  const material = {
    schema: SEQUENTIAL_MOVE_MANIPULATOR_HANDLE_START_SCHEMA,
    manipulatorId: model.manipulatorId,
    moveTargetId: target.moveTargetId,
    authorityId: target.authorityId,
    sceneRevision: target.sceneRevision,
    handleId: handle.handleId,
    constraint: handle.constraint,
    pivot: model.pivot,
    pointer: startPointer,
  };
  return immutableJson({
    ...material,
    handleStartId: sequentialSemanticFingerprint('SSK3DMANIPULATORSTART', material),
  }, 'Sequential translation manipulator handle start');
}

export function assertSequentialMoveManipulatorHandleStart(value, targetInput) {
  if (value?.schema !== SEQUENTIAL_MOVE_MANIPULATOR_HANDLE_START_SCHEMA) {
    throw new TypeError(
      `Manipulator start must use ${SEQUENTIAL_MOVE_MANIPULATOR_HANDLE_START_SCHEMA}.`,
    );
  }
  const rebuilt = createSequentialMoveManipulatorHandleStart({
    target: targetInput,
    handleId: value.handleId,
    pointer: value.pointer,
  });
  if (!sameSequentialContractValue(rebuilt, value)) {
    throw new RangeError('Manipulator handle start differs from current move authority.');
  }
  return rebuilt;
}

export const _test = Object.freeze({ axesFor, geometryPoints, handleId, handleMaterial, pointer,
  projectionSpan });
