import assert from 'node:assert/strict';
import { stableToken } from '../tabs/sequential-sketcher/sequential-sketcher-contract.js';
import { createSequentialBranchWorkspaceRegistry } from '../tabs/sequential-sketcher/sequential-branch-workspace-state.js';
import { createSequentialConstructionSession } from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { freezeConstructionSession } from '../tabs/sequential-sketcher/construction/sequential-construction-contract.js';
import { sequentialSessionFingerprint } from '../tabs/sequential-sketcher/construction/sequential-session-fingerprint.js';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import { projectSequentialReversalCandidates } from '../tabs/sequential-sketcher/sequential-engineering-svg-reversal-scene.js';
import {
  SEQUENTIAL_COMMAND_REJECTION,
  sameSequentialContractValue,
  sequentialSemanticFingerprint,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-command-contracts.js';
import {
  createSequentialCommandService,
  createSequentialJournalAdoption,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-command-service.js';
import { deriveSequentialEditAuthority } from '../tabs/sequential-sketcher/scoped-edit/sequential-edit-authority.js';

const BRANCH_ID = '/AUTH/REVERSE-COMPONENT';
const DECISION_ID = 'DECISION-REVERSE-0001';
const ADOPTED_AT = '2026-07-28T04:10:00.000Z';
const ISSUED_AT = '2026-07-28T04:11:00.000Z';

function records() {
  return [{
    type: 'BRANCH', name: BRANCH_ID,
    attributes: { NAME: BRANCH_ID, HPOS: { x: 0, y: 0, z: 0 } },
    children: [{
      type: 'PIPE', name: 'P1',
      attributes: { NAME: 'P1', APOS: { x: -100, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } },
    }],
  }];
}
function ownerRevision(label) {
  return Object.freeze({
    revision: Object.freeze({ schema: 'EngineeringRevisionToken.v1', token: label }),
  });
}
function reversalSession(indexes) {
  const component = [...indexes.components.values()][0];
  return freezeConstructionSession({
    ...createSequentialConstructionSession(BRANCH_ID),
    state: 'USER_DECISION_REQUIRED',
    currentDecisionRequest: Object.freeze({
      schema: 'SequentialConnectionDecision.v1',
      decisionId: DECISION_ID,
      state: 'OPEN',
      reason: 'AMBIGUOUS_BRANCH_START',
      candidates: Object.freeze([]),
      resolution: null,
      branchId: BRANCH_ID,
      decisionScope: 'COMPONENT_TRAVERSAL',
      componentId: component.componentId,
      startComponentId: component.componentId,
      entryPortId: null,
    }),
  });
}
function sourceFingerprint(source) {
  return `TEST-SOURCE-${stableToken(JSON.stringify(source))}`;
}
function fixture() {
  const source = records();
  const evidence = buildSequentialEvidenceModel(source);
  const indexes = indexSequentialEvidence(evidence);
  const session = reversalSession(indexes);
  const branchRegistry = createSequentialBranchWorkspaceRegistry();
  branchRegistry.reset([BRANCH_ID]);
  branchRegistry.save(BRANCH_ID, { session });
  const fingerprint = sourceFingerprint(source);
  const journalState = createSequentialJournalAdoption({
    documentId: `sequential-document:${fingerprint}`,
    sessionId: `sequential-session:${fingerprint}`,
    sourceFingerprint: fingerprint,
    branchRegistry,
    adoptedAt: ADOPTED_AT,
  });
  let state = {
    sourceFingerprint: fingerprint,
    evidence,
    indexes,
    session,
    branchRegistry,
    journalState,
    confirmedConstruction: null,
    supportProjection: null,
    ownerSnapshot: ownerRevision('REV-REVERSE-0'),
    engineOptions: {},
  };
  let publications = 0;
  function publish({ candidate, expectedAuthority, preparedId }) {
    assert(sameSequentialContractValue(deriveSequentialEditAuthority(state), expectedAuthority));
    branchRegistry.replace(branchRegistry.ids(), candidate.branchEntries);
    state = {
      ...state,
      session: candidate.session,
      confirmedConstruction: candidate.confirmedConstruction,
      supportProjection: candidate.supportProjection,
      journalState: candidate.journalState,
      ownerSnapshot: ownerRevision(sequentialSemanticFingerprint('REVERSALREV', {
        preparedId,
        session: sequentialSessionFingerprint(candidate.session),
        nextSequence: candidate.journalState.journal.nextSequence,
      })),
    };
    publications += 1;
    return Object.freeze({
      schema: 'SequentialCommandPublication.v1',
      committed: true,
      preparedId,
      expectedAuthorityId: expectedAuthority.authorityId,
    });
  }
  return {
    read: () => state,
    set: (patch) => { state = { ...state, ...patch }; },
    service: () => createSequentialCommandService({
      readCurrentState: () => state,
      publishCandidate: publish,
    }),
    publications: () => publications,
  };
}
function command(state, candidate, patch = {}) {
  return {
    commandType: 'REVERSE_COMPONENT',
    branchId: BRANCH_ID,
    decisionId: DECISION_ID,
    candidateId: candidate.candidateId,
    componentId: candidate.componentId,
    entryPortId: candidate.entryPortId,
    payload: {
      reason: 'Reviewed and approved the exact alternate component entry.',
      evidenceNote: 'Certified reversal scene evidence and current indexed entry port were verified.',
      targetEntityId: `ssk:reversal:${candidate.candidateId}`,
      reversalTargetId: 'SSK3DREVERSAL-QUALIFICATION',
    },
    ...patch,
  };
}
function prepare(test, candidate, patch = {}) {
  return test.service().prepare({
    command: command(test.read(), candidate, patch),
    origin: { kind: 'USER', actorId: 'REVERSAL_AUTHORITY_TEST', issuedAt: ISSUED_AT },
  });
}

const left = fixture();
const right = fixture();
const candidate = projectSequentialReversalCandidates(left.read().session, left.read().indexes)[0];
const rightCandidate = projectSequentialReversalCandidates(right.read().session, right.read().indexes)[0];
const leftPrepared = prepare(left, candidate);
const rightPrepared = prepare(right, rightCandidate);
assert(sameSequentialContractValue(leftPrepared, rightPrepared),
  'exact reversal preparation must be byte-semantically deterministic');
assert.equal(leftPrepared.nativeCommand.commandType, 'REVERSE_COMPONENT');
assert.equal(leftPrepared.targets.decisionId, DECISION_ID);
assert.equal(leftPrepared.targets.candidateId, candidate.candidateId);
assert.equal(leftPrepared.targets.componentId, candidate.componentId);
assert.equal(leftPrepared.targets.entryPortId, candidate.entryPortId);
assert.equal(leftPrepared.candidate.outcome, 'COMPONENT_TRAVERSAL_REVERSED');
assert.equal(leftPrepared.candidate.transactionIds.length, 1);
assert.equal(leftPrepared.envelope.transactionId, leftPrepared.candidate.transactionIds[0]);
assert.equal(leftPrepared.candidate.session.transactionLedger.at(-1).createdAt, ISSUED_AT);
assert.equal(leftPrepared.candidate.session.transactionLedger.at(-1).action, 'REVERSE_COMPONENT');
assert.equal(leftPrepared.candidate.session.decisionLedger.at(-1).resolution.action, 'REVERSE_COMPONENT');
assert.equal(leftPrepared.candidate.session.decisionLedger.at(-1).resolution.confirmedAt, ISSUED_AT);
assert.equal(leftPrepared.candidate.session.componentTraversalOverrides.at(-1).entryPortId, candidate.entryPortId);
assert.equal(leftPrepared.candidate.session.componentTraversalOverrides.at(-1).confirmedAt, ISSUED_AT);
assert(leftPrepared.candidate.session.confirmedComponentIds.includes(candidate.componentId));
assert.equal(leftPrepared.candidate.journalState.journal.entries.at(-1).commandType, 'REVERSE_COMPONENT');
assert.equal(leftPrepared.candidate.journalState.journal.entries.at(-1).transactionId,
  leftPrepared.envelope.transactionId);

const acceptance = left.service().accept(leftPrepared);
assert.equal(acceptance.accepted, true);
assert.equal(acceptance.publicationState, 'COMMITTED');
assert.equal(left.publications(), 1);
assert.equal(left.read().journalState.journal.entries.at(-1).commandType, 'REVERSE_COMPONENT');

for (const patch of [
  { candidateId: 'REVERSE-WRONG' },
  { componentId: `${candidate.componentId}-WRONG` },
  { entryPortId: `${candidate.entryPortId}-WRONG` },
]) {
  const test = fixture();
  const exact = projectSequentialReversalCandidates(test.read().session, test.read().indexes)[0];
  assert.throws(() => prepare(test, exact, patch), (error) => [
    SEQUENTIAL_COMMAND_REJECTION.CURRENT_CANDIDATE_MISMATCH,
    SEQUENTIAL_COMMAND_REJECTION.CURRENT_COMPONENT_MISMATCH,
    SEQUENTIAL_COMMAND_REJECTION.CURRENT_PORT_MISMATCH,
  ].includes(error.code));
  assert.equal(test.publications(), 0);
}

{
  const test = fixture();
  const exact = projectSequentialReversalCandidates(test.read().session, test.read().indexes)[0];
  const prepared = prepare(test, exact);
  test.set({ ownerSnapshot: ownerRevision('REV-REVERSE-STALE') });
  const rejected = test.service().accept(prepared);
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.reasonCode, SEQUENTIAL_COMMAND_REJECTION.PREPARED_COMMAND_STALE);
  assert.equal(test.publications(), 0);
}

console.log('Sequential SSK-TS-3G reversal command authority: ok');
