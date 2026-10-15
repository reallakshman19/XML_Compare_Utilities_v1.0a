import assert from 'node:assert/strict';
import { createSequentialBranchWorkspaceRegistry } from '../tabs/sequential-sketcher/sequential-branch-workspace-state.js';
import { createSequentialConstructionSession } from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { sequentialSessionFingerprint } from '../tabs/sequential-sketcher/construction/sequential-session-fingerprint.js';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import { sequentialSourceRecordsFingerprint } from '../tabs/sequential-sketcher/persistence/sequential-workspace-package.js';
import {
  SEQUENTIAL_COMMAND_REJECTION,
  sameSequentialContractValue,
  sequentialSemanticFingerprint,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-command-contracts.js';
import { createSequentialJournalAdoption } from '../tabs/sequential-sketcher/scoped-edit/sequential-command-service.js';
import { createSequentialDraftEditCommandGateway } from '../tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-command-gateway.js';
import { createSequentialWorkspaceCommandBoundary } from '../tabs/sequential-sketcher/scoped-edit/sequential-workspace-command-boundary.js';

const ISSUED_AT = '2026-07-27T14:40:00.000Z';
const LATER_ISSUED_AT = '2026-07-27T14:41:00.000Z';
const ADOPTED_AT = '2026-07-27T14:39:00.000Z';
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function records(branchId) {
  return [{
    type: 'BRANCH', name: branchId,
    attributes: { NAME: branchId, HPOS: { x: 0, y: 0, z: 0 } },
    children: [
      { type: 'PIPE', name: 'P1', attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } } },
      { type: 'CAP', name: 'C1', attributes: { APOS: { x: 100, y: 0, z: 0 } } },
    ],
  }];
}
function ownerSnapshot(model) {
  return Object.freeze({
    revision: Object.freeze({
      schema: 'EngineeringRevisionToken.v1',
      token: sequentialSemanticFingerprint('GATEWAYREV', {
        session: model.session ? sequentialSessionFingerprint(model.session) : null,
      }),
    }),
  });
}
function restoreModel(model, restoration, options) {
  assert.equal(restoration.schema, 'SequentialWorkspaceRestoration.v2');
  assert.equal(options.expectedJournalImpact, 'REPLACE');
  const registry = createSequentialBranchWorkspaceRegistry();
  registry.replace(restoration.branchIds, restoration.workspaces);
  const active = registry.get(restoration.activeBranchId);
  Object.assign(model, {
    records: restoration.records,
    evidence: restoration.evidence,
    indexes: restoration.indexes,
    branchRegistry: registry,
    session: active.session,
    confirmedConstruction: active.confirmedConstruction,
    supportProjection: active.supportProjection,
    selectedCandidateId: active.selectedCandidateId,
    restoredDecisionRegister: restoration.decisionRegister,
    journalState: restoration.journalState,
    workspaceApplicationReceipts: options.applicationReceipts,
  });
  return restoration;
}
function commandBoundary(model, options = {}) {
  return createSequentialWorkspaceCommandBoundary({
    readModel: () => model,
    readOwnerSnapshot: () => model.session ? ownerSnapshot(model) : null,
    readEngineOptions: () => ({}),
    restorePackage: (restoration, restoreOptions) => restoreModel(model, restoration, restoreOptions),
    failureFactory: options.failureFactory,
    syncAfterCommit: options.syncAfterCommit || (() => {}),
  });
}
function fixture(branchId, options = {}) {
  const source = records(branchId);
  const evidence = buildSequentialEvidenceModel(source);
  const indexes = indexSequentialEvidence(evidence);
  const session = createSequentialConstructionSession(branchId);
  const registry = createSequentialBranchWorkspaceRegistry();
  registry.reset([branchId]);
  registry.save(branchId, { session });
  const sourceFingerprint = sequentialSourceRecordsFingerprint(source);
  const journalState = options.journalState === undefined
    ? createSequentialJournalAdoption({
      documentId: `draft-edit-document:${branchId}`,
      sessionId: `draft-edit-session:${branchId}`,
      sourceFingerprint,
      branchRegistry: registry,
      adoptedAt: ADOPTED_AT,
    }) : options.journalState;
  const model = {
    records: source, evidence, indexes, session, branchRegistry: registry, journalState,
    confirmedConstruction: null, supportProjection: null, selectedCandidateId: '',
    restoredDecisionRegister: null, workspaceApplicationReceipts: Object.freeze([]),
  };
  let syncCount = 0;
  const boundary = commandBoundary(model, {
    failureFactory: options.failureFactory,
    syncAfterCommit: () => {
      syncCount += 1;
      if (options.syncFailure) throw new Error('INJECTED_POST_COMMIT_SYNC_FAILURE');
    },
  });
  const gateway = createSequentialDraftEditCommandGateway({
    readCurrentState: boundary.readCurrentState,
    publishCandidate: boundary.publishCandidate,
  });
  return Object.freeze({ model, gateway, boundary, syncCount: () => syncCount });
}
function request(branchId, commandType = 'ADVANCE_ONE', issuedAt = ISSUED_AT) {
  return {
    command: { commandType, branchId },
    origin: { kind: 'USER', actorId: 'DRAFT_EDIT_GATEWAY_TEST', issuedAt },
  };
}

{
  const model = {
    records: null, evidence: null, indexes: null, session: null,
    branchRegistry: createSequentialBranchWorkspaceRegistry(), journalState: null,
  };
  const boundary = commandBoundary(model);
  const gateway = createSequentialDraftEditCommandGateway({
    readCurrentState: boundary.readCurrentState,
    publishCandidate: boundary.publishCandidate,
  });
  assert.equal(gateway.getState().ready, false,
    'uninitialized workspace readiness must be inspectable and fail closed');
}

{
  const test = fixture('/GATEWAY/SUCCESS');
  assert.equal(test.gateway.schema, 'SequentialDraftEditCommandGateway.v1');
  assert.equal(test.gateway.getState().ready, true);
  assert(test.gateway.getState().allowedCommandTypes.includes('ADVANCE_ONE'));
  const input = request('/GATEWAY/SUCCESS');
  const beforeInput = clone(input);
  const result = test.gateway.execute(input);
  assert.equal(result.acceptance.accepted, true);
  assert.equal(result.acceptance.publication.committed, true);
  assert.equal(test.model.journalState.journal.entries.length, 1);
  assert.equal(test.model.branchRegistry.get('/GATEWAY/SUCCESS').session, test.model.session);
  assert.equal(test.syncCount(), 1);
  assert.deepEqual(input, beforeInput, 'gateway must not mutate caller command or origin');
}

{
  const left = fixture('/GATEWAY/DETERMINISTIC').gateway.prepare(request('/GATEWAY/DETERMINISTIC'));
  const right = fixture('/GATEWAY/DETERMINISTIC').gateway.prepare(request('/GATEWAY/DETERMINISTIC'));
  assert(sameSequentialContractValue(left, right), 'equal gateway inputs must prepare deterministically');
}

for (const invalidJournal of [null, false]) {
  const test = fixture('/GATEWAY/NO-AUTHORITY', { journalState: invalidJournal });
  assert.equal(test.gateway.getState().ready, false);
  assert.throws(
    () => test.gateway.prepare(request('/GATEWAY/NO-AUTHORITY')),
    (error) => [SEQUENTIAL_COMMAND_REJECTION.JOURNAL_NOT_ADOPTED,
      SEQUENTIAL_COMMAND_REJECTION.COMMAND_AUTHORITY_MISMATCH].includes(error.code),
  );
}

{
  const test = fixture('/GATEWAY/ADOPTION-STALE');
  test.model.records = [...test.model.records, { type: 'COMMENT', name: 'SOURCE-CHANGED' }];
  assert.equal(test.gateway.getState().ready, false,
    'structurally valid journal with stale adoption basis must not be ready');
  assert.throws(
    () => test.gateway.prepare(request('/GATEWAY/ADOPTION-STALE')),
    (error) => error.code === SEQUENTIAL_COMMAND_REJECTION.COMMAND_AUTHORITY_MISMATCH,
  );
}

{
  const test = fixture('/GATEWAY/JOURNAL-REVISION');
  const prepared = test.gateway.prepare(request('/GATEWAY/JOURNAL-REVISION'));
  const before = clone(test.boundary.readCurrentState().ownerSnapshot.revision);
  test.model.journalState = prepared.candidate.journalState;
  const after = test.boundary.readCurrentState().ownerSnapshot.revision;
  assert.notDeepEqual(after, before,
    'command owner revision must advance when only the journal head advances');
}

{
  const test = fixture('/GATEWAY/JOURNAL-ONLY-COMMIT');
  const first = test.gateway.execute(request('/GATEWAY/JOURNAL-ONLY-COMMIT', 'RUN_UNTIL_BLOCKED'));
  assert.equal(first.acceptance.accepted, true);
  const settledSession = sequentialSessionFingerprint(test.model.session);
  const second = test.gateway.execute(request(
    '/GATEWAY/JOURNAL-ONLY-COMMIT', 'RUN_UNTIL_BLOCKED', LATER_ISSUED_AT,
  ));
  assert.equal(second.acceptance.accepted, true,
    'a no-change native result with an appended journal command must remain a committed acceptance');
  assert.equal(sequentialSessionFingerprint(test.model.session), settledSession);
  assert.equal(test.model.journalState.journal.entries.length, 2);
}

{
  const test = fixture('/GATEWAY/BRANCH');
  assert.throws(
    () => test.gateway.prepare(request('/GATEWAY/OTHER')),
    (error) => error.code === SEQUENTIAL_COMMAND_REJECTION.COMMAND_BRANCH_MISMATCH,
  );
  assert.throws(
    () => test.gateway.prepare(request('/GATEWAY/BRANCH', 'CONNECT_CANDIDATE')),
    (error) => error.code === SEQUENTIAL_COMMAND_REJECTION.COMMAND_RUNTIME_NOT_DETERMINISTIC,
  );
  const badTime = request('/GATEWAY/BRANCH');
  badTime.origin.issuedAt = 'not-an-iso-time';
  assert.throws(
    () => test.gateway.prepare(badTime),
    (error) => error.code === SEQUENTIAL_COMMAND_REJECTION.COMMAND_SCHEMA_INVALID,
  );
  assert.throws(
    () => test.gateway.prepare({}),
    (error) => error.code === SEQUENTIAL_COMMAND_REJECTION.COMMAND_SCHEMA_INVALID,
  );
}

{
  const test = fixture('/GATEWAY/STALE');
  const prepared = test.gateway.prepare(request('/GATEWAY/STALE'));
  test.model.branchRegistry.save('/GATEWAY/STALE', {
    session: test.model.session,
    selectedCandidateId: 'STALE-SELECTION',
  });
  const acceptance = test.gateway.accept(prepared);
  assert.equal(acceptance.accepted, false);
  assert.equal(acceptance.reasonCode, SEQUENTIAL_COMMAND_REJECTION.PREPARED_COMMAND_STALE);
  assert.equal(test.model.journalState.journal.entries.length, 0);
}

{
  const failure = new Error('INJECTED_PRECOMMIT_FAILURE');
  const test = fixture('/GATEWAY/PRECOMMIT', {
    failureFactory: (stage) => stage === 'before-commit' ? failure : null,
  });
  const before = test.boundary.readCurrentState();
  const result = test.gateway.execute(request('/GATEWAY/PRECOMMIT'));
  assert.equal(result.acceptance.accepted, false);
  assert.equal(result.acceptance.publicationState, 'ABORTED');
  assert(sameSequentialContractValue(test.boundary.readCurrentState(), before));
}

{
  const test = fixture('/GATEWAY/POSTCOMMIT', { syncFailure: true });
  const result = test.gateway.execute(request('/GATEWAY/POSTCOMMIT'));
  assert.equal(result.acceptance.accepted, true);
  assert.match(result.acceptance.publication.synchronizationWarning, /INJECTED_POST_COMMIT_SYNC_FAILURE/);
  assert.equal(test.model.journalState.journal.entries.length, 1);
}

console.log('Sequential SSK-TS-3A guarded Draft Edit command gateway: ok');
