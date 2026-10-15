import assert from 'node:assert/strict';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';

function setup(records, branchId) {
  const evidence = buildSequentialEvidenceModel(records);
  return { evidence, indexes: indexSequentialEvidence(evidence), session: createSequentialConstructionSession(branchId) };
}

{
  const branchId = '/ZERO/B1';
  const records = [{ type: 'BRANCH', name: branchId, attributes: { NAME: branchId, HPOS: { x: 0, y: 0, z: 0 } }, children: [
    { type: 'PIPE', name: 'P1', attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 }, LBORE: '150mm' } },
    { type: 'FLAN', name: 'F1', attributes: { APOS: { x: 100, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 }, ABORE: '150mm', LBORE: '150mm' } },
    { type: 'GASK', name: 'G1', attributes: { APOS: { x: 100, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 }, ABORE: '150mm', LBORE: '150mm' } },
    { type: 'PIPE', name: 'P2', attributes: { APOS: { x: 100, y: 0, z: 0 }, LPOS: { x: 200, y: 0, z: 0 }, ABORE: '150mm', LBORE: '150mm' } },
    { type: 'CAP', name: 'C1', attributes: { APOS: { x: 200, y: 0, z: 0 } } },
  ] }];
  const { evidence, indexes, session } = setup(records, branchId);
  const result = runConstructionUntilBlocked(session, evidence, indexes, {});
  assert.equal(result.session.state, 'ROUTE_COMPLETE');
  assert.deepEqual(
    result.session.confirmedComponentIds.map((id) => indexes.components.get(id)?.sourceComponentId),
    ['P1', 'F1', 'G1', 'P2', 'C1'],
  );
  assert.equal(result.session.repairLedger.length, 0);
  assert.equal(result.session.currentDecisionRequest, null);
  const operations = result.session.strokeLedger.map((row) => row.op);
  assert.equal(operations.filter((op) => op === 'DRAW_FLANGE').length, 1);
  assert.equal(operations.filter((op) => op === 'DRAW_GASKET').length, 1);
  assert.equal(operations.filter((op) => op === 'DRAW_PIPE').length, 2);
  assert.equal(result.session.committedConnections.length, 4);
  const zeroLengthConnections = result.session.committedConnections.filter((connection) => (
    connection.targetSourceComponentId === 'F1' || connection.targetSourceComponentId === 'G1'
  ));
  assert.equal(zeroLengthConnections.length, 2);
  assert.ok(zeroLengthConnections.every((connection) => connection.gapMm === 0));
}

{
  const branchId = '/ZERO/AMBIGUOUS';
  const records = [{ type: 'BRANCH', name: branchId, attributes: { NAME: branchId, HPOS: { x: 0, y: 0, z: 0 } }, children: [
    { type: 'PIPE', name: 'P1', attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } } },
    { type: 'FLAN', name: 'F1', attributes: { APOS: { x: 100, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } } },
    { type: 'PIPE', name: 'P2', attributes: { APOS: { x: 100, y: 0, z: 0 }, LPOS: { x: 200, y: 0, z: 0 } } },
    { type: 'PIPE', name: 'P3', attributes: { APOS: { x: 100, y: 0, z: 0 }, LPOS: { x: 100, y: 100, z: 0 } } },
  ] }];
  const { evidence, indexes, session } = setup(records, branchId);
  const result = runConstructionUntilBlocked(session, evidence, indexes, {});
  assert.equal(result.session.state, 'USER_DECISION_REQUIRED');
  assert.equal(result.session.currentDecisionRequest.reason, 'MULTIPLE_EXACT_CANDIDATES');
  assert.deepEqual(
    result.session.confirmedComponentIds.map((id) => indexes.components.get(id)?.sourceComponentId),
    ['P1', 'F1'],
    'zero-length flange may be committed, but the divergent downstream route must still block',
  );
}

console.log('sequential zero-length inline tests passed');
