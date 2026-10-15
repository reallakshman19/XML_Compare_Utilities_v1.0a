import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  CERTIFIED_REPOSITORY_TOPOLOGY_SHADOW_RUNTIME,
  TOPOLOGY_SHADOW_MINIMUM_SCALE,
  _test as shadowConformanceTest,
} from '../tabs/topology-trace-validator/topology-scoped-edit-shadow-conformance.js';
import { createTopologyScopedEditShadowFixture } from './fixtures/topology-scoped-edit-shadow-fixture.js';

const fixture = await createTopologyScopedEditShadowFixture();
const report = await shadowConformanceTest.runWithCore({ fixture }, fixture.core, { cryptoRef: webcrypto });
assert.equal(report.subject, CERTIFIED_REPOSITORY_TOPOLOGY_SHADOW_RUNTIME);
assert.equal(report.passed, true);
assert.deepEqual(report.scale, TOPOLOGY_SHADOW_MINIMUM_SCALE);
assert(Object.values(report.variants).every((value) => value === 1));
assert(Object.values(report.sideEffects).every((value) => value === 0));
assert.equal(report.directHostRejections.boundary, 'BOUNDARY_TARGET_NOT_EDITABLE');
assert(report.runtimeRejections.boundary.includes('BOUNDARY_FROZEN'));
console.log('[PASS] repository Topology shadow runtime satisfies exact and semantic-safety conformance');
