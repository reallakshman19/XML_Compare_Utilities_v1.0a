import assert from 'node:assert/strict';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  advanceConstruction,
  applyConstructionDecision,
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { createConfirmedSequentialConstruction } from '../tabs/sequential-sketcher/construction/sequential-construction-acceptance.js';

function setup(records, branchId) {
  const evidence = buildSequentialEvidenceModel(records);
  return { evidence, indexes: indexSequentialEvidence(evidence), session: createSequentialConstructionSession(branchId) };
}

{
  const root = '/REF/AMBIGUOUS';
  const records = [
    { type: 'BRANCH', name: '/REF/HOST-A', attributes: { NAME: '/REF/HOST-A' }, children: [
      { type: 'OLET', name: 'OA', attributes: { NAME: 'OA', REF: '=DUP/REF', POS: { x: 0, y: 0, z: 0 } } },
    ] },
    { type: 'BRANCH', name: '/REF/HOST-B', attributes: { NAME: '/REF/HOST-B' }, children: [
      { type: 'OLET', name: 'OB', attributes: { NAME: 'OB', REF: '=DUP/REF', POS: { x: 0, y: 100, z: 0 } } },
    ] },
    { type: 'BRANCH', name: root, attributes: { NAME: root, HPOS: { x: 0, y: 20, z: 0 }, HREF: '=DUP/REF' }, children: [
      { type: 'PIPE', name: 'P1', attributes: { APOS: { x: 0, y: 20, z: 0 }, LPOS: { x: 100, y: 20, z: 0 } } },
      { type: 'CAP', name: 'C1', attributes: { APOS: { x: 100, y: 20, z: 0 } } },
    ] },
  ];
  const { evidence, indexes, session } = setup(records, root);
  const result = advanceConstruction(session, evidence, indexes, {});
  assert.equal(result.session.state, 'USER_DECISION_REQUIRED');
  assert.equal(result.session.currentDecisionRequest.reason, 'REFERENCE_TARGET_AMBIGUOUS');
  assert.equal(result.session.currentDecisionRequest.decisionScope, 'HEAD_BOUNDARY');
  assert.equal(result.session.confirmedComponentIds.length, 0, 'ambiguous HREF must block before drawing');
  assert.equal(result.session.committedConnections.length, 0);
  assert.equal(result.session.currentDecisionRequest.candidates.length, 2);
}

{
  const root = '/REF/MISSING-TAIL';
  const records = [{ type: 'BRANCH', name: root, attributes: { NAME: root, HPOS: { x: 0, y: 0, z: 0 }, TREF: '=MISSING/TAIL' }, children: [
    { type: 'PIPE', name: 'P1', attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } } },
  ] }];
  const { evidence, indexes, session } = setup(records, root);
  const result = runConstructionUntilBlocked(session, evidence, indexes, {});
  assert.equal(result.session.state, 'USER_DECISION_REQUIRED');
  assert.equal(result.session.currentDecisionRequest.reason, 'REFERENCE_TARGET_MISSING');
  assert.deepEqual(result.session.confirmedComponentIds.map((id) => indexes.components.get(id)?.sourceComponentId), ['P1']);
  assert.throws(() => createConfirmedSequentialConstruction(result.session, indexes), /ROUTE_COMPLETE/);
}

{
  const root = '/TERMINAL/EXPLICIT';
  const records = [{ type: 'BRANCH', name: root, attributes: { NAME: root, HPOS: { x: 0, y: 0, z: 0 } }, children: [
    { type: 'PIPE', name: 'P1', attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } } },
    { type: 'CAP', name: 'C1', attributes: { APOS: { x: 100, y: 0, z: 0 } } },
  ] }];
  const { evidence, indexes, session } = setup(records, root);
  const result = runConstructionUntilBlocked(session, evidence, indexes, {});
  assert.equal(result.session.state, 'ROUTE_COMPLETE');
  assert.equal(result.session.currentDecisionRequest, null);
  assert.ok(result.session.strokeLedger.some((row) => row.op === 'DRAW_CAP'));
  const confirmed = createConfirmedSequentialConstruction(result.session, indexes);
  assert.equal(confirmed.audit.confirmedComponentCount, 2);
}

{
  const root = '/TERMINAL/USER';
  const records = [{ type: 'BRANCH', name: root, attributes: { NAME: root, HPOS: { x: 0, y: 0, z: 0 } }, children: [
    { type: 'PIPE', name: 'P1', attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } } },
  ] }];
  const { evidence, indexes, session } = setup(records, root);
  const blocked = runConstructionUntilBlocked(session, evidence, indexes, {});
  assert.equal(blocked.session.state, 'USER_DECISION_REQUIRED');
  assert.equal(blocked.session.currentDecisionRequest.reason, 'UNEXPLAINED_TERMINAL');
  const accepted = applyConstructionDecision(
    blocked.session,
    evidence,
    indexes,
    'MARK_TERMINAL',
    { reason: 'Field-verified intentional terminal' },
    {},
  );
  assert.equal(accepted.session.state, 'ROUTE_COMPLETE');
  assert.equal(accepted.session.decisionLedger.length, 1);
  assert.equal(accepted.session.decisionLedger[0].resolution.action, 'MARK_TERMINAL');
  const confirmed = createConfirmedSequentialConstruction(accepted.session, indexes);
  assert.equal(confirmed.audit.openDecisionCount, 0);
  assert.equal(confirmed.decisions.length, 1);
}

console.log('sequential reference and terminal semantics tests passed');
