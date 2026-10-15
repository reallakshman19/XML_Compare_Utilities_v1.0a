import assert from 'node:assert/strict';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  advanceConstruction,
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-gated-construction-engine.js';

function setup(records, branchId) {
  const evidence = buildSequentialEvidenceModel(records);
  return { evidence, indexes: indexSequentialEvidence(evidence), session: createSequentialConstructionSession(branchId) };
}

{
  const host = '/HEAD/HOST';
  const branch = '/HEAD/BRANCH';
  const records = [
    { type: 'BRANCH', name: host, attributes: { NAME: host }, children: [
      { type: 'OLET', name: 'OLET =REF/HEAD', attributes: { NAME: '=REF/HEAD', POS: { x: 0, y: 0, z: 0 }, ABORE: '150mm' } },
    ] },
    { type: 'BRANCH', name: branch, attributes: { NAME: branch, HPOS: { x: 0, y: 20, z: 0 }, HREF: '=REF/HEAD' }, children: [
      { type: 'PIPE', name: 'P1', attributes: { APOS: { x: 0, y: 20, z: 0 }, LPOS: { x: 100, y: 20, z: 0 }, LBORE: '20mm' } },
      { type: 'CAP', name: 'C1', attributes: { APOS: { x: 100, y: 20, z: 0 }, LBORE: '20mm' } },
    ] },
  ];
  const { evidence, indexes, session } = setup(records, branch);
  const head = advanceConstruction(session, evidence, indexes, {});
  assert.equal(head.outcome, 'HEAD_BOUNDARY_COMMITTED');
  assert.equal(head.session.state, 'NOT_STARTED');
  assert.equal(head.session.headBoundaryValidated, true);
  assert.equal(head.session.confirmedComponentIds.length, 0, 'head validation must not place the first component');
  assert.equal(head.session.committedConnections.length, 1);
  assert.equal(head.session.committedConnections[0].connectionType, 'HEAD_BOUNDARY_TO_JUNCTION');
  assert.equal(head.session.committedConnections[0].gapMm, 0);
  assert.equal(head.session.committedConnections[0].derivedBranchLegLengthMm, 20);
  assert.equal(head.session.repairLedger.length, 0);
  assert.ok(head.session.strokeLedger.some((row) => row.op === 'CONFIRM_HEAD_JUNCTION_BOUNDARY'));

  const firstComponent = advanceConstruction(head.session, evidence, indexes, {});
  assert.equal(firstComponent.outcome, 'COMPONENT_COMMITTED');
  assert.equal(firstComponent.session.confirmedComponentIds.length, 1);
  assert.ok(firstComponent.session.strokeLedger.some((row) => row.op === 'DRAW_PIPE'));

  const completed = runConstructionUntilBlocked(firstComponent.session, evidence, indexes, {});
  assert.equal(completed.session.state, 'ROUTE_COMPLETE');
  assert.equal(completed.session.confirmedComponentIds.length, 2);
  assert.equal(completed.session.confirmedComponentIds.some((id) => indexes.components.get(id)?.branchId === host), false, 'host branch component must not be drawn');
}

{
  const branch = '/HEAD/BROKEN';
  const records = [{ type: 'BRANCH', name: branch, attributes: { NAME: branch, HPOS: { x: 0, y: 0, z: 0 }, HREF: '=MISSING/REF' }, children: [
    { type: 'PIPE', name: 'P1', attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } } },
  ] }];
  const { evidence, indexes, session } = setup(records, branch);
  const blocked = advanceConstruction(session, evidence, indexes, {});
  assert.equal(blocked.outcome, 'DECISION_REQUIRED');
  assert.equal(blocked.session.currentDecisionRequest.reason, 'REFERENCE_TARGET_MISSING');
  assert.equal(blocked.session.confirmedComponentIds.length, 0, 'missing HREF must block before drawing');
}

console.log('sequential head boundary gate tests passed');
