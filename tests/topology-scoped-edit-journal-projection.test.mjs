import assert from 'node:assert/strict';
import { createTopologyScopedEditReadOnlyHostFixture } from './fixtures/topology-scoped-edit-read-only-host-fixture.js';
const f = await createTopologyScopedEditReadOnlyHostFixture();
const host = await f.hostFactory({ readModel: f.readModelA0, core: f.core,
  authorityProvider: f.authorityGet, effects: f.effectBoundaryFactory() });
const current = f.readModelA0.journalProjection.projection;
const result = host.dryRun(current, f.envelopes.authorized);
assert.equal(result.accepted, false); assert.equal(result.persistencePerformed, false);
assert.equal(result.productionAcceptancePerformed, false);
assert.deepEqual(result.currentRedoCommandIds, ['CJ-000004']);
assert.equal(result.candidateProjection.envelopes.length, current.envelopes.length + 1);
assert.deepEqual(result.candidateProjection.envelopes.slice(0, -1), current.envelopes);
console.log('[PASS] exact journal projection, redo evidence, and pure dry-run history preservation');
