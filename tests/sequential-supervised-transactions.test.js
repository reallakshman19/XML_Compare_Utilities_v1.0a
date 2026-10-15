import assert from 'node:assert/strict';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  applyConstructionDecision,
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { DECISION_ACTIONS } from '../tabs/sequential-sketcher/construction/sequential-construction-contract.js';
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
  const root = '/TXN/ATOMIC';
  const records = [branch(root, { HPOS: { x: 0, y: 0, z: 0 } }, [
    pipe('P1', { x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }),
    { type: 'CAP', name: 'C1', attributes: { APOS: { x: 100, y: 0, z: 0 } } },
  ])];
  const { evidence, indexes, session } = setup(records, root);
  const completed = runConstructionUntilBlocked(session, evidence, indexes, {});
  assert.equal(completed.session.state, 'ROUTE_COMPLETE');
  assert.equal(completed.session.transactionLedger.length, 1);
  assert.equal(completed.session.transactionLedger[0].action, 'RUN_UNTIL_BLOCKED');
  assert.equal(completed.session.undoStack.length, 1);
  const undone = applyConstructionDecision(
    completed.session, evidence, indexes, DECISION_ACTIONS.UNDO_LAST_TRANSACTION,
    { reason: 'Review complete route from source state' }, {},
  );
  assert.equal(undone.outcome, 'TRANSACTION_UNDONE');
  assert.equal(undone.session.state, 'NOT_STARTED');
  assert.equal(undone.session.confirmedComponentIds.length, 0);
  assert.equal(undone.session.committedConnections.length, 0);
  assert.equal(undone.session.strokeLedger.length, 0);
  assert.equal(undone.session.undoStack.length, 0);
  assert.equal(undone.session.redoStack.length, 1);
  assert.equal(undone.session.transactionLedger.at(-1).undoneTransactionId, completed.session.transactionLedger[0].transactionId);
}

{
  const root = '/TXN/DEFER';
  const records = [branch(root, { HPOS: { x: 0, y: 0, z: 0 } }, [
    pipe('P1', { x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }),
    pipe('P2', { x: 110, y: 0, z: 0 }, { x: 200, y: 0, z: 0 }),
    pipe('P3', { x: 110, y: 1, z: 0 }, { x: 200, y: 1, z: 0 }),
  ])];
  const { evidence, indexes, session } = setup(records, root);
  const blocked = runConstructionUntilBlocked(session, evidence, indexes, {});
  assert.equal(blocked.session.state, 'USER_DECISION_REQUIRED');
  const openFingerprint = sequentialSessionFingerprint(blocked.session);
  const deferred = applyConstructionDecision(
    blocked.session, evidence, indexes, DECISION_ACTIONS.DEFER_DECISION,
    { reason: 'Await field confirmation', evidenceNote: 'Candidate elevations require survey review.' }, {},
  );
  assert.equal(deferred.outcome, 'DECISION_DEFERRED');
  assert.equal(deferred.session.currentDecisionRequest.state, 'DEFERRED');
  assert.ok(deferred.session.deferredDecisionIds.includes(deferred.session.currentDecisionRequest.decisionId));
  assert.notEqual(sequentialSessionFingerprint(deferred.session), openFingerprint);
  const blockedMutation = applyConstructionDecision(
    deferred.session, evidence, indexes, DECISION_ACTIONS.MARK_TERMINAL,
    { reason: 'Should remain blocked' }, {},
  );
  assert.equal(blockedMutation.outcome, 'DECISION_DEFERRED');
  assert.strictEqual(blockedMutation.session, deferred.session);
  const resumed = applyConstructionDecision(
    deferred.session, evidence, indexes, DECISION_ACTIONS.RESUME_DECISION, {}, {},
  );
  assert.equal(resumed.outcome, 'DECISION_RESUMED');
  assert.equal(resumed.session.currentDecisionRequest.state, 'OPEN');
  assert.equal(resumed.session.deferredDecisionIds.length, 0);
  const undoResume = applyConstructionDecision(
    resumed.session, evidence, indexes, DECISION_ACTIONS.UNDO_LAST_TRANSACTION, {}, {},
  );
  assert.equal(undoResume.session.currentDecisionRequest.state, 'DEFERRED');
}

console.log('sequential supervised transaction tests passed');
