import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  _test as shadowRuntimeTest,
  runTopologyShadowLifecycleParity,
} from '../tabs/topology-trace-validator/topology-scoped-edit-shadow-runtime.js';
import { createTopologyScopedEditShadowFixture } from './fixtures/topology-scoped-edit-shadow-fixture.js';

const f = await createTopologyScopedEditShadowFixture();
const composition = await shadowRuntimeTest.createWithCore({ readModel: f.readModel,
  scopeRequest: f.scopeRequest, authorityProvider: f.authorityGet }, f.core, { cryptoRef: webcrypto });
const result = await runTopologyShadowLifecycleParity(composition);
assert.equal(result.compatibility.parity.mode, 'EXACT');
assert.equal(result.compatibility.parity.valid, true);
assert.deepEqual(result.direct.normalized, result.runtime.normalized);
assert.equal(result.runtime.original.status, 'DESTROYED');
assert.equal(result.runtime.host.destroyed, true);
console.log('[PASS] destroy/remount lifecycle evidence remains deterministic and exact');
