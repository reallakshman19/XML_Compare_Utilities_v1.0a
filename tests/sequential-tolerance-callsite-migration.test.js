import assert from 'node:assert/strict';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  advanceConstruction,
  createSequentialConstructionSession,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { resolveBoundaryReference } from '../tabs/sequential-sketcher/construction/sequential-boundary-resolver.js';
import { SEQUENTIAL_CONSTRUCTION_TOLERANCE_POLICY } from '../tabs/sequential-sketcher/policy/sequential-construction-tolerance-policy.js';

function pipe(name, start, end) {
  return { type: 'PIPE', name, attributes: { APOS: start, LPOS: end } };
}
function branch(name, attributes, children) {
  return { type: 'BRANCH', name, attributes: { NAME: name, ...attributes }, children };
}
function model(records) {
  const evidence = buildSequentialEvidenceModel(records);
  return { evidence, indexes: indexSequentialEvidence(evidence) };
}
function advanceThree(session, evidence, indexes, options) {
  let current = session;
  for (let step = 0; step < 3; step += 1) {
    current = advanceConstruction(current, evidence, indexes, options).session;
  }
  return current;
}

{
  const root = '/FITTING-TOLERANCE';
  const records = [branch(root, {
    HPOS: { x: 0, y: 0, z: 0 },
    TPOS: { x: 200.5, y: 0, z: 0 },
  }, [
    pipe('P1', { x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }),
    pipe('P2', { x: 100.5, y: 0, z: 0 }, { x: 200.5, y: 0, z: 0 }),
  ])];
  const { evidence, indexes } = model(records);

  const exact = advanceThree(
    createSequentialConstructionSession(root), evidence, indexes,
    { exactToleranceMm: 2, fittingPortEquivalenceMm: 1 },
  );
  assert.equal(exact.repairLedger.length, 0);
  assert.equal(exact.committedConnections[0].fittingPortToleranceMm, 1);
  assert.equal(exact.committedConnections[0].toleranceEvidenceType, 'FITTING_PORT_EQUIVALENCE');
  assert.equal(exact.committedConnections[0].tolerancePolicyFingerprint, SEQUENTIAL_CONSTRUCTION_TOLERANCE_POLICY.policyFingerprint);

  const repaired = advanceThree(
    createSequentialConstructionSession(root), evidence, indexes,
    { exactToleranceMm: 2, fittingPortEquivalenceMm: 0.1 },
  );
  assert.equal(repaired.repairLedger.length, 1, 'fitting-port override must control exact versus repair');
  assert.equal(repaired.repairLedger[0].thresholdMm, 25);
  assert.equal(repaired.repairLedger[0].toleranceEvidenceType, 'FITTING_PORT_EQUIVALENCE');
}

{
  const root = '/START-AMBIGUITY';
  const records = [branch(root, { HPOS: { x: 0, y: 0, z: 0 } }, [
    pipe('P1', { x: -1, y: 0, z: 0 }, { x: 1.0005, y: 0, z: 0 }),
  ])];
  const { evidence, indexes } = model(records);

  const ambiguous = advanceConstruction(
    createSequentialConstructionSession(root), evidence, indexes,
    { transformNoiseMm: 0.001 },
  ).session;
  assert.equal(ambiguous.state, 'USER_DECISION_REQUIRED');
  assert.equal(ambiguous.currentDecisionRequest.reason, 'AMBIGUOUS_BRANCH_START');
  assert.equal(ambiguous.currentDecisionRequest.transformNoiseMm, 0.001);

  const resolved = advanceConstruction(
    createSequentialConstructionSession(root), evidence, indexes,
    { transformNoiseMm: 0.0001 },
  ).session;
  assert.notEqual(resolved.state, 'USER_DECISION_REQUIRED', 'smaller transform-noise tolerance must resolve the nearest start port');
}

{
  const root = '/BOUNDARY-ROOT';
  const target = '/BOUNDARY-TARGET';
  const records = [
    branch(root, { HPOS: { x: 100.5, y: 0, z: 0 } }, [
      pipe('ROOT-P1', { x: 100.5, y: 0, z: 0 }, { x: 200, y: 0, z: 0 }),
    ]),
    branch(target, { HPOS: { x: 100.2, y: 0, z: 0 } }, [
      pipe('TARGET-P1', { x: 100.2, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
    ]),
  ];
  const { indexes } = model(records);
  const connectedPort = indexes.branches.get(root).components[0].ports.find((port) => port.sourcePosition?.x === 100.5);

  const exact = resolveBoundaryReference({
    boundaryRole: 'HEAD',
    boundaryPosition: { x: 100, y: 0, z: 0 },
    referenceValue: target,
    connectedPort,
    indexes,
    referenceBoundaryEquivalenceMm: 0.25,
    branchEndpointEquivalenceMm: 0.6,
  });
  assert.equal(exact.status, 'CONFIRMED_REFERENCE');
  assert.equal(exact.referenceBoundaryToleranceMm, 0.25);
  assert.equal(exact.branchEndpointToleranceMm, 0.6);

  const repaired = resolveBoundaryReference({
    boundaryRole: 'HEAD',
    boundaryPosition: { x: 100, y: 0, z: 0 },
    referenceValue: target,
    connectedPort,
    indexes,
    referenceBoundaryEquivalenceMm: 0.25,
    branchEndpointEquivalenceMm: 0.1,
  });
  assert.equal(repaired.status, 'AUTO_REPAIRED_SMALL_GAP');
  assert.deepEqual(repaired.toleranceEvidenceTypes, [
    'REFERENCE_BOUNDARY_EQUIVALENCE',
    'BRANCH_ENDPOINT_EQUIVALENCE',
  ]);
}

console.log('sequential tolerance callsite migration tests passed');
