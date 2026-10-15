import assert from 'node:assert/strict';
import {
  SEQUENTIAL_ENGINEERING_SVG_PREVIEW_POLICY,
  SEQUENTIAL_ENGINEERING_SVG_PREVIEW_POLICY_SCHEMA,
  SEQUENTIAL_ENGINEERING_SVG_RENDERER,
} from '../tabs/sequential-sketcher/sequential-engineering-svg-preview-policy.js';

assert.equal(SEQUENTIAL_ENGINEERING_SVG_PREVIEW_POLICY.schema, SEQUENTIAL_ENGINEERING_SVG_PREVIEW_POLICY_SCHEMA);
assert.equal(SEQUENTIAL_ENGINEERING_SVG_PREVIEW_POLICY.defaultRenderer, SEQUENTIAL_ENGINEERING_SVG_RENDERER.CONSTRUCTION);
assert.deepEqual(SEQUENTIAL_ENGINEERING_SVG_PREVIEW_POLICY.availableRenderers, ['CONSTRUCTION_SVG', 'ENGINEERING_SVG_PREVIEW']);
assert.equal(SEQUENTIAL_ENGINEERING_SVG_PREVIEW_POLICY.sharedAccessMode, 'read-only');
assert.equal(SEQUENTIAL_ENGINEERING_SVG_PREVIEW_POLICY.visibleSurfaceRule, 'ONE_ACTIVE_VISUAL_SURFACE');
assert.equal(SEQUENTIAL_ENGINEERING_SVG_PREVIEW_POLICY.preSessionSharedAvailability, 'DISABLED');
assert.equal(SEQUENTIAL_ENGINEERING_SVG_PREVIEW_POLICY.failureFallback, 'CONSTRUCTION_SVG');
assert.equal(SEQUENTIAL_ENGINEERING_SVG_PREVIEW_POLICY.persistence, 'WORKSPACE_ONLY');
assert.ok(Object.isFrozen(SEQUENTIAL_ENGINEERING_SVG_PREVIEW_POLICY));
assert.ok(Object.isFrozen(SEQUENTIAL_ENGINEERING_SVG_PREVIEW_POLICY.availableRenderers));
for (const key of ['sessionFingerprint', 'revision', 'branchSnapshots', 'exports', 'reviewEvidence']) {
  assert.equal(Object.hasOwn(SEQUENTIAL_ENGINEERING_SVG_PREVIEW_POLICY, key), false);
}
console.log('Sequential Engineering SVG preview policy: ok');
