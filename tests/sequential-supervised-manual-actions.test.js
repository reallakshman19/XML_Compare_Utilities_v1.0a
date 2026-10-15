import assert from 'node:assert/strict';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  advanceConstruction,
  applyConstructionDecision,
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { DECISION_ACTIONS } from '../tabs/sequential-sketcher/construction/sequential-construction-contract.js';
import { buildSequentialReversalCandidates } from '../tabs/sequential-sketcher/construction/sequential-supervised-decision-actions.js';

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
function candidatePorts(candidate) {
  return {
    fromPortId: candidate.fromPortId || candidate.targetPortId,
    toPortId: candidate.toPortId || candidate.connectedPortId,
  };
}

{
  const first = '/TXN/MANUAL/FIRST';
  const second = '/TXN/MANUAL/SECOND';
  const records = [
    branch(first, { HPOS: { x: 0, y: 0, z: 0 }, TREF: second }, [
      pipe('F-P1', { x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }),
    ]),
    branch(second, { HPOS: { x: 140, y: 0, z: 0 } }, [
      pipe('S-P1', { x: 140, y: 0, z: 0 }, { x: 220, y: 0, z: 0 }),
      { type: 'CAP', name: 'S-C1', attributes: { APOS: { x: 220, y: 0, z: 0 } } },
    ]),
  ];
  const { evidence, indexes, session } = setup(records, first);
  const blocked = runConstructionUntilBlocked(session, evidence, indexes, { candidateSearchRadiusMm: 250 });
  const candidate = blocked.session.currentDecisionRequest.candidates.find((row) => row.targetBranchId === second);
  assert.ok(candidate);
  const ports = candidatePorts(candidate);
  const missingEvidence = applyConstructionDecision(
    blocked.session, evidence, indexes, DECISION_ACTIONS.MANUAL_CONNECT,
    { candidateId: candidate.candidateId, ...ports, reason: 'Approved manually' }, {},
  );
  assert.equal(missingEvidence.outcome, 'MANUAL_EVIDENCE_REQUIRED');
  assert.strictEqual(missingEvidence.session, blocked.session);
  const manual = applyConstructionDecision(
    blocked.session, evidence, indexes, DECISION_ACTIONS.MANUAL_CONNECT,
    {
      candidateId: candidate.candidateId,
      ...ports,
      reason: 'Approved referenced continuation after engineering review',
      evidenceNote: 'Continuation confirmed against approved isometric ISO-TXN-001.',
    },
    { exactToleranceMm: 1, autoRepairToleranceMm: 25 },
  );
  assert.equal(manual.outcome, 'USER_MANUAL_CONNECTION_COMMITTED');
  const connection = manual.session.committedConnections.at(-1);
  assert.equal(connection.approvalProvenance, 'USER_MANUAL');
  assert.equal(connection.approvalEvidenceNote, 'Continuation confirmed against approved isometric ISO-TXN-001.');
  const decision = manual.session.decisionLedger.at(-1);
  assert.equal(decision.resolution.action, DECISION_ACTIONS.MANUAL_CONNECT);
  assert.equal(decision.resolution.selectedFromPortId, ports.fromPortId);
  assert.equal(decision.resolution.selectedToPortId, ports.toPortId);
  const transaction = manual.session.transactionLedger.at(-1);
  assert.equal(transaction.action, DECISION_ACTIONS.MANUAL_CONNECT);
  assert.ok(transaction.affected.portIds.includes(ports.fromPortId));
  assert.ok(transaction.affected.portIds.includes(ports.toPortId));
  assert.ok(transaction.externalBoundaryPolicyFingerprint);
  assert.ok(transaction.tolerancePolicyFingerprint);
  const undone = applyConstructionDecision(
    manual.session, evidence, indexes, DECISION_ACTIONS.UNDO_LAST_TRANSACTION, {}, {},
  );
  assert.equal(undone.session.state, 'USER_DECISION_REQUIRED');
  assert.equal(undone.session.committedConnections.length, blocked.session.committedConnections.length);
  assert.equal(undone.session.currentDecisionRequest.decisionId, blocked.session.currentDecisionRequest.decisionId);
}

{
  const root = '/TXN/REVERSE';
  const records = [branch(root, { HPOS: { x: 0, y: 0, z: 0 } }, [
    pipe('P1', { x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }),
  ])];
  const { evidence, indexes, session } = setup(records, root);
  const blocked = advanceConstruction(session, evidence, indexes, {});
  assert.equal(blocked.session.currentDecisionRequest.reason, 'AMBIGUOUS_BRANCH_START');
  const candidates = buildSequentialReversalCandidates(blocked.session, indexes);
  assert.equal(candidates.length, 2);
  const selected = candidates[1];
  const reversed = applyConstructionDecision(
    blocked.session, evidence, indexes, DECISION_ACTIONS.REVERSE_COMPONENT,
    {
      candidateId: selected.candidateId,
      componentId: selected.componentId,
      entryPortId: selected.entryPortId,
      reason: 'Reverse component traversal to match upstream flow direction',
      evidenceNote: 'Flow arrow confirmed on approved line list.',
    }, {},
  );
  assert.equal(reversed.outcome, 'COMPONENT_TRAVERSAL_REVERSED');
  assert.equal(reversed.session.activeEntryPortId, selected.entryPortId);
  assert.equal(reversed.session.componentTraversalOverrides.length, 1);
  assert.equal(reversed.session.componentTraversalOverrides[0].provenance, 'USER_MANUAL');
  assert.equal(reversed.session.confirmedComponentIds.length, 1);
  assert.ok(reversed.session.strokeLedger.some((row) => row.op === 'DRAW_PIPE'));
  const undone = applyConstructionDecision(
    reversed.session, evidence, indexes, DECISION_ACTIONS.UNDO_LAST_TRANSACTION, {}, {},
  );
  assert.equal(undone.session.state, 'USER_DECISION_REQUIRED');
  assert.equal(undone.session.currentDecisionRequest.reason, 'AMBIGUOUS_BRANCH_START');
  assert.equal(undone.session.confirmedComponentIds.length, 0);
}

console.log('sequential supervised manual action tests passed');
