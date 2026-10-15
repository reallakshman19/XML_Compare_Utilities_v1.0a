import assert from 'node:assert/strict';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  advanceConstruction,
  applyConstructionDecision,
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import {
  DECISION_ACTIONS,
  freezeConstructionSession,
} from '../tabs/sequential-sketcher/construction/sequential-construction-contract.js';
import { sequentialSessionFingerprint } from '../tabs/sequential-sketcher/construction/sequential-session-fingerprint.js';

function pipe(name, start, end) {
  return { type: 'PIPE', name, attributes: { APOS: start, LPOS: end } };
}
function branch(name, attributes, children) {
  return { type: 'BRANCH', name, attributes: { NAME: name, ...attributes }, children };
}
function setup(records, branchId) {
  const evidence = buildSequentialEvidenceModel(records);
  return { evidence, indexes: indexSequentialEvidence(evidence), session: createSequentialConstructionSession(branchId) };
}

{
  const root = '/REDO/COMPLETE';
  const records = [branch(root, { HPOS: { x: 0, y: 0, z: 0 } }, [
    pipe('P1', { x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }),
    { type: 'CAP', name: 'C1', attributes: { APOS: { x: 100, y: 0, z: 0 } } },
  ])];
  const { evidence, indexes, session } = setup(records, root);
  const completed = runConstructionUntilBlocked(session, evidence, indexes, {});
  assert.equal(completed.session.state, 'ROUTE_COMPLETE');
  const completedFingerprint = sequentialSessionFingerprint(completed.session);
  const originalTransactionId = completed.session.transactionLedger[0].transactionId;

  const undone = applyConstructionDecision(
    completed.session,
    evidence,
    indexes,
    DECISION_ACTIONS.UNDO_LAST_TRANSACTION,
    { reason: 'Review the complete route' },
    {},
  );
  assert.equal(undone.outcome, 'TRANSACTION_UNDONE');
  assert.equal(undone.session.state, 'NOT_STARTED');
  assert.equal(undone.session.redoStack.length, 1);

  const redone = applyConstructionDecision(
    undone.session,
    evidence,
    indexes,
    DECISION_ACTIONS.REDO_LAST_TRANSACTION,
    { reason: 'Restore the reviewed route' },
    {},
  );
  assert.equal(redone.outcome, 'TRANSACTION_REDONE');
  assert.equal(redone.session.state, 'ROUTE_COMPLETE');
  assert.equal(sequentialSessionFingerprint(redone.session), completedFingerprint);
  assert.equal(redone.session.confirmedComponentIds.length, completed.session.confirmedComponentIds.length);
  assert.equal(redone.session.committedConnections.length, completed.session.committedConnections.length);
  assert.equal(redone.session.strokeLedger.length, completed.session.strokeLedger.length);
  assert.equal(redone.session.undoStack.length, 1);
  assert.equal(redone.session.redoStack.length, 0);
  const redoRecord = redone.session.transactionLedger.at(-1);
  assert.equal(redoRecord.action, DECISION_ACTIONS.REDO_LAST_TRANSACTION);
  assert.equal(redoRecord.outcome, 'TRANSACTION_REDONE');
  assert.equal(redoRecord.redoneTransactionId, originalTransactionId);
  assert.equal(redoRecord.beforeFingerprint, undone.session.transactionLedger.at(-1).afterFingerprint);
  assert.equal(redoRecord.afterFingerprint, completedFingerprint);
  assert.ok(redoRecord.externalBoundaryPolicyFingerprint);
  assert.ok(redoRecord.tolerancePolicyFingerprint);

  const undoAgain = applyConstructionDecision(
    redone.session,
    evidence,
    indexes,
    DECISION_ACTIONS.UNDO_LAST_TRANSACTION,
    {},
    {},
  );
  assert.equal(undoAgain.session.state, 'NOT_STARTED');
  assert.equal(undoAgain.session.redoStack.length, 1);

  const divergent = advanceConstruction(undoAgain.session, evidence, indexes, {});
  assert.equal(divergent.session.headBoundaryValidated, true);
  assert.equal(divergent.session.redoStack.length, 0, 'a new supervised action must clear the redo path');
  assert.equal(divergent.session.transactionLedger.at(-1).action, 'ADVANCE_ONE');
  const noRedo = applyConstructionDecision(
    divergent.session,
    evidence,
    indexes,
    DECISION_ACTIONS.REDO_LAST_TRANSACTION,
    {},
    {},
  );
  assert.equal(noRedo.outcome, 'NOTHING_TO_REDO');
  assert.strictEqual(noRedo.session, divergent.session);
}

{
  const root = '/REDO/DEFER';
  const records = [branch(root, {
    HPOS: { x: 0, y: 0, z: 0 },
    TREF: '/REDO/MISSING/TARGET',
  }, [pipe('P1', { x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 })])];
  const { evidence, indexes, session } = setup(records, root);
  const blocked = runConstructionUntilBlocked(session, evidence, indexes, {});
  assert.equal(blocked.session.currentDecisionRequest.reason, 'REFERENCE_TARGET_MISSING');
  const deferred = applyConstructionDecision(
    blocked.session,
    evidence,
    indexes,
    DECISION_ACTIONS.DEFER_DECISION,
    {
      reason: 'Await boundary evidence',
      evidenceNote: 'External scope confirmation is pending.',
    },
    {},
  );
  assert.equal(deferred.session.currentDecisionRequest.state, 'DEFERRED');
  const undone = applyConstructionDecision(
    deferred.session,
    evidence,
    indexes,
    DECISION_ACTIONS.UNDO_LAST_TRANSACTION,
    {},
    {},
  );
  assert.equal(undone.session.currentDecisionRequest.state, 'OPEN');
  const redone = applyConstructionDecision(
    undone.session,
    evidence,
    indexes,
    DECISION_ACTIONS.REDO_LAST_TRANSACTION,
    {},
    {},
  );
  assert.equal(redone.outcome, 'TRANSACTION_REDONE');
  assert.equal(redone.session.currentDecisionRequest.state, 'DEFERRED');
  assert.equal(redone.session.currentDecisionRequest.deferral.reason, 'Await boundary evidence');
  assert.equal(redone.session.deferredDecisionIds.length, 1);
}

{
  const root = '/REDO/MISMATCH';
  const records = [branch(root, { HPOS: { x: 0, y: 0, z: 0 } }, [
    pipe('P1', { x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }),
  ])];
  const { evidence, indexes, session } = setup(records, root);
  const advanced = advanceConstruction(session, evidence, indexes, {});
  assert.equal(advanced.session.headBoundaryValidated, true);
  assert.equal(advanced.session.undoStack.length, 1);
  const undone = applyConstructionDecision(
    advanced.session,
    evidence,
    indexes,
    DECISION_ACTIONS.UNDO_LAST_TRANSACTION,
    {},
    {},
  );
  assert.equal(undone.session.redoStack.length, 1);
  const altered = freezeConstructionSession({
    ...undone.session,
    activeComponentId: 'UNTRACKED-MUTATION',
  });
  const blockedRedo = applyConstructionDecision(
    altered,
    evidence,
    indexes,
    DECISION_ACTIONS.REDO_LAST_TRANSACTION,
    {},
    {},
  );
  assert.equal(blockedRedo.outcome, 'REDO_STATE_MISMATCH');
  assert.strictEqual(blockedRedo.session, altered);
}

console.log('sequential supervised redo tests passed');
