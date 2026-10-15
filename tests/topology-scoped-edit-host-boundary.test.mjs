import assert from 'node:assert/strict';
import { createTopologyScopedEditReadOnlyHostFixture } from './fixtures/topology-scoped-edit-read-only-host-fixture.js';
const f = await createTopologyScopedEditReadOnlyHostFixture();
const host = await f.hostFactory({ readModel: f.readModelA0, core: f.core,
  authorityProvider: f.authorityGet, effects: f.effectBoundaryFactory() });
const current = f.readModelA0.journalProjection.projection;
for (const [name, envelope, code] of [
  ['boundary', f.envelopes.boundary, f.expectedCodes.boundary],
  ['excluded', f.envelopes.excluded, f.expectedCodes.excluded],
  ['mismatch', f.envelopes.mismatch, f.expectedCodes.mismatch],
  ['unsupported', f.envelopes.unsupported, f.expectedCodes.unsupported],
  ['mixed', f.envelopes.mixedTransaction, f.expectedCodes.mixed],
]) assert.throws(() => host.appendEditCommand(current, envelope),
  (error) => error.code === code, name);
console.log('[PASS] boundary, excluded, mismatch, unsupported, and mixed transactions reject');
