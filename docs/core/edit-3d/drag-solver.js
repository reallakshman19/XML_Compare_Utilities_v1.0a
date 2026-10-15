/** Pure finite drag geometry for Edit Draft world-space node operations. */

export const EDIT_DRAG_THRESHOLD_PX = 5;
const PARALLEL_EPSILON = 1e-4;

export const vSub = (left, right) => left.map((value, axis) => value - right[axis]);
export const vAdd = (left, right) => left.map((value, axis) => value + right[axis]);
export const vScale = (value, scale) => value.map((component) => component * scale);
export const vDot = (left, right) => left.reduce((sum, value, axis) => sum + value * right[axis], 0);
export const vLen = (value) => Math.hypot(...value);

export function finitePoint(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

export function pointerTravel(start, event) {
  return start ? Math.hypot(event.clientX - start[0], event.clientY - start[1]) : 0;
}

export function rayPlaneIntersection(ray, point, normal, maxDistance) {
  if (!finitePoint(ray?.origin) || !finitePoint(ray?.direction) || !finitePoint(point) || !finitePoint(normal)) {
    return Object.freeze({ valid: false, reason: 'NON_FINITE_INPUT', point: null });
  }
  const denominator = vDot(ray.direction, normal);
  if (Math.abs(denominator) < PARALLEL_EPSILON) return Object.freeze({ valid: false, reason: 'RAY_PARALLEL', point: null });
  const distance = vDot(vSub(point, ray.origin), normal) / denominator;
  if (distance <= 0) return Object.freeze({ valid: false, reason: 'BEHIND_CAMERA', point: null });
  if (!Number.isFinite(distance) || distance > maxDistance) return Object.freeze({ valid: false, reason: 'RAY_DISTANCE_LIMIT', point: null });
  const intersection = vAdd(ray.origin, vScale(ray.direction, distance));
  return Object.freeze({ valid: finitePoint(intersection), reason: finitePoint(intersection) ? '' : 'NON_FINITE_RESULT', point: intersection });
}

export function closestAxisPoint(ray, start, axis, maxDistance) {
  if (!finitePoint(ray?.origin) || !finitePoint(ray?.direction)) return Object.freeze({ valid: false, reason: 'NON_FINITE_INPUT', point: null });
  const offset = vSub(start, ray.origin);
  const a = vDot(axis, axis), b = vDot(axis, ray.direction), c = vDot(ray.direction, ray.direction);
  const denominator = a * c - b * b;
  if (Math.abs(denominator) < PARALLEL_EPSILON) return Object.freeze({ valid: false, reason: 'AXIS_PARALLEL', point: null });
  const parameter = (b * vDot(ray.direction, offset) - c * vDot(axis, offset)) / denominator;
  const point = vAdd(start, vScale(axis, parameter));
  if (!finitePoint(point) || vLen(vSub(point, start)) > maxDistance) return Object.freeze({ valid: false, reason: 'AXIS_DISTANCE_LIMIT', point: null });
  return Object.freeze({ valid: true, reason: '', point });
}

export function closestLineParameter(ray, lineOrigin, lineDirection) {
  if (!finitePoint(ray?.origin) || !finitePoint(ray?.direction)
    || !finitePoint(lineOrigin) || !finitePoint(lineDirection)) return null;
  const offset = vSub(lineOrigin, ray.origin);
  const a = vDot(lineDirection, lineDirection);
  const b = vDot(lineDirection, ray.direction);
  const c = vDot(ray.direction, ray.direction);
  const denominator = a * c - b * b;
  if (a < PARALLEL_EPSILON || Math.abs(denominator) < PARALLEL_EPSILON) return null;
  const parameter = (b * vDot(ray.direction, offset) - c * vDot(lineDirection, offset)) / denominator;
  return Number.isFinite(parameter) ? parameter : null;
}

export function solveEditDrag(input) {
  const result = input.axis
    ? closestAxisPoint(input.ray, input.start, input.axis, input.maxDistance)
    : rayPlaneIntersection(input.ray, input.start, input.planeNormal, input.maxDistance);
  return result.valid ? result : Object.freeze({ ...result, point: input.lastValid });
}

export function canonicalInteractionDistance(canonical) {
  const points = (canonical?.nodes ?? []).map((node) => [node.position?.x, node.position?.y, node.position?.z]).filter(finitePoint);
  if (!points.length) return 1000;
  const min = [0, 1, 2].map((axis) => Math.min(...points.map((point) => point[axis])));
  const max = [0, 1, 2].map((axis) => Math.max(...points.map((point) => point[axis])));
  return Math.max(vLen(vSub(max, min)) * 4, 1000);
}

const round1 = (value) => Math.round(value * 10) / 10;
export function positionRecord(point) {
  if (!finitePoint(point)) throw new TypeError('Edit position must contain three finite coordinates.');
  return Object.freeze({ x: round1(point[0]), y: round1(point[1]), z: round1(point[2]) });
}
