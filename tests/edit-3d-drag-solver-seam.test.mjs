/** Copy-only Edit 3D seam: shared incubation without topology runtime adoption. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import * as hostContract from '../core/edit-3d/edit-host-contract.js';
import * as shared from '../core/edit-3d/drag-solver.js';
import * as topology from '../tabs/topology-trace-validator/topology-edit-drag-solver.js';

const EXPECTED_EXPORTS = Object.freeze([
  'EDIT_DRAG_THRESHOLD_PX', 'canonicalInteractionDistance', 'closestAxisPoint',
  'closestLineParameter', 'finitePoint', 'pointerTravel', 'positionRecord',
  'rayPlaneIntersection', 'solveEditDrag', 'vAdd', 'vDot', 'vLen', 'vScale', 'vSub',
]);
const EPSILON = 1e-4;

function source(path) {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
}

function dot(left, right) {
  return left.reduce((sum, value, axis) => sum + value * right[axis], 0);
}

function referencePlane(ray, point, normal, maxDistance) {
  const denominator = dot(ray.direction, normal);
  if (Math.abs(denominator) < EPSILON) return { valid: false, reason: 'RAY_PARALLEL', point: null };
  const offset = point.map((value, axis) => value - ray.origin[axis]);
  const distance = dot(offset, normal) / denominator;
  if (distance <= 0) return { valid: false, reason: 'BEHIND_CAMERA', point: null };
  if (!Number.isFinite(distance) || distance > maxDistance) return { valid: false, reason: 'RAY_DISTANCE_LIMIT', point: null };
  return { valid: true, reason: '', point: ray.origin.map((value, axis) => value + ray.direction[axis] * distance) };
}

function referenceAxis(ray, start, axis, maxDistance) {
  const offset = start.map((value, index) => value - ray.origin[index]);
  const a = dot(axis, axis), b = dot(axis, ray.direction), c = dot(ray.direction, ray.direction);
  const denominator = a * c - b * b;
  if (Math.abs(denominator) < EPSILON) return { valid: false, reason: 'AXIS_PARALLEL', point: null };
  const parameter = (b * dot(ray.direction, offset) - c * dot(axis, offset)) / denominator;
  const point = start.map((value, index) => value + axis[index] * parameter);
  const distance = Math.hypot(...point.map((value, index) => value - start[index]));
  if (!point.every(Number.isFinite) || distance > maxDistance) return { valid: false, reason: 'AXIS_DISTANCE_LIMIT', point: null };
  return { valid: true, reason: '', point };
}

function deterministicRay(index) {
  return {
    origin: [index % 97, (index * 7) % 89, 100 + (index % 83)],
    direction: [1 + (index % 3), (index % 5) - 2, -1 - (index % 7)],
  };
}

function assertSourcePolicy(path, label) {
  const text = source(path);
  assert.ok(text.split(/\r?\n/).length <= 300, `${label} exceeds 300 lines`);
  assert.doesNotMatch(text, /export\s+default/, `${label} must use named exports`);
}

assert.deepEqual(Object.keys(shared).sort(), [...EXPECTED_EXPORTS].sort());
assert.deepEqual(Object.keys(topology).sort(), [...EXPECTED_EXPORTS].sort());
assert.equal(
  source('../core/edit-3d/drag-solver.js'),
  source('../tabs/topology-trace-validator/topology-edit-drag-solver.js'),
  'shared incubation copy must remain byte-identical to the untouched topology solver',
);

assert.deepEqual(Object.keys(hostContract).sort(), [
  'EDIT_HOST_REQUIRED_METHODS', 'assertEditHostContract',
]);
assert.deepEqual(hostContract.EDIT_HOST_REQUIRED_METHODS, [
  'scene', 'appendEditCommand', 'entityGeometry', 'resolveScope',
]);
assert.equal(Object.isFrozen(hostContract.EDIT_HOST_REQUIRED_METHODS), true);
const validHost = Object.freeze(Object.fromEntries(
  hostContract.EDIT_HOST_REQUIRED_METHODS.map((name) => [name, () => null]),
));
assert.equal(hostContract.assertEditHostContract(validHost), validHost);
assert.throws(() => hostContract.assertEditHostContract(null), /Edit host must be an object/);
for (const name of hostContract.EDIT_HOST_REQUIRED_METHODS) {
  assert.throws(
    () => hostContract.assertEditHostContract({ ...validHost, [name]: null }),
    new RegExp(`Edit host is missing ${name}\\(\\)`),
  );
}

let checked = 0;
for (let index = 0; index < 5000; index += 1) {
  const ray = deterministicRay(index), point = [20, -30, 10], normal = [0, 0, 1];
  const before = JSON.stringify({ ray, point, normal });
  const expected = referencePlane(ray, point, normal, 10000);
  const sharedResult = shared.rayPlaneIntersection(ray, point, normal, 10000);
  const topologyResult = topology.rayPlaneIntersection(ray, point, normal, 10000);
  assert.deepEqual(sharedResult, expected);
  assert.deepEqual(topologyResult, expected);
  assert.equal(Object.isFrozen(sharedResult), true);
  assert.equal(Object.isFrozen(topologyResult), true);
  assert.equal(JSON.stringify({ ray, point, normal }), before);
  checked += 1;
}
for (let index = 0; index < 5000; index += 1) {
  const ray = deterministicRay(index), start = [20, -30, 10], axis = [index % 2, (index + 1) % 2, 0];
  const before = JSON.stringify({ ray, start, axis });
  const expected = referenceAxis(ray, start, axis, 10000);
  const sharedResult = shared.closestAxisPoint(ray, start, axis, 10000);
  const topologyResult = topology.closestAxisPoint(ray, start, axis, 10000);
  assert.deepEqual(sharedResult, expected);
  assert.deepEqual(topologyResult, expected);
  assert.equal(Object.isFrozen(sharedResult), true);
  assert.equal(Object.isFrozen(topologyResult), true);
  assert.equal(JSON.stringify({ ray, start, axis }), before);
  checked += 1;
}
assert.equal(checked, 10000);

assertSourcePolicy('../core/edit-3d/drag-solver.js', 'shared drag solver');
assertSourcePolicy('../core/edit-3d/edit-host-contract.js', 'edit host contract');
assertSourcePolicy('../tabs/topology-trace-validator/topology-edit-drag-solver.js', 'topology drag solver');

const topologyImporters = Object.freeze([
  '../tabs/topology-trace-validator/topology-edit-3d-gestures.js',
  './edit-draft-navigation-core.test.mjs',
  './topology-edit-navigation-asim-1835.test.mjs',
]);
for (const path of topologyImporters) {
  const text = source(path);
  assert.match(text, /topology-edit-drag-solver\.js/);
  assert.doesNotMatch(text, /core\/edit-3d\/drag-solver\.js/);
}

const packageJson = JSON.parse(source('../package.json'));
assert.equal(packageJson.scripts['test:edit-3d-seam'],
  'node tests/edit-3d-drag-solver-seam.test.mjs && node tests/edit-draft-navigation-core.test.mjs');

console.log(`edit-3d-drag-solver-seam.test.mjs passed (${checked} deterministic copy-parity cases)`);
