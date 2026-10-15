import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  _test as shadowRuntimeTest,
  runTopologyShadowPositiveParity,
} from '../tabs/topology-trace-validator/topology-scoped-edit-shadow-runtime.js';
import { createTopologyScopedEditShadowFixture } from './fixtures/topology-scoped-edit-shadow-fixture.js';

const f = await createTopologyScopedEditShadowFixture();
const composition = await shadowRuntimeTest.createWithCore({ readModel: f.readModel,
  scopeRequest: f.scopeRequest, authorityProvider: f.authorityGet }, f.core, { cryptoRef: webcrypto });
const result = runTopologyShadowPositiveParity(composition, f.positive);
assert.equal(result.compatibility.parity.mode, 'EXACT');
assert.equal(result.compatibility.parity.valid, true);
assert.deepEqual(result.direct.evidence.candidateProjection, result.runtime.evidence.candidateProjection);
assert.deepEqual(result.direct.evidence.candidateReplay, result.runtime.evidence.candidateReplay);
assert.equal(result.direct.evidence.projectionHash, result.runtime.evidence.projectionHash);
console.log('[PASS] authorized direct and runtime candidate projection/replay evidence is exact');
