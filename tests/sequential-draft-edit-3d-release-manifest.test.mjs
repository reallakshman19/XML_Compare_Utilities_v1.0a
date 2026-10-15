import assert from 'node:assert/strict';
import {
  SEQUENTIAL_DRAFT_EDIT_3D_FIXTURE_SCENARIO_IDS,
  createSequentialDraftEdit3dFixtureCatalog,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-3d-fixture-catalog.js';
import {
  SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_IDS,
  createSequentialDraftEdit3dLimitationRegister,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-3d-limitation-register.js';
import {
  SEQUENTIAL_DRAFT_EDIT_3D_BASELINE,
  SEQUENTIAL_DRAFT_EDIT_3D_CAPABILITIES,
  assertSequentialDraftEdit3dReleaseManifest,
  createSequentialDraftEdit3dReleaseManifest,
  sequentialDraftEdit3dReleaseManifestFileName,
  validateSequentialDraftEdit3dReleaseManifest,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-3d-release-manifest.js';
import { createSequentialBranchWorkspaceRegistry } from '../tabs/sequential-sketcher/sequential-branch-workspace-state.js';
import { createSequentialConstructionSession } from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { sequentialSemanticFingerprint } from '../tabs/sequential-sketcher/scoped-edit/sequential-command-contracts.js';
import {
  createSequentialCommandJournalState,
  sequentialCommandJournalHeadFingerprint,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-command-journal.js';

const createdAt = '2026-07-30T02:10:00.000Z';
const branchRegistry = createSequentialBranchWorkspaceRegistry();
branchRegistry.reset(['BRANCH-A']);
branchRegistry.save('BRANCH-A', { session: createSequentialConstructionSession('BRANCH-A') });

function journalAt(adoptedAt) {
  return createSequentialCommandJournalState({
    documentId: 'DOC-1', sessionId: 'SESSION-1', sourceFingerprint: 'SOURCE-1',
    branchSetFingerprint: 'BRANCH-SET-1', branchRegistry, adoptedAt,
  });
}

const journalState = journalAt(createdAt);
const input = Object.freeze({
  controllerSchema: 'SequentialScopedEdit3dController.v1',
  controllerState: {
    available: true, mounted: true, active: true, mountKey: 'MOUNT-1', failureCount: 0,
    destroyed: false, viewerState: { runtimeRevision: 'REV-1', runtimeError: null,
      runtimePending: false, instanceCount: 5, drawBatchCount: 2, sceneChunkCount: 1 },
    commandGateway: { allowedCommandTypes: [...SEQUENTIAL_DRAFT_EDIT_3D_CAPABILITIES.supervisedCommands].reverse() },
  },
  shadowEvidence: { schema: 'SequentialScopedEditProductionShadowEvidence.v1', mountKey: 'MOUNT-1' },
  commandState: { sourceFingerprint: 'SOURCE-1', session: { rootBranchId: 'BRANCH-A' },
    journalState },
  supportState: { supportAdjustmentHistory: { historyFingerprint: 'SUPPORT-HISTORY-1',
    currentRegister: { headFingerprint: 'SUPPORT-HEAD-1' } },
    supportAdjustmentRegister: { headFingerprint: 'SUPPORT-HEAD-1' } },
  geometryState: { geometryEditJournal: { headFingerprint: 'GEOMETRY-HEAD-1', entries: [{ id: 'GE-1' }] } },
  view: { readModel: { schema: 'SequentialEffectiveGeometryReadModel.v1', branchId: 'BRANCH-A',
    authorityId: 'AUTH-1', revision: { schema: 'Revision.v1', token: 'R1' } },
    scene: { schema: 'EngineeringScene.v1', sceneId: 'SCENE-1', entities: [{ id: 'A' }, { id: 'B' }] } },
});

const manifest = createSequentialDraftEdit3dReleaseManifest(input);
const repeated = createSequentialDraftEdit3dReleaseManifest(input);
assert.equal(manifest.schema, 'SequentialDraftEdit3dReleaseManifest.v1');
assert.equal(manifest.createdAt, journalState.journal.updatedAt);
assert.equal(JSON.stringify(repeated), JSON.stringify(manifest));
assert.equal(repeated.manifestFingerprint, manifest.manifestFingerprint);
assert.equal(manifest.baseline.commit, '19e04711fc54083bd8e622bbd82048839ca8ebfa');
assert.deepEqual(manifest.baseline, SEQUENTIAL_DRAFT_EDIT_3D_BASELINE);
assert.equal(manifest.authority.branchId, 'BRANCH-A');
assert.equal(manifest.authority.entityCount, 2);
assert.equal(manifest.journals.commandJournalHeadFingerprint,
  sequentialCommandJournalHeadFingerprint(journalState));
assert.equal(manifest.journals.supportRegisterHeadFingerprint, 'SUPPORT-HEAD-1');
assert.equal(manifest.journals.geometryJournalHeadFingerprint, 'GEOMETRY-HEAD-1');
assert.equal(manifest.journals.geometryEntryCount, 1);
assert.deepEqual(manifest.fixtureCatalog, createSequentialDraftEdit3dFixtureCatalog());
assert.deepEqual(manifest.fixtureCatalog.scenarios.map((scenario) => scenario.scenarioId),
  SEQUENTIAL_DRAFT_EDIT_3D_FIXTURE_SCENARIO_IDS);
assert.deepEqual(manifest.limitationRegister, createSequentialDraftEdit3dLimitationRegister());
assert.deepEqual(manifest.limitationRegister.entries.map((entry) => entry.limitationId),
  SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_IDS);
assert.deepEqual(manifest.limitations, SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_IDS);
assert.equal(manifest.limitationRegister.ownershipAttestation.trustBoundary.signerIdentity,
  'NOT_ESTABLISHED');
assert.equal(manifest.controller.fallbackSurface, 'CONSTRUCTION_SVG');
assert.equal(manifest.disposition.internalPilotReady, false);
assert.equal(manifest.disposition.newEditingAuthority, false);
assert.equal(Object.isFrozen(manifest), true);

const mutableManifest = structuredClone(manifest);
const assertedManifest = assertSequentialDraftEdit3dReleaseManifest(mutableManifest);
assert.deepEqual(assertedManifest, manifest);
assert.notEqual(assertedManifest, mutableManifest);
assert.equal(Object.isFrozen(assertedManifest), true);
assert.equal(validateSequentialDraftEdit3dReleaseManifest(manifest, input).manifestFingerprint,
  manifest.manifestFingerprint);
assert.equal(sequentialDraftEdit3dReleaseManifestFileName(manifest),
  'ssk-draft-edit-3d.BRANCH-A.release-manifest.v1.json');

const routedManifest = createSequentialDraftEdit3dReleaseManifest({ ...input,
  commandState: { ...input.commandState, session: { rootBranchId: '/AREA/BRANCH-A' } },
  view: { ...input.view, readModel: { ...input.view.readModel, branchId: '/AREA/BRANCH-A' } } });
assert.equal(sequentialDraftEdit3dReleaseManifestFileName(routedManifest),
  'ssk-draft-edit-3d.AREA-BRANCH-A.release-manifest.v1.json');

assert.throws(() => createSequentialDraftEdit3dReleaseManifest({ ...input,
  commandState: { ...input.commandState, journalState: null } }),
/commandState\.journalState is required/);

const changedJournalState = journalAt('2026-07-30T02:11:00.000Z');
const changedJournal = createSequentialDraftEdit3dReleaseManifest({ ...input,
  commandState: { ...input.commandState, journalState: changedJournalState } });
assert.notEqual(changedJournal.createdAt, manifest.createdAt);
assert.notEqual(changedJournal.journals.commandJournalHeadFingerprint,
  manifest.journals.commandJournalHeadFingerprint);
assert.notEqual(changedJournal.manifestFingerprint, manifest.manifestFingerprint);
assert.throws(() => validateSequentialDraftEdit3dReleaseManifest(manifest, { ...input,
  commandState: { ...input.commandState, journalState: changedJournalState } }));

function refingerprint(value) {
  const base = { ...value };
  delete base.manifestFingerprint;
  value.manifestFingerprint = sequentialSemanticFingerprint('SSK3DRELEASE', base);
  return value;
}
const forgedBaseline = structuredClone(manifest);
forgedBaseline.baseline.commit = '0'.repeat(40); refingerprint(forgedBaseline);
assert.throws(() => assertSequentialDraftEdit3dReleaseManifest(forgedBaseline));
const forgedCapability = structuredClone(manifest);
forgedCapability.capabilities.geometryOperations = ['MOVE_COMPONENT']; refingerprint(forgedCapability);
assert.throws(() => assertSequentialDraftEdit3dReleaseManifest(forgedCapability));
const forgedCatalog = structuredClone(manifest);
forgedCatalog.fixtureCatalog.scenarios[0].fixtureSymbol = 'inventedFixture'; refingerprint(forgedCatalog);
assert.throws(() => assertSequentialDraftEdit3dReleaseManifest(forgedCatalog));
const forgedRegister = structuredClone(manifest);
forgedRegister.limitationRegister.entries[0].accountableRole = 'UNAUTHORIZED_OWNER';
refingerprint(forgedRegister);
assert.throws(() => assertSequentialDraftEdit3dReleaseManifest(forgedRegister));
const forgedDisposition = structuredClone(manifest);
forgedDisposition.disposition.internalPilotReady = true; refingerprint(forgedDisposition);
assert.throws(() => assertSequentialDraftEdit3dReleaseManifest(forgedDisposition));
assert.throws(() => validateSequentialDraftEdit3dReleaseManifest(manifest, { ...input,
  geometryState: { geometryEditJournal: { headFingerprint: 'GEOMETRY-HEAD-2', entries: [] } } }));
assert.throws(() => createSequentialDraftEdit3dReleaseManifest({ ...input,
  controllerState: { ...input.controllerState, available: false } }));
assert.throws(() => createSequentialDraftEdit3dReleaseManifest({ ...input,
  view: { ...input.view, readModel: { ...input.view.readModel, branchId: 'BRANCH-B' } } }));
console.log('[PASS] byte-stable authority, fixture catalog, limitation register and regeneration');
