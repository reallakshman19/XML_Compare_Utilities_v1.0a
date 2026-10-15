/** Immutable representative-fixture catalog for the Sequential Draft Edit 3D pilot. */
import { immutableJson } from '../../../contracts/contract-values.js';
import { sequentialSemanticFingerprint } from './sequential-command-contracts.js';

export const SEQUENTIAL_DRAFT_EDIT_3D_FIXTURE_CATALOG_SCHEMA =
  'SequentialDraftEdit3dFixtureCatalog.v1';
export const SEQUENTIAL_DRAFT_EDIT_3D_FIXTURE_SOURCE =
  'tests/helpers/sequential-engineering-svg-fixture.js';

const SCENARIO_MATERIAL = [
  {
    scenarioId: 'SSK3D-FIXTURE-AMBIGUOUS-BLOCKED',
    fixtureSymbol: 'blockedSequentialFixture',
    purpose: 'Ambiguous continuation blocks until a supervised connection decision is made.',
    expectedSessionState: 'USER_DECISION_REQUIRED',
    requiredEvidence: ['currentDecisionRequest', 'candidateSet', 'branchAuthority'],
    exercisedOperations: ['RUN_UNTIL_BLOCKED'],
    governingLimitations: ['NO_AUTOMATIC_TOPOLOGY_REPAIR'],
  },
  {
    scenarioId: 'SSK3D-FIXTURE-CANDIDATE-REJECTED',
    fixtureSymbol: 'rejectedSequentialFixture',
    purpose: 'Explicit rejection is retained as supervised decision evidence.',
    expectedSessionState: 'USER_DECISION_REQUIRED',
    requiredEvidence: ['decisionLedger', 'rejectedCandidateIds', 'currentDecisionRequest'],
    exercisedOperations: ['REJECT_CANDIDATE'],
    governingLimitations: ['NO_AUTOMATIC_TOPOLOGY_REPAIR'],
  },
  {
    scenarioId: 'SSK3D-FIXTURE-GAP-REPAIRED',
    fixtureSymbol: 'repairedSequentialFixture',
    purpose: 'A within-policy gap is repaired before confirmed construction is created.',
    expectedSessionState: 'ROUTE_COMPLETE',
    requiredEvidence: ['repairLedger', 'confirmedConstruction', 'committedConnections'],
    exercisedOperations: ['RUN_UNTIL_BLOCKED'],
    governingLimitations: ['ENGINEERING_DEMO_ONLY'],
  },
  {
    scenarioId: 'SSK3D-FIXTURE-SUPPORT-CONFIRMED',
    fixtureSymbol: 'confirmedSupportSequentialFixture',
    purpose: 'Confirmed construction carries deterministic support-projection evidence.',
    expectedSessionState: 'ROUTE_COMPLETE',
    requiredEvidence: ['confirmedConstruction', 'supportProjection', 'supportFamily'],
    exercisedOperations: ['RUN_UNTIL_BLOCKED'],
    governingLimitations: ['NO_GEOMETRY_OR_SUPPORT_PERSISTENCE_IN_PORTABLE_PACKAGE'],
  },
];

export const SEQUENTIAL_DRAFT_EDIT_3D_FIXTURE_SCENARIOS =
  immutableJson(SCENARIO_MATERIAL, 'Sequential Draft Edit 3D fixture scenarios');
export const SEQUENTIAL_DRAFT_EDIT_3D_FIXTURE_SCENARIO_IDS = Object.freeze(
  SEQUENTIAL_DRAFT_EDIT_3D_FIXTURE_SCENARIOS.map((scenario) => scenario.scenarioId),
);

function fail(message, Constructor = RangeError) { throw new Constructor(message); }
function material() {
  return {
    schema: SEQUENTIAL_DRAFT_EDIT_3D_FIXTURE_CATALOG_SCHEMA,
    workPack: 'SSK-3D-P0-C',
    sourceModule: SEQUENTIAL_DRAFT_EDIT_3D_FIXTURE_SOURCE,
    scenarioCount: SEQUENTIAL_DRAFT_EDIT_3D_FIXTURE_SCENARIOS.length,
    scenarios: SEQUENTIAL_DRAFT_EDIT_3D_FIXTURE_SCENARIOS,
  };
}
function invariant(value) {
  try {
    const ids = value.scenarios?.map((scenario) => scenario.scenarioId) || [];
    return value.workPack === 'SSK-3D-P0-C'
      && value.sourceModule === SEQUENTIAL_DRAFT_EDIT_3D_FIXTURE_SOURCE
      && value.scenarioCount === SEQUENTIAL_DRAFT_EDIT_3D_FIXTURE_SCENARIOS.length
      && new Set(ids).size === ids.length
      && JSON.stringify(value.scenarios) === JSON.stringify(SEQUENTIAL_DRAFT_EDIT_3D_FIXTURE_SCENARIOS);
  } catch { return false; }
}

export function createSequentialDraftEdit3dFixtureCatalog() {
  const base = material();
  return immutableJson({
    ...base,
    catalogFingerprint: sequentialSemanticFingerprint('SSK3DFIXTURECATALOG', base),
  }, 'Sequential Draft Edit 3D fixture catalog');
}

export function assertSequentialDraftEdit3dFixtureCatalog(value) {
  const catalog = immutableJson(value, 'Sequential Draft Edit 3D fixture catalog');
  if (catalog.schema !== SEQUENTIAL_DRAFT_EDIT_3D_FIXTURE_CATALOG_SCHEMA) {
    fail(`Fixture catalog must use ${SEQUENTIAL_DRAFT_EDIT_3D_FIXTURE_CATALOG_SCHEMA}.`, TypeError);
  }
  const { catalogFingerprint, ...base } = catalog;
  if (catalogFingerprint !== sequentialSemanticFingerprint('SSK3DFIXTURECATALOG', base)
    || !invariant(catalog)) {
    fail('Fixture catalog differs from the qualified representative scenario inventory.');
  }
  return catalog;
}
