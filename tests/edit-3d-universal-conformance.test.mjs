import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  EDIT_3D_HOST_CONFORMANCE_V1,
  EDIT_HOST_REQUIRED_METHODS,
  assertEdit3DHostConformance,
} from '../core/edit-3d/index.js';

let calls = 0, checked = 0;
const validHost = Object.freeze(Object.fromEntries(
  EDIT_HOST_REQUIRED_METHODS.map((name) => [name, () => { calls += 1; }]),
));
const report = assertEdit3DHostConformance(validHost);
assert.deepEqual(report, {
  schema: EDIT_3D_HOST_CONFORMANCE_V1,
  valid: true,
  requiredMethods: [...EDIT_HOST_REQUIRED_METHODS],
});
assert.equal(Object.isFrozen(report), true);
assert.equal(Object.isFrozen(report.requiredMethods), true);
assert.equal(calls, 0, 'shape conformance must not invoke host methods');
checked += 1;

for (const missing of EDIT_HOST_REQUIRED_METHODS) {
  const host = Object.fromEntries(EDIT_HOST_REQUIRED_METHODS
    .filter((name) => name !== missing).map((name) => [name, () => { calls += 1; }]));
  assert.throws(() => assertEdit3DHostConformance(host),
    new RegExp(`Edit 3D host is missing ${missing}\\(\\)`));
  assert.equal(calls, 0);
  checked += 1;
}

assert.throws(() => assertEdit3DHostConformance({ ...validHost, scene: {} }),
  /Edit 3D host is missing scene\(\)/);
assert.equal(calls, 0);
checked += 1;

function source(path) {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
}

const newFiles = Object.freeze([
  '../core/edit-3d/edit-drag-contracts.js',
  '../core/edit-3d/edit-drag-session.js',
  '../core/edit-3d/edit-3d-conformance.js',
  '../core/edit-3d/index.js',
  './edit-3d-universal-contracts.test.mjs',
  './edit-3d-universal-session.test.mjs',
  './edit-3d-universal-conformance.test.mjs',
]);
for (const path of newFiles) {
  const text = source(path);
  assert.ok(text.split(/\r?\n/).length < 300, `${path} must remain below 300 lines`);
  assert.doesNotMatch(text, /export\s+default/, `${path} must use named exports only`);
  checked += 1;
}

for (const path of newFiles.slice(0, 4)) {
  const text = source(path);
  assert.doesNotMatch(text, /from\s+['"](?!\.\.?\/)/, `${path} must not add a dependency`);
  checked += 1;
}

console.log(`edit-3d-universal-conformance.test.mjs passed (${checked} conformance and policy cases)`);
