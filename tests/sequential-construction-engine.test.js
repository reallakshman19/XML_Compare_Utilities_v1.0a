import assert from 'node:assert/strict';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  advanceConstruction,
  applyConstructionDecision,
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-engine.js';

function setup(records, branchId) {
  const evidence = buildSequentialEvidenceModel(records);
  return { evidence, indexes: indexSequentialEvidence(evidence), session: createSequentialConstructionSession(branchId) };
}

{
  const branchId = '/AUTO/B1';
  const records = [{ type: 'BRANCH', name: branchId, attributes: { NAME: branchId, HPOS: { x: 0, y: 0, z: 0 } }, children: [
    { type: 'PIPE', name: 'P1', attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } } },
    { type: 'ELBO', name: 'E1', attributes: { APOS: { x: 112, y: 0, z: 0 }, LPOS: { x: 112, y: 100, z: 0 }, POS: { x: 100, y: 0, z: 0 } } },
    { type: 'CAP', name: 'C1', attributes: { APOS: { x: 112, y: 100, z: 0 } } },
  ] }];
  const { evidence, indexes, session } = setup(records, branchId);
  const result = runConstructionUntilBlocked(session, evidence, indexes, { exactToleranceMm: 1, autoRepairToleranceMm: 25 });
  assert.equal(result.session.state, 'ROUTE_COMPLETE');
  assert.equal(result.session.repairLedger.length, 1);
  assert.equal(result.session.repairLedger[0].gapMm, 12);
  assert.ok(result.session.strokeLedger.some((row) => row.op === 'DRAW_VIRTUAL_REPAIR'));
  assert.ok(result.session.strokeLedger.some((row) => row.op === 'DRAW_ELBOW'));
}

{
  const branchId = '/AMB/B1';
  const records = [{ type: 'BRANCH', name: branchId, attributes: { NAME: branchId, HPOS: { x: 0, y: 0, z: 0 } }, children: [
    { type: 'PIPE', name: 'P1', attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } } },
    { type: 'PIPE', name: 'P2', attributes: { APOS: { x: 110, y: 0, z: 0 }, LPOS: { x: 200, y: 0, z: 0 } } },
    { type: 'PIPE', name: 'P3', attributes: { APOS: { x: 110, y: 1, z: 0 }, LPOS: { x: 200, y: 1, z: 0 } } },
  ] }];
  const { evidence, indexes, session } = setup(records, branchId);
  const result = runConstructionUntilBlocked(session, evidence, indexes, {});
  assert.equal(result.session.state, 'USER_DECISION_REQUIRED');
  assert.equal(result.session.confirmedComponentIds.length, 1, 'no downstream component may be drawn beyond ambiguity');
  assert.ok(result.session.currentDecisionRequest.candidates.length >= 2);
  const replay = advanceConstruction(result.session, evidence, indexes, {});
  assert.strictEqual(replay.session, result.session, 'advance while blocked must not mutate or replace the session');
}

{
  const branchId = '/BROKEN/B1';
  const records = [{ type: 'BRANCH', name: branchId, attributes: { NAME: branchId, HPOS: { x: 0, y: 0, z: 0 } }, children: [
    { type: 'PIPE', name: 'P1', attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } } },
    { type: 'PIPE', name: 'P2', attributes: { APOS: { x: 500, y: 0, z: 0 }, LPOS: { x: 600, y: 0, z: 0 } } },
  ] }];
  const { evidence, indexes, session } = setup(records, branchId);
  const result = runConstructionUntilBlocked(session, evidence, indexes, {});
  assert.equal(result.session.state, 'USER_DECISION_REQUIRED');
  assert.equal(result.session.confirmedComponentIds.length, 1);
  assert.equal(result.session.strokeLedger.filter((row) => row.op === 'DRAW_PIPE').length, 1, 'disconnected fragment must not be rendered');
}

{
  const main = '/TEE/MAIN'; const side = '/TEE/SIDE';
  const records = [
    { type: 'BRANCH', name: main, attributes: { NAME: main, HPOS: { x: 0, y: 0, z: 0 } }, children: [
      { type: 'PIPE', name: 'M-P1', attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } } },
      { type: 'TEE', name: 'M-T1', attributes: { APOS: { x: 100, y: 0, z: 0 }, POS: { x: 120, y: 0, z: 0 }, LPOS: { x: 140, y: 0, z: 0 }, BPOS: { x: 120, y: 20, z: 0 }, CREF: side } },
      { type: 'CAP', name: 'M-C1', attributes: { APOS: { x: 140, y: 0, z: 0 } } },
    ] },
    { type: 'BRANCH', name: side, attributes: { NAME: side, HPOS: { x: 120, y: 20, z: 0 } }, children: [
      { type: 'PIPE', name: 'S-P1', attributes: { APOS: { x: 120, y: 20, z: 0 }, LPOS: { x: 120, y: 100, z: 0 } } },
      { type: 'CAP', name: 'S-C1', attributes: { APOS: { x: 120, y: 100, z: 0 } } },
    ] },
  ];
  const { evidence, indexes, session } = setup(records, main);
  const result = runConstructionUntilBlocked(session, evidence, indexes, {});
  assert.equal(result.session.state, 'ROUTE_COMPLETE');
  const operations = result.session.strokeLedger.map((row) => row.op);
  assert.ok(operations.includes('DRAW_TEE_RUN'));
  assert.ok(operations.includes('REGISTER_TEE_BRANCH'));
  assert.ok(operations.includes('RETURN_TO_JUNCTION'));
  assert.ok(operations.includes('ENTER_BRANCH'));
  assert.ok(operations.indexOf('RETURN_TO_JUNCTION') > operations.indexOf('DRAW_CAP'), 'side branch must start only after the main branch terminal');
}

{
  const branchId = '/REDU/B1';
  const records = [{ type: 'BRANCH', name: branchId, attributes: { NAME: branchId, HPOS: { x: 0, y: 0, z: 0 } }, children: [
    { type: 'REDU', name: 'R1', attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 }, LARGE_BORE: 168.3, SMALL_BORE: 114.3 } },
    { type: 'CAP', name: 'C1', attributes: { APOS: { x: 100, y: 0, z: 0 } } },
  ] }];
  const { evidence, indexes, session } = setup(records, branchId);
  const result = runConstructionUntilBlocked(session, evidence, indexes, {});
  const reducer = result.session.strokeLedger.find((row) => row.op === 'DRAW_REDUCER');
  assert.equal(reducer.inletBoreMm, 168.3);
  assert.equal(reducer.outletBoreMm, 114.3);
}

{
  const first = '/TREF/FIRST'; const second = '/TREF/SECOND';
  const records = [
    { type: 'BRANCH', name: first, attributes: { NAME: first, HPOS: { x: 0, y: 0, z: 0 }, TREF: second }, children: [
      { type: 'PIPE', name: 'F-P1', attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } } },
    ] },
    { type: 'BRANCH', name: second, attributes: { NAME: second, HPOS: { x: 140, y: 0, z: 0 } }, children: [
      { type: 'PIPE', name: 'S-P1', attributes: { APOS: { x: 140, y: 0, z: 0 }, LPOS: { x: 220, y: 0, z: 0 } } },
      { type: 'CAP', name: 'S-C1', attributes: { APOS: { x: 220, y: 0, z: 0 } } },
    ] },
  ];
  const { evidence, indexes, session } = setup(records, first);
  const blocked = runConstructionUntilBlocked(session, evidence, indexes, { autoRepairToleranceMm: 25, candidateSearchRadiusMm: 250 });
  assert.equal(blocked.session.state, 'USER_DECISION_REQUIRED');
  assert.equal(blocked.session.confirmedComponentIds.length, 1);
  const candidate = blocked.session.currentDecisionRequest.candidates.find((row) => row.targetBranchId === second);
  assert.ok(candidate, 'referenced branch candidate must be presented');
  assert.equal(candidate.gapMm, 40);
  const approved = applyConstructionDecision(
    blocked.session,
    evidence,
    indexes,
    'CONNECT',
    { candidateId: candidate.candidateId, reason: 'Approved referenced continuation' },
    { exactToleranceMm: 1, autoRepairToleranceMm: 25 },
  );
  assert.equal(approved.outcome, 'USER_CONNECTION_COMMITTED');
  assert.equal(approved.session.repairLedger.length, 1, 'approved long gap remains an auditable virtual connector');
  const completed = runConstructionUntilBlocked(approved.session, evidence, indexes, {});
  assert.equal(completed.session.state, 'ROUTE_COMPLETE');
}

{
  const main = '/TEE/UNRESOLVED';
  const records = [{ type: 'BRANCH', name: main, attributes: { NAME: main, HPOS: { x: 0, y: 0, z: 0 } }, children: [
    { type: 'PIPE', name: 'P1', attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } } },
    { type: 'TEE', name: 'T1', attributes: { APOS: { x: 100, y: 0, z: 0 }, POS: { x: 120, y: 0, z: 0 }, LPOS: { x: 140, y: 0, z: 0 }, BPOS: { x: 120, y: 20, z: 0 } } },
    { type: 'CAP', name: 'C1', attributes: { APOS: { x: 140, y: 0, z: 0 } } },
  ] }];
  const { evidence, indexes, session } = setup(records, main);
  const blocked = runConstructionUntilBlocked(session, evidence, indexes, {});
  assert.equal(blocked.session.state, 'USER_DECISION_REQUIRED');
  assert.equal(blocked.session.currentDecisionRequest.reason, 'UNRESOLVED_PENDING_BRANCH');
  assert.ok(blocked.session.strokeLedger.some((row) => row.op === 'RETURN_TO_JUNCTION'));
  const terminal = applyConstructionDecision(blocked.session, evidence, indexes, 'MARK_TERMINAL', { reason: 'Branch outlet intentionally unused' }, {});
  assert.equal(terminal.session.state, 'ROUTE_COMPLETE');
}

console.log('sequential construction engine tests passed');
