import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { stableToken } from '../tabs/sequential-sketcher/sequential-sketcher-contract.js';
import { createSequentialBranchWorkspaceRegistry } from '../tabs/sequential-sketcher/sequential-branch-workspace-state.js';
import {
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { freezeConstructionSession } from '../tabs/sequential-sketcher/construction/sequential-construction-contract.js';
import { sequentialSessionFingerprint } from '../tabs/sequential-sketcher/construction/sequential-session-fingerprint.js';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  SEQUENTIAL_COMMAND_REJECTION,
  sameSequentialContractValue,
  sequentialSemanticFingerprint,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-command-contracts.js';
import {
  createSequentialCommandJournalState,
  validateSequentialCommandJournalState,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-command-journal.js';
import { createSequentialCommandService, createSequentialJournalAdoption } from '../tabs/sequential-sketcher/scoped-edit/sequential-command-service.js';
import { deriveSequentialEditAuthority } from '../tabs/sequential-sketcher/scoped-edit/sequential-edit-authority.js';

const ADOPTED_AT = '2026-07-26T15:00:00.000Z';
const ISSUED_AT = '2026-07-26T15:01:00.000Z';
function pipe(name, start, end) { return { type: 'PIPE', name, attributes: { APOS: start, LPOS: end } }; }
function branch(name, attributes, children) { return { type: 'BRANCH', name, attributes: { NAME: name, ...attributes }, children }; }
function sourceFingerprint(records) { return `TEST-SOURCE-${stableToken(JSON.stringify(records))}`; }
function ownerRevision(label) { return Object.freeze({ revision: Object.freeze({ schema: 'EngineeringRevisionToken.v1', token: label }) }); }
function completeRecords(branchId) {
  return [branch(branchId, { HPOS: { x: 0, y: 0, z: 0 } }, [
    pipe('P1', { x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }),
    { type: 'CAP', name: 'C1', attributes: { APOS: { x: 100, y: 0, z: 0 } } },
  ])];
}
function blockedRecords(branchId) {
  return [branch(branchId, {
    HPOS: { x: 0, y: 100, z: 0 }, TREF: '/AUTH/MISSING/TARGET',
  }, [pipe('P2', { x: 0, y: 100, z: 0 }, { x: 100, y: 100, z: 0 })])];
}
function candidateSession(branchId, candidateId = 'CANDIDATE-AUTH-001') {
  const base = createSequentialConstructionSession(branchId);
  const point = Object.freeze({ x: 100, y: 0, z: 0 });
  const fromPortId = `${branchId}/P1:LPOS`;
  const toPortId = `${branchId}/C1:APOS`;
  const candidate = Object.freeze({
    candidateId, referenceTarget: branchId, referenceKind: 'BRANCH',
    targetPortId: fromPortId, connectedPortId: toPortId,
    fromPortId, toPortId, targetBranchId: branchId,
    targetComponentId: `${branchId}/C1`, targetSourceComponentId: `${branchId}/C1`,
    targetPortRole: 'END', targetPosition: point, connectedPosition: point,
    targetSourcePosition: point, connectedSourcePosition: point,
    targetPositionBasis: 'TEST_EXACT', connectedPositionBasis: 'TEST_EXACT',
    boundaryPosition: point, totalGapMm: 0, targetToBoundaryGapMm: 0,
    boundaryToConnectedGapMm: 0, derivedBranchLegLengthMm: 0,
  });
  return freezeConstructionSession({
    ...base, state: 'USER_DECISION_REQUIRED',
    currentDecisionRequest: Object.freeze({
      schema: 'SequentialConnectionDecision.v1', decisionId: 'DECISION-00001',
      state: 'OPEN', reason: 'AMBIGUOUS_HEAD_REFERENCE', activePortId: fromPortId,
      candidates: Object.freeze([candidate]), resolution: null,
      decisionScope: 'CONNECTION', branchId,
      startComponentId: `${branchId}/P1`, startEntryPortId: `${branchId}/P1:APOS`,
    }),
  });
}
function candidateCommand(commandType, branchId, candidateId = 'CANDIDATE-AUTH-001') {
  const manual = commandType === 'MANUAL_CONNECT';
  return {
    commandType, branchId, decisionId: 'DECISION-00001', candidateId,
    fromPortId: manual ? `${branchId}/P1:LPOS` : null,
    toPortId: manual ? `${branchId}/C1:APOS` : null,
    payload: {
      reason: 'Reviewed exact current candidate authority.',
      evidenceNote: 'Candidate identity, port pair and current decision were independently verified.',
      targetEntityId: `ssk:candidate:${candidateId}`,
    },
  };
}
function boundaryCommand(commandType, branchId, decisionId) {
  return {
    commandType, branchId, decisionId,
    payload: {
      reason: 'Reviewed unresolved boundary evidence and classified the current boundary.',
      evidenceNote: 'Current zero-candidate decision and source reference evidence were verified.',
      decisionTargetId: 'SSK3DDECISION-TEST',
      targetDecisionReason: 'REFERENCE_TARGET_MISSING',
      targetDecisionScope: 'HEAD_BOUNDARY',
      targetReference: '/AUTH/MISSING/TARGET',
    },
  };
}
function createFixture(records, branchId, suppliedSession = null, publisher = null) {
  const evidence = buildSequentialEvidenceModel(records);
  const indexes = indexSequentialEvidence(evidence);
  const session = suppliedSession || createSequentialConstructionSession(branchId);
  const branchRegistry = createSequentialBranchWorkspaceRegistry();
  branchRegistry.reset(evidence.branches.map((row) => row.branchId).sort());
  branchRegistry.save(branchId, { session });
  const fingerprint = sourceFingerprint(records);
  const journalState = createSequentialJournalAdoption({
    documentId: `sequential-document:${fingerprint}`,
    sessionId: `sequential-session:${fingerprint}`,
    sourceFingerprint: fingerprint, branchRegistry, adoptedAt: ADOPTED_AT,
  });
  let state = {
    sourceFingerprint: fingerprint, evidence, indexes, session, branchRegistry, journalState,
    confirmedConstruction: null, supportProjection: null, ownerSnapshot: ownerRevision('REV-0'),
    engineOptions: {},
  };
  let publicationCount = 0;
  function atomicPublish({ candidate, expectedAuthority, preparedId, envelope }) {
    assert(sameSequentialContractValue(deriveSequentialEditAuthority(state), expectedAuthority));
    if (publisher) return publisher({ candidate, expectedAuthority, preparedId, envelope, state });
    branchRegistry.replace(branchRegistry.ids(), candidate.branchEntries);
    state = {
      ...state, session: candidate.session,
      confirmedConstruction: candidate.confirmedConstruction,
      supportProjection: candidate.supportProjection,
      journalState: candidate.journalState,
      ownerSnapshot: ownerRevision(sequentialSemanticFingerprint('TESTREV', {
        preparedId, session: sequentialSessionFingerprint(candidate.session),
        journalSequence: candidate.journalState.journal.nextSequence,
      })),
    };
    publicationCount += 1;
    return Object.freeze({
      schema: 'SequentialCommandPublication.v1', committed: true, preparedId,
      expectedAuthorityId: expectedAuthority.authorityId,
    });
  }
  return Object.freeze({
    read: () => state, set: (patch) => { state = { ...state, ...patch }; }, branchRegistry,
    service: () => createSequentialCommandService({ readCurrentState: () => state, publishCandidate: atomicPublish }),
    publications: () => publicationCount,
  });
}
function prepareAdvance(fixture) {
  return fixture.service().prepare({
    command: { commandType: 'ADVANCE_ONE', branchId: fixture.read().session.rootBranchId },
    origin: { kind: 'USER', actorId: 'AUTHORITY_TEST', issuedAt: ISSUED_AT },
  });
}

{
  const fixture = createFixture(completeRecords('/AUTH/COMPLETE'), '/AUTH/COMPLETE');
  const service = fixture.service();
  const prepared = prepareAdvance(fixture);
  assert.equal(prepared.envelope.transactionId, prepared.candidate.transactionIds[0]);
  assert.equal(prepared.candidate.session.transactionLedger.at(-1).createdAt, ISSUED_AT);
  assert.equal(prepared.candidate.journalState.journal.entries.at(-1).transactionId, prepared.envelope.transactionId);
  const acceptance = service.accept(prepared);
  assert.equal(acceptance.accepted, true);
  assert.equal(acceptance.publication.committed, true);
  assert.equal(acceptance.publicationState, 'COMMITTED');
  assert.equal(acceptance.containmentRequired, false);
  assert.equal(fixture.publications(), 1);
}

{
  const left = prepareAdvance(createFixture(completeRecords('/AUTH/DETERMINISTIC'), '/AUTH/DETERMINISTIC'));
  const right = prepareAdvance(createFixture(completeRecords('/AUTH/DETERMINISTIC'), '/AUTH/DETERMINISTIC'));
  assert(sameSequentialContractValue(left, right), 'explicit issuedAt must make preparation byte-semantically deterministic');
}

for (const [label, mutate] of [
  ['owner revision', (fixture) => fixture.set({ ownerSnapshot: ownerRevision('REV-STALE') })],
  ['journal head', (fixture, prepared) => fixture.set({ journalState: prepared.candidate.journalState })],
  ['branch set', (fixture) => fixture.branchRegistry.save(fixture.read().session.rootBranchId, {
    session: fixture.read().session, selectedCandidateId: 'STALE-SELECTION',
  })],
  ['support state', (fixture) => fixture.set({ supportProjection: Object.freeze({
    schema: 'SequentialConfirmedSupportProjection.v1', constructionFingerprint: 'STALE-SUPPORT', supportGlyphs: [],
  }) })],
  ['undo head', (fixture) => fixture.set({ session: freezeConstructionSession({
    ...fixture.read().session, undoStack: [{ transactionId: 'TXN-STALE-UNDO' }],
  }) })],
]) {
  const fixture = createFixture(completeRecords(`/AUTH/STALE/${label}`), `/AUTH/STALE/${label}`);
  const service = fixture.service();
  const prepared = prepareAdvance(fixture);
  mutate(fixture, prepared);
  const acceptance = service.accept(prepared);
  assert.equal(acceptance.accepted, false, `${label} change must reject stale work`);
  assert.equal(acceptance.reasonCode, SEQUENTIAL_COMMAND_REJECTION.PREPARED_COMMAND_STALE);
  assert.equal(fixture.publications(), 0);
}

{
  const fixture = createFixture(completeRecords('/AUTH/TAMPER'), '/AUTH/TAMPER');
  const service = fixture.service();
  const prepared = prepareAdvance(fixture);
  const tampered = Object.freeze({ ...prepared, candidate: Object.freeze({ ...prepared.candidate, outcome: 'TAMPERED' }) });
  const acceptance = service.accept(tampered);
  assert.equal(acceptance.accepted, false);
  assert.equal(acceptance.reasonCode, SEQUENTIAL_COMMAND_REJECTION.PREPARED_COMMAND_INVALID);
}

{
  const branchId = '/AUTH/BLOCKED';
  const records = blockedRecords(branchId);
  const evidence = buildSequentialEvidenceModel(records);
  const indexes = indexSequentialEvidence(evidence);
  const blocked = runConstructionUntilBlocked(
    createSequentialConstructionSession(branchId), evidence, indexes, { commandIssuedAt: ADOPTED_AT },
  ).session;
  const fixture = createFixture(records, branchId, blocked);
  assert.throws(() => fixture.service().prepare({
    command: { commandType: 'DEFER_DECISION', branchId, decisionId: 'D-WRONG' },
    origin: { kind: 'USER', actorId: 'AUTHORITY_TEST', issuedAt: ISSUED_AT },
  }), (error) => error.code === SEQUENTIAL_COMMAND_REJECTION.CURRENT_DECISION_MISMATCH);
}

{
  const branchId = '/AUTH/CORRUPT';
  const session = createSequentialConstructionSession(branchId);
  const after = freezeConstructionSession({ ...session, state: 'BUILDING' });
  const transaction = Object.freeze({
    schema: 'SequentialConstructionTransaction.v1', transactionId: 'TXN-CORRUPT',
    beforeFingerprint: sequentialSessionFingerprint(session), afterFingerprint: sequentialSessionFingerprint(after),
  });
  const corrupt = freezeConstructionSession({
    ...after, transactionLedger: [transaction],
    undoStack: [{
      schema: 'SequentialConstructionUndoEntry.v1', transactionId: transaction.transactionId,
      action: 'ADVANCE_ONE', beforeFingerprint: 'CORRUPTED', afterFingerprint: transaction.afterFingerprint,
      beforeSnapshot: session, afterSnapshot: after,
    }],
  });
  const registry = createSequentialBranchWorkspaceRegistry();
  registry.reset([branchId]); registry.save(branchId, { session: corrupt });
  assert.throws(() => createSequentialCommandJournalState({
    documentId: 'sequential-document:corrupt', sessionId: 'sequential-session:corrupt',
    sourceFingerprint: 'SOURCE-CORRUPT', branchRegistry: registry,
    branchSetFingerprint: 'BRANCHSET-CORRUPT', adoptedAt: ADOPTED_AT,
  }), (error) => error.code === SEQUENTIAL_COMMAND_REJECTION.LEGACY_HISTORY_INVALID);
}

{
  let attempted = 0;
  const failure = Object.assign(new Error('Persistence failed before atomic commit.'), { code: 'PERSISTENCE_FAILED' });
  const fixture = createFixture(completeRecords('/AUTH/PUBLISH-FAIL'), '/AUTH/PUBLISH-FAIL', null, () => {
    attempted += 1; throw failure;
  });
  const before = deriveSequentialEditAuthority(fixture.read());
  const acceptance = fixture.service().accept(prepareAdvance(fixture));
  assert.equal(acceptance.accepted, false);
  assert.equal(acceptance.reasonCode, 'PERSISTENCE_FAILED');
  assert.equal(acceptance.publicationState, 'ABORTED');
  assert.equal(acceptance.containmentRequired, false);
  assert.equal(attempted, 1);
  assert(sameSequentialContractValue(deriveSequentialEditAuthority(fixture.read()), before));
}

{
  const fixture = createFixture(completeRecords('/AUTH/PARTIAL'), '/AUTH/PARTIAL', null, ({ candidate, state }) => {
    state.branchRegistry.replace(state.branchRegistry.ids(), candidate.branchEntries);
    throw Object.assign(new Error('Failure after branch publication.'), { code: 'PARTIAL_WRITE' });
  });
  const acceptance = fixture.service().accept(prepareAdvance(fixture));
  assert.equal(acceptance.accepted, false);
  assert.equal(acceptance.reasonCode, 'PARTIAL_WRITE');
  assert.equal(acceptance.publicationState, 'PARTIAL_PUBLICATION');
  assert.equal(acceptance.containmentRequired, true);
}

for (const commandType of ['CONNECT_CANDIDATE', 'MANUAL_CONNECT', 'REJECT_CANDIDATE']) {
  const branchId = `/AUTH/${commandType}`;
  const records = completeRecords(branchId);
  const left = createFixture(records, branchId, candidateSession(branchId));
  const right = createFixture(records, branchId, candidateSession(branchId));
  const command = candidateCommand(commandType, branchId);
  const leftPrepared = left.service().prepare({
    command, origin: { kind: 'USER', actorId: 'AUTHORITY_TEST', issuedAt: ISSUED_AT },
  });
  const rightPrepared = right.service().prepare({
    command, origin: { kind: 'USER', actorId: 'AUTHORITY_TEST', issuedAt: ISSUED_AT },
  });
  assert(sameSequentialContractValue(leftPrepared, rightPrepared), `${commandType} preparation must be deterministic`);
  assert.equal(leftPrepared.targets.decisionId, 'DECISION-00001');
  assert.equal(leftPrepared.targets.candidateId, 'CANDIDATE-AUTH-001');
  assert.equal(leftPrepared.candidate.session.transactionLedger.at(-1).createdAt, ISSUED_AT);
  assert.equal(leftPrepared.candidate.session.decisionLedger.at(-1).resolution.confirmedAt, ISSUED_AT);
  if (commandType === 'MANUAL_CONNECT') {
    assert.equal(leftPrepared.targets.fromPortId, `${branchId}/P1:LPOS`);
    assert.equal(leftPrepared.targets.toPortId, `${branchId}/C1:APOS`);
    assert.equal(leftPrepared.candidate.session.decisionLedger.at(-1).resolution.action, 'MANUAL_CONNECT');
    assert.equal(leftPrepared.candidate.session.decisionLedger.at(-1).resolution.selectedFromPortId, `${branchId}/P1:LPOS`);
    assert.equal(leftPrepared.candidate.session.decisionLedger.at(-1).resolution.selectedToPortId, `${branchId}/C1:APOS`);
    assert.match(leftPrepared.candidate.outcome, /USER_MANUAL/);
  }
  const acceptance = left.service().accept(leftPrepared);
  assert.equal(acceptance.accepted, true, `${commandType} must publish through accepted-command authority`);
  assert.equal(left.publications(), 1);
  assert.equal(left.read().journalState.journal.entries.at(-1).commandType, commandType);
  if (commandType === 'REJECT_CANDIDATE') {
    assert.equal(leftPrepared.candidate.outcome, 'CANDIDATE_REJECTED');
    assert.equal(leftPrepared.candidate.session.currentDecisionRequest.candidates.length, 0);
  }
}

{
  const branchId = '/AUTH/MANUAL-PORT-MISMATCH';
  const fixture = createFixture(completeRecords(branchId), branchId, candidateSession(branchId));
  const command = candidateCommand('MANUAL_CONNECT', branchId);
  assert.throws(() => fixture.service().prepare({
    command: { ...command, fromPortId: command.toPortId, toPortId: command.fromPortId },
    origin: { kind: 'USER', actorId: 'AUTHORITY_TEST', issuedAt: ISSUED_AT },
  }), (error) => error.code === SEQUENTIAL_COMMAND_REJECTION.CURRENT_PORT_MISMATCH);
}

for (const commandType of ['MARK_TERMINAL', 'MARK_EXTERNAL_BOUNDARY']) {
  const branchId = `/AUTH/${commandType}`;
  const records = blockedRecords(branchId);
  const evidence = buildSequentialEvidenceModel(records);
  const indexes = indexSequentialEvidence(evidence);
  const blocked = runConstructionUntilBlocked(
    createSequentialConstructionSession(branchId), evidence, indexes, { commandIssuedAt: ADOPTED_AT },
  ).session;
  const left = createFixture(records, branchId, blocked);
  const right = createFixture(records, branchId, blocked);
  const command = boundaryCommand(commandType, branchId, blocked.currentDecisionRequest.decisionId);
  const leftPrepared = left.service().prepare({
    command, origin: { kind: 'USER', actorId: 'AUTHORITY_TEST', issuedAt: ISSUED_AT },
  });
  const rightPrepared = right.service().prepare({
    command, origin: { kind: 'USER', actorId: 'AUTHORITY_TEST', issuedAt: ISSUED_AT },
  });
  assert(sameSequentialContractValue(leftPrepared, rightPrepared), `${commandType} preparation must be deterministic`);
  assert.equal(leftPrepared.targets.decisionId, blocked.currentDecisionRequest.decisionId);
  assert.equal(leftPrepared.targets.candidateId, null);
  assert.equal(leftPrepared.candidate.outcome, 'HEAD_BOUNDARY_USER_CLASSIFIED');
  assert.equal(leftPrepared.candidate.session.transactionLedger.at(-1).createdAt, ISSUED_AT);
  assert.equal(leftPrepared.candidate.session.decisionLedger.at(-1).resolution.confirmedAt, ISSUED_AT);
  const acceptance = left.service().accept(leftPrepared);
  assert.equal(acceptance.accepted, true);
  assert.equal(left.publications(), 1);
}

{
  const branchId = '/AUTH/CANDIDATE-STALE';
  const fixture = createFixture(completeRecords(branchId), branchId, candidateSession(branchId));
  const service = fixture.service();
  const prepared = service.prepare({
    command: candidateCommand('MANUAL_CONNECT', branchId),
    origin: { kind: 'USER', actorId: 'AUTHORITY_TEST', issuedAt: ISSUED_AT },
  });
  fixture.set({ session: freezeConstructionSession({
    ...fixture.read().session,
    currentDecisionRequest: Object.freeze({
      ...fixture.read().session.currentDecisionRequest, candidates: Object.freeze([]),
    }),
  }) });
  const acceptance = service.accept(prepared);
  assert.equal(acceptance.accepted, false);
  assert.equal(acceptance.reasonCode, SEQUENTIAL_COMMAND_REJECTION.PREPARED_COMMAND_STALE);
  assert.equal(fixture.publications(), 0);
}

{
  const fixture = createFixture(completeRecords('/AUTH/CLOCK-BLOCK'), '/AUTH/CLOCK-BLOCK');
  assert.throws(() => fixture.service().prepare({
    command: { commandType: 'REVERSE_COMPONENT', branchId: '/AUTH/CLOCK-BLOCK' },
    origin: { kind: 'USER', actorId: 'AUTHORITY_TEST', issuedAt: ISSUED_AT },
  }), (error) => error.code === SEQUENTIAL_COMMAND_REJECTION.COMMAND_RUNTIME_NOT_DETERMINISTIC);
}

{
  const fixture = createFixture(completeRecords('/AUTH/JOURNAL'), '/AUTH/JOURNAL');
  assert.deepEqual(validateSequentialCommandJournalState(fixture.read().journalState), []);
  assert.match(sequentialSemanticFingerprint('TEST', { b: 2, a: 1 }), /^fnv1a32-canonical-json-v1:TEST:[0-9a-f]{8}$/);
  const corrupt = structuredClone(fixture.read().journalState);
  corrupt.adoptionCheckpoint.checkpointId = 'SADOPT-CORRUPTED';
  assert.match(validateSequentialCommandJournalState(corrupt).join('; '), /checkpoint fingerprint|journal identity/);
}

const modules = [
  'tabs/sequential-sketcher/scoped-edit/sequential-command-contracts.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-command-targets.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-command-journal.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-edit-authority.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-command-preparation.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-command-acceptance.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-command-service.js',
];
for (const relative of modules) {
  const source = readFileSync(fileURLToPath(new URL(`../${relative}`, import.meta.url)), 'utf8');
  assert(source.split(/\r?\n/).length <= 300, `${relative} must remain under 300 lines`);
  assert.doesNotMatch(source, /export\s+default/);
}
console.log('Sequential SSK-TS-3E command authority foundation tests passed');
