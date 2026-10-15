import assert from 'node:assert/strict';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  applyConstructionDecision,
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { createConfirmedSequentialConstruction } from '../tabs/sequential-sketcher/construction/sequential-construction-acceptance.js';
import {
  BOUNDARY_REFERENCE_CLASSIFICATIONS,
  classifySequentialBoundaryReference,
} from '../tabs/sequential-sketcher/construction/sequential-boundary-reference-classifier.js';

function run(records, branchId, options = {}) {
  const evidence = buildSequentialEvidenceModel(records);
  const indexes = indexSequentialEvidence(evidence);
  const result = runConstructionUntilBlocked(
    createSequentialConstructionSession(branchId), evidence, indexes, options,
  );
  return { evidence, indexes, result };
}
function pipe(name, start, end) {
  return { type: 'PIPE', name, attributes: { APOS: start, LPOS: end } };
}
function branch(name, attributes, children) {
  return { type: 'BRANCH', name, attributes: { NAME: name, ...attributes }, children };
}

{
  for (const reference of [
    '/A-881154-T-88029', '/A-881149-TP-04', '/A-881149/PURGE_CONNECTION',
    '/S-801028A/B/OUTLET',
  ]) {
    assert.equal(
      classifySequentialBoundaryReference(reference, 'TAIL').status,
      BOUNDARY_REFERENCE_CLASSIFICATIONS.EXTERNAL_PHYSICAL_BOUNDARY_CONFIRMED,
      reference,
    );
  }
  for (const reference of [
    '/A-123456/GENERAL', '/A-123456/STRUCTURE', '/A-123456/AREA/GROUP', '/A-123456-OWNER',
  ]) {
    assert.equal(
      classifySequentialBoundaryReference(reference, 'TAIL').status,
      BOUNDARY_REFERENCE_CLASSIFICATIONS.EXTERNAL_REFERENCE_CLASSIFIED,
      reference,
    );
  }
  for (const reference of ['/S-123456/B/INLET/CHILD', '/A-123456/']) {
    assert.equal(
      classifySequentialBoundaryReference(reference, 'TAIL').status,
      BOUNDARY_REFERENCE_CLASSIFICATIONS.UNCLASSIFIED,
      reference,
    );
  }
}

{
  const root = '/SOURCE/TAIL';
  const records = [branch(root, {
    HPOS: { x: 0, y: 0, z: 0 }, TPOS: { x: 100, y: 0, z: 0 }, TREF: '/A-881149-TP-04',
  }, [pipe('P1', { x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 })])];
  const first = run(records, root);
  const second = run(records, root);
  assert.equal(first.result.session.state, 'ROUTE_COMPLETE');
  assert.equal(first.result.session.decisionLedger.length, 0);
  const classification = first.result.session.boundaryClassifications[0];
  assert.equal(classification.classification, 'EXTERNAL_PHYSICAL_BOUNDARY_CONFIRMED');
  assert.equal(classification.positionStatus, 'POSITION_CONFIRMED');
  assert.equal(classification.positionGapMm, 0);
  assert.equal(classification.approvalSource, 'SOURCE_PHYSICAL_BOUNDARY_EVIDENCE');
  const confirmed = createConfirmedSequentialConstruction(first.result.session, first.indexes);
  const repeated = createConfirmedSequentialConstruction(second.result.session, second.indexes);
  assert.equal(confirmed.constructionFingerprint, repeated.constructionFingerprint);
}

{
  const root = '/SOURCE/HEAD';
  const records = [branch(root, {
    HPOS: { x: 0, y: 0, z: 0 }, HREF: '/S-801028A/B/OUTLET',
  }, [
    pipe('P1', { x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }),
    { type: 'CAP', name: 'C1', attributes: { APOS: { x: 100, y: 0, z: 0 } } },
  ])];
  const { indexes, result } = run(records, root);
  assert.equal(result.session.state, 'ROUTE_COMPLETE');
  assert.equal(result.session.headBoundaryValidated, true);
  assert.equal(result.session.boundaryClassifications[0].boundaryRole, 'HEAD');
  assert.ok(result.session.strokeLedger.some((row) => row.op === 'CONFIRM_SOURCE_EXTERNAL_BOUNDARY'));
  assert.equal(createConfirmedSequentialConstruction(result.session, indexes).audit.boundaryClassificationCount, 1);
}

{
  const root = '/SOURCE/IDENTITY-ONLY';
  const records = [branch(root, {
    HPOS: { x: 0, y: 0, z: 0 }, TPOS: { x: 100, y: 0, z: 0 }, TREF: '/A-123456/GENERAL',
  }, [pipe('P1', { x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 })])];
  const { result } = run(records, root);
  assert.equal(result.session.state, 'USER_DECISION_REQUIRED');
  assert.equal(result.session.currentDecisionRequest.reason, 'EXTERNAL_REFERENCE_CLASSIFIED');
  assert.equal(result.session.currentDecisionRequest.externalReferenceClassification.status, 'EXTERNAL_REFERENCE_CLASSIFIED');
  assert.equal(result.session.boundaryClassifications.length, 0);
}

{
  const root = '/SOURCE/BOUNDARY-MISSING';
  const records = [branch(root, {
    HPOS: { x: 0, y: 0, z: 0 }, TREF: '/A-881154-T-88029',
  }, [pipe('P1', { x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 })])];
  const { result } = run(records, root);
  assert.equal(result.session.state, 'USER_DECISION_REQUIRED');
  assert.equal(result.session.currentDecisionRequest.reason, 'EXTERNAL_BOUNDARY_POSITION_MISSING');
  assert.equal(result.session.boundaryClassifications.length, 0);
}

{
  const root = '/SOURCE/BOUNDARY-MISMATCH';
  const records = [branch(root, {
    HPOS: { x: 0, y: 0, z: 0 }, TPOS: { x: 130, y: 0, z: 0 }, TREF: '/A-881154-T-88029',
  }, [pipe('P1', { x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 })])];
  const { result } = run(records, root, { exactToleranceMm: 1 });
  assert.equal(result.session.state, 'USER_DECISION_REQUIRED');
  assert.equal(result.session.currentDecisionRequest.reason, 'EXTERNAL_BOUNDARY_POSITION_MISMATCH');
  assert.equal(result.session.currentDecisionRequest.externalReferenceClassification.positionGapMm, 30);
}

{
  const target = '/A-123456-T-1';
  const root = '/SOURCE/CATALOG-TARGET';
  const records = [
    branch(root, {
      HPOS: { x: 0, y: 0, z: 0 }, TPOS: { x: 100, y: 0, z: 0 }, TREF: target,
    }, [pipe('ROOT-P1', { x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 })]),
    branch(target, { HPOS: { x: 100, y: 0, z: 0 } }, [
      pipe('TARGET-P1', { x: 100, y: 0, z: 0 }, { x: 200, y: 0, z: 0 }),
      { type: 'CAP', name: 'TARGET-C1', attributes: { APOS: { x: 200, y: 0, z: 0 } } },
    ]),
  ];
  const { result } = run(records, root);
  assert.equal(result.session.state, 'ROUTE_COMPLETE');
  assert.equal(result.session.boundaryClassifications.length, 0, 'catalog target must use reference continuity');
}

{
  const root = '/SOURCE/COLLIDED-TARGET';
  const records = [
    branch('/A-123456-T-1', {}, []),
    branch('\\a-123456-t-1', {}, []),
    branch(root, {
      HPOS: { x: 0, y: 0, z: 0 }, TPOS: { x: 100, y: 0, z: 0 }, TREF: '/a-123456-t-1',
    }, [pipe('P1', { x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 })]),
  ];
  const { result } = run(records, root);
  assert.equal(result.session.state, 'USER_DECISION_REQUIRED');
  assert.equal(result.session.currentDecisionRequest.reason, 'REFERENCE_TARGET_AMBIGUOUS');
  assert.equal(result.session.boundaryClassifications.length, 0);
}

{
  const root = '/SOURCE/MISSING';
  const records = [branch(root, {
    HPOS: { x: 0, y: 0, z: 0 }, TREF: '=MISSING/TAIL',
  }, [pipe('P1', { x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 })])];
  const { result } = run(records, root);
  assert.equal(result.session.state, 'USER_DECISION_REQUIRED');
  assert.equal(result.session.currentDecisionRequest.reason, 'REFERENCE_TARGET_MISSING');
}

{
  const root = '/SOURCE/USER-TERMINAL';
  const records = [branch(root, { HPOS: { x: 0, y: 0, z: 0 } }, [
    pipe('P1', { x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }),
  ])];
  const blocked = run(records, root);
  const accepted = applyConstructionDecision(
    blocked.result.session, blocked.evidence, blocked.indexes,
    'MARK_TERMINAL', { reason: 'Field verified' }, {},
  );
  const resolution = accepted.session.decisionLedger[0].resolution;
  assert.equal(accepted.session.state, 'ROUTE_COMPLETE');
  assert.equal(resolution.provenance, 'USER_MANUAL');
  assert.notEqual(resolution.previousConstructionFingerprint, resolution.resultingConstructionFingerprint);
}

{
  const first = '/SOURCE/USER-CONNECT-A';
  const second = '/SOURCE/USER-CONNECT-B';
  const records = [
    branch(first, { HPOS: { x: 0, y: 0, z: 0 }, TREF: second }, [
      pipe('A-P1', { x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }),
    ]),
    branch(second, { HPOS: { x: 140, y: 0, z: 0 } }, [
      pipe('B-P1', { x: 140, y: 0, z: 0 }, { x: 220, y: 0, z: 0 }),
      { type: 'CAP', name: 'B-C1', attributes: { APOS: { x: 220, y: 0, z: 0 } } },
    ]),
  ];
  const blocked = run(records, first);
  const candidate = blocked.result.session.currentDecisionRequest.candidates.find((row) => row.targetBranchId === second);
  assert.ok(candidate);
  const accepted = applyConstructionDecision(
    blocked.result.session, blocked.evidence, blocked.indexes,
    'CONNECT', { candidateId: candidate.candidateId, reason: 'Confirmed against source evidence' }, {},
  );
  const decision = accepted.session.decisionLedger.at(-1);
  assert.equal(decision.resolution.provenance, 'USER_MANUAL');
  assert.ok(decision.candidatePortIds.includes(candidate.toPortId));
  assert.deepEqual(decision.resolvedCoordinates.fromPosition, { x: 100, y: 0, z: 0 });
  assert.deepEqual(decision.resolvedCoordinates.toPosition, { x: 140, y: 0, z: 0 });
  assert.equal(decision.sourceEvidence.referenceTarget, second);
  assert.notEqual(decision.resolution.previousConstructionFingerprint, decision.resolution.resultingConstructionFingerprint);
}

console.log('sequential source boundary tests passed');
