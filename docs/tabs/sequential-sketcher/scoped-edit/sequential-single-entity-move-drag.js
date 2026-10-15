/**
 * Viewer-ray drag lifecycle for one selected Sequential move-preview target.
 */
import { immutableJson } from '../../../contracts/contract-values.js';
import { sequentialSemanticFingerprint } from './sequential-command-contracts.js';
import {
  assertSequentialMoveManipulatorHandleStart,
} from './sequential-move-manipulator-contract.js';
import {
  createSequentialMoveConstraint,
  sequentialMovePivot,
  solveSequentialMoveDrag,
} from './sequential-single-entity-move-geometry.js';
import { SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_SCHEMA } from './sequential-single-entity-move-target.js';

export const SEQUENTIAL_SINGLE_ENTITY_MOVE_DRAG_SCHEMA =
  'SequentialSingleEntityMoveDrag.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function pointerInput(input, label) {
  const value = {
    pointerId: Number(input?.pointerId),
    clientX: Number(input?.clientX),
    clientY: Number(input?.clientY),
  };
  if (!Number.isInteger(value.pointerId)
    || !Number.isFinite(value.clientX) || !Number.isFinite(value.clientY)) {
    throw new TypeError(`${label} must contain a pointerId and finite client coordinates.`);
  }
  return value;
}
function assertTarget(target) {
  if (target?.schema !== SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_SCHEMA) {
    throw new TypeError(`Drag target must use ${SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_SCHEMA}.`);
  }
  return target;
}
function viewerMethods(viewer, requirePick) {
  for (const name of ['screenRay', 'acquireNavigationLock']) {
    if (typeof viewer?.[name] !== 'function') throw new TypeError(`Move drag viewer.${name} is required.`);
  }
  if (requirePick && typeof viewer.pickAt !== 'function') {
    throw new TypeError('Move drag viewer.pickAt is required for direct component drag.');
  }
  return viewer;
}
function initialState() {
  return {
    schema: SEQUENTIAL_SINGLE_ENTITY_MOVE_DRAG_SCHEMA,
    status: 'idle',
    pointerId: null,
    operationId: null,
    targetId: null,
    constraint: null,
    startRay: null,
    solution: null,
    previewOperationId: null,
    source: null,
    handleId: null,
  };
}
function assertLive(runtime) {
  if (runtime.disposed) throw new Error('Single-entity move drag session is disposed.');
}
function releaseNavigation(runtime) {
  try { runtime.releaseNavigation?.(); } finally { runtime.releaseNavigation = null; }
}
function directStart(input, target, viewer, pointer) {
  const hit = viewer.pickAt(pointer.clientX, pointer.clientY);
  if (!hit || !target.geometryPartIds.includes(hit.objectId)) {
    throw new RangeError('Pointer drag must start on the selected confirmed component.');
  }
  return {
    constraint: createSequentialMoveConstraint(input.constraint),
    source: 'viewer-ray',
    handleId: null,
  };
}
function manipulatorStart(input, target) {
  const start = assertSequentialMoveManipulatorHandleStart(input.handleStart, target);
  const pointer = pointerInput(input, 'Manipulator drag start');
  if (start.pointer.pointerId !== pointer.pointerId
    || start.pointer.clientX !== pointer.clientX
    || start.pointer.clientY !== pointer.clientY) {
    throw new RangeError('Manipulator pointer evidence differs from the drag start.');
  }
  return {
    constraint: start.constraint,
    source: 'manipulator-handle',
    handleId: start.handleId,
  };
}
function beginDrag(runtime, input = {}) {
  assertLive(runtime);
  if (runtime.state.status === 'dragging') throw new Error('A move-preview drag is already active.');
  const pointer = pointerInput(input, 'Drag start');
  const target = assertTarget(input.target);
  const start = input.handleStart
    ? manipulatorStart(input, target)
    : null;
  const viewer = viewerMethods(runtime.readViewer(), !start);
  const initiation = start || directStart(input, target, viewer, pointer);
  const startRay = viewer.screenRay(pointer.clientX, pointer.clientY);
  const operationMaterial = {
    targetId: target.moveTargetId,
    constraint: initiation.constraint,
    startRay,
    ...(initiation.handleId ? {
      source: initiation.source, handleId: initiation.handleId,
    } : {}),
  };
  const operationId = sequentialSemanticFingerprint('SSK3LPOINTERDRAG', operationMaterial);
  runtime.releaseNavigation = viewer.acquireNavigationLock(`ssk-3l:${operationId}`);
  runtime.activeTarget = target;
  runtime.state = {
    ...initialState(),
    status: 'dragging',
    pointerId: pointer.pointerId,
    operationId,
    targetId: target.moveTargetId,
    constraint: initiation.constraint,
    startRay,
    source: initiation.source,
    handleId: initiation.handleId,
  };
  return immutableJson(runtime.state, 'Sequential move drag state');
}
function updateDrag(runtime, input = {}) {
  assertLive(runtime);
  const pointer = pointerInput(input, 'Drag update');
  if (runtime.state.status !== 'dragging' || pointer.pointerId !== runtime.state.pointerId) {
    throw new Error('Drag update does not match the active move-preview pointer.');
  }
  const viewer = viewerMethods(runtime.readViewer(), false);
  const solution = solveSequentialMoveDrag({
    constraint: runtime.state.constraint,
    pivot: sequentialMovePivot(runtime.activeTarget.geometryParts),
    startRay: runtime.state.startRay,
    currentRay: viewer.screenRay(pointer.clientX, pointer.clientY),
  });
  const preview = runtime.onPreview({
    target: runtime.activeTarget,
    constraint: runtime.state.constraint,
    delta: solution.delta,
    operationId: runtime.state.operationId,
    interaction: { kind: 'pointer', source: runtime.state.source },
  });
  runtime.state = {
    ...runtime.state,
    solution,
    previewOperationId: preview.operationId,
  };
  return immutableJson({ state: runtime.state, preview }, 'Sequential move drag update');
}
function endDrag(runtime, pointerId) {
  assertLive(runtime);
  if (runtime.state.status !== 'dragging' || Number(pointerId) !== runtime.state.pointerId) {
    return immutableJson(runtime.state, 'Sequential move drag state');
  }
  releaseNavigation(runtime);
  runtime.state = { ...runtime.state, status: 'review' };
  runtime.activeTarget = null;
  return immutableJson(runtime.state, 'Sequential move drag state');
}
function cancelDrag(runtime, reason = 'cancelled') {
  assertLive(runtime);
  releaseNavigation(runtime);
  runtime.activeTarget = null;
  runtime.state = { ...initialState(), status: 'cancelled', reason: String(reason) };
  return immutableJson(runtime.state, 'Sequential move drag state');
}
function destroyDrag(runtime) {
  if (runtime.disposed) return false;
  cancelDrag(runtime, 'destroy');
  runtime.disposed = true;
  return true;
}

export function createSequentialSingleEntityMoveDragSession(options = {}) {
  const runtime = {
    readViewer: requiredFunction(options.readViewer, 'readViewer'),
    onPreview: requiredFunction(options.onPreview, 'onPreview'),
    state: initialState(),
    releaseNavigation: null,
    activeTarget: null,
    disposed: false,
  };
  return Object.freeze({
    schema: SEQUENTIAL_SINGLE_ENTITY_MOVE_DRAG_SCHEMA,
    begin: (input) => beginDrag(runtime, input),
    update: (input) => updateDrag(runtime, input),
    end: (pointerId) => endDrag(runtime, pointerId),
    cancel: (reason) => cancelDrag(runtime, reason),
    getState: () => immutableJson(runtime.state, 'Sequential move drag state'),
    destroy: () => destroyDrag(runtime),
  });
}
