import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { TOPOLOGY_JOURNAL_COMMANDS } from '../tabs/topology-trace-validator/topology-command-replay.js';
import {
  TOPOLOGY_SCOPED_EDIT_SHADOW_RUNTIME_V1,
  _test as shadowRuntimeTest,
} from '../tabs/topology-trace-validator/topology-scoped-edit-shadow-runtime.js';
import { createTopologyScopedEditShadowFixture } from './fixtures/topology-scoped-edit-shadow-fixture.js';

const f = await createTopologyScopedEditShadowFixture();
const composition = await shadowRuntimeTest.createWithCore({ readModel: f.readModel,
  scopeRequest: f.scopeRequest, authorityProvider: f.authorityGet }, f.core, { cryptoRef: webcrypto });
assert.equal(composition.schema, TOPOLOGY_SCOPED_EDIT_SHADOW_RUNTIME_V1);
assert.notStrictEqual(composition.directHost, composition.runtimeHost);
assert.equal(composition.runtime.getState().status, 'READY');
assert.deepEqual(composition.runtime.getState().replayState.state, f.readModel.replayState);
assert.deepEqual(composition.reducerRegistry.commandTypes, Object.values(TOPOLOGY_JOURNAL_COMMANDS).sort());
assert(Object.values(composition.sideEffects()).every((value) => value === 0));
console.log('[PASS] certified Topology host composes with the unchanged shared runtime');
