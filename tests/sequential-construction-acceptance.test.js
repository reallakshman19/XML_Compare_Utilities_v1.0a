import assert from 'node:assert/strict';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { createConfirmedSequentialConstruction } from '../tabs/sequential-sketcher/construction/sequential-construction-acceptance.js';

function setup(records, branchId) {
  const evidence = buildSequentialEvidenceModel(records);
  return { evidence, indexes: indexSequentialEvidence(evidence), session: createSequentialConstructionSession(branchId) };
}

{
  const branchId = '/ACCEPT/B1';
  const records = [{ type: 'BRANCH', name: branchId, attributes: { NAME: branchId, HPOS: { x: 0, y: 0, z: 0 } }, children: [
    { type: 'PIPE', name: 'P1', attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } } },
    { type: 'CAP', name: 'C1', attributes: { APOS: { x: 100, y: 0, z: 0 } } },
  ] }];
  const { evidence, indexes, session } = setup(records, branchId);
  assert.throws(() => createConfirmedSequentialConstruction(session, indexes), /ROUTE_COMPLETE/);
  const result = runConstructionUntilBlocked(session, evidence, indexes, {});
  assert.equal(result.session.state, 'ROUTE_COMPLETE');
  const confirmed = createConfirmedSequentialConstruction(result.session, indexes);
  assert.equal(confirmed.schema, 'ConfirmedSequentialConstruction.v1');
  assert.equal(confirmed.components.length, 2);
  assert.equal(confirmed.connections.length, 1);
  assert.equal(confirmed.audit.openDecisionCount, 0);
  assert.equal(confirmed.audit.sourceCoordinatesMutated, false);
  assert.equal(confirmed.downstreamEligibility.supportProjection, true);
  assert.ok(confirmed.constructionFingerprint);
}

{
  const branchId = '/ACCEPT/BROKEN';
  const records = [{ type: 'BRANCH', name: branchId, attributes: { NAME: branchId, HPOS: { x: 0, y: 0, z: 0 } }, children: [
    { type: 'PIPE', name: 'P1', attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } } },
    { type: 'PIPE', name: 'P2', attributes: { APOS: { x: 500, y: 0, z: 0 }, LPOS: { x: 600, y: 0, z: 0 } } },
  ] }];
  const { evidence, indexes, session } = setup(records, branchId);
  const result = runConstructionUntilBlocked(session, evidence, indexes, {});
  assert.equal(result.session.state, 'USER_DECISION_REQUIRED');
  assert.throws(() => createConfirmedSequentialConstruction(result.session, indexes), /ROUTE_COMPLETE/);
}

console.log('sequential construction acceptance tests passed');
