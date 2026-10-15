import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { _test as shadowConformanceTest } from '../tabs/topology-trace-validator/topology-scoped-edit-shadow-conformance.js';
import { _test as shadowRuntimeTest } from '../tabs/topology-trace-validator/topology-scoped-edit-shadow-runtime.js';
import { createTopologyScopedEditShadowFixture } from './fixtures/topology-scoped-edit-shadow-fixture.js';

const f = await createTopologyScopedEditShadowFixture();
const composition = await shadowRuntimeTest.createWithCore({ readModel: f.readModel,
  scopeRequest: f.scopeRequest, authorityProvider: f.authorityGet }, f.core, { cryptoRef: webcrypto });
assert.equal(shadowConformanceTest.exactScopes(composition, f.selectionRequests, 20), 1);
assert.equal(shadowConformanceTest.exactScopes(composition, f.structuralRequests, 20), 1);
assert.equal(shadowConformanceTest.semanticScope(composition,
  f.sectionalRequest).compatibility.parity.valid, true);
assert.equal(shadowConformanceTest.semanticScope(composition,
  f.propagateRequest).compatibility.parity.valid, true);
console.log('[PASS] successful Topology scopes are exact and unsupported scopes reject safely');
