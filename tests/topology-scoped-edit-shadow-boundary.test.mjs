import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { _test as shadowConformanceTest } from '../tabs/topology-trace-validator/topology-scoped-edit-shadow-conformance.js';
import { _test as shadowRuntimeTest } from '../tabs/topology-trace-validator/topology-scoped-edit-shadow-runtime.js';
import { createTopologyScopedEditShadowFixture } from './fixtures/topology-scoped-edit-shadow-fixture.js';

const f = await createTopologyScopedEditShadowFixture();
const composition = await shadowRuntimeTest.createWithCore({ readModel: f.readModel,
  scopeRequest: f.scopeRequest, authorityProvider: f.authorityGet }, f.core, { cryptoRef: webcrypto });
for (const input of [f.boundary, f.excluded, f.unsupported, f.mismatch]) {
  const result = shadowConformanceTest.semanticTarget(composition, input);
  assert.equal(result.compatibility.parity.mode, 'SEMANTIC_SAFETY');
  assert.equal(result.compatibility.parity.valid, true);
  assert.equal(result.direct.accepted, false);
  assert.equal(result.runtime.accepted, false);
}
const boundary = shadowConformanceTest.semanticTarget(composition, f.boundary);
assert.equal(boundary.direct.rejectionCode, f.expectedCodes.boundary);
assert(['BOUNDARY_FROZEN', 'BOUNDARY_GHOSTED'].includes(boundary.runtime.rejectionCode));
assert.equal(boundary.compatibility.parity.safeEarlyRejection, true);
console.log('[PASS] layer-specific rejection codes preserve zero-effect semantic safety');
