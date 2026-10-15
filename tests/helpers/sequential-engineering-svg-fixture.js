import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  applyConstructionDecision,
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { createConfirmedSequentialConstruction } from '../../tabs/sequential-sketcher/construction/sequential-construction-acceptance.js';
import { buildConfirmedConstructionSupportProjection } from '../../tabs/sequential-sketcher/support/sequential-confirmed-support-projection.js';

function setup(records, branchId, options = {}) {
  const evidenceModel = buildSequentialEvidenceModel(records);
  const indexes = indexSequentialEvidence(evidenceModel);
  const initial = createSequentialConstructionSession(branchId);
  const result = runConstructionUntilBlocked(initial, evidenceModel, indexes, options);
  return { records, evidenceModel, indexes, initial, session: result.session };
}

export function blockedSequentialFixture() {
  const branchId = '/ESVG/BLOCKED';
  const records = [{ type: 'BRANCH', name: branchId, attributes: { NAME: branchId, HPOS: { x: 0, y: 0, z: 0 } }, children: [
    { type: 'PIPE', name: 'P1', attributes: { NAME: 'P1', APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } } },
    { type: 'PIPE', name: 'P2', attributes: { NAME: 'P2', APOS: { x: 110, y: 0, z: 0 }, LPOS: { x: 210, y: 0, z: 0 } } },
    { type: 'PIPE', name: 'P3', attributes: { NAME: 'P3', APOS: { x: 110, y: 1, z: 0 }, LPOS: { x: 210, y: 1, z: 0 } } },
  ] }];
  const fixture = setup(records, branchId);
  if (fixture.session.state !== 'USER_DECISION_REQUIRED') throw new Error('Blocked fixture did not block.');
  return fixture;
}

export function rejectedSequentialFixture() {
  const fixture = blockedSequentialFixture();
  const candidate = fixture.session.currentDecisionRequest.candidates[0];
  const result = applyConstructionDecision(
    fixture.session,
    fixture.evidenceModel,
    fixture.indexes,
    'REJECT_CANDIDATE',
    { candidateId: candidate.candidateId, reason: 'Not continuous', evidenceNote: 'Source review rejected this alternative.' },
    {},
  );
  return { ...fixture, rejectedCandidate: candidate, session: result.session };
}

export function confirmedSupportSequentialFixture() {
  const branchId = '/ESVG/SUPPORT';
  const records = [{ type: 'BRANCH', name: branchId, attributes: { NAME: branchId, HPOS: { x: 0, y: 0, z: 0 } }, children: [
    { type: 'PIPE', name: 'P1', attributes: { NAME: 'P1', APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 1000, y: 0, z: 0 } } },
    { type: 'SUPPORT', name: 'SUPPORT FAMILY', attributes: { NAME: '/PS-1/DATUM', TYPE: 'ATTA', OWNER: branchId, POS: { x: 250, y: 0, z: 0 }, CMPSUPTYPE: 'REST' } },
    { type: 'SUPPORT', name: 'SUPPORT FAMILY', attributes: { NAME: '/PS-1.1', TYPE: 'ATTA', OWNER: branchId, POS: { x: 250, y: 0, z: 0 }, CMPSUPTYPE: 'SH-100', DTXR: 'PIPE SHOE' } },
    { type: 'CAP', name: 'C1', attributes: { NAME: 'C1', APOS: { x: 1000, y: 0, z: 0 } } },
  ] }];
  const fixture = setup(records, branchId);
  const confirmedConstruction = createConfirmedSequentialConstruction(fixture.session, fixture.indexes);
  const supportProjection = buildConfirmedConstructionSupportProjection(confirmedConstruction, fixture.indexes, {});
  return { ...fixture, confirmedConstruction, supportProjection };
}

export function repairedSequentialFixture() {
  const branchId = '/ESVG/REPAIR';
  const records = [{ type: 'BRANCH', name: branchId, attributes: { NAME: branchId, HPOS: { x: 0, y: 0, z: 0 } }, children: [
    { type: 'PIPE', name: 'P1', attributes: { NAME: 'P1', APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } } },
    { type: 'ELBO', name: 'E1', attributes: { NAME: 'E1', APOS: { x: 112, y: 0, z: 0 }, POS: { x: 100, y: 0, z: 0 }, LPOS: { x: 112, y: 100, z: 0 } } },
    { type: 'CAP', name: 'C1', attributes: { NAME: 'C1', APOS: { x: 112, y: 100, z: 0 } } },
  ] }];
  const fixture = setup(records, branchId, { exactToleranceMm: 1, autoRepairToleranceMm: 25 });
  const confirmedConstruction = createConfirmedSequentialConstruction(fixture.session, fixture.indexes);
  return { ...fixture, confirmedConstruction };
}

export function adapterState(fixture, visibleProjection = 'ISO') {
  return Object.freeze({
    session: fixture.session,
    evidenceModel: fixture.evidenceModel,
    indexes: fixture.indexes,
    confirmedConstruction: fixture.confirmedConstruction || null,
    supportProjection: fixture.supportProjection || null,
    visibleProjection,
  });
}
