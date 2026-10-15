import assert from 'node:assert/strict';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';

function run(records, branchId, options = {}) {
  const evidence = buildSequentialEvidenceModel(records);
  const indexes = indexSequentialEvidence(evidence);
  return runConstructionUntilBlocked(
    createSequentialConstructionSession(branchId), evidence, indexes, options,
  ).session;
}

{
  const root = '/SOURCE/ACTIVE-ENDPOINT-MISSING';
  const records = [{
    type: 'BRANCH', name: root,
    attributes: {
      NAME: root, HPOS: { x: 0, y: 0, z: 0 }, TPOS: { x: 100, y: 0, z: 0 },
      TREF: '/A-881154-T-88029',
    },
    children: [{ type: 'PIPE', name: 'P1', attributes: { APOS: { x: 0, y: 0, z: 0 } } }],
  }];
  const session = run(records, root);
  assert.equal(session.state, 'USER_DECISION_REQUIRED');
  assert.equal(session.currentDecisionRequest.reason, 'EXTERNAL_BOUNDARY_ACTIVE_ENDPOINT_MISSING');
  assert.equal(session.boundaryClassifications.length, 0);
}

{
  const root = '/SOURCE/BOUNDARY-TOLERANCE';
  const records = [{
    type: 'BRANCH', name: root,
    attributes: {
      NAME: root, HPOS: { x: 0, y: 0, z: 0 }, TPOS: { x: 100.5, y: 0, z: 0 },
      TREF: '/A-881154-T-88029',
    },
    children: [{ type: 'PIPE', name: 'P1', attributes: {
      APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 },
    } }],
  }];
  const accepted = run(records, root, { exactToleranceMm: 1 });
  assert.equal(accepted.state, 'ROUTE_COMPLETE');
  assert.equal(accepted.boundaryClassifications[0].positionGapMm, 0.5);
  const blocked = run(records, root, { externalBoundaryExactToleranceMm: 0.25 });
  assert.equal(blocked.state, 'USER_DECISION_REQUIRED');
  assert.equal(blocked.currentDecisionRequest.reason, 'EXTERNAL_BOUNDARY_POSITION_MISMATCH');
}

console.log('sequential source boundary position tests passed');
