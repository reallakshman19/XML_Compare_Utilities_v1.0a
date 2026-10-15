/** Versioned, consumer-neutral contracts for headless Edit 3D dragging. */

export const EDIT_3D_DRAG_REQUEST_V1 = 'Edit3DDragRequest.v1';
export const EDIT_3D_DRAG_SESSION_V1 = 'Edit3DDragSession.v1';
export const EDIT_3D_DRAG_RESULT_V1 = 'Edit3DDragResult.v1';

export const EDIT_3D_CONSTRAINT_KIND = Object.freeze({
  CAMERA_PLANE: 'CAMERA_PLANE',
  WORLD_PLANE: 'WORLD_PLANE',
  AXIS: 'AXIS',
});

export const EDIT_3D_SESSION_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  CANCELLED: 'CANCELLED',
});

export const EDIT_3D_FAILURE_REASON = Object.freeze({
  NON_FINITE_INPUT: 'NON_FINITE_INPUT',
  RAY_PARALLEL: 'RAY_PARALLEL',
  BEHIND_CAMERA: 'BEHIND_CAMERA',
  RAY_DISTANCE_LIMIT: 'RAY_DISTANCE_LIMIT',
  NON_FINITE_RESULT: 'NON_FINITE_RESULT',
  AXIS_PARALLEL: 'AXIS_PARALLEL',
  AXIS_DISTANCE_LIMIT: 'AXIS_DISTANCE_LIMIT',
  SESSION_CANCELLED: 'SESSION_CANCELLED',
});

const PLANE_KINDS = Object.freeze([
  EDIT_3D_CONSTRAINT_KIND.CAMERA_PLANE,
  EDIT_3D_CONSTRAINT_KIND.WORLD_PLANE,
]);
const CONSTRAINT_KINDS = Object.freeze([...PLANE_KINDS, EDIT_3D_CONSTRAINT_KIND.AXIS]);
const SESSION_STATUSES = Object.freeze(Object.values(EDIT_3D_SESSION_STATUS));
const FAILURE_REASONS = Object.freeze(Object.values(EDIT_3D_FAILURE_REASON));

function assertRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || value instanceof Map || value instanceof Set) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value;
}

function assertSchema(value, expected, label) {
  if (value !== expected) throw new TypeError(`${label} schema must be ${expected}.`);
}

function finiteVector(value, label, nonZero = false) {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
    throw new TypeError(`${label} must contain three finite coordinates.`);
  }
  if (nonZero && Math.hypot(...value) === 0) throw new RangeError(`${label} must be non-zero.`);
  return Object.freeze([...value]);
}

function positiveDistance(value) {
  if (!Number.isFinite(value)) throw new TypeError('maxDistance must be finite.');
  if (value <= 0) throw new RangeError('maxDistance must be greater than zero.');
  return value;
}

function knownKind(kind) {
  if (!CONSTRAINT_KINDS.includes(kind)) throw new TypeError(`Unknown Edit 3D constraint: ${String(kind)}.`);
  return kind;
}

function planeConstraint(kind, planeNormal, label = 'constraint') {
  if (!PLANE_KINDS.includes(kind)) throw new TypeError(`${label} must identify a plane constraint.`);
  return Object.freeze({ kind, planeNormal: finiteVector(planeNormal, `${label}.planeNormal`, true) });
}

function activeConstraint(input, label = 'constraint') {
  const value = assertRecord(input, label);
  const kind = knownKind(value.kind);
  if (kind === EDIT_3D_CONSTRAINT_KIND.AXIS) {
    return Object.freeze({ kind, axis: finiteVector(value.axis, `${label}.axis`, true) });
  }
  return planeConstraint(kind, value.planeNormal, label);
}

function requestConstraint(input) {
  const value = assertRecord(input, 'constraint');
  const kind = knownKind(value.kind);
  if (kind !== EDIT_3D_CONSTRAINT_KIND.AXIS) return planeConstraint(kind, value.planeNormal);
  const plane = planeConstraint(value.planeKind, value.planeNormal, 'constraint restoration plane');
  return Object.freeze({ kind, axis: finiteVector(value.axis, 'constraint.axis', true),
    planeKind: plane.kind, planeNormal: plane.planeNormal });
}

function optionalPoint(value, label) {
  return value === null ? null : finiteVector(value, label);
}

export function validateEdit3DDragRequest(input) {
  const value = assertRecord(input, 'Edit 3D drag request');
  assertSchema(value.schema, EDIT_3D_DRAG_REQUEST_V1, 'Edit 3D drag request');
  return Object.freeze({
    schema: EDIT_3D_DRAG_REQUEST_V1,
    start: finiteVector(value.start, 'start'),
    maxDistance: positiveDistance(value.maxDistance),
    constraint: requestConstraint(value.constraint),
  });
}

export function validateEdit3DDragSession(input) {
  const value = assertRecord(input, 'Edit 3D drag session');
  assertSchema(value.schema, EDIT_3D_DRAG_SESSION_V1, 'Edit 3D drag session');
  if (!SESSION_STATUSES.includes(value.status)) throw new TypeError('Unknown Edit 3D session status.');
  const cancelReason = value.status === EDIT_3D_SESSION_STATUS.CANCELLED
    ? EDIT_3D_FAILURE_REASON.SESSION_CANCELLED : '';
  return Object.freeze({
    schema: EDIT_3D_DRAG_SESSION_V1,
    status: value.status,
    start: finiteVector(value.start, 'start'),
    currentPoint: finiteVector(value.currentPoint, 'currentPoint'),
    lastValidPoint: finiteVector(value.lastValidPoint, 'lastValidPoint'),
    maxDistance: positiveDistance(value.maxDistance),
    planeConstraint: planeConstraint(value.planeConstraint?.kind,
      value.planeConstraint?.planeNormal, 'planeConstraint'),
    constraint: activeConstraint(value.constraint),
    cancelReason,
  });
}

export function validateEdit3DDragResult(input) {
  const value = assertRecord(input, 'Edit 3D drag result');
  assertSchema(value.schema, EDIT_3D_DRAG_RESULT_V1, 'Edit 3D drag result');
  if (typeof value.valid !== 'boolean') throw new TypeError('result.valid must be boolean.');
  if (typeof value.reason !== 'string') throw new TypeError('result.reason must be a string.');
  if (value.valid && value.reason) throw new TypeError('A valid result cannot have a failure reason.');
  if (!value.valid && !FAILURE_REASONS.includes(value.reason)) {
    throw new TypeError(`Unknown Edit 3D failure reason: ${String(value.reason)}.`);
  }
  const point = optionalPoint(value.point, 'result.point');
  if (value.valid && point === null) throw new TypeError('A valid result must contain a point.');
  return Object.freeze({
    schema: EDIT_3D_DRAG_RESULT_V1,
    valid: value.valid,
    reason: value.reason,
    point,
    constraint: activeConstraint(value.constraint),
  });
}
