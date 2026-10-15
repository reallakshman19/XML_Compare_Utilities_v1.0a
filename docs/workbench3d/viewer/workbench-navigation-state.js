/** Pure coordinate and validation helpers for serializable viewer navigation state. */

export const VIEWER_NAVIGATION_STATE = 'ViewerNavigationState.v1';
export const NAVIGATION_PRESETS = Object.freeze({ VIEWER: 'VIEWER', CAD_EDIT: 'CAD_EDIT' });

function finitePoint(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

export function normalizeVerticalAxis(value) {
  return String(value ?? '').trim().toUpperCase() === 'Y' ? 'Y' : 'Z';
}

export function normalizeNavigationPreset(value) {
  return value === NAVIGATION_PRESETS.CAD_EDIT ? NAVIGATION_PRESETS.CAD_EDIT : NAVIGATION_PRESETS.VIEWER;
}

export function viewToWorldCoordinates(point, origin) {
  if (!finitePoint(point) || !finitePoint(origin)) throw new TypeError('View and origin points must contain three finite numbers.');
  return point.map((value, axis) => value + origin[axis]);
}

export function worldToViewCoordinates(point, origin) {
  if (!finitePoint(point) || !finitePoint(origin)) throw new TypeError('World and origin points must contain three finite numbers.');
  return point.map((value, axis) => value - origin[axis]);
}

export function validateViewerNavigationState(value) {
  const errors = [];
  if (!value || typeof value !== 'object') return ['navigation state missing'];
  if (value.contract !== VIEWER_NAVIGATION_STATE) errors.push(`contract must be ${VIEWER_NAVIGATION_STATE}`);
  for (const key of ['cameraPositionWorld', 'cameraTargetWorld']) {
    if (!finitePoint(value[key])) errors.push(`${key} must be [x,y,z] finite numbers`);
  }
  if (value.pivotWorld !== null && !finitePoint(value.pivotWorld)) errors.push('pivotWorld must be null or [x,y,z] finite numbers');
  if (!['Perspective', 'Orthographic'].includes(value.cameraType)) errors.push(`unknown cameraType ${value.cameraType}`);
  if (!['Y', 'Z'].includes(value.verticalAxis)) errors.push(`unknown verticalAxis ${value.verticalAxis}`);
  if (!Number.isFinite(value.projectionScale) || value.projectionScale <= 0) errors.push('projectionScale must be a positive finite number');
  if (finitePoint(value.cameraPositionWorld) && finitePoint(value.cameraTargetWorld)) {
    const distance = Math.hypot(...value.cameraPositionWorld.map((coordinate, axis) => coordinate - value.cameraTargetWorld[axis]));
    if (!Number.isFinite(distance) || distance < 0.01) errors.push('camera target distance must be at least 0.01');
  }
  return errors;
}

export function createViewerNavigationState(input) {
  const state = {
    contract: VIEWER_NAVIGATION_STATE,
    cameraPositionWorld: Object.freeze([...input.cameraPositionWorld]),
    cameraTargetWorld: Object.freeze([...input.cameraTargetWorld]),
    pivotWorld: input.pivotWorld ? Object.freeze([...input.pivotWorld]) : null,
    cameraType: input.cameraType,
    verticalAxis: normalizeVerticalAxis(input.verticalAxis),
    projectionScale: Number(input.projectionScale),
  };
  const errors = validateViewerNavigationState(state);
  if (errors.length) throw new TypeError(`Invalid viewer navigation state: ${errors.join('; ')}`);
  return Object.freeze(state);
}

export function sameViewerNavigationState(left, right, tolerance) {
  if (!left || !right || left.cameraType !== right.cameraType || left.verticalAxis !== right.verticalAxis) return false;
  const close = (a, b) => Math.abs(a - b) <= tolerance;
  const pointClose = (a, b) => a.length === b.length && a.every((value, index) => close(value, b[index]));
  const pivotClose = left.pivotWorld === null && right.pivotWorld === null
    || Array.isArray(left.pivotWorld) && Array.isArray(right.pivotWorld) && pointClose(left.pivotWorld, right.pivotWorld);
  return pointClose(left.cameraPositionWorld, right.cameraPositionWorld)
    && pointClose(left.cameraTargetWorld, right.cameraTargetWorld)
    && pivotClose && close(left.projectionScale, right.projectionScale);
}
