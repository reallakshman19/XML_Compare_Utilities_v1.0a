/** Immutable snapshots around the characterized Edit 3D geometry solver. */

import { solveEditDrag } from './drag-solver.js';
import {
  EDIT_3D_CONSTRAINT_KIND,
  EDIT_3D_DRAG_RESULT_V1,
  EDIT_3D_DRAG_SESSION_V1,
  EDIT_3D_FAILURE_REASON,
  EDIT_3D_SESSION_STATUS,
  validateEdit3DDragRequest,
  validateEdit3DDragResult,
  validateEdit3DDragSession,
} from './edit-drag-contracts.js';

function requestPlane(request) {
  const constraint = request.constraint;
  const kind = constraint.kind === EDIT_3D_CONSTRAINT_KIND.AXIS
    ? constraint.planeKind : constraint.kind;
  return Object.freeze({ kind, planeNormal: constraint.planeNormal });
}

function requestActiveConstraint(request) {
  const constraint = request.constraint;
  if (constraint.kind === EDIT_3D_CONSTRAINT_KIND.AXIS) {
    return Object.freeze({ kind: constraint.kind, axis: constraint.axis });
  }
  return Object.freeze({ kind: constraint.kind, planeNormal: constraint.planeNormal });
}

function initialState(request) {
  return validateEdit3DDragSession({
    schema: EDIT_3D_DRAG_SESSION_V1,
    status: EDIT_3D_SESSION_STATUS.ACTIVE,
    start: request.start,
    currentPoint: request.start,
    lastValidPoint: request.start,
    maxDistance: request.maxDistance,
    planeConstraint: requestPlane(request),
    constraint: requestActiveConstraint(request),
  });
}

function resultFor(state, valid, reason, point) {
  return validateEdit3DDragResult({
    schema: EDIT_3D_DRAG_RESULT_V1,
    valid,
    reason,
    point,
    constraint: state.constraint,
  });
}

function solvedState(state, point) {
  return validateEdit3DDragSession({
    ...state,
    currentPoint: point,
    lastValidPoint: point,
  });
}

function stateWithConstraint(state, constraint) {
  return validateEdit3DDragSession({ ...state, constraint });
}

function solveActive(state, ray) {
  const axis = state.constraint.kind === EDIT_3D_CONSTRAINT_KIND.AXIS
    ? state.constraint.axis : null;
  return solveEditDrag({
    ray,
    start: state.start,
    planeNormal: state.planeConstraint.planeNormal,
    axis,
    maxDistance: state.maxDistance,
    lastValid: state.lastValidPoint,
  });
}

export function createEditDragSession(input) {
  const request = validateEdit3DDragRequest(input);
  let state = initialState(request);

  function solve(ray) {
    if (state.status === EDIT_3D_SESSION_STATUS.CANCELLED) {
      return resultFor(state, false, EDIT_3D_FAILURE_REASON.SESSION_CANCELLED,
        state.lastValidPoint);
    }
    const baseline = solveActive(state, ray);
    const result = resultFor(state, baseline.valid, baseline.reason, baseline.point);
    if (result.valid) state = solvedState(state, result.point);
    return result;
  }

  function setAxis(axis) {
    if (state.status === EDIT_3D_SESSION_STATUS.CANCELLED) return state;
    state = stateWithConstraint(state, { kind: EDIT_3D_CONSTRAINT_KIND.AXIS, axis });
    return state;
  }

  function clearAxis() {
    if (state.status === EDIT_3D_SESSION_STATUS.CANCELLED) return state;
    state = stateWithConstraint(state, state.planeConstraint);
    return state;
  }

  function cancel() {
    if (state.status === EDIT_3D_SESSION_STATUS.CANCELLED) return state;
    state = validateEdit3DDragSession({ ...state, status: EDIT_3D_SESSION_STATUS.CANCELLED });
    return state;
  }

  function getState() {
    return state;
  }

  return Object.freeze({ solve, setAxis, clearAxis, cancel, getState });
}
