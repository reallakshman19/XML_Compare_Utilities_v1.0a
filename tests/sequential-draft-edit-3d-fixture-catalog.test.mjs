import assert from 'node:assert/strict';
import {
  SEQUENTIAL_DRAFT_EDIT_3D_FIXTURE_SCENARIO_IDS,
  SEQUENTIAL_DRAFT_EDIT_3D_FIXTURE_SCENARIOS,
  assertSequentialDraftEdit3dFixtureCatalog,
  createSequentialDraftEdit3dFixtureCatalog,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-3d-fixture-catalog.js';
import { sequentialSemanticFingerprint } from '../tabs/sequential-sketcher/scoped-edit/sequential-command-contracts.js';
import {
  blockedSequentialFixture,
  confirmedSupportSequentialFixture,
  rejectedSequentialFixture,
  repairedSequentialFixture,
} from './helpers/sequential-engineering-svg-fixture.js';

const fixtures = Object.freeze({
  blockedSequentialFixture,
  confirmedSupportSequentialFixture,
  rejectedSequentialFixture,
  repairedSequentialFixture,
});

const catalog = createSequentialDraftEdit3dFixtureCatalog();
const repeated = createSequentialDraftEdit3dFixtureCatalog();
assert.equal(catalog.schema, 'SequentialDraftEdit3dFixtureCatalog.v1');
assert.equal(catalog.workPack, 'SSK-3D-P0-C');
assert.equal(catalog.scenarioCount, 4);
assert.deepEqual(catalog.scenarios, SEQUENTIAL_DRAFT_EDIT_3D_FIXTURE_SCENARIOS);
assert.deepEqual(catalog.scenarios.map((scenario) => scenario.scenarioId),
  SEQUENTIAL_DRAFT_EDIT_3D_FIXTURE_SCENARIO_IDS);
assert.equal(new Set(SEQUENTIAL_DRAFT_EDIT_3D_FIXTURE_SCENARIO_IDS).size, 4);
assert.equal(JSON.stringify(repeated), JSON.stringify(catalog));
assert.equal(Object.isFrozen(catalog), true);

const asserted = assertSequentialDraftEdit3dFixtureCatalog(structuredClone(catalog));
assert.deepEqual(asserted, catalog);
assert.equal(Object.isFrozen(asserted), true);

for (const scenario of catalog.scenarios) {
  assert.equal(typeof fixtures[scenario.fixtureSymbol], 'function',
    `Missing fixture symbol ${scenario.fixtureSymbol}`);
  const fixture = fixtures[scenario.fixtureSymbol]();
  assert.equal(fixture.session.state, scenario.expectedSessionState,
    `${scenario.scenarioId} session state`);
}

const blocked = blockedSequentialFixture();
assert.ok(blocked.session.currentDecisionRequest);
assert.ok(blocked.session.currentDecisionRequest.candidates.length > 1);
const rejected = rejectedSequentialFixture();
assert.ok(rejected.session.rejectedCandidateIds.includes(rejected.rejectedCandidate.candidateId));
assert.ok(rejected.session.decisionLedger.length > 0);
const repaired = repairedSequentialFixture();
assert.ok(repaired.session.repairLedger.length > 0);
assert.ok(repaired.confirmedConstruction);
const supported = confirmedSupportSequentialFixture();
assert.ok(supported.confirmedConstruction);
assert.ok(supported.supportProjection);

function refingerprint(value) {
  const base = { ...value }; delete base.catalogFingerprint;
  value.catalogFingerprint = sequentialSemanticFingerprint('SSK3DFIXTURECATALOG', base);
  return value;
}
const forged = structuredClone(catalog);
forged.scenarios[0].fixtureSymbol = 'inventedFixture';
refingerprint(forged);
assert.throws(() => assertSequentialDraftEdit3dFixtureCatalog(forged),
  /qualified representative scenario inventory/);

console.log('[PASS] representative fixture catalog identity, outcomes and tamper rejection');
